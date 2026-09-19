import { Router } from 'express';
import { ConsentController } from '../controller/consentController.js';
import authenticateToken from '../../../shared/middleware/authenticate.js';
import authorize from '../../../shared/middleware/authorize.js';

const router = Router();

export function createConsentRouter(controller: ConsentController): Router {
  router.use(authenticateToken, authorize('citizen'));
  router.post('/', (req, res) => controller.create(req, res));
  router.get('/', (req, res) => controller.list(req, res));
  router.get('/:applicationId', (req, res) => controller.getOne(req as any, res));
  router.patch('/:applicationId/revoke', (req, res) => controller.revoke(req as any, res));
  return router;
}
