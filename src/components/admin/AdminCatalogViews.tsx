import { useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, Crown, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import type { AdminRole, Award, Category, Nominee } from '../../types';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input, Textarea } from '../ui/input';
import { SafeImage } from '../ui/SafeImage';
import { ImageUploadField } from './ImageUploadField';

// ==========================================
// 2. AWARDS MANAGEMENT
// ==========================================

interface AwardsManagerProps {
  awards: Award[];
  role: AdminRole;
  onRefresh: () => void;
}

export function AwardsManager({ awards, role, onRefresh }: AwardsManagerProps) {
  const canManage = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Award | null>(null);
  const [title, setTitle] = useState('');
  const [editionYear, setEditionYear] = useState(new Date().getFullYear());
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [votingStartsAt, setVotingStartsAt] = useState('');
  const [votingEndsAt, setVotingEndsAt] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [resultsPublished, setResultsPublished] = useState(false);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setEditionYear(new Date().getFullYear());
    setTagline('');
    setDescription('');
    setLogoUrl('');
    setBannerUrl('/src/assets/images/hero_ghana_gala_1795036943453.jpg');
    const now = new Date();
    const end = new Date(now.getTime() + 30 * 86400000);
    setVotingStartsAt(now.toISOString().slice(0, 16));
    setVotingEndsAt(end.toISOString().slice(0, 16));
    setIsPublished(true);
    setIsActive(true);
    setResultsPublished(false);
    setModalOpen(true);
  };

  const openEdit = (a: Award) => {
    setEditing(a);
    setTitle(a.title);
    setEditionYear(a.editionYear);
    setTagline(a.tagline);
    setDescription(a.description);
    setLogoUrl(a.logoUrl || '');
    setBannerUrl(a.bannerUrl || '');
    setVotingStartsAt(new Date(a.votingStartsAt).toISOString().slice(0, 16));
    setVotingEndsAt(new Date(a.votingEndsAt).toISOString().slice(0, 16));
    setIsPublished(a.isPublished);
    setIsActive(a.isActive);
    setResultsPublished(a.resultsPublished);
    setModalOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title,
        editionYear: Number(editionYear),
        tagline,
        description,
        logoUrl,
        bannerUrl,
        votingStartsAt: new Date(votingStartsAt).toISOString(),
        votingEndsAt: new Date(votingEndsAt).toISOString(),
        isPublished,
        isActive,
        resultsPublished,
      };
      if (editing) {
        await apiRequest(`/api/admin/awards/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success('Award updated.');
      } else {
        await apiRequest('/api/admin/awards', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('New award created.');
      }
      setModalOpen(false);
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unable to save award.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiRequest(`/api/admin/awards/${id}`, { method: 'DELETE' });
      toast.success('Award removed.');
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const toggleField = async (a: Award, field: 'isActive' | 'isPublished' | 'resultsPublished') => {
    try {
      await apiRequest(`/api/admin/awards/${a.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ [field]: !a[field] }),
      });
      toast.success('Award status updated.');
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Update failed.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-[#0B192C]">Awards Events</h2>
          <p className="text-xs text-slate-500">
            Manage multiple awards editions, voting schedules, event banners, and publication states.
          </p>
        </div>
        {canManage && (
          <Button variant="gold" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Create Award
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {awards.map((a) => (
          <Card key={a.id} className="overflow-hidden bg-white flex flex-col justify-between">
            <div>
              <div className="aspect-[16/7] bg-slate-900 overflow-hidden">
                <SafeImage src={a.bannerUrl} alt={a.title} className="w-full h-full object-cover" />
              </div>
              <div className="p-6 space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono font-semibold text-[#9F7915]">{a.editionYear}</span>
                  <span>·</span>
                  <span>{a.isActive ? 'Active' : 'Archived'}</span>
                  <span>·</span>
                  <span>{a.isPublished ? 'Published' : 'Draft'}</span>
                  <span>·</span>
                  <span>{a.resultsPublished ? 'Results Public' : 'Results Hidden'}</span>
                </div>
                <h3 className="font-serif text-xl font-semibold text-[#0B192C]">{a.title}</h3>
                <p className="text-xs text-slate-500">{a.tagline}</p>
                <p className="text-sm text-slate-600 line-clamp-2">{a.description}</p>
                <div className="text-xs text-slate-500 pt-1 tabular-nums">
                  Voting window: {formatDate(a.votingStartsAt)} — {formatDate(a.votingEndsAt)}
                </div>
              </div>
            </div>

            {canManage && (
              <div className="px-6 pb-6 pt-2 flex flex-wrap items-center gap-2 border-t border-slate-100">
                <Button size="sm" variant="outline" onClick={() => openEdit(a)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button size="sm" variant="subtle" onClick={() => toggleField(a, 'isActive')}>
                  {a.isActive ? 'Deactivate' : 'Activate'}
                </Button>
                <Button size="sm" variant="subtle" onClick={() => toggleField(a, 'isPublished')}>
                  {a.isPublished ? 'Unpublish' : 'Publish'}
                </Button>
                <Button size="sm" variant="subtle" onClick={() => toggleField(a, 'resultsPublished')}>
                  {a.resultsPublished ? 'Hide Results' : 'Publish Results'}
                </Button>
                <Button size="sm" variant="ghost" className="text-red-600 ml-auto" onClick={() => handleDelete(a.id)}>
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
            <DialogTitle>{editing ? 'Edit Award Event' : 'Create New Award Event'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Award Title</label>
                <Input required value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Edition Year</label>
                <Input
                  type="number"
                  required
                  value={editionYear}
                  onChange={(e) => setEditionYear(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Tagline</label>
              <Input required value={tagline} onChange={(e) => setTagline(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Event Description</label>
              <Textarea required rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Voting Opens</label>
                <Input
                  type="datetime-local"
                  required
                  value={votingStartsAt}
                  onChange={(e) => setVotingStartsAt(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Voting Closes</label>
                <Input
                  type="datetime-local"
                  required
                  value={votingEndsAt}
                  onChange={(e) => setVotingEndsAt(e.target.value)}
                />
              </div>
            </div>
            <ImageUploadField label="Event Banner" value={bannerUrl} onChange={setBannerUrl} aspectClass="h-24 w-40" />
            <ImageUploadField label="Award Logo (Optional)" value={logoUrl} onChange={setLogoUrl} aspectClass="h-20 w-20" />
            <div className="flex flex-wrap gap-5 pt-2 text-xs font-medium">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
                Published on Website
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                Active Edition
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={resultsPublished}
                  onChange={(e) => setResultsPublished(e.target.checked)}
                />
                Results Public
              </label>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="gold" disabled={saving}>
                {saving ? 'Saving...' : 'Save Award'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==========================================
// 3. CATEGORIES MANAGEMENT
// ==========================================

interface CategoriesManagerProps {
  awards: Award[];
  categories: Category[];
  nominees: Nominee[];
  role: AdminRole;
  onRefresh: () => void;
}

export function CategoriesManager({
  awards,
  categories,
  nominees,
  role,
  onRefresh,
}: CategoriesManagerProps) {
  const canCreateDelete = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [awardId, setAwardId] = useState(awards[0]?.id || 0);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [displayOrder, setDisplayOrder] = useState(1);
  const [maxVotesPerVoter, setMaxVotesPerVoter] = useState(1);
  const [isActive, setIsActive] = useState(true);
  const [votingEnabled, setVotingEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  const awardNameMap = new Map(awards.map((a) => [a.id, a.title]));

  const openCreate = () => {
    setEditing(null);
    setAwardId(awards[0]?.id || 0);
    setName('');
    setDescription('');
    setImageUrl('/src/assets/images/cat_ghana_arts_1795036944175.jpg');
    setDisplayOrder(categories.length + 1);
    setMaxVotesPerVoter(1);
    setIsActive(true);
    setVotingEnabled(true);
    setModalOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditing(c);
    setAwardId(c.awardId);
    setName(c.name);
    setDescription(c.description);
    setImageUrl(c.imageUrl || '');
    setDisplayOrder(c.displayOrder);
    setMaxVotesPerVoter(c.maxVotesPerVoter);
    setIsActive(c.isActive);
    setVotingEnabled(c.votingEnabled);
    setModalOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        awardId: Number(awardId),
        name,
        description,
        imageUrl,
        displayOrder: Number(displayOrder),
        maxVotesPerVoter: Number(maxVotesPerVoter),
        isActive,
        votingEnabled,
      };
      if (editing) {
        await apiRequest(`/api/admin/categories/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success('Category updated.');
      } else {
        await apiRequest('/api/admin/categories', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Category created.');
      }
      setModalOpen(false);
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unable to save category.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiRequest(`/api/admin/categories/${id}`, { method: 'DELETE' });
      toast.success('Category deleted.');
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unable to delete category.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-[#0B192C]">Categories Management</h2>
          <p className="text-xs text-slate-500">
            Configure award categories, imagery, voting eligibility, and display ordering.
          </p>
        </div>
        {canCreateDelete && (
          <Button variant="gold" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Category
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((cat) => {
          const nomCount = nominees.filter((n) => n.categoryId === cat.id).length;
          return (
            <Card key={cat.id} className="overflow-hidden bg-white flex flex-col justify-between">
              <div>
                <div className="aspect-[16/9] bg-slate-100 overflow-hidden">
                  <SafeImage src={cat.imageUrl} alt={cat.name} className="w-full h-full object-cover" />
                </div>
                <div className="p-5 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{awardNameMap.get(cat.awardId) || 'Award'}</span>
                    <span>·</span>
                    <span className="tabular-nums font-medium text-[#9F7915]">{nomCount} Nominees</span>
                  </div>
                  <h3 className="font-serif text-lg font-semibold text-[#0B192C]">{cat.name}</h3>
                  <p className="text-xs text-slate-600 line-clamp-2">{cat.description}</p>
                  <p className="text-xs text-slate-400">
                    {cat.isActive ? 'Active' : 'Inactive'} · {cat.votingEnabled ? 'Voting Open' : 'Voting Disabled'}
                  </p>
                </div>
              </div>

              <div className="px-5 pb-5 pt-2 flex items-center gap-2 border-t border-slate-100">
                <Button size="sm" variant="outline" onClick={() => openEdit(cat)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                {canCreateDelete && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 ml-auto"
                    onClick={() => handleDelete(cat.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Category' : 'Add Award Category'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Award Event</label>
              <select
                value={awardId}
                onChange={(e) => setAwardId(Number(e.target.value))}
                disabled={role === 'EDITOR'}
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                {awards.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Category Name</label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Description</label>
              <Textarea required rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Display Order</label>
                <Input
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Max Votes per Voter</label>
                <Input
                  type="number"
                  min={1}
                  disabled={role === 'EDITOR'}
                  value={maxVotesPerVoter}
                  onChange={(e) => setMaxVotesPerVoter(Number(e.target.value))}
                />
              </div>
            </div>
            <ImageUploadField label="Category Image" value={imageUrl} onChange={setImageUrl} aspectClass="h-24 w-32" />
            {role !== 'EDITOR' && (
              <div className="flex gap-6 text-xs font-medium">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                  Active Category
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={votingEnabled}
                    onChange={(e) => setVotingEnabled(e.target.checked)}
                  />
                  Voting Enabled
                </label>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="gold" disabled={saving}>
                {saving ? 'Saving...' : 'Save Category'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==========================================
// 4. NOMINEES MANAGEMENT (MAJOR FEATURE)
// ==========================================

interface NomineesManagerProps {
  awards: Award[];
  categories: Category[];
  nominees: Nominee[];
  role: AdminRole;
  onRefresh: () => void;
}

export function NomineesManager({
  awards,
  categories,
  nominees,
  role,
  onRefresh,
}: NomineesManagerProps) {
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<number | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APPROVED' | 'PENDING' | 'ARCHIVED'>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Nominee | null>(null);

  const [awardId, setAwardId] = useState(awards[0]?.id || 0);
  const [categoryId, setCategoryId] = useState(categories[0]?.id || 0);
  const [nomineeNumber, setNomineeNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [organization, setOrganization] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [biography, setBiography] = useState('');
  const [website, setWebsite] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [twitter, setTwitter] = useState('');
  const [instagram, setInstagram] = useState('');
  const [nominationStatus, setNominationStatus] = useState<'APPROVED' | 'PENDING' | 'ARCHIVED'>('APPROVED');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const pendingCount = nominees.filter((n) => n.nominationStatus === 'PENDING').length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return nominees.filter((n) => {
      if (filterCat !== 'all' && n.categoryId !== filterCat) return false;
      if (statusFilter !== 'ALL' && n.nominationStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        n.fullName.toLowerCase().includes(q) ||
        n.nomineeNumber.toLowerCase().includes(q) ||
        n.organization.toLowerCase().includes(q)
      );
    });
  }, [nominees, search, filterCat, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setAwardId(awards[0]?.id || 0);
    setCategoryId(categories[0]?.id || 0);
    setNomineeNumber(`BSX-${Math.floor(500 + Math.random() * 450)}`);
    setFullName('');
    setRoleTitle('');
    setOrganization('');
    setPhotoUrl('');
    setBiography('');
    setWebsite('');
    setLinkedin('');
    setTwitter('');
    setInstagram('');
    setNominationStatus('APPROVED');
    setIsActive(true);
    setModalOpen(true);
  };

  const openEdit = (n: Nominee) => {
    setEditing(n);
    setAwardId(n.awardId);
    setCategoryId(n.categoryId);
    setNomineeNumber(n.nomineeNumber);
    setFullName(n.fullName);
    setRoleTitle(n.roleTitle);
    setOrganization(n.organization);
    setPhotoUrl(n.photoUrl || '');
    setBiography(n.biography);
    setWebsite(n.socialLinks?.website || '');
    setLinkedin(n.socialLinks?.linkedin || '');
    setTwitter(n.socialLinks?.twitter || '');
    setInstagram(n.socialLinks?.instagram || '');
    setNominationStatus(n.nominationStatus);
    setIsActive(n.isActive);
    setModalOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        awardId: Number(awardId),
        categoryId: Number(categoryId),
        nomineeNumber,
        fullName,
        roleTitle,
        organization,
        photoUrl,
        biography,
        socialLinks: { website, linkedin, twitter, instagram },
        nominationStatus,
        isActive,
      };
      if (editing) {
        await apiRequest(`/api/admin/nominees/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success('Nominee profile updated.');
      } else {
        await apiRequest('/api/admin/nominees', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Nominee added.');
      }
      setModalOpen(false);
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unable to save nominee.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (n: Nominee) => {
    try {
      await apiRequest(`/api/admin/nominees/${n.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !n.isActive }),
      });
      toast.success(n.isActive ? 'Nominee deactivated.' : 'Nominee activated.');
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Update failed.');
    }
  };

  const toggleWinner = async (n: Nominee) => {
    try {
      await apiRequest(`/api/admin/nominees/${n.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isWinner: !n.isWinner }),
      });
      toast.success(n.isWinner ? 'Winner designation removed.' : `${n.fullName} marked as winner.`);
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Permission required.');
    }
  };

  const approveNomination = async (n: Nominee) => {
    try {
      await apiRequest(`/api/admin/nominees/${n.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ nominationStatus: 'APPROVED', isActive: true }),
      });
      toast.success(`${n.fullName} approved and published to public ballot.`);
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Approval failed.');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiRequest(`/api/admin/nominees/${id}`, { method: 'DELETE' });
      toast.success('Nominee deleted.');
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-[#0B192C]">Nominees Management</h2>
          <p className="text-xs text-slate-500">
            Upload nominee portraits, review public nominations, filter by status or category, and monitor vote counts.
          </p>
        </div>
        <Button variant="gold" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Nominee
        </Button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: 'ALL', label: `All (${nominees.length})` },
            { key: 'APPROVED', label: 'Approved' },
            { key: 'PENDING', label: `Pending Public Nominations (${pendingCount})` },
            { key: 'ARCHIVED', label: 'Archived' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3.5 py-2 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
              statusFilter === tab.key
                ? 'bg-[#0B192C] text-white border-[#0B192C]'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search & Category Filter */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-lg border border-slate-200">
        <div className="relative flex-1">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, ID, or organization..."
            className="pl-9"
          />
        </div>
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-[#0B192C]"
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Nominees Table */}
      <Card className="bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-3 px-4 font-semibold">Nominee</th>
                <th className="py-3 px-4 font-semibold">Number</th>
                <th className="py-3 px-4 font-semibold">Category</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Votes</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((n) => (
                <tr key={n.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-md overflow-hidden bg-slate-900 shrink-0">
                        <SafeImage
                          src={n.photoUrl}
                          alt={n.fullName}
                          className="w-full h-full object-cover object-top"
                        />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-[#0B192C]">
                          {n.fullName}
                          {n.isWinner && (
                            <Crown className="h-3.5 w-3.5 text-[#C59B27] inline ml-1.5" />
                          )}
                        </p>
                        <p className="text-slate-500">
                          {n.roleTitle}{n.organization ? ` · ${n.organization}` : ''}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-[#9F7915]">{n.nomineeNumber}</td>
                  <td className="py-3 px-4 text-slate-700">{catMap.get(n.categoryId) || '—'}</td>
                  <td className="py-3 px-4">
                    <span className="text-slate-700">
                      {n.nominationStatus} · {n.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {n.nominatedByEmail && (
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Public by {n.nominatedByEmail}
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-semibold text-[#0B192C] tabular-nums">
                    {n.voteCount ?? 0}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      {n.nominationStatus === 'PENDING' && (
                        <Button size="sm" variant="gold" onClick={() => approveNomination(n)}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approve & Publish
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => openEdit(n)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="subtle" onClick={() => toggleActive(n)}>
                        {n.isActive ? 'Disable' : 'Enable'}
                      </Button>
                      {role !== 'EDITOR' && (
                        <>
                          <Button
                            size="sm"
                            variant={n.isWinner ? 'gold' : 'outline'}
                            onClick={() => toggleWinner(n)}
                            title="Toggle Winner"
                          >
                            <Crown className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600"
                            onClick={() => handleDelete(n.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Nominee Profile' : 'Add New Nominee'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <ImageUploadField
              label="Nominee Profile Photograph"
              value={photoUrl}
              onChange={setPhotoUrl}
              aspectClass="h-36 w-28"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Full Name</label>
                <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Nominee Number</label>
                <Input required value={nomineeNumber} onChange={(e) => setNomineeNumber(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Award Event</label>
                <select
                  value={awardId}
                  onChange={(e) => setAwardId(Number(e.target.value))}
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                >
                  {awards.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Award Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(Number(e.target.value))}
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Role / Title</label>
                <Input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Organization / Studio</label>
                <Input value={organization} onChange={(e) => setOrganization(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Biography</label>
              <Textarea required rows={4} value={biography} onChange={(e) => setBiography(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                placeholder="Website URL"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
              <Input
                placeholder="LinkedIn URL"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
              />
              <Input
                placeholder="X / Twitter URL"
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
              />
              <Input
                placeholder="Instagram URL"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 items-center">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Nomination Status</label>
                <select
                  value={nominationStatus}
                  onChange={(e) =>
                    setNominationStatus(e.target.value as 'APPROVED' | 'PENDING' | 'ARCHIVED')
                  }
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                >
                  <option value="APPROVED">Approved</option>
                  <option value="PENDING">Pending Review</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs font-medium pt-5 cursor-pointer">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                Active on Public Website
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="gold" disabled={saving}>
                {saving ? 'Saving...' : 'Save Nominee'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
