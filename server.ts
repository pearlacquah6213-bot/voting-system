import 'dotenv/config';
import crypto from 'crypto';
import path from 'path';
import bcrypt from 'bcryptjs';
import { and, count, desc, eq, or, sql } from 'drizzle-orm';
import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import { db } from './src/db/index.ts';
import {
  admins,
  announcements,
  auditLogs,
  awards,
  categories,
  contactMessages,
  mediaAssets,
  momoTransactions,
  nominees,
  notifications,
  profiles,
  sponsors,
  systemSettings,
  voters,
  votes,
} from './src/db/schema.ts';
import { adminAuth } from './src/lib/firebase-admin.ts';
import {
  type AdminAuthRequest,
  type AdminRole,
  requireAdminAuth,
  requirePermission,
  requireRole,
  signAdminToken,
} from './src/server/auth.ts';
import {
  dispatchEmailOtp,
  dispatchSmsOtp,
  verifyPaystackSignature,
  verifyPaystackTransaction,
  verifyTurnstileToken,
} from './src/server/providers.ts';
import { ensureSeeded } from './src/server/seed.ts';
import {
  supabaseServer,
  uploadToSupabaseStorage,
  verifySupabaseConnection,
} from './src/server/supabase.ts';
import {
  checkRateLimit,
  createCaptchaChallenge,
  generateOtpCode,
  GHANA_REGIONS,
  hashValue,
  maskIdentifier,
  normalizeGhanaPhone,
  verifyCaptchaChallenge,
} from './src/server/votingSecurity.ts';

const app = express();
app.use(
  express.json({
    limit: '8mb',
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: string }).rawBody = buf.toString('utf8');
    },
  })
);

// Multer memory storage -> saved persistently into PostgreSQL media_assets table
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error('Invalid image format. Only JPEG, PNG, and WEBP are accepted.'));
      return;
    }
    cb(null, true);
  },
});

function getClientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0] || req.ip || 'unknown';
  return raw.trim();
}

function getClientIpHash(req: express.Request): string {
  return hashValue(getClientIp(req));
}

function isLockdownActive(settingsRow?: typeof systemSettings.$inferSelect): boolean {
  return Boolean(settingsRow?.productionMode || process.env.PRODUCTION_LOCKDOWN === 'true');
}

async function logAudit(
  req: AdminAuthRequest,
  action: string,
  entityType: string,
  entityId: string | null,
  details: Record<string, unknown> = {}
) {
  if (!req.admin) return;
  await db.insert(auditLogs).values({
    adminId: req.admin.id,
    adminEmail: req.admin.email,
    adminRole: req.admin.role,
    action,
    entityType,
    entityId,
    details,
    ipAddress: getClientIp(req),
  });
}

// Persistent media asset endpoint (serves images directly from PostgreSQL)
app.get('/api/media/:id/:filename', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).send('Invalid media ID');
      return;
    }
    const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
    if (!asset) {
      res.status(404).send('Media not found');
      return;
    }
    const buf = Buffer.from(asset.dataBase64, 'base64');
    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(buf);
  } catch {
    res.status(500).send('Failed to load image');
  }
});

// Lazy DB seeding middleware
app.use('/api', async (_req, _res, next) => {
  await ensureSeeded();
  next();
});

// Database & Supabase Integration Health Endpoint
app.get('/api/health', async (req, res) => {
  const checkSupabase = req.query.check === 'supabase';
  const supabaseStatus = checkSupabase
    ? await verifySupabaseConnection()
    : { configured: Boolean(supabaseServer) };

  res.json({
    ok: true,
    databaseEngine: process.env.DATABASE_URL ? 'supabase-postgres' : 'cloudsql-postgres',
    supabase: supabaseStatus,
  });
});

// ==========================================
// PUBLIC WEBSITE ENDPOINTS
// ==========================================

app.get('/api/public/bootstrap', async (_req, res) => {
  try {
    const [settingsRow] = await db.select().from(systemSettings).limit(1);
    const allAwards = await db
      .select()
      .from(awards)
      .where(eq(awards.isPublished, true))
      .orderBy(desc(awards.editionYear));

    const allCategories = await db
      .select()
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(categories.displayOrder, categories.id);

    const allNominees = await db
      .select()
      .from(nominees)
      .where(and(eq(nominees.isActive, true), eq(nominees.nominationStatus, 'APPROVED')))
      .orderBy(nominees.nomineeNumber);

    const allSponsors = await db
      .select()
      .from(sponsors)
      .where(eq(sponsors.isActive, true))
      .orderBy(sponsors.displayOrder, sponsors.id);

    const allAnnouncements = await db
      .select()
      .from(announcements)
      .where(eq(announcements.isPublished, true))
      .orderBy(desc(announcements.publishedAt));

    const publicNotifications = await db
      .select()
      .from(notifications)
      .where(eq(notifications.audience, 'ALL'))
      .orderBy(desc(notifications.createdAt))
      .limit(10);

    // Aggregate free verified votes + completed Mobile Money / USSD votes
    const freeVoteRows = await db
      .select({
        nomineeId: votes.nomineeId,
        categoryId: votes.categoryId,
        total: count(),
      })
      .from(votes)
      .groupBy(votes.nomineeId, votes.categoryId);

    const momoVoteRows = await db
      .select({
        nomineeId: momoTransactions.nomineeId,
        categoryId: momoTransactions.categoryId,
        totalVotes: sql<number>`COALESCE(SUM(${momoTransactions.voteCount}), 0)`,
      })
      .from(momoTransactions)
      .where(eq(momoTransactions.status, 'COMPLETED'))
      .groupBy(momoTransactions.nomineeId, momoTransactions.categoryId);

    const voteCountByNominee = new Map<number, number>();
    const voteCountByCategory = new Map<number, number>();

    for (const row of freeVoteRows) {
      const val = Number(row.total);
      voteCountByNominee.set(row.nomineeId, (voteCountByNominee.get(row.nomineeId) || 0) + val);
      voteCountByCategory.set(row.categoryId, (voteCountByCategory.get(row.categoryId) || 0) + val);
    }
    for (const row of momoVoteRows) {
      const val = Number(row.totalVotes || 0);
      voteCountByNominee.set(row.nomineeId, (voteCountByNominee.get(row.nomineeId) || 0) + val);
      voteCountByCategory.set(row.categoryId, (voteCountByCategory.get(row.categoryId) || 0) + val);
    }

    const activeAward = allAwards.find((a) => a.isActive) || allAwards[0] || null;
    const resultsVisible = Boolean(
      settingsRow?.resultsPublic && (activeAward ? activeAward.resultsPublished : true)
    );

    const nomineeCountByCat = new Map<number, number>();
    for (const nom of allNominees) {
      nomineeCountByCat.set(nom.categoryId, (nomineeCountByCat.get(nom.categoryId) || 0) + 1);
    }

    const categoriesWithCounts = allCategories.map((cat) => ({
      ...cat,
      nomineeCount: nomineeCountByCat.get(cat.id) || 0,
      totalVotes: resultsVisible ? voteCountByCategory.get(cat.id) || 0 : null,
    }));

    const nomineesPublic = allNominees.map((nom) => {
      const catTotal = voteCountByCategory.get(nom.categoryId) || 0;
      const nomVotes = voteCountByNominee.get(nom.id) || 0;
      return {
        ...nom,
        voteCount: resultsVisible ? nomVotes : null,
        votePercentage:
          resultsVisible && catTotal > 0 ? Math.round((nomVotes / catTotal) * 1000) / 10 : null,
      };
    });

    const totalPublicVotes = Array.from(voteCountByCategory.values()).reduce((a, b) => a + b, 0);

    res.json({
      settings: settingsRow
        ? {
            ...settingsRow,
            whatsappNumber: settingsRow.whatsappNumber || '0591593157',
            developerName: settingsRow.developerName || 'Pearlicious Tech Solutions',
          }
        : settingsRow,
      awards: allAwards,
      activeAward,
      categories: categoriesWithCounts,
      nominees: nomineesPublic,
      sponsors: allSponsors,
      announcements: allAnnouncements,
      notifications: publicNotifications,
      resultsVisible,
      totalPublicVotes: resultsVisible ? totalPublicVotes : null,
      ghanaRegions: GHANA_REGIONS,
      turnstileSiteKey: process.env.VITE_TURNSTILE_SITE_KEY || null,
    });
  } catch (err) {
    console.error('Bootstrap error:', err);
    res.status(500).json({ error: 'Unable to load awards portal data.' });
  }
});

// Public Ballot Receipt Verification (confirms ledger entry without revealing vote choice or PII)
app.get('/api/public/verify-receipt/:code', async (req, res) => {
  try {
    const code = String(req.params.code || '').trim().toUpperCase();
    if (!code || code.length < 6) {
      res.status(400).json({ error: 'Enter a valid ballot receipt code (e.g. GH-2026-2001).' });
      return;
    }

    const [freeVote] = await db
      .select()
      .from(votes)
      .where(eq(votes.receiptCode, code))
      .limit(1);

    if (freeVote) {
      const [cat] = await db.select().from(categories).where(eq(categories.id, freeVote.categoryId)).limit(1);
      const [aw] = await db.select().from(awards).where(eq(awards.id, freeVote.awardId)).limit(1);
      res.json({
        verified: true,
        receiptCode: freeVote.receiptCode,
        awardTitle: aw?.title || 'Black Star Excellence Honours',
        categoryName: cat?.name || 'Honours Category',
        verificationMethod: freeVote.verificationMethod,
        ghanaRegion: freeVote.ghanaRegion,
        voteWeight: 1,
        channel: 'VERIFIED_PUBLIC_BALLOT',
        recordedAt: freeVote.castAt,
      });
      return;
    }

    const [momoTx] = await db
      .select()
      .from(momoTransactions)
      .where(and(or(eq(momoTransactions.receiptCode, code), eq(momoTransactions.reference, code)), eq(momoTransactions.status, 'COMPLETED')))
      .limit(1);

    if (momoTx) {
      const [cat] = await db.select().from(categories).where(eq(categories.id, momoTx.categoryId)).limit(1);
      const [aw] = await db.select().from(awards).where(eq(awards.id, momoTx.awardId)).limit(1);
      res.json({
        verified: true,
        receiptCode: momoTx.receiptCode,
        awardTitle: aw?.title || 'Black Star Excellence Honours',
        categoryName: cat?.name || 'Honours Category',
        verificationMethod: `${momoTx.network}_MOMO`,
        ghanaRegion: momoTx.ghanaRegion,
        voteWeight: momoTx.voteCount,
        channel: momoTx.channel,
        recordedAt: momoTx.completedAt || momoTx.createdAt,
      });
      return;
    }

    res.status(404).json({ error: 'No verified ballot or MoMo receipt matched that code.' });
  } catch (err) {
    console.error('Receipt verification error:', err);
    res.status(500).json({ error: 'Unable to verify receipt code.' });
  }
});

