import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Lock, Search, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest } from '../../lib/api';
import { formatDateTime } from '../../lib/utils';
import type { PublicBootstrap } from '../../types';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import type { PublicRoute } from './PublicLayout';

interface VerifyReceiptPageProps {
  bootstrap: PublicBootstrap;
  initialCode?: string;
  onNavigate: (route: PublicRoute) => void;
}

interface VerifiedReceiptResult {
  verified: boolean;
  receiptCode: string;
  awardTitle: string;
  categoryName: string;
  verificationMethod: string;
  ghanaRegion: string;
  voteWeight: number;
  channel: string;
  recordedAt: string;
}

export function VerifyReceiptPage({
  bootstrap,
  initialCode,
  onNavigate,
}: VerifyReceiptPageProps) {
  const [code, setCode] = useState(initialCode || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifiedReceiptResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const verifyCode = async (targetCode: string) => {
    const trimmed = targetCode.trim().toUpperCase();
    if (!trimmed) {
      toast.error('Enter a ballot or MoMo receipt code.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    setResult(null);
    try {
      const data = await apiRequest<VerifiedReceiptResult>(
        `/api/public/verify-receipt/${encodeURIComponent(trimmed)}`
      );
      setResult(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Receipt not found on the ledger.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
      verifyCode(initialCode);
    }
  }, [initialCode]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    verifyCode(code);
  };

  return (
    <div className="bg-slate-50 min-h-[75vh]">
      <section className="bg-[#0B192C] text-white py-14">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3">
          <p className="text-xs font-semibold tracking-widest uppercase text-[#D8B246]">
            Ballot Audit & Transparency
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold">
            Verify Official Ballot Receipt
          </h1>
          <p className="text-slate-300 text-sm max-w-2xl">
            Confirm that your verified free ballot, Mobile Money vote pack, or USSD vote is permanently sealed in the PostgreSQL ledger—without exposing your identity or candidate selection.
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <Card className="p-6 sm:p-8 bg-white space-y-5">
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter receipt code (e.g. GH-2026-2001)"
                  className="pl-9 font-mono uppercase"
                />
              </div>
              <Button type="submit" variant="gold" disabled={loading}>
                {loading ? 'Verifying Ledger...' : 'Verify Receipt'}
              </Button>
            </form>

            {!bootstrap.settings?.productionMode && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>Sample ledger receipts:</span>
                {['GH-2026-2001', 'MOMO-GH-9901', 'USSD-GH-9902'].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => {
                      setCode(sample);
                      verifyCode(sample);
                    }}
                    className="font-mono text-[#0B192C] underline decoration-[#C59B27] hover:text-[#9F7915] cursor-pointer"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            )}
          </Card>

          {errorMsg && (
            <Card className="p-6 bg-white border-red-200 flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[#0B192C]">Receipt Not Found</p>
                <p className="text-xs text-slate-600">{errorMsg}</p>
              </div>
            </Card>
          )}

          {result && (
            <Card className="p-8 bg-white border-[#C59B27]/50 space-y-6">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-[#C59B27] shrink-0" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-[#9F7915]">
                      Cryptographically Sealed Record
                    </p>
                    <h2 className="font-serif text-2xl font-semibold text-[#0B192C]">
                      Receipt Verified on Official Ledger
                    </h2>
                  </div>
                </div>
                <span className="font-mono text-sm font-semibold text-[#0B192C] bg-slate-100 px-3 py-1.5 rounded">
                  {result.receiptCode}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="rounded-md bg-slate-50 p-4 border border-slate-100">
                  <p className="text-xs text-slate-500">Awards Edition</p>
                  <p className="font-semibold text-[#0B192C] mt-1">{result.awardTitle}</p>
                </div>
                <div className="rounded-md bg-slate-50 p-4 border border-slate-100">
                  <p className="text-xs text-slate-500">Category</p>
                  <p className="font-semibold text-[#0B192C] mt-1">{result.categoryName}</p>
                </div>
                <div className="rounded-md bg-slate-50 p-4 border border-slate-100">
                  <p className="text-xs text-slate-500">Region & Verification Channel</p>
                  <p className="font-semibold text-[#0B192C] mt-1">
                    {result.ghanaRegion} · {result.verificationMethod}
                  </p>
                </div>
                <div className="rounded-md bg-slate-50 p-4 border border-slate-100">
                  <p className="text-xs text-slate-500">Recorded Vote Weight & Time</p>
                  <p className="font-mono font-semibold text-[#0B192C] tabular-nums mt-1">
                    {result.voteWeight} {result.voteWeight === 1 ? 'vote' : 'votes'} ·{' '}
                    {formatDateTime(result.recordedAt)}
                  </p>
                </div>
              </div>

              <div className="rounded-md bg-[#FAF4E1] border border-[#C59B27]/30 p-4 flex items-start gap-3 text-xs text-slate-700">
                <Lock className="h-4 w-4 text-[#9F7915] shrink-0 mt-0.5" />
                <p>
                  Secret Ballot Privacy Guarantee: Public receipt verification confirms ballot inclusion and category timestamp only. Voter phone numbers, emails, and selected nominees are strictly omitted.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button variant="gold" onClick={() => onNavigate({ page: 'vote' })}>
                  Cast Another Ballot
                </Button>
                <Button variant="outline" onClick={() => onNavigate({ page: 'results' })}>
                  View Results & Standings
                </Button>
              </div>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
