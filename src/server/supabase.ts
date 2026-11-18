import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function normalizeSupabaseUrl(raw?: string | null): string {
  if (!raw) return '';
  return raw.trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

const supabaseUrl = normalizeSupabaseUrl(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
);
const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const anonKey = (
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  ''
).trim();

const activeKey = serviceRoleKey || anonKey;

export const hasSupabaseServiceRole = Boolean(supabaseUrl && serviceRoleKey);
export const isSupabaseServerConfigured = Boolean(supabaseUrl && activeKey);

export const supabaseServer: SupabaseClient | null = isSupabaseServerConfigured
  ? createClient(supabaseUrl, activeKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

export async function verifySupabaseConnection(): Promise<{
  configured: boolean;
  reachable: boolean;
  url: string | null;
  error?: string;
}> {
  if (!supabaseServer) {
    return { configured: false, reachable: false, url: null, error: 'Supabase keys not configured.' };
  }
  try {
    const { error } = await supabaseServer.from('system_settings').select('id').limit(1);
    if (error) {
      return {
        configured: true,
        reachable: false,
        url: supabaseUrl,
        error: error.message,
      };
    }
    return {
      configured: true,
      reachable: true,
      url: supabaseUrl,
    };
  } catch (err) {
    return {
      configured: true,
      reachable: false,
      url: supabaseUrl,
      error: err instanceof Error ? err.message : 'Supabase connection error',
    };
  }
}

export async function uploadToSupabaseStorage(
  filename: string,
  buffer: Buffer,
  mimeType: string
): Promise<string | null> {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim();
  if (!supabaseServer || !bucket) {
    return null;
  }
  const objectPath = `uploads/${filename}`;
  const { error } = await supabaseServer.storage.from(bucket).upload(objectPath, buffer, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) {
    console.warn('Supabase Storage upload fallback to PostgreSQL media_assets:', error.message);
    return null;
  }
  const { data } = supabaseServer.storage.from(bucket).getPublicUrl(objectPath);
  return data?.publicUrl || null;
}