// Public Nomination Photo Upload (saved to PostgreSQL media_assets)
app.post('/api/public/upload-nomination-photo', async (req, res) => {
  const ipHash = getClientIpHash(req);
  const ok = await checkRateLimit(`pub-upload:${ipHash}`, 8);
  if (!ok) {
    res.status(429).json({ error: 'Upload rate limit exceeded. Please wait a minute.' });
    return;
  }

  upload.single('image')(req, res, async (err) => {
    if (err) {
      res.status(400).json({ error: err.message || 'Image validation failed.' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'No image file provided.' });
      return;
    }
    const ext =
      req.file.mimetype === 'image/png' ? 'png' : req.file.mimetype === 'image/webp' ? 'webp' : 'jpg';
    const filename = `nomination_${Date.now()}_${crypto.randomBytes(3).toString('hex')}.${ext}`;
    const [asset] = await db
      .insert(mediaAssets)
      .values({
        filename,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        dataBase64: req.file.buffer.toString('base64'),
      })
      .returning();

    res.status(201).json({ url: `/api/media/${asset.id}/${asset.filename}`, filename });
  });
});

// Public Nomination Intake (creates PENDING nominee for Admin review)
app.post('/api/public/nominations', async (req, res) => {
  try {
    const schema = z.object({
      categoryId: z.number().int().positive(),
      fullName: z.string().trim().min(2).max(140),
      roleTitle: z.string().trim().min(2).max(140),
      organization: z.string().trim().max(140).default(''),
      photoUrl: z.string().optional(),
      biography: z.string().trim().min(20).max(3000),
      nominatedByEmail: z.string().trim().email(),
      website: z.string().optional(),
      captchaToken: z.string().optional(),
      captchaAnswer: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Please complete all required nomination fields.' });
      return;
    }

    const ipHash = getClientIpHash(req);
    const rateOk = await checkRateLimit(`nominate:${ipHash}`, 5);
    if (!rateOk) {
      res.status(429).json({ error: 'Too many nomination submissions. Please try again later.' });
      return;
    }

    if (!parsed.data.captchaToken || !parsed.data.captchaAnswer) {
      res.status(400).json({ error: 'Please answer the verification challenge.' });
      return;
    }
    if (!verifyCaptchaChallenge(parsed.data.captchaToken, parsed.data.captchaAnswer)) {
      res.status(400).json({ error: 'Verification challenge answer was incorrect.' });
      return;
    }

    const [cat] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, parsed.data.categoryId), eq(categories.isActive, true)))
      .limit(1);
    if (!cat) {
      res.status(404).json({ error: 'Selected award category does not exist.' });
      return;
    }

    const nomineeNumber = `BSX-P${crypto.randomInt(100, 999)}-${crypto.randomBytes(1).toString('hex').toUpperCase()}`;
    const [created] = await db
      .insert(nominees)
      .values({
        awardId: cat.awardId,
        categoryId: cat.id,
        nomineeNumber,
        fullName: parsed.data.fullName,
        roleTitle: parsed.data.roleTitle,
        organization: parsed.data.organization,
        photoUrl: parsed.data.photoUrl || null,
        biography: parsed.data.biography,
        socialLinks: parsed.data.website ? { website: parsed.data.website } : {},
        nominationStatus: 'PENDING',
        nominatedByEmail: parsed.data.nominatedByEmail.toLowerCase(),
        isActive: false,
      })
      .returning();

    await db.insert(notifications).values({
      audience: 'ADMIN',
      type: 'ADMIN_ACTION',
      title: 'New Public Nomination Submitted',
      message: `${created.fullName} was nominated in ${cat.name} and awaits committee approval.`,
    });

    res.status(201).json({
      ok: true,
      nomineeNumber: created.nomineeNumber,
      message: 'Nomination submitted for Governance Committee review.',
    });
  } catch (err) {
    console.error('Public nomination error:', err);
    res.status(500).json({ error: 'Unable to submit nomination.' });
  }
});

