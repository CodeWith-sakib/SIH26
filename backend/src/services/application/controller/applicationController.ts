import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Application, { ApplicationStatus } from '../../../shared/models/Application.js';
import { auditService } from '../../audit/service/auditService.js';
import { createNotification } from '../../notification/service/notificationService.js';

const citizenEditableStatuses: ApplicationStatus[] = ['submitted'];
const officerStatuses: ApplicationStatus[] = ['under_review', 'verified', 'rejected'];

export class ApplicationController {
  private generateApplicationNumber(): string {
    const timestamp = Date.now().toString();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `APP-${timestamp}-${random}`;
  }

  private isValidApplicationStatus(status: unknown): status is ApplicationStatus {
    return status === 'submitted' || status === 'under_review' || status === 'verified' || status === 'rejected' || status === 'withdrawn';
  }

  async create(req: Request, res: Response): Promise<void> {
    const { jobId, department, position } = req.body;
    if (typeof jobId !== 'string' || !jobId.trim() || typeof department !== 'string' || !department.trim() || typeof position !== 'string' || !position.trim()) {
      res.status(400).json({ message: 'Job ID, department, and position are required' }); return;
    }
    try {
      const application = await Application.create({
        citizenId: req.user!.id, applicationNumber: this.generateApplicationNumber(),
        jobId: jobId.trim(), department: department.trim(), position: position.trim(), status: 'submitted'
      });
      await auditService.record({ actorId: req.user!.id, actorRole: req.user!.role, action: 'APPLICATION_CREATED', resource: 'application', resourceId: application._id.toString(), applicationId: application._id.toString(), requestId: req.requestId, outcome: 'SUCCESS', metadata: { applicationNumber: application.applicationNumber, department: application.department } });
      await createNotification({ userId: req.user!.id, type: 'application', title: 'Application Submitted', message: `${application.position} was submitted successfully.`, applicationId: application._id.toString() });
      await createNotification({ userId: req.user!.id, type: 'consent', title: 'Consent Required', message: 'Grant consent before department verification can begin.', applicationId: application._id.toString() });
      res.status(201).json({ message: 'Application submitted successfully', application });
    } catch (error: unknown) { res.status(500).json({ message: 'Failed to create application' }); }
  }

  async listMine(req: Request, res: Response): Promise<void> {
    try {
      const applications = await Application.find({ citizenId: req.user!.id }).sort({ createdAt: -1 });
      res.json({ applications });
    } catch (error: unknown) { res.status(500).json({ message: 'Failed to fetch applications' }); }
  }

