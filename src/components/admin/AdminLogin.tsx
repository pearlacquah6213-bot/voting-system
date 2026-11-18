import { useState, type FormEvent } from 'react';
import { ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
import { toast } from 'sonner';
import { apiRequest, setAuthToken } from '../../lib/api';
import { auth, googleAuthProvider } from '../../lib/firebase';
import { buildWhatsappUrl, formatGhanaLocalPhone } from '../../lib/utils';
import type { AdminUser } from '../../types';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';

interface AdminLoginProps {
  productionMode?: boolean;
  developerName?: string;
  whatsappNumber?: string;
  onSuccess: (admin: AdminUser) => void;
  onBackToSite: () => void;
}

export function AdminLogin({
  productionMode = false,
  developerName,
  whatsappNumber,
  onSuccess,
  onBackToSite,
}: AdminLoginProps) {
  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>('login');
  const [email, setEmail] = useState(productionMode ? '' : 'superadmin@blackstarhonours.gh');
  const [password, setPassword] = useState(productionMode ? '' : 'AwardsAdmin!2026');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetCodePreview, setResetCodePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePasswordLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; admin: AdminUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAuthToken(res.token);
      toast.success(`Signed in as ${res.admin.fullName}`);
      onSuccess(res.admin);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const credential = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await credential.user.getIdToken();
      setAuthToken(idToken);
      const res = await apiRequest<{ admin: AdminUser }>('/api/auth/firebase', {
        method: 'POST',
      });
      toast.success(`Signed in with Google as ${res.admin.fullName}`);
      onSuccess(res.admin);
    } catch (err: unknown) {
      setAuthToken(null);
      toast.error(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiRequest<{ message: string; resetCodePreview?: string }>(
        '/api/auth/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify({ email }),
        }
      );
      if (res.resetCodePreview) setResetCodePreview(res.resetCodePreview);
      toast.success(res.message);
      setMode('reset');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unable to send reset code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiRequest('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, resetCode, newPassword }),
      });
      toast.success('Password reset successfully. Sign in with your new password.');
      setMode('login');
      setPassword(newPassword);
      setResetCodePreview(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Reset failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#06101D] flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <button
          type="button"
          onClick={onBackToSite}
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-300 hover:text-[#D8B246] cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Return to Public Awards Portal
        </button>

        <Card className="p-8 bg-white space-y-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[#9F7915]">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-widest">
                Governance Console
              </span>
            </div>
            <h1 className="font-serif text-2xl font-semibold text-[#0B192C]">
              {mode === 'login'
                ? 'Administrator Sign In'
                : mode === 'forgot'
                ? 'Recover Access'
                : 'Set New Password'}
            </h1>
            <p className="text-xs text-slate-500">
              Restricted to authorised Super Admins, Admins, and Editors.
            </p>
          </div>

          {mode === 'login' && (
            <>
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Email Address</label>
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="superadmin@blackstarhonours.gh"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">Password</label>
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-xs text-[#9F7915] hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <Input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" variant="default" className="w-full" disabled={loading}>
                  {loading ? 'Authenticating...' : 'Sign In with Email'}
                </Button>
              </form>

              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-2 text-slate-400">Or continue with SSO</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={loading}
                onClick={handleGoogleSignIn}
              >
                Sign in with Google
              </Button>

              {!productionMode && (
                <div className="rounded-md bg-slate-50 border border-slate-200 p-3.5 text-xs text-slate-600 space-y-1.5">
                  <p className="font-semibold text-[#0B192C]">Role Accounts (Password: AwardsAdmin!2026)</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {[
                      { label: 'Super Admin', mail: 'superadmin@blackstarhonours.gh' },
                      { label: 'Admin', mail: 'admin@blackstarhonours.gh' },
                      { label: 'Editor', mail: 'editor@blackstarhonours.gh' },
                    ].map((acct) => (
                      <button
                        key={acct.mail}
                        type="button"
                        onClick={() => {
                          setEmail(acct.mail);
                          setPassword('AwardsAdmin!2026');
                        }}
                        className="px-2 py-1 rounded border border-slate-200 bg-white hover:border-[#0B192C] text-[11px] font-medium text-[#0B192C] cursor-pointer"
                      >
                        Use {acct.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Administrator Email</label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Sending...' : 'Request Reset Code'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setMode('login')}
              >
                Back to Sign In
              </Button>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              {resetCodePreview && (
                <div className="rounded-md bg-[#FAF4E1] border border-[#C59B27]/40 p-3 text-xs text-[#0B192C]">
                  <KeyRound className="h-3.5 w-3.5 inline mr-1.5 text-[#9F7915]" />
                  Reset code preview: <strong className="font-mono">{resetCodePreview}</strong>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Reset Code</label>
                <Input
                  required
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  placeholder="Enter reset code"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">New Password (min 8 chars)</label>
                <Input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <Button type="submit" variant="gold" className="w-full" disabled={loading}>
                {loading ? 'Updating...' : 'Reset Password'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setMode('login')}
              >
                Cancel
              </Button>
            </form>
          )}
        </Card>

        <p className="text-center text-xs text-slate-400">
          Engineered by{' '}
          <span className="text-[#D8B246] font-medium">
            {developerName || 'Pearlicious Tech Solutions'}
          </span>{' '}
          ·{' '}
          <a
            href={buildWhatsappUrl(
              whatsappNumber,
              'Hello Pearlicious Tech Solutions, I need admin login support.'
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono tabular-nums text-slate-300 hover:text-[#D8B246] transition-colors"
          >
            WhatsApp: {formatGhanaLocalPhone(whatsappNumber)}
          </a>
        </p>
      </div>
    </div>
  );
}
