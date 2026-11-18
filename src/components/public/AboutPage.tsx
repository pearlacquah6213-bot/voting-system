import { Mail, MapPin, Phone } from 'lucide-react';
import { Card } from '../ui/card';
import { SafeImage } from '../ui/SafeImage';
import type { PublicBootstrap } from '../../types';

interface AboutPageProps {
  bootstrap: PublicBootstrap;
}

const COMMITTEE = [
  {
    name: 'Prof. Kwabena Nketia-Darko',
    role: 'Chair of the Jury & National Governance Board',
    org: 'University of Ghana Cultural & Civic Studies, Legon',
    photo: '/src/assets/images/nominee_david_mensah_1795035990350.jpg',
  },
  {
    name: 'Justice Beatrice Quartey (Rtd.)',
    role: 'Chief Ballot Integrity & Audit Commissioner',
    org: 'Accra Independent Electoral & Civic Trust',
    photo: '/src/assets/images/nominee_elena_rostova_1795035986530.jpg',
  },
  {
    name: 'Dr. Efua Ababio-Mensah',
    role: 'Director of Innovation & Heritage Assessments',
    org: 'KNUST Applied Design & Engineering Council, Kumasi',
    photo: '/src/assets/images/nominee_abena_mensah_1795036944590.jpg',
  },
];

const OBJECTIVES = [
  {
    num: '01.',
    title: 'Independent Merit Recognition',
    text: 'Spotlight practitioners whose structural, technological, and environmental contributions deliver measurable long-term civic benefit.',
  },
  {
    num: '02.',
    title: 'Audited Nationwide & Diaspora Voting',
    text: 'Empower Ghanaians across all 16 regions and the global diaspora to participate in category voting protected by +233 SMS or email OTP verification.',
  },
  {
    num: '03.',
    title: 'Cross-Disciplinary Benchmark',
    text: 'Bridge architecture, autonomous robotics, industrial craft, and clean energy under one transparent evaluation rubric.',
  },
  {
    num: '04.',
    title: 'Archival Open Documentation',
    text: 'Preserve annual finalist citations, jury reports, and verified voting records for academic and institutional reference.',
  },
];

export function AboutPage({ bootstrap }: AboutPageProps) {
  const { settings } = bootstrap;

  return (
    <div className="bg-white">
      <section className="bg-[#0B192C] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <p className="text-xs font-semibold tracking-widest uppercase text-[#D8B246]">
            Institutional Charter
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl font-semibold max-w-3xl [text-wrap:balance]">
            About {settings?.siteName}
          </h1>
          <p className="text-base text-slate-300 max-w-2xl leading-relaxed">
            {settings?.siteDescription}
          </p>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-16 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-10">
          <Card className="p-8 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#9F7915]">
              Our Mission
            </p>
            <h2 className="font-serif text-2xl font-semibold text-[#0B192C]">
              Elevate Enduring Excellence Through Transparent Governance
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Founded to honour creators, engineers, and civic leaders beyond short-term commercial hype, our mission is to pair rigorous peer-reviewed nomination dossiers with tamper-resistant public voting.
            </p>
          </Card>

          <Card className="p-8 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#9F7915]">
              Our Vision
            </p>
            <h2 className="font-serif text-2xl font-semibold text-[#0B192C]">
              A Global Standard for Civic Accountability & Craft
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              We envision an international public sphere where remarkable civic architecture, humane robotics, repairable products, and clean energy systems earn visible public mandate and archival permanence.
            </p>
          </Card>
        </div>
      </section>

      {/* Objectives */}
      <section className="py-16 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-serif text-3xl font-semibold text-[#0B192C] mb-10">
            Awards Objectives
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {OBJECTIVES.map((obj) => (
              <div key={obj.num} className="rounded-lg border border-slate-200 bg-white p-6 space-y-2.5">
                <span className="font-mono text-sm font-semibold text-[#9F7915]">{obj.num}</span>
                <h3 className="font-serif text-lg font-semibold text-[#0B192C]">{obj.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{obj.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Organising Committee */}
      <section className="py-16 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-serif text-3xl font-semibold text-[#0B192C] mb-10">
            Organising Committee
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {COMMITTEE.map((member) => (
              <Card key={member.name} className="overflow-hidden">
                <div className="aspect-[3/4] max-h-72 overflow-hidden bg-slate-900">
                  <SafeImage
                    src={member.photo}
                    alt={member.name}
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <div className="p-6 space-y-1">
                  <h3 className="font-serif text-xl font-semibold text-[#0B192C]">
                    {member.name}
                  </h3>
                  <p className="text-sm font-medium text-[#9F7915]">{member.role}</p>
                  <p className="text-xs text-slate-500">{member.org}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Summary */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="p-8 bg-[#0B192C] text-white border-[#1E3A5F]">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-[#C59B27] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-400">Secretariat Email</p>
                  <p className="text-sm font-medium mt-1">{settings?.contactEmail}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-[#C59B27] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-400">Telephone</p>
                  <p className="text-sm font-medium mt-1">{settings?.contactPhone}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-[#C59B27] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-400">Headquarters</p>
                  <p className="text-sm font-medium mt-1">{settings?.contactAddress}</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
