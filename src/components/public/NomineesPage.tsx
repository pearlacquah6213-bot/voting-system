import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { SafeImage } from '../ui/SafeImage';
import type { PublicBootstrap } from '../../types';
import type { PublicRoute } from './PublicLayout';

interface NomineesPageProps {
  bootstrap: PublicBootstrap;
  initialCategoryId?: number;
  onNavigate: (route: PublicRoute) => void;
}

const PAGE_SIZE = 6;

export function NomineesPage({
  bootstrap,
  initialCategoryId,
  onNavigate,
}: NomineesPageProps) {
  const { categories, nominees } = bootstrap;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState<number | 'all'>(initialCategoryId ?? 'all');
  const [page, setPage] = useState(1);

  const categoryNameMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return nominees.filter((n) => {
      if (selectedCat !== 'all' && n.categoryId !== selectedCat) return false;
      if (!q) return true;
      return (
        n.fullName.toLowerCase().includes(q) ||
        n.organization.toLowerCase().includes(q) ||
        n.nomineeNumber.toLowerCase().includes(q) ||
        n.biography.toLowerCase().includes(q)
      );
    });
  }, [nominees, selectedCat, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="bg-slate-50 min-h-[75vh]">
      <section className="bg-[#0B192C] text-white py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-end justify-between gap-5">
          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#D8B246]">
              Official Finalists
            </p>
            <h1 className="font-serif text-4xl font-semibold">Nominees Directory</h1>
            <p className="text-slate-300 text-sm max-w-2xl">
              Search verified nominees, filter by award category, inspect complete profiles, or cast your ballot directly.
            </p>
          </div>
          <Button variant="gold" onClick={() => onNavigate({ page: 'nominate' })}>
            Submit a Nomination
          </Button>
        </div>
      </section>

      <section className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          {/* Search & Filter Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-lg border border-slate-200">
            <div className="relative flex-1 max-w-md">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search nominee, organization, or ID..."
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedCat}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedCat(val === 'all' ? 'all' : Number(val));
                  setPage(1);
                }}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-[#0B192C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27]"
                aria-label="Filter by category"
              >
                <option value="all">All Categories ({nominees.length})</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {paginated.length === 0 ? (
            <Card className="p-12 text-center space-y-3">
              <p className="font-serif text-xl font-semibold text-[#0B192C]">
                No nominees matched your filter
              </p>
              <p className="text-sm text-slate-500">
                Try clearing your search query or switching to All Categories.
              </p>
              <div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCat('all');
                    setPage(1);
                  }}
                >
                  Reset Filters
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {paginated.map((nom) => (
                <Card key={nom.id} className="overflow-hidden flex flex-col justify-between bg-white">
                  <div>
                    <div className="aspect-[3/4] max-h-80 overflow-hidden bg-slate-900">
                      <SafeImage
                        src={nom.photoUrl}
                        alt={nom.fullName}
                        fallbackTitle={nom.fullName}
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                    <div className="p-6 space-y-2">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono text-[#9F7915]">{nom.nomineeNumber}</span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{categoryNameMap.get(nom.categoryId)}</span>
                      </div>
                      <h2 className="font-serif text-xl font-semibold text-[#0B192C]">
                        {nom.fullName}
                      </h2>
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
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <p className="text-xs text-slate-500 tabular-nums">
                Page {currentPage} of {totalPages} · {filtered.length} total nominees
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
