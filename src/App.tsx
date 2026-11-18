import { useCallback, useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminLogin } from './components/admin/AdminLogin';
import { AboutPage } from './components/public/AboutPage';
import { CategoriesPage } from './components/public/CategoriesPage';
import { ContactPage } from './components/public/ContactPage';
import { HomePage } from './components/public/HomePage';
import { NominatePage } from './components/public/NominatePage';
import { NomineeProfilePage } from './components/public/NomineeProfilePage';
import { NomineesPage } from './components/public/NomineesPage';
import { PublicLayout, type PublicRoute } from './components/public/PublicLayout';
import { ResultsPage } from './components/public/ResultsPage';
import { VerifyReceiptPage } from './components/public/VerifyReceiptPage';
import { VotingPage } from './components/public/VotingPage';
import { Button } from './components/ui/button';
import { apiRequest } from './lib/api';
import { supabase } from './lib/supabase';
import type { AdminUser, PublicBootstrap } from './types';

function parsePathToState(pathname: string, search = ''): { isAdmin: boolean; route: PublicRoute } {
  if (pathname.startsWith('/admin')) {
    return { isAdmin: true, route: { page: 'home' } };
  }
  if (pathname === '/about') return { isAdmin: false, route: { page: 'about' } };
  if (pathname === '/categories') return { isAdmin: false, route: { page: 'categories' } };
  if (pathname === '/nominees') return { isAdmin: false, route: { page: 'nominees' } };
  if (pathname.startsWith('/nominees/')) {
    const id = Number(pathname.split('/')[2]);
    if (Number.isInteger(id)) {
      return { isAdmin: false, route: { page: 'nominee-detail', nomineeId: id } };
    }
  }
  if (pathname === '/nominate') return { isAdmin: false, route: { page: 'nominate' } };
  if (pathname === '/verify') {
    const params = new URLSearchParams(search);
    return { isAdmin: false, route: { page: 'verify', code: params.get('code') || undefined } };
  }
  if (pathname === '/vote') return { isAdmin: false, route: { page: 'vote' } };
  if (pathname === '/results') return { isAdmin: false, route: { page: 'results' } };
  if (pathname === '/contact') return { isAdmin: false, route: { page: 'contact' } };
  return { isAdmin: false, route: { page: 'home' } };
}

function routeToPath(route: PublicRoute): string {
  switch (route.page) {
    case 'home':
      return '/';
    case 'about':
      return '/about';
    case 'categories':
      return '/categories';
    case 'nominees':
      return '/nominees';
    case 'nominee-detail':
      return `/nominees/${route.nomineeId}`;
    case 'nominate':
      return '/nominate';
    case 'verify':
      return route.code ? `/verify?code=${encodeURIComponent(route.code)}` : '/verify';
    case 'vote':
      return '/vote';
    case 'results':
      return '/results';
    case 'contact':
      return '/contact';
  }
}

export default function App() {
  const initial = parsePathToState(window.location.pathname, window.location.search);
  const [isAdminMode, setIsAdminMode] = useState(initial.isAdmin);
  const [route, setRoute] = useState<PublicRoute>(initial.route);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);

  const [bootstrap, setBootstrap] = useState<PublicBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchBootstrap = useCallback(async () => {
    try {
      setLoadError(null);
      const data = await apiRequest<PublicBootstrap>('/api/public/bootstrap');
      setBootstrap(data);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Unable to connect to awards portal.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBootstrap();
  }, [fetchBootstrap]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const channel = client
      .channel('public-portal-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, () => {
        fetchBootstrap();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'momo_transactions' }, () => {
        fetchBootstrap();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => {
        fetchBootstrap();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_settings' }, () => {
        fetchBootstrap();
      })
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [fetchBootstrap]);

  useEffect(() => {
    const onPopState = () => {
      const parsed = parsePathToState(window.location.pathname, window.location.search);
      setIsAdminMode(parsed.isAdmin);
      setRoute(parsed.route);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigatePublic = (nextRoute: PublicRoute) => {
    setIsAdminMode(false);
    setRoute(nextRoute);
    const targetPath = routeToPath(nextRoute);
    if (window.location.pathname + window.location.search !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openAdmin = () => {
    setIsAdminMode(true);
    if (!window.location.pathname.startsWith('/admin')) {
      window.history.pushState({}, '', '/admin');
    }
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      <Toaster position="top-right" richColors />

      {isAdminMode ? (
        adminUser ? (
          <AdminLayout
            admin={adminUser}
            developerName={bootstrap?.settings?.developerName}
            whatsappNumber={bootstrap?.settings?.whatsappNumber}
            onLogout={() => setAdminUser(null)}
            onExitToPublic={() => navigatePublic({ page: 'home' })}
            onPublicDataChanged={fetchBootstrap}
          />
        ) : (
          <AdminLogin
            productionMode={bootstrap?.settings?.productionMode}
            developerName={bootstrap?.settings?.developerName}
            whatsappNumber={bootstrap?.settings?.whatsappNumber}
            onSuccess={(admin) => setAdminUser(admin)}
            onBackToSite={() => navigatePublic({ page: 'home' })}
          />
        )
      ) : loading ? (
        <div className="min-h-screen bg-[#0B192C] flex flex-col items-center justify-center text-white px-4">
          <div className="h-10 w-10 rounded-full border-2 border-[#C59B27] border-t-transparent animate-spin mb-4" />
          <p className="font-serif text-xl tracking-wide">Black Star Excellence Honours</p>
        </div>
      ) : loadError || !bootstrap ? (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 text-center space-y-4">
          <h1 className="font-serif text-3xl font-semibold text-[#0B192C]">
            Unable to Load Awards Portal
          </h1>
          <p className="text-sm text-slate-600 max-w-md">{loadError || 'Service unavailable.'}</p>
          <Button variant="gold" onClick={fetchBootstrap}>
            Retry Connection
          </Button>
        </div>
      ) : (
        <PublicLayout
          bootstrap={bootstrap}
          route={route}
          onNavigate={navigatePublic}
          onOpenAdmin={openAdmin}
        >
          {route.page === 'home' && <HomePage bootstrap={bootstrap} onNavigate={navigatePublic} />}
          {route.page === 'about' && <AboutPage bootstrap={bootstrap} />}
          {route.page === 'categories' && (
            <CategoriesPage bootstrap={bootstrap} onNavigate={navigatePublic} />
          )}
          {route.page === 'nominees' && (
            <NomineesPage
              bootstrap={bootstrap}
              initialCategoryId={route.categoryId}
              onNavigate={navigatePublic}
            />
          )}
          {route.page === 'nominee-detail' && (
            <NomineeProfilePage
              bootstrap={bootstrap}
              nomineeId={route.nomineeId}
              onNavigate={navigatePublic}
            />
          )}
          {route.page === 'nominate' && (
            <NominatePage bootstrap={bootstrap} onNavigate={navigatePublic} />
          )}
          {route.page === 'verify' && (
            <VerifyReceiptPage
              bootstrap={bootstrap}
              initialCode={route.code}
              onNavigate={navigatePublic}
            />
          )}
          {route.page === 'vote' && (
            <VotingPage
              bootstrap={bootstrap}
              initialCategoryId={route.categoryId}
              initialNomineeId={route.nomineeId}
              onVoteRecorded={fetchBootstrap}
              onNavigate={navigatePublic}
            />
          )}
          {route.page === 'results' && (
            <ResultsPage bootstrap={bootstrap} onNavigate={navigatePublic} />
          )}
          {route.page === 'contact' && <ContactPage bootstrap={bootstrap} />}
        </PublicLayout>
      )}
    </>
  );
}
