import { Router } from 'express';
import { DepartmentController } from '../controller/departmentController.js';
import authenticateToken from '../../../shared/middleware/authenticate.js';
import authorize from '../../../shared/middleware/authorize.js';

const router = Router();

export function createDepartmentRouter(controller: DepartmentController): Router {
  router.use(authenticateToken, authorize('admin'));
  router.get('/', (req, res) => controller.list(req, res));
  router.get('/:id', (req, res) => controller.getOne(req as any, res));
  router.post('/', (req, res) => controller.create(req, res));
  router.patch('/:id', (req, res) => controller.update(req as any, res));
  router.delete('/:id', (req, res) => controller.remove(req as any, res));
  return router;
}
