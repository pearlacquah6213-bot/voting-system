import { useState } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { SafeImage } from '../ui/SafeImage';
import type { PublicBootstrap } from '../../types';
import type { PublicRoute } from './PublicLayout';

interface CategoriesPageProps {
  bootstrap: PublicBootstrap;
  onNavigate: (route: PublicRoute) => void;
}

export function CategoriesPage({ bootstrap, onNavigate }: CategoriesPageProps) {
  const { awards, categories } = bootstrap;
  const [selectedAwardId, setSelectedAwardId] = useState<number | 'all'>('all');

  const awardMap = new Map(awards.map((a) => [a.id, a.title]));
  const filtered =
    selectedAwardId === 'all'
      ? categories
      : categories.filter((c) => c.awardId === selectedAwardId);

  return (
    <div className="bg-white min-h-[70vh]">
      <section className="bg-[#0B192C] text-white py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3">
          <p className="text-xs font-semibold tracking-widest uppercase text-[#D8B246]">
            Published Categories
          </p>
          <h1 className="font-serif text-4xl font-semibold">Award Categories</h1>
          <p className="text-slate-300 text-sm max-w-2xl">
            Inspect every active honours discipline, review candidate counts, and proceed directly to nominee dossiers or verified ballot casting.
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {awards.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 mb-8">
              <button
                type="button"
                onClick={() => setSelectedAwardId('all')}
                className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  selectedAwardId === 'all'
                    ? 'bg-[#0B192C] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All Editions
              </button>
              {awards.map((award) => (
                <button
                  key={award.id}
                  type="button"
                  onClick={() => setSelectedAwardId(award.id)}
                  className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    selectedAwardId === award.id
                      ? 'bg-[#0B192C] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {award.title}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filtered.map((cat) => (
              <Card key={cat.id} className="overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                    <SafeImage
                      src={cat.imageUrl}
                      alt={cat.name}
                      fallbackTitle={cat.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-6 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{awardMap.get(cat.awardId) || 'Honours'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums font-medium text-[#9F7915]">
                        {cat.nomineeCount ?? 0} Nominees
                      </span>
                    </div>
                    <h2 className="font-serif text-xl font-semibold text-[#0B192C]">{cat.name}</h2>
                    <p className="text-sm text-slate-600 leading-relaxed">{cat.description}</p>
                  </div>
                </div>
                <div className="px-6 pb-6 pt-2 flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => onNavigate({ page: 'nominees', categoryId: cat.id })}
                  >
                    View Nominees
                  </Button>
                  {cat.votingEnabled && (
                    <Button
                      variant="gold"
                      size="sm"
                      className="flex-1"
                      onClick={() => onNavigate({ page: 'vote', categoryId: cat.id })}
                    >
                      Vote
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
