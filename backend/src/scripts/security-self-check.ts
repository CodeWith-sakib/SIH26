import assert from 'assert';
import http from 'http';
import axios, { AxiosError } from 'axios';
import app from '../server.js';
import { rateLimiterStore } from '../shared/middleware/rateLimiter.js';

const PORT = 5124;
const baseURL = `http://127.0.0.1:${PORT}`;

let server: http.Server;

async function startTestServer(): Promise<void> {
  return new Promise((resolve) => {
    server = app.listen(PORT, () => {
      resolve();
    });
  });
}

async function stopTestServer(): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => {
      rateLimiterStore.destroy();
      resolve();
    });
  });
}

async function runSecuritySelfCheck(): Promise<void> {
  await startTestServer();

  try {
    // 1. Check Security Headers
    const healthRes = await axios.get(`${baseURL}/health`);
    assert.strictEqual(healthRes.headers['x-content-type-options'], 'nosniff', 'X-Content-Type-Options must be nosniff');
    assert.strictEqual(healthRes.headers['x-frame-options'], 'DENY', 'X-Frame-Options must be DENY');
    assert.strictEqual(healthRes.headers['x-xss-protection'], '0', 'X-XSS-Protection must be 0');
    assert.strictEqual(healthRes.headers['referrer-policy'], 'strict-origin-when-cross-origin', 'Referrer-Policy must be set');
    assert.strictEqual(healthRes.headers['x-powered-by'], undefined, 'X-Powered-By must be removed');
    assert.ok(healthRes.headers['x-request-id'], 'X-Request-ID must be present');

    // 2. Check CORS behavior
    // 2a. Preflight OPTIONS request
    const optionsRes = await axios({
      method: 'OPTIONS',
      url: `${baseURL}/api/auth/login`,
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST'
      }
    });
    assert.strictEqual(optionsRes.status, 204, 'CORS preflight OPTIONS should return 204');
    assert.strictEqual(optionsRes.headers['access-control-allow-origin'], 'http://localhost:3000', 'CORS must reflect exact origin');
    assert.strictEqual(optionsRes.headers['access-control-allow-credentials'], 'true', 'CORS credentials must be true');
    assert.notStrictEqual(optionsRes.headers['access-control-allow-origin'], '*', 'Wildcard must NEVER be used with credentials');

    // 3. Check Error Sanitization
    // 3a. Malformed JSON body
    let malformedHandled = false;
    try {
      await axios.post(
        `${baseURL}/api/auth/login`,
        '{"malformed_json: true',
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      const ax = error as AxiosError;
      assert.strictEqual(ax.response?.status, 400);
      assert.strictEqual((ax.response?.data as any)?.message, 'Malformed JSON request body');
      assert.ok((ax.response?.data as any)?.requestId, 'RequestId must be present in error response');
      assert.strictEqual((ax.response?.data as any)?.stack, undefined, 'Stack trace must not be exposed');
      malformedHandled = true;
    }
    assert.strictEqual(malformedHandled, true, 'Malformed JSON must return 400 with sanitized message');

    // 4. Check Rate Limiter Middleware
    // Create a mini isolated rate limiter to verify sliding window threshold
    const customLimiter = rateLimiterStore.createMiddleware({
      windowMs: 10_000,
      max: 3,
      message: 'Test rate limit exceeded'
    });

    const mockReq = {
      headers: {},
      socket: { remoteAddress: '10.0.0.1' }
    } as any;

    let firstBlockedAttempt = 0;
    for (let i = 1; i <= 5; i++) {
      let nextCalled = false;
      const mockRes = {
        setHeader: () => {},
        status: (code: number) => ({
          json: (body: any) => {
            if (code === 429 && firstBlockedAttempt === 0) {
              firstBlockedAttempt = i;
            }
          }
        })
      } as any;

      customLimiter(mockReq, mockRes, () => {
        nextCalled = true;
      });

      if (i <= 3) {
        assert.strictEqual(nextCalled, true, `Attempt ${i} should be allowed`);
      } else {
        assert.strictEqual(nextCalled, false, `Attempt ${i} should be blocked`);
      }
    }
    assert.strictEqual(firstBlockedAttempt, 4, '4th attempt must be blocked by rate limiter');

    console.log('Security self-check passed (headers, CORS, error sanitization, rate limiting).');
  } finally {
    await stopTestServer();
  }
}

runSecuritySelfCheck().catch((err: unknown) => {
  console.error('Security self-check failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
