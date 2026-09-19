import Application, { ApplicationStatus } from '../../../shared/models/Application.js';
import Consent, { ConsentDataCategory } from '../../../shared/models/Consent.js';
import Department from '../../../shared/models/Department.js';
import Integration from '../../../shared/models/Integration.js';
import Verification, { VerificationStatus } from '../../../shared/models/Verification.js';
import User from '../../../shared/models/User.js';
import { IntegrationEngine, DepartmentDataRequest } from '../../integrationEngine/engine/IntegrationEngine.interface.js';
import { CanonicalCitizenData } from '../../integrationEngine/parsing/FieldMapper.js';
import { EntityMatcher, MatchRequest, MatchResult } from '../../integrationEngine/entityMatcher/MlMatcher.interface.js';
import config from '../../../shared/config/index.js';
import { createNotification } from '../../notification/service/notificationService.js';
import { auditService, AuditContext } from '../../audit/service/auditService.js';

interface VerificationOptions {
  integrationEngine: IntegrationEngine;
  entityMatcher: EntityMatcher;
}

interface VerifyApplicationResult {
  verification: {
    id: string; status: VerificationStatus; matched: boolean | null; confidence: number | null;
    sourceDepartment: string | null; verifiedAt: Date | null; failureReason: string | null;
  };
  application: { id: string; status: ApplicationStatus; };
}

export class VerificationError extends Error {
  constructor(public message: string, public statusCode: number) {
    super(message);
    this.name = 'VerificationError';
  }
}

export class VerificationService {
  private integrationEngine: IntegrationEngine;
  private entityMatcher: EntityMatcher;

  constructor(options: VerificationOptions) {
    this.integrationEngine = options.integrationEngine;
    this.entityMatcher = options.entityMatcher;
  }

  async getDepartmentData(applicationId: string, requestedCategories: string[], departmentCodes: string[], context?: AuditContext): Promise<{ department: string; data: CanonicalCitizenData; match: MatchResult }> {
    const application = await Application.findById(applicationId);
    if (!application) throw new VerificationError('Application not found', 404);
    const user = await User.findById(application.citizenId);
    if (!user) throw new VerificationError('Application citizen not found', 404);

    const consent = await Consent.findOne({ citizenId: application.citizenId, applicationId: application._id });
    if (!consent || consent.status !== 'active' || (consent.expiresAt && consent.expiresAt <= new Date())) {
      await auditService.record({ actorId: context?.actorId ?? null, ...(context?.actorRole && { actorRole: context.actorRole }), action: 'DATA_ACCESS_DENIED', resource: 'consent', applicationId: application._id.toString(), ...(consent && { consentId: consent._id.toString() }), requestId: context?.requestId, outcome: 'DENIED', metadata: { reason: !consent ? 'missing_consent' : `consent_${consent.status}` } });
      throw new VerificationError('Active consent is required to fetch department data', 403);
    }
    if (!requestedCategories.every(category => consent.dataCategories.includes(category as ConsentDataCategory))) throw new VerificationError('Consent does not cover requested data categories', 403);

    for (const departmentCode of departmentCodes) {
      if (!(await this.integrationEngine.isDepartmentAvailable(departmentCode))) throw new VerificationError(`Department ${departmentCode} integration unavailable`, 503);
    }

    const data = await this.integrationEngine.getCitizenData({ departmentCode: departmentCodes[0]!, citizenIdentifier: this.buildCitizenIdentifier(user, application), requestedCategories });
    if (!data) throw new VerificationError('No citizen data found in the configured department', 404);

    const match = await this.entityMatcher.match({ sourceData: data, applicationData: this.buildApplicationCanonicalData(user, application) });
    if (!match.samePerson || match.confidence < config.verification.confidenceThreshold) throw new VerificationError('Department record did not match the authenticated citizen', 404);

    await auditService.record({ actorId: context?.actorId ?? null, ...(context?.actorRole && { actorRole: context.actorRole }), action: 'DATA_ACCESS_ALLOWED', resource: 'department', applicationId: application._id.toString(), department: departmentCodes[0], consentId: consent._id.toString(), purpose: 'Fetch citizen data for application form', requestId: context?.requestId, outcome: 'SUCCESS' });
    return { department: departmentCodes[0]!, data, match };
  }

