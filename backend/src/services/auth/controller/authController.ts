import { Request, Response } from 'express';
import { AuthService, safeUser, isDuplicate } from '../service/authService.js';
import { auditService } from '../../audit/service/auditService.js';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  async register(req: Request, res: Response): Promise<void> {
    const validation = this.authService.validateRegisterInput(req.body);
    if (!validation.valid || !validation.data) {
      res.status(400).json({ message: validation.error });
      return;
    }

    try {
      const { user, token } = await this.authService.register(validation.data);
      await auditService.record({
        actorId: user._id.toString(), actorRole: user.role, action: 'USER_REGISTERED',
        resource: 'user', resourceId: user._id.toString(), requestId: req.requestId,
        outcome: 'SUCCESS', metadata: { email: user.email, role: user.role },
      });
      res.status(201).json({ message: 'Registration successful', token, user: safeUser(user) });
    } catch (error: unknown) {
      if (isDuplicate(error)) {
        res.status(409).json({ message: 'Email is already registered' });
        return;
      }
      const httpError = error as { statusCode?: number; message?: string };
      if (httpError.statusCode === 409) {
        res.status(409).json({ message: httpError.message || 'Email is already registered' });
        return;
      }
      await auditService.record({
        actorId: null, action: 'USER_REGISTERED', resource: 'user',
        requestId: req.requestId, outcome: 'FAILURE',
        metadata: { reason: 'internal_error' },
      });
      res.status(500).json({ message: 'Registration failed' });
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body;

    try {
      const { user, token } = await this.authService.login(email, password);
      await auditService.record({
        actorId: user._id.toString(), actorRole: user.role, action: 'USER_LOGIN',
        resource: 'user', resourceId: user._id.toString(), requestId: req.requestId, outcome: 'SUCCESS',
      });
      res.json({ message: 'Login successful', token, user: safeUser(user) });
    } catch (error: unknown) {
      const httpError = error as { statusCode?: number; message?: string; userId?: string; actorRole?: string };
      const statusCode = httpError.statusCode || 500;

      if (statusCode === 401) {
        await auditService.record({
          actorId: httpError.userId ?? null,
          action: 'USER_LOGIN', resource: 'user',
          requestId: req.requestId, outcome: 'FAILURE',
          metadata: { reason: 'invalid_credentials' },
        });
        res.status(401).json({ message: 'Invalid email or password' });
        return;
      }

      if (statusCode === 400) {
        res.status(400).json({ message: httpError.message || 'Email and password are required' });
        return;
      }

      res.status(statusCode).json({ message: httpError.message || 'Login failed' });
    }
  }

  me(req: Request, res: Response): void {
    res.json({ user: req.user });
  }
}
