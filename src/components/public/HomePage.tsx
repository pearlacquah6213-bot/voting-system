import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { SafeImage } from '../ui/SafeImage';
import type { Announcement, PublicBootstrap } from '../../types';
import { formatDate } from '../../lib/utils';
import type { PublicRoute } from './PublicLayout';

interface HomePageProps {
  bootstrap: PublicBootstrap;
  onNavigate: (route: PublicRoute) => void;
}

function useCountdown(targetDate?: string) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, ended: false });

  useEffect(() => {
    if (!targetDate) return;
    const calc = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, ended: true });
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
        ended: false,
      });
    };
    calc();
    const timer = setInterval(calc, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  return timeLeft;
}

export function HomePage({ bootstrap, onNavigate }: HomePageProps) {
  const { activeAward, categories, nominees, sponsors, announcements, settings } = bootstrap;
  const countdown = useCountdown(activeAward?.votingEndsAt);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  const categoryNameMap = new Map(categories.map((c) => [c.id, c.name]));

  const howToVoteSteps = [
    {
      num: '01.',
      title: 'Select an Award Category',
      body: 'Browse published categories and review official judging criteria before entering the ballot.',
    },
    {
      num: '02.',
      title: 'Choose Your Nominee',
      body: 'Examine candidate biographies, documented citations, and public impact records.',
    },
    {
      num: '03.',
      title: 'Verify Identity via OTP',
      body: 'Complete the anti-automation challenge and confirm your 6-digit verification code.',
    },
    {
      num: '04.',
      title: 'Receive Immutable Receipt',
      body: 'Your single-category ballot is recorded atomically with a unique verification receipt.',
    },
  ];

  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-[#06101D] text-white overflow-hidden">
        <div className="absolute inset-0">
          <SafeImage
            src={activeAward?.bannerUrl || '/src/assets/images/hero_ghana_gala_1795036943453.jpg'}
            alt={activeAward?.title || 'Ghana Awards Ceremony Hall'}
            className="w-full h-full object-cover opacity-50"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#06101D]/95 via-[#0B192C]/85 to-[#06101D]/65" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
            <div className="lg:col-span-7 space-y-6">
              <p className="text-xs font-medium tracking-widest uppercase text-[#D8B246]">
                {activeAward ? `${activeAward.editionYear} Ghana Edition · Official Public Ballot` : 'Annual Ghana Honours'}
              </p>
              <h1 className="font-serif text-4xl sm:text-5xl lg:text-[56px] font-semibold leading-[1.1] tracking-tight [text-wrap:balance]">
                {activeAward?.title || settings?.siteName}
              </h1>
              <p className="text-base sm:text-lg text-slate-200 leading-relaxed max-w-2xl">
                {activeAward?.description || settings?.siteDescription}
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Button
                  size="lg"
                  variant="gold"
                  onClick={() => onNavigate({ page: 'vote' })}
                >
                  Vote Now
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => onNavigate({ page: 'nominees' })}
                  className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                >
                  View Nominees
                </Button>
              </div>
            </div>

            {/* Live Voting Countdown Timer */}
            <div className="lg:col-span-5">
              <div className="rounded-lg border border-white/15 bg-[#0B192C]/85 backdrop-blur-md p-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-5">
                  <span className="text-xs font-semibold tracking-wider uppercase text-[#D8B246]">
                    {settings?.votingPaused
                      ? 'Voting Paused by Board'
                      : countdown.ended
                      ? 'Voting Window Concluded'
                      : 'Public Voting Closes In'}
                  </span>
                  <span className="text-xs text-slate-300 tabular-nums">
                    {activeAward ? formatDate(activeAward.votingEndsAt) : '—'}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-3 text-center">
                  {[
                    { label: 'Days', value: countdown.days },
                    { label: 'Hours', value: countdown.hours },
                    { label: 'Minutes', value: countdown.minutes },
                    { label: 'Seconds', value: countdown.seconds },
                  ].map((unit) => (
                    <div
                      key={unit.label}
                      className="rounded-md bg-[#06101D]/80 border border-white/10 py-3 px-2"
                    >
                      <div className="font-mono text-2xl sm:text-3xl font-semibold text-white tabular-nums">
                        {String(unit.value).padStart(2, '0')}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">{unit.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Award Categories */}
      <section className="py-20 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
            <div className="space-y-2 max-w-2xl">
              <p className="text-xs font-semibold tracking-widest uppercase text-[#9F7915]">
                Disciplines & Categories
              </p>
              <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-[#0B192C] [text-wrap:balance]">
                Featured Award Categories
              </h2>
            </div>
            <Button
              variant="outline"
              onClick={() => onNavigate({ page: 'categories' })}
            >
              All Categories
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {categories.slice(0, 4).map((cat) => (
              <Card
                key={cat.id}
                className="overflow-hidden flex flex-col justify-between hover:border-[#0B192C]/40 transition-colors"
              >
                <div>
                  <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                    <SafeImage
                      src={cat.imageUrl}
                      alt={cat.name}
                      fallbackTitle={cat.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-5 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs text-slate-500 tabular-nums">
                      <span>{cat.nomineeCount ?? 0} Nominees</span>
                      <span aria-hidden="true">·</span>
                      <span>{cat.votingEnabled ? 'Ballot Open' : 'Closed'}</span>
                    </div>
                    <h3 className="font-serif text-lg font-semibold text-[#0B192C] leading-snug">
                      {cat.name}
                    </h3>
                    <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed">
                      {cat.description}
                    </p>
                  </div>
                </div>
                <div className="px-5 pb-5 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => onNavigate({ page: 'nominees', categoryId: cat.id })}
                  >
                    View Nominees
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Nominees */}
      <section className="py-20 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
            <div className="space-y-2 max-w-2xl">
              <p className="text-xs font-semibold tracking-widest uppercase text-[#9F7915]">
                2026 Shortlist
              </p>
              <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-[#0B192C] [text-wrap:balance]">
                Featured Nominees
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="gold" onClick={() => onNavigate({ page: 'nominate' })}>
                Submit Nomination
              </Button>
              <Button
                variant="outline"
                onClick={() => onNavigate({ page: 'nominees' })}
              >
                Explore All Nominees
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {nominees.slice(0, 6).map((nom) => (
              <Card key={nom.id} className="overflow-hidden flex flex-col justify-between bg-white">
                <div>
                  <div className="aspect-[3/4] max-h-80 w-full overflow-hidden bg-slate-900">
                    <SafeImage
                      src={nom.photoUrl}
                      alt={nom.fullName}
                      fallbackTitle={nom.fullName}
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                  <div className="p-6 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono text-[#9F7915]">{nom.nomineeNumber}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{categoryNameMap.get(nom.categoryId) || 'Honours'}</span>
                    </div>
                    <h3 className="font-serif text-xl font-semibold text-[#0B192C]">
                      {nom.fullName}
                    </h3>
                    <p className="text-xs font-medium text-slate-500">
                      {nom.roleTitle}{nom.organization ? ` · ${nom.organization}` : ''}
                    </p>
                    <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed pt-1">
                      {nom.biography}
                    </p>
                  </div>
                </div>
                <div className="px-6 pb-6 pt-2 grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigate({ page: 'nominee-detail', nomineeId: nom.id })}
                  >
                    View Profile
                  </Button>
                  <Button
                    variant="gold"
                    size="sm"
                    onClick={() =>
                      onNavigate({ page: 'vote', categoryId: nom.categoryId, nomineeId: nom.id })
                    }
                  >
                    Vote Now
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How to Vote Section */}
      <section className="py-20 bg-[#0B192C] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-4 space-y-4">
              <p className="text-xs font-semibold tracking-widest uppercase text-[#D8B246]">
                Ballot Protocol
              </p>
              <h2 className="font-serif text-3xl sm:text-4xl font-semibold [text-wrap:balance]">
                How Verified Public Voting Works
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Every public vote is verified via one-time passcode, human challenge validation, and database-enforced category uniqueness.
              </p>
              <div className="pt-2 flex flex-wrap gap-3">
                <Button variant="gold" onClick={() => onNavigate({ page: 'vote' })}>
                  Enter Voting Booth
                </Button>
                <Button
                  variant="outline"
                  className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                  onClick={() => onNavigate({ page: 'verify' })}
                >
                  Verify Ballot Receipt
                </Button>
              </div>
            </div>

            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {howToVoteSteps.map((step) => (
                <div
                  key={step.num}
                  className="rounded-lg border border-white/15 bg-[#132844]/60 p-6 space-y-2.5"
                >
                  <span className="font-mono text-sm font-semibold text-[#D8B246]">
                    {step.num}
                  </span>
                  <h3 className="font-serif text-xl font-semibold text-white">{step.title}</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Latest Announcements */}
      <section className="py-20 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-2 mb-12">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#9F7915]">
              Governance & Press
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-[#0B192C]">
              Latest Announcements
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {announcements.slice(0, 3).map((item) => (
              <Card key={item.id} className="p-6 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-[#9F7915]">{item.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{formatDate(item.publishedAt)}</span>
                  </div>
                  <h3 className="font-serif text-xl font-semibold text-[#0B192C] leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.summary}</p>
                </div>
                <div className="pt-5">
                  <button
                    type="button"
                    onClick={() => setSelectedAnnouncement(item)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0B192C] hover:text-[#9F7915] transition-colors cursor-pointer"
                  >
                    Read Full Notice
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Sponsors & Partners */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-2 mb-10">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#9F7915]">
              Institutional Support
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-[#0B192C]">
              Sponsors & Partners
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {sponsors.map((sp) => (
              <a
                key={sp.id}
                href={sp.websiteUrl || '#'}
                target="_blank"
                rel="noreferrer"
                className="group rounded-lg border border-slate-200 bg-white px-6 py-5 flex items-center justify-between gap-4 hover:border-[#0B192C] transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-xs text-[#9F7915] font-medium">{sp.tier}</p>
                  <p className="font-serif text-base font-semibold text-[#0B192C] truncate mt-0.5">
                    {sp.name}
                  </p>
                </div>
                <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-[#0B192C] shrink-0" />
              </a>
            ))}
          </div>
        </div>
      </section>

      <Dialog
        open={Boolean(selectedAnnouncement)}
        onOpenChange={(open) => !open && setSelectedAnnouncement(null)}
      >
        <DialogContent>
          {selectedAnnouncement && (
            <>
              <DialogHeader>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#9F7915]">
                  {selectedAnnouncement.category} · {formatDate(selectedAnnouncement.publishedAt)}
                </p>
                <DialogTitle className="font-serif text-2xl pt-1">
                  {selectedAnnouncement.title}
                </DialogTitle>
                <DialogDescription>{selectedAnnouncement.summary}</DialogDescription>
              </DialogHeader>
              <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {selectedAnnouncement.content}
              </div>
              <div className="pt-4 flex items-center gap-2 text-xs text-slate-500">
                <CheckCircle2 className="h-4 w-4 text-[#C59B27]" />
                <span>Verified official release from the Black Star Governance Secretariat, Accra</span>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