  async getMine(req: Request<{ id: string }>, res: Response): Promise<void> {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) { res.status(400).json({ message: 'Invalid application ID' }); return; }
    try {
      const application = await Application.findOne({ _id: id, citizenId: req.user!.id });
      if (!application) { res.status(404).json({ message: 'Application not found' }); return; }
      res.json({ application });
    } catch (error: unknown) { res.status(500).json({ message: 'Failed to fetch application' }); }
  }

  async updateMine(req: Request<{ id: string }>, res: Response): Promise<void> {
    const { id } = req.params; const { department, position } = req.body;
    if (!mongoose.isValidObjectId(id)) { res.status(400).json({ message: 'Invalid application ID' }); return; }
    if (department !== undefined && (typeof department !== 'string' || !department.trim())) { res.status(400).json({ message: 'Department must be a non-empty string' }); return; }
    if (position !== undefined && (typeof position !== 'string' || !position.trim())) { res.status(400).json({ message: 'Position must be a non-empty string' }); return; }
    if (department === undefined && position === undefined) { res.status(400).json({ message: 'At least one field is required to update' }); return; }
    try {
      const application = await Application.findOne({ _id: id, citizenId: req.user!.id });
      if (!application) { res.status(404).json({ message: 'Application not found' }); return; }
      if (!citizenEditableStatuses.includes(application.status)) { res.status(409).json({ message: 'Application can no longer be edited' }); return; }
      if (department !== undefined) application.department = department.trim();
      if (position !== undefined) application.position = position.trim();
      await application.save();
      await auditService.record({ actorId: req.user!.id, actorRole: req.user!.role, action: 'APPLICATION_UPDATED', resource: 'application', resourceId: application._id.toString(), applicationId: application._id.toString(), requestId: req.requestId, outcome: 'SUCCESS', metadata: { department: application.department, position: application.position } });
      res.json({ message: 'Application updated successfully', application });
    } catch (error: unknown) { res.status(500).json({ message: 'Failed to update application' }); }
  }

  async withdraw(req: Request<{ id: string }>, res: Response): Promise<void> {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) { res.status(400).json({ message: 'Invalid application ID' }); return; }
    try {
      const application = await Application.findOne({ _id: id, citizenId: req.user!.id });
      if (!application) { res.status(404).json({ message: 'Application not found' }); return; }
      if (application.status !== 'submitted') { res.status(409).json({ message: 'Only submitted applications can be withdrawn' }); return; }
      application.status = 'withdrawn'; await application.save();
      await auditService.record({ actorId: req.user!.id, actorRole: req.user!.role, action: 'APPLICATION_STATUS_CHANGED', resource: 'application', resourceId: application._id.toString(), applicationId: application._id.toString(), requestId: req.requestId, outcome: 'SUCCESS', metadata: { previousStatus: 'submitted', newStatus: 'withdrawn' } });
      await auditService.record({ actorId: req.user!.id, actorRole: req.user!.role, action: 'APPLICATION_WITHDRAWN', resource: 'application', resourceId: application._id.toString(), applicationId: application._id.toString(), requestId: req.requestId, outcome: 'SUCCESS' });
      res.json({ message: 'Application withdrawn successfully', application });
    } catch (error: unknown) { res.status(500).json({ message: 'Failed to withdraw application' }); }
  }

  async getStatus(req: Request<{ id: string }>, res: Response): Promise<void> {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) { res.status(400).json({ message: 'Invalid application ID' }); return; }
    try {
      const application = await Application.findOne({ _id: id, citizenId: req.user!.id }).select('applicationNumber status updatedAt');
      if (!application) { res.status(404).json({ message: 'Application not found' }); return; }
      res.json({ applicationNumber: application.applicationNumber, status: application.status, updatedAt: (application as any).updatedAt });
    } catch (error: unknown) { res.status(500).json({ message: 'Failed to fetch application status' }); }
  }

  async listAll(req: Request, res: Response): Promise<void> {
    try {
      const applications = await Application.find().sort({ createdAt: -1 });
      res.json({ applications });
    } catch (error: unknown) { res.status(500).json({ message: 'Failed to fetch applications' }); }
  }

  async updateStatus(req: Request<{ id: string }>, res: Response): Promise<void> {
    const { id } = req.params; const { status } = req.body;
    if (!mongoose.isValidObjectId(id)) { res.status(400).json({ message: 'Invalid application ID' }); return; }
    if (!this.isValidApplicationStatus(status)) { res.status(400).json({ message: 'Invalid application status' }); return; }
    if (status === 'submitted' || status === 'withdrawn') { res.status(400).json({ message: 'This status cannot be assigned by an officer' }); return; }
    try {
      const application = await Application.findById(id);
      if (!application) { res.status(404).json({ message: 'Application not found' }); return; }
      if (application.status === 'verified' || application.status === 'rejected' || application.status === 'withdrawn') { res.status(409).json({ message: 'Finalized applications cannot change status' }); return; }
      if (application.status === 'submitted' && status !== 'under_review') { res.status(409).json({ message: 'Application must first move to under_review' }); return; }
      if (application.status === 'under_review' && !officerStatuses.includes(status)) { res.status(409).json({ message: 'Invalid status transition' }); return; }
      const previousStatus = application.status; application.status = status; await application.save();
      await auditService.record({ actorId: req.user!.id, actorRole: req.user!.role, action: 'APPLICATION_STATUS_CHANGED', resource: 'application', resourceId: application._id.toString(), applicationId: application._id.toString(), requestId: req.requestId, outcome: 'SUCCESS', metadata: { previousStatus, newStatus: status } });
      await createNotification({ userId: application.citizenId.toString(), type: 'application', title: 'Application Status Updated', message: `Your application is now ${status.replace('_', ' ')}.`, applicationId: application._id.toString() });
      if (status === 'verified') await auditService.record({ actorId: req.user!.id, actorRole: req.user!.role, action: 'APPLICATION_APPROVED', resource: 'application', resourceId: application._id.toString(), applicationId: application._id.toString(), requestId: req.requestId, outcome: 'SUCCESS' });
      if (status === 'rejected') await auditService.record({ actorId: req.user!.id, actorRole: req.user!.role, action: 'APPLICATION_REJECTED', resource: 'application', resourceId: application._id.toString(), applicationId: application._id.toString(), requestId: req.requestId, outcome: 'SUCCESS' });
      res.json({ message: 'Application status updated successfully', application });
    } catch (error: unknown) { res.status(500).json({ message: 'Failed to update application status' }); }
  }
}
