import { Document, Schema, Types, model } from 'mongoose';

export type NotificationType = 'application' | 'consent' | 'verification' | 'document';

export interface NotificationDocument extends Document {
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  applicationId?: Types.ObjectId;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<NotificationDocument>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['application', 'consent', 'verification', 'document'], required: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  message: { type: String, required: true, trim: true, maxlength: 500 },
  applicationId: { type: Schema.Types.ObjectId, ref: 'Application' },
  read: { type: Boolean, default: false, index: true },
  readAt: Date
}, { timestamps: true });

notificationSchema.index({ userId: 1, createdAt: -1 });

export default model<NotificationDocument>('Notification', notificationSchema);
