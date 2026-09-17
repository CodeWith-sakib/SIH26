import { NextFunction, Request, Response, Router } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';

import Application from '../models/Application';
import UploadedDocument from '../models/UploadedDocument';
import authenticateToken from '../middleware/auth';
import requireRole from '../middleware/role';
import { auditService } from '../audit/audit.service';
import { deleteDocument, deleteLocalDocument, uploadDocument, uploadLocalDocument } from '../services/cloudinary.service';
import { createNotification } from '../services/notification.service';

const router = Router();
const allowedMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => callback(null, allowedMimeTypes.has(file.mimetype))
});
const receiveDocument = (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, error => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'Document must not exceed 10 MB' });
    }
    if (error) return res.status(400).json({ message: 'Invalid document upload' });
    next();
  });
};

function safeDocument(document: InstanceType<typeof UploadedDocument>) {
  return {
    _id: document._id,
    applicationId: document.applicationId,
    originalFileName: document.originalFileName,
    cloudinarySecureUrl: document.cloudinarySecureUrl,
    resourceType: document.resourceType,
    format: document.format,
    mimeType: document.mimeType,
    fileSize: document.fileSize,
    documentType: document.documentType,
    uploadedAt: document.uploadedAt
  };
}

router.post(
  '/:id/documents',
  authenticateToken,
  requireRole('citizen'),
  receiveDocument,
  async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;
    const documentType = typeof req.body.documentType === 'string' ? req.body.documentType.trim() : '';
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid application ID' });
    if (!req.file) return res.status(400).json({ message: 'A PDF, JPEG, or PNG document is required' });
    if (!allowedMimeTypes.has(req.file.mimetype)) return res.status(400).json({ message: 'Only PDF, JPEG, and PNG documents are allowed' });
    if (!req.file.originalname.trim() || req.file.originalname.length > 255) return res.status(400).json({ message: 'A valid filename is required' });
    if (!documentType || documentType.length > 100) return res.status(400).json({ message: 'A valid document type is required' });

    const application = await Application.findOne({ _id: id, citizenId: req.user!.id });
    if (!application) return res.status(404).json({ message: 'Application not found' });
    if (application.status === 'withdrawn') return res.status(409).json({ message: 'Documents cannot be uploaded to a withdrawn application' });

    let cloudinaryResult;
    let localResult;
    const useLocalStorage = process.env.DOCUMENT_STORAGE !== 'cloudinary';
    try {
      const resourceType = req.file.mimetype === 'application/pdf' ? 'raw' : 'image';
      if (useLocalStorage) {
        localResult = await uploadLocalDocument(req.file.buffer, id, req.file.originalname, req.file.mimetype);
      } else {
        cloudinaryResult = await uploadDocument(req.file.buffer, id, resourceType);
      }
      const document = await UploadedDocument.create({
        applicationId: id,
        userId: req.user!.id,
        originalFileName: req.file.originalname,
        cloudinaryPublicId: localResult?.publicId || cloudinaryResult!.public_id,
        cloudinarySecureUrl: localResult?.secureUrl || cloudinaryResult!.secure_url,
        resourceType,
        format: localResult?.format || cloudinaryResult?.format || req.file.originalname.split('.').pop()?.toLowerCase() || 'unknown',
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        documentType
      });
      await auditService.record({
        actorId: req.user!.id, actorRole: req.user!.role, action: 'DOCUMENT_UPLOADED',
        resource: 'document', resourceId: document._id.toString(), applicationId: id,
        requestId: req.requestId, outcome: 'SUCCESS',
        metadata: { documentType, mimeType: document.mimeType, fileSize: document.fileSize }
      });
      await createNotification({
        userId: req.user!.id, type: 'document', title: 'Document Uploaded',
        message: `${documentType} was uploaded successfully.`, applicationId: id
      });
      return res.status(201).json({ message: 'Document uploaded successfully', document: safeDocument(document) });
    } catch (_error) {
      if (localResult) {
        await deleteLocalDocument(localResult.publicId).catch(() => undefined);
      } else if (cloudinaryResult?.public_id) {
        await deleteDocument(cloudinaryResult.public_id, req.file.mimetype === 'application/pdf' ? 'raw' : 'image').catch(() => undefined);
      }
      return res.status(502).json({ message: 'Document upload failed' });
    }
  }
);

router.get('/:id/documents', authenticateToken, async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid application ID' });
  const application = await Application.findById(id);
  if (!application) return res.status(404).json({ message: 'Application not found' });
  const isOwner = application.citizenId.toString() === req.user!.id;
  const isOfficer = req.user!.role === 'admin' || req.user!.role === 'department_officer';
  if (!isOwner && !isOfficer) return res.status(403).json({ message: 'Access denied' });
  const documents = await UploadedDocument.find({ applicationId: id }).sort({ uploadedAt: -1 });
  return res.json({ documents: documents.map(safeDocument) });
});

router.delete('/:id/documents/:documentId', authenticateToken, requireRole('citizen'), async (
  req: Request<{ id: string; documentId: string }>, res: Response
) => {
  const { id, documentId } = req.params;
  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(documentId)) return res.status(400).json({ message: 'Invalid document reference' });
  const application = await Application.findOne({ _id: id, citizenId: req.user!.id });
  if (!application) return res.status(404).json({ message: 'Application not found' });
  const document = await UploadedDocument.findOne({ _id: documentId, applicationId: id, userId: req.user!.id });
  if (!document) return res.status(404).json({ message: 'Document not found' });
  try {
    if (document.cloudinaryPublicId.startsWith('local/')) {
      await deleteLocalDocument(document.cloudinaryPublicId);
    } else {
      await deleteDocument(document.cloudinaryPublicId, document.resourceType);
    }
    await document.deleteOne();
    await auditService.record({
      actorId: req.user!.id, actorRole: req.user!.role, action: 'DOCUMENT_DELETED',
      resource: 'document', resourceId: documentId, applicationId: id,
      requestId: req.requestId, outcome: 'SUCCESS', metadata: { documentType: document.documentType }
    });
    return res.json({ message: 'Document deleted successfully' });
  } catch (_error) {
    return res.status(502).json({ message: 'Document deletion failed' });
  }
});

export default router;
