import { Router } from 'express';
import { ProfileController } from '../controller/profileController.js';
import authenticateToken from '../../../shared/middleware/authenticate.js';
import authorize from '../../../shared/middleware/authorize.js';

const router = Router();

export function createProfileRouter(controller: ProfileController): Router {
  router.use(authenticateToken, authorize('citizen'));
  router.get('/', (req, res) => controller.getProfile(req, res));
  router.get('/documents', (req, res) => controller.getDocuments(req, res));
  return router;
}
