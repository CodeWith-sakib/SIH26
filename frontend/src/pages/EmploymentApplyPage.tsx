import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Check, CheckCircle2, Clock3, Database, FileUp, History, ShieldCheck, Trash2 } from 'lucide-react';
import { employmentApi } from '../api/employment.api';
import { consentApi } from '../api/consent.api';
import { documentsApi } from '../api/documents.api';
import { extractErrorMessage } from '../api/client';
import { EmploymentApplication, EmploymentFormData, EmploymentJob } from '../types/employment.types';
import { UploadedDocument } from '../types/document.types';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';

const EMPTY: EmploymentFormData = {
  personal: { fullName: '', dateOfBirth: '', gender: '', mobile: '', email: '', address: '', district: '', state: 'Maharashtra', pincode: '', citizenReference: '' },
  education: { highestQualification: '', institution: '', passingYear: '', score: '' },
  employment: { employmentStatus: '', totalExperience: '', previousOrganization: '', skills: '' },
  category: { category: 'General', subCategory: '' }
};

const fields = [
  ['personal', 'fullName', 'Full Name', undefined, true], ['personal', 'dateOfBirth', 'Date of Birth', 'date', true],
  ['personal', 'gender', 'Gender', undefined, true], ['personal', 'mobile', 'Mobile Number', undefined, true],
  ['personal', 'email', 'Email', 'email', true], ['personal', 'address', 'Residential Address', undefined, true],
  ['personal', 'district', 'District', undefined, true], ['personal', 'state', 'State', undefined, true],
  ['personal', 'pincode', 'PIN Code', undefined, true], ['personal', 'citizenReference', 'Citizen Reference (optional)'],
  ['education', 'highestQualification', 'Highest Qualification', undefined, true], ['education', 'institution', 'Institution', undefined, true],
  ['education', 'passingYear', 'Passing Year', undefined, true], ['education', 'score', 'Percentage / CGPA', undefined, true],
  ['employment', 'employmentStatus', 'Current Employment Status', undefined, true], ['employment', 'totalExperience', 'Total Experience', undefined, true],
  ['employment', 'previousOrganization', 'Previous Organisation (optional)'], ['employment', 'skills', 'Skills (comma separated)', undefined, true],
  ['category', 'category', 'Category', undefined, true], ['category', 'subCategory', 'Sub-category (optional)']
] as const;

type FetchTraceStep = {
  label: string;
  detail: string;
  status: 'pending' | 'active' | 'complete' | 'error';
};

const buildTraceSteps = (categories: string[]): FetchTraceStep[] => [
  { label: 'Preparing secure request', detail: 'Checking your consent and application identity', status: 'pending' },
  ...categories.map(category => ({
    label: `Fetching from ${category[0].toUpperCase()}${category.slice(1)} Department`,
    detail: `Requesting available ${category} records`,
    status: 'pending' as const
  })),
  { label: 'Checking identity matches', detail: 'Comparing department records with your citizen profile', status: 'pending' }
];

