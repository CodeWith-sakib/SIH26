import EmploymentJob from '../../../shared/models/EmploymentJob.js';

export const DEMO_EMPLOYMENT_JOBS = [
  { jobId: 'MH-EMP-2026-001', title: 'Junior Administrative Assistant', organization: 'Government of Maharashtra', department: 'Skill Development, Employment & Entrepreneurship', location: 'Mumbai, Maharashtra', district: 'Mumbai', employmentType: 'Full Time', category: 'Government', qualification: "Bachelor's degree", experience: '0–2 years', salary: '₹25,500–81,100', description: 'Support citizen service administration, records and departmental coordination.', responsibilities: ['Maintain service records', 'Coordinate citizen requests', 'Prepare administrative reports'], eligibility: ['Maharashtra domicile', "Bachelor's degree from a recognised university", 'Age 18–38 years'], deadline: new Date('2027-03-31'), requiredDocuments: [{ name: 'Identity Proof', required: true }, { name: 'Education Certificate', required: true }], source: 'DEMO', active: true },
  { jobId: 'MH-EMP-2026-002', title: 'District Skill Coordinator', organization: 'Maharashtra State Skill Development Society', department: 'Skill Development, Employment & Entrepreneurship', location: 'Pune, Maharashtra', district: 'Pune', employmentType: 'Contract', category: 'Skills', qualification: "Bachelor's degree", experience: '2+ years', salary: '₹42,000 per month', description: 'Coordinate skill programmes and employer partnerships at district level.', responsibilities: ['Monitor training centres', 'Coordinate placement drives'], eligibility: ['Graduate in any discipline', 'Two years relevant experience'], deadline: new Date('2027-04-15'), requiredDocuments: [{ name: 'Identity Proof', required: true }, { name: 'Experience Certificate', required: true }], source: 'DEMO', active: true },
  { jobId: 'MH-EMP-2026-003', title: 'Apprentice – Digital Services', organization: 'Directorate of Vocational Education and Training', department: 'Skill Development, Employment & Entrepreneurship', location: 'Nagpur, Maharashtra', district: 'Nagpur', employmentType: 'Apprenticeship', category: 'Apprenticeship', qualification: 'Diploma or ITI', experience: 'Fresher', salary: '₹12,000 stipend', description: 'Assist digital citizen service teams while completing supervised workplace training.', responsibilities: ['Support portal operations', 'Assist citizens at facilitation centres'], eligibility: ['Diploma or ITI certificate', 'Age 18–30 years'], deadline: new Date('2027-05-01'), requiredDocuments: [{ name: 'Identity Proof', required: true }, { name: 'Qualification Certificate', required: true }], source: 'DEMO', active: true }
] as const;

export type ExternalSubmissionStatus = 'NOT_CONFIGURED' | 'PENDING_EXTERNAL_SYNC' | 'EXTERNAL_SYNCED' | 'EXTERNAL_SYNC_FAILED';

export interface EmploymentPortalAdapter {
  submitApplication(applicationId: string): Promise<{ status: ExternalSubmissionStatus; externalApplicationId?: string }>;
}

class NotConfiguredEmploymentPortalAdapter implements EmploymentPortalAdapter {
  async submitApplication(_applicationId: string) { return { status: 'NOT_CONFIGURED' as const }; }
}

export const employmentPortalAdapter: EmploymentPortalAdapter = new NotConfiguredEmploymentPortalAdapter();

export class EmploymentService {
  private seeded = false;

  async ensureSeeded(): Promise<void> {
    if (!this.seeded) {
      await Promise.all(DEMO_EMPLOYMENT_JOBS.map(job => EmploymentJob.updateOne({ jobId: job.jobId }, { $set: job }, { upsert: true })));
      this.seeded = true;
    }
  }

  generateApplicationNumber(): string {
    return `EMP-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  }

  cleanData(value: unknown): unknown {
    if (typeof value === 'string') return value.trim().slice(0, 500);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, this.cleanData(v)]));
    }
    return undefined;
  }
}
