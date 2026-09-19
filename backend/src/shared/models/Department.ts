import { Document, Schema, model } from 'mongoose';

export interface DepartmentDocument extends Document {
  name: string;
  code: string;
  description?: string;
  active: boolean;
  dataCategories?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const departmentSchema = new Schema<DepartmentDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    description: {
      type: String,
      trim: true
    },
    active: {
      type: Boolean,
      default: true
    },
    dataCategories: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true
  }
);

const Department = model<DepartmentDocument>('Department', departmentSchema);

export default Department;