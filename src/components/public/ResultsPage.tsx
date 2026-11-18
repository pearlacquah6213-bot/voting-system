import { useMemo, useState } from 'react';
import { Award as AwardIcon, Lock } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { SafeImage } from '../ui/SafeImage';
import type { PublicBootstrap } from '../../types';
import type { PublicRoute } from './PublicLayout';

interface ResultsPageProps {
  bootstrap: PublicBootstrap;
  onNavigate: (route: PublicRoute) => void;
}

export function ResultsPage({ bootstrap, onNavigate }: ResultsPageProps) {
  const { categories, nominees, resultsVisible, totalPublicVotes } = bootstrap;
  const [selectedCatId, setSelectedCatId] = useState<number>(categories[0]?.id || 0);

  const selectedCategory = categories.find((c) => c.id === selectedCatId) || categories[0];

  const rankedNominees = useMemo(() => {
    if (!selectedCategory) return [];
    return nominees
      .filter((n) => n.categoryId === selectedCategory.id)
      .sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0));
  }, [nominees, selectedCategory]);

  if (!resultsVisible) {
    return (
      <div className="bg-slate-50 min-h-[70vh] flex items-center justify-center px-4 py-20">
        <Card className="max-w-xl w-full p-10 text-center space-y-4 bg-white">
          <Lock className="h-10 w-10 text-[#C59B27] mx-auto" />
          <h1 className="font-serif text-3xl font-semibold text-[#0B192C]">
            Results Sealed Until Official Announcement
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            In accordance with the Awards Governance Board, live tallies and winner announcements are temporarily hidden while ballot audits are finalised.
          </p>
          <div className="pt-2">
            <Button variant="gold" onClick={() => onNavigate({ page: 'vote' })}>
              Cast Your Vote
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const chartData = rankedNominees.map((n) => ({
    name: n.fullName,
    votes: n.voteCount ?? 0,
  }));

  return (
    <div className="bg-slate-50 min-h-[75vh]">
      <section className="bg-[#0B192C] text-white py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#D8B246]">
              Certified Standings
            </p>
            <h1 className="font-serif text-4xl font-semibold">Official Results & Rankings</h1>
            <p className="text-sm text-slate-300 max-w-xl">
              Live audited vote totals, category percentages, and leading laureates across published disciplines.
            </p>
          </div>
          <div className="rounded-lg border border-white/15 bg-[#132844] px-6 py-4">
            <p className="text-xs text-slate-300">Total Verified Ballots</p>
            <p className="font-mono text-3xl font-semibold text-[#D8B246] tabular-nums mt-0.5">
              {totalPublicVotes ?? 0}
            </p>
          </div>
        </div>
      </section>

      <section className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          {/* Category Selector */}
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCatId(cat.id)}
                className={`px-4 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  selectedCategory?.id === cat.id
                    ? 'bg-[#0B192C] text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-400'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {selectedCategory && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Standings List */}
              <div className="lg:col-span-7 space-y-4">
                {rankedNominees.map((nom, index) => (
                  <Card key={nom.id} className="p-5 bg-white flex items-center gap-5">
                    <div className="font-mono text-xl font-bold text-slate-400 w-8 text-center tabular-nums shrink-0">
                      #{index + 1}
                    </div>
                    <div className="h-16 w-16 rounded-md overflow-hidden bg-slate-900 shrink-0">
                      <SafeImage
                        src={nom.photoUrl}
                        alt={nom.fullName}
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-serif text-lg font-semibold text-[#0B192C] truncate">
                            {nom.fullName}
                          </h3>
                          <p className="text-xs text-slate-500 truncate">
                            {nom.organization || nom.roleTitle}
                            {(nom.isWinner || index === 0) && (
                              <span className="ml-2 font-semibold text-[#9F7915]">
                                · {nom.isWinner ? 'Certified Winner' : 'Leading'}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono text-lg font-semibold text-[#0B192C] tabular-nums">
                            {nom.voteCount ?? 0}
                          </p>
                          <p className="font-mono text-xs text-[#9F7915] tabular-nums">
                            {nom.votePercentage ?? 0}%
                          </p>
                        </div>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-[#C59B27] transition-all duration-300"
                          style={{ width: `${Math.min(100, nom.votePercentage ?? 0)}%` }}
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Recharts Category Distribution */}
              <Card className="lg:col-span-5 p-6 bg-white flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-serif text-xl font-semibold text-[#0B192C]">
                      Vote Distribution
                    </h2>
                    <AwardIcon className="h-5 w-5 text-[#C59B27]" />
                  </div>
                  <p className="text-xs text-slate-500 mb-6">{selectedCategory.name}</p>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 12, left: -10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#475569' }} />
                        <Tooltip />
                        <Bar dataKey="votes" fill="#0B192C" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <p className="text-xs text-slate-400 pt-4 border-t border-slate-100">
                  All figures reflect real-time OTP-verified ballots stored in PostgreSQL.
                </p>
              </Card>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