  async verifyApplication(applicationId: string, requestedCategories: string[], departmentCodes: string[], context?: AuditContext): Promise<VerifyApplicationResult> {
    const application = await Application.findById(applicationId);
    if (!application) throw new VerificationError('Application not found', 404);
    if (application.status === 'withdrawn') throw new VerificationError('Cannot verify a withdrawn application', 409);

    const user = await User.findById(application.citizenId);
    if (!user) throw new VerificationError('Application citizen not found', 404);

    const consent = await Consent.findOne({ citizenId: application.citizenId, applicationId: application._id });
    if (!consent) { await auditService.record({ actorId: context?.actorId ?? null, ...(context?.actorRole && { actorRole: context.actorRole }), action: 'DATA_ACCESS_DENIED', resource: 'consent', applicationId: application._id.toString(), requestId: context?.requestId, outcome: 'DENIED', metadata: { reason: 'missing_consent' } }); throw new VerificationError('Consent not granted for this application', 403); }
    if (consent.status !== 'active') { await auditService.record({ actorId: context?.actorId ?? null, ...(context?.actorRole && { actorRole: context.actorRole }), action: 'DATA_ACCESS_DENIED', resource: 'consent', resourceId: consent._id.toString(), applicationId: application._id.toString(), consentId: consent._id.toString(), requestId: context?.requestId, outcome: 'DENIED', metadata: { reason: `consent_${consent.status}` } }); throw new VerificationError(`Consent is ${consent.status}`, 403); }
    if (consent.expiresAt && consent.expiresAt <= new Date()) { await auditService.record({ actorId: context?.actorId ?? null, ...(context?.actorRole && { actorRole: context.actorRole }), action: 'DATA_ACCESS_DENIED', resource: 'consent', resourceId: consent._id.toString(), applicationId: application._id.toString(), consentId: consent._id.toString(), requestId: context?.requestId, outcome: 'DENIED', metadata: { reason: 'consent_expired' } }); throw new VerificationError('Consent has expired', 403); }

    const hasRequiredCategories = requestedCategories.every(cat => consent.dataCategories.includes(cat as ConsentDataCategory));
    if (!hasRequiredCategories) { await auditService.record({ actorId: context?.actorId ?? null, ...(context?.actorRole && { actorRole: context.actorRole }), action: 'DATA_ACCESS_DENIED', resource: 'consent', resourceId: consent._id.toString(), applicationId: application._id.toString(), consentId: consent._id.toString(), requestId: context?.requestId, outcome: 'DENIED', metadata: { reason: 'insufficient_categories', requestedCategories, consentCategories: consent.dataCategories } }); throw new VerificationError('Consent does not cover required data categories', 403); }

    for (const deptCode of departmentCodes) {
      const department = await Department.findOne({ code: deptCode.toUpperCase(), active: true });
      if (!department) throw new VerificationError(`Department ${deptCode} not found or inactive`, 404);
      const integration = await Integration.findOne({ departmentId: department._id, active: true });
      if (!integration) throw new VerificationError(`No active integration for department ${deptCode}`, 503);
      if (!(await this.integrationEngine.isDepartmentAvailable(deptCode))) throw new VerificationError(`Department ${deptCode} integration unavailable`, 503);
    }

    const verification = await Verification.create({ applicationId: application._id, status: 'pending', requestedCategories, departmentCodes, matched: null, confidence: null, sourceDepartment: null, verifiedAt: null, failureReason: null });

    await auditService.record({ actorId: context?.actorId ?? null, ...(context?.actorRole && { actorRole: context.actorRole }), action: 'VERIFICATION_STARTED', resource: 'verification', resourceId: verification._id.toString(), applicationId: application._id.toString(), department: departmentCodes[0], consentId: consent._id.toString(), purpose: 'Citizen data verification', requestId: context?.requestId, outcome: 'SUCCESS', metadata: { requestedCategories, departmentCodes } });

    if (application.status === 'submitted') { application.status = 'under_review'; await application.save(); }

    try {
      const citizenIdentifier = this.buildCitizenIdentifier(user, application);
      let departmentData: CanonicalCitizenData | null = null;
      let sourceDepartment = departmentCodes[0];

      for (const deptCode of departmentCodes) {
        await auditService.record({ actorId: context?.actorId ?? null, ...(context?.actorRole && { actorRole: context.actorRole }), action: 'DATA_ACCESS_REQUESTED', resource: 'department', applicationId: application._id.toString(), department: deptCode, consentId: consent._id.toString(), purpose: 'Fetch citizen canonical records', requestId: context?.requestId, outcome: 'SUCCESS', metadata: { requestedCategories } });
        const data = await this.integrationEngine.getCitizenData({ departmentCode: deptCode, citizenIdentifier, requestedCategories });
        if (data) {
          departmentData = data; sourceDepartment = deptCode;
          await auditService.record({ actorId: context?.actorId ?? null, ...(context?.actorRole && { actorRole: context.actorRole }), action: 'DATA_ACCESS_ALLOWED', resource: 'department', applicationId: application._id.toString(), department: deptCode, consentId: consent._id.toString(), purpose: 'Received citizen canonical data', requestId: context?.requestId, outcome: 'SUCCESS' });
          break;
        }
      }

      if (!departmentData) throw new VerificationError('No citizen data found in any configured department', 404);

      const matchRequest: MatchRequest = { sourceData: departmentData, applicationData: this.buildApplicationCanonicalData(user, application) };
      const matchResult = await this.entityMatcher.match(matchRequest);

      if (matchResult.confidence < 0 || matchResult.confidence > 1) throw new VerificationError('Invalid confidence value from matcher', 500);
      const matched = matchResult.samePerson && matchResult.confidence >= config.verification.confidenceThreshold;

      verification.matched = matched; verification.confidence = matchResult.confidence; verification.sourceDepartment = sourceDepartment; verification.verifiedAt = new Date(); verification.status = 'completed'; verification.failureReason = matched ? null : 'Identity match below confidence threshold'; await verification.save();
      application.status = matched ? 'verified' : 'rejected'; await application.save();

      await auditService.record({ actorId: context?.actorId ?? null, ...(context?.actorRole && { actorRole: context.actorRole }), action: 'VERIFICATION_COMPLETED', resource: 'verification', resourceId: verification._id.toString(), applicationId: application._id.toString(), department: sourceDepartment, consentId: consent._id.toString(), requestId: context?.requestId, outcome: 'SUCCESS', metadata: { matched, confidence: matchResult.confidence, sourceDepartment, matchedFields: matchResult.matchedFields, unmatchedFields: matchResult.unmatchedFields } });

      if (matched) await auditService.record({ actorId: context?.actorId ?? null, ...(context?.actorRole && { actorRole: context.actorRole }), action: 'APPLICATION_APPROVED', resource: 'application', resourceId: application._id.toString(), applicationId: application._id.toString(), department: sourceDepartment, requestId: context?.requestId, outcome: 'SUCCESS' });
      else await auditService.record({ actorId: context?.actorId ?? null, ...(context?.actorRole && { actorRole: context.actorRole }), action: 'APPLICATION_REJECTED', resource: 'application', resourceId: application._id.toString(), applicationId: application._id.toString(), department: sourceDepartment, requestId: context?.requestId, outcome: 'SUCCESS', metadata: { reason: 'Identity match below confidence threshold' } });

      await createNotification({ userId: application.citizenId.toString(), type: 'verification', title: matched ? 'Verification Completed' : 'Verification Rejected', message: matched ? 'Your cross-department verification completed successfully.' : 'Your cross-department verification did not meet the match threshold.', applicationId: application._id.toString() });

      return {
        verification: { id: verification._id.toString(), status: verification.status, matched: verification.matched, confidence: verification.confidence, sourceDepartment: verification.sourceDepartment, verifiedAt: verification.verifiedAt, failureReason: verification.failureReason },
        application: { id: application._id.toString(), status: application.status }
      };
    } catch (error: unknown) {
      if (error instanceof VerificationError) {
        await auditService.record({ actorId: context?.actorId ?? null, ...(context?.actorRole && { actorRole: context.actorRole }), action: 'VERIFICATION_FAILED', resource: 'verification', resourceId: verification?._id?.toString(), applicationId: application._id.toString(), requestId: context?.requestId, outcome: 'FAILURE', metadata: { reason: error.message } });
        throw error;
      }
      verification.status = 'failed'; verification.failureReason = error instanceof Error ? error.message : 'Verification failed'; await verification.save();
      await auditService.record({ actorId: context?.actorId ?? null, ...(context?.actorRole && { actorRole: context.actorRole }), action: 'VERIFICATION_FAILED', resource: 'verification', resourceId: verification._id.toString(), applicationId: application._id.toString(), requestId: context?.requestId, outcome: 'FAILURE', metadata: { reason: verification.failureReason } });
      throw new VerificationError('Verification process failed', 500);
    }
  }

  private buildCitizenIdentifier(user: any, application: any): any {
    return { name: user.name, email: user.email, id: user.name, ...(user.dateOfBirth && { dateOfBirth: user.dateOfBirth }), ...(user.phone && { phone: user.phone }), ...(user.registrationNumber && { registrationNumber: user.registrationNumber }) };
  }

  private buildApplicationCanonicalData(user: any, application: any): CanonicalCitizenData {
    return { name: user.name, email: user.email, ...(user.dateOfBirth && { dateOfBirth: user.dateOfBirth }), ...(user.phone && { phone: user.phone }), ...(user.registrationNumber && { registrationNumber: user.registrationNumber }) };
  }
}
