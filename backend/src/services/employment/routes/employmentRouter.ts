import { Router } from 'express';
import { EmploymentController } from '../controller/employmentController.js';
import authenticateToken from '../../../shared/middleware/authenticate.js';
import authorize from '../../../shared/middleware/authorize.js';

const router = Router();

export function createEmploymentRouter(controller: EmploymentController): Router {
  router.use(authenticateToken, authorize('citizen'));
  router.get('/jobs', (req, res) => controller.listJobs(req, res));
  router.get('/jobs/:jobId', (req, res) => controller.getJob(req as any, res));
  router.post('/applications', (req, res) => controller.createApplication(req, res));
  router.get('/applications', (req, res) => controller.listApplications(req, res));
  router.get('/applications/:id', (req, res) => controller.getApplication(req as any, res));
  router.patch('/applications/:id', (req, res) => controller.updateApplication(req as any, res));
  router.post('/applications/:id/fetch-data', (req, res) => controller.fetchData(req as any, res));
  router.post('/applications/:id/submit', (req, res) => controller.submitApplication(req as any, res));
  return router;
}
