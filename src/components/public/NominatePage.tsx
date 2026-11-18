import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { CheckCircle2, RefreshCw, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest } from '../../lib/api';
import type { PublicBootstrap } from '../../types';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input, Textarea } from '../ui/input';
import { SafeImage } from '../ui/SafeImage';
import type { PublicRoute } from './PublicLayout';

interface NominatePageProps {
  bootstrap: PublicBootstrap;
  onNavigate: (route: PublicRoute) => void;
}

interface CaptchaState {
  question: string;
  challengeToken: string;
}

export function NominatePage({ bootstrap, onNavigate }: NominatePageProps) {
  const activeCategories = bootstrap.categories;
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [categoryId, setCategoryId] = useState<number>(activeCategories[0]?.id || 0);
  const [fullName, setFullName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [organization, setOrganization] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [website, setWebsite] = useState('');
  const [biography, setBiography] = useState('');
  const [nominatedByEmail, setNominatedByEmail] = useState('');
  const [captcha, setCaptcha] = useState<CaptchaState | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);

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

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast.error('Please upload a JPEG, PNG, or WEBP portrait.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Portrait file size must be under 5 MB.');
      return;
    }

    const preview = URL.createObjectURL(file);
    setLocalPreview(preview);
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch('/api/public/upload-nomination-photo', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Photo upload failed.');
      }
      setPhotoUrl(json.url);
      toast.success('Nominee portrait uploaded.');
    } catch (err: unknown) {
      setLocalPreview(null);
      toast.error(err instanceof Error ? err.message : 'Unable to upload portrait.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!categoryId) {
      toast.error('Select an award category.');
      return;
    }
    if (!captcha?.challengeToken || !captchaAnswer.trim()) {
      toast.error('Please solve the human verification challenge.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest<{ ok: boolean; nomineeNumber: string; message: string }>(
        '/api/public/nominations',
        {
          method: 'POST',
          body: JSON.stringify({
            categoryId,
            fullName,
            roleTitle,
            organization,
            photoUrl: photoUrl || undefined,
            biography,
            nominatedByEmail,
            website: website || undefined,
            captchaToken: captcha.challengeToken,
            captchaAnswer: captchaAnswer.trim(),
          }),
        }
      );
      setSubmittedRef(res.nomineeNumber);
      toast.success(res.message);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Nomination submission failed.');
      loadCaptcha();
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubmittedRef(null);
    setFullName('');
    setRoleTitle('');
    setOrganization('');
    setPhotoUrl('');
    setLocalPreview(null);
    setWebsite('');
    setBiography('');
    loadCaptcha();
  };

  const previewSrc = localPreview || photoUrl;

  return (
    <div className="bg-slate-50 min-h-[75vh]">
      <section className="bg-[#0B192C] text-white py-14">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3">
          <p className="text-xs font-semibold tracking-widest uppercase text-[#D8B246]">
            Call for 2026 Nominations
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold">
            Nominate a Deserving Ghanaian Leader or Creator
          </h1>
          <p className="text-slate-300 text-sm max-w-2xl">
            Submit a public nomination for review by the Black Star Governance Committee. Approved entries are published directly to the official shortlist and ballot.
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {submittedRef ? (
            <Card className="p-8 sm:p-10 bg-white text-center space-y-5">
              <CheckCircle2 className="h-12 w-12 text-[#C59B27] mx-auto" />
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#9F7915]">
                  Dossier Received
                </p>
                <h2 className="font-serif text-3xl font-semibold text-[#0B192C]">
                  Nomination Submitted for Committee Review
                </h2>
                <p className="text-sm text-slate-600 max-w-lg mx-auto">
                  Your nomination for <strong>{fullName}</strong> has been queued for editorial verification under reference{' '}
                  <span className="font-mono font-semibold text-[#0B192C]">{submittedRef}</span>.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <Button variant="gold" onClick={resetForm}>
                  Submit Another Nomination
                </Button>
                <Button variant="outline" onClick={() => onNavigate({ page: 'nominees' })}>
                  Browse Current Nominees
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="p-6 sm:p-8 bg-white">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="font-serif text-2xl font-semibold text-[#0B192C]">
                    Candidate Dossier Form
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Provide accurate professional credentials and a verified portrait for committee vetting.
                  </p>
                </div>

                {/* Portrait Upload */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700">
                    Nominee Portrait Photograph (Optional)
                  </label>
                  <div className="flex items-start gap-4">
                    <div className="h-32 w-28 rounded-md border border-slate-200 overflow-hidden bg-slate-100 shrink-0 relative">
                      <SafeImage
                        src={previewSrc}
                        alt="Nominee preview"
                        fallbackTitle={fullName || 'Portrait'}
                        className="w-full h-full object-cover object-top"
                      />
                      {previewSrc && (
                        <button
                          type="button"
                          onClick={() => {
                            setLocalPreview(null);
                            setPhotoUrl('');
                          }}
                          aria-label="Clear portrait"
                          className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-[#0B192C]/80 text-white inline-flex items-center justify-center hover:bg-red-600 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="space-y-2 flex-1">
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingPhoto}
                        onClick={() => fileRef.current?.click()}
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {uploadingPhoto ? 'Uploading Portrait...' : previewSrc ? 'Replace Portrait' : 'Upload Portrait'}
                      </Button>
                      <p className="text-xs text-slate-500">
                        JPEG, PNG, or WEBP up to 5 MB. Stored persistently for committee review.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Award Category *</label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(Number(e.target.value))}
                      className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-[#0B192C]"
                    >
                      {activeCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Candidate Full Name *</label>
                    <Input
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Kwame Boateng"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Title / Profession *</label>
                    <Input
                      required
                      value={roleTitle}
                      onChange={(e) => setRoleTitle(e.target.value)}
                      placeholder="e.g. AgriTech Founder & Systems Architect"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Organization / Creative Studio
                    </label>
                    <Input
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      placeholder="e.g. Kumasi Innovation Hub"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Impact Citation & Biography (min 20 characters) *
                  </label>
                  <Textarea
                    required
                    minLength={20}
                    rows={4}
                    value={biography}
                    onChange={(e) => setBiography(e.target.value)}
                    placeholder="Summarise measurable achievements, Ghanaian community impact, and leadership credentials..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Your Email (Nominator) *</label>
                    <Input
                      type="email"
                      required
                      value={nominatedByEmail}
                      onChange={(e) => setNominatedByEmail(e.target.value)}
                      placeholder="nominator@domain.gh"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Portfolio / Website URL</label>
                    <Input
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div className="max-w-sm space-y-2 pt-1">
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
                    required
                    value={captchaAnswer}
                    onChange={(e) => setCaptchaAnswer(e.target.value)}
                    placeholder="Enter numeric answer"
                  />
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <Button type="submit" variant="gold" size="lg" disabled={submitting || uploadingPhoto}>
                    {submitting ? 'Submitting Nomination...' : 'Submit Official Nomination'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => onNavigate({ page: 'nominees' })}>
                    Back to Directory
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
