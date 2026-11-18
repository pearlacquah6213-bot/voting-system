import { useEffect, useState } from 'react';
import {
  Award as AwardIcon,
  BarChart3,
  Bell,
  FileBarChart,
  FolderKanban,
  Handshake,
  History,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Settings,
  ShieldCheck,
  UserCheck,
  UserCircle,
  Users,
  Vote,
  X,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { toast } from 'sonner';
import { apiRequest, setAuthToken } from '../../lib/api';
import { auth } from '../../lib/firebase';
import { buildWhatsappUrl, formatGhanaLocalPhone } from '../../lib/utils';
import type { AdminOverviewData, AdminUser, Award, Category, Nominee } from '../../types';
import { Button } from '../ui/button';
import { AwardsManager, CategoriesManager, NomineesManager } from './AdminCatalogViews';
import {
  AnnouncementsManager,
  AuditLogsManager,
  AdminProfileView,
  ReportsManager,
  SettingsManager,
  SponsorsManager,
} from './AdminGovernanceViews';
import {
  AdministratorsManager,
  ResultsManager,
  VotersManager,
  VotingManager,
} from './AdminOperationsViews';
import { AdminOverview } from './AdminOverview';

type AdminTab =
  | 'overview'
  | 'awards'
  | 'categories'
  | 'nominees'
  | 'voting'
  | 'results'
  | 'voters'
  | 'administrators'
  | 'sponsors'
  | 'announcements'
  | 'reports'
  | 'audit-logs'
  | 'settings'
  | 'profile';

interface AdminLayoutProps {
  admin: AdminUser;
  developerName?: string;
  whatsappNumber?: string;
  onLogout: () => void;
  onExitToPublic: () => void;
  onPublicDataChanged: () => void;
}

const SIDEBAR_ITEMS: Array<{ key: AdminTab; label: string; icon: typeof LayoutDashboard }> = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'awards', label: 'Awards Management', icon: AwardIcon },
  { key: 'categories', label: 'Categories Management', icon: FolderKanban },
  { key: 'nominees', label: 'Nominees Management', icon: Users },
  { key: 'voting', label: 'Voting Management', icon: Vote },
  { key: 'results', label: 'Results & Analytics', icon: BarChart3 },
  { key: 'voters', label: 'Voters Management', icon: UserCheck },
  { key: 'administrators', label: 'Administrators', icon: ShieldCheck },
  { key: 'sponsors', label: 'Sponsors', icon: Handshake },
  { key: 'announcements', label: 'Announcements', icon: Megaphone },
  { key: 'reports', label: 'Reports', icon: FileBarChart },
  { key: 'audit-logs', label: 'Audit Logs', icon: History },
  { key: 'settings', label: 'Website Settings', icon: Settings },
  { key: 'profile', label: 'Profile', icon: UserCircle },
];

