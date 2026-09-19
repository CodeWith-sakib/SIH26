import { Router } from 'express';
import authenticateToken from '../../../shared/middleware/authenticate.js';
import authorize from '../../../shared/middleware/authorize.js';
import { AuditController } from '../controller/auditController.js';

const router = Router();

export function createAuditRouter(controller: AuditController): Router {
  router.get('/', authenticateToken, authorize('admin'), (req, res) => controller.list(req, res));
  return router;
}
