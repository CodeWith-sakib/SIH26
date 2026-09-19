import { Request, Response } from 'express';
import mongoose from 'mongoose';
import EmploymentJob from '../../../shared/models/EmploymentJob.js';
import Application from '../../../shared/models/Application.js';
import Consent from '../../../shared/models/Consent.js';
import User from '../../../shared/models/User.js';
import UploadedDocument from '../../../shared/models/UploadedDocument.js';
import Department from '../../../shared/models/Department.js';
import { EmploymentService, employmentPortalAdapter } from '../service/employmentService.js';
import { auditService } from '../../audit/service/auditService.js';
import { createNotification } from '../../notification/service/notificationService.js';
import { integrationEngine } from '../../integrationEngine/engine/IntegrationEngineImpl.js';
import { entityMatcher } from '../../integrationEngine/entityMatcher/EntityMatcherImpl.js';

export class EmploymentController {
  constructor(private readonly employmentService: EmploymentService) {}

  private async getOwnedApplication(id: string, citizenId: string) {
    if (!mongoose.isValidObjectId(id)) return null;
    return Application.findOne({ _id: id, citizenId, applicationKind: 'employment' });
  }

  async listJobs(req: Request, res: Response): Promise<void> {
    await this.employmentService.ensureSeeded();
    const q = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const filter: Record<string, unknown> = { active: true };
    for (const key of ['category', 'district', 'employmentType', 'organization']) {
      if (typeof req.query[key] === 'string' && req.query[key]) filter[key] = req.query[key];
    }
    if (q) filter.$or = ['title', 'organization', 'location', 'qualification'].map(key => ({ [key]: { $regex: q, $options: 'i' } }));
    const jobs = await EmploymentJob.find(filter).sort({ deadline: 1 }).lean();
    res.json({ jobs });
  }

  async getJob(req: Request<{ jobId: string }>, res: Response): Promise<void> {
    await this.employmentService.ensureSeeded();
    const job = await EmploymentJob.findOne({ jobId: req.params.jobId, active: true }).lean();
    if (job) res.json({ job }); else res.status(404).json({ message: 'Job not found' });
  }

  async createApplication(req: Request, res: Response): Promise<void> {
    const jobId = typeof req.body.jobId === 'string' ? req.body.jobId : '';
    await this.employmentService.ensureSeeded();
    const job = await EmploymentJob.findOne({ jobId, active: true });
    if (!job) { res.status(404).json({ message: 'Job not found' }); return; }
    if (job.deadline < new Date()) { res.status(409).json({ message: 'The application deadline has passed' }); return; }

    let application = await Application.findOne({ citizenId: req.user!.id, employmentJobId: job._id, applicationKind: 'employment', status: 'draft' });
    if (!application) {
      application = await Application.create({
        citizenId: req.user!.id, applicationNumber: this.employmentService.generateApplicationNumber(),
        jobId: job.jobId, employmentJobId: job._id, department: job.department, position: job.title,
        status: 'draft', applicationKind: 'employment'
      });
      await auditService.record({ actorId: req.user!.id, actorRole: req.user!.role, action: 'EMPLOYMENT_APPLICATION_CREATED', applicationId: application.id, resource: 'application', resourceId: application.id, department: job.department, requestId: req.requestId, outcome: 'SUCCESS' });
    }
    res.status(201).json({ application });
  }

  async listApplications(req: Request, res: Response): Promise<void> {
    const applications = await Application.find({ citizenId: req.user!.id, applicationKind: 'employment' }).populate('employmentJobId').sort({ createdAt: -1 }).lean();
    res.json({ applications });
  }

