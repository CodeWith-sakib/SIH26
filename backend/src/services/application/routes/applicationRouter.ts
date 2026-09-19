import { Router } from 'express';
import { ApplicationController } from '../controller/applicationController.js';
import authenticateToken from '../../../shared/middleware/authenticate.js';
import authorize from '../../../shared/middleware/authorize.js';

const router = Router();

export function createApplicationRouter(controller: ApplicationController): Router {
  router.post('/', authenticateToken, authorize('citizen'), (req, res) => controller.create(req, res));
  router.get('/', authenticateToken, authorize('citizen'), (req, res) => controller.listMine(req, res));
  router.get('/all', authenticateToken, authorize('admin', 'department_officer'), (req, res) => controller.listAll(req, res));
  router.get('/:id', authenticateToken, authorize('citizen'), (req, res) => controller.getMine(req as any, res));
  router.patch('/:id', authenticateToken, authorize('citizen'), (req, res) => controller.updateMine(req as any, res));
  router.delete('/:id', authenticateToken, authorize('citizen'), (req, res) => controller.withdraw(req as any, res));
  router.get('/:id/status', authenticateToken, authorize('citizen'), (req, res) => controller.getStatus(req as any, res));
  router.patch('/:id/status', authenticateToken, authorize('admin', 'department_officer'), (req, res) => controller.updateStatus(req as any, res));
  return router;
}
