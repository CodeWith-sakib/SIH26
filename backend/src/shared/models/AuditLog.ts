import { Document, Schema, model } from 'mongoose';
import { UserRole } from '../constants/roles.js';

export type AuditAction =
  | 'USER_LOGIN'
  | 'USER_REGISTERED'
  | 'APPLICATION_CREATED'
  | 'APPLICATION_SUBMITTED'
  | 'APPLICATION_UPDATED'
  | 'APPLICATION_WITHDRAWN'
  | 'APPLICATION_STATUS_CHANGED'
  | 'CONSENT_GRANTED'
  | 'CONSENT_REVOKED'
  | 'CONSENT_EXPIRED'
  | 'DATA_ACCESS_REQUESTED'
  | 'DATA_ACCESS_ALLOWED'
  | 'DATA_ACCESS_DENIED'
  | 'INTEGRATION_REQUESTED'
  | 'INTEGRATION_FAILED'
  | 'VERIFICATION_STARTED'
  | 'VERIFICATION_COMPLETED'
  | 'VERIFICATION_FAILED'
  | 'APPLICATION_APPROVED'
  | 'APPLICATION_REJECTED'
  | 'CONNECTOR_CREATED'
  | 'CONNECTOR_UPDATED'
  | 'CONNECTOR_TESTED'
  | 'CONNECTOR_ENABLED'
  | 'CONNECTOR_DISABLED'
  | 'CONNECTOR_DELETED'
  | 'DEPARTMENT_CREATED'
  | 'DEPARTMENT_UPDATED'
  | 'DEPARTMENT_DELETED'
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_DELETED'
  | 'EMPLOYMENT_APPLICATION_CREATED'
  | 'EMPLOYMENT_DATA_FETCHED'
  | 'EMPLOYMENT_APPLICATION_SUBMITTED';

export type AuditOutcome =
  | 'SUCCESS'
  | 'FAILURE'
  | 'DENIED';

export const AUDIT_ACTIONS: AuditAction[] = [
  'USER_LOGIN',
  'USER_REGISTERED',
  'APPLICATION_CREATED',
  'APPLICATION_SUBMITTED',
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
  'CONNECTOR_TESTED',
  'CONNECTOR_ENABLED',
  'CONNECTOR_DISABLED',
  'CONNECTOR_DELETED',
  'DEPARTMENT_CREATED',
  'DEPARTMENT_UPDATED',
  'DEPARTMENT_DELETED',
  'DOCUMENT_UPLOADED',
  'DOCUMENT_DELETED',
  'EMPLOYMENT_APPLICATION_CREATED',
  'EMPLOYMENT_DATA_FETCHED',
  'EMPLOYMENT_APPLICATION_SUBMITTED'
];

export const AUDIT_OUTCOMES: AuditOutcome[] = [
  'SUCCESS',
  'FAILURE',
  'DENIED'
];

export interface AuditLogDocument extends Document {
  actorId: string | null;
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
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const auditLogSchema = new Schema<AuditLogDocument>(
  {
    actorId: {
      type: String,
      default: null,
      index: true
    },
    actorRole: {
      type: String,
      enum: ['admin', 'department_officer', 'citizen']
    },
    action: {
      type: String,
      enum: AUDIT_ACTIONS,
      required: true,
      index: true
    },
    resource: {
      type: String,
      trim: true
    },
    resourceId: {
      type: String,
      trim: true
    },
    applicationId: {
      type: String,
      trim: true,
      index: true
    },
    department: {
      type: String,
      trim: true,
      index: true
    },
    consentId: {
      type: String,
      trim: true,
      index: true
    },
    purpose: {
      type: String,
      trim: true
    },
    requestId: {
      type: String,
      trim: true,
      index: true
    },
    outcome: {
      type: String,
      enum: AUDIT_OUTCOMES,
      required: true
    },
    metadata: {
      type: Schema.Types.Mixed
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

auditLogSchema.index({ applicationId: 1, timestamp: 1 });
auditLogSchema.index({ actorId: 1, timestamp: 1 });

const AuditLog = model<AuditLogDocument>('AuditLog', auditLogSchema);

export default AuditLog;