export function AdminLayout({
  admin,
  developerName,
  whatsappNumber,
  onLogout,
  onExitToPublic,
  onPublicDataChanged,
}: AdminLayoutProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [awards, setAwards] = useState<Award[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [nominees, setNominees] = useState<Nominee[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAllAdminData = async () => {
    try {
      const [ov, aw, ca, no] = await Promise.all([
        apiRequest<AdminOverviewData>('/api/admin/overview'),
        apiRequest<Award[]>('/api/admin/awards'),
        apiRequest<Category[]>('/api/admin/categories'),
        apiRequest<Nominee[]>('/api/admin/nominees'),
      ]);
      setOverview(ov);
      setAwards(aw);
      setCategories(ca);
      setNominees(no);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unable to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllAdminData();
  }, []);

  const refreshAll = () => {
    loadAllAdminData();
    onPublicDataChanged();
  };

  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {});
      await signOut(auth).catch(() => {});
    } finally {
      setAuthToken(null);
      toast.success('Signed out securely.');
      onLogout();
    }
  };

  const currentLabel = SIDEBAR_ITEMS.find((i) => i.key === activeTab)?.label || 'Overview';

  const SidebarNav = (
    <div className="flex flex-col h-full bg-[#0B192C] text-slate-200 w-64 shrink-0">
      <div className="px-5 py-5 border-b border-[#1E3A5F]">
        <p className="font-serif text-lg font-semibold text-white">Black Star Console</p>
        <p className="text-xs text-[#D8B246] font-mono mt-0.5">{admin.role}</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {SIDEBAR_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setActiveTab(item.key);
                setMobileOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                active
                  ? 'bg-[#C59B27] text-[#06101D] font-semibold'
                  : 'text-slate-300 hover:bg-[#132844] hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-[#1E3A5F] space-y-2.5">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium text-slate-300 hover:bg-red-900/40 hover:text-white transition-colors cursor-pointer"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Logout</span>
        </button>
        <div className="px-3 pt-2 border-t border-[#1E3A5F]/70 text-[11px] text-slate-400 space-y-0.5">
          <p className="text-slate-500">Developed by</p>
          <p className="font-semibold text-[#D8B246] truncate">
            {overview?.settings?.developerName || developerName || 'Pearlicious Tech Solutions'}
          </p>
          <a
            href={buildWhatsappUrl(
              overview?.settings?.whatsappNumber || whatsappNumber,
              'Hello Pearlicious Tech Solutions, I need administrator support.'
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block font-mono tabular-nums text-slate-300 hover:text-white transition-colors"
          >
            WA: {formatGhanaLocalPhone(overview?.settings?.whatsappNumber || whatsappNumber)}
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex">{SidebarNav}</aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 flex">
            {SidebarNav}
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-white"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden h-9 w-9 inline-flex items-center justify-center rounded-md border border-slate-200 text-[#0B192C]"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="text-sm text-slate-500 truncate">
              <span>Admin</span>
              <span className="mx-2">/</span>
              <span className="font-semibold text-[#0B192C]">{currentLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline text-xs text-slate-500">
              {admin.fullName}
            </span>
            {overview && overview.notifications.some((n) => !n.isRead) && (
              <button
                type="button"
                onClick={async () => {
                  await apiRequest('/api/admin/notifications/read-all', { method: 'POST' });
                  toast.success('All notifications marked read.');
                  loadAllAdminData();
                }}
                title="Mark notifications read"
                className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-slate-200 text-[#9F7915] hover:bg-slate-50 cursor-pointer"
              >
                <Bell className="h-4 w-4" />
              </button>
            )}
            <Button size="sm" variant="outline" onClick={onExitToPublic}>
              View Public Site
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {loading || !overview ? (
            <div className="space-y-4">
              <div className="h-24 rounded-lg bg-slate-200/70 animate-pulse" />
              <div className="h-64 rounded-lg bg-slate-200/70 animate-pulse" />
            </div>
          ) : (
            <>
              {activeTab === 'overview' && <AdminOverview data={overview} />}
              {activeTab === 'awards' && (
                <AwardsManager awards={awards} role={admin.role} onRefresh={refreshAll} />
              )}
              {activeTab === 'categories' && (
                <CategoriesManager
                  awards={awards}
                  categories={categories}
                  nominees={nominees}
                  role={admin.role}
                  onRefresh={refreshAll}
                />
              )}
              {activeTab === 'nominees' && (
                <NomineesManager
                  awards={awards}
                  categories={categories}
                  nominees={nominees}
                  role={admin.role}
                  onRefresh={refreshAll}
                />
              )}
              {activeTab === 'voting' && (
                <VotingManager
                  settings={overview.settings}
                  categories={categories}
                  nominees={nominees}
                  role={admin.role}
                  onRefresh={refreshAll}
                />
              )}
              {activeTab === 'results' && (
                <ResultsManager
                  overview={overview}
                  awards={awards}
                  categories={categories}
                  nominees={nominees}
                  role={admin.role}
                  onRefresh={refreshAll}
                />
              )}
              {activeTab === 'voters' && <VotersManager role={admin.role} />}
              {activeTab === 'administrators' && <AdministratorsManager currentAdmin={admin} />}
              {activeTab === 'sponsors' && (
                <SponsorsManager role={admin.role} onRefresh={refreshAll} />
              )}
              {activeTab === 'announcements' && (
                <AnnouncementsManager role={admin.role} onRefresh={refreshAll} />
              )}
              {activeTab === 'reports' && (
                <ReportsManager overview={overview} categories={categories} nominees={nominees} />
              )}
              {activeTab === 'audit-logs' && <AuditLogsManager role={admin.role} />}
              {activeTab === 'settings' && (
                <SettingsManager
                  settings={overview.settings}
                  role={admin.role}
                  onRefresh={refreshAll}
                />
              )}
              {activeTab === 'profile' && <AdminProfileView admin={admin} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
