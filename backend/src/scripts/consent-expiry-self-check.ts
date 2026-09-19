import assert from 'assert';
import mongoose from 'mongoose';
import Consent from '../shared/models/Consent.js';
import User from '../shared/models/User.js';
import Application from '../shared/models/Application.js';
import AuditLog from '../audit/audit.model.js';
import { consentExpiryService } from '../services/consent/service/consentExpiryService.js';
import { VerificationService, VerificationError } from '../services/verification/service/verificationService.js';

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/sih_demo';

async function runConsentExpirySelfCheck(): Promise<void> {
  await mongoose.connect(mongoUri);

  const testSuffix = `exp-test-${Date.now()}`;

  // 1. Create test citizen and application
  const testUser = await User.create({
    name: 'Expiry Test Citizen',
    email: `exp_${Date.now()}@test.com`,
    password: 'hashedpassword123',
    role: 'citizen'
  });

  const testAppExpired = await Application.create({
    citizenId: testUser._id,
    applicationNumber: `APP-${Date.now()}-1`,
    jobId: 'JOB-EXP-1',
    department: 'Education',
    position: 'Teacher',
    status: 'submitted'
  });

  const testAppFuture = await Application.create({
    citizenId: testUser._id,
    applicationNumber: `APP-${Date.now()}-2`,
    jobId: 'JOB-EXP-2',
    department: 'Education',
    position: 'Teacher',
    status: 'submitted'
  });

  // 2. Create one overdue consent and one future consent
  const pastDate = new Date(Date.now() - 3600 * 1000); // 1 hour ago
  const futureDate = new Date(Date.now() + 3600 * 24 * 1000); // 1 day in future

  const overdueConsent = await Consent.create({
    citizenId: testUser._id,
    applicationId: testAppExpired._id,
    dataCategories: ['education'],
    status: 'active',
    grantedAt: new Date(Date.now() - 7200 * 1000),
    expiresAt: pastDate
  });

  const activeConsent = await Consent.create({
    citizenId: testUser._id,
    applicationId: testAppFuture._id,
    dataCategories: ['education'],
    status: 'active',
    grantedAt: new Date(),
    expiresAt: futureDate
  });

  // 3. Run the automated expiry scan
  const expiredCount = await consentExpiryService.expireOverdueConsents();
  assert.ok(expiredCount >= 1, `Expected at least 1 consent to be expired, got ${expiredCount}`);

  // 4. Verify status updates
  const refreshedOverdue = await Consent.findById(overdueConsent._id);
  assert.strictEqual(refreshedOverdue?.status, 'expired', 'Overdue consent status must transition to expired');

  const refreshedActive = await Consent.findById(activeConsent._id);
  assert.strictEqual(refreshedActive?.status, 'active', 'Future consent status must remain active');

  // 5. Test idempotency: running second time should not re-expire already expired consents
  const secondRunCount = await consentExpiryService.expireOverdueConsents();
  assert.strictEqual(secondRunCount, 0, 'Second run of expiry job must be idempotent (0 expired)');

  // 6. Verify audit log entry was created
  const auditEntry = await AuditLog.findOne({
    action: 'CONSENT_EXPIRED',
    consentId: overdueConsent._id.toString()
  });
  assert.ok(auditEntry, 'Audit log entry for CONSENT_EXPIRED must be recorded');
  assert.strictEqual(auditEntry.outcome, 'SUCCESS');

  // 7. Verify expired consent cannot be used for verification
  const dummyMatcher = { match: async () => ({ samePerson: true, confidence: 1, matchedFields: [], unmatchedFields: [] }) };
  const dummyEngine = {
    getCitizenData: async () => null,
    isDepartmentAvailable: async () => true
  };

  const verificationService = new VerificationService({
    integrationEngine: dummyEngine,
    entityMatcher: dummyMatcher
  });

  let verificationBlocked = false;
  try {
    await verificationService.verifyApplication(
      testAppExpired._id.toString(),
      ['education'],
      ['EDUCATION']
    );
  } catch (error) {
    if (error instanceof VerificationError && error.statusCode === 403) {
      verificationBlocked = true;
    }
  }
  assert.strictEqual(verificationBlocked, true, 'Verification must be blocked with 403 for expired consent');

  // 8. Test Scheduler Start & Stop
  assert.strictEqual(consentExpiryService.isSchedulerRunning(), false);
  consentExpiryService.startScheduler(5000);
  assert.strictEqual(consentExpiryService.isSchedulerRunning(), true);
  // Calling start again should not create duplicate timers
  consentExpiryService.startScheduler(5000);
  assert.strictEqual(consentExpiryService.isSchedulerRunning(), true);
  consentExpiryService.stopScheduler();
  assert.strictEqual(consentExpiryService.isSchedulerRunning(), false);

  // 9. Clean up test records
  await Consent.deleteMany({ citizenId: testUser._id });
  await Application.deleteMany({ citizenId: testUser._id });
  await User.deleteOne({ _id: testUser._id });
  await AuditLog.deleteMany({ consentId: overdueConsent._id.toString() });

  await mongoose.disconnect();
  console.log('Consent expiry self-check passed (active -> expired transition, idempotency, audit trail, verification rejection, scheduler lifecycle).');
}

runConsentExpirySelfCheck().catch((err: unknown) => {
  console.error('Consent expiry self-check failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
