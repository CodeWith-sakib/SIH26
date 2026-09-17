import React from 'react';
import { Layers, Cpu, ShieldCheck, Clock } from 'lucide-react';

interface BenefitCardData {
  id: string;
  title: string;
  tag: string;
  description: string;
  icon: React.ReactNode;
}

const BENEFITS_DATA: BenefitCardData[] = [
  {
    id: 'b-1',
    title: 'All Government Services in One Place',
    tag: 'Unified Discovery',
    description: 'Access state department services, apply online, and manage all your citizen applications through a single digital platform without visiting multiple portals.',
    icon: <Layers className="w-7 h-7 text-gov-blue" />
  },
  {
    id: 'b-2',
    title: 'Cross-Department Verification',
    tag: 'Connected Records',
    description: 'Connected departments can check education, employment, and certificate records with your permission.',
    icon: <Cpu className="w-7 h-7 text-gov-blue" />
  },
  {
    id: 'b-3',
    title: 'Citizen Consent First',
    tag: 'Your Permission Matters',
    description: 'Review and authorise the records needed for verification. Manage consent for your applications from your account.',
    icon: <ShieldCheck className="w-7 h-7 text-gov-blue" />
  },
  {
    id: 'b-4',
    title: 'Track Your Application',
    tag: 'Application Updates',
    description: 'Follow application progress, review verification updates, and see when further information is needed.',
    icon: <Clock className="w-7 h-7 text-gov-blue" />
  }
];

export const BenefitsSection: React.FC = () => {
  return (
    <section className="py-14 sm:py-20 bg-gov-blue text-white" aria-labelledby="benefits-heading">
      <div className="max-w-portal mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-5xl mx-auto mb-10 text-center">
          <h2 id="benefits-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Benefits of MahaSetu
          </h2>
          <p className="text-sm sm:text-base text-blue-100 mt-2.5 leading-relaxed">
            MahaSetu brings Maharashtra Government services together through a unified digital platform, enabling citizens to apply once and access secure cross-department services with seamless verification.
          </p>
        </div>

        {/* 2 x 2 Static White Cards Grid (Desktop: 2 columns, Mobile: 1 column) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {BENEFITS_DATA.map((card) => (
            <div
              key={card.id}
              className="bg-white text-gov-textPrimary rounded-2xl p-6 sm:p-7 shadow-portal border border-gov-border hover:shadow-portal-hover transition-shadow duration-200 flex flex-col justify-between text-center"
            >
              <div className="flex flex-col items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gov-lightblue flex items-center justify-center flex-shrink-0">
                  {card.icon}
                </div>

                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center justify-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gov-lightblue text-gov-blue">
                      {card.tag}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-gov-blue leading-snug">
                    {card.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-gov-textSecondary leading-relaxed pt-1">
                    {card.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
