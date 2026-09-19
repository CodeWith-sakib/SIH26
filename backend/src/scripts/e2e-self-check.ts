import assert from 'assert';
import axios, { AxiosError } from 'axios';

process.env.MONGODB_URI = process.env.E2E_MONGODB_URI || 'mongodb://127.0.0.1:27018/sih_demo';
process.env.PORT = process.env.E2E_PORT || '5100';
process.env.JWT_SECRET = process.env.E2E_JWT_SECRET || 'e2e-test-secret';

const port = process.env.PORT;
const baseURL = `http://127.0.0.1:${port}`;

async function startStack(): Promise<void> {
  const { seedDemoData } = require('./demo-seed.js') as typeof import('./demo-seed.js');
  await seedDemoData();

  const { startServer } = require('../server.js') as typeof import('../server.js');
  await startServer();
}

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      await axios.get(`${baseURL}/health`, { timeout: 2000 });
      return;
    } catch {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  throw new Error('Backend server did not become healthy');
}

async function login(email: string, password: string): Promise<string> {
  const initRes = await axios.post(`${baseURL}/api/auth/login`, { email, password });
  assert.strictEqual(initRes.status, 200);
  assert.ok(initRes.data.token, 'Token must be returned after password verification');
  return initRes.data.token as string;
}

async function createApplication(token: string, department: string): Promise<string> {
  const res = await axios.post(
    `${baseURL}/api/applications`,
    { jobId: `JOB-${Date.now()}`, department, position: 'Associate' },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  assert.strictEqual(res.status, 201);
  return res.data.application._id as string;
}

async function grantConsent(token: string, applicationId: string, categories: string[]): Promise<void> {
  const res = await axios.post(
    `${baseURL}/api/consent`,
    { applicationId, dataCategories: categories },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  assert.strictEqual(res.status, 201);
}

async function verify(token: string, applicationId: string) {
  const res = await axios.post(
    `${baseURL}/api/applications/${applicationId}/verify`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
}

export async function runE2E(): Promise<void> {
  await startStack();
  await waitForServer();

  const adminToken = await login('admin@test.com', 'admin123');
  const rahulToken = await login('rahul@test.com', 'password123');
  const priyaToken = await login('priya@test.com', 'password123');
  const fraudToken = await login('fraud@test.com', 'password123');

  assert.strictEqual(typeof adminToken, 'string');
  assert.ok(adminToken.length > 0);

  const getLatestVerification = async (applicationId: string) => {
    const res = await axios.get(
      `${baseURL}/api/applications/${applicationId}/verification`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    return res.data.verification;
  };

  const totalChecks: string[] = [];

  const track = (name: string, fn: () => void): void => {
    fn();
    totalChecks.push(name);
  };

  {
    const appId = await createApplication(rahulToken, 'Education');
    await grantConsent(rahulToken, appId, ['education']);
    const result = await verify(adminToken, appId);
    track('education verified', () => {
      assert.strictEqual(result.verification.status, 'completed', 'education verification should complete');
      assert.strictEqual(result.verification.matched, true, 'education should match');
      assert.ok(result.verification.confidence >= 0.85, `education confidence too low: ${result.verification.confidence}`);
      assert.strictEqual(result.application.status, 'verified', 'education application should be verified');
    });
    const latest = await getLatestVerification(appId);
    track('education verification persisted', () => {
      assert.strictEqual(latest.status, 'completed');
      assert.strictEqual(latest.matched, true);
    });
  }

  {
    const appId = await createApplication(priyaToken, 'Employment');
    await grantConsent(priyaToken, appId, ['employment']);
    const result = await verify(adminToken, appId);
    track('employment verified', () => {
      assert.strictEqual(result.verification.status, 'completed', 'employment verification should complete');
      assert.strictEqual(result.verification.matched, true, 'employment should match (cross-system identity)');
      assert.ok(result.verification.confidence >= 0.85, `employment confidence too low: ${result.verification.confidence}`);
      assert.strictEqual(result.application.status, 'verified', 'employment application should be verified');
    });
  }

  {
    const appId = await createApplication(fraudToken, 'Education');
    await grantConsent(fraudToken, appId, ['education']);
    const result = await verify(adminToken, appId);
    track('negative mismatch rejected', () => {
      assert.strictEqual(result.verification.status, 'completed', 'negative verification should complete');
      assert.strictEqual(result.verification.matched, false, 'same-name different-dob claimant must be rejected');
      assert.ok(result.verification.confidence < 0.85, `mismatch confidence should be below threshold: ${result.verification.confidence}`);
      assert.strictEqual(result.application.status, 'rejected', 'mismatch application should be rejected');
    });
  }

  {
    const appId = await createApplication(rahulToken, 'Education');
    await grantConsent(rahulToken, appId, ['education']);
    let authFailed = false;
    try {
      await verify(rahulToken, appId);
    } catch (error) {
      const ax = error as AxiosError;
      authFailed = ax.response?.status === 403;
      if (!authFailed) {
        console.log('  unexpected auth response:', ax.response?.status, JSON.stringify(ax.response?.data));
      }
    }
    track('authorization failure', () => {
      assert.strictEqual(authFailed, true, 'citizen must not be allowed to trigger verification');
    });
  }

  {
    const appId = await createApplication(rahulToken, 'Education');
    let consentFailed = false;
    try {
      await verify(adminToken, appId);
    } catch (error) {
      const ax = error as AxiosError;
      consentFailed = ax.response?.status === 403;
    }
    track('consent missing failure', () => {
      assert.strictEqual(consentFailed, true, 'verification without consent must be forbidden');
    });
  }

  console.log(`E2E self-check passed (${totalChecks.length} checks).`);
}

if (require.main === module) {
  runE2E()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error(
        `E2E self-check failed: ${error instanceof Error ? error.stack || error.message : String(error)}`
      );
      process.exit(1);
    });
}
