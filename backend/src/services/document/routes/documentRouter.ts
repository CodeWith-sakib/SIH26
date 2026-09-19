import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';
import { DocumentController } from '../controller/documentController.js';
import authenticateToken from '../../../shared/middleware/authenticate.js';
import authorize from '../../../shared/middleware/authorize.js';

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
      res.status(413).json({ message: 'Document must not exceed 10 MB' });
      return;
    }
    if (error) { res.status(400).json({ message: 'Invalid document upload' }); return; }
    next();
  });
};

export function createDocumentRouter(controller: DocumentController): Router {
  router.post('/:id/documents', authenticateToken, authorize('citizen'), receiveDocument, (req, res) => controller.upload(req as any, res));
  router.get('/:id/documents', authenticateToken, (req, res) => controller.list(req as any, res));
  router.delete('/:id/documents/:documentId', authenticateToken, authorize('citizen'), (req, res) => controller.remove(req as any, res));
  return router;
}
