import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Consent, { ConsentDataCategory } from '../../../shared/models/Consent.js';
import Application from '../../../shared/models/Application.js';
import { auditService } from '../../audit/service/auditService.js';
import { createNotification } from '../../notification/service/notificationService.js';

const validDataCategories: ConsentDataCategory[] = ['education', 'employment'];

function isDataCategory(category: unknown): category is ConsentDataCategory {
  return category === 'education' || category === 'employment';
}

export class ConsentController {
  async create(req: Request, res: Response): Promise<void> {
    const { applicationId, dataCategories, expiresAt, purpose, dataSource } = req.body;

    if (typeof applicationId !== 'string' || !mongoose.isValidObjectId(applicationId)) {
      res.status(400).json({ message: 'A valid application ID is required' }); return;
    }
    if (!Array.isArray(dataCategories) || dataCategories.length === 0 || !dataCategories.every(isDataCategory)) {
      res.status(400).json({ message: 'At least one valid data category is required' }); return;
    }

    let parsedExpiresAt: Date | undefined;
    if (expiresAt !== undefined) {
      if (typeof expiresAt !== 'string' || !expiresAt.trim()) {
        res.status(400).json({ message: 'Invalid expiration date' }); return;
      }
      parsedExpiresAt = new Date(expiresAt);
      if (Number.isNaN(parsedExpiresAt.getTime())) {
        res.status(400).json({ message: 'Invalid expiration date' }); return;
      }
      if (parsedExpiresAt <= new Date()) {
        res.status(400).json({ message: 'Expiration date must be in the future' }); return;
      }
    }

    try {
      const application = await Application.findOne({ _id: applicationId, citizenId: req.user!.id });
      if (!application) { res.status(404).json({ message: 'Application not found' }); return; }
      if (application.status === 'withdrawn') { res.status(409).json({ message: 'Consent cannot be granted for a withdrawn application' }); return; }
      if (await Consent.findOne({ citizenId: req.user!.id, applicationId })) {
        res.status(409).json({ message: 'Consent already exists for this application' }); return;
      }

      const consent = await Consent.create({
        citizenId: req.user!.id, applicationId,
        dataCategories: [...new Set(dataCategories)], status: 'active',
        ...(typeof purpose === 'string' && purpose.trim() && { purpose: purpose.trim().slice(0, 300) }),
        ...(typeof dataSource === 'string' && dataSource.trim() && { dataSource: dataSource.trim().slice(0, 150) }),
        ...(parsedExpiresAt && { expiresAt: parsedExpiresAt }),
      });

      await auditService.record({
        actorId: req.user!.id, actorRole: req.user!.role, action: 'CONSENT_GRANTED',
        resource: 'consent', resourceId: consent._id.toString(), applicationId,
        consentId: consent._id.toString(),
        purpose: typeof purpose === 'string' && purpose.trim() ? purpose.trim() : 'Government data verification',
        requestId: req.requestId, outcome: 'SUCCESS', metadata: { dataCategories: consent.dataCategories },
      });
      await createNotification({ userId: req.user!.id, type: 'consent', title: 'Consent Approved', message: 'Digital consent is active for this application.', applicationId });
      res.status(201).json({ message: 'Consent granted successfully', consent });
    } catch {
      res.status(500).json({ message: 'Failed to create consent' });
    }
  }

  async list(req: Request, res: Response): Promise<void> {
    try {
      const consents = await Consent.find({ citizenId: req.user!.id }).sort({ createdAt: -1 });
      res.json({ consents });
    } catch {
      res.status(500).json({ message: 'Failed to fetch consent records' });
    }
  }

  async getOne(req: Request<{ applicationId: string }>, res: Response): Promise<void> {
    const { applicationId } = req.params;
    if (!mongoose.isValidObjectId(applicationId)) { res.status(400).json({ message: 'Invalid application ID' }); return; }
    try {
      const consent = await Consent.findOne({ citizenId: req.user!.id, applicationId });
      if (!consent) { res.status(404).json({ message: 'Consent record not found' }); return; }
      res.json({ consent });
    } catch {
      res.status(500).json({ message: 'Failed to fetch consent' });
    }
  }

  async revoke(req: Request<{ applicationId: string }>, res: Response): Promise<void> {
    const { applicationId } = req.params;
    if (!mongoose.isValidObjectId(applicationId)) { res.status(400).json({ message: 'Invalid application ID' }); return; }
    try {
      const consent = await Consent.findOne({ citizenId: req.user!.id, applicationId });
      if (!consent) { res.status(404).json({ message: 'Consent record not found' }); return; }
      if (consent.status === 'revoked') { res.status(409).json({ message: 'Consent has already been revoked' }); return; }

      consent.status = 'revoked';
      consent.revokedAt = new Date();
      await consent.save();

      await auditService.record({
        actorId: req.user!.id, actorRole: req.user!.role, action: 'CONSENT_REVOKED',
        resource: 'consent', resourceId: consent._id.toString(), applicationId,
        consentId: consent._id.toString(), purpose: 'Government data verification',
        requestId: req.requestId, outcome: 'SUCCESS', metadata: { dataCategories: consent.dataCategories },
      });
      await createNotification({ userId: req.user!.id, type: 'consent', title: 'Consent Revoked', message: 'Department access has been revoked for this application.', applicationId });
      res.json({ message: 'Consent revoked successfully', consent });
    } catch {
      res.status(500).json({ message: 'Failed to revoke consent' });
    }
  }
}
