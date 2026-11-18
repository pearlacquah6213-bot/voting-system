import { useEffect, useState, type ReactNode } from 'react';
import { Bell, Mail, MapPin, Menu, MessageCircle, Phone, ShieldCheck, X } from 'lucide-react';
import { Button } from '../ui/button';
import { SafeImage } from '../ui/SafeImage';
import type { PublicBootstrap } from '../../types';
import {
  buildWhatsappUrl,
  formatDate,
  formatGhanaLocalPhone,
} from '../../lib/utils';
import { WhatsAppHoverWidget } from './WhatsAppHoverWidget';

export type PublicRoute =
  | { page: 'home' }
  | { page: 'about' }
  | { page: 'categories' }
  | { page: 'nominees'; categoryId?: number }
  | { page: 'nominee-detail'; nomineeId: number }
  | { page: 'vote'; categoryId?: number; nomineeId?: number }
  | { page: 'results' }
  | { page: 'contact' }
  | { page: 'verify'; code?: string }
  | { page: 'nominate' };

interface PublicLayoutProps {
  bootstrap: PublicBootstrap;
  route: PublicRoute;
  onNavigate: (route: PublicRoute) => void;
  onOpenAdmin: () => void;
  children: ReactNode;
}

const NAV_ITEMS: Array<{ key: PublicRoute['page']; label: string }> = [
  { key: 'home', label: 'Home' },
  { key: 'about', label: 'About' },
  { key: 'categories', label: 'Categories' },
  { key: 'nominees', label: 'Nominees' },
  { key: 'vote', label: 'Vote' },
  { key: 'results', label: 'Results' },
  { key: 'contact', label: 'Contact' },
];