app.post('/api/public/contact', async (req, res) => {
  try {
    const schema = z.object({
      fullName: z.string().trim().min(2).max(120),
      email: z.string().trim().email().max(180),
      subject: z.string().trim().min(3).max(200),
      message: z.string().trim().min(10).max(3000),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Please provide valid contact information and message.' });
      return;
    }
    const [created] = await db.insert(contactMessages).values(parsed.data).returning();
    res.status(201).json({ ok: true, id: created.id });
  } catch (err) {
    console.error('Contact submission error:', err);
    res.status(500).json({ error: 'Unable to submit inquiry.' });
  }
});

// ==========================================
// PUBLIC SECURE VOTING ENDPOINTS
// ==========================================

app.get('/api/voting/captcha', (_req, res) => {
  res.json(createCaptchaChallenge());
});

app.post('/api/voting/request-otp', async (req, res) => {
  try {
    const schema = z.object({
      method: z.enum(['EMAIL_OTP', 'PHONE_OTP']),
      contact: z.string().trim().min(5).max(180),
      fullName: z.string().trim().max(120).optional(),
      ghanaRegion: z.string().trim().default('Greater Accra'),
      ghanaCardNumber: z.string().trim().max(40).optional(),
      captchaToken: z.string().optional(),
      captchaAnswer: z.string().optional(),
      turnstileToken: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Enter a valid email address or Ghanaian mobile number.' });
      return;
    }

    const [settingsRow] = await db.select().from(systemSettings).limit(1);
    if (settingsRow?.maintenanceMode) {
      res.status(503).json({ error: 'Platform is currently undergoing scheduled maintenance.' });
      return;
    }
    if (settingsRow?.votingPaused) {
      res.status(403).json({ error: 'Voting is temporarily paused by the governance board.' });
      return;
    }

    const ipHash = getClientIpHash(req);
    const rateOk = await checkRateLimit(`otp:${ipHash}`, settingsRow?.rateLimitPerMinute ?? 10);
    if (!rateOk) {
      res.status(429).json({ error: 'Too many verification requests. Please wait a minute and try again.' });
      return;
    }

    if (settingsRow?.requireCaptcha !== false) {
      if (parsed.data.turnstileToken && process.env.TURNSTILE_SECRET_KEY) {
        const tsOk = await verifyTurnstileToken(parsed.data.turnstileToken, getClientIp(req));
        if (!tsOk) {
          res.status(400).json({ error: 'Turnstile bot verification failed.' });
          return;
        }
      } else {
        if (!parsed.data.captchaToken || !parsed.data.captchaAnswer) {
          res.status(400).json({ error: 'Verification challenge answer is required.' });
          return;
        }
        if (!verifyCaptchaChallenge(parsed.data.captchaToken, parsed.data.captchaAnswer)) {
          res.status(400).json({ error: 'Verification challenge answer was incorrect or expired.' });
          return;
        }
      }
    }

    const normalizedContact =
      parsed.data.method === 'EMAIL_OTP'
        ? parsed.data.contact.toLowerCase()
        : normalizeGhanaPhone(parsed.data.contact);

    if (parsed.data.method === 'EMAIL_OTP' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedContact)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }
    if (parsed.data.method === 'PHONE_OTP' && !/^\+?[0-9]{7,15}$/.test(normalizedContact)) {
      res.status(400).json({
        error: 'Please provide a valid Ghanaian (+233 / 024 / 050 / 020) or international mobile number.',
      });
      return;
    }

    const nationalIdHash =
      parsed.data.ghanaCardNumber && parsed.data.ghanaCardNumber.length >= 6
        ? hashValue(parsed.data.ghanaCardNumber.toUpperCase().replace(/\s+/g, ''))
        : null;

    const otp = generateOtpCode();
    const otpHash = hashValue(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const uaHash = hashValue(String(req.headers['user-agent'] || 'unknown'));

    // Cross-channel unified lookup: match contact OR Ghana Card hash
    const existingRows =
      parsed.data.method === 'EMAIL_OTP'
        ? await db
            .select()
            .from(voters)
            .where(
              nationalIdHash
                ? or(eq(voters.email, normalizedContact), eq(voters.nationalIdHash, nationalIdHash))
                : eq(voters.email, normalizedContact)
            )
            .limit(1)
        : await db
            .select()
            .from(voters)
            .where(
              nationalIdHash
                ? or(eq(voters.phone, normalizedContact), eq(voters.nationalIdHash, nationalIdHash))
                : eq(voters.phone, normalizedContact)
            )
            .limit(1);

    let voterRecord = existingRows[0];
    if (voterRecord) {
      if (
        settingsRow?.enforceSingleChannelPerVoter &&
        voterRecord.verificationMethod !== parsed.data.method &&
        voterRecord.isVerified
      ) {
        res.status(409).json({
          error: `Cross-channel protection: Your voter profile is already verified via ${voterRecord.verificationMethod}. Please use that channel.`,
        });
        return;
      }

      const updated = await db
        .update(voters)
        .set({
          fullName: parsed.data.fullName || voterRecord.fullName,
          ghanaRegion: parsed.data.ghanaRegion || voterRecord.ghanaRegion,
          nationalIdHash: nationalIdHash || voterRecord.nationalIdHash,
          verificationMethod: parsed.data.method,
          otpCodeHash: otpHash,
          otpExpiresAt: expiresAt,
          otpAttempts: 0,
          ipHash,
          userAgentHash: uaHash,
        })
        .where(eq(voters.id, voterRecord.id))
        .returning();
      voterRecord = updated[0];
    } else {
      const voterCode = `VTR-${crypto.randomInt(10000, 99999)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      const inserted = await db
        .insert(voters)
        .values({
          voterCode,
          email: parsed.data.method === 'EMAIL_OTP' ? normalizedContact : null,
          phone: parsed.data.method === 'PHONE_OTP' ? normalizedContact : null,
          nationalIdHash,
          ghanaRegion: parsed.data.ghanaRegion || 'Greater Accra',
          fullName: parsed.data.fullName || null,
          verificationMethod: parsed.data.method,
          isVerified: false,
          otpCodeHash: otpHash,
          otpExpiresAt: expiresAt,
          otpAttempts: 0,
          ipHash,
          userAgentHash: uaHash,
        })
        .returning();
      voterRecord = inserted[0];
    }

    // Real gateway dispatch if configured
    let deliveryChannel = 'SANDBOX';
    if (parsed.data.method === 'PHONE_OTP') {
      const smsRes = await dispatchSmsOtp(
        normalizedContact,
        otp,
        settingsRow?.smsProvider || 'ARKESEL'
      );
      deliveryChannel = smsRes.provider;
    } else {
      const emailRes = await dispatchEmailOtp(
        normalizedContact,
        'Black Star Honours — Ballot Verification Code',
        `<p>Your one-time verification code is <strong>${otp}</strong>. Valid for 10 minutes.</p>`
      );
      deliveryChannel = emailRes.provider;
    }

    const lockdown = isLockdownActive(settingsRow);
    res.json({
      ok: true,
      voterCode: voterRecord.voterCode,
      maskedContact: maskIdentifier(voterRecord.email, voterRecord.phone),
      expiresInSeconds: 600,
      deliveryChannel,
      // Automatically suppressed when productionMode or external SMS/Email key is active
      otpDeliveryPreview: !lockdown && deliveryChannel === 'SANDBOX' ? otp : undefined,
    });
  } catch (err) {
    console.error('OTP request error:', err);
    res.status(500).json({ error: 'Unable to issue verification code.' });
  }
});

app.post('/api/voting/submit', async (req, res) => {
  try {
    const schema = z.object({
      categoryId: z.number().int().positive(),
      nomineeId: z.number().int().positive(),
      method: z.enum(['EMAIL_OTP', 'PHONE_OTP']),
      contact: z.string().trim().min(5).max(180),
      ghanaRegion: z.string().trim().default('Greater Accra'),
      ghanaCardNumber: z.string().trim().max(40).optional(),
      otpCode: z.string().trim().optional(),
      captchaToken: z.string().optional(),
      captchaAnswer: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid ballot submission payload.' });
      return;
    }

    const ipHash = getClientIpHash(req);
    const normalizedContact =
      parsed.data.method === 'EMAIL_OTP'
        ? parsed.data.contact.toLowerCase()
        : normalizeGhanaPhone(parsed.data.contact);

    const nationalIdHash =
      parsed.data.ghanaCardNumber && parsed.data.ghanaCardNumber.length >= 6
        ? hashValue(parsed.data.ghanaCardNumber.toUpperCase().replace(/\s+/g, ''))
        : null;

    const [settingsPreview] = await db.select().from(systemSettings).limit(1);
    const rateOk = await checkRateLimit(`vote:${ipHash}`, settingsPreview?.rateLimitPerMinute ?? 10);
    if (!rateOk) {
      res.status(429).json({ error: 'Rate limit exceeded. Please wait before submitting another ballot.' });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const [settingsRow] = await tx.select().from(systemSettings).limit(1);
      if (settingsRow?.maintenanceMode) {
        return { status: 503, error: 'System is currently in maintenance mode.' };
      }
      if (settingsRow?.votingPaused) {
        return { status: 403, error: 'Voting is currently paused by the administrator.' };
      }

      const [category] = await tx
        .select()
        .from(categories)
        .where(eq(categories.id, parsed.data.categoryId))
        .limit(1);
      if (!category || !category.isActive || !category.votingEnabled) {
        return { status: 400, error: 'Voting is not currently enabled for this category.' };
      }

      const [award] = await tx.select().from(awards).where(eq(awards.id, category.awardId)).limit(1);
      if (!award || !award.isActive || !award.isPublished) {
        return { status: 400, error: 'This awards edition is not currently active.' };
      }

      const now = new Date();
      if (now < new Date(award.votingStartsAt) || now > new Date(award.votingEndsAt)) {
        return { status: 400, error: 'Voting window is not currently open.' };
      }

      const [nominee] = await tx
        .select()
        .from(nominees)
        .where(
          and(
            eq(nominees.id, parsed.data.nomineeId),
            eq(nominees.categoryId, category.id),
            eq(nominees.isActive, true),
            eq(nominees.nominationStatus, 'APPROVED')
          )
        )
        .limit(1);
      if (!nominee) {
        return { status: 404, error: 'Selected nominee is not eligible in this category.' };
      }

      const voterRows =
        parsed.data.method === 'EMAIL_OTP'
          ? await tx
              .select()
              .from(voters)
              .where(
                nationalIdHash
                  ? or(eq(voters.email, normalizedContact), eq(voters.nationalIdHash, nationalIdHash))
                  : eq(voters.email, normalizedContact)
              )
              .limit(1)
          : await tx
              .select()
              .from(voters)
              .where(
                nationalIdHash
                  ? or(eq(voters.phone, normalizedContact), eq(voters.nationalIdHash, nationalIdHash))
                  : eq(voters.phone, normalizedContact)
              )
              .limit(1);

      let voter = voterRows[0];

      if (settingsRow?.requireOtp !== false) {
        if (!voter) {
          return { status: 400, error: 'Please request a verification code before submitting your vote.' };
        }
        if (!parsed.data.otpCode || parsed.data.otpCode.length !== 6) {
          return { status: 400, error: 'Enter the 6-digit OTP verification code.' };
        }
        if (!voter.otpExpiresAt || new Date() > new Date(voter.otpExpiresAt)) {
          return { status: 400, error: 'Your OTP code has expired. Request a new verification code.' };
        }
        if (voter.otpCodeHash !== hashValue(parsed.data.otpCode)) {
          const nextAttempts = (voter.otpAttempts || 0) + 1;
          await tx
            .update(voters)
            .set({
              otpAttempts: nextAttempts,
              flaggedSuspicious: nextAttempts >= 4 ? true : voter.flaggedSuspicious,
              suspiciousReason: nextAttempts >= 4 ? 'Multiple invalid OTP attempts' : voter.suspiciousReason,
            })
            .where(eq(voters.id, voter.id));
          return { status: 400, error: 'Invalid OTP verification code.' };
        }
      } else {
        if (settingsRow?.requireCaptcha !== false) {
          if (!parsed.data.captchaToken || !parsed.data.captchaAnswer) {
            return { status: 400, error: 'Verification challenge answer is required.' };
          }
          if (!verifyCaptchaChallenge(parsed.data.captchaToken, parsed.data.captchaAnswer)) {
            return { status: 400, error: 'Incorrect verification challenge answer.' };
          }
        }
        if (!voter) {
          const voterCode = `VTR-${crypto.randomInt(10000, 99999)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
          const inserted = await tx
            .insert(voters)
            .values({
              voterCode,
              email: parsed.data.method === 'EMAIL_OTP' ? normalizedContact : null,
              phone: parsed.data.method === 'PHONE_OTP' ? normalizedContact : null,
              nationalIdHash,
              ghanaRegion: parsed.data.ghanaRegion || 'Greater Accra',
              verificationMethod: parsed.data.method,
              isVerified: true,
              ipHash,
            })
            .returning();
          voter = inserted[0];
        }
      }

      const existingVotes = await tx
        .select({ value: count() })
        .from(votes)
        .where(and(eq(votes.voterId, voter.id), eq(votes.categoryId, category.id)));

      const maxVotes = Math.min(category.maxVotesPerVoter, settingsRow?.maxVotesPerCategory ?? 1);
      if ((existingVotes[0]?.value ?? 0) >= maxVotes) {
        return {
          status: 409,
          error: 'Duplicate ballot blocked: You have already cast your verified vote in this category.',
        };
      }

      const receiptCode = `GH-${award.editionYear}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const region = parsed.data.ghanaRegion || voter.ghanaRegion || 'Greater Accra';

      await tx.insert(votes).values({
        awardId: award.id,
        categoryId: category.id,
        nomineeId: nominee.id,
        voterId: voter.id,
        receiptCode,
        verificationMethod: parsed.data.method,
        ghanaRegion: region,
        ipHash,
      });

      await tx
        .update(voters)
        .set({
          isVerified: true,
          ghanaRegion: region,
          otpCodeHash: null,
          otpExpiresAt: null,
          lastVotedAt: new Date(),
        })
        .where(eq(voters.id, voter.id));

      await tx.insert(notifications).values({
        audience: 'ADMIN',
        type: 'VOTE_CAST',
        title: `Verified Ballot Recorded (${category.name})`,
        message: `Ballot ${receiptCode} from ${region} recorded for ${nominee.fullName}.`,
      });

      return {
        status: 201,
        receiptCode,
        voterCode: voter.voterCode,
        nomineeName: nominee.fullName,
        categoryName: category.name,
        awardTitle: award.title,
        ghanaRegion: region,
        castAt: new Date().toISOString(),
      };
    });

    if ('error' in result && result.error) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.status(201).json(result);
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr?.code === '23505') {
      res.status(409).json({
        error: 'Duplicate ballot blocked by database integrity constraint: Only one vote per category is permitted.',
      });
      return;
    }
    console.error('Vote submission error:', err);
    res.status(500).json({ error: 'Unable to record ballot securely.' });
  }
});

// ==========================================
// GHANAIAN MOBILE MONEY (MOMO) & USSD VOTING
// ==========================================

app.post('/api/voting/momo/initiate', async (req, res) => {
  try {
    const schema = z.object({
      categoryId: z.number().int().positive(),
      nomineeId: z.number().int().positive(),
      voterPhone: z.string().trim().min(9).max(20),
      network: z.enum(['MTN', 'TELECEL', 'AT']),
      voteCount: z.number().int().min(1).max(200),
      ghanaRegion: z.string().trim().default('Greater Accra'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Enter a valid MoMo number, network, and vote pack quantity.' });
      return;
    }

    const [settingsRow] = await db.select().from(systemSettings).limit(1);
    if (!settingsRow?.paidVotingEnabled) {
      res.status(403).json({ error: 'Paid Mobile Money voting is currently disabled.' });
      return;
    }
    if (settingsRow.votingPaused || settingsRow.maintenanceMode) {
      res.status(403).json({ error: 'Voting is currently paused.' });
      return;
    }

    const normalizedPhone = normalizeGhanaPhone(parsed.data.voterPhone);
    if (!/^\+?[0-9]{9,15}$/.test(normalizedPhone)) {
      res.status(400).json({ error: 'Enter a valid Ghanaian mobile money number (e.g. 0244 000 000).' });
      return;
    }

    const [nominee] = await db
      .select()
      .from(nominees)
      .where(
        and(
          eq(nominees.id, parsed.data.nomineeId),
          eq(nominees.categoryId, parsed.data.categoryId),
          eq(nominees.isActive, true),
          eq(nominees.nominationStatus, 'APPROVED')
        )
      )
      .limit(1);
    if (!nominee) {
      res.status(404).json({ error: 'Nominee not eligible.' });
      return;
    }

    const [award] = await db.select().from(awards).where(eq(awards.id, nominee.awardId)).limit(1);
    if (!award || !award.isActive) {
      res.status(400).json({ error: 'Award edition is not active.' });
      return;
    }

    const amountGhs = parsed.data.voteCount * (settingsRow.votePriceGhs || 2);
    const reference = `MOMO-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const receiptCode = `GH-${award.editionYear}-M${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const [txRow] = await db
      .insert(momoTransactions)
      .values({
        reference,
        receiptCode,
        awardId: award.id,
        categoryId: nominee.categoryId,
        nomineeId: nominee.id,
        voterPhone: normalizedPhone,
        network: parsed.data.network,
        ghanaRegion: parsed.data.ghanaRegion,
        amountGhs,
        voteCount: parsed.data.voteCount,
        channel: 'WEB_MOMO',
        status: 'PENDING',
      })
      .returning();

    res.status(201).json({
      reference: txRow.reference,
      amountGhs: txRow.amountGhs,
      voteCount: txRow.voteCount,
      network: txRow.network,
      maskedPhone: maskIdentifier(null, txRow.voterPhone),
      paystackPublicKey: process.env.VITE_PAYSTACK_PUBLIC_KEY || null,
      lockdown: isLockdownActive(settingsRow),
    });
  } catch (err) {
    console.error('MoMo initiate error:', err);
    res.status(500).json({ error: 'Unable to initiate Mobile Money transaction.' });
  }
});

app.post('/api/voting/momo/confirm', async (req, res) => {
  try {
    const reference = String(req.body?.reference || '').trim();
    if (!reference) {
      res.status(400).json({ error: 'Transaction reference is required.' });
      return;
    }

    const [settingsRow] = await db.select().from(systemSettings).limit(1);
    const [txRow] = await db
      .select()
      .from(momoTransactions)
      .where(eq(momoTransactions.reference, reference))
      .limit(1);
    if (!txRow) {
      res.status(404).json({ error: 'MoMo transaction reference not found.' });
      return;
    }
    if (txRow.status === 'COMPLETED') {
      res.json({
        ok: true,
        receiptCode: txRow.receiptCode,
        voteCount: txRow.voteCount,
        amountGhs: txRow.amountGhs,
      });
      return;
    }

    // Verify with Paystack if configured, or allow sandbox authorization when not in production lockdown
    if (process.env.PAYSTACK_SECRET_KEY) {
      const check = await verifyPaystackTransaction(reference);
      if (!check.verified || (check.amountGhs ?? 0) < txRow.amountGhs) {
        res.status(402).json({ error: 'Payment has not been verified by Paystack.' });
        return;
      }
    } else if (isLockdownActive(settingsRow)) {
      res.status(503).json({ error: 'Live payment gateway verification is required in production mode.' });
      return;
    }

    const [updated] = await db
      .update(momoTransactions)
      .set({ status: 'COMPLETED', completedAt: new Date() })
      .where(eq(momoTransactions.id, txRow.id))
      .returning();

    const [nom] = await db.select().from(nominees).where(eq(nominees.id, updated.nomineeId)).limit(1);
    const [cat] = await db.select().from(categories).where(eq(categories.id, updated.categoryId)).limit(1);

    await db.insert(notifications).values({
      audience: 'ADMIN',
      type: 'VOTE_CAST',
      title: `MoMo Vote Pack Confirmed (${updated.network})`,
      message: `${updated.voteCount} votes (GHS ${updated.amountGhs}) recorded for ${nom?.fullName || 'Nominee'} (${updated.ghanaRegion}).`,
    });

    res.json({
      ok: true,
      receiptCode: updated.receiptCode,
      reference: updated.reference,
      voteCount: updated.voteCount,
      amountGhs: updated.amountGhs,
      nomineeName: nom?.fullName,
      categoryName: cat?.name,
      ghanaRegion: updated.ghanaRegion,
      castAt: updated.completedAt,
    });
  } catch (err) {
    console.error('MoMo confirm error:', err);
    res.status(500).json({ error: 'Unable to confirm MoMo vote.' });
  }
});

// Paystack Webhook for asynchronous Mobile Money settlement
app.post('/api/payments/momo/webhook', async (req, res) => {
  const rawReq = req as express.Request & { rawBody?: string };
  const sig = req.headers['x-paystack-signature'] as string | undefined;
  if (!verifyPaystackSignature(rawReq.rawBody || '', sig)) {
    res.status(401).send('Invalid signature');
    return;
  }
  const event = req.body as { event?: string; data?: { reference?: string } };
  if (event.event === 'charge.success' && event.data?.reference) {
    await db
      .update(momoTransactions)
      .set({ status: 'COMPLETED', completedAt: new Date() })
      .where(eq(momoTransactions.reference, event.data.reference));
  }
  res.sendStatus(200);
});

// Ghanaian USSD Gateway Callback (*714*88#) — compatible with Hubtel / Arkesel / Africa's Talking
app.post('/api/ussd/callback', async (req, res) => {
  try {
    const phoneNumber = normalizeGhanaPhone(String(req.body?.phoneNumber || '+233240000000'));
    const text = String(req.body?.text || '').trim();
    const parts = text === '' ? [] : text.split('*');

    if (parts.length === 0) {
      res.json({
        response:
          'CON Black Star Honours 2026\n1. Vote for Nominee\n2. List Top Nominee Codes\n3. Verify Receipt',
      });
      return;
    }

    if (parts[0] === '2') {
      const top = await db
        .select()
        .from(nominees)
        .where(and(eq(nominees.isActive, true), eq(nominees.nominationStatus, 'APPROVED')))
        .limit(5);
      const lines = top.map((n) => `${n.nomineeNumber}: ${n.fullName}`).join('\n');
      res.json({ response: `END Active Codes:\n${lines}` });
      return;
    }

    if (parts[0] === '3') {
      if (parts.length === 1) {
        res.json({ response: 'CON Enter your GH-2026 receipt code:' });
        return;
      }
      const code = parts[1].trim().toUpperCase();
      const [found] = await db.select().from(votes).where(eq(votes.receiptCode, code)).limit(1);
      const [foundMomo] = await db
        .select()
        .from(momoTransactions)
        .where(eq(momoTransactions.receiptCode, code))
        .limit(1);
      if (found || foundMomo) {
        res.json({ response: `END Receipt ${code} is VERIFIED on the official Ghana ballot ledger.` });
      } else {
        res.json({ response: `END Receipt ${code} was not found.` });
      }
      return;
    }

    if (parts[0] === '1') {
      if (parts.length === 1) {
        res.json({ response: 'CON Enter Nominee Code (e.g. BSX-101):' });
        return;
      }
      const nomCode = parts[1].trim().toUpperCase();
      const [nom] = await db
        .select()
        .from(nominees)
        .where(and(eq(nominees.nomineeNumber, nomCode), eq(nominees.isActive, true)))
        .limit(1);
      if (!nom) {
        res.json({ response: `END Nominee code ${nomCode} not found. Dial again to retry.` });
        return;
      }
      const [cat] = await db.select().from(categories).where(eq(categories.id, nom.categoryId)).limit(1);
      const [settingsRow] = await db.select().from(systemSettings).limit(1);
      const price = settingsRow?.votePriceGhs || 2;

      if (parts.length === 2) {
        res.json({
          response: `CON ${nom.fullName} (${cat?.name})\nEnter number of votes (GHS ${price}/vote):`,
        });
        return;
      }

      const qty = Number(parts[2]);
      if (!Number.isInteger(qty) || qty < 1 || qty > 100) {
        res.json({ response: 'END Invalid vote quantity (1-100).' });
        return;
      }
      const amount = qty * price;

      if (parts.length === 3) {
        res.json({
          response: `CON Cast ${qty} votes for ${nom.fullName} (GHS ${amount} via MoMo)?\n1. Confirm\n2. Cancel`,
        });
        return;
      }

      if (parts[3] === '1') {
        const ref = `USSD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
        const receipt = `GH-2026-U${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        await db.insert(momoTransactions).values({
          reference: ref,
          receiptCode: receipt,
          awardId: nom.awardId,
          categoryId: nom.categoryId,
          nomineeId: nom.id,
          voterPhone: phoneNumber,
          network: 'MTN',
          ghanaRegion: 'Greater Accra',
          amountGhs: amount,
          voteCount: qty,
          channel: 'USSD',
          status: 'COMPLETED',
          completedAt: new Date(),
        });
        res.json({
          response: `END Medaase! ${qty} votes recorded for ${nom.fullName}. Receipt: ${receipt}`,
        });
        return;
      }

      res.json({ response: 'END USSD voting cancelled.' });
      return;
    }

    res.json({ response: 'END Invalid selection.' });
  } catch (err) {
    console.error('USSD callback error:', err);
    res.json({ response: 'END Service temporarily unavailable.' });
  }
});

// ==========================================
// ADMINISTRATOR AUTHENTICATION
// ==========================================

app.post('/api/auth/login', async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().trim().email(),
      password: z.string().min(6),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Enter a valid email and password.' });
      return;
    }

    const email = parsed.data.email.toLowerCase();
    const [adminRow] = await db.select().from(admins).where(eq(admins.email, email)).limit(1);
    if (!adminRow) {
      res.status(401).json({ error: 'Invalid administrator credentials.' });
      return;
    }
    if (!adminRow.isActive) {
      res.status(403).json({ error: 'Administrator account is deactivated.' });
      return;
    }

    const valid = await bcrypt.compare(parsed.data.password, adminRow.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid administrator credentials.' });
      return;
    }

    await db
      .update(admins)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(admins.id, adminRow.id));

    await db.insert(auditLogs).values({
      adminId: adminRow.id,
      adminEmail: adminRow.email,
      adminRole: adminRow.role,
      action: 'LOGIN',
      entityType: 'admin',
      entityId: String(adminRow.id),
      details: { method: 'password' },
    });

    const userPayload = {
      id: adminRow.id,
      email: adminRow.email,
      fullName: adminRow.fullName,
      role: adminRow.role as AdminRole,
      permissions: adminRow.permissions || [],
    };
    const token = signAdminToken(userPayload);
    res.json({ token, admin: userPayload });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Authentication failed.' });
  }
});

app.post('/api/auth/firebase', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing Firebase token.' });
      return;
    }
    const idToken = authHeader.slice('Bearer '.length).trim();
    const decoded = await adminAuth.verifyIdToken(idToken);
    if (!decoded.email) {
      res.status(401).json({ error: 'Google account has no verified email.' });
      return;
    }

    const email = decoded.email.toLowerCase();
    await db
      .insert(profiles)
      .values({
        uid: decoded.uid,
        email,
        fullName: decoded.name || email.split('@')[0],
        avatarUrl: decoded.picture || null,
      })
      .onConflictDoUpdate({
        target: profiles.email,
        set: {
          uid: decoded.uid,
          fullName: decoded.name || email.split('@')[0],
          avatarUrl: decoded.picture || null,
          updatedAt: new Date(),
        },
      });

    const [adminRow] = await db.select().from(admins).where(eq(admins.email, email)).limit(1);
    if (!adminRow) {
      res.status(403).json({
        error: `Account ${email} does not have administrator privileges. Contact a Super Admin.`,
      });
      return;
    }
    if (!adminRow.isActive) {
      res.status(403).json({ error: 'Administrator account is deactivated.' });
      return;
    }

    await db
      .update(admins)
      .set({ uid: decoded.uid, lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(admins.id, adminRow.id));

    await db.insert(auditLogs).values({
      adminId: adminRow.id,
      adminEmail: adminRow.email,
      adminRole: adminRow.role,
      action: 'LOGIN_GOOGLE',
      entityType: 'admin',
      entityId: String(adminRow.id),
      details: { method: 'firebase_google' },
    });

    res.json({
      admin: {
        id: adminRow.id,
        email: adminRow.email,
        fullName: adminRow.fullName,
        role: adminRow.role as AdminRole,
        permissions: adminRow.permissions || [],
      },
    });
  } catch (err) {
    console.error('Firebase auth error:', err);
    res.status(401).json({ error: 'Google authentication failed.' });
  }
});

app.post('/api/auth/supabase', async (req, res) => {
  try {
    if (!supabaseServer) {
      res.status(503).json({ error: 'Supabase authentication is not configured.' });
      return;
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing Supabase access token.' });
      return;
    }
    const accessToken = authHeader.slice('Bearer '.length).trim();
    const { data, error } = await supabaseServer.auth.getUser(accessToken);
    if (error || !data.user?.email) {
      res.status(401).json({ error: 'Invalid or expired Supabase session token.' });
      return;
    }

    const email = data.user.email.toLowerCase();
    const [adminRow] = await db.select().from(admins).where(eq(admins.email, email)).limit(1);
    if (!adminRow) {
      res.status(403).json({
        error: `Account ${email} does not have administrator privileges. Contact a Super Admin.`,
      });
      return;
    }
    if (!adminRow.isActive) {
      res.status(403).json({ error: 'Administrator account is deactivated.' });
      return;
    }

    await db
      .update(admins)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(admins.id, adminRow.id));

    await db.insert(auditLogs).values({
      adminId: adminRow.id,
      adminEmail: adminRow.email,
      adminRole: adminRow.role,
      action: 'LOGIN_SUPABASE',
      entityType: 'admin',
      entityId: String(adminRow.id),
      details: { method: 'supabase_auth' },
    });

    const userPayload = {
      id: adminRow.id,
      email: adminRow.email,
      fullName: adminRow.fullName,
      role: adminRow.role as AdminRole,
      permissions: adminRow.permissions || [],
    };
    const token = signAdminToken(userPayload);
    res.json({ token, admin: userPayload });
  } catch (err) {
    console.error('Supabase auth error:', err);
    res.status(401).json({ error: 'Supabase authentication failed.' });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) {
      res.status(400).json({ error: 'Email is required.' });
      return;
    }
    const [settingsRow] = await db.select().from(systemSettings).limit(1);
    const [adminRow] = await db.select().from(admins).where(eq(admins.email, email)).limit(1);
    if (!adminRow) {
      res.json({ ok: true, message: 'If that administrator email exists, a reset code has been dispatched.' });
      return;
    }
    const resetToken = crypto.randomBytes(3).toString('hex').toUpperCase();
    await db
      .update(admins)
      .set({
        resetToken: hashValue(resetToken),
        resetTokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      })
      .where(eq(admins.id, adminRow.id));

    const emailRes = await dispatchEmailOtp(
      adminRow.email,
      'Black Star Console — Password Reset Code',
      `<p>Your administrator password reset code is <strong>${resetToken}</strong>.</p>`
    );

    const lockdown = isLockdownActive(settingsRow);
    res.json({
      ok: true,
      message: 'Password reset code generated.',
      resetCodePreview: !lockdown && emailRes.provider === 'SANDBOX' ? resetToken : undefined,
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Unable to initiate password reset.' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().trim().email(),
      resetCode: z.string().trim().min(4),
      newPassword: z.string().min(8),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Provide email, reset code, and a password of at least 8 characters.' });
      return;
    }
    const email = parsed.data.email.toLowerCase();
    const [adminRow] = await db.select().from(admins).where(eq(admins.email, email)).limit(1);
    if (
      !adminRow ||
      !adminRow.resetToken ||
      !adminRow.resetTokenExpiresAt ||
      new Date() > new Date(adminRow.resetTokenExpiresAt) ||
      adminRow.resetToken !== hashValue(parsed.data.resetCode.toUpperCase())
    ) {
      res.status(400).json({ error: 'Invalid or expired reset code.' });
      return;
    }
    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
    await db
      .update(admins)
      .set({
        passwordHash,
        resetToken: null,
        resetTokenExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(admins.id, adminRow.id));

    await db.insert(auditLogs).values({
      adminId: adminRow.id,
      adminEmail: adminRow.email,
      adminRole: adminRow.role,
      action: 'RESET_PASSWORD',
      entityType: 'admin',
      entityId: String(adminRow.id),
      details: {},
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Unable to reset password.' });
  }
});

app.get('/api/auth/me', requireAdminAuth, (req: AdminAuthRequest, res) => {
  res.json({ admin: req.admin });
});

app.post('/api/auth/change-password', requireAdminAuth, async (req: AdminAuthRequest, res) => {
  try {
    const schema = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'New password must be at least 8 characters.' });
      return;
    }
    const [adminRow] = await db.select().from(admins).where(eq(admins.id, req.admin!.id)).limit(1);
    if (!adminRow) {
      res.status(404).json({ error: 'Administrator record not found.' });
      return;
    }
    const valid = await bcrypt.compare(parsed.data.currentPassword, adminRow.passwordHash);
    if (!valid) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }
    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
    await db.update(admins).set({ passwordHash, updatedAt: new Date() }).where(eq(admins.id, adminRow.id));
    await logAudit(req, 'CHANGE_PASSWORD', 'admin', String(adminRow.id));
    res.json({ ok: true });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Unable to change password.' });
  }
});

app.post('/api/auth/logout', requireAdminAuth, async (req: AdminAuthRequest, res) => {
  await logAudit(req, 'LOGOUT', 'admin', String(req.admin!.id));
  res.json({ ok: true });
});

// ==========================================
// ADMIN PROTECTED ENDPOINTS
// ==========================================

// Persistent Image Upload saved into PostgreSQL media_assets table
app.post('/api/admin/upload', requireAdminAuth, (req: AdminAuthRequest, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      res.status(400).json({ error: err.message || 'Image upload validation failed.' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'No image file provided.' });
      return;
    }
    const ext =
      req.file.mimetype === 'image/png' ? 'png' : req.file.mimetype === 'image/webp' ? 'webp' : 'jpg';
    const filename = `upload_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const supabasePublicUrl = await uploadToSupabaseStorage(
      filename,
      req.file.buffer,
      req.file.mimetype
    );
    const [asset] = await db
      .insert(mediaAssets)
      .values({
        filename,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        dataBase64: req.file.buffer.toString('base64'),
      })
      .returning();

    const url = supabasePublicUrl || `/api/media/${asset.id}/${asset.filename}`;
    await logAudit(req, 'UPLOAD_IMAGE', 'media', filename, {
      size: req.file.size,
      mimetype: req.file.mimetype,
      persistentId: asset.id,
      storage: supabasePublicUrl ? 'supabase' : 'postgresql',
    });
    res.status(201).json({ url, filename });
  });
});

app.get('/api/admin/overview', requireAdminAuth, async (_req, res) => {
  try {
    const [
      awardsList,
      categoriesList,
      nomineesList,
      votesList,
      momoList,
      votersList,
      recentAudits,
      notifs,
      messages,
      settingsRow,
    ] = await Promise.all([
      db.select().from(awards).orderBy(desc(awards.editionYear)),
      db.select().from(categories).orderBy(categories.displayOrder),
      db.select().from(nominees).orderBy(nominees.nomineeNumber),
      db.select().from(votes).orderBy(desc(votes.castAt)),
      db.select().from(momoTransactions).where(eq(momoTransactions.status, 'COMPLETED')),
      db.select().from(voters).orderBy(desc(voters.registeredAt)),
      db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(12),
      db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(15),
      db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt)).limit(20),
      db.select().from(systemSettings).limit(1),
    ]);

    const catVoteMap = new Map<number, number>();
    const nomVoteMap = new Map<number, number>();
    const dailyVoteMap = new Map<string, number>();
    const regionMap = new Map<string, number>();

    for (const v of votesList) {
      catVoteMap.set(v.categoryId, (catVoteMap.get(v.categoryId) || 0) + 1);
      nomVoteMap.set(v.nomineeId, (nomVoteMap.get(v.nomineeId) || 0) + 1);
      const dayKey = new Date(v.castAt).toISOString().slice(0, 10);
      dailyVoteMap.set(dayKey, (dailyVoteMap.get(dayKey) || 0) + 1);
      regionMap.set(v.ghanaRegion, (regionMap.get(v.ghanaRegion) || 0) + 1);
    }

    let momoVoteSum = 0;
    let momoRevenueGhs = 0;
    for (const m of momoList) {
      momoVoteSum += m.voteCount;
      momoRevenueGhs += m.amountGhs;
      catVoteMap.set(m.categoryId, (catVoteMap.get(m.categoryId) || 0) + m.voteCount);
      nomVoteMap.set(m.nomineeId, (nomVoteMap.get(m.nomineeId) || 0) + m.voteCount);
      const dayKey = new Date(m.completedAt || m.createdAt).toISOString().slice(0, 10);
      dailyVoteMap.set(dayKey, (dailyVoteMap.get(dayKey) || 0) + m.voteCount);
      regionMap.set(m.ghanaRegion, (regionMap.get(m.ghanaRegion) || 0) + m.voteCount);
    }

    const totalAwards = awardsList.length;
    const activeAwards = awardsList.filter((a) => a.isActive).length;
    const totalCategories = categoriesList.length;
    const totalNominees = nomineesList.length;
    const totalVotes = votesList.length + momoVoteSum;
    const totalVoters = votersList.length;
    const activeVotingCategories = categoriesList.filter((c) => c.isActive && c.votingEnabled).length;
    const publishedResults = awardsList.filter((a) => a.resultsPublished).length;
    const pendingNominationsCount = nomineesList.filter((n) => n.nominationStatus === 'PENDING').length;

    const votesPerCategory = categoriesList.map((c) => ({
      id: c.id,
      name: c.name,
      votes: catVoteMap.get(c.id) || 0,
    }));

    const votingActivity = Array.from(dailyVoteMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, votesCount]) => ({ date, votes: votesCount }));

    const regionalTurnout = Array.from(regionMap.entries())
      .map(([region, votesCount]) => ({ region, votes: votesCount }))
      .sort((a, b) => b.votes - a.votes);

    const catNameMap = new Map(categoriesList.map((c) => [c.id, c.name]));
    const nomMap = new Map(nomineesList.map((n) => [n.id, n]));
    const voterMap = new Map(votersList.map((vt) => [vt.id, vt]));

    const topNominees = nomineesList
      .filter((n) => n.nominationStatus === 'APPROVED')
      .map((n) => ({
        ...n,
        categoryName: catNameMap.get(n.categoryId) || 'Unassigned',
        votes: nomVoteMap.get(n.id) || 0,
      }))
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 6);

    const recentVotes = votesList.slice(0, 10).map((v) => ({
      id: v.id,
      receiptCode: v.receiptCode,
      nomineeName: nomMap.get(v.nomineeId)?.fullName || 'Nominee',
      categoryName: catNameMap.get(v.categoryId) || 'Category',
      voterCode: voterMap.get(v.voterId)?.voterCode || 'VTR',
      verificationMethod: v.verificationMethod,
      ghanaRegion: v.ghanaRegion,
      castAt: v.castAt,
    }));

    res.json({
      kpis: {
        totalAwards,
        activeAwards,
        totalCategories,
        totalNominees,
        totalVotes,
        totalVoters,
        activeVotingCategories,
        publishedResults,
        momoRevenueGhs,
        pendingNominationsCount,
      },
      votesPerCategory,
      votingActivity,
      regionalTurnout,
      topNominees,
      recentVotes,
      recentAudits,
      notifications: notifs,
      contactMessages: messages,
      settings: settingsRow[0],
    });
  } catch (err) {
    console.error('Admin overview error:', err);
    res.status(500).json({ error: 'Unable to load dashboard analytics.' });
  }
});

