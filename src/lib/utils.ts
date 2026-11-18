import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function normalizeWhatsappDigits(raw: string | null | undefined): string {
  const digits = String(raw || '0591593157').replace(/\D/g, '');
  if (!digits) return '233591593157';
  if (digits.startsWith('0') && digits.length === 10) {
    return `233${digits.slice(1)}`;
  }
  if (digits.startsWith('233')) {
    return digits;
  }
  return digits;
}

export function formatGhanaLocalPhone(raw: string | null | undefined): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '0591593157';
  return trimmed;
}

export function formatGhanaIntlPhone(raw: string | null | undefined): string {
  const digits = normalizeWhatsappDigits(raw);
  if (digits.startsWith('233') && digits.length === 12) {
    return `+233 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  return `+${digits}`;
}

export function buildWhatsappUrl(
  rawNumber: string | null | undefined,
  message?: string
): string {
  const digits = normalizeWhatsappDigits(rawNumber);
  const base = `https://wa.me/${digits}`;
  if (message && message.trim()) {
    return `${base}?text=${encodeURIComponent(message.trim())}`;
  }
  return base;
}

