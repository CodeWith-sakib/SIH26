import assert from 'assert';
import mongoose from 'mongoose';
import AuditLog, { AUDIT_ACTIONS, AuditAction } from '../audit/audit.model.js';
import { auditService } from '../audit/audit.service.js';

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/sih_demo';

async function runAuditSelfCheck(): Promise<void> {
  await mongoose.connect(mongoUri);

  const testRunId = `audit-test-${Date.now()}`;

  // 1. Verify all required audit actions are defined in AUDIT_ACTIONS enum
  const requiredActions: AuditAction[] = [
    'USER_LOGIN',
    'USER_REGISTERED',
    'APPLICATION_CREATED',
    'APPLICATION_UPDATED',
    'APPLICATION_WITHDRAWN',
    'APPLICATION_STATUS_CHANGED',
    'CONSENT_GRANTED',
    'CONSENT_REVOKED',
    'CONSENT_EXPIRED',
    'DATA_ACCESS_REQUESTED',
    'DATA_ACCESS_ALLOWED',
    'DATA_ACCESS_DENIED',
    'INTEGRATION_REQUESTED',
    'INTEGRATION_FAILED',
    'VERIFICATION_STARTED',
    'VERIFICATION_COMPLETED',
    'VERIFICATION_FAILED',
    'APPLICATION_APPROVED',
    'APPLICATION_REJECTED',
    'CONNECTOR_CREATED',
    'CONNECTOR_UPDATED',
    'CONNECTOR_ENABLED',
    'CONNECTOR_DISABLED',
    'CONNECTOR_DELETED',
    'DEPARTMENT_CREATED',
    'DEPARTMENT_UPDATED',
    'DEPARTMENT_DELETED'
  ];

  for (const action of requiredActions) {
    assert.ok(
      AUDIT_ACTIONS.includes(action),
      `Required action ${action} is missing in AUDIT_ACTIONS enum`
    );
  }

  // 2. Test audit logging for all categories
  await auditService.record({
    actorId: 'usr-auth-test',
    actorRole: 'citizen',
    action: 'USER_REGISTERED',
    resource: 'user',
    resourceId: 'usr-auth-test',
    requestId: testRunId,
    outcome: 'SUCCESS',
    metadata: {
      email: 'newuser@test.com',
      // sensitive fields that must be stripped by sanitizer
      password: 'plain-text-password-should-be-stripped',
      secretKey: 'top-secret',
      apiKey: 'api-key-12345',
      bearerToken: 'token-xyz'
    }
  });

  await auditService.record({
    actorId: 'admin-123',
    actorRole: 'admin',
    action: 'DEPARTMENT_CREATED',
    resource: 'department',
    department: 'TEST_DEPT',
    requestId: testRunId,
    outcome: 'SUCCESS',
    metadata: { name: 'Test Department', code: 'TEST_DEPT' }
  });

  await auditService.record({
    actorId: 'admin-123',
    actorRole: 'admin',
    action: 'CONNECTOR_CREATED',
    resource: 'integration',
    department: 'TEST_DEPT',
    requestId: testRunId,
    outcome: 'SUCCESS',
    metadata: {
      name: 'Test Connector',
      clientSecret: 'secret-should-be-stripped'
    }
  });

  await auditService.record({
    actorId: 'cit-123',
    actorRole: 'citizen',
    action: 'CONSENT_GRANTED',
    resource: 'consent',
    consentId: 'con-123',
    applicationId: 'app-123',
    requestId: testRunId,
    outcome: 'SUCCESS'
  });

  await auditService.record({
    actorId: null,
    action: 'CONSENT_EXPIRED',
    resource: 'consent',
    consentId: 'con-123',
    applicationId: 'app-123',
    requestId: testRunId,
    outcome: 'SUCCESS'
  });

  await auditService.record({
    actorId: 'admin-123',
    actorRole: 'admin',
    action: 'VERIFICATION_COMPLETED',
    resource: 'verification',
    applicationId: 'app-123',
    department: 'TEST_DEPT',
    requestId: testRunId,
    outcome: 'SUCCESS',
    metadata: { matched: true, confidence: 0.95 }
  });

  // 3. Verify persistence and sanitization
  const records = await AuditLog.find({ requestId: testRunId });
  assert.strictEqual(records.length, 6, `Expected 6 audit records, got ${records.length}`);

  const userRegRecord = records.find(r => r.action === 'USER_REGISTERED');
  assert.ok(userRegRecord, 'USER_REGISTERED record must exist');
  assert.strictEqual(userRegRecord.outcome, 'SUCCESS');
  assert.strictEqual(userRegRecord.actorRole, 'citizen');
  assert.strictEqual((userRegRecord.metadata as any)?.email, 'newuser@test.com');

  // Verify that secrets were safely stripped from metadata
  assert.strictEqual((userRegRecord.metadata as any)?.password, undefined, 'password must be stripped from audit metadata');
  assert.strictEqual((userRegRecord.metadata as any)?.secretKey, undefined, 'secretKey must be stripped from audit metadata');
  assert.strictEqual((userRegRecord.metadata as any)?.apiKey, undefined, 'apiKey must be stripped from audit metadata');
  assert.strictEqual((userRegRecord.metadata as any)?.bearerToken, undefined, 'bearerToken must be stripped from audit metadata');

  const connectorRecord = records.find(r => r.action === 'CONNECTOR_CREATED');
  assert.ok(connectorRecord, 'CONNECTOR_CREATED record must exist');
  assert.strictEqual((connectorRecord.metadata as any)?.clientSecret, undefined, 'clientSecret must be stripped from connector metadata');

  // 4. Clean up test records
  await AuditLog.deleteMany({ requestId: testRunId });

  await mongoose.disconnect();
  console.log('Audit logging self-check passed (actions, metadata sanitization, persistence).');
}

runAuditSelfCheck().catch((err: unknown) => {
  console.error('Audit self-check failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