// --- Awards Management ---
app.get('/api/admin/awards', requireAdminAuth, async (_req, res) => {
  res.json(await db.select().from(awards).orderBy(desc(awards.editionYear), desc(awards.id)));
});

app.post(
  '/api/admin/awards',
  requireAdminAuth,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  requirePermission('awards'),
  async (req: AdminAuthRequest, res) => {
    try {
      const schema = z.object({
        title: z.string().trim().min(3),
        editionYear: z.number().int().min(2000).max(2100),
        tagline: z.string().trim().min(2),
        description: z.string().trim().min(10),
        logoUrl: z.string().optional(),
        bannerUrl: z.string().optional(),
        votingStartsAt: z.string(),
        votingEndsAt: z.string(),
        isPublished: z.boolean().default(true),
        isActive: z.boolean().default(true),
        resultsPublished: z.boolean().default(false),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid award fields.' });
        return;
      }
      const slug = `${parsed.data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString().slice(-4)}`;
      const [created] = await db
        .insert(awards)
        .values({
          ...parsed.data,
          slug,
          votingStartsAt: new Date(parsed.data.votingStartsAt),
          votingEndsAt: new Date(parsed.data.votingEndsAt),
          createdBy: req.admin!.id,
        })
        .returning();
      await logAudit(req, 'CREATE_AWARD', 'award', String(created.id), { title: created.title });
      res.status(201).json(created);
    } catch (err) {
      console.error('Create award error:', err);
      res.status(500).json({ error: 'Failed to create award.' });
    }
  }
);

app.patch(
  '/api/admin/awards/:id',
  requireAdminAuth,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  requirePermission('awards'),
  async (req: AdminAuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      const body = req.body || {};
      const updatePayload: Partial<typeof awards.$inferInsert> = { updatedAt: new Date() };
      if (body.title !== undefined) updatePayload.title = String(body.title);
      if (body.editionYear !== undefined) updatePayload.editionYear = Number(body.editionYear);
      if (body.tagline !== undefined) updatePayload.tagline = String(body.tagline);
      if (body.description !== undefined) updatePayload.description = String(body.description);
      if (body.logoUrl !== undefined) updatePayload.logoUrl = String(body.logoUrl);
      if (body.bannerUrl !== undefined) updatePayload.bannerUrl = String(body.bannerUrl);
      if (body.votingStartsAt !== undefined) updatePayload.votingStartsAt = new Date(body.votingStartsAt);
      if (body.votingEndsAt !== undefined) updatePayload.votingEndsAt = new Date(body.votingEndsAt);
      if (body.isPublished !== undefined) updatePayload.isPublished = Boolean(body.isPublished);
      if (body.isActive !== undefined) updatePayload.isActive = Boolean(body.isActive);
      if (body.resultsPublished !== undefined) updatePayload.resultsPublished = Boolean(body.resultsPublished);

      const [updated] = await db.update(awards).set(updatePayload).where(eq(awards.id, id)).returning();
      if (!updated) {
        res.status(404).json({ error: 'Award not found.' });
        return;
      }
      await logAudit(req, 'UPDATE_AWARD', 'award', String(id), { changes: Object.keys(updatePayload) });
      res.json(updated);
    } catch (err) {
      console.error('Update award error:', err);
      res.status(500).json({ error: 'Failed to update award.' });
    }
  }
);

