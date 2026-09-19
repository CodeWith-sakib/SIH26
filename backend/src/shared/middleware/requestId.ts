import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

const MAX_REQUEST_ID_LENGTH = 128;

function resolveRequestId(req: Request): string {
  const incoming = req.headers['x-request-id'];

  if (typeof incoming === 'string' && incoming.trim().length > 0) {
    return incoming.trim().slice(0, MAX_REQUEST_ID_LENGTH);
  }

  if (Array.isArray(incoming) && incoming.length > 0 && incoming[0].trim().length > 0) {
    return incoming[0].trim().slice(0, MAX_REQUEST_ID_LENGTH);
  }

  return randomUUID();
}

function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = resolveRequestId(req);
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
}

export default requestId;
