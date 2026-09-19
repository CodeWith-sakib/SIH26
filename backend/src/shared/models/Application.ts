import { Document, Schema, Types, model } from 'mongoose';

export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'verified'
  | 'rejected'
  | 'withdrawn';

export interface ApplicationDocument extends Document {
  citizenId: Types.ObjectId;
  applicationNumber: string;
  jobId: string;
  department: string;
  position: string;
  status: ApplicationStatus;
  submittedAt?: Date;
  applicationKind: 'standard' | 'employment';
  employmentJobId?: Types.ObjectId;
  formData?: Record<string, unknown>;
  fetchedFields: string[];
  manuallyEnteredFields: string[];
  consentId?: Types.ObjectId;
  externalSubmissionStatus: 'NOT_CONFIGURED' | 'PENDING_EXTERNAL_SYNC' | 'EXTERNAL_SYNCED' | 'EXTERNAL_SYNC_FAILED';
  externalApplicationId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const applicationSchema = new Schema<ApplicationDocument>(
  {
    citizenId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    applicationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    jobId: {
      type: String,
      required: true,
      trim: true
    },

    department: {
      type: String,
      required: true,
      trim: true
    },

    position: {
      type: String,
      required: true,
      trim: true
    },

    status: {
      type: String,
      enum: [
        'draft',
        'submitted',
        'under_review',
        'verified',
        'rejected',
        'withdrawn'
      ],
      default: 'submitted'
    },

    submittedAt: {
      type: Date,
      default: function (this: ApplicationDocument) {
        return this.status === 'draft' ? undefined : new Date();
      }
    },
    applicationKind: { type: String, enum: ['standard', 'employment'], default: 'standard', index: true },
    employmentJobId: { type: Schema.Types.ObjectId, ref: 'EmploymentJob', index: true },
    formData: { type: Schema.Types.Mixed, default: {} },
    fetchedFields: { type: [String], default: [] },
    manuallyEnteredFields: { type: [String], default: [] },
    consentId: { type: Schema.Types.ObjectId, ref: 'Consent' },
    externalSubmissionStatus: {
      type: String,
      enum: ['NOT_CONFIGURED', 'PENDING_EXTERNAL_SYNC', 'EXTERNAL_SYNCED', 'EXTERNAL_SYNC_FAILED'],
      default: 'NOT_CONFIGURED'
    },
    externalApplicationId: { type: String, trim: true }
  },
  {
    timestamps: true
  }
);

const Application = model<ApplicationDocument>(
  'Application',
  applicationSchema
);

export default Application;
