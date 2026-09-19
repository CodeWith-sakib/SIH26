import { Document, Schema, Types, model } from 'mongoose';

export type ConsentDataCategory =
  | 'education'
  | 'employment';

export type ConsentStatus =
  | 'active'
  | 'revoked'
  | 'expired';

export interface ConsentDocument extends Document {
  citizenId: Types.ObjectId;
  applicationId: Types.ObjectId;
  dataCategories: ConsentDataCategory[];
  status: ConsentStatus;
  grantedAt: Date;
  expiresAt?: Date;
  revokedAt?: Date;
  purpose?: string;
  dataSource?: string;
  createdAt: Date;
  updatedAt: Date;
}

const consentSchema = new Schema<ConsentDocument>(
  {
    citizenId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
      index: true
    },

    dataCategories: {
      type: [String],
      enum: ['education', 'employment'],
      required: true,
      validate: {
        validator: (categories: ConsentDataCategory[]) =>
          categories.length > 0,
        message: 'At least one data category is required'
      }
    },

    status: {
      type: String,
      enum: ['active', 'revoked', 'expired'],
      default: 'active',
      required: true
    },

    grantedAt: {
      type: Date,
      default: Date.now,
      required: true
    },

    expiresAt: {
      type: Date
    },

    revokedAt: {
      type: Date
    },
    purpose: { type: String, trim: true, maxlength: 300 },
    dataSource: { type: String, trim: true, maxlength: 150 }
  },
  {
    timestamps: true
  }
);

consentSchema.index(
  { citizenId: 1, applicationId: 1 },
  { unique: true }
);

const Consent = model<ConsentDocument>(
  'Consent',
  consentSchema
);

export default Consent;
