import { NextFunction, Request, Response } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
}

export class MemoryRateLimiter {
  private hits = new Map<string, RateLimitRecord>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Periodic cleanup of expired rate limit entries every 60 seconds
    this.cleanupTimer = setInterval(() => this.cleanup(), 60_000);
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  createMiddleware(options: RateLimitOptions) {
    const {
      windowMs,
      max,
      message = 'Too many requests, please try again later',
      keyGenerator = (req: Request) => {
        const forwarded = req.headers['x-forwarded-for'];
        if (typeof forwarded === 'string') {
          return forwarded.split(',')[0].trim();
        }
        return req.socket.remoteAddress || '127.0.0.1';
      },
      skip = () => false
    } = options;

    return (req: Request, res: Response, next: NextFunction): void => {
      // Check global rate limit enable flag
      if (process.env.RATE_LIMIT_ENABLED === 'false' || skip(req)) {
        return next();
      }

      const key = keyGenerator(req);
      const now = Date.now();
      let record = this.hits.get(key);

      if (!record || record.resetTime <= now) {
        record = {
          count: 1,
          resetTime: now + windowMs
        };
        this.hits.set(key, record);
      } else {
        record.count += 1;
      }

      const remaining = Math.max(0, max - record.count);
      const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

      if (record.count > max) {
        res.setHeader('Retry-After', resetSeconds);
        res.status(429).json({
          message,
          retryAfterSeconds: resetSeconds
        });
        return;
      }

      next();
    };
  }

  reset(): void {
    this.hits.clear();
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.hits.entries()) {
      if (record.resetTime <= now) {
        this.hits.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.hits.clear();
  }
}

export const rateLimiterStore = new MemoryRateLimiter();

// Pre-configured rate limiters
export const authRateLimiter = rateLimiterStore.createMiddleware({
  windowMs: Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS) || 15 * 60 * 1000, // 15 mins
  max: Number(process.env.RATE_LIMIT_AUTH_MAX) || 10000, // Keep local prototype logins from being blocked during demos
  message: 'Too many authentication attempts, please try again later'
});

export const verificationRateLimiter = rateLimiterStore.createMiddleware({
  windowMs: Number(process.env.RATE_LIMIT_VERIFY_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_VERIFY_MAX) || 60,
  message: 'Verification request rate limit exceeded, please try again later'
});

export const generalRateLimiter = rateLimiterStore.createMiddleware({
  windowMs: Number(process.env.RATE_LIMIT_GENERAL_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_GENERAL_MAX) || 500,
  message: 'Too many requests, please slow down'
});