app.delete(
  '/api/admin/awards/:id',
  requireAdminAuth,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  requirePermission('awards'),
  async (req: AdminAuthRequest, res) => {
    const id = Number(req.params.id);
    const [deleted] = await db.delete(awards).where(eq(awards.id, id)).returning();
    if (!deleted) {
      res.status(404).json({ error: 'Award not found.' });
      return;
    }
    await logAudit(req, 'DELETE_AWARD', 'award', String(id), { title: deleted.title });
    res.json({ ok: true });
  }
);

// --- Categories Management ---
app.get('/api/admin/categories', requireAdminAuth, async (_req, res) => {
  res.json(await db.select().from(categories).orderBy(categories.displayOrder, categories.id));
});

app.post(
  '/api/admin/categories',
  requireAdminAuth,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  requirePermission('categories'),
  async (req: AdminAuthRequest, res) => {
    try {
      const schema = z.object({
        awardId: z.number().int().positive(),
        name: z.string().trim().min(2),
        description: z.string().trim().min(5),
        imageUrl: z.string().optional(),
        displayOrder: z.number().int().default(1),
        isActive: z.boolean().default(true),
        votingEnabled: z.boolean().default(true),
        maxVotesPerVoter: z.number().int().min(1).default(1),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid category payload.' });
        return;
      }
      const slug = `${parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString().slice(-3)}`;
      const [created] = await db.insert(categories).values({ ...parsed.data, slug }).returning();
      await logAudit(req, 'CREATE_CATEGORY', 'category', String(created.id), { name: created.name });
      res.status(201).json(created);
    } catch (err) {
      console.error('Create category error:', err);
      res.status(500).json({ error: 'Failed to create category.' });
    }
  }
);

app.patch(
  '/api/admin/categories/:id',
  requireAdminAuth,
  requireRole(['SUPER_ADMIN', 'ADMIN', 'EDITOR']),
  requirePermission('categories'),
  async (req: AdminAuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      const body = req.body || {};
      const updatePayload: Partial<typeof categories.$inferInsert> = { updatedAt: new Date() };
      if (body.name !== undefined) updatePayload.name = String(body.name);
      if (body.description !== undefined) updatePayload.description = String(body.description);
      if (body.imageUrl !== undefined) updatePayload.imageUrl = String(body.imageUrl);
      if (body.displayOrder !== undefined) updatePayload.displayOrder = Number(body.displayOrder);
      if (req.admin!.role !== 'EDITOR') {
        if (body.awardId !== undefined) updatePayload.awardId = Number(body.awardId);
        if (body.isActive !== undefined) updatePayload.isActive = Boolean(body.isActive);
        if (body.votingEnabled !== undefined) updatePayload.votingEnabled = Boolean(body.votingEnabled);
        if (body.maxVotesPerVoter !== undefined) updatePayload.maxVotesPerVoter = Number(body.maxVotesPerVoter);
      }

      const [updated] = await db.update(categories).set(updatePayload).where(eq(categories.id, id)).returning();
      if (!updated) {
        res.status(404).json({ error: 'Category not found.' });
        return;
      }
      await logAudit(req, 'UPDATE_CATEGORY', 'category', String(id), { name: updated.name });
      res.json(updated);
    } catch (err) {
      console.error('Update category error:', err);
      res.status(500).json({ error: 'Failed to update category.' });
    }
  }
);