  async getApplication(req: Request<{ id: string }>, res: Response): Promise<void> {
    const application = await this.getOwnedApplication(req.params.id, req.user!.id);
    if (!application) { res.status(404).json({ message: 'Application not found' }); return; }
    const [job, documents, consent] = await Promise.all([
      EmploymentJob.findById(application.employmentJobId).lean(),
      UploadedDocument.find({ applicationId: application._id }).select('-cloudinaryPublicId').lean(),
      Consent.findOne({ applicationId: application._id, citizenId: req.user!.id }).lean()
    ]);
    res.json({ application, job, documents, consent });
  }

  async updateApplication(req: Request<{ id: string }>, res: Response): Promise<void> {
    const application = await this.getOwnedApplication(req.params.id, req.user!.id);
    if (!application) { res.status(404).json({ message: 'Application not found' }); return; }
    if (application.status !== 'draft') { res.status(409).json({ message: 'Only draft applications can be edited' }); return; }
    const formData = this.employmentService.cleanData(req.body.formData);
    if (!formData || typeof formData !== 'object') { res.status(400).json({ message: 'Valid form data is required' }); return; }
    application.formData = formData as Record<string, unknown>;
    application.markModified('formData');
    await application.save();
    res.json({ application });
  }

  async fetchData(req: Request<{ id: string }>, res: Response): Promise<void> {
    const application = await this.getOwnedApplication(req.params.id, req.user!.id);
    if (!application) { res.status(404).json({ message: 'Application not found' }); return; }
    const consent = await Consent.findOne({ applicationId: application._id, citizenId: req.user!.id, status: 'active' });
    if (!consent) { res.status(403).json({ message: 'Active employment data consent is required' }); return; }
    const user = await User.findById(req.user!.id).lean();
    if (!user) { res.status(404).json({ message: 'Citizen profile not found' }); return; }

    const data: Record<string, string> = { fullName: user.name, email: user.email };
    const sources: Record<string, string> = { fullName: 'Citizen profile', email: 'Citizen profile' };
    if (user.dateOfBirth) { data.dateOfBirth = user.dateOfBirth; sources.dateOfBirth = 'Citizen profile'; }
    if (user.phone) { data.mobile = user.phone; sources.mobile = 'Citizen profile'; }
    if (user.registrationNumber) { data.citizenReference = user.registrationNumber; sources.citizenReference = 'Citizen profile'; }

    const profileFields: Record<string, string | undefined> = {
      gender: user.gender, institution: user.college, highestQualification: user.education, category: user.category,
      address: user.address, district: user.district, state: user.state, pincode: user.pincode
    };
    for (const [field, value] of Object.entries(profileFields)) {
      if (value) { data[field] = value; sources[field] = 'Citizen profile'; }
    }
    const profileDataFound = Object.keys(profileFields).some(field => Boolean(data[field]));

    const departmentCodes = consent.dataCategories.filter(category => category === 'education' || category === 'employment').map(category => category.toUpperCase());
    const availableDepartments = await Department.find({ code: { $in: departmentCodes }, active: true }).lean();
    let departmentDataFound = false;
    const matchedDepartments: Array<{ department: string; confidence: number }> = [];

    for (const department of availableDepartments) {
      if (!(await integrationEngine.isDepartmentAvailable(department.code))) continue;
      let departmentData;
      try {
        departmentData = await integrationEngine.getCitizenData({
          departmentCode: department.code, citizenIdentifier: { name: user.name, dateOfBirth: user.dateOfBirth, email: user.email, phone: user.phone },
          requestedCategories: department.dataCategories || []
        });
      } catch { continue; }
      if (!departmentData) continue;

      const match = await entityMatcher.match({
        sourceData: departmentData, applicationData: { name: user.name, dateOfBirth: user.dateOfBirth, email: user.email, phone: user.phone, registrationNumber: user.registrationNumber }
      });
      if (!match.samePerson) continue;

      departmentDataFound = true;
      matchedDepartments.push({ department: department.name, confidence: match.confidence });

      const mapped: Record<string, unknown> = {
        fullName: departmentData.name, dateOfBirth: departmentData.dateOfBirth, mobile: departmentData.phone,
        email: departmentData.email, citizenReference: departmentData.registrationNumber,
        highestQualification: departmentData.qualification, score: departmentData.score
      };
      for (const [field, value] of Object.entries(mapped)) {
        if (value !== undefined && value !== null && String(value).trim()) {
          data[field] = String(value);
          sources[field] = department.name;
        }
      }
    }

    if (!departmentDataFound && !profileDataFound) { res.status(404).json({ message: 'Your data was not found in any connected department.' }); return; }

    application.fetchedFields = Object.keys(data);
    application.consentId = consent._id;
    await application.save();
    await auditService.record({ actorId: req.user!.id, actorRole: req.user!.role, action: 'EMPLOYMENT_DATA_FETCHED', applicationId: application.id, consentId: consent.id, purpose: consent.purpose || 'Prefill employment application', requestId: req.requestId, outcome: 'SUCCESS', metadata: { fields: Object.keys(data), source: consent.dataSource || 'MahaSetu citizen profile' } });
    res.json({ data, fetchedFields: Object.keys(data), sources, matchedDepartments });
  }

