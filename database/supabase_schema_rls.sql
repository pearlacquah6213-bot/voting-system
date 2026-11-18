-- Complete PostgreSQL & Supabase Row Level Security (RLS) Schema
-- Aurelia International Honours - Awards Management & Online Voting System

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id SERIAL PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Admins
CREATE TABLE IF NOT EXISTS public.admins (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER REFERENCES public.profiles(id) ON DELETE SET NULL,
  uid TEXT UNIQUE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'EDITOR')) DEFAULT 'EDITOR',
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  reset_token TEXT,
  reset_token_expires_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Awards
CREATE TABLE IF NOT EXISTS public.awards (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  edition_year INTEGER NOT NULL,
  tagline TEXT NOT NULL,
  description TEXT NOT NULL,
  logo_url TEXT,
  banner_url TEXT,
  voting_starts_at TIMESTAMPTZ NOT NULL,
  voting_ends_at TIMESTAMPTZ NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  results_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_by INTEGER REFERENCES public.admins(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Categories
CREATE TABLE IF NOT EXISTS public.categories (
  id SERIAL PRIMARY KEY,
  award_id INTEGER NOT NULL REFERENCES public.awards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  voting_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  max_votes_per_voter INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Nominees
CREATE TABLE IF NOT EXISTS public.nominees (
  id SERIAL PRIMARY KEY,
  award_id INTEGER NOT NULL REFERENCES public.awards(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  nominee_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role_title TEXT NOT NULL DEFAULT '',
  organization TEXT NOT NULL DEFAULT '',
  photo_url TEXT,
  biography TEXT NOT NULL,
  social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
  nomination_status TEXT NOT NULL CHECK (nomination_status IN ('APPROVED', 'PENDING', 'ARCHIVED')) DEFAULT 'APPROVED',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_winner BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Voters (PII Protected)
CREATE TABLE IF NOT EXISTS public.voters (
  id SERIAL PRIMARY KEY,
  voter_code TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  full_name TEXT,
  verification_method TEXT NOT NULL CHECK (verification_method IN ('EMAIL_OTP', 'PHONE_OTP')) DEFAULT 'EMAIL_OTP',
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  otp_code_hash TEXT,
  otp_expires_at TIMESTAMPTZ,
  otp_attempts INTEGER NOT NULL DEFAULT 0,
  ip_hash TEXT,
  user_agent_hash TEXT,
  flagged_suspicious BOOLEAN NOT NULL DEFAULT FALSE,
  suspicious_reason TEXT,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_voted_at TIMESTAMPTZ
);

-- 7. Votes (Duplicate Prevention Constraint)
CREATE TABLE IF NOT EXISTS public.votes (
  id SERIAL PRIMARY KEY,
  award_id INTEGER NOT NULL REFERENCES public.awards(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  nominee_id INTEGER NOT NULL REFERENCES public.nominees(id) ON DELETE CASCADE,
  voter_id INTEGER NOT NULL REFERENCES public.voters(id) ON DELETE CASCADE,
  receipt_code TEXT NOT NULL UNIQUE,
  verification_method TEXT NOT NULL,
  ip_hash TEXT,
  cast_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT votes_voter_category_unique UNIQUE (voter_id, category_id)
);

-- 8. Sponsors
CREATE TABLE IF NOT EXISTS public.sponsors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'Gold Patron',
  logo_url TEXT,
  website_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Announcements
CREATE TABLE IF NOT EXISTS public.announcements (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'Governance',
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INTEGER REFERENCES public.admins(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Audit Logs (Append-Only)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER REFERENCES public.admins(id) ON DELETE SET NULL,
  admin_email TEXT NOT NULL,
  admin_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. System Settings
CREATE TABLE IF NOT EXISTS public.system_settings (
  id SERIAL PRIMARY KEY,
  site_name TEXT NOT NULL DEFAULT 'Aurelia International Honours',
  site_tagline TEXT NOT NULL DEFAULT 'Global Recognition of Architecture, Science & Civic Design',
  site_logo_url TEXT,
  favicon_url TEXT,
  site_description TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_address TEXT NOT NULL,
  social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
  primary_color TEXT NOT NULL DEFAULT '#0B192C',
  accent_color TEXT NOT NULL DEFAULT '#C59B27',
  require_otp BOOLEAN NOT NULL DEFAULT TRUE,
  allow_email_otp BOOLEAN NOT NULL DEFAULT TRUE,
  allow_phone_otp BOOLEAN NOT NULL DEFAULT TRUE,
  require_captcha BOOLEAN NOT NULL DEFAULT TRUE,
  max_votes_per_category INTEGER NOT NULL DEFAULT 1,
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 10,
  results_public BOOLEAN NOT NULL DEFAULT TRUE,
  voting_paused BOOLEAN NOT NULL DEFAULT FALSE,
  maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_categories_award_id ON public.categories(award_id);
CREATE INDEX IF NOT EXISTS idx_nominees_category_id ON public.nominees(category_id);
CREATE INDEX IF NOT EXISTS idx_votes_nominee_id ON public.votes(nominee_id);
CREATE INDEX IF NOT EXISTS idx_votes_category_id ON public.votes(category_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nominees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Public Read Policies (Published Content Only)
CREATE POLICY "Public read published awards" ON public.awards FOR SELECT USING (is_published = TRUE AND is_active = TRUE);
CREATE POLICY "Public read active categories" ON public.categories FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Public read approved nominees" ON public.nominees FOR SELECT USING (is_active = TRUE AND nomination_status = 'APPROVED');
CREATE POLICY "Public read active sponsors" ON public.sponsors FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Public read published announcements" ON public.announcements FOR SELECT USING (is_published = TRUE);
CREATE POLICY "Public read system settings" ON public.system_settings FOR SELECT USING (TRUE);

-- Strict Admin & Vote Protection Policies
-- Voters & Votes cannot be directly queried or mutated by anon clients; server-side verified API routes enforce atomic transactions.
CREATE POLICY "Deny anon read voters" ON public.voters FOR SELECT USING (FALSE);
CREATE POLICY "Deny anon read votes" ON public.votes FOR SELECT USING (FALSE);
CREATE POLICY "Deny vote tampering" ON public.votes FOR UPDATE USING (FALSE);
CREATE POLICY "Deny vote deletion" ON public.votes FOR DELETE USING (FALSE);
CREATE POLICY "Admins read audit logs" ON public.audit_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.admins a WHERE a.uid = auth.uid()::text AND a.is_active = TRUE)
);