app.delete(
  '/api/admin/categories/:id',
  requireAdminAuth,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  requirePermission('categories'),
  async (req: AdminAuthRequest, res) => {
    const id = Number(req.params.id);
    const [deleted] = await db.delete(categories).where(eq(categories.id, id)).returning();
    if (!deleted) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }
    await logAudit(req, 'DELETE_CATEGORY', 'category', String(id), { name: deleted.name });
    res.json({ ok: true });
  }
);

// --- Nominees Management ---
app.get('/api/admin/nominees', requireAdminAuth, async (_req, res) => {
  const rows = await db.select().from(nominees).orderBy(desc(nominees.createdAt));
  const [freeRows, momoRows] = await Promise.all([
    db.select({ nomineeId: votes.nomineeId, total: count() }).from(votes).groupBy(votes.nomineeId),
    db
      .select({
        nomineeId: momoTransactions.nomineeId,
        totalVotes: sql<number>`COALESCE(SUM(${momoTransactions.voteCount}), 0)`,
      })
      .from(momoTransactions)
      .where(eq(momoTransactions.status, 'COMPLETED'))
      .groupBy(momoTransactions.nomineeId),
  ]);
  const voteMap = new Map<number, number>();
  for (const r of freeRows) voteMap.set(r.nomineeId, (voteMap.get(r.nomineeId) || 0) + Number(r.total));
  for (const r of momoRows)
    voteMap.set(r.nomineeId, (voteMap.get(r.nomineeId) || 0) + Number(r.totalVotes || 0));

  res.json(rows.map((n) => ({ ...n, voteCount: voteMap.get(n.id) || 0 })));
});

app.post(
  '/api/admin/nominees',
  requireAdminAuth,
  requireRole(['SUPER_ADMIN', 'ADMIN', 'EDITOR']),
  requirePermission('nominees'),
  async (req: AdminAuthRequest, res) => {
    try {
      const schema = z.object({
        awardId: z.number().int().positive(),
        categoryId: z.number().int().positive(),
        nomineeNumber: z.string().trim().min(2).optional(),
        fullName: z.string().trim().min(2),
        roleTitle: z.string().trim().default(''),
        organization: z.string().trim().default(''),
        photoUrl: z.string().optional(),
        biography: z.string().trim().min(10),
        socialLinks: z
          .object({
            website: z.string().optional(),
            linkedin: z.string().optional(),
            twitter: z.string().optional(),
            instagram: z.string().optional(),
          })
          .default({}),
        nominationStatus: z.enum(['APPROVED', 'PENDING', 'ARCHIVED']).default('APPROVED'),
        isActive: z.boolean().default(true),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid nominee details.' });
        return;
      }
      const nomineeNumber =
        parsed.data.nomineeNumber ||
        `BSX-${crypto.randomInt(500, 999)}-${crypto.randomBytes(1).toString('hex').toUpperCase()}`;

      const [created] = await db.insert(nominees).values({ ...parsed.data, nomineeNumber }).returning();
      await logAudit(req, 'CREATE_NOMINEE', 'nominee', String(created.id), {
        fullName: created.fullName,
        nomineeNumber: created.nomineeNumber,
      });
      res.status(201).json({ ...created, voteCount: 0 });
    } catch (err) {
      console.error('Create nominee error:', err);
      res.status(500).json({ error: 'Failed to create nominee.' });
    }
  }
);

app.patch(
  '/api/admin/nominees/:id',
  requireAdminAuth,
  requireRole(['SUPER_ADMIN', 'ADMIN', 'EDITOR']),
  requirePermission('nominees'),
  async (req: AdminAuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      const body = req.body || {};
      const updatePayload: Partial<typeof nominees.$inferInsert> = { updatedAt: new Date() };
      if (body.awardId !== undefined) updatePayload.awardId = Number(body.awardId);
      if (body.categoryId !== undefined) updatePayload.categoryId = Number(body.categoryId);
      if (body.nomineeNumber !== undefined) updatePayload.nomineeNumber = String(body.nomineeNumber);
      if (body.fullName !== undefined) updatePayload.fullName = String(body.fullName);
      if (body.roleTitle !== undefined) updatePayload.roleTitle = String(body.roleTitle);
      if (body.organization !== undefined) updatePayload.organization = String(body.organization);
      if (body.photoUrl !== undefined) updatePayload.photoUrl = String(body.photoUrl);
      if (body.biography !== undefined) updatePayload.biography = String(body.biography);
      if (body.socialLinks !== undefined) updatePayload.socialLinks = body.socialLinks;
      if (body.nominationStatus !== undefined) updatePayload.nominationStatus = body.nominationStatus;
      if (body.isActive !== undefined) updatePayload.isActive = Boolean(body.isActive);
      if (body.isWinner !== undefined && req.admin!.role !== 'EDITOR') {
        updatePayload.isWinner = Boolean(body.isWinner);
      }

      const [updated] = await db.update(nominees).set(updatePayload).where(eq(nominees.id, id)).returning();
      if (!updated) {
        res.status(404).json({ error: 'Nominee not found.' });
        return;
      }
      await logAudit(req, 'UPDATE_NOMINEE', 'nominee', String(id), {
        fullName: updated.fullName,
        status: updated.nominationStatus,
      });
      res.json(updated);
    } catch (err) {
      console.error('Update nominee error:', err);
      res.status(500).json({ error: 'Failed to update nominee.' });
    }
  }
);

app.delete(
  '/api/admin/nominees/:id',
  requireAdminAuth,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  requirePermission('nominees'),
  async (req: AdminAuthRequest, res) => {
    const id = Number(req.params.id);
    const [deleted] = await db.delete(nominees).where(eq(nominees.id, id)).returning();
    if (!deleted) {
      res.status(404).json({ error: 'Nominee not found.' });
      return;
    }
    await logAudit(req, 'DELETE_NOMINEE', 'nominee', String(id), { fullName: deleted.fullName });
    res.json({ ok: true });
  }
);

// --- Voting & Results Governance ---
app.patch(
  '/api/admin/voting/controls',
  requireAdminAuth,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  requirePermission('voting'),
  async (req: AdminAuthRequest, res) => {
    try {
      const body = req.body || {};
      const [settingsRow] = await db.select().from(systemSettings).limit(1);
      if (settingsRow) {
        const updates: Partial<typeof systemSettings.$inferInsert> = { updatedAt: new Date() };
        if (body.votingPaused !== undefined) updates.votingPaused = Boolean(body.votingPaused);
        if (body.resultsPublic !== undefined) updates.resultsPublic = Boolean(body.resultsPublic);
        if (body.maxVotesPerCategory !== undefined)
          updates.maxVotesPerCategory = Number(body.maxVotesPerCategory);
        await db.update(systemSettings).set(updates).where(eq(systemSettings.id, settingsRow.id));

        if (body.votingPaused !== undefined) {
          await db.insert(notifications).values({
            audience: 'ALL',
            type: body.votingPaused ? 'VOTING_CLOSE' : 'VOTING_OPEN',
            title: body.votingPaused ? 'Voting Temporarily Paused' : 'Public Voting Resumed',
            message: body.votingPaused
              ? 'The governance board has temporarily paused ballot submissions.'
              : 'Verified public voting has resumed across active categories.',
          });
        }
        if (body.resultsPublic !== undefined) {
          await db.insert(notifications).values({
            audience: 'ALL',
            type: 'ANNOUNCEMENT',
            title: body.resultsPublic ? 'Official Results Published' : 'Results Sealed Pending Announcement',
            message: body.resultsPublic
              ? 'Live verified standings and category winners are now visible.'
              : 'Public standings have been sealed ahead of the official Accra Gala announcement.',
          });
        }
      }
      await logAudit(req, 'UPDATE_VOTING_CONTROLS', 'system_settings', '1', body);
      const [updated] = await db.select().from(systemSettings).limit(1);
      res.json(updated);
    } catch (err) {
      console.error('Voting controls error:', err);
      res.status(500).json({ error: 'Failed to update voting controls.' });
    }
  }
);

app.get(
  '/api/admin/voting/records',
  requireAdminAuth,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  requirePermission('voting'),
  async (_req, res) => {
    const [votesList, momoList, categoriesList, nomineesList, votersList] = await Promise.all([
      db.select().from(votes).orderBy(desc(votes.castAt)).limit(200),
      db
        .select()
        .from(momoTransactions)
        .where(eq(momoTransactions.status, 'COMPLETED'))
        .orderBy(desc(momoTransactions.completedAt))
        .limit(100),
      db.select().from(categories),
      db.select().from(nominees),
      db.select().from(voters),
    ]);
    const catMap = new Map(categoriesList.map((c) => [c.id, c.name]));
    const nomMap = new Map(nomineesList.map((n) => [n.id, n.fullName]));
    const voterMap = new Map(votersList.map((v) => [v.id, v]));

    const combined = [
      ...votesList.map((v) => {
        const vt = voterMap.get(v.voterId);
        return {
          id: `v-${v.id}`,
          receiptCode: v.receiptCode,
          categoryName: catMap.get(v.categoryId) || 'Category',
          nomineeName: nomMap.get(v.nomineeId) || 'Nominee',
          voterCode: vt?.voterCode || 'VTR',
          maskedIdentity: maskIdentifier(vt?.email, vt?.phone),
          verificationMethod: v.verificationMethod,
          ghanaRegion: v.ghanaRegion,
          voteCount: 1,
          castAt: v.castAt,
        };
      }),
      ...momoList.map((m) => ({
        id: `m-${m.id}`,
        receiptCode: m.receiptCode,
        categoryName: catMap.get(m.categoryId) || 'Category',
        nomineeName: nomMap.get(m.nomineeId) || 'Nominee',
        voterCode: `${m.network}-${m.channel}`,
        maskedIdentity: maskIdentifier(null, m.voterPhone),
        verificationMethod: `${m.network} MoMo (GHS ${m.amountGhs})`,
        ghanaRegion: m.ghanaRegion,
        voteCount: m.voteCount,
        castAt: m.completedAt || m.createdAt,
      })),
    ].sort((a, b) => new Date(b.castAt).getTime() - new Date(a.castAt).getTime());

    res.json(combined);
  }
);

// --- Voters Management ---
app.get(
  '/api/admin/voters',
  requireAdminAuth,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  requirePermission('voters'),
  async (_req, res) => {
    const [votersList, voteCounts] = await Promise.all([
      db.select().from(voters).orderBy(desc(voters.registeredAt)),
      db.select({ voterId: votes.voterId, total: count() }).from(votes).groupBy(votes.voterId),
    ]);
    const countMap = new Map(voteCounts.map((r) => [r.voterId, Number(r.total)]));
    res.json(
      votersList.map((v) => ({
        id: v.id,
        voterCode: v.voterCode,
        maskedContact: maskIdentifier(v.email, v.phone),
        ghanaRegion: v.ghanaRegion,
        verificationMethod: v.verificationMethod,
        isVerified: v.isVerified,
        votesCast: countMap.get(v.id) || 0,
        flaggedSuspicious: v.flaggedSuspicious,
        suspiciousReason: v.suspiciousReason,
        registeredAt: v.registeredAt,
        lastVotedAt: v.lastVotedAt,
      }))
    );
  }
);

app.patch(
  '/api/admin/voters/:id/flag',
  requireAdminAuth,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  requirePermission('voters'),
  async (req: AdminAuthRequest, res) => {
    const id = Number(req.params.id);
    const flagged = Boolean(req.body?.flaggedSuspicious);
    const reason = req.body?.suspiciousReason
      ? String(req.body.suspiciousReason)
      : flagged
      ? 'Flagged by administrator'
      : null;
    const [updated] = await db
      .update(voters)
      .set({ flaggedSuspicious: flagged, suspiciousReason: reason })
      .where(eq(voters.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: 'Voter not found.' });
      return;
    }
    await logAudit(req, flagged ? 'FLAG_VOTER' : 'UNFLAG_VOTER', 'voter', updated.voterCode, { reason });
    res.json({ ok: true, flaggedSuspicious: updated.flaggedSuspicious });
  }
);

// --- Administrators Management (SUPER_ADMIN ONLY) ---
app.get('/api/admin/admins', requireAdminAuth, requireRole(['SUPER_ADMIN']), async (_req, res) => {
  const rows = await db
    .select({
      id: admins.id,
      email: admins.email,
      fullName: admins.fullName,
      role: admins.role,
      permissions: admins.permissions,
      isActive: admins.isActive,
      lastLoginAt: admins.lastLoginAt,
      createdAt: admins.createdAt,
    })
    .from(admins)
    .orderBy(admins.id);
  res.json(rows);
});

app.post('/api/admin/admins', requireAdminAuth, requireRole(['SUPER_ADMIN']), async (req: AdminAuthRequest, res) => {
  try {
    const schema = z.object({
      email: z.string().trim().email(),
      fullName: z.string().trim().min(2),
      password: z.string().min(8),
      role: z.enum(['SUPER_ADMIN', 'ADMIN', 'EDITOR']),
      permissions: z.array(z.string()).default([]),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Provide valid email, name, role, and 8+ character password.' });
      return;
    }
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const email = parsed.data.email.toLowerCase();
    const [created] = await db
      .insert(admins)
      .values({
        email,
        fullName: parsed.data.fullName,
        passwordHash,
        role: parsed.data.role,
        permissions: parsed.data.permissions,
        isActive: true,
      })
      .returning({
        id: admins.id,
        email: admins.email,
        fullName: admins.fullName,
        role: admins.role,
        permissions: admins.permissions,
        isActive: admins.isActive,
        createdAt: admins.createdAt,
      });
    await logAudit(req, 'CREATE_ADMIN', 'admin', String(created.id), { email: created.email, role: created.role });
    res.status(201).json(created);
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr?.code === '23505') {
      res.status(409).json({ error: 'An administrator with this email already exists.' });
      return;
    }
    console.error('Create admin error:', err);
    res.status(500).json({ error: 'Unable to create administrator.' });
  }
});

app.patch('/api/admin/admins/:id', requireAdminAuth, requireRole(['SUPER_ADMIN']), async (req: AdminAuthRequest, res) => {
  const id = Number(req.params.id);
  const body = req.body || {};
  const updates: Partial<typeof admins.$inferInsert> = { updatedAt: new Date() };
  if (body.role !== undefined) updates.role = body.role;
  if (body.isActive !== undefined) updates.isActive = Boolean(body.isActive);
  if (body.permissions !== undefined) updates.permissions = body.permissions;
  if (body.fullName !== undefined) updates.fullName = String(body.fullName);

  const [updated] = await db
    .update(admins)
    .set(updates)
    .where(eq(admins.id, id))
    .returning({
      id: admins.id,
      email: admins.email,
      fullName: admins.fullName,
      role: admins.role,
      permissions: admins.permissions,
      isActive: admins.isActive,
      lastLoginAt: admins.lastLoginAt,
      createdAt: admins.createdAt,
    });
  if (!updated) {
    res.status(404).json({ error: 'Administrator not found.' });
    return;
  }
  await logAudit(req, 'UPDATE_ADMIN', 'admin', String(id), {
    role: updated.role,
    isActive: updated.isActive,
    permissions: updated.permissions,
  });
  res.json(updated);
});

app.delete('/api/admin/admins/:id', requireAdminAuth, requireRole(['SUPER_ADMIN']), async (req: AdminAuthRequest, res) => {
  const id = Number(req.params.id);
  if (id === req.admin!.id) {
    res.status(400).json({ error: 'You cannot delete your own active administrator account.' });
    return;
  }
  const [deleted] = await db.delete(admins).where(eq(admins.id, id)).returning();
  if (!deleted) {
    res.status(404).json({ error: 'Administrator not found.' });
    return;
  }
  await logAudit(req, 'DELETE_ADMIN', 'admin', String(id), { email: deleted.email });
  res.json({ ok: true });
});

// --- Sponsors ---
app.get('/api/admin/sponsors', requireAdminAuth, async (_req, res) => {
  res.json(await db.select().from(sponsors).orderBy(sponsors.displayOrder, sponsors.id));
});

app.post(
  '/api/admin/sponsors',
  requireAdminAuth,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  requirePermission('sponsors'),
  async (req: AdminAuthRequest, res) => {
    const [created] = await db
      .insert(sponsors)
      .values({
        name: String(req.body.name || ''),
        tier: String(req.body.tier || 'Gold Patron'),
        logoUrl: req.body.logoUrl || null,
        websiteUrl: req.body.websiteUrl || null,
        displayOrder: Number(req.body.displayOrder || 1),
        isActive: req.body.isActive !== false,
      })
      .returning();
    await logAudit(req, 'CREATE_SPONSOR', 'sponsor', String(created.id), { name: created.name });
    res.status(201).json(created);
  }
);

app.patch(
  '/api/admin/sponsors/:id',
  requireAdminAuth,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  requirePermission('sponsors'),
  async (req: AdminAuthRequest, res) => {
    const id = Number(req.params.id);
    const [updated] = await db
      .update(sponsors)
      .set({
        name: req.body.name,
        tier: req.body.tier,
        logoUrl: req.body.logoUrl,
        websiteUrl: req.body.websiteUrl,
        displayOrder: req.body.displayOrder !== undefined ? Number(req.body.displayOrder) : undefined,
        isActive: req.body.isActive,
      })
      .where(eq(sponsors.id, id))
      .returning();
    await logAudit(req, 'UPDATE_SPONSOR', 'sponsor', String(id), { name: updated?.name });
    res.json(updated);
  }
);

app.delete(
  '/api/admin/sponsors/:id',
  requireAdminAuth,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  requirePermission('sponsors'),
  async (req: AdminAuthRequest, res) => {
    const id = Number(req.params.id);
    await db.delete(sponsors).where(eq(sponsors.id, id));
    await logAudit(req, 'DELETE_SPONSOR', 'sponsor', String(id));
    res.json({ ok: true });
  }
);

// --- Announcements ---
app.get('/api/admin/announcements', requireAdminAuth, async (_req, res) => {
  res.json(await db.select().from(announcements).orderBy(desc(announcements.publishedAt)));
});

app.post(
  '/api/admin/announcements',
  requireAdminAuth,
  requireRole(['SUPER_ADMIN', 'ADMIN', 'EDITOR']),
  requirePermission('announcements'),
  async (req: AdminAuthRequest, res) => {
    const title = String(req.body.title || '').trim();
    const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString().slice(-4)}`;
    const [created] = await db
      .insert(announcements)
      .values({
        title,
        slug,
        category: String(req.body.category || 'Governance'),
        summary: String(req.body.summary || ''),
        content: String(req.body.content || ''),
        publishedAt: req.body.publishedAt ? new Date(req.body.publishedAt) : new Date(),
        isPublished: req.body.isPublished !== false,
        createdBy: req.admin!.id,
      })
      .returning();
    if (created.isPublished) {
      await db.insert(notifications).values({
        audience: 'ALL',
        type: 'ANNOUNCEMENT',
        title: created.title,
        message: created.summary,
      });
    }
    await logAudit(req, 'CREATE_ANNOUNCEMENT', 'announcement', String(created.id), { title: created.title });
    res.status(201).json(created);
  }
);

app.patch(
  '/api/admin/announcements/:id',
  requireAdminAuth,
  requireRole(['SUPER_ADMIN', 'ADMIN', 'EDITOR']),
  requirePermission('announcements'),
  async (req: AdminAuthRequest, res) => {
    const id = Number(req.params.id);
    const [updated] = await db
      .update(announcements)
      .set({
        title: req.body.title,
        category: req.body.category,
        summary: req.body.summary,
        content: req.body.content,
        publishedAt: req.body.publishedAt ? new Date(req.body.publishedAt) : undefined,
        isPublished: req.body.isPublished,
      })
      .where(eq(announcements.id, id))
      .returning();
    await logAudit(req, 'UPDATE_ANNOUNCEMENT', 'announcement', String(id), { title: updated?.title });
    res.json(updated);
  }
);

app.delete(
  '/api/admin/announcements/:id',
  requireAdminAuth,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  requirePermission('announcements'),
  async (req: AdminAuthRequest, res) => {
    const id = Number(req.params.id);
    await db.delete(announcements).where(eq(announcements.id, id));
    await logAudit(req, 'DELETE_ANNOUNCEMENT', 'announcement', String(id));
    res.json({ ok: true });
  }
);

// --- Audit Logs ---
app.get(
  '/api/admin/audit-logs',
  requireAdminAuth,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  requirePermission('audit_logs'),
  async (_req, res) => {
    res.json(await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(200));
  }
);

// --- Website Settings (SUPER_ADMIN ONLY) ---
app.get('/api/admin/settings', requireAdminAuth, async (_req, res) => {
  const [row] = await db.select().from(systemSettings).limit(1);
  res.json(row);
});

app.patch('/api/admin/settings', requireAdminAuth, requireRole(['SUPER_ADMIN']), async (req: AdminAuthRequest, res) => {
  const [existing] = await db.select().from(systemSettings).limit(1);
  if (!existing) {
    res.status(404).json({ error: 'System settings not initialized.' });
    return;
  }
  const b = req.body || {};
  const [updated] = await db
    .update(systemSettings)
    .set({
      siteName: b.siteName ?? existing.siteName,
      siteTagline: b.siteTagline ?? existing.siteTagline,
      siteLogoUrl: b.siteLogoUrl ?? existing.siteLogoUrl,
      faviconUrl: b.faviconUrl ?? existing.faviconUrl,
      siteDescription: b.siteDescription ?? existing.siteDescription,
      contactEmail: b.contactEmail ?? existing.contactEmail,
      contactPhone: b.contactPhone ?? existing.contactPhone,
      contactAddress: b.contactAddress ?? existing.contactAddress,
      whatsappNumber: b.whatsappNumber !== undefined ? String(b.whatsappNumber).trim() || '0591593157' : existing.whatsappNumber,
      developerName: b.developerName !== undefined ? String(b.developerName).trim() || 'Pearlicious Tech Solutions' : existing.developerName,
      socialLinks: b.socialLinks ?? existing.socialLinks,
      primaryColor: b.primaryColor ?? existing.primaryColor,
      accentColor: b.accentColor ?? existing.accentColor,
      requireOtp: b.requireOtp ?? existing.requireOtp,
      allowEmailOtp: b.allowEmailOtp ?? existing.allowEmailOtp,
      allowPhoneOtp: b.allowPhoneOtp ?? existing.allowPhoneOtp,
      requireCaptcha: b.requireCaptcha ?? existing.requireCaptcha,
      enforceSingleChannelPerVoter: b.enforceSingleChannelPerVoter ?? existing.enforceSingleChannelPerVoter,
      paidVotingEnabled: b.paidVotingEnabled ?? existing.paidVotingEnabled,
      votePriceGhs: b.votePriceGhs !== undefined ? Number(b.votePriceGhs) : existing.votePriceGhs,
      smsProvider: b.smsProvider ?? existing.smsProvider,
      ussdShortcode: b.ussdShortcode ?? existing.ussdShortcode,
      productionMode: b.productionMode ?? existing.productionMode,
      maxVotesPerCategory: b.maxVotesPerCategory !== undefined ? Number(b.maxVotesPerCategory) : existing.maxVotesPerCategory,
      rateLimitPerMinute: b.rateLimitPerMinute !== undefined ? Number(b.rateLimitPerMinute) : existing.rateLimitPerMinute,
      resultsPublic: b.resultsPublic ?? existing.resultsPublic,
      votingPaused: b.votingPaused ?? existing.votingPaused,
      maintenanceMode: b.maintenanceMode ?? existing.maintenanceMode,
      updatedAt: new Date(),
    })
    .where(eq(systemSettings.id, existing.id))
    .returning();

  await logAudit(req, 'UPDATE_SYSTEM_SETTINGS', 'system_settings', String(existing.id), {
    resultsPublic: updated.resultsPublic,
    paidVotingEnabled: updated.paidVotingEnabled,
    productionMode: updated.productionMode,
    maintenanceMode: updated.maintenanceMode,
  });
  res.json(updated);
});

app.post('/api/admin/notifications/read-all', requireAdminAuth, async (_req, res) => {
  await db.update(notifications).set({ isRead: true }).where(sql`true`);
  res.json({ ok: true });
});

async function startServer() {
  const port = Number(process.env.PORT || 3000);
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Black Star Excellence Honours server running on http://0.0.0.0:${port}`);
  });
}

startServer();
