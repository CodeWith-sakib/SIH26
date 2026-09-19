import { Document, Schema, model } from 'mongoose';

export interface RequiredDocument { name: string; required: boolean }
export interface EmploymentJobDocument extends Document {
  jobId: string; title: string; organization: string; department: string;
  location: string; district: string; employmentType: string; category: string;
  qualification: string; experience: string; salary: string; description: string;
  responsibilities: string[]; eligibility: string[]; deadline: Date;
  requiredDocuments: RequiredDocument[]; source: 'DEMO' | 'EXTERNAL'; active: boolean;
}

const schema = new Schema<EmploymentJobDocument>({
  jobId: { type: String, required: true, unique: true, trim: true },
  title: { type: String, required: true, trim: true }, organization: { type: String, required: true, trim: true },
  department: { type: String, required: true, trim: true }, location: { type: String, required: true, trim: true },
  district: { type: String, required: true, trim: true }, employmentType: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true }, qualification: { type: String, required: true, trim: true },
  experience: { type: String, required: true, trim: true }, salary: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true }, responsibilities: { type: [String], default: [] },
  eligibility: { type: [String], default: [] }, deadline: { type: Date, required: true },
  requiredDocuments: [{ name: { type: String, required: true }, required: { type: Boolean, default: true } }],
  source: { type: String, enum: ['DEMO', 'EXTERNAL'], default: 'DEMO' }, active: { type: Boolean, default: true, index: true }
}, { timestamps: true });

export default model<EmploymentJobDocument>('EmploymentJob', schema);
