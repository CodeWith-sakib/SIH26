import AuditLog, { AuditAction, AuditOutcome } from './audit.model.js';
import { UserRole } from '../shared/constants/roles.js';

export interface AuditEventInput {
  actorId?: string | null;
  actorRole?: UserRole;
  action: AuditAction;
  resource?: string;
  resourceId?: string;
  applicationId?: string;
  department?: string;
  consentId?: string;
  purpose?: string;
  requestId?: string;
  outcome: AuditOutcome;
  metadata?: Record<string, unknown>;
}

export interface AuditContext {
  actorId?: string | null;
  actorRole?: UserRole;
  requestId?: string;
}

const FORBIDDEN_METADATA_KEY_PATTERN =
  /password|passwd|secret|token|apikey|api_key|api-key|authorization|bearer|cookie|credential|privatekey|private_key|clientsecret|client_secret|accesskey|access_key/i;

const MAX_METADATA_DEPTH = 3;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > MAX_METADATA_DEPTH) {
    return '[truncated]';
  }

  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item, depth + 1));
  }

  if (isPlainObject(value)) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (FORBIDDEN_METADATA_KEY_PATTERN.test(key)) {
        continue;
      }
      sanitized[key] = sanitizeValue(entry, depth + 1);
    }
    return sanitized;
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null
  ) {
    return value;
  }

  return String(value);
}

function sanitizeMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!metadata) {
    return undefined;
  }

  return sanitizeValue(metadata, 0) as Record<string, unknown>;
}

/*
 * Append-only audit writer.
 *
 * This function never throws. Audit persistence failures are reported
 * to stderr (without secrets) and never alter the caller's business
 * outcome: a successfully completed action stays successful even if
 * its audit record could not be written.
 */
async function record(event: AuditEventInput): Promise<void> {
  try {
    await AuditLog.create({
      actorId: event.actorId ?? null,
      ...(event.actorRole && { actorRole: event.actorRole }),
      action: event.action,
      ...(event.resource && { resource: event.resource }),
      ...(event.resourceId && { resourceId: event.resourceId }),
      ...(event.applicationId && { applicationId: event.applicationId }),
      ...(event.department && { department: event.department }),
      ...(event.consentId && { consentId: event.consentId }),
      ...(event.purpose && { purpose: event.purpose }),
      ...(event.requestId && { requestId: event.requestId }),
      outcome: event.outcome,
      ...(event.metadata && { metadata: sanitizeMetadata(event.metadata) })
    });
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.name : 'UnknownError';
    console.error(`Audit logging failed for action ${event.action}: ${reason}`);
  }
}

export const auditService = {
  record
};
