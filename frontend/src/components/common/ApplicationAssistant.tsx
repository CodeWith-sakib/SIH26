import React, { useEffect, useRef, useState } from 'react';
import { Bot, ChevronDown, Send, X } from 'lucide-react';
import { employmentApi } from '../../api/employment.api';
import { profileApi } from '../../api/profile.api';
import { useAuth } from '../../context/AuthContext';

type Message = { from: 'assistant' | 'user'; text: string };

const suggestions = [
  'Which jobs match my qualification?',
  'What documents are required?',
  'What is my application status?',
  'What information was fetched?'
];

export const ApplicationAssistant: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([
    { from: 'assistant', text: 'Hello! I can help you with jobs, documents, application status, and fetched data.' }
  ]);

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, open]);

  if (!isAuthenticated) return null;

  const answer = async (question: string) => {
    const normalized = question.toLowerCase();
    setMessages(current => [...current, { from: 'user', text: question }]);
    setInput('');
    setLoading(true);
    try {
      let text = 'I can help with jobs, documents, application status, or fetched information. Please choose one of those options.';
      if (normalized.includes('job') || normalized.includes('qualification')) {
        const [jobs, profile] = await Promise.all([employmentApi.jobs(), profileApi.get()]);
        const profileName = profile.profile.name;
        const matches = jobs.filter(job => job.qualification || job.eligibility.length);
        text = matches.length
          ? `I found ${matches.length} opportunities for ${profileName} that may be a match: ${matches.map(job => job.title).join(', ')}. Review the eligibility details before applying.`
          : 'No active opportunities are available right now.';
      } else if (normalized.includes('document')) {
        const jobs = await employmentApi.jobs();
        const documents = [...new Set(jobs.flatMap(job => job.requiredDocuments.map(document => document.name)))];
        text = documents.length ? `Common documents requested by current jobs are: ${documents.join(', ')}.` : 'No document requirements are available yet.';
      } else if (normalized.includes('status') || normalized.includes('application')) {
        const applications = await employmentApi.applications();
        text = applications.length
          ? `You have ${applications.length} employment application${applications.length === 1 ? '' : 's'}. ${applications.slice(0, 3).map(application => `${application.position}: ${application.status.replace(/_/g, ' ')}`).join('; ')}.`
          : 'You do not have any employment applications yet.';
      } else if (normalized.includes('fetch') || normalized.includes('information') || normalized.includes('data')) {
        const applications = await employmentApi.applications();
        const fetched = applications.reduce((total, application) => total + (application.fetchedFields?.length || 0), 0);
        text = fetched ? `Your applications contain ${fetched} fetched field${fetched === 1 ? '' : 's'} from consented profile or department data.` : 'No consented data has been fetched yet. Start a job application and approve the data-fetch consent.';
      }
      setMessages(current => [...current, { from: 'assistant', text }]);
    } catch {
      setMessages(current => [...current, { from: 'assistant', text: 'I could not load that information right now. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-24 right-4 z-40 sm:right-6">
      {open && (
        <div className="mb-3 flex h-[min(34rem,calc(100vh-10rem))] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-gov-border bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-gov-blue px-4 py-3 text-white">
            <div><p className="font-semibold">MahaSetu Assistant</p><p className="text-[11px] text-blue-100">Prototype service helper</p></div>
            <button onClick={() => setOpen(false)} aria-label="Close assistant"><X size={18} /></button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3">
            {messages.map((message, index) => <div key={`${message.from}-${index}`} className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${message.from === 'user' ? 'ml-auto bg-gov-blue text-white' : 'bg-white text-slate-700 shadow-sm'}`}>{message.text}</div>)}
            {loading && <div className="w-fit rounded-xl bg-white px-3 py-2 text-xs text-slate-500 shadow-sm">Checking your portal data…</div>}
            <div ref={messagesEndRef} aria-hidden="true" />
          </div>
          <div className="border-t bg-white p-3">
            <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">{suggestions.map(suggestion => <button key={suggestion} onClick={() => answer(suggestion)} className="shrink-0 rounded-full border border-gov-border px-2.5 py-1 text-[11px] text-gov-blue hover:bg-gov-lightblue">{suggestion}</button>)}</div>
            <form onSubmit={event => { event.preventDefault(); if (input.trim() && !loading) void answer(input.trim()); }} className="flex gap-2">
              <input value={input} onChange={event => setInput(event.target.value)} placeholder="Ask about your application…" className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm focus:border-gov-blue focus:outline-none" />
              <button disabled={!input.trim() || loading} aria-label="Send question" className="rounded-lg bg-gov-blue px-3 text-white disabled:opacity-50"><Send size={16} /></button>
            </form>
          </div>
        </div>
      )}
      <button onClick={() => setOpen(current => !current)} aria-label="Open application assistant" className="flex h-12 w-12 items-center justify-center rounded-full bg-gov-blue text-white shadow-xl transition-transform hover:scale-105">
        {open ? <ChevronDown size={22} /> : <Bot size={23} />}
      </button>
    </div>
  );
};
