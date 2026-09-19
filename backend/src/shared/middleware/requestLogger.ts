import { NextFunction, Request, Response } from 'express';

/**
 * Request logger middleware — mirrors api-monitoring-system requestLogger.js.
 */
function requestLogger(req: Request, _res: Response, next: NextFunction): void {
  console.log(`Incoming Request: ${req.method} ${req.path}`, {
    ip: req.ip,
    method: req.method,
    requestId: req.requestId,
    userAgent: req.headers['user-agent'],
  });
  next();
}

export default requestLogger;
