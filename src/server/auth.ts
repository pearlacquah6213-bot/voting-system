import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.ts';
import { admins } from '../db/schema.ts';
import { adminAuth } from '../lib/firebase-admin.ts';

export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR';

export interface AuthenticatedAdmin {
  id: number;
  email: string;
  fullName: string;
  role: AdminRole;
  permissions: string[];
}

export interface AdminAuthRequest extends Request {
  admin?: AuthenticatedAdmin;
}

const getJwtSecret = (): string => {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return process.env.SESSION_SECRET;
  }
  const seedMaterial = process.env.SQL_PASSWORD || process.env.SQL_HOST || 'blackstar-awards-session';
  return crypto.createHash('sha256').update(`blackstar:${seedMaterial}`).digest('hex');
};

export function signAdminToken(admin: AuthenticatedAdmin): string {
  return jwt.sign(
    {
      sub: String(admin.id),
      email: admin.email,
      fullName: admin.fullName,
      role: admin.role,
      permissions: admin.permissions,
    },
    getJwtSecret(),
    { expiresIn: '12h' }
  );
}

export async function requireAdminAuth(
  req: AdminAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing authentication token' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  try {
    try {
      const payload = jwt.verify(token, getJwtSecret()) as { sub: string; email: string };
      const adminId = Number(payload.sub);
      const rows = await db.select().from(admins).where(eq(admins.id, adminId)).limit(1);
      const record = rows[0];
      if (!record || !record.isActive) {
        res.status(401).json({ error: 'Account is inactive or no longer exists' });
        return;
      }
      req.admin = {
        id: record.id,
        email: record.email,
        fullName: record.fullName,
        role: record.role as AdminRole,
        permissions: record.permissions || [],
      };
      next();
      return;
    } catch {
      // Fallback to Firebase ID Token
    }

    const decoded = await adminAuth.verifyIdToken(token);
    if (!decoded.email) {
      res.status(401).json({ error: 'Firebase token missing verified email' });
      return;
    }

    const rows = await db
      .select()
      .from(admins)
      .where(eq(admins.email, decoded.email.toLowerCase()))
      .limit(1);
    const record = rows[0];

    if (!record) {
      res.status(403).json({
        error: 'This Google account is not registered as an administrator.',
      });
      return;
    }
    if (!record.isActive) {
      res.status(403).json({ error: 'Administrator account has been deactivated.' });
      return;
    }

    if (!record.uid || record.uid !== decoded.uid) {
      await db
        .update(admins)
        .set({ uid: decoded.uid, lastLoginAt: new Date(), updatedAt: new Date() })
        .where(eq(admins.id, record.id));
    }

    req.admin = {
      id: record.id,
      email: record.email,
      fullName: record.fullName,
      role: record.role as AdminRole,
      permissions: record.permissions || [],
    };
    next();
  } catch (err) {
    console.error('Admin auth verification failed:', err);
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
}

export function requireRole(allowedRoles: AdminRole[]) {
  return (req: AdminAuthRequest, res: Response, next: NextFunction): void => {
    if (!req.admin) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!allowedRoles.includes(req.admin.role)) {
      res.status(403).json({
        error: `Access denied: Requires ${allowedRoles.join(' or ')} privileges`,
      });
      return;
    }
    next();
  };
}

export function requirePermission(permission: string) {
  return (req: AdminAuthRequest, res: Response, next: NextFunction): void => {
    if (!req.admin) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (req.admin.role === 'SUPER_ADMIN') {
      next();
      return;
    }
    const perms = req.admin.permissions || [];
    if (perms.includes('*') || perms.includes(permission)) {
      next();
      return;
    }
    res.status(403).json({
      error: `Permission denied: Missing '${permission}' capability`,
    });
  };
}
