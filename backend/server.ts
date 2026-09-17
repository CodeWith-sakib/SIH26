import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';

import authRoutes from './src/routes/auth.routes';
import verificationRoutes from './src/routes/verification.routes';
import applicationRoutes from './src/routes/application.routes';
import consentRoutes from './src/routes/consent.routes';
import departmentRoutes from './src/routes/department.routes';
import integrationRoutes from './src/routes/integration.routes';
import auditRoutes from './src/routes/audit.routes';
import documentRoutes from './src/routes/document.routes';
import notificationRoutes from './src/routes/notification.routes';
import employmentRoutes from './src/routes/employment.routes';
import profileRoutes from './src/routes/profile.routes';

import requestId from './src/middleware/request-id';
import { securityHeadersMiddleware } from './src/middleware/security-headers';
import { corsMiddleware } from './src/middleware/cors';
import { generalRateLimiter } from './src/middleware/rate-limiter';
import { consentExpiryService } from './src/services/consent-expiry.service';
import { validateAndLoadConfig } from './src/config/env';
import path from 'node:path';

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
app.use('/api/auth', authRoutes);
app.use('/api/applications', verificationRoutes);
app.use('/api/applications', documentRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/consent', consentRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/employment', employmentRoutes);
app.use('/api/profile', profileRoutes);

app.get('/health', (req: Request, res: Response) => {
  res.json({
    server: 'running',
    database:
      mongoose.connection.readyState === 1
        ? 'connected'
        : 'disconnected',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Global Error Sanitization Middleware
app.use(
  (
    error: unknown,
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const reqId = req.requestId || 'unknown';

    // Handle JSON body syntax errors
    const parseError = error as SyntaxError & {
      status?: number;
      body?: unknown;
    };

    if (
      error instanceof SyntaxError &&
      parseError.status === 400 &&
      parseError.body
    ) {
      return res.status(400).json({
        message: 'Malformed JSON request body',
        requestId: reqId
      });
    }

    // Log internally with context without leaking secrets
    console.error(
      `[ERROR] [RequestId: ${reqId}] Unhandled server error:`,
      error instanceof Error ? error.stack || error.message : String(error)
    );

    // Sanitize production response: NEVER leak internal details, mongo internals, or stack traces
    return res.status(500).json({
      message: 'Internal server error',
      requestId: reqId
    });
  }
);

let serverInstance: ReturnType<typeof app.listen> | null = null;

export async function startServer() {
  if (serverInstance) {
    return serverInstance;
  }

  const config = validateAndLoadConfig();
  await mongoose.connect(config.mongoUri);

  // Start automated consent expiration scheduler
  consentExpiryService.startScheduler();

  serverInstance = app.listen(config.port, () => {
    console.log(`Server running on port ${config.port} [${config.nodeEnv}]`);
  });

  return serverInstance;
}

export async function stopServer() {
  consentExpiryService.stopScheduler();
  if (serverInstance) {
    await new Promise<void>((resolve) => serverInstance!.close(() => resolve()));
    serverInstance = null;
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  startServer().catch((error: unknown) => {
    console.error(
      `Server startup failed: ${
        error instanceof Error ? error.message : 'Unknown startup error'
      }`
    );
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
