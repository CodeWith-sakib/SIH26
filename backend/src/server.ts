import 'dotenv/config';
import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import path from 'node:path';

// Shared config & middleware
import config from './shared/config/index.js';
import mongodb from './shared/config/mongodb.js';
import requestId from './shared/middleware/requestId.js';
import { securityHeadersMiddleware } from './shared/middleware/securityHeaders.js';
import { corsMiddleware } from './shared/middleware/cors.js';
import { generalRateLimiter } from './shared/middleware/rateLimiter.js';
import errorHandler from './shared/middleware/errorHandler.js';

// Feature routers
import { createAuthRouter } from './services/auth/routes/authRouter.js';
import { authContainer } from './services/auth/Dependencies/Container.js';
import { createApplicationRouter } from './services/application/routes/applicationRouter.js';
import { applicationContainer } from './services/application/Dependencies/Container.js';
import { createVerificationRouter } from './services/verification/routes/verificationRouter.js';
import { verificationContainer } from './services/verification/Dependencies/Container.js';
import { createDocumentRouter } from './services/document/routes/documentRouter.js';
import { documentContainer } from './services/document/Dependencies/Container.js';
import { createConsentRouter } from './services/consent/routes/consentRouter.js';
import { consentContainer } from './services/consent/Dependencies/Container.js';
import { createDepartmentRouter } from './services/department/routes/departmentRouter.js';
import { departmentContainer } from './services/department/Dependencies/Container.js';
import { createIntegrationRouter } from './services/integration/routes/integrationRouter.js';
import { integrationContainer } from './services/integration/Dependencies/Container.js';
import { createAuditRouter } from './services/audit/routes/auditRouter.js';
import { auditContainer } from './services/audit/Dependencies/Container.js';
import { createNotificationRouter } from './services/notification/routes/notificationRouter.js';
import { notificationContainer } from './services/notification/Dependencies/Container.js';
import { createEmploymentRouter } from './services/employment/routes/employmentRouter.js';
import { employmentContainer } from './services/employment/Dependencies/Container.js';
import { createProfileRouter } from './services/profile/routes/profileRouter.js';
import { profileContainer } from './services/profile/Dependencies/Container.js';

// Services
import { consentExpiryService } from './services/consent/service/consentExpiryService.js';

const app = express();
app.disable('x-powered-by');

// Core security and tracing middlewares
app.use(requestId);
app.use(securityHeadersMiddleware);
app.use(corsMiddleware);
app.use(express.json({ limit: '1mb' }));
app.use('/api/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// General rate limiting for API endpoints
app.use('/api', generalRateLimiter);

// Domain route registrations
app.use('/api/auth', createAuthRouter(authContainer.controller));
app.use('/api/applications', createVerificationRouter(verificationContainer.controller));
app.use('/api/applications', createDocumentRouter(documentContainer.controller));
app.use('/api/applications', createApplicationRouter(applicationContainer.controller));
app.use('/api/consent', createConsentRouter(consentContainer.controller));
app.use('/api/departments', createDepartmentRouter(departmentContainer.controller));
app.use('/api/integrations', createIntegrationRouter(integrationContainer.controller));
app.use('/api/audit', createAuditRouter(auditContainer.controller));
app.use('/api/notifications', createNotificationRouter(notificationContainer.controller));
app.use('/api/employment', createEmploymentRouter(employmentContainer.controller));
app.use('/api/profile', createProfileRouter(profileContainer.controller));

app.get('/health', (req: Request, res: Response) => {
  res.json({
    server: 'running',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    environment: config.server.nodeEnv
  });
});

// Global Error Sanitization Middleware
app.use(errorHandler);

let serverInstance: ReturnType<typeof app.listen> | null = null;

export async function startServer() {
  if (serverInstance) return serverInstance;

  await mongodb.connect();
  consentExpiryService.startScheduler();

  serverInstance = app.listen(config.server.port, () => {
    console.log(`Server running on port ${config.server.port} [${config.server.nodeEnv}]`);
  });

  return serverInstance;
}

export async function stopServer() {
  consentExpiryService.stopScheduler();
  if (serverInstance) {
    await new Promise<void>((resolve) => serverInstance!.close(() => resolve()));
    serverInstance = null;
  }
  await mongodb.disconnect();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((error: unknown) => {
    console.error(`Server startup failed: ${error instanceof Error ? error.message : 'Unknown startup error'}`);
    process.exit(1);
  });

  const handleShutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down gracefully...`);
    await stopServer();
    process.exit(0);
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

export default app;
