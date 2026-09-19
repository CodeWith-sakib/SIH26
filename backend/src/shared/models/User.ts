import mongoose, { Document, Model } from 'mongoose';
import { UserRole } from '../constants/roles.js';

export interface UserDocument extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  isVerified: boolean;
  dateOfBirth?: string;
  phone?: string;
  registrationNumber?: string;
  college?: string;
  gender?: string;
  address?: string;
  district?: string;
  state?: string;
  pincode?: string;
  education?: string;
  category?: string;
}

const userSchema = new mongoose.Schema<UserDocument>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    select: false
  },
  role: {
    type: String,
    enum: ['citizen', 'department_officer', 'admin'],
    default: 'citizen'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  dateOfBirth: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  registrationNumber: {
    type: String,
    trim: true
  },
  college: { type: String, trim: true },
  gender: { type: String, trim: true },
  address: { type: String, trim: true },
  district: { type: String, trim: true },
  state: { type: String, trim: true },
  pincode: { type: String, trim: true },
  education: { type: String, trim: true },
  category: { type: String, trim: true }
});

const User: Model<UserDocument> = mongoose.model<UserDocument>('User', userSchema);

export default User;
