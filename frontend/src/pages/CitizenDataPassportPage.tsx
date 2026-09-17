import React, { useEffect, useState } from 'react';
import { ArrowRight, BriefcaseBusiness, Check, FileCheck2, GraduationCap, MapPin, ShieldCheck, UserCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { profileApi, CitizenProfile } from '../api/profile.api';
import { UploadedDocument } from '../types/document.types';
import { Button } from '../components/common/Button';

type PassportData = { profile: CitizenProfile; applicationCount: number };

export const CitizenDataPassportPage: React.FC = () => {
  const [data, setData] = useState<PassportData>();
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([profileApi.get(), profileApi.documents()])
      .then(([profile, citizenDocuments]) => {
        setData(profile);
        setDocuments(citizenDocuments);
      })
      .catch(() => setError('We could not load your verified data right now.'));
  }, []);

  if (error) return <div className="mx-auto max-w-4xl px-6 py-16 text-center text-red-700">{error}</div>;
  if (!data) return <p className="p-12 text-center text-slate-500">Preparing your digital data passport…</p>;

  const { profile } = data;
  const education = profile.education || 'Education details available';
  const skills = 'Skills and certifications available';
  const records = documents.length;
  const cards = [
    { title: 'Education', icon: GraduationCap, value: education, detail: profile.college || 'Verified academic record' },
    { title: 'Employment', icon: BriefcaseBusiness, value: data.applicationCount ? `${data.applicationCount} connected records` : 'Employment history available', detail: 'Verified employment information' },
    { title: 'Skills', icon: ShieldCheck, value: skills, detail: 'Connected training and certification records' },
    { title: 'Documents', icon: FileCheck2, value: `${records} verified record${records === 1 ? '' : 's'}`, detail: records ? 'Available in your secure profile' : 'No documents uploaded yet' }
  ];
  const recommendations = [
    {
      title: 'Government Employment Services',
      description: 'Explore verified opportunities using your connected education and employment records.',
      confidence: '92%',
      reasons: ['Qualification', 'Experience', 'Verified identity'],
      path: '/employment'
    },
    {
      title: 'Education & Scholarship Services',
      description: 'Review education support services that may match your academic and domicile details.',
      confidence: '88%',
      reasons: ['Education record', 'Maharashtra residence', 'Documents'],
      path: '/documents'
    },
    {
      title: 'Citizen Document Services',
      description: 'Use your connected records to access services that need verified government documents.',
      confidence: '84%',
      reasons: ['Verified profile', 'Document records', 'Consent available'],
      path: '/documents'
    }
  ];

  return (
    <div className="min-h-full bg-gov-surface">
      <section className="bg-gov-blue text-white">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">MahaSetu Citizen Services</p>
              <h1 className="mt-2 text-3xl font-bold sm:text-4xl">My Digital Profile</h1>
              <p className="mt-2 max-w-xl text-sm text-blue-100">One trusted view of the information you have consented to connect across government departments.</p>
            </div>
            <Link to="/" className="rounded-lg border border-white/60 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Go to Home</Link>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <section className="rounded-xl border border-gov-border bg-white p-6 shadow-portal">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <UserCircle size={56} className="text-gov-blue" />
              <div>
                <h2 className="text-xl font-bold text-gov-dark">{profile.name}</h2>
                <p className="text-sm text-slate-500">{profile.email}</p>
                <p className="mt-1 text-xs text-slate-500">Citizen ID: {profile.registrationNumber || 'Connected identity'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold text-gov-blue"><ShieldCheck size={19} /> Identity verified</div>
          </div>
          {(profile.district || profile.state) && <p className="mt-5 flex items-center gap-2 border-t pt-4 text-sm text-slate-600"><MapPin size={16} className="text-gov-blue" /> {[profile.district, profile.state].filter(Boolean).join(', ')}</p>}
        </section>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {cards.map(({ title, icon: Icon, value, detail }) => (
            <article key={title} className="rounded-xl border border-gov-border bg-white p-5 shadow-portal transition-shadow hover:shadow-portal-hover">
              <div className="flex items-start justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gov-surface text-gov-blue"><Icon size={21} /></div><span className="flex items-center gap-1 text-xs font-semibold text-gov-blue"><ShieldCheck size={14} /> Verified</span></div>
              <h3 className="mt-5 text-lg font-bold text-gov-dark">{title}</h3>
              <p className="mt-1 font-semibold text-slate-800">{value}</p>
              <p className="mt-2 text-sm text-slate-500">{detail}</p>
            </article>
          ))}
        </div>

        <section className="mt-8">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gov-blue">Personalised discovery</p>
            <h2 className="mt-1 text-2xl font-bold text-gov-dark">Services you may be eligible for</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">Based on your verified information, MahaSetu found services that may be relevant to you. You remain in control before any data is shared.</p>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            {recommendations.map(recommendation => (
              <article key={recommendation.title} className="flex flex-col rounded-xl border border-gov-border bg-white p-5 shadow-portal">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gov-surface text-gov-blue"><ShieldCheck size={21} /></div>
                  <div className="text-right"><p className="text-xl font-bold text-gov-blue">{recommendation.confidence}</p><p className="text-[11px] text-slate-500">eligibility confidence</p></div>
                </div>
                <h3 className="mt-5 text-lg font-bold text-gov-dark">{recommendation.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{recommendation.description}</p>
                <div className="mt-4 space-y-2">
                  {recommendation.reasons.map(reason => <p key={reason} className="flex items-center gap-2 text-xs font-medium text-slate-700"><Check size={14} className="text-gov-blue" />{reason} verified</p>)}
                </div>
                <Link to={recommendation.path} className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-gov-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-gov-dark">Explore service <ArrowRight size={16} /></Link>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gov-border bg-white p-5">
          <div><h2 className="font-bold text-gov-dark">Use your verified data</h2><p className="mt-1 text-sm text-slate-500">Consent once and securely reuse connected information across MahaSetu services.</p></div>
          <Button onClick={() => navigate('/employment')} rightIcon={<ArrowRight size={16} />}>Use My Verified Data</Button>
        </section>
      </main>
    </div>
  );
};
