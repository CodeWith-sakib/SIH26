import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Department from '../shared/models/Department.js';
import Integration from '../shared/models/Integration.js';
import User from '../shared/models/User.js';

async function upsertDepartment(name: string, code: string, dataCategories: string[]): Promise<{ _id: mongoose.Types.ObjectId; code: string }> {
  return Department.findOneAndUpdate(
    { code },
    { name, code, description: `${name} reference system`, active: true, dataCategories },
    { upsert: true, new: true }
  ).lean().exec() as unknown as { _id: mongoose.Types.ObjectId; code: string };
}

async function upsertIntegration(
  departmentId: mongoose.Types.ObjectId,
  doc: Record<string, unknown>
): Promise<void> {
  await Integration.findOneAndUpdate(
    { departmentId, name: doc.name as string },
    { departmentId, ...doc },
    { upsert: true, new: true }
  ).exec();
}

async function upsertUser(
  name: string,
  email: string,
  password: string,
  role: 'admin' | 'citizen',
  extra: Record<string, string> = {}
): Promise<void> {
  const hashed = await bcrypt.hash(password, 10);
  await User.findOneAndUpdate(
    { email },
    { name, email, password: hashed, role, isVerified: true, ...extra },
    { upsert: true, new: true }
  ).exec();
}

export async function seedDemoData(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not configured');

  await mongoose.connect(uri);

  const eduPort = Number(process.env.MOCK_EDU_PORT) || 4001;
  const empPort = Number(process.env.MOCK_EMP_PORT) || 4002;

  const education = await upsertDepartment('Education Department', 'EDUCATION', ['education']);
  const employment = await upsertDepartment('Employment Department', 'EMPLOYMENT', ['employment']);

  await upsertIntegration(education._id, {
    name: 'Education REST Integration',
    protocol: 'REST',
    baseUrl: `http://localhost:${eduPort}`,
    authentication: {
      type: 'API_KEY',
      apiKey: { headerName: 'x-api-key', value: 'edu-test-key-123' }
    },
    request: {
      method: 'GET',
      path: '/v1/students/{id}'
    },
    response: { dataPath: 'data' },
    fieldMappings: [
      { sourceField: 'student_name', canonicalField: 'name', transform: 'trim' },
      { sourceField: 'dob', canonicalField: 'dateOfBirth', transform: 'date' },
      { sourceField: 'phone', canonicalField: 'phone', transform: 'trim' },
      { sourceField: 'email', canonicalField: 'email', transform: 'lowercase' },
      { sourceField: 'roll_no', canonicalField: 'registrationNumber', transform: 'trim' },
      { sourceField: 'course_name', canonicalField: 'qualification', transform: 'trim' },
      { sourceField: 'marks', canonicalField: 'score', transform: 'number' }
    ],
    active: true
  });

  await upsertIntegration(employment._id, {
    name: 'Employment SOAP Integration',
    protocol: 'SOAP',
    baseUrl: `http://localhost:${empPort}`,
    authentication: {
      type: 'JWT',
      jwt: {
        tokenUrl: `http://localhost:${empPort}/oauth/token`,
        clientId: 'employment-client',
        clientSecret: 'secret-456',
        scopes: []
      }
    },
    request: {
      method: 'POST',
      path: '/getApplicant',
      soapAction: 'getApplicant',
      bodyMapping: {
        applicantName: 'name',
        dateOfBirth: 'dateOfBirth'
      },
      namespace: {
        soap: 'http://schemas.xmlsoap.org/soap/envelope/',
        xsi: 'http://www.w3.org/2001/XMLSchema-instance',
        xsd: 'http://www.w3.org/2001/XMLSchema'
      }
    },
    response: { dataPath: 'Envelope.Body.getApplicantResponse' },
    fieldMappings: [
      { sourceField: 'applicantName', canonicalField: 'name', transform: 'trim' },
      { sourceField: 'dateOfBirth', canonicalField: 'dateOfBirth', transform: 'date' },
      { sourceField: 'employeeId', canonicalField: 'registrationNumber', transform: 'trim' }
    ],
    active: true
  });

  await upsertUser('Platform Admin', 'admin@test.com', 'admin123', 'admin');
  await upsertUser('Rahul Kumar', 'rahul@test.com', 'password123', 'citizen', {
    dateOfBirth: '1995-03-15',
    phone: '+919800001111',
    registrationNumber: 'EDU2024001234'
  });
  await upsertUser('Priya Sharma', 'priya@test.com', 'password123', 'citizen', {
    dateOfBirth: '1993-07-22',
    phone: '+919800002222',
    registrationNumber: 'EDU2023005678'
  });
  await upsertUser('Nikhil Korada', 'nikhilkorada06@gmail.com', '12345678', 'citizen', {
    dateOfBirth: '2005-12-06',
    phone: '09182820217',
    registrationNumber: 'EDU2025007788',
    college: 'Government College of Engineering, Pune',
    gender: 'Male',
    address: 'Shivajinagar, Pune',
    district: 'Pune',
    state: 'Maharashtra',
    pincode: '411005',
    education: 'Bachelor of Technology',
    category: 'General'
  });
  await upsertUser('Asha Verma', 'impostor@test.com', 'password123', 'citizen', {
    dateOfBirth: '1990-01-01',
    phone: '+919800003333',
    registrationNumber: 'EDU2020000000'
  });
  await upsertUser('Rahul Kumar', 'fraud@test.com', 'password123', 'citizen', {
    dateOfBirth: '1990-01-01',
    phone: '+919800004444',
    registrationNumber: 'EDU2020000000'
  });

  await mongoose.disconnect();
}

if (require.main === module) {
  seedDemoData()
    .then(() => console.log('Demo seed data ready.'))
    .catch((error: unknown) => {
      console.error(`Seed failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    });
}