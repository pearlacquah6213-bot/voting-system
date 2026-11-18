import { useEffect, useState } from 'react';
import { CheckCircle2, Lock, PhoneCall, RefreshCw, ShieldCheck, Smartphone, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest } from '../../lib/api';
import { formatDateTime } from '../../lib/utils';
import type { PublicBootstrap } from '../../types';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { SafeImage } from '../ui/SafeImage';
import type { PublicRoute } from './PublicLayout';

interface VotingPageProps {
  bootstrap: PublicBootstrap;
  initialCategoryId?: number;
  initialNomineeId?: number;
  onVoteRecorded: () => void;
  onNavigate: (route: PublicRoute) => void;
}

interface CaptchaState {
  question: string;
  challengeToken: string;
}

interface ReceiptState {
  receiptCode: string;
  voterCode?: string;
  reference?: string;
  nomineeName: string;
  categoryName: string;
  awardTitle?: string;
  ghanaRegion?: string;
  voteCount?: number;
  amountGhs?: number;
  castAt: string;
}

const DEFAULT_GHANA_REGIONS = [
  'Greater Accra',
  'Ashanti',
  'Western',
  'Western North',
  'Central',
  'Eastern',
  'Volta',
  'Oti',
  'Northern',
  'Savannah',
  'North East',
  'Upper East',
  'Upper West',
  'Bono',
  'Bono East',
  'Ahafo',
  'Diaspora',
];

