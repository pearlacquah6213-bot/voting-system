import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { rateLimits } from '../db/schema.ts';

export const GHANA_REGIONS = [
  'Greater Accra',
  'Ashanti',
  'Western',
  'Central',
  'Eastern',
  'Northern',
  'Volta',
  'Bono',
  'Bono East',
  'Ahafo',
  'Western North',
  'Oti',
  'Savannah',
  'North East',
  'Upper East',
  'Upper West',
  'Diaspora',
] as const;

const getCaptchaSecret = (): string => {
  const material = process.env.SESSION_SECRET || process.env.SQL_PASSWORD || 'blackstar-captcha-key';
  return crypto.createHash('sha256').update(`captcha:${material}`).digest('hex');
};

export function createCaptchaChallenge(): { question: string; challengeToken: string } {
  const a = Math.floor(Math.random() * 14) + 3;
  const b = Math.floor(Math.random() * 12) + 2;
  const answer = a + b;
  const expiresAt = Date.now() + 10 * 60 * 1000;
  const nonce = crypto.randomBytes(6).toString('hex');
  const payload = `${answer}:${expiresAt}:${nonce}`;
  const sig = crypto.createHmac('sha256', getCaptchaSecret()).update(payload).digest('hex');
  return {
    question: `What is ${a} + ${b}?`,
    challengeToken: Buffer.from(`${payload}:${sig}`).toString('base64url'),
  };
}

export function verifyCaptchaChallenge(challengeToken: string, userAnswer: string): boolean {
  try {
    const decoded = Buffer.from(challengeToken, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 4) return false;
    const [expectedAnswer, expiresStr, nonce, sig] = parts;
    const expiresAt = Number(expiresStr);
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;
    const payload = `${expectedAnswer}:${expiresStr}:${nonce}`;
    const expectedSig = crypto.createHmac('sha256', getCaptchaSecret()).update(payload).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return false;
    }
    return userAnswer.trim() === expectedAnswer;
  } catch {
    return false;
  }
}

export function hashValue(val: string): string {
  return crypto.createHash('sha256').update(val).digest('hex');
}

export function generateOtpCode(): string {
  return String(crypto.randomInt(100000, 999999));
}

export function normalizeGhanaPhone(raw: string): string {
  const cleaned = raw.replace(/[\s()-]+/g, '');
  if (/^0[235][0-9]{8}$/.test(cleaned)) {
    return `+233${cleaned.slice(1)}`;
  }
  return cleaned;
}

// PostgreSQL-backed distributed sliding-window rate limiter (safe across Cloud Run instances)
export async function checkRateLimit(bucketKey: string, limitPerMinute: number): Promise<boolean> {
  const limit = Math.max(1, limitPerMinute);
  const now = new Date();
  const windowMs = 60 * 1000;

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(rateLimits)
      .where(eq(rateLimits.bucketKey, bucketKey))
      .limit(1);

    if (!existing) {
      await tx.insert(rateLimits).values({
        bucketKey,
        windowStart: now,
        hits: 1,
      });
      return true;
    }

    const elapsed = now.getTime() - new Date(existing.windowStart).getTime();
    if (elapsed > windowMs) {
      await tx
        .update(rateLimits)
        .set({ windowStart: now, hits: 1 })
        .where(eq(rateLimits.id, existing.id));
      return true;
    }

    if (existing.hits >= limit) {
      return false;
    }

    await tx
      .update(rateLimits)
      .set({ hits: existing.hits + 1 })
      .where(eq(rateLimits.id, existing.id));
    return true;
  });
}

export function maskIdentifier(email?: string | null, phone?: string | null): string {
  if (email) {
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    const visible = local.slice(0, Math.min(2, local.length));
    return `${visible}***@${domain}`;
  }
  if (phone) {
    if (phone.length <= 4) return '****';
    return `${phone.slice(0, 4)}****${phone.slice(-3)}`;
  }
  return 'Anonymous';
}
