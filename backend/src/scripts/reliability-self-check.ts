import assert from 'assert';
import http from 'http';
import { HttpClient } from '../services/integrationEngine/http/HttpClient.js';
import { EngineError } from '../services/integrationEngine/errors/EngineError.js';

let requestCount = 0;

const server = http.createServer((req, res) => {
  const url = req.url || '';
  if (url === '/retry') {
    requestCount += 1;
    if (requestCount <= 2) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'temporary' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (url === '/noretry') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'missing' }));
    return;
  }
  if (url === '/slow') {
    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    }, 3000);
    return;
  }
  if (url === '/always500') {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'boom' }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
});

const PORT = 4123;

async function start(): Promise<void> {
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
}

async function stop(): Promise<void> {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

async function run(): Promise<void> {
  await start();
  const base = `http://127.0.0.1:${PORT}`;

  const retryClient = new HttpClient({ timeoutMs: 5000, maxRetries: 3, baseRetryDelayMs: 50 });
  const strictClient = new HttpClient({ timeoutMs: 5000, maxRetries: 0, baseRetryDelayMs: 50 });
  const timeoutClient = new HttpClient({ timeoutMs: 300, maxRetries: 0, baseRetryDelayMs: 50 });

  const retryResult = await retryClient.request({ method: 'GET', url: `${base}/retry` });
  assert.strictEqual(retryResult.status, 200, 'retry should eventually succeed');
  assert.ok(requestCount >= 3, `should have retried (calls=${requestCount})`);

  let noRetryRejected = false;
  try {
    await strictClient.request({ method: 'GET', url: `${base}/noretry` });
  } catch (error) {
    noRetryRejected = error instanceof EngineError && (error as EngineError).statusCode === 404;
  }
  assert.strictEqual(noRetryRejected, true, '4xx should be rejected without retry');

  let timedOut = false;
  try {
    await timeoutClient.request({ method: 'GET', url: `${base}/slow` });
  } catch (error) {
    timedOut = (error as { code?: string }).code === 'ECONNABORTED' || (error as { code?: string }).code === 'ETIMEDOUT';
  }
  assert.strictEqual(timedOut, true, 'slow endpoint should time out');

  let exhaustedRetries = false;
  try {
    await retryClient.request({ method: 'GET', url: `${base}/always500` });
  } catch (error) {
    exhaustedRetries = true;
  }
  assert.strictEqual(exhaustedRetries, true, 'persistent 5xx should fail after retries');

  console.log('Reliability self-check passed (retry, no-retry-4xx, timeout, retry-exhaustion).');
}

run()
  .then(async () => {
    await stop();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    await stop();
    console.error(`Reliability self-check failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });