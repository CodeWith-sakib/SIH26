import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Application from '../../../shared/models/Application.js';
import Verification from '../../../shared/models/Verification.js';
import Department from '../../../shared/models/Department.js';
import { VerificationService, VerificationError } from '../service/verificationService.js';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function determineVerificationConfig(departmentName: string): Promise<{ requestedCategories: string[]; departmentCodes: string[] }> {
  const escaped = escapeRegExp(departmentName.trim());
  let department = await Department.findOne({ active: true, name: { $regex: new RegExp(`^${escaped}$`, 'i') } });

  if (!department) department = await Department.findOne({ active: true, name: { $regex: new RegExp(`^${escaped}`, 'i') } });
  if (!department) department = await Department.findOne({ active: true, code: departmentName.toUpperCase() });

  if (!department) throw new VerificationError(`No active department matches "${departmentName}"`, 404);

  return {
    departmentCodes: [department.code],
    requestedCategories: department.dataCategories && department.dataCategories.length > 0 ? department.dataCategories : [department.code.toLowerCase()],
  };
}

export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  private handleVerificationError(error: unknown, res: Response): void {
    if (error instanceof VerificationError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: 'Internal server error' });
  }

  async verify(req: Request<{ id: string }>, res: Response): Promise<void> {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) { res.status(400).json({ message: 'Invalid application ID' }); return; }

    try {
      const application = await Application.findById(id);
      if (!application) { res.status(404).json({ message: 'Application not found' }); return; }

      const { requestedCategories, departmentCodes } = await determineVerificationConfig(application.department);
      const result = await this.verificationService.verifyApplication(id, requestedCategories, departmentCodes, {
        actorId: req.user?.id, actorRole: req.user?.role, requestId: req.requestId,
      });
      res.status(200).json({ message: 'Verification completed', ...result });
    } catch (error: unknown) { this.handleVerificationError(error, res); }
  }

  async getDepartmentData(req: Request<{ id: string }>, res: Response): Promise<void> {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) { res.status(400).json({ message: 'Invalid application ID' }); return; }

    try {
      const application = await Application.findById(id).select('citizenId department');
      if (!application) { res.status(404).json({ message: 'Application not found' }); return; }

      const isOwner = req.user?.role === 'citizen' && application.citizenId.toString() === req.user.id;
      const isOfficerOrAdmin = req.user?.role === 'admin' || req.user?.role === 'department_officer';
      if (!isOwner && !isOfficerOrAdmin) { res.status(403).json({ message: 'Access denied' }); return; }

      const { requestedCategories, departmentCodes } = await determineVerificationConfig(application.department);
      const result = await this.verificationService.getDepartmentData(id, requestedCategories, departmentCodes, {
        actorId: req.user?.id, actorRole: req.user?.role, requestId: req.requestId,
      });

      res.json({ applicationId: id, department: result.department, data: result.data, match: result.match });
    } catch (error: unknown) { this.handleVerificationError(error, res); }
  }

  async getVerification(req: Request<{ id: string }>, res: Response): Promise<void> {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) { res.status(400).json({ message: 'Invalid application ID' }); return; }

    try {
      const application = await Application.findById(id).select('citizenId status');
      if (!application) { res.status(404).json({ message: 'Application not found' }); return; }

      const isOwner = req.user?.role === 'citizen' && application.citizenId.toString() === req.user.id;
      const isOfficerOrAdmin = req.user?.role === 'admin' || req.user?.role === 'department_officer';
      if (!isOwner && !isOfficerOrAdmin) { res.status(403).json({ message: 'Access denied' }); return; }

      const verification = await Verification.findOne({ applicationId: id })
        .sort({ createdAt: -1 })
        .select('status matched confidence sourceDepartment verifiedAt failureReason createdAt');

      if (!verification) { res.status(404).json({ message: 'No verification attempt found' }); return; }

      res.json({
        applicationId: id, applicationStatus: application.status,
        verification: {
          id: verification._id.toString(), status: verification.status, matched: verification.matched,
          confidence: verification.confidence, sourceDepartment: verification.sourceDepartment,
          verifiedAt: verification.verifiedAt, failureReason: verification.failureReason, createdAt: (verification as any).createdAt,
        },
      });
    } catch (error: unknown) { res.status(500).json({ message: 'Failed to fetch verification status' }); }
  }

  async getVerifications(req: Request<{ id: string }>, res: Response): Promise<void> {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) { res.status(400).json({ message: 'Invalid application ID' }); return; }

    try {
      const verifications = await Verification.find({ applicationId: id })
        .sort({ createdAt: -1 })
        .select('status matched confidence sourceDepartment verifiedAt failureReason createdAt');
      res.json({ verifications });
    } catch (error: unknown) { res.status(500).json({ message: 'Failed to fetch verification history' }); }
  }
}
