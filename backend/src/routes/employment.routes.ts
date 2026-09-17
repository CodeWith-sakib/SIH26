import { Request, Response, Router } from 'express';
import mongoose from 'mongoose';
import authenticateToken from '../middleware/auth';
import requireRole from '../middleware/role';
import EmploymentJob from '../models/EmploymentJob';
import Application from '../models/Application';
import Consent from '../models/Consent';
import User from '../models/User';
import UploadedDocument from '../models/UploadedDocument';
import Department from '../models/Department';
import { seedEmploymentJobs } from '../services/employment-job.service';
import { employmentPortalAdapter } from '../services/employment-portal.adapter';
import { auditService } from '../audit/audit.service';
import { createNotification } from '../services/notification.service';
import { integrationEngine } from '../engine/integration-engine';
import { entityMatcher } from '../services/entity-matcher';

const router = Router();
router.use(authenticateToken, requireRole('citizen'));
let seeded = false;
async function ensureSeeded() { if (!seeded) { await seedEmploymentJobs(); seeded = true; } }
const clean = (value: unknown): unknown => {
  if (typeof value === 'string') return value.trim().slice(0, 500);
  if (value && typeof value === 'object' && !Array.isArray(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clean(v)]));
  return undefined;
};
function applicationNumber() { return `EMP-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`; }
async function owned(id: string, citizenId: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  return Application.findOne({ _id: id, citizenId, applicationKind: 'employment' });
}

