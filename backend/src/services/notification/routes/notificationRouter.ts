import { Router } from 'express';
import { NotificationController } from '../controller/notificationController.js';
import authenticateToken from '../../../shared/middleware/authenticate.js';

const router = Router();

export function createNotificationRouter(controller: NotificationController): Router {
  router.use(authenticateToken);
  router.get('/', (req, res) => controller.list(req, res));
  router.patch('/read-all', (req, res) => controller.markAllRead(req, res));
  router.patch('/:id/read', (req, res) => controller.markOneRead(req as any, res));
  return router;
}
