import { Document, Schema, Types, model } from 'mongoose';

export interface UploadedDocumentDocument extends Document {
  applicationId: Types.ObjectId;
  userId: Types.ObjectId;
  originalFileName: string;
  cloudinaryPublicId: string;
  cloudinarySecureUrl: string;
  resourceType: 'image' | 'raw';
  format: string;
  mimeType: string;
  fileSize: number;
  documentType: string;
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const uploadedDocumentSchema = new Schema<UploadedDocumentDocument>({
  applicationId: { type: Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  originalFileName: { type: String, required: true, trim: true, maxlength: 255 },
  cloudinaryPublicId: { type: String, required: true, unique: true },
  cloudinarySecureUrl: { type: String, required: true },
  resourceType: { type: String, enum: ['image', 'raw'], required: true },
  format: { type: String, required: true },
  mimeType: { type: String, required: true },
  fileSize: { type: Number, required: true, min: 1 },
  documentType: { type: String, required: true, trim: true, maxlength: 100 },
  uploadedAt: { type: Date, default: Date.now }
}, { timestamps: true });

uploadedDocumentSchema.index({ applicationId: 1, uploadedAt: -1 });

export default model<UploadedDocumentDocument>('UploadedDocument', uploadedDocumentSchema);