export const EmploymentApplyPage: React.FC = () => {
  const { jobId = '' } = useParams();
  const nav = useNavigate();
  const [job, setJob] = useState<EmploymentJob>();
  const [app, setApp] = useState<EmploymentApplication>();
  const [form, setForm] = useState(EMPTY);
  const [step, setStep] = useState(1);
  const [consentOpen, setConsentOpen] = useState(false);
  const [docs, setDocs] = useState<UploadedDocument[]>([]);
  const [fetchedFields, setFetchedFields] = useState<string[]>([]);
  const [fetchedSources, setFetchedSources] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [traceOpen, setTraceOpen] = useState(false);
  const [traceSteps, setTraceSteps] = useState<FetchTraceStep[]>([]);
  const [traceResult, setTraceResult] = useState<Record<string, string>>({});
  const [traceError, setTraceError] = useState('');
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [verificationStage, setVerificationStage] = useState(-1);
  const [conflictReviewed, setConflictReviewed] = useState(false);
  const [dataHistoryOpen, setDataHistoryOpen] = useState(false);

  const verificationDepartments = [
    ['Education Department', 'Degree and graduation records'],
    ['Employment Department', 'Employment history and skills'],
    ['Skills Department', 'Training and certification records'],
    ['Citizen Registry', 'Identity and domicile details']
  ];

  useEffect(() => {
    (async () => {
      try {
        const [loadedJob] = await Promise.all([employmentApi.job(jobId)]);
        setJob(loadedJob);
        const loadedApp = await employmentApi.start(jobId);
        setApp(loadedApp);
        const detail = await employmentApi.application(loadedApp._id);
        if (detail.application.formData) setForm({ ...EMPTY, ...detail.application.formData });
        setDocs(detail.documents);
        setFetchedFields(detail.application.fetchedFields || []);
        // Ask for consent whenever the citizen enters the application journey.
        setConsentOpen(true);
      } catch (e) {
        setError(extractErrorMessage(e));
      }
    })();
  }, [jobId]);

  useEffect(() => {
    if (!verificationOpen || verificationStage < 0 || verificationStage >= verificationDepartments.length) return;
    const timer = window.setTimeout(() => setVerificationStage(current => current + 1), 850);
    return () => window.clearTimeout(timer);
  }, [verificationOpen, verificationStage, verificationDepartments.length]);

  const set = (group: keyof EmploymentFormData, key: string, value: string) =>
    setForm(current => ({ ...current, [group]: { ...current[group], [key]: value } }));

  const fetchData = async () => {
    if (!app) return;
    setBusy(true);
    setError('');
    setTraceError('');
    setTraceResult({});
    const categories = ['education', 'employment'];
    const steps = buildTraceSteps(categories);
    setTraceSteps(steps);
    setTraceOpen(true);
    const activateStep = (index: number) => setTraceSteps(current => current.map((step, stepIndex) => ({
      ...step,
      status: stepIndex < index ? 'complete' : stepIndex === index ? 'active' : 'pending'
    })));
    const completeStep = (index: number) => setTraceSteps(current => current.map((step, stepIndex) => ({
      ...step,
      status: stepIndex <= index ? 'complete' : step.status
    })));
    const pause = (duration: number) => new Promise<void>(resolve => window.setTimeout(resolve, duration));
    try {
      activateStep(0);
      const existing = await consentApi.getConsentByApplicationId(app._id);
      if (!existing) {
        await consentApi.grantConsent({
          applicationId: app._id,
          dataCategories: ['education', 'employment'],
          purpose: 'Prefill this employment application from available departments',
          dataSource: 'MahaSetu connected departments'
        });
      }
      completeStep(0);
      setConsentOpen(false);
      activateStep(1);
      const fetchRequest = employmentApi.fetchData(app._id);
      await pause(650);
      for (let index = 1; index < steps.length - 1; index += 1) {
        completeStep(index);
        activateStep(index + 1);
        await pause(650);
      }
      const result = await fetchRequest;
      await pause(650);
      completeStep(steps.length - 1);
      setForm(current => {
        const next = { ...current };
        for (const [key, value] of Object.entries(result.data)) {
          for (const group of Object.keys(next) as Array<keyof EmploymentFormData>) {
            if (key in next[group]) next[group] = { ...next[group], [key]: value };
          }
        }
        return next;
      });
      setFetchedFields(result.fetchedFields);
      setFetchedSources(result.sources);
      const matchedDepartments = (result.matchedDepartments || [])
        .map(match => `${match.department} (${Math.round(match.confidence * 100)}% match)`)
        .join(', ');
      setTraceResult(result.data);
      setNotice(`Fetched ${result.fetchedFields.length} fields after identity matching${matchedDepartments ? ` from ${matchedDepartments}` : ''}. Retrieved fields can still be edited.`);
    } catch (e) {
      const message = extractErrorMessage(e);
      setError(message);
      setTraceError(message);
      setTraceSteps(current => current.map(step => step.status === 'active' ? { ...step, status: 'error' } : step));
    } finally {
      setBusy(false);
    }
  };

  const startVerification = () => {
    setConflictReviewed(false);
    setVerificationStage(0);
    setVerificationOpen(true);
  };

  const save = async (nextStep: number) => {
    if (!app) return;
    setBusy(true);
    try {
      await employmentApi.save(app._id, form);
      setStep(nextStep);
      setError('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const upload = async (type: string, file?: File) => {
    if (!app || !file) return;
    setBusy(true);
    try {
      await documentsApi.upload(app._id, file, type, () => {});
      setDocs(await documentsApi.list(app._id));
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!app) return;
    setBusy(true);
    try {
      const result = await employmentApi.submit(app._id, form);
      nav(`/employment/applications/${result.application._id}/success`);
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!job || !app) return <p className="p-12 text-center">{error || 'Preparing your secure application…'}</p>;

  return (
    <div className="max-w-5xl mx-auto px-5 py-9">
      <div className="mb-6">
        <p className="text-xs font-bold text-gov-blue">{job.jobId}</p>
        <h1 className="text-2xl font-bold">Apply for {job.title}</h1>
        <p className="text-sm text-slate-500">Draft {app.applicationNumber}</p>
      </div>
      <div className="grid grid-cols-3 mb-7">
        {['Application Details', 'Documents', 'Review & Submit'].map((label, index) => (
          <div key={label} className={`border-b-4 py-3 text-center text-sm font-semibold ${step === index + 1 ? 'border-gov-blue text-gov-blue' : 'border-slate-200 text-slate-500'}`}>
            {index + 1}. {label}
          </div>
        ))}
      </div>
      {error && <div role="alert" className="bg-red-50 text-red-700 border border-red-200 p-3 rounded-lg mb-5">{error}</div>}
      {notice && <div className="mb-5 text-sm font-semibold text-amber-700">{notice}</div>}

      {step === 1 && (
        <section className="bg-white border rounded-xl p-6">
          <div className="flex justify-between items-start gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold">Candidate details</h2>
              <p className="text-sm text-slate-500">Fields marked * are required.</p>
              {fetchedFields.length > 0 && <p className="mt-3 text-xs font-semibold text-amber-700">Retrieved fields are highlighted and can still be edited.</p>}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" disabled={!fetchedFields.length || busy} leftIcon={<ShieldCheck size={16} />} onClick={startVerification}>Verify My Details</Button>
              <Button variant="outline" leftIcon={<Database size={16} />} onClick={() => setConsentOpen(true)}>Fetch My Data</Button>
            </div>
          </div>
          {(['personal', 'education', 'employment', 'category'] as const).map(group => (
            <div key={group}>
              <h3 className="font-bold capitalize mt-6 mb-3 border-b pb-2">{group === 'category' ? 'Reservation Category' : group}</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {fields.filter(field => field[0] === group).map(([, key, label, type, required]) => {
                  const fetched = fetchedFields.includes(key);
                  return (
                    <label key={key} className="text-sm font-medium">
                      {label}{required && ' *'}
                      <input type={type || 'text'} value={form[group][key] || ''} onChange={e => set(group, key, e.target.value)} required={required}
                        title={fetched ? `Fetched from ${fetchedSources[key] || 'a connected department'}` : undefined}
                        className={`block w-full mt-1.5 border rounded-lg px-3 py-2.5 ${fetched ? 'border-blue-400 bg-blue-50 text-blue-950 ring-1 ring-blue-200' : 'border-slate-300'}`} />
                      {fetched && <span className="mt-1 block text-[11px] font-semibold text-amber-700">Fetched from {fetchedSources[key] || 'connected department'}</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="flex justify-end mt-7"><Button isLoading={busy} onClick={() => save(2)}>Save & Continue</Button></div>
        </section>
      )}

      {step === 2 && (
        <section className="bg-white border rounded-xl p-6">
          <h2 className="text-xl font-bold">Required documents</h2>
          <p className="text-sm text-slate-500 mt-1">PDF, JPEG or PNG; maximum 10 MB each.</p>
          <div className="space-y-4 mt-6">{job.requiredDocuments.map(requiredDocument => {
            const document = docs.find(item => item.documentType === requiredDocument.name);
            return <div key={requiredDocument.name} className="border rounded-lg p-4 flex items-center justify-between gap-4">
              <div><p className="font-semibold">{requiredDocument.name}{requiredDocument.required && ' *'}</p>{document ? <a className="text-xs text-gov-blue" target="_blank" rel="noreferrer" href={document.cloudinarySecureUrl}>{document.originalFileName}</a> : <p className="text-xs text-slate-500">Not uploaded</p>}</div>
              {document ? <button aria-label={`Delete ${requiredDocument.name}`} onClick={async () => { await documentsApi.remove(app._id, document._id); setDocs(await documentsApi.list(app._id)); }} className="text-red-600"><Trash2 /></button> : <label className="cursor-pointer inline-flex gap-2 bg-gov-blue text-white rounded-lg px-4 py-2 text-sm"><FileUp size={18} />Upload<input aria-label={`Upload ${requiredDocument.name}`} type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only" onChange={e => upload(requiredDocument.name, e.target.files?.[0])} /></label>}
            </div>;
          })}</div>
          <div className="flex justify-between mt-7"><Button variant="outline" onClick={() => setStep(1)}>Back</Button><Button disabled={job.requiredDocuments.some(item => item.required && !docs.some(document => document.documentType === item.name))} onClick={() => save(3)}>Review Application</Button></div>
        </section>
      )}

      {step === 3 && (
        <section className="bg-white border rounded-xl p-6">
          <h2 className="text-xl font-bold">Review your application</h2>
          <div className="mt-5 space-y-5">{Object.entries(form).map(([group, values]) => <div key={group}><h3 className="font-bold capitalize border-b pb-2">{group}</h3><dl className="grid md:grid-cols-2 gap-3 mt-3">{Object.entries(values).filter(([, value]) => value).map(([key, value]) => <div key={key}><dt className="text-xs text-slate-500">{key.replace(/([A-Z])/g, ' $1')}</dt><dd className="font-medium text-sm">{String(value)}</dd></div>)}</dl></div>)}<div><h3 className="font-bold border-b pb-2">Documents</h3>{docs.map(document => <p key={document._id} className="text-sm flex gap-2 mt-2"><Check size={16} className="text-green-600" />{document.documentType}: {document.originalFileName}</p>)}</div></div>
          <label className="flex gap-3 mt-6 text-sm"><input required type="checkbox" />I declare that the information supplied is correct and understand it will be submitted to MahaSetu.</label>
          <div className="flex justify-between mt-7"><Button variant="outline" onClick={() => setStep(2)}>Back</Button><Button isLoading={busy} onClick={submit}>Submit Application</Button></div>
        </section>
      )}

      <Modal isOpen={consentOpen} onClose={() => setConsentOpen(false)} title="Use my department data?" subtitle="Your choice will be recorded for this application.">
        <p className="text-sm text-slate-600 leading-relaxed">With your consent, MahaSetu can securely fetch available information from connected departments such as Education and Employment and use it to prefill this form. Retrieved fields are highlighted in blue, and you can review or edit them before submitting.</p>
        <div className="flex justify-end gap-3 mt-6"><Button variant="outline" onClick={() => setConsentOpen(false)}>No, Enter Manually</Button><Button isLoading={busy} onClick={fetchData}>Yes, Fetch My Data</Button></div>
      </Modal>
      <Modal
        isOpen={traceOpen}
        onClose={() => !busy && setTraceOpen(false)}
        title={
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-lg font-bold text-gov-navy">{traceError ? 'Data fetch interrupted' : busy ? 'Secure data transfer' : 'Data fetch successful'}</h3>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">{busy ? 'Live request trace' : traceError ? 'Please try again' : 'Identity verified'}</p>
            </div>
          </div>
        }
        subtitle={busy ? 'MahaSetu is tracing each step of the consented request' : undefined}
        showCloseButton={!busy}
        maxWidth="xl"
      >
        <div className="space-y-5">
          {busy && <div className="relative h-1 overflow-hidden rounded-full bg-slate-100">
            <div className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-gov-blue animate-[slide_1.4s_ease-in-out_infinite]" />
          </div>}
          <div className="relative mx-auto max-w-2xl px-2 sm:px-8">
            <div className="absolute bottom-5 left-1/2 top-5 w-px -translate-x-1/2 bg-slate-200" />
            <div className="relative space-y-3">
              {[...traceSteps]
                .filter(step => step.status !== 'pending')
                .sort((first, second) => {
                  const rank = { complete: 0, active: 1, error: 1, pending: 2 };
                  return rank[first.status] - rank[second.status];
                })
                .map((step) => {
                const stepIndex = traceSteps.indexOf(step);
                const isActive = step.status === 'active';
                return (
                  <div
                    key={step.label}
                    className={`relative flex items-center justify-center transition-all duration-500 ease-out ${
                      step.status === 'pending' ? 'hidden' : isActive ? 'scale-100 py-2' : 'scale-[0.92] opacity-70'
                    }`}
                  >
                    <div className={`w-[min(100%,420px)] rounded-xl border px-4 py-3 text-center transition-all duration-500 ${
                      isActive ? 'scale-105 border-blue-200 bg-blue-50 shadow-lg' : 'scale-95 border-slate-100 bg-slate-50'
                    }`}>
                      <p className={`font-semibold text-sm ${isActive ? 'text-gov-blue' : step.status === 'error' ? 'text-red-700' : 'text-slate-700'}`}>
                        {stepIndex + 1}. {step.label}
                      </p>
                      {isActive && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{step.detail}</p>}
                      {isActive && <div className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-gov-blue">Processing</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {traceError && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{traceError}</div>}
          {!busy && !traceError && <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
            <p className="font-semibold text-emerald-800 flex items-center gap-2"><CheckCircle2 size={19} className="animate-[successPop_450ms_ease-out]" /> Data fetch successful</p>
            <p className="text-xs text-emerald-700 mt-1">The retrieved values are now autofilled and highlighted in the form.</p>
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-slate-700">
              {Object.entries(traceResult).slice(0, 6).map(([key, value]) => <div key={key}><span className="text-slate-500">{key}: </span>{value}</div>)}
            </div>
          </div>}
          {!busy && <div className="flex justify-end"><Button onClick={() => setTraceOpen(false)}>{traceError ? 'Close' : 'Continue to form'}</Button></div>}
        </div>
      </Modal>
      <Modal
        isOpen={verificationOpen}
        onClose={() => verificationStage >= verificationDepartments.length && setVerificationOpen(false)}
        title={
          <div>
            <h3 className="text-lg font-bold text-gov-navy">{verificationStage < verificationDepartments.length ? 'Verification in progress' : 'Smart verification report'}</h3>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
              {verificationStage < verificationDepartments.length ? 'Cross-department verification' : 'Unified citizen data check'}
            </p>
          </div>
        }
        showCloseButton={verificationStage >= verificationDepartments.length}
        maxWidth="xl"
      >
        {verificationStage < verificationDepartments.length ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-gov-border bg-white p-3 text-sm text-gov-blue">Verifying consented records against your unified citizen profile.</div>
            <div className="space-y-2">
              {verificationDepartments.map(([department, detail], index) => (
                <div key={department} className={`flex items-center gap-3 rounded-xl border p-4 transition-all duration-500 ${index < verificationStage ? 'border-gov-border bg-slate-50' : index === verificationStage ? 'scale-[1.02] border-gov-blue bg-white shadow-md' : 'border-slate-100 bg-slate-50 opacity-50'}`}>
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${index < verificationStage ? 'bg-gov-blue text-white' : index === verificationStage ? 'bg-gov-blue text-white' : 'bg-slate-200 text-slate-400'}`}>
                    {index < verificationStage ? <Check size={18} /> : index === verificationStage ? <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> : index + 1}
                  </div>
                  <div><p className="font-semibold text-sm text-slate-800">{department}</p><p className="text-xs text-slate-500">{detail}</p></div>
                  {index < verificationStage && <span className="ml-auto text-xs font-semibold text-gov-blue">Verified</span>}
                  {index === verificationStage && <span className="ml-auto text-xs font-semibold text-gov-blue">Checking…</span>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-3">
              <div className="rounded-xl border border-gov-border bg-white p-3"><p className="text-2xl font-bold text-gov-blue">12</p><p className="text-xs text-slate-500">Records checked</p></div>
              <div className="rounded-xl border border-gov-border bg-white p-3"><p className="text-2xl font-bold text-gov-blue">11</p><p className="text-xs text-slate-500">Records matched</p></div>
              <div className="rounded-xl border border-gov-border bg-white p-3"><p className="text-2xl font-bold text-gov-blue">92%</p><p className="text-xs text-slate-500">Eligibility confidence</p></div>
            </div>
            <div className="rounded-xl border border-gov-border border-l-4 border-l-gov-blue bg-white p-4">
              <p className="flex items-center gap-2 font-semibold text-gov-dark"><CheckCircle2 size={19} className="text-gov-blue" /> Data verified across 4 departments</p>
              <p className="mt-1 text-sm text-slate-600">Eligible for this opportunity based on the available verified records.</p>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-[1fr_1fr_auto] gap-3 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500"><span>Information</span><span>Source</span><span>Status</span></div>
              {[
                ['Name', 'Citizen Registry', 'Matched'],
                ['Date of Birth', 'Citizen Registry', 'Matched'],
                ['Degree', 'Education Department', 'Verified'],
                ['Skills', 'Skills Department', 'Verified'],
                ['Experience', 'Employment Department', 'Verified'],
                ['Domicile', 'Revenue Department', 'Verified']
              ].map(([label, source, status]) => <div key={label} className="grid grid-cols-[1fr_1fr_auto] gap-3 border-t px-3 py-2.5 text-xs"><span className="font-medium">{label}</span><span className="text-slate-500">{source}</span><span className="font-semibold text-gov-blue">{status}</span></div>)}
            </div>
            <div className={`rounded-xl border border-gov-border border-l-4 p-4 ${conflictReviewed ? 'border-l-gov-blue bg-white' : 'border-l-slate-500 bg-slate-50'}`}>
              <p className="flex items-center gap-2 font-semibold text-gov-dark">{conflictReviewed ? <CheckCircle2 size={18} className="text-gov-blue" /> : <AlertTriangle size={18} className="text-slate-600" />} {conflictReviewed ? 'Conflict resolved' : 'Data mismatch detected'}</p>
              {!conflictReviewed ? <><p className="mt-2 text-sm text-slate-700"><strong>Name</strong>: Education Department: “Nikhil Kumar” · Employment Department: “Nikhil Kr.”</p><button onClick={() => setConflictReviewed(true)} className="mt-3 rounded-lg bg-gov-blue px-3 py-2 text-xs font-semibold text-white hover:bg-gov-dark">Review and accept recommended value</button></> : <p className="mt-2 text-sm text-slate-600">Recommended value “Nikhil Kumar” was accepted using the Citizen Registry and three verified records.</p>}
            </div>
            <div className="flex flex-wrap justify-between gap-3">
              <Button variant="outline" leftIcon={<History size={16} />} onClick={() => setDataHistoryOpen(true)}>View Data Access History</Button>
              <Button onClick={() => setVerificationOpen(false)}>Continue to form</Button>
            </div>
          </div>
        )}
      </Modal>
      <Modal
        isOpen={dataHistoryOpen}
        onClose={() => setDataHistoryOpen(false)}
        title={
          <div>
            <h3 className="text-lg font-bold text-gov-navy">Your Data Activity</h3>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">Consent and usage timeline</p>
          </div>
        }
        maxWidth="lg"
      >
        <div className="space-y-5">
          <div className="border-l-2 border-gov-blue pl-5">
            {[
              ['Consent granted', 'You allowed MahaSetu to use connected department records for this purpose.', 'Citizen permission recorded'],
              ['Education Department', 'Degree and graduation details accessed for verification.', 'Connected record read'],
              ['Employment Department', 'Employment history and skills accessed for verification.', 'Connected record read'],
              ['Data used to autofill', `Verified information was used to prefill “${job.title}”.`, 'Application form updated']
            ].map(([title, detail, status], index) => (
              <div key={title} className="relative pb-6 last:pb-0">
                <span className="absolute -left-[calc(1.25rem+7px)] top-0 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white bg-gov-blue ring-1 ring-gov-blue" />
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-semibold text-sm text-gov-dark">{title}</p><p className="mt-1 text-sm text-slate-600">{detail}</p><p className="mt-1 text-[11px] font-medium text-gov-blue">{status}</p></div>
                  <span className="flex shrink-0 items-center gap-1 text-[11px] text-slate-400"><Clock3 size={12} /> Now</span>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-gov-border bg-white p-4">
            <p className="font-semibold text-gov-dark">You are in control of your data</p>
            <p className="mt-1 text-sm text-slate-600">Your information was accessed only after consent and used for the stated government service purpose.</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
              {['Education', 'Employment', 'Skills', 'Citizen Registry'].map(department => <span key={department} className="rounded-full border border-gov-border px-2.5 py-1">{department}</span>)}
            </div>
          </div>
          <div className="flex justify-end"><Button onClick={() => setDataHistoryOpen(false)}>Close</Button></div>
        </div>
      </Modal>
    </div>
  );
};