export function PublicLayout({
  bootstrap,
  route,
  onNavigate,
  onOpenAdmin,
  children,
}: PublicLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { settings, notifications } = bootstrap;

  useEffect(() => {
    if (!settings) return;
    if (settings.primaryColor) {
      document.documentElement.style.setProperty('--brand-primary', settings.primaryColor);
    }
    if (settings.accentColor) {
      document.documentElement.style.setProperty('--brand-accent', settings.accentColor);
    }
    if (settings.faviconUrl) {
      let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = settings.faviconUrl;
    }
  }, [settings]);

  const isCurrent = (key: PublicRoute['page']) => {
    if (key === 'nominees' && (route.page === 'nominee-detail' || route.page === 'nominate')) {
      return true;
    }
    if (key === 'vote' && route.page === 'verify') {
      return true;
    }
    return route.page === key;
  };

  if (settings?.maintenanceMode) {
    return (
      <div
        className="min-h-screen text-white flex flex-col items-center justify-center px-6 text-center"
        style={{ backgroundColor: settings.primaryColor || '#0B192C' }}
      >
        <ShieldCheck className="h-12 w-12 text-[#C59B27] mb-5" />
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-3">
          {settings.siteName}
        </h1>
        <p className="max-w-lg text-slate-300 text-base leading-relaxed mb-8">
          The awards and voting portal is undergoing scheduled governance maintenance. Ballot integrity remains preserved and public access will resume shortly.
        </p>
        <Button variant="gold" onClick={onOpenAdmin}>
          Administrator Access
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0B192C]">
      {/* Strict 3-Zone Top Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
          {/* Zone 1: Single-line Brand Wordmark + Optional Uploaded Logo */}
          <button
            type="button"
            onClick={() => onNavigate({ page: 'home' })}
            className="inline-flex items-center gap-2.5 text-left font-serif text-lg sm:text-xl font-bold tracking-tight text-[#0B192C] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] rounded-sm"
          >
            {settings?.siteLogoUrl && (
              <span className="h-8 w-8 rounded overflow-hidden border border-slate-200 bg-slate-50 shrink-0">
                <SafeImage
                  src={settings.siteLogoUrl}
                  alt={settings.siteName}
                  className="w-full h-full object-contain"
                />
              </span>
            )}
            <span>{settings?.siteName || 'Black Star Honours'}</span>
          </button>

          {/* Zone 2: Clean single-line text navigation */}
          <nav className="hidden lg:flex items-center gap-6" aria-label="Primary navigation">
            {NAV_ITEMS.map((item) => {
              const active = isCurrent(item.key);
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onNavigate({ page: item.key } as PublicRoute)}
                  className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] rounded-sm ${
                    active ? 'text-[#0B192C]' : 'text-slate-600 hover:text-[#0B192C]'
                  }`}
                >
                  {item.label}
                  {active && (
                    <span
                      className="absolute left-0 right-0 -bottom-0.5 h-0.5"
                      style={{ backgroundColor: settings?.accentColor || '#C59B27' }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action + mobile menu trigger */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => setNotifOpen((prev) => !prev)}
                aria-label="Portal updates"
                className="h-9 w-9 inline-flex items-center justify-center rounded-md text-slate-600 hover:text-[#0B192C] hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <Bell className="h-4 w-4" />
              </button>
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-lg border border-slate-200 bg-white shadow-lg p-4 z-50">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                    <span className="text-xs font-semibold tracking-wide text-[#0B192C]">
                      Portal Notices
                    </span>
                    <button
                      type="button"
                      onClick={() => setNotifOpen(false)}
                      className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                  <div className="space-y-3 max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-slate-500">No recent notices.</p>
                    ) : (
                      notifications.slice(0, 5).map((n) => (
                        <div key={n.id} className="text-xs border-b border-slate-100 last:border-0 pb-2.5 last:pb-0">
                          <p className="font-semibold text-[#0B192C]">{n.title}</p>
                          <p className="text-slate-600 mt-0.5">{n.message}</p>
                          <p className="text-slate-400 mt-1">{formatDate(n.createdAt)}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <Button
              size="sm"
              variant="default"
              onClick={onOpenAdmin}
              className="hidden sm:inline-flex"
            >
              Admin Portal
            </Button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle menu"
              className="lg:hidden h-10 w-10 inline-flex items-center justify-center rounded-md border border-slate-200 text-[#0B192C] hover:bg-slate-50 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-2">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  onNavigate({ page: item.key } as PublicRoute);
                  setMobileMenuOpen(false);
                }}
                className={`block w-full text-left px-3 py-2.5 rounded-md text-sm font-medium ${
                  isCurrent(item.key)
                    ? 'bg-[#0B192C] text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                onNavigate({ page: 'nominate' });
                setMobileMenuOpen(false);
              }}
              className="block w-full text-left px-3 py-2.5 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Submit Public Nomination
            </button>
            <button
              type="button"
              onClick={() => {
                onNavigate({ page: 'verify' });
                setMobileMenuOpen(false);
              }}
              className="block w-full text-left px-3 py-2.5 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Verify Ballot Receipt
            </button>
            <div className="pt-2 border-t border-slate-100">
              <Button
                className="w-full"
                variant="gold"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAdmin();
                }}
              >
                Admin Portal
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Editorial Footer */}
      <footer
        className="text-slate-300 border-t border-[#1E3A5F]"
        style={{ backgroundColor: settings?.primaryColor || '#0B192C' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-10 border-b border-[#1E3A5F]">
            <div className="md:col-span-5 space-y-4">
              <h2 className="font-serif text-2xl font-semibold text-white">
                {settings?.siteName || 'Black Star Excellence Honours'}
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed max-w-md">
                {settings?.siteDescription}
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-slate-400">
                {settings?.socialLinks?.twitter && (
                  <a
                    href={settings.socialLinks.twitter}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#D8B246] transition-colors"
                  >
                    X / Twitter
                  </a>
                )}
                {settings?.socialLinks?.linkedin && (
                  <a
                    href={settings.socialLinks.linkedin}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#D8B246] transition-colors"
                  >
                    LinkedIn
                  </a>
                )}
                {settings?.socialLinks?.instagram && (
                  <a
                    href={settings.socialLinks.instagram}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#D8B246] transition-colors"
                  >
                    Instagram
                  </a>
                )}
                {settings?.socialLinks?.youtube && (
                  <a
                    href={settings.socialLinks.youtube}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#D8B246] transition-colors"
                  >
                    YouTube
                  </a>
                )}
              </div>
            </div>

            <div className="md:col-span-3 space-y-3">
              <p className="text-xs font-semibold tracking-wider text-[#D8B246] uppercase">
                Navigation & Public Tools
              </p>
              <ul className="space-y-2 text-sm">
                {NAV_ITEMS.map((item) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => onNavigate({ page: item.key } as PublicRoute)}
                      className="hover:text-white transition-colors cursor-pointer"
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate({ page: 'nominate' })}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    Submit Nomination
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate({ page: 'verify' })}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    Verify Ballot Receipt
                  </button>
                </li>
              </ul>
            </div>

            <div className="md:col-span-4 space-y-3">
              <p className="text-xs font-semibold tracking-wider text-[#D8B246] uppercase">
                Secretariat & Governance
              </p>
              <div className="space-y-2.5 text-sm text-slate-300">
                <p className="flex items-start gap-2.5">
                  <Mail className="h-4 w-4 text-[#C59B27] shrink-0 mt-0.5" />
                  <span>{settings?.contactEmail}</span>
                </p>
                <p className="flex items-start gap-2.5">
                  <Phone className="h-4 w-4 text-[#C59B27] shrink-0 mt-0.5" />
                  <span>{settings?.contactPhone}</span>
                </p>
                <p className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 text-[#C59B27] shrink-0 mt-0.5" />
                  <span>{settings?.contactAddress}</span>
                </p>
                <p className="flex items-start gap-2.5">
                  <MessageCircle className="h-4 w-4 text-[#25D366] shrink-0 mt-0.5" />
                  <a
                    href={buildWhatsappUrl(
                      settings?.whatsappNumber,
                      `Hello ${settings?.siteName || 'Secretariat'}, I need assistance.`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[#D8B246] transition-colors font-mono tabular-nums"
                  >
                    WhatsApp: {formatGhanaLocalPhone(settings?.whatsappNumber)}
                  </a>
                </p>
              </div>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-center sm:text-left">
              <p>
                © {new Date().getFullYear()} {settings?.siteName}. All rights reserved.
              </p>
              <span className="hidden sm:inline text-slate-600">|</span>
              <p>
                Developed by{' '}
                <a
                  href={buildWhatsappUrl(
                    settings?.whatsappNumber,
                    `Hello ${settings?.developerName || 'Pearlicious Tech Solutions'}, I am contacting you regarding ${settings?.siteName || 'the awards portal'}.`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#D8B246] hover:underline font-medium"
                >
                  {settings?.developerName || 'Pearlicious Tech Solutions'}
                </a>
                <span className="text-slate-500 font-mono ml-1.5">
                  ({formatGhanaLocalPhone(settings?.whatsappNumber)})
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenAdmin}
              className="text-slate-300 hover:text-[#D8B246] transition-colors cursor-pointer shrink-0"
            >
              Administrator Governance Console
            </button>
          </div>
        </div>
      </footer>

      <WhatsAppHoverWidget
        whatsappNumber={settings?.whatsappNumber}
        developerName={settings?.developerName}
        siteName={settings?.siteName}
      />
    </div>
  );
}