router.get('/jobs', async (req: Request, res: Response) => {
  await ensureSeeded();
  const q = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const filter: Record<string, unknown> = { active: true };
  for (const key of ['category', 'district', 'employmentType', 'organization']) if (typeof req.query[key] === 'string' && req.query[key]) filter[key] = req.query[key];
  if (q) filter.$or = ['title', 'organization', 'location', 'qualification'].map(key => ({ [key]: { $regex: q, $options: 'i' } }));
  const jobs = await EmploymentJob.find(filter).sort({ deadline: 1 }).lean();
  return res.json({ jobs });
});
router.get('/jobs/:jobId', async (req: Request<{ jobId: string }>, res: Response) => {
  await ensureSeeded(); const job = await EmploymentJob.findOne({ jobId: req.params.jobId, active: true }).lean();
  return job ? res.json({ job }) : res.status(404).json({ message: 'Job not found' });
});
router.post('/applications', async (req: Request, res: Response) => {
  const jobId = typeof req.body.jobId === 'string' ? req.body.jobId : ''; await ensureSeeded();
  const job = await EmploymentJob.findOne({ jobId, active: true });
  if (!job) return res.status(404).json({ message: 'Job not found' });
  if (job.deadline < new Date()) return res.status(409).json({ message: 'The application deadline has passed' });
  let application = await Application.findOne({ citizenId: req.user!.id, employmentJobId: job._id, applicationKind: 'employment', status: 'draft' });
  if (!application) {
    application = await Application.create({ citizenId: req.user!.id, applicationNumber: applicationNumber(), jobId: job.jobId, employmentJobId: job._id, department: job.department, position: job.title, status: 'draft', applicationKind: 'employment' });
    await auditService.record({ actorId: req.user!.id, actorRole: req.user!.role, action: 'EMPLOYMENT_APPLICATION_CREATED', applicationId: application.id, resource: 'application', resourceId: application.id, department: job.department, requestId: req.requestId, outcome: 'SUCCESS' });
  }
  return res.status(201).json({ application });
});
router.get('/applications', async (req: Request, res: Response) => {
  const applications = await Application.find({ citizenId: req.user!.id, applicationKind: 'employment' }).populate('employmentJobId').sort({ createdAt: -1 }).lean();
  return res.json({ applications });
});
router.get('/applications/:id', async (req: Request<{ id: string }>, res: Response) => {
  const application = await owned(req.params.id, req.user!.id); if (!application) return res.status(404).json({ message: 'Application not found' });
  const [job, documents, consent] = await Promise.all([EmploymentJob.findById(application.employmentJobId).lean(), UploadedDocument.find({ applicationId: application._id }).select('-cloudinaryPublicId').lean(), Consent.findOne({ applicationId: application._id, citizenId: req.user!.id }).lean()]);
  return res.json({ application, job, documents, consent });
});
router.patch('/applications/:id', async (req: Request<{ id: string }>, res: Response) => {
  const application = await owned(req.params.id, req.user!.id); if (!application) return res.status(404).json({ message: 'Application not found' });
  if (application.status !== 'draft') return res.status(409).json({ message: 'Only draft applications can be edited' });
  const formData = clean(req.body.formData); if (!formData || typeof formData !== 'object') return res.status(400).json({ message: 'Valid form data is required' });
  application.formData = formData as Record<string, unknown>; application.markModified('formData'); await application.save();
  return res.json({ application });
});
router.post('/applications/:id/fetch-data', async (req: Request<{ id: string }>, res: Response) => {
  const application = await owned(req.params.id, req.user!.id); if (!application) return res.status(404).json({ message: 'Application not found' });
  const consent = await Consent.findOne({ applicationId: application._id, citizenId: req.user!.id, status: 'active' });
  if (!consent) return res.status(403).json({ message: 'Active employment data consent is required' });
  const user = await User.findById(req.user!.id).lean(); if (!user) return res.status(404).json({ message: 'Citizen profile not found' });
  const data: Record<string, string> = { fullName: user.name, email: user.email };
  const sources: Record<string, string> = { fullName: 'Citizen profile', email: 'Citizen profile' };
  if (user.dateOfBirth) { data.dateOfBirth = user.dateOfBirth; sources.dateOfBirth = 'Citizen profile'; }
  if (user.phone) { data.mobile = user.phone; sources.mobile = 'Citizen profile'; }
  if (user.registrationNumber) { data.citizenReference = user.registrationNumber; sources.citizenReference = 'Citizen profile'; }
  const profileFields: Record<string, string | undefined> = {
    gender: user.gender,
    institution: user.college,
    highestQualification: user.education,
    category: user.category,
    address: user.address,
    district: user.district,
    state: user.state,
    pincode: user.pincode
  };
  for (const [field, value] of Object.entries(profileFields)) {
    if (value) {
      data[field] = value;
      sources[field] = 'Citizen profile';
    }
  }
  const profileDataFound = Object.keys(profileFields).some(field => Boolean(data[field]));

  const departmentCodes = consent.dataCategories
    .filter(category => category === 'education' || category === 'employment')
    .map(category => category.toUpperCase());
  const availableDepartments = await Department.find({
    code: { $in: departmentCodes },
    active: true
  }).lean();
  let departmentDataFound = false;
  const matchedDepartments: Array<{ department: string; confidence: number }> = [];

  for (const department of availableDepartments) {
    if (!(await integrationEngine.isDepartmentAvailable(department.code))) continue;
    let departmentData;
    try {
      departmentData = await integrationEngine.getCitizenData({
        departmentCode: department.code,
        citizenIdentifier: {
          name: user.name,
          dateOfBirth: user.dateOfBirth,
          email: user.email,
          phone: user.phone
        },
        requestedCategories: department.dataCategories || []
      });
    } catch {
      continue;
    }
    if (!departmentData) continue;

    const match = await entityMatcher.match({
      sourceData: departmentData,
      applicationData: {
        name: user.name,
        dateOfBirth: user.dateOfBirth,
        email: user.email,
        phone: user.phone,
        registrationNumber: user.registrationNumber
      }
    });
    if (!match.samePerson) continue;

    departmentDataFound = true;
    matchedDepartments.push({
      department: department.name,
      confidence: match.confidence
    });

    const source = department.name;
    const mapped: Record<string, unknown> = {
      fullName: departmentData.name,
      dateOfBirth: departmentData.dateOfBirth,
      mobile: departmentData.phone,
      email: departmentData.email,
      citizenReference: departmentData.registrationNumber,
      highestQualification: departmentData.qualification,
      score: departmentData.score
    };
    for (const [field, value] of Object.entries(mapped)) {
      if (value !== undefined && value !== null && String(value).trim()) {
        data[field] = String(value);
        sources[field] = source;
      }
    }
  }

  if (!departmentDataFound && !profileDataFound) {
    return res.status(404).json({
      message: 'Your data was not found in any connected department.'
    });
  }

  application.fetchedFields = Object.keys(data);
  application.consentId = consent._id;
  await application.save();
  await auditService.record({ actorId: req.user!.id, actorRole: req.user!.role, action: 'EMPLOYMENT_DATA_FETCHED', applicationId: application.id, consentId: consent.id, purpose: consent.purpose || 'Prefill employment application', requestId: req.requestId, outcome: 'SUCCESS', metadata: { fields: Object.keys(data), source: consent.dataSource || 'MahaSetu citizen profile' } });
  return res.json({
    data,
    fetchedFields: Object.keys(data),
    sources,
    matchedDepartments
  });
});
router.post('/applications/:id/submit', async (req: Request<{ id: string }>, res: Response) => {
  const application = await owned(req.params.id, req.user!.id); if (!application) return res.status(404).json({ message: 'Application not found' });
  if (application.status !== 'draft') return res.status(409).json({ message: 'Application has already been submitted' });
  const form = clean(req.body.formData) as Record<string, any> | undefined;
  const required = ['personal.fullName','personal.dateOfBirth','personal.gender','personal.mobile','personal.email','personal.address','personal.district','personal.state','personal.pincode','education.highestQualification','education.institution','education.passingYear','education.score','employment.employmentStatus','employment.totalExperience','employment.skills','category.category'];
  const missing = required.filter(path => !path.split('.').reduce<any>((v, key) => v?.[key], form));
  if (missing.length) return res.status(400).json({ message: 'Complete all required application fields', missingFields: missing });
  const job = await EmploymentJob.findById(application.employmentJobId); if (!job) return res.status(404).json({ message: 'Job not found' });
  const docs = await UploadedDocument.find({ applicationId: application._id, userId: req.user!.id });
  const missingDocuments = job.requiredDocuments.filter(d => d.required && !docs.some(x => x.documentType === d.name)).map(d => d.name);
  if (missingDocuments.length) return res.status(400).json({ message: `Upload required documents: ${missingDocuments.join(', ')}`, missingDocuments });
  const values = Object.entries(form || {}).flatMap(([group, obj]) => typeof obj === 'object' && obj ? Object.keys(obj).map(k => `${group}.${k}`) : []);
  application.formData = form; application.manuallyEnteredFields = values.filter(k => !application.fetchedFields.includes(k.split('.')[1])); application.status = 'submitted'; application.submittedAt = new Date(); application.markModified('formData');
  const external = await employmentPortalAdapter.submitApplication(application.id); application.externalSubmissionStatus = external.status; application.externalApplicationId = external.externalApplicationId; await application.save();
  await Promise.all([auditService.record({ actorId: req.user!.id, actorRole: req.user!.role, action: 'EMPLOYMENT_APPLICATION_SUBMITTED', applicationId: application.id, resource: 'application', resourceId: application.id, department: job.department, requestId: req.requestId, outcome: 'SUCCESS', metadata: { jobId: job.jobId, externalStatus: external.status } }), createNotification({ userId: req.user!.id, type: 'application', title: 'Employment application submitted', message: `${application.applicationNumber} was submitted successfully.`, applicationId: application.id })]);
  return res.json({ application, trackingId: application.applicationNumber });
});
export default router;
