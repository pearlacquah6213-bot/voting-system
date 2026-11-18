import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Crown,
  Download,
  FileSpreadsheet,
  FileText,
  Pause,
  Play,
  Plus,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import { apiRequest } from '../../lib/api';
import { formatDateTime } from '../../lib/utils';
import type {
  AdminOverviewData,
  AdminRole,
  AdminUser,
  Award,
  Category,
  Nominee,
  SystemSettings,
  VoterSummary,
  VotingRecord,
} from '../../types';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';

// ==========================================
// 5. VOTING MANAGEMENT
// ==========================================

interface VotingManagerProps {
  settings: SystemSettings;
  categories: Category[];
  nominees: Nominee[];
  role: AdminRole;
  onRefresh: () => void;
}

export function VotingManager({
  settings,
  categories,
  nominees,
  role,
  onRefresh,
}: VotingManagerProps) {
  const canControl = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const [records, setRecords] = useState<VotingRecord[]>([]);
  const [maxVotes, setMaxVotes] = useState(settings.maxVotesPerCategory);

  useEffect(() => {
    if (canControl) {
      apiRequest<VotingRecord[]>('/api/admin/voting/records')
        .then(setRecords)
        .catch(() => {});
    }
  }, [canControl]);

  const togglePause = async () => {
    try {
      await apiRequest('/api/admin/voting/controls', {
        method: 'PATCH',
        body: JSON.stringify({ votingPaused: !settings.votingPaused }),
      });
      toast.success(settings.votingPaused ? 'Public voting resumed.' : 'Public voting paused.');
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unable to update voting state.');
    }
  };

  const updateMaxVotes = async () => {
    try {
      await apiRequest('/api/admin/voting/controls', {
        method: 'PATCH',
        body: JSON.stringify({ maxVotesPerCategory: Number(maxVotes) }),
      });
      toast.success('Voting restriction updated.');
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Update failed.');
    }
  };

  const toggleCategoryVoting = async (cat: Category) => {
    try {
      await apiRequest(`/api/admin/categories/${cat.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ votingEnabled: !cat.votingEnabled }),
      });
      toast.success(`Category voting ${cat.votingEnabled ? 'disabled' : 'enabled'}.`);
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to toggle category.');
    }
  };

  const exportVotingRecords = () => {
    const ws = XLSX.utils.json_to_sheet(records);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Verified Ballots');
    XLSX.writeFile(wb, 'black_star_voting_records.xlsx');
    toast.success('Voting records exported to Excel.');
  };

  if (!canControl) {
    return (
      <Card className="p-8 bg-white text-center text-sm text-slate-600">
        Voting governance controls require Admin or Super Admin privileges.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-[#0B192C]">Voting Management</h2>
          <p className="text-xs text-slate-500">
            Start, pause, or resume voting, manage category ballot locks, and export immutable ballot records.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant={settings.votingPaused ? 'gold' : 'destructive'} onClick={togglePause}>
            {settings.votingPaused ? (
              <>
                <Play className="h-4 w-4" /> Resume Voting
              </>
            ) : (
              <>
                <Pause className="h-4 w-4" /> Pause Voting
              </>
            )}
          </Button>
          <Button variant="outline" onClick={exportVotingRecords}>
            <Download className="h-4 w-4" /> Export Records
          </Button>
        </div>
      </div>

      {/* Restrictions Bar */}
      <Card className="p-5 bg-white flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[#0B192C]">
            Global Ballot Status: {settings.votingPaused ? 'Paused' : 'Live & Accepting Ballots'}
          </p>
          <p className="text-xs text-slate-500">
            OTP Required: {settings.requireOtp ? 'Yes' : 'No'} · CAPTCHA:{' '}
            {settings.requireCaptcha ? 'Enabled' : 'Disabled'} · Rate Limit:{' '}
            {settings.rateLimitPerMinute}/min
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Max Votes / Category</label>
            <Input
              type="number"
              min={1}
              max={10}
              value={maxVotes}
              onChange={(e) => setMaxVotes(Number(e.target.value))}
              className="w-28 h-9"
            />
          </div>
          <Button size="sm" onClick={updateMaxVotes}>
            Apply Rule
          </Button>
        </div>
      </Card>

      {/* Per-Category Controls */}
      <Card className="p-6 bg-white space-y-4">
        <h3 className="font-serif text-lg font-semibold text-[#0B192C]">
          Category Voting Controls
        </h3>
        <div className="divide-y divide-slate-100">
          {categories.map((cat) => {
            const catVotes = nominees
              .filter((n) => n.categoryId === cat.id)
              .reduce((acc, n) => acc + (n.voteCount ?? 0), 0);
            return (
              <div key={cat.id} className="py-3 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[#0B192C]">{cat.name}</p>
                  <p className="text-xs text-slate-500 tabular-nums">{catVotes} verified ballots recorded</p>
                </div>
                <Button
                  size="sm"
                  variant={cat.votingEnabled ? 'outline' : 'gold'}
                  onClick={() => toggleCategoryVoting(cat)}
                >
                  {cat.votingEnabled ? 'Disable Category' : 'Enable Category'}
                </Button>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Immutable Audit Records */}
      <Card className="bg-white overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-serif text-lg font-semibold text-[#0B192C]">
            Verified Ballot Ledger (Read-Only)
          </h3>
          <span className="text-xs text-slate-500 tabular-nums">{records.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Receipt</th>
                <th className="py-2.5 px-4 font-semibold">Category</th>
                <th className="py-2.5 px-4 font-semibold">Nominee</th>
                <th className="py-2.5 px-4 font-semibold">Region</th>
                <th className="py-2.5 px-4 font-semibold">Voter / Channel</th>
                <th className="py-2.5 px-4 font-semibold">Verification</th>
                <th className="py-2.5 px-4 font-semibold text-right">Votes</th>
                <th className="py-2.5 px-4 font-semibold text-right">Cast At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.slice(0, 30).map((r) => (
                <tr key={r.id}>
                  <td className="py-2.5 px-4 font-mono text-[#0B192C]">{r.receiptCode}</td>
                  <td className="py-2.5 px-4 text-slate-600">{r.categoryName}</td>
                  <td className="py-2.5 px-4 font-medium text-[#0B192C]">{r.nomineeName}</td>
                  <td className="py-2.5 px-4 text-slate-600">{r.ghanaRegion || 'Greater Accra'}</td>
                  <td className="py-2.5 px-4 font-mono text-slate-500">{r.voterCode}</td>
                  <td className="py-2.5 px-4 text-slate-500">{r.verificationMethod}</td>
                  <td className="py-2.5 px-4 text-right font-mono font-semibold text-[#9F7915] tabular-nums">
                    {r.voteCount ?? 1}
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-slate-500">
                    {formatDateTime(r.castAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ==========================================
// 6. RESULTS & ANALYTICS
// ==========================================

interface ResultsManagerProps {
  overview: AdminOverviewData;
  awards: Award[];
  categories: Category[];
  nominees: Nominee[];
  role: AdminRole;
  onRefresh: () => void;
}

export function ResultsManager({
  overview,
  categories,
  nominees,
  role,
  onRefresh,
}: ResultsManagerProps) {
  const canControl = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  const togglePublicResults = async () => {
    try {
      await apiRequest('/api/admin/voting/controls', {
        method: 'PATCH',
        body: JSON.stringify({ resultsPublic: !overview.settings.resultsPublic }),
      });
      toast.success(
        overview.settings.resultsPublic
          ? 'Public results hidden pending official announcement.'
          : 'Results published to the public website.'
      );
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unable to toggle visibility.');
    }
  };

  const announceWinner = async (nom: Nominee) => {
    try {
      await apiRequest(`/api/admin/nominees/${nom.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isWinner: !nom.isWinner }),
      });
      toast.success(
        nom.isWinner ? `Removed winner tag from ${nom.fullName}` : `${nom.fullName} announced as winner!`
      );
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update winner.');
    }
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Black Star Excellence Honours - Certified Results', 14, 18);
    doc.setFontSize(10);
    doc.text(`Total Verified Votes: ${overview.kpis.totalVotes} | Generated: ${new Date().toLocaleString()}`, 14, 26);

    let y = 38;
    for (const cat of categories) {
      if (y > 265) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(12);
      doc.text(cat.name, 14, y);
      y += 6;
      const catNoms = nominees
        .filter((n) => n.categoryId === cat.id)
        .sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0));
      const catTotal = catNoms.reduce((s, n) => s + (n.voteCount ?? 0), 0);
      doc.setFontSize(9);
      for (const n of catNoms) {
        const pct = catTotal > 0 ? (((n.voteCount ?? 0) / catTotal) * 100).toFixed(1) : '0.0';
        doc.text(
          `${n.nomineeNumber} - ${n.fullName}: ${n.voteCount ?? 0} votes (${pct}%)${n.isWinner ? ' [WINNER]' : ''}`,
          18,
          y
        );
        y += 5;
      }
      y += 5;
    }
    doc.save('black_star_certified_results.pdf');
    toast.success('Certified results exported as PDF.');
  };

  const exportExcel = () => {
    const rows = nominees.map((n) => ({
      NomineeNumber: n.nomineeNumber,
      FullName: n.fullName,
      Category: catMap.get(n.categoryId) || '',
      Organization: n.organization,
      VerifiedVotes: n.voteCount ?? 0,
      Winner: n.isWinner ? 'YES' : 'NO',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    XLSX.writeFile(wb, 'black_star_certified_results.xlsx');
    toast.success('Certified results exported to Excel.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-[#0B192C]">Results & Analytics</h2>
          <p className="text-xs text-slate-500">
            Monitor rankings, announce category winners, control public visibility, and export certified PDF or Excel reports.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canControl && (
            <Button
              variant={overview.settings.resultsPublic ? 'outline' : 'gold'}
              onClick={togglePublicResults}
            >
              {overview.settings.resultsPublic ? 'Hide Public Results' : 'Publish Results'}
            </Button>
          )}
          <Button variant="outline" onClick={exportPdf}>
            <FileText className="h-4 w-4" /> Export PDF
          </Button>
          <Button variant="outline" onClick={exportExcel}>
            <FileSpreadsheet className="h-4 w-4" /> Export Excel
          </Button>
        </div>
      </div>

      <Card className="p-6 bg-white">
        <h3 className="font-serif text-lg font-semibold text-[#0B192C] mb-4">
          Votes by Category
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={overview.votesPerCategory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="votes" fill="#C59B27" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="space-y-6">
        {categories.map((cat) => {
          const catNoms = nominees
            .filter((n) => n.categoryId === cat.id)
            .sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0));
          const catTotal = catNoms.reduce((s, n) => s + (n.voteCount ?? 0), 0);

          return (
            <Card key={cat.id} className="p-6 bg-white space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-serif text-lg font-semibold text-[#0B192C]">{cat.name}</h3>
                <span className="font-mono text-xs text-slate-500 tabular-nums">
                  {catTotal} total votes
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {catNoms.map((n, idx) => {
                  const pct = catTotal > 0 ? (((n.voteCount ?? 0) / catTotal) * 100).toFixed(1) : '0.0';
                  return (
                    <div key={n.id} className="py-3 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-semibold text-slate-400 w-6">
                          #{idx + 1}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-[#0B192C]">
                            {n.fullName}{' '}
                            {n.isWinner && (
                              <span className="text-xs font-semibold text-[#9F7915] ml-1.5">
                                · Winner
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500">{n.organization}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right font-mono tabular-nums">
                          <span className="text-sm font-semibold text-[#0B192C]">
                            {n.voteCount ?? 0} votes
                          </span>
                          <span className="text-xs text-[#9F7915] ml-2">({pct}%)</span>
                        </div>
                        {canControl && (
                          <Button
                            size="sm"
                            variant={n.isWinner ? 'gold' : 'outline'}
                            onClick={() => announceWinner(n)}
                          >
                            <Crown className="h-3.5 w-3.5" />
                            {n.isWinner ? 'Winner' : 'Announce Winner'}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ==========================================
// 7. VOTERS MANAGEMENT (PII PROTECTED)
// ==========================================

export function VotersManager({ role }: { role: AdminRole }) {
  const canView = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const [voters, setVoters] = useState<VoterSummary[]>([]);

  const loadVoters = () => {
    if (!canView) return;
    apiRequest<VoterSummary[]>('/api/admin/voters')
      .then(setVoters)
      .catch(() => {});
  };

  useEffect(() => {
    loadVoters();
  }, [canView]);

  const toggleFlag = async (v: VoterSummary) => {
    try {
      await apiRequest(`/api/admin/voters/${v.id}/flag`, {
        method: 'PATCH',
        body: JSON.stringify({
          flaggedSuspicious: !v.flaggedSuspicious,
          suspiciousReason: !v.flaggedSuspicious ? 'Flagged during manual ballot audit' : null,
        }),
      });
      toast.success(v.flaggedSuspicious ? 'Suspicious flag cleared.' : 'Voter flagged for review.');
      loadVoters();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unable to update voter flag.');
    }
  };

  if (!canView) {
    return (
      <Card className="p-8 bg-white text-center text-sm text-slate-600">
        Voter registry access requires Admin or Super Admin privileges.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-semibold text-[#0B192C]">Voters Management</h2>
        <p className="text-xs text-slate-500">
          Monitor verified voters, verification status, ballot counts, and suspicious activity indicators with strict PII masking.
        </p>
      </div>

      <Card className="bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-3 px-4 font-semibold">Voter ID</th>
                <th className="py-3 px-4 font-semibold">Masked Contact</th>
                <th className="py-3 px-4 font-semibold">Ghana Region</th>
                <th className="py-3 px-4 font-semibold">Verification</th>
                <th className="py-3 px-4 font-semibold text-right">Votes Cast</th>
                <th className="py-3 px-4 font-semibold">Integrity Status</th>
                <th className="py-3 px-4 font-semibold text-right">Registered</th>
                <th className="py-3 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {voters.map((v) => (
                <tr key={v.id} className={v.flaggedSuspicious ? 'bg-amber-50/50' : ''}>
                  <td className="py-3 px-4 font-mono font-semibold text-[#0B192C]">{v.voterCode}</td>
                  <td className="py-3 px-4 text-slate-600">{v.maskedContact}</td>
                  <td className="py-3 px-4 text-slate-700">{v.ghanaRegion || 'Greater Accra'}</td>
                  <td className="py-3 px-4 text-slate-600">
                    {v.verificationMethod} · {v.isVerified ? 'Verified' : 'Pending'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                    {v.votesCast}
                  </td>
                  <td className="py-3 px-4">
                    {v.flaggedSuspicious ? (
                      <span className="inline-flex items-center gap-1 text-amber-800 font-medium">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {v.suspiciousReason || 'Flagged'}
                      </span>
                    ) : (
                      <span className="text-slate-500">Normal</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums text-slate-500">
                    {formatDateTime(v.registeredAt)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Button size="sm" variant="outline" onClick={() => toggleFlag(v)}>
                      {v.flaggedSuspicious ? 'Clear Flag' : 'Flag'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ==========================================
// 8. ADMINISTRATORS (SUPER_ADMIN ONLY)
// ==========================================

const PERMISSION_OPTIONS = [
  { key: 'awards', label: 'Awards Management' },
  { key: 'categories', label: 'Categories Management' },
  { key: 'nominees', label: 'Nominees & Approvals' },
  { key: 'voting', label: 'Voting Controls & Records' },
  { key: 'results', label: 'Results & Winners' },
  { key: 'voters', label: 'Voters Registry' },
  { key: 'sponsors', label: 'Sponsors' },
  { key: 'announcements', label: 'Announcements' },
  { key: 'reports', label: 'Reports & Exports' },
  { key: 'audit_logs', label: 'Audit Logs' },
];

const DEFAULT_ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  SUPER_ADMIN: ['*'],
  ADMIN: ['awards', 'categories', 'nominees', 'voting', 'results', 'voters', 'sponsors', 'announcements', 'reports', 'audit_logs'],
  EDITOR: ['nominees', 'categories', 'announcements'],
};

export function AdministratorsManager({ currentAdmin }: { currentAdmin: AdminUser }) {
  const [adminsList, setAdminsList] = useState<AdminUser[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [permTarget, setPermTarget] = useState<AdminUser | null>(null);
  const [editingPerms, setEditingPerms] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AdminRole>('ADMIN');
  const [createPerms, setCreatePerms] = useState<string[]>(DEFAULT_ROLE_PERMISSIONS.ADMIN);
  const [saving, setSaving] = useState(false);

  const loadAdmins = () => {
    if (currentAdmin.role !== 'SUPER_ADMIN') return;
    apiRequest<AdminUser[]>('/api/admin/admins')
      .then(setAdminsList)
      .catch(() => {});
  };

  useEffect(() => {
    loadAdmins();
  }, [currentAdmin.role]);

  if (currentAdmin.role !== 'SUPER_ADMIN') {
    return (
      <Card className="p-8 bg-white text-center space-y-2">
        <ShieldAlert className="h-8 w-8 text-[#C59B27] mx-auto" />
        <h3 className="font-serif text-xl font-semibold text-[#0B192C]">Super Admin Access Required</h3>
        <p className="text-sm text-slate-500">
          Only a Super Admin can create administrator accounts, assign roles, or manage permissions.
        </p>
      </Card>
    );
  }

  const togglePerm = (list: string[], key: string): string[] =>
    list.includes(key) ? list.filter((p) => p !== key) : [...list, key];

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest('/api/admin/admins', {
        method: 'POST',
        body: JSON.stringify({
          email,
          fullName,
          password,
          role,
          permissions: role === 'SUPER_ADMIN' ? ['*'] : createPerms,
        }),
      });
      toast.success('Administrator account created.');
      setModalOpen(false);
      setEmail('');
      setFullName('');
      setPassword('');
      setRole('ADMIN');
      setCreatePerms(DEFAULT_ROLE_PERMISSIONS.ADMIN);
      loadAdmins();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unable to create admin.');
    } finally {
      setSaving(false);
    }
  };

  const openPermEditor = (a: AdminUser) => {
    setPermTarget(a);
    setEditingPerms(
      a.permissions && a.permissions.length > 0
        ? a.permissions
        : DEFAULT_ROLE_PERMISSIONS[a.role]
    );
  };

  const handleSavePermissions = async (e: FormEvent) => {
    e.preventDefault();
    if (!permTarget) return;
    setSaving(true);
    try {
      await apiRequest(`/api/admin/admins/${permTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          permissions: permTarget.role === 'SUPER_ADMIN' ? ['*'] : editingPerms,
        }),
      });
      toast.success(`Updated permissions for ${permTarget.fullName}.`);
      setPermTarget(null);
      loadAdmins();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unable to update permissions.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (a: AdminUser) => {
    try {
      await apiRequest(`/api/admin/admins/${a.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !a.isActive }),
      });
      toast.success('Administrator status updated.');
      loadAdmins();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Update failed.');
    }
  };

  const changeRole = async (a: AdminUser, newRole: AdminRole) => {
    try {
      await apiRequest(`/api/admin/admins/${a.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          role: newRole,
          permissions: DEFAULT_ROLE_PERMISSIONS[newRole],
        }),
      });
      toast.success(`Role updated to ${newRole}.`);
      loadAdmins();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Role update failed.');
    }
  };

  const deleteAdmin = async (id: number) => {
    try {
      await apiRequest(`/api/admin/admins/${id}`, { method: 'DELETE' });
      toast.success('Administrator removed.');
      loadAdmins();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-[#0B192C]">Administrators & RBAC</h2>
          <p className="text-xs text-slate-500">
            Create administrator accounts, assign server-enforced roles, configure granular module permissions, and control access.
          </p>
        </div>
        <Button variant="gold" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> Create Administrator
        </Button>
      </div>

      <Card className="bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-3 px-4 font-semibold">Administrator</th>
                <th className="py-3 px-4 font-semibold">Role</th>
                <th className="py-3 px-4 font-semibold">Module Permissions</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Last Login</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {adminsList.map((a) => (
                <tr key={a.id}>
                  <td className="py-3 px-4">
                    <p className="font-semibold text-sm text-[#0B192C]">{a.fullName}</p>
                    <p className="text-slate-500">{a.email}</p>
                  </td>
                  <td className="py-3 px-4">
                    <select
                      value={a.role}
                      disabled={a.id === currentAdmin.id}
                      onChange={(e) => changeRole(a, e.target.value as AdminRole)}
                      className="h-8 rounded border border-slate-300 bg-white px-2 text-xs font-medium"
                    >
                      <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                      <option value="ADMIN">ADMIN</option>
                      <option value="EDITOR">EDITOR</option>
                    </select>
                  </td>
                  <td className="py-3 px-4 text-slate-600 max-w-xs">
                    {a.role === 'SUPER_ADMIN' || a.permissions?.includes('*')
                      ? 'All Modules (*)'
                      : (a.permissions || []).join(', ') || 'None'}
                  </td>
                  <td className="py-3 px-4">{a.isActive ? 'Active' : 'Deactivated'}</td>
                  <td className="py-3 px-4 tabular-nums text-slate-500">
                    {formatDateTime(a.lastLoginAt)}
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    {a.id !== currentAdmin.id && (
                      <>
                        {a.role !== 'SUPER_ADMIN' && (
                          <Button size="sm" variant="outline" onClick={() => openPermEditor(a)}>
                            Permissions
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => toggleActive(a)}>
                          {a.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600"
                          onClick={() => deleteAdmin(a.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Administrator Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Administrator Account</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Full Name</label>
              <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Email Address</label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Role</label>
              <select
                value={role}
                onChange={(e) => {
                  const next = e.target.value as AdminRole;
                  setRole(next);
                  setCreatePerms(DEFAULT_ROLE_PERMISSIONS[next]);
                }}
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="SUPER_ADMIN">Super Admin (Full System Access)</option>
                <option value="ADMIN">Admin (Awards, Voting, Results, Reports)</option>
                <option value="EDITOR">Editor (Nominees & Category Content)</option>
              </select>
            </div>
            {role !== 'SUPER_ADMIN' && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700">Granular Module Permissions</label>
                <div className="grid grid-cols-2 gap-2 rounded-md border border-slate-200 p-3 bg-slate-50 text-xs">
                  {PERMISSION_OPTIONS.map((perm) => (
                    <label key={perm.key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createPerms.includes(perm.key)}
                        onChange={() => setCreatePerms((prev) => togglePerm(prev, perm.key))}
                      />
                      {perm.label}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Initial Password (min 8 chars)</label>
              <Input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="gold" disabled={saving}>
                {saving ? 'Creating...' : 'Create Account'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Permissions Modal */}
      <Dialog open={Boolean(permTarget)} onOpenChange={(open) => !open && setPermTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Permissions — {permTarget?.fullName}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSavePermissions} className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5 rounded-md border border-slate-200 p-4 bg-slate-50 text-xs">
              {PERMISSION_OPTIONS.map((perm) => (
                <label key={perm.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingPerms.includes(perm.key)}
                    onChange={() => setEditingPerms((prev) => togglePerm(prev, perm.key))}
                  />
                  {perm.label}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setPermTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="gold" disabled={saving}>
                {saving ? 'Saving...' : 'Save Permissions'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