export function VotingPage({
  bootstrap,
  initialCategoryId,
  initialNomineeId,
  onVoteRecorded,
  onNavigate,
}: VotingPageProps) {
  const ghanaRegions =
    bootstrap.ghanaRegions && bootstrap.ghanaRegions.length > 0
      ? bootstrap.ghanaRegions
      : DEFAULT_GHANA_REGIONS;

  const openCategories = bootstrap.categories.filter((c) => c.votingEnabled);
  const paidEnabled = Boolean(bootstrap.settings?.paidVotingEnabled);
  const votePriceGhs = bootstrap.settings?.votePriceGhs || 2;
  const ussdShortcode = bootstrap.settings?.ussdShortcode || '*714*88#';

  const [voteChannel, setVoteChannel] = useState<'FREE_OTP' | 'MOMO_PACK' | 'USSD_SIM'>('FREE_OTP');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number>(
    initialCategoryId || openCategories[0]?.id || 0
  );
  const [selectedNomineeId, setSelectedNomineeId] = useState<number>(initialNomineeId || 0);
  const [ghanaRegion, setGhanaRegion] = useState<string>(ghanaRegions[0] || 'Greater Accra');

  // Free Verified Ballot state
  const [method, setMethod] = useState<'EMAIL_OTP' | 'PHONE_OTP'>(
    bootstrap.settings?.allowEmailOtp ? 'EMAIL_OTP' : 'PHONE_OTP'
  );
  const [contact, setContact] = useState('');
  const [fullName, setFullName] = useState('');
  const [ghanaCardNumber, setGhanaCardNumber] = useState('');
  const [captcha, setCaptcha] = useState<CaptchaState | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpPreview, setOtpPreview] = useState<string | null>(null);
  const [deliveryChannel, setDeliveryChannel] = useState<string>('SANDBOX');
  const [otpCode, setOtpCode] = useState('');
  const [maskedContact, setMaskedContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);

  // Mobile Money Vote Pack state
  const [momoNetwork, setMomoNetwork] = useState<'MTN' | 'TELECEL' | 'AT'>('MTN');
  const [momoPhone, setMomoPhone] = useState('');
  const [momoVotes, setMomoVotes] = useState<number>(5);
  const [momoPending, setMomoPending] = useState<{
    reference: string;
    amountGhs: number;
    voteCount: number;
    network: string;
    maskedPhone: string;
  } | null>(null);

  // USSD Simulator state
  const [ussdPhone, setUssdPhone] = useState('0244 100 200');
  const [ussdPath, setUssdPath] = useState('');
  const [ussdInput, setUssdInput] = useState('');
  const [ussdScreen, setUssdScreen] = useState<string | null>(null);
  const [ussdEnded, setUssdEnded] = useState(false);
  const [ussdLoading, setUssdLoading] = useState(false);

  const categoryNominees = bootstrap.nominees.filter((n) => n.categoryId === selectedCategoryId);
  const selectedCategory = bootstrap.categories.find((c) => c.id === selectedCategoryId);
  const selectedNominee = categoryNominees.find((n) => n.id === selectedNomineeId);

  const loadCaptcha = async () => {
    try {
      const data = await apiRequest<CaptchaState>('/api/voting/captcha');
      setCaptcha(data);
      setCaptchaAnswer('');
    } catch {
      // ignore transient error
    }
  };

  useEffect(() => {
    loadCaptcha();
  }, []);

  useEffect(() => {
    if (initialCategoryId) setSelectedCategoryId(initialCategoryId);
    if (initialNomineeId) setSelectedNomineeId(initialNomineeId);
  }, [initialCategoryId, initialNomineeId]);

  const handleRequestOtp = async () => {
    if (!selectedCategoryId || !selectedNomineeId) {
      toast.error('Please select a category and nominee first.');
      return;
    }
    if (!contact.trim()) {
      toast.error(method === 'EMAIL_OTP' ? 'Enter your email address.' : 'Enter your phone number.');
      return;
    }
    if (bootstrap.settings?.requireCaptcha && !captchaAnswer.trim()) {
      toast.error('Please solve the verification challenge.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest<{
        ok: boolean;
        maskedContact: string;
        deliveryChannel?: string;
        otpDeliveryPreview?: string;
      }>('/api/voting/request-otp', {
        method: 'POST',
        body: JSON.stringify({
          method,
          contact: contact.trim(),
          fullName: fullName.trim() || undefined,
          ghanaRegion,
          ghanaCardNumber: ghanaCardNumber.trim() || undefined,
          captchaToken: captcha?.challengeToken,
          captchaAnswer: captchaAnswer.trim(),
        }),
      });
      setOtpRequested(true);
      setMaskedContact(res.maskedContact);
      setDeliveryChannel(res.deliveryChannel || 'SANDBOX');
      setOtpPreview(res.otpDeliveryPreview ?? null);
      toast.success(`Verification code dispatched to ${res.maskedContact}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unable to send OTP.');
      loadCaptcha();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitVote = async () => {
    if (!selectedCategoryId || !selectedNomineeId) {
      toast.error('Select both a category and a nominee.');
      return;
    }
    if (bootstrap.settings?.requireOtp && otpCode.trim().length !== 6) {
      toast.error('Enter the 6-digit OTP verification code.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest<ReceiptState>('/api/voting/submit', {
        method: 'POST',
        body: JSON.stringify({
          categoryId: selectedCategoryId,
          nomineeId: selectedNomineeId,
          method,
          contact: contact.trim(),
          ghanaRegion,
          ghanaCardNumber: ghanaCardNumber.trim() || undefined,
          otpCode: otpCode.trim(),
          captchaToken: captcha?.challengeToken,
          captchaAnswer: captchaAnswer.trim(),
        }),
      });
      setReceipt(res);
      toast.success('Verified ballot recorded securely!');
      onVoteRecorded();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Vote submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInitiateMomo = async () => {
    if (!selectedCategoryId || !selectedNomineeId) {
      toast.error('Please select a category and nominee first.');
      return;
    }
    if (!momoPhone.trim()) {
      toast.error('Enter your Ghanaian Mobile Money number.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiRequest<{
        reference: string;
        amountGhs: number;
        voteCount: number;
        network: string;
        maskedPhone: string;
      }>('/api/voting/momo/initiate', {
        method: 'POST',
        body: JSON.stringify({
          categoryId: selectedCategoryId,
          nomineeId: selectedNomineeId,
          voterPhone: momoPhone.trim(),
          network: momoNetwork,
          voteCount: Number(momoVotes),
          ghanaRegion,
        }),
      });
      setMomoPending(res);
      toast.success(`MoMo prompt initiated for GHS ${res.amountGhs}.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unable to initiate Mobile Money transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmMomo = async () => {
    if (!momoPending) return;
    setSubmitting(true);
    try {
      const res = await apiRequest<ReceiptState>('/api/voting/momo/confirm', {
        method: 'POST',
        body: JSON.stringify({ reference: momoPending.reference }),
      });
      setReceipt(res);
      setMomoPending(null);
      toast.success('Mobile Money vote pack confirmed!');
      onVoteRecorded();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unable to confirm MoMo payment.');
    } finally {
      setSubmitting(false);
    }
  };

  const callUssd = async (nextText: string) => {
    setUssdLoading(true);
    try {
      const res = await apiRequest<{ response: string }>('/api/ussd/callback', {
        method: 'POST',
        body: JSON.stringify({
          phoneNumber: ussdPhone.trim() || '0244100200',
          text: nextText,
        }),
      });
      const raw = res.response || '';
      const ended = raw.startsWith('END');
      setUssdEnded(ended);
      setUssdScreen(raw.replace(/^(CON|END)\s*/, ''));
      setUssdPath(nextText);
      setUssdInput('');
      if (ended && raw.includes('Receipt:')) {
        onVoteRecorded();
      }
    } catch {
      toast.error('USSD gateway unavailable.');
    } finally {
      setUssdLoading(false);
    }
  };

  const resetForAnotherCategory = () => {
    setReceipt(null);
    setSelectedNomineeId(0);
    setOtpRequested(false);
    setOtpCode('');
    setOtpPreview(null);
    setMomoPending(null);
    loadCaptcha();
  };

  if (bootstrap.settings?.votingPaused) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <Lock className="h-10 w-10 text-[#C59B27] mx-auto" />
        <h1 className="font-serif text-3xl font-semibold text-[#0B192C]">
          Public Voting Temporarily Paused
        </h1>
        <p className="text-slate-600 text-sm">
          The awards governance board has temporarily paused ballot submissions. Existing verified ballots remain securely sealed.
        </p>
        <Button variant="outline" onClick={() => onNavigate({ page: 'results' })}>
          View Results & Standings
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-[80vh]">
      <section className="bg-[#0B192C] text-white py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#D8B246]">
              Official Ghanaian Ballot Booth
            </p>
            <button
              type="button"
              onClick={() => onNavigate({ page: 'verify' })}
              className="text-xs font-medium text-[#D8B246] hover:underline cursor-pointer"
            >
              Already voted? Verify a Receipt →
            </button>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold">
            Cast Your Verified Vote
          </h1>
          <p className="text-sm text-slate-300 max-w-2xl">
            Vote freely with OTP verification, support nominees with Mobile Money vote packs (MTN, Telecel, AT), or dial{' '}
            <span className="font-mono text-[#D8B246]">{ussdShortcode}</span> offline.
          </p>
        </div>
      </section>

      <section className="py-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          {/* Channel Switcher Tabs */}
          {!receipt && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setVoteChannel('FREE_OTP')}
                className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors cursor-pointer ${
                  voteChannel === 'FREE_OTP'
                    ? 'border-[#0B192C] bg-[#0B192C] text-white'
                    : 'border-slate-200 bg-white text-[#0B192C] hover:border-slate-400'
                }`}
              >
                <ShieldCheck className={`h-5 w-5 shrink-0 ${voteChannel === 'FREE_OTP' ? 'text-[#D8B246]' : 'text-[#9F7915]'}`} />
                <div>
                  <p className="text-sm font-semibold">Verified Citizen Ballot</p>
                  <p className={`text-xs ${voteChannel === 'FREE_OTP' ? 'text-slate-300' : 'text-slate-500'}`}>
                    Free · 1 OTP vote per category
                  </p>
                </div>
              </button>

              {paidEnabled && (
                <button
                  type="button"
                  onClick={() => setVoteChannel('MOMO_PACK')}
                  className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors cursor-pointer ${
                    voteChannel === 'MOMO_PACK'
                      ? 'border-[#0B192C] bg-[#0B192C] text-white'
                      : 'border-slate-200 bg-white text-[#0B192C] hover:border-slate-400'
                  }`}
                >
                  <Wallet className={`h-5 w-5 shrink-0 ${voteChannel === 'MOMO_PACK' ? 'text-[#D8B246]' : 'text-[#9F7915]'}`} />
                  <div>
                    <p className="text-sm font-semibold">Mobile Money Vote Pack</p>
                    <p className={`text-xs ${voteChannel === 'MOMO_PACK' ? 'text-slate-300' : 'text-slate-500'}`}>
                      MTN · Telecel · AT (GHS {votePriceGhs}/vote)
                    </p>
                  </div>
                </button>
              )}

              <button
                type="button"
                onClick={() => setVoteChannel('USSD_SIM')}
                className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors cursor-pointer ${
                  voteChannel === 'USSD_SIM'
                    ? 'border-[#0B192C] bg-[#0B192C] text-white'
                    : 'border-slate-200 bg-white text-[#0B192C] hover:border-slate-400'
                }`}
              >
                <Smartphone className={`h-5 w-5 shrink-0 ${voteChannel === 'USSD_SIM' ? 'text-[#D8B246]' : 'text-[#9F7915]'}`} />
                <div>
                  <p className="text-sm font-semibold">USSD {ussdShortcode}</p>
                  <p className={`text-xs ${voteChannel === 'USSD_SIM' ? 'text-slate-300' : 'text-slate-500'}`}>
                    Offline Dialer Simulator & Guide
                  </p>
                </div>
              </button>
            </div>
          )}

          {receipt ? (
            <Card className="p-8 sm:p-10 bg-white text-center space-y-6">
              <CheckCircle2 className="h-12 w-12 text-[#C59B27] mx-auto" />
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#9F7915]">
                  Ballot Confirmed
                </p>
                <h2 className="font-serif text-3xl font-semibold text-[#0B192C]">
                  Medaase — Thank You for Voting
                </h2>
                <p className="text-sm text-slate-600">
                  {receipt.voteCount && receipt.voteCount > 1
                    ? `${receipt.voteCount} verified MoMo votes (GHS ${receipt.amountGhs}) for `
                    : 'Your verified vote for '}
                  <strong>{receipt.nomineeName}</strong> in <strong>{receipt.categoryName}</strong> has been permanently recorded.
                </p>
              </div>

              <div className="max-w-md mx-auto rounded-lg border border-slate-200 bg-slate-50 p-5 text-left space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Receipt Code</span>
                  <span className="font-mono font-semibold text-[#0B192C]">{receipt.receiptCode}</span>
                </div>
                {receipt.voterCode && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Voter ID</span>
                    <span className="font-mono text-slate-700">{receipt.voterCode}</span>
                  </div>
                )}
                {receipt.ghanaRegion && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Region</span>
                    <span className="text-slate-700">{receipt.ghanaRegion}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Recorded At</span>
                  <span className="tabular-nums text-slate-700">{formatDateTime(receipt.castAt)}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Button variant="gold" onClick={resetForAnotherCategory}>
                  Vote in Another Category
                </Button>
                <Button
                  variant="default"
                  onClick={() => onNavigate({ page: 'verify', code: receipt.receiptCode })}
                >
                  Verify Receipt in Ledger
                </Button>
                <Button variant="outline" onClick={() => onNavigate({ page: 'results' })}>
                  View Public Standings
                </Button>
              </div>
            </Card>
          ) : voteChannel === 'USSD_SIM' ? (
            <Card className="p-6 sm:p-8 bg-white space-y-6">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="font-serif text-2xl font-semibold text-[#0B192C]">
                    Interactive USSD ({ussdShortcode}) Voting Gateway
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Works on any MTN, Telecel, or AT phone across Ghana without internet data. Try the live gateway flow below.
                  </p>
                </div>
                <PhoneCall className="h-6 w-6 text-[#C59B27] shrink-0" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-5 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Simulated Ghanaian Phone Number
                    </label>
                    <Input
                      value={ussdPhone}
                      onChange={(e) => setUssdPhone(e.target.value)}
                      placeholder="0244 100 200"
                    />
                  </div>
                  <div className="rounded-md bg-slate-50 border border-slate-200 p-4 space-y-2 text-xs text-slate-600">
                    <p className="font-semibold text-[#0B192C]">Quick Dial Guide</p>
                    <p>1. Press <strong>Dial {ussdShortcode}</strong> to open the main menu.</p>
                    <p>2. Enter <span className="font-mono">1</span> to vote, then enter a nominee code such as <span className="font-mono">BSX-101</span>.</p>
                    <p>3. Enter <span className="font-mono">2</span> to list active nominee codes or <span className="font-mono">3</span> to verify a receipt.</p>
                  </div>
                  <Button
                    variant="gold"
                    className="w-full"
                    disabled={ussdLoading}
                    onClick={() => callUssd('')}
                  >
                    {ussdScreen ? `Restart ${ussdShortcode} Session` : `Dial ${ussdShortcode}`}
                  </Button>
                </div>

                <div className="lg:col-span-7">
                  <div className="rounded-lg bg-[#06101D] text-white p-6 space-y-4 border border-[#1E3A5F]">
                    <div className="flex items-center justify-between text-xs text-slate-400 border-b border-white/10 pb-2">
                      <span className="font-mono">USSD SESSION · {ussdShortcode}</span>
                      <span>{ussdEnded ? 'SESSION ENDED' : ussdScreen ? 'AWAITING INPUT' : 'IDLE'}</span>
                    </div>

                    <pre className="font-mono text-sm text-[#FAF4E1] whitespace-pre-wrap min-h-[120px]">
                      {ussdScreen || `Press "Dial ${ussdShortcode}" to initiate a Ghanaian USSD session.`}
                    </pre>

                    {ussdScreen && !ussdEnded && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!ussdInput.trim()) return;
                          const next = ussdPath === '' ? ussdInput.trim() : `${ussdPath}*${ussdInput.trim()}`;
                          callUssd(next);
                        }}
                        className="flex gap-2 pt-2 border-t border-white/10"
                      >
                        <Input
                          value={ussdInput}
                          onChange={(e) => setUssdInput(e.target.value)}
                          placeholder="Enter reply (e.g. 1, BSX-101, 2)..."
                          className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 font-mono"
                        />
                        <Button type="submit" variant="gold" disabled={ussdLoading}>
                          Send
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <div className="space-y-8">
              {/* Step 1: Select Award Category */}
              <Card className="p-6 sm:p-8 bg-white space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="font-serif text-xl font-semibold text-[#0B192C]">
                    1. Select Award Category
                  </h2>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {openCategories.length} open categories
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {openCategories.map((cat) => {
                    const active = cat.id === selectedCategoryId;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setSelectedCategoryId(cat.id);
                          setSelectedNomineeId(0);
                          setMomoPending(null);
                        }}
                        className={`text-left rounded-lg border p-4 transition-colors cursor-pointer ${
                          active
                            ? 'border-[#0B192C] bg-[#0B192C] text-white'
                            : 'border-slate-200 bg-white hover:border-slate-400 text-[#0B192C]'
                        }`}
                      >
                        <p className="font-semibold text-sm">{cat.name}</p>
                        <p className={`text-xs mt-1 ${active ? 'text-slate-300' : 'text-slate-500'}`}>
                          {cat.nomineeCount ?? 0} candidates · Max {cat.maxVotesPerVoter} free vote/voter
                        </p>
                      </button>
                    );
                  })}
                </div>
              </Card>

              {/* Step 2: Select Nominee */}
              <Card className="p-6 sm:p-8 bg-white space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="font-serif text-xl font-semibold text-[#0B192C]">
                    2. Choose Preferred Nominee
                  </h2>
                  <span className="text-xs text-slate-500">{selectedCategory?.name}</span>
                </div>

                {categoryNominees.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4">
                    No active nominees available in this category.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categoryNominees.map((nom) => {
                      const active = nom.id === selectedNomineeId;
                      return (
                        <button
                          key={nom.id}
                          type="button"
                          onClick={() => {
                            setSelectedNomineeId(nom.id);
                            setMomoPending(null);
                          }}
                          className={`text-left rounded-lg border overflow-hidden transition-all cursor-pointer ${
                            active
                              ? 'border-[#C59B27] ring-2 ring-[#C59B27] bg-[#FAF4E1]/40'
                              : 'border-slate-200 bg-white hover:border-slate-400'
                          }`}
                        >
                          <div className="aspect-[4/3] bg-slate-900 overflow-hidden">
                            <SafeImage
                              src={nom.photoUrl}
                              alt={nom.fullName}
                              fallbackTitle={nom.fullName}
                              className="w-full h-full object-cover object-top"
                            />
                          </div>
                          <div className="p-4 space-y-1">
                            <p className="font-mono text-[11px] text-[#9F7915]">{nom.nomineeNumber}</p>
                            <p className="font-serif font-semibold text-base text-[#0B192C]">
                              {nom.fullName}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {nom.organization || nom.roleTitle}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* Step 3: Free OTP Ballot OR Mobile Money Vote Pack */}
              {voteChannel === 'FREE_OTP' ? (
                <Card className="p-6 sm:p-8 bg-white space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h2 className="font-serif text-xl font-semibold text-[#0B192C]">
                      3. Citizen Verification & Ballot Confirmation
                    </h2>
                    <ShieldCheck className="h-5 w-5 text-[#C59B27]" />
                  </div>

                  {selectedNominee && (
                    <div className="rounded-md bg-slate-50 border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span>
                        Selected Ballot: <strong className="text-[#0B192C]">{selectedNominee.fullName}</strong>{' '}
                        <span className="text-slate-500">({selectedCategory?.name})</span>
                      </span>
                      <span className="font-mono text-xs text-[#9F7915]">{selectedNominee.nomineeNumber}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-700">Verification Channel</label>
                      <div className="flex gap-2">
                        {bootstrap.settings?.allowEmailOtp !== false && (
                          <button
                            type="button"
                            onClick={() => {
                              setMethod('EMAIL_OTP');
                              setOtpRequested(false);
                            }}
                            className={`flex-1 h-10 rounded-md text-xs font-medium border cursor-pointer ${
                              method === 'EMAIL_OTP'
                                ? 'bg-[#0B192C] text-white border-[#0B192C]'
                                : 'bg-white text-slate-700 border-slate-300'
                            }`}
                          >
                            Email OTP
                          </button>
                        )}
                        {bootstrap.settings?.allowPhoneOtp !== false && (
                          <button
                            type="button"
                            onClick={() => {
                              setMethod('PHONE_OTP');
                              setOtpRequested(false);
                            }}
                            className={`flex-1 h-10 rounded-md text-xs font-medium border cursor-pointer ${
                              method === 'PHONE_OTP'
                                ? 'bg-[#0B192C] text-white border-[#0B192C]'
                                : 'bg-white text-slate-700 border-slate-300'
                            }`}
                          >
                            Phone SMS OTP (+233 / Local)
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-700">
                        {method === 'EMAIL_OTP' ? 'Voter Email Address' : 'Ghana / Mobile Phone Number'}
                      </label>
                      <Input
                        type={method === 'EMAIL_OTP' ? 'email' : 'tel'}
                        value={contact}
                        onChange={(e) => setContact(e.target.value)}
                        placeholder={method === 'EMAIL_OTP' ? 'voter@domain.gh' : '0244 000 000 or +233244000000'}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-700">Ghana Region</label>
                      <select
                        value={ghanaRegion}
                        onChange={(e) => setGhanaRegion(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-[#0B192C]"
                      >
                        {ghanaRegions.map((reg) => (
                          <option key={reg} value={reg}>
                            {reg}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-700">
                        Ghana Card ID (Optional — Cross-Channel Protection)
                      </label>
                      <Input
                        value={ghanaCardNumber}
                        onChange={(e) => setGhanaCardNumber(e.target.value)}
                        placeholder="GHA-000000000-0"
                      />
                      <p className="text-[11px] text-slate-400">
                        One-way SHA-256 hashed server-side to prevent duplicate voting; raw ID is never stored.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-700">Full Name (Optional)</label>
                      <Input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Your name for ballot audit log"
                      />
                    </div>

                    {bootstrap.settings?.requireCaptcha !== false && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-slate-700">
                            Human Verification: {captcha?.question || 'Loading...'}
                          </label>
                          <button
                            type="button"
                            onClick={loadCaptcha}
                            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-[#0B192C] cursor-pointer"
                          >
                            <RefreshCw className="h-3 w-3" /> New Challenge
                          </button>
                        </div>
                        <Input
                          value={captchaAnswer}
                          onChange={(e) => setCaptchaAnswer(e.target.value)}
                          placeholder="Enter numeric answer"
                        />
                      </div>
                    )}
                  </div>

                  {bootstrap.settings?.requireOtp !== false ? (
                    <div className="space-y-4 pt-2 border-t border-slate-100">
                      {!otpRequested ? (
                        <Button
                          variant="default"
                          size="lg"
                          disabled={submitting}
                          onClick={handleRequestOtp}
                        >
                          {submitting ? 'Generating Verification Code...' : 'Request 6-Digit OTP Code'}
                        </Button>
                      ) : (
                        <div className="space-y-4">
                          <div className="rounded-md border border-[#C59B27]/40 bg-[#FAF4E1] p-4 text-sm text-[#0B192C]">
                            <p className="font-semibold">
                              Verification code sent to {maskedContact} ({deliveryChannel})
                            </p>
                            {otpPreview ? (
                              <p className="text-xs text-slate-700 mt-1">
                                Preview verification code (sandbox delivery):{' '}
                                <span className="font-mono font-bold text-[#0B192C]">{otpPreview}</span>
                              </p>
                            ) : (
                              <p className="text-xs text-slate-700 mt-1">
                                Check your {method === 'EMAIL_OTP' ? 'email inbox' : 'SMS messages'} for the 6-digit code.
                              </p>
                            )}
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                            <div className="space-y-1.5 flex-1 max-w-xs">
                              <label className="text-xs font-semibold text-slate-700">
                                Enter 6-Digit OTP Code
                              </label>
                              <Input
                                value={otpCode}
                                onChange={(e) => setOtpCode(e.target.value)}
                                maxLength={6}
                                placeholder="123456"
                                className="font-mono tracking-widest text-base"
                              />
                            </div>
                            <Button
                              variant="gold"
                              size="lg"
                              disabled={submitting}
                              onClick={handleSubmitVote}
                            >
                              {submitting ? 'Recording Ballot...' : 'Confirm & Cast Verified Vote'}
                            </Button>
                            <Button
                              variant="outline"
                              size="lg"
                              disabled={submitting}
                              onClick={handleRequestOtp}
                            >
                              Resend OTP
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="pt-2">
                      <Button
                        variant="gold"
                        size="lg"
                        disabled={submitting}
                        onClick={handleSubmitVote}
                      >
                        {submitting ? 'Recording Ballot...' : 'Confirm & Submit Vote'}
                      </Button>
                    </div>
                  )}
                </Card>
              ) : (
                /* Mobile Money Paid Vote Pack */
                <Card className="p-6 sm:p-8 bg-white space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h2 className="font-serif text-xl font-semibold text-[#0B192C]">
                        3. Ghana Mobile Money (MoMo) Vote Pack
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        GHS {votePriceGhs} per vote · Supports MTN MoMo, Telecel Cash, and AT Money
                      </p>
                    </div>
                    <Wallet className="h-5 w-5 text-[#C59B27]" />
                  </div>

                  {selectedNominee && (
                    <div className="rounded-md bg-slate-50 border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span>
                        Selected Nominee: <strong className="text-[#0B192C]">{selectedNominee.fullName}</strong>{' '}
                        <span className="text-slate-500">({selectedCategory?.name})</span>
                      </span>
                      <span className="font-mono text-xs text-[#9F7915]">{selectedNominee.nomineeNumber}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-700">Mobile Money Network</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['MTN', 'TELECEL', 'AT'] as const).map((net) => (
                          <button
                            key={net}
                            type="button"
                            onClick={() => {
                              setMomoNetwork(net);
                              setMomoPending(null);
                            }}
                            className={`h-10 rounded-md text-xs font-semibold border cursor-pointer ${
                              momoNetwork === net
                                ? 'bg-[#0B192C] text-white border-[#0B192C]'
                                : 'bg-white text-slate-700 border-slate-300'
                            }`}
                          >
                            {net === 'MTN' ? 'MTN MoMo' : net === 'TELECEL' ? 'Telecel Cash' : 'AT Money'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-700">Ghana MoMo Phone Number</label>
                      <Input
                        type="tel"
                        value={momoPhone}
                        onChange={(e) => setMomoPhone(e.target.value)}
                        placeholder="0244 000 000"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-700">Vote Pack Quantity (1 – 200)</label>
                      <div className="flex items-center gap-3">
                        <Input
                          type="number"
                          min={1}
                          max={200}
                          value={momoVotes}
                          onChange={(e) => {
                            setMomoVotes(Math.max(1, Math.min(200, Number(e.target.value) || 1)));
                            setMomoPending(null);
                          }}
                          className="w-28 font-mono"
                        />
                        <span className="text-sm font-semibold text-[#0B192C] tabular-nums">
                          Total: GHS {momoVotes * votePriceGhs}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-700">Ghana Region</label>
                      <select
                        value={ghanaRegion}
                        onChange={(e) => setGhanaRegion(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-[#0B192C]"
                      >
                        {ghanaRegions.map((reg) => (
                          <option key={reg} value={reg}>
                            {reg}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {!momoPending ? (
                    <Button variant="default" size="lg" disabled={submitting} onClick={handleInitiateMomo}>
                      {submitting
                        ? 'Initiating Mobile Money Prompt...'
                        : `Initiate GHS ${momoVotes * votePriceGhs} MoMo Vote Pack`}
                    </Button>
                  ) : (
                    <div className="rounded-lg border border-[#C59B27]/50 bg-[#FAF4E1] p-5 space-y-4">
                      <div className="space-y-1 text-sm text-[#0B192C]">
                        <p className="font-semibold">
                          Payment Prompt Pending on {momoPending.network} ({momoPending.maskedPhone})
                        </p>
                        <p className="text-xs text-slate-700">
                          Reference: <span className="font-mono font-semibold">{momoPending.reference}</span> ·{' '}
                          {momoPending.voteCount} votes · GHS {momoPending.amountGhs}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <Button variant="gold" size="lg" disabled={submitting} onClick={handleConfirmMomo}>
                          {submitting ? 'Confirming Settlement...' : 'Authorize & Confirm MoMo Votes'}
                        </Button>
                        <Button variant="outline" size="lg" onClick={() => setMomoPending(null)}>
                          Modify Order
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
