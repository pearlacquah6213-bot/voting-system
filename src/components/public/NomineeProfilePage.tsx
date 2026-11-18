import { ArrowLeft, ExternalLink, Globe, Vote } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { SafeImage } from '../ui/SafeImage';
import type { PublicBootstrap } from '../../types';
import type { PublicRoute } from './PublicLayout';

interface NomineeProfilePageProps {
  bootstrap: PublicBootstrap;
  nomineeId: number;
  onNavigate: (route: PublicRoute) => void;
}

export function NomineeProfilePage({
  bootstrap,
  nomineeId,
  onNavigate,
}: NomineeProfilePageProps) {
  const nominee = bootstrap.nominees.find((n) => n.id === nomineeId);
  if (!nominee) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="font-serif text-3xl font-semibold text-[#0B192C]">Nominee Not Found</h1>
        <Button variant="outline" onClick={() => onNavigate({ page: 'nominees' })}>
          Return to Nominees
        </Button>
      </div>
    );
  }

  const category = bootstrap.categories.find((c) => c.id === nominee.categoryId);
  const award = bootstrap.awards.find((a) => a.id === nominee.awardId);
  const socialEntries = Object.entries(nominee.socialLinks || {}).filter(([, val]) => Boolean(val));

  return (
    <div className="bg-slate-50 min-h-[75vh] py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <button
          type="button"
          onClick={() => onNavigate({ page: 'nominees' })}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-[#0B192C] cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Nominees Directory
        </button>

        <Card className="overflow-hidden bg-white">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
            <div className="lg:col-span-5 bg-slate-900 min-h-[380px]">
              <SafeImage
                src={nominee.photoUrl}
                alt={nominee.fullName}
                fallbackTitle={nominee.fullName}
                className="w-full h-full object-cover object-top"
              />
            </div>

            <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-between space-y-8">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono font-semibold text-[#9F7915]">
                    {nominee.nomineeNumber}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{award?.title}</span>
                  <span aria-hidden="true">·</span>
                  <span>{category?.name}</span>
                </div>

                <div>
                  <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-[#0B192C]">
                    {nominee.fullName}
                  </h1>
                  {(nominee.roleTitle || nominee.organization) && (
                    <p className="text-base text-slate-600 mt-1">
                      {nominee.roleTitle}
                      {nominee.organization ? ` · ${nominee.organization}` : ''}
                    </p>
                  )}
                </div>

                <div className="border-t border-slate-200 pt-5">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    Official Citation & Biography
                  </h2>
                  <p className="text-base text-slate-700 leading-relaxed whitespace-pre-line">
                    {nominee.biography}
                  </p>
                </div>

                {bootstrap.resultsVisible && nominee.voteCount !== null && (
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs text-slate-500">Verified Votes</p>
                      <p className="font-mono text-2xl font-semibold text-[#0B192C] tabular-nums mt-1">
                        {nominee.voteCount}
                      </p>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs text-slate-500">Category Share</p>
                      <p className="font-mono text-2xl font-semibold text-[#9F7915] tabular-nums mt-1">
                        {nominee.votePercentage ?? 0}%
                      </p>
                    </div>
                  </div>
                )}

                {socialEntries.length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
                      Official Profiles & Links
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {socialEntries.map(([platform, url]) => (
                        <a
                          key={platform}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-[#0B192C] hover:border-[#0B192C] capitalize"
                        >
                          <Globe className="h-3.5 w-3.5 text-[#9F7915]" />
                          {platform}
                          <ExternalLink className="h-3 w-3 text-slate-400" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center gap-4">
                <Button
                  size="lg"
                  variant="gold"
                  onClick={() =>
                    onNavigate({
                      page: 'vote',
                      categoryId: nominee.categoryId,
                      nomineeId: nominee.id,
                    })
                  }
                >
                  <Vote className="h-4 w-4" />
                  Vote for {nominee.fullName}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => onNavigate({ page: 'results' })}
                >
                  View Standings
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
