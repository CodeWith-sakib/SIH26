import 'dotenv/config';
import mongoose from 'mongoose';
import { validateConfig } from '../shared/config/index.js';
import { EmploymentService } from '../services/employment/service/employmentService.js';
(async () => { validateConfig(); await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sih_demo'); await (new EmploymentService()).ensureSeeded(); console.log('Employment demo jobs seeded.'); await mongoose.disconnect(); })().catch(error => { console.error(error instanceof Error ? error.message : 'Seed failed'); process.exit(1); });
