import { Router } from 'express';
import { AuthController } from '../controller/authController.js';
import authenticateToken from '../../../shared/middleware/authenticate.js';
import authorize from '../../../shared/middleware/authorize.js';
import { authRateLimiter } from '../../../shared/middleware/rateLimiter.js';

const router = Router();

export function createAuthRouter(controller: AuthController): Router {
  router.post('/register', authRateLimiter, (req, res) => controller.register(req, res));
  router.post('/login', authRateLimiter, (req, res) => controller.login(req, res));
  router.get('/me', authenticateToken, (req, res) => controller.me(req, res));

  // Test role access routes
  router.get('/test-admin', authenticateToken, authorize('admin'),
    (_req, res) => res.json({ message: 'Admin access granted' }));
  router.get('/test-officer', authenticateToken, authorize('admin', 'department_officer'),
    (_req, res) => res.json({ message: 'Officer/Admin access granted' }));
  router.get('/test-citizen', authenticateToken, authorize('citizen'),
    (_req, res) => res.json({ message: 'Citizen access granted' }));

  return router;
}
