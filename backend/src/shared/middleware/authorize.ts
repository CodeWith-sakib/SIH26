import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../constants/roles.js';

/**
 * Role-based authorization middleware — mirroring api-monitoring-system's authorize.js.
 */
function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    return next();
  };
}

export default authorize;