  async submitApplication(req: Request<{ id: string }>, res: Response): Promise<void> {
    const application = await this.getOwnedApplication(req.params.id, req.user!.id);
    if (!application) { res.status(404).json({ message: 'Application not found' }); return; }
    if (application.status !== 'draft') { res.status(409).json({ message: 'Application has already been submitted' }); return; }

    const form = this.employmentService.cleanData(req.body.formData) as Record<string, any> | undefined;
    const required = ['personal.fullName', 'personal.dateOfBirth', 'personal.gender', 'personal.mobile', 'personal.email', 'personal.address', 'personal.district', 'personal.state', 'personal.pincode', 'education.highestQualification', 'education.institution', 'education.passingYear', 'education.score', 'employment.employmentStatus', 'employment.totalExperience', 'employment.skills', 'category.category'];
    const missing = required.filter(path => !path.split('.').reduce<any>((v, key) => v?.[key], form));
    if (missing.length) { res.status(400).json({ message: 'Complete all required application fields', missingFields: missing }); return; }

    const job = await EmploymentJob.findById(application.employmentJobId);
    if (!job) { res.status(404).json({ message: 'Job not found' }); return; }

    const docs = await UploadedDocument.find({ applicationId: application._id, userId: req.user!.id });
    const missingDocuments = job.requiredDocuments.filter(d => d.required && !docs.some(x => x.documentType === d.name)).map(d => d.name);
    if (missingDocuments.length) { res.status(400).json({ message: `Upload required documents: ${missingDocuments.join(', ')}`, missingDocuments }); return; }

    const values = Object.entries(form || {}).flatMap(([group, obj]) => typeof obj === 'object' && obj ? Object.keys(obj).map(k => `${group}.${k}`) : []);
    application.formData = form;
    application.manuallyEnteredFields = values.filter(k => !application.fetchedFields.includes(k.split('.')[1]));
    application.status = 'submitted';
    application.submittedAt = new Date();
    application.markModified('formData');

    const external = await employmentPortalAdapter.submitApplication(application.id);
    application.externalSubmissionStatus = external.status;
    application.externalApplicationId = external.externalApplicationId;
    await application.save();

    await Promise.all([
      auditService.record({ actorId: req.user!.id, actorRole: req.user!.role, action: 'EMPLOYMENT_APPLICATION_SUBMITTED', applicationId: application.id, resource: 'application', resourceId: application.id, department: job.department, requestId: req.requestId, outcome: 'SUCCESS', metadata: { jobId: job.jobId, externalStatus: external.status } }),
      createNotification({ userId: req.user!.id, type: 'application', title: 'Employment application submitted', message: `${application.applicationNumber} was submitted successfully.`, applicationId: application.id })
    ]);
    res.json({ application, trackingId: application.applicationNumber });
  }
}
