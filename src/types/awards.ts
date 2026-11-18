export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR';

export interface SystemSettings {
  id: number;
  siteName: string;
  siteTagline: string;
  siteLogoUrl?: string | null;
  faviconUrl?: string | null;
  siteDescription: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  socialLinks: {
    twitter?: string;
    linkedin?: string;
    instagram?: string;
    youtube?: string;
  };
  primaryColor: string;
  accentColor: string;
  requireOtp: boolean;
  allowEmailOtp: boolean;
  allowPhoneOtp: boolean;
  requireCaptcha: boolean;
  maxVotesPerCategory: number;
  rateLimitPerMinute: number;
  resultsPublic: boolean;
  votingPaused: boolean;
  maintenanceMode: boolean;
  updatedAt: string;
}

export interface Award {
  id: number;
  title: string;
  slug: string;
  editionYear: number;
  tagline: string;
  description: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  votingStartsAt: string;
  votingEndsAt: string;
  isPublished: boolean;
  isActive: boolean;
  resultsPublished: boolean;
  createdAt: string;
}

export interface Category {
  id: number;
  awardId: number;
  name: string;
  slug: string;
  description: string;
  imageUrl?: string | null;
  displayOrder: number;
  isActive: boolean;
  votingEnabled: boolean;
  maxVotesPerVoter: number;
  nomineeCount?: number;
  totalVotes?: number | null;
}

export interface Nominee {
  id: number;
  awardId: number;
  categoryId: number;
  nomineeNumber: string;
  fullName: string;
  roleTitle: string;
  organization: string;
  photoUrl?: string | null;
  biography: string;
  socialLinks: {
    website?: string;
    linkedin?: string;
    twitter?: string;
    instagram?: string;
  };
  nominationStatus: 'APPROVED' | 'PENDING' | 'ARCHIVED';
  isActive: boolean;
  isWinner: boolean;
  voteCount?: number | null;
  votePercentage?: number | null;
  createdAt: string;
}

export interface Sponsor {
  id: number;
  name: string;
  tier: string;
  logoUrl?: string | null;
  websiteUrl?: string | null;
  displayOrder: number;
  isActive: boolean;
}

export interface Announcement {
  id: number;
  title: string;
  slug: string;
  category: string;
  summary: string;
  content: string;
  publishedAt: string;
  isPublished: boolean;
}

export interface AppNotification {
  id: number;
  audience: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface PublicBootstrap {
  settings: SystemSettings;
  awards: Award[];
  activeAward: Award | null;
  categories: Category[];
  nominees: Nominee[];
  sponsors: Sponsor[];
  announcements: Announcement[];
  notifications: AppNotification[];
  resultsVisible: boolean;
  totalPublicVotes: number | null;
}

export interface AdminUser {
  id: number;
  email: string;
  fullName: string;
  role: AdminRole;
  permissions: string[];
  isActive?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
}

export interface AuditLogEntry {
  id: number;
  adminEmail: string;
  adminRole: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}

export interface MaskedVoter {
  id: number;
  voterCode: string;
  maskedContact: string;
  verificationMethod: string;
  isVerified: boolean;
  votesCast: number;
  flaggedSuspicious: boolean;
  suspiciousReason: string | null;
  registeredAt: string;
  lastVotedAt: string | null;
}

export interface VotingRecord {
  id: number;
  receiptCode: string;
  categoryName: string;
  nomineeName: string;
  voterCode: string;
  maskedIdentity: string;
  verificationMethod: string;
  castAt: string;
}
