import { NextFunction, Request, Response } from 'express';

const DEFAULT_DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5000',
  'http://localhost:5001',
  'http://localhost:5100',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5000',
  'http://127.0.0.1:5001',
  'http://127.0.0.1:5100',
];

function getAllowedOrigins(): string[] {
  const envOrigins = process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGINS;
  if (envOrigins && envOrigins.trim()) {
    return envOrigins
      .split(',')
      .map(origin => origin.trim())
      .filter(origin => origin.length > 0);
  }

  if (process.env.NODE_ENV !== 'production') {
    return DEFAULT_DEV_ORIGINS;
  }

  return [];
}

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingOrigin = req.headers.origin;
  const allowedOrigins = getAllowedOrigins();

  if (incomingOrigin) {
    const isAllowed =
      allowedOrigins.includes(incomingOrigin) ||
      (process.env.NODE_ENV !== 'production' &&
        (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(incomingOrigin)));

    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', incomingOrigin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Request-ID, X-API-Key, Accept, Origin'
  );
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
}
