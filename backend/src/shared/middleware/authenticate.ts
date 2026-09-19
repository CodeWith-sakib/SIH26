import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { UserRole } from '../constants/roles.js';

export interface AuthUser {
  id: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function isUserRole(role: unknown): role is UserRole {
  return (
    role === 'admin' ||
    role === 'department_officer' ||
    role === 'citizen'
  );
}

function isAuthenticatedUser(payload: JwtPayload): payload is AuthUser {
  return typeof payload.id === 'string' && isUserRole(payload.role);
}

function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Authentication token is required' });
    return;
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    res.status(401).json({ message: 'Authentication token is required' });
    return;
  }

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    res.status(500).json({ message: 'JWT secret is not configured' });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret);

    if (typeof decoded === 'string' || !isAuthenticatedUser(decoded)) {
      res.status(401).json({ message: 'Invalid token' });
      return;
    }

    req.user = {
      id: decoded.id,
      role: decoded.role,
    };

    next();
  } catch (error: unknown) {
    const message =
      error instanceof jwt.TokenExpiredError
        ? 'Token has expired'
        : 'Invalid token';

    res.status(401).json({ message });
  }
}

export default authenticateToken;
