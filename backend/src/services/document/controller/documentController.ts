import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Application from '../../../shared/models/Application.js';
import UploadedDocument from '../../../shared/models/UploadedDocument.js';
import { auditService } from '../../audit/service/auditService.js';
import { createNotification } from '../../notification/service/notificationService.js';
import { DocumentService } from '../service/documentService.js';

export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  private safeDocument(document: InstanceType<typeof UploadedDocument>) {
    return {
      _id: document._id, applicationId: document.applicationId, originalFileName: document.originalFileName,
      cloudinarySecureUrl: document.cloudinarySecureUrl, resourceType: document.resourceType,
      format: document.format, mimeType: document.mimeType, fileSize: document.fileSize,
      documentType: document.documentType, uploadedAt: (document as any).uploadedAt,
    };
  }

  async upload(req: Request<{ id: string }>, res: Response): Promise<void> {
    const { id } = req.params;
    const documentType = typeof req.body.documentType === 'string' ? req.body.documentType.trim() : '';
    if (!mongoose.isValidObjectId(id)) { res.status(400).json({ message: 'Invalid application ID' }); return; }
    if (!req.file) { res.status(400).json({ message: 'A PDF, JPEG, or PNG document is required' }); return; }
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(req.file.mimetype)) { res.status(400).json({ message: 'Only PDF, JPEG, and PNG documents are allowed' }); return; }
    if (!req.file.originalname.trim() || req.file.originalname.length > 255) { res.status(400).json({ message: 'A valid filename is required' }); return; }
    if (!documentType || documentType.length > 100) { res.status(400).json({ message: 'A valid document type is required' }); return; }

    const application = await Application.findOne({ _id: id, citizenId: req.user!.id });
    if (!application) { res.status(404).json({ message: 'Application not found' }); return; }
    if (application.status === 'withdrawn') { res.status(409).json({ message: 'Documents cannot be uploaded to a withdrawn application' }); return; }

    let cloudinaryResult;
    let localResult;
    const useLocalStorage = process.env.DOCUMENT_STORAGE !== 'cloudinary';
    try {
      const resourceType = req.file.mimetype === 'application/pdf' ? 'raw' : 'image';
      if (useLocalStorage) {
        localResult = await this.documentService.uploadLocalDocument(req.file.buffer, id, req.file.originalname, req.file.mimetype);
      } else {
        cloudinaryResult = await this.documentService.uploadDocument(req.file.buffer, id, resourceType);
      }
      const document = await UploadedDocument.create({
        applicationId: id, userId: req.user!.id, originalFileName: req.file.originalname,
        cloudinaryPublicId: localResult?.publicId || cloudinaryResult!.public_id,
        cloudinarySecureUrl: localResult?.secureUrl || cloudinaryResult!.secure_url,
        resourceType, format: localResult?.format || cloudinaryResult?.format || req.file.originalname.split('.').pop()?.toLowerCase() || 'unknown',
        mimeType: req.file.mimetype, fileSize: req.file.size, documentType,
      });
      await auditService.record({ actorId: req.user!.id, actorRole: req.user!.role, action: 'DOCUMENT_UPLOADED', resource: 'document', resourceId: document._id.toString(), applicationId: id, requestId: req.requestId, outcome: 'SUCCESS', metadata: { documentType, mimeType: document.mimeType, fileSize: document.fileSize } });
      await createNotification({ userId: req.user!.id, type: 'document', title: 'Document Uploaded', message: `${documentType} was uploaded successfully.`, applicationId: id });
      res.status(201).json({ message: 'Document uploaded successfully', document: this.safeDocument(document) });
    } catch (_error) {
      if (localResult) await this.documentService.deleteLocalDocument(localResult.publicId).catch(() => undefined);
      else if (cloudinaryResult?.public_id) await this.documentService.deleteDocument(cloudinaryResult.public_id, req.file.mimetype === 'application/pdf' ? 'raw' : 'image').catch(() => undefined);
      res.status(502).json({ message: 'Document upload failed' });
    }
  }

  async list(req: Request<{ id: string }>, res: Response): Promise<void> {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) { res.status(400).json({ message: 'Invalid application ID' }); return; }
    const application = await Application.findById(id);
    if (!application) { res.status(404).json({ message: 'Application not found' }); return; }
    const isOwner = application.citizenId.toString() === req.user!.id;
    const isOfficer = req.user!.role === 'admin' || req.user!.role === 'department_officer';
    if (!isOwner && !isOfficer) { res.status(403).json({ message: 'Access denied' }); return; }
    const documents = await UploadedDocument.find({ applicationId: id }).sort({ uploadedAt: -1 });
    res.json({ documents: documents.map(doc => this.safeDocument(doc)) });
  }

  async remove(req: Request<{ id: string; documentId: string }>, res: Response): Promise<void> {
    const { id, documentId } = req.params;
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(documentId)) { res.status(400).json({ message: 'Invalid document reference' }); return; }
    const application = await Application.findOne({ _id: id, citizenId: req.user!.id });
    if (!application) { res.status(404).json({ message: 'Application not found' }); return; }
    const document = await UploadedDocument.findOne({ _id: documentId, applicationId: id, userId: req.user!.id });
    if (!document) { res.status(404).json({ message: 'Document not found' }); return; }
    try {
      if (document.cloudinaryPublicId.startsWith('local/')) {
        await this.documentService.deleteLocalDocument(document.cloudinaryPublicId);
      } else {
        await this.documentService.deleteDocument(document.cloudinaryPublicId, document.resourceType);
      }
      await document.deleteOne();
      await auditService.record({ actorId: req.user!.id, actorRole: req.user!.role, action: 'DOCUMENT_DELETED', resource: 'document', resourceId: documentId, applicationId: id, requestId: req.requestId, outcome: 'SUCCESS', metadata: { documentType: document.documentType } });
      res.json({ message: 'Document deleted successfully' });
    } catch (_error) {
      res.status(502).json({ message: 'Document deletion failed' });
    }
  }
}
