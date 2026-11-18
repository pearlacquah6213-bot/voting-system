import { useEffect, useState, type FormEvent } from 'react';
import { Download, FileText, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { apiRequest } from '../../lib/api';
import { formatDate, formatDateTime } from '../../lib/utils';
import type {
  AdminOverviewData,
  AdminRole,
  AdminUser,
  Announcement,
  AuditLogEntry,
  Category,
  Nominee,
  Sponsor,
  SystemSettings,
} from '../../types';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input, Textarea } from '../ui/input';
import { ImageUploadField } from './ImageUploadField';

// ==========================================
// 9. SPONSORS MANAGEMENT
// ==========================================

export function SponsorsManager({ role, onRefresh }: { role: AdminRole; onRefresh: () => void }) {
  const canManage = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const [list, setList] = useState<Sponsor[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Sponsor | null>(null);
  const [name, setName] = useState('');
  const [tier, setTier] = useState('Gold Patron');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [displayOrder, setDisplayOrder] = useState(1);

  const load = () => {
    apiRequest<Sponsor[]>('/api/admin/sponsors').then(setList).catch(() => {});
  };
  useEffect(() => {
    load();
  }, []);

  const openModal = (s?: Sponsor) => {
    setEditing(s || null);
    setName(s?.name || '');
    setTier(s?.tier || 'Gold Patron');
    setWebsiteUrl(s?.websiteUrl || '');
    setLogoUrl(s?.logoUrl || '');
    setDisplayOrder(s?.displayOrder ?? list.length + 1);
    setModalOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const payload = { name, tier, websiteUrl, logoUrl, displayOrder: Number(displayOrder) };
      if (editing) {
        await apiRequest(`/api/admin/sponsors/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/api/admin/sponsors', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      toast.success('Sponsor saved.');
      setModalOpen(false);
      load();
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unable to save sponsor.');
    }
  };

  const handleDelete = async (id: number) => {
    await apiRequest(`/api/admin/sponsors/${id}`, { method: 'DELETE' });
    toast.success('Sponsor removed.');
    load();
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-[#0B192C]">Sponsors Management</h2>
          <p className="text-xs text-slate-500">Manage partner names, tiers, logos, links, and display order.</p>
        </div>
        {canManage && (
          <Button variant="gold" onClick={() => openModal()}>
            <Plus className="h-4 w-4" /> Add Sponsor
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {list.map((sp) => (
          <Card key={sp.id} className="p-5 bg-white flex flex-col justify-between space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[#9F7915]">
                Order #{sp.displayOrder} · {sp.tier}
              </p>
              <h3 className="font-serif text-lg font-semibold text-[#0B192C]">{sp.name}</h3>
              <p className="text-xs text-slate-500 truncate">{sp.websiteUrl || 'No website linked'}</p>
            </div>
            {canManage && (
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <Button size="sm" variant="outline" onClick={() => openModal(sp)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 ml-auto"
                  onClick={() => handleDelete(sp.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Sponsor' : 'Add Sponsor'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Sponsor Name</label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Tier</label>
                <select
                  value={tier}
                  onChange={(e) => setTier(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                >
                  <option value="Title Partner">Title Partner</option>
                  <option value="Gold Patron">Gold Patron</option>
                  <option value="Supporting Partner">Supporting Partner</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Display Order</label>
                <Input
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Website URL</label>
              <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
            </div>
            <ImageUploadField label="Sponsor Logo" value={logoUrl} onChange={setLogoUrl} aspectClass="h-20 w-32" />
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="gold">
                Save Sponsor
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==========================================
// 10. ANNOUNCEMENTS MANAGEMENT
// ==========================================

export function AnnouncementsManager({
  role,
  onRefresh,
}: {
  role: AdminRole;
  onRefresh: () => void;
}) {
  const [list, setList] = useState<Announcement[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Governance');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [publishedAt, setPublishedAt] = useState(new Date().toISOString().slice(0, 10));
  const [isPublished, setIsPublished] = useState(true);

  const load = () => {
    apiRequest<Announcement[]>('/api/admin/announcements').then(setList).catch(() => {});
  };
  useEffect(() => {
    load();
  }, []);

  const openModal = (a?: Announcement) => {
    setEditing(a || null);
    setTitle(a?.title || '');
    setCategory(a?.category || 'Governance');
    setSummary(a?.summary || '');
    setContent(a?.content || '');
    setPublishedAt(a ? new Date(a.publishedAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
    setIsPublished(a?.isPublished ?? true);
    setModalOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const payload = { title, category, summary, content, publishedAt, isPublished };
      if (editing) {
        await apiRequest(`/api/admin/announcements/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/api/admin/announcements', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      toast.success('Announcement saved.');
      setModalOpen(false);
      load();
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unable to save announcement.');
    }
  };

  const handleDelete = async (id: number) => {
    await apiRequest(`/api/admin/announcements/${id}`, { method: 'DELETE' });
    toast.success('Announcement deleted.');
    load();
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-[#0B192C]">Announcements</h2>
          <p className="text-xs text-slate-500">Publish official press notices and voting updates to the public portal.</p>
        </div>
        <Button variant="gold" onClick={() => openModal()}>
          <Plus className="h-4 w-4" /> New Announcement
        </Button>
      </div>

      <div className="space-y-4">
        {list.map((a) => (
          <Card key={a.id} className="p-6 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs text-slate-500">
                <span className="font-semibold text-[#9F7915]">{a.category}</span> ·{' '}
                {formatDate(a.publishedAt)} · {a.isPublished ? 'Published' : 'Draft'}
              </p>
              <h3 className="font-serif text-lg font-semibold text-[#0B192C]">{a.title}</h3>
              <p className="text-sm text-slate-600">{a.summary}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => openModal(a)}>
                Edit
              </Button>
              {role !== 'EDITOR' && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600"
                  onClick={() => handleDelete(a.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Announcement' : 'Create Announcement'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Title</label>
              <Input required value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Category</label>
                <Input required value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Publish Date</label>
                <Input
                  type="date"
                  required
                  value={publishedAt}
                  onChange={(e) => setPublishedAt(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Summary</label>
              <Input required value={summary} onChange={(e) => setSummary(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Full Content</label>
              <Textarea required rows={5} value={content} onChange={(e) => setContent(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
              Published on Public Website
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="gold">
                Save Announcement
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==========================================
// 11. REPORTS
// ==========================================

export function ReportsManager({
  overview,
  categories,
  nominees,
}: {
  overview: AdminOverviewData;
  categories: Category[];
  nominees: Nominee[];
}) {
  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  const downloadExecutiveSummary = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Black Star Excellence Honours - Executive Audit Report', 14, 18);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 26);
    doc.text(`Total Awards: ${overview.kpis.totalAwards} | Active Awards: ${overview.kpis.activeAwards}`, 14, 34);
    doc.text(`Total Categories: ${overview.kpis.totalCategories} | Total Nominees: ${overview.kpis.totalNominees}`, 14, 41);
    doc.text(`Total Verified Votes: ${overview.kpis.totalVotes} | Total Verified Voters: ${overview.kpis.totalVoters}`, 14, 48);
    let y = 60;
    doc.setFontSize(12);
    doc.text('Category Turnout Summary', 14, y);
    y += 8;
    doc.setFontSize(10);
    for (const row of overview.votesPerCategory) {
      doc.text(`${row.name}: ${row.votes} votes`, 16, y);
      y += 7;
    }
    doc.save('black_star_executive_report.pdf');
    toast.success('Executive summary PDF downloaded.');
  };

  const downloadNomineesExcel = () => {
    const rows = nominees.map((n) => ({
      Number: n.nomineeNumber,
      Name: n.fullName,
      Organization: n.organization,
      Category: catMap.get(n.categoryId) || '',
      Status: n.nominationStatus,
      Votes: n.voteCount ?? 0,
      Winner: n.isWinner ? 'Yes' : 'No',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Nominees Report');
    XLSX.writeFile(wb, 'black_star_nominees_report.xlsx');
    toast.success('Nominees Excel report downloaded.');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-semibold text-[#0B192C]">Reports & Exports</h2>
        <p className="text-xs text-slate-500">
          Generate executive turnout PDFs, nominee performance spreadsheets, and inspect incoming contact inquiries.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 bg-white space-y-4">
          <FileText className="h-7 w-7 text-[#C59B27]" />
          <h3 className="font-serif text-lg font-semibold text-[#0B192C]">
            Executive Turnout & Governance Report
          </h3>
          <p className="text-sm text-slate-600">
            Official PDF summary covering all active awards, verified voter totals, and category ballot turnout.
          </p>
          <Button variant="default" onClick={downloadExecutiveSummary}>
            <Download className="h-4 w-4" /> Download PDF Report
          </Button>
        </Card>

        <Card className="p-6 bg-white space-y-4">
          <Download className="h-7 w-7 text-[#C59B27]" />
          <h3 className="font-serif text-lg font-semibold text-[#0B192C]">
            Nominee Ballot Performance Ledger
          </h3>
          <p className="text-sm text-slate-600">
            Complete Excel spreadsheet of all registered nominees, category assignments, statuses, and vote tallies.
          </p>
          <Button variant="gold" onClick={downloadNomineesExcel}>
            <Download className="h-4 w-4" /> Download Excel Ledger
          </Button>
        </Card>
      </div>

      <Card className="p-6 bg-white space-y-4">
        <h3 className="font-serif text-lg font-semibold text-[#0B192C]">
          Public Secretariat Contact Inquiries
        </h3>
        {overview.contactMessages.length === 0 ? (
          <p className="text-sm text-slate-500">No contact inquiries submitted yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {overview.contactMessages.map((msg) => (
              <div key={msg.id} className="py-3 space-y-1">
                <div className="flex justify-between text-xs text-slate-500">
                  <span className="font-semibold text-[#0B192C]">
                    {msg.fullName} ({msg.email})
                  </span>
                  <span className="tabular-nums">{formatDateTime(msg.createdAt)}</span>
                </div>
                <p className="text-xs font-semibold text-[#9F7915]">{msg.subject}</p>
                <p className="text-sm text-slate-600">{msg.message}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ==========================================
// 12. AUDIT LOGS
// ==========================================

export function AuditLogsManager({ role }: { role: AdminRole }) {
  const canView = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    if (canView) {
      apiRequest<AuditLogEntry[]>('/api/admin/audit-logs').then(setLogs).catch(() => {});
    }
  }, [canView]);

  if (!canView) {
    return (
      <Card className="p-8 bg-white text-center text-sm text-slate-600">
        Audit trail inspection requires Admin or Super Admin privileges.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-semibold text-[#0B192C]">Administrator Audit Logs</h2>
        <p className="text-xs text-slate-500">
          Immutable log of logins, award changes, nominee updates, image uploads, and security setting mutations.
        </p>
      </div>

      <Card className="bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-3 px-4 font-semibold">Timestamp</th>
                <th className="py-3 px-4 font-semibold">Administrator</th>
                <th className="py-3 px-4 font-semibold">Role</th>
                <th className="py-3 px-4 font-semibold">Action</th>
                <th className="py-3 px-4 font-semibold">Entity</th>
                <th className="py-3 px-4 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="py-2.5 px-4 tabular-nums text-slate-500 whitespace-nowrap">
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td className="py-2.5 px-4 font-medium text-[#0B192C]">{log.adminEmail}</td>
                  <td className="py-2.5 px-4 font-mono text-slate-600">{log.adminRole}</td>
                  <td className="py-2.5 px-4 font-mono font-semibold text-[#9F7915]">{log.action}</td>
                  <td className="py-2.5 px-4 text-slate-600">
                    {log.entityType} {log.entityId ? `#${log.entityId}` : ''}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 max-w-xs truncate">
                    {JSON.stringify(log.details)}
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
// 13. WEBSITE SETTINGS (SUPER_ADMIN ONLY)
// ==========================================

export function SettingsManager({
  settings,
  role,
  onRefresh,
}: {
  settings: SystemSettings;
  role: AdminRole;
  onRefresh: () => void;
}) {
  const [form, setForm] = useState<SystemSettings>(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  if (role !== 'SUPER_ADMIN') {
    return (
      <Card className="p-8 bg-white text-center space-y-2">
        <ShieldAlert className="h-8 w-8 text-[#C59B27] mx-auto" />
        <h3 className="font-serif text-xl font-semibold text-[#0B192C]">Super Admin Access Required</h3>
        <p className="text-sm text-slate-500">
          Only a Super Admin can modify global website settings, OTP rules, or maintenance mode.
        </p>
      </Card>
    );
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      toast.success('System settings saved.');
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unable to update settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-[#0B192C]">Website & Voting Settings</h2>
          <p className="text-xs text-slate-500">
            Configure branding, logo & favicon assets, Ghana Mobile Money / SMS / USSD gateways, and production lockdown.
          </p>
        </div>
        <Button type="submit" variant="gold" disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      <Card className="p-6 bg-white space-y-5">
        <h3 className="font-serif text-lg font-semibold text-[#0B192C]">Identity, Brand Assets & Contact</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ImageUploadField
            label="Website Logo"
            value={form.siteLogoUrl || ''}
            onChange={(url) => setForm({ ...form, siteLogoUrl: url })}
            aspectClass="h-20 w-20"
          />
          <ImageUploadField
            label="Browser Favicon"
            value={form.faviconUrl || ''}
            onChange={(url) => setForm({ ...form, faviconUrl: url })}
            aspectClass="h-16 w-16"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Website Name</label>
            <Input
              value={form.siteName}
              onChange={(e) => setForm({ ...form, siteName: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Tagline</label>
            <Input
              value={form.siteTagline}
              onChange={(e) => setForm({ ...form, siteTagline: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Contact Email</label>
            <Input
              value={form.contactEmail}
              onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Contact Phone</label>
            <Input
              value={form.contactPhone}
              onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">WhatsApp Support Number</label>
            <Input
              value={form.whatsappNumber || '0591593157'}
              onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })}
              placeholder="0591593157"
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Developer / Technical Partner</label>
            <Input
              value={form.developerName || 'Pearlicious Tech Solutions'}
              onChange={(e) => setForm({ ...form, developerName: e.target.value })}
              placeholder="Pearlicious Tech Solutions"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">Address</label>
          <Input
            value={form.contactAddress}
            onChange={(e) => setForm({ ...form, contactAddress: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">Website Description</label>
          <Textarea
            rows={3}
            value={form.siteDescription}
            onChange={(e) => setForm({ ...form, siteDescription: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Primary Navy Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.primaryColor || '#0B192C'}
                onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                className="h-10 w-12 rounded border border-slate-300 cursor-pointer"
              />
              <Input
                value={form.primaryColor}
                onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                className="font-mono"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Accent Gold Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.accentColor || '#C59B27'}
                onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                className="h-10 w-12 rounded border border-slate-300 cursor-pointer"
              />
              <Input
                value={form.accentColor}
                onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                className="font-mono"
              />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 bg-white space-y-4">
        <h3 className="font-serif text-lg font-semibold text-[#0B192C]">
          Ghana Mobile Money, SMS Gateway & USSD Settings
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Vote Pack Price (GHS / Vote)</label>
            <Input
              type="number"
              min={1}
              value={form.votePriceGhs ?? 2}
              onChange={(e) => setForm({ ...form, votePriceGhs: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Ghana SMS OTP Provider</label>
            <select
              value={form.smsProvider || 'ARKESEL'}
              onChange={(e) => setForm({ ...form, smsProvider: e.target.value })}
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="ARKESEL">Arkesel SMS Ghana</option>
              <option value="HUBTEL">Hubtel SMS Ghana</option>
              <option value="MNOTIFY">mNotify SMS Ghana</option>
              <option value="SANDBOX">Local Sandbox</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">USSD Shortcode</label>
            <Input
              value={form.ussdShortcode || '*714*88#'}
              onChange={(e) => setForm({ ...form, ussdShortcode: e.target.value })}
              className="font-mono"
            />
          </div>
        </div>
      </Card>

      <Card className="p-6 bg-white space-y-4">
        <h3 className="font-serif text-lg font-semibold text-[#0B192C]">Voting & Security Governance</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Max Votes per Category</label>
            <Input
              type="number"
              min={1}
              value={form.maxVotesPerCategory}
              onChange={(e) => setForm({ ...form, maxVotesPerCategory: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Rate Limit (Requests / Min)</label>
            <Input
              type="number"
              min={1}
              value={form.rateLimitPerMinute}
              onChange={(e) => setForm({ ...form, rateLimitPerMinute: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 text-xs font-medium">
          {[
            { key: 'requireOtp', label: 'Require OTP Verification' },
            { key: 'allowEmailOtp', label: 'Allow Email OTP' },
            { key: 'allowPhoneOtp', label: 'Allow Phone SMS OTP' },
            { key: 'requireCaptcha', label: 'Require Anti-Bot CAPTCHA' },
            { key: 'enforceSingleChannelPerVoter', label: 'Enforce Single Channel Per Voter' },
            { key: 'paidVotingEnabled', label: 'Enable MoMo Paid Vote Packs' },
            { key: 'resultsPublic', label: 'Public Results Visible' },
            { key: 'votingPaused', label: 'Pause All Voting' },
            { key: 'maintenanceMode', label: 'Maintenance Mode' },
            { key: 'productionMode', label: 'Production Lockdown (Hide Demos & OTP Previews)' },
          ].map((flag) => (
            <label key={flag.key} className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(form[flag.key as keyof SystemSettings])}
                onChange={(e) => setForm({ ...form, [flag.key]: e.target.checked })}
              />
              {flag.label}
            </label>
          ))}
        </div>
      </Card>
    </form>
  );
}

// ==========================================
// 14. ADMINISTRATOR PROFILE & CHANGE PASSWORD
// ==========================================

export function AdminProfileView({ admin }: { admin: AdminUser }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      toast.success('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unable to change password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-semibold text-[#0B192C]">Administrator Profile</h2>
        <p className="text-xs text-slate-500">Account identity, assigned governance role, and password security.</p>
      </div>

      <Card className="p-6 bg-white space-y-3 text-sm">
        <div className="flex justify-between border-b border-slate-100 pb-2">
          <span className="text-slate-500">Full Name</span>
          <span className="font-semibold text-[#0B192C]">{admin.fullName}</span>
        </div>
        <div className="flex justify-between border-b border-slate-100 pb-2">
          <span className="text-slate-500">Email</span>
          <span className="font-medium text-[#0B192C]">{admin.email}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Role</span>
          <span className="font-mono font-semibold text-[#9F7915]">{admin.role}</span>
        </div>
      </Card>

      <Card className="p-6 bg-white space-y-4">
        <h3 className="font-serif text-lg font-semibold text-[#0B192C]">Change Password</h3>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Current Password</label>
            <Input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
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
          <Button type="submit" variant="gold" disabled={saving}>
            {saving ? 'Updating...' : 'Update Password'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
