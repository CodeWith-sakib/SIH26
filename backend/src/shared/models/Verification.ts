import { Document, Schema, Types, model } from 'mongoose';

export type VerificationStatus = 'pending' | 'completed' | 'failed';

export interface VerificationDocument extends Document {
  applicationId: Types.ObjectId;
  status: VerificationStatus;
  requestedCategories: string[];
  departmentCodes: string[];
  matched: boolean | null;
  confidence: number | null;
  sourceDepartment: string | null;
  verifiedAt: Date | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const verificationSchema = new Schema<VerificationDocument>(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
      required: true
    },
    requestedCategories: {
      type: [String],
      required: true,
      validate: {
        validator: (categories: string[]) => categories.length > 0,
        message: 'At least one requested category is required'
      }
    },
    departmentCodes: {
      type: [String],
      required: true,
      validate: {
        validator: (codes: string[]) => codes.length > 0,
        message: 'At least one department code is required'
      }
    },
    matched: {
      type: Boolean
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1
    },
    sourceDepartment: {
      type: String
    },
    verifiedAt: {
      type: Date
    },
    failureReason: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

const Verification = model<VerificationDocument>('Verification', verificationSchema);

export default Verification;