import { Router } from 'express';
import { VerificationController } from '../controller/verificationController.js';
import authenticateToken from '../../../shared/middleware/authenticate.js';
import authorize from '../../../shared/middleware/authorize.js';
import { verificationRateLimiter } from '../../../shared/middleware/rateLimiter.js';

const router = Router();

export function createVerificationRouter(controller: VerificationController): Router {
  router.post('/:id/verify', verificationRateLimiter, authenticateToken, authorize('admin', 'department_officer'), (req, res) => controller.verify(req as any, res));
  router.get('/:id/department-data', authenticateToken, (req, res) => controller.getDepartmentData(req as any, res));
  router.get('/:id/verification', authenticateToken, (req, res) => controller.getVerification(req as any, res));
  router.get('/:id/verifications', authenticateToken, authorize('admin', 'department_officer'), (req, res) => controller.getVerifications(req as any, res));
  return router;
}
