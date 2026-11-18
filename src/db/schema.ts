import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// 1. profiles
export const profiles = pgTable('profiles', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull().unique(),
  fullName: text('full_name').notNull(),
  avatarUrl: text('avatar_url'),
  phone: text('phone'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 2. admins
export const admins = pgTable('admins', {
  id: serial('id').primaryKey(),
  profileId: integer('profile_id').references(() => profiles.id, { onDelete: 'set null' }),
  uid: text('uid').unique(),
  email: text('email').notNull().unique(),
  fullName: text('full_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('EDITOR'), // SUPER_ADMIN | ADMIN | EDITOR
  permissions: jsonb('permissions').$type<string[]>().notNull().default([]),
  isActive: boolean('is_active').notNull().default(true),
  resetToken: text('reset_token'),
  resetTokenExpiresAt: timestamp('reset_token_expires_at'),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 3. awards
export const awards = pgTable('awards', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  editionYear: integer('edition_year').notNull(),
  tagline: text('tagline').notNull(),
  description: text('description').notNull(),
  logoUrl: text('logo_url'),
  bannerUrl: text('banner_url'),
  votingStartsAt: timestamp('voting_starts_at').notNull(),
  votingEndsAt: timestamp('voting_ends_at').notNull(),
  isPublished: boolean('is_published').notNull().default(true),
  isActive: boolean('is_active').notNull().default(true),
  resultsPublished: boolean('results_published').notNull().default(false),
  createdBy: integer('created_by').references(() => admins.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 4. categories
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  awardId: integer('award_id')
    .references(() => awards.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description').notNull(),
  imageUrl: text('image_url'),
  displayOrder: integer('display_order').notNull().default(1),
  isActive: boolean('is_active').notNull().default(true),
  votingEnabled: boolean('voting_enabled').notNull().default(true),
  maxVotesPerVoter: integer('max_votes_per_voter').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 5. nominees
export const nominees = pgTable('nominees', {
  id: serial('id').primaryKey(),
  awardId: integer('award_id')
    .references(() => awards.id, { onDelete: 'cascade' })
    .notNull(),
  categoryId: integer('category_id')
    .references(() => categories.id, { onDelete: 'cascade' })
    .notNull(),
  nomineeNumber: text('nominee_number').notNull().unique(),
  fullName: text('full_name').notNull(),
  roleTitle: text('role_title').notNull().default(''),
  organization: text('organization').notNull().default(''),
  photoUrl: text('photo_url'),
  biography: text('biography').notNull(),
  socialLinks: jsonb('social_links')
    .$type<{ website?: string; linkedin?: string; twitter?: string; instagram?: string }>()
    .notNull()
    .default({}),
  nominationStatus: text('nomination_status').notNull().default('APPROVED'), // APPROVED | PENDING | ARCHIVED
  nominatedByEmail: text('nominated_by_email'),
  isActive: boolean('is_active').notNull().default(true),
  isWinner: boolean('is_winner').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 6. voters
export const voters = pgTable('voters', {
  id: serial('id').primaryKey(),
  voterCode: text('voter_code').notNull().unique(),
  email: text('email').unique(),
  phone: text('phone').unique(),
  nationalIdHash: text('national_id_hash').unique(),
  ghanaRegion: text('ghana_region').notNull().default('Greater Accra'),
  fullName: text('full_name'),
  verificationMethod: text('verification_method').notNull().default('EMAIL_OTP'), // EMAIL_OTP | PHONE_OTP
  isVerified: boolean('is_verified').notNull().default(false),
  otpCodeHash: text('otp_code_hash'),
  otpExpiresAt: timestamp('otp_expires_at'),
  otpAttempts: integer('otp_attempts').notNull().default(0),
  ipHash: text('ip_hash'),
  userAgentHash: text('user_agent_hash'),
  flaggedSuspicious: boolean('flagged_suspicious').notNull().default(false),
  suspiciousReason: text('suspicious_reason'),
  registeredAt: timestamp('registered_at').defaultNow().notNull(),
  lastVotedAt: timestamp('last_voted_at'),
});

// 7. votes (Strict single free ballot per voter per category)
export const votes = pgTable(
  'votes',
  {
    id: serial('id').primaryKey(),
    awardId: integer('award_id')
      .references(() => awards.id, { onDelete: 'cascade' })
      .notNull(),
    categoryId: integer('category_id')
      .references(() => categories.id, { onDelete: 'cascade' })
      .notNull(),
    nomineeId: integer('nominee_id')
      .references(() => nominees.id, { onDelete: 'cascade' })
      .notNull(),
    voterId: integer('voter_id')
      .references(() => voters.id, { onDelete: 'cascade' })
      .notNull(),
    receiptCode: text('receipt_code').notNull().unique(),
    verificationMethod: text('verification_method').notNull(),
    ghanaRegion: text('ghana_region').notNull().default('Greater Accra'),
    ipHash: text('ip_hash'),
    castAt: timestamp('cast_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('votes_voter_category_unique').on(table.voterId, table.categoryId)]
);

// 8. sponsors
export const sponsors = pgTable('sponsors', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  tier: text('tier').notNull().default('Gold Patron'),
  logoUrl: text('logo_url'),
  websiteUrl: text('website_url'),
  displayOrder: integer('display_order').notNull().default(1),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 9. announcements
export const announcements = pgTable('announcements', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  category: text('category').notNull().default('Governance'),
  summary: text('summary').notNull(),
  content: text('content').notNull(),
  publishedAt: timestamp('published_at').defaultNow().notNull(),
  isPublished: boolean('is_published').notNull().default(true),
  createdBy: integer('created_by').references(() => admins.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 10. audit_logs
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  adminId: integer('admin_id').references(() => admins.id, { onDelete: 'set null' }),
  adminEmail: text('admin_email').notNull(),
  adminRole: text('admin_role').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 11. system_settings
export const systemSettings = pgTable('system_settings', {
  id: serial('id').primaryKey(),
  siteName: text('site_name').notNull().default('Black Star Excellence Honours'),
  siteTagline: text('site_tagline').notNull().default('Celebrating Ghanaian Achievement Across Arts, Innovation, Leadership & Heritage'),
  siteLogoUrl: text('site_logo_url'),
  faviconUrl: text('favicon_url'),
  siteDescription: text('site_description').notNull(),
  contactEmail: text('contact_email').notNull(),
  contactPhone: text('contact_phone').notNull(),
  contactAddress: text('contact_address').notNull(),
  whatsappNumber: text('whatsapp_number').notNull().default('0591593157'),
  developerName: text('developer_name').notNull().default('Pearlicious Tech Solutions'),
  socialLinks: jsonb('social_links')
    .$type<{ twitter?: string; linkedin?: string; instagram?: string; youtube?: string }>()
    .notNull()
    .default({}),
  primaryColor: text('primary_color').notNull().default('#0B192C'),
  accentColor: text('accent_color').notNull().default('#C59B27'),
  requireOtp: boolean('require_otp').notNull().default(true),
  allowEmailOtp: boolean('allow_email_otp').notNull().default(true),
  allowPhoneOtp: boolean('allow_phone_otp').notNull().default(true),
  requireCaptcha: boolean('require_captcha').notNull().default(true),
  enforceSingleChannelPerVoter: boolean('enforce_single_channel_per_voter').notNull().default(true),
  paidVotingEnabled: boolean('paid_voting_enabled').notNull().default(true),
  votePriceGhs: integer('vote_price_ghs').notNull().default(2),
  smsProvider: text('sms_provider').notNull().default('ARKESEL'),
  ussdShortcode: text('ussd_shortcode').notNull().default('*714*88#'),
  productionMode: boolean('production_mode').notNull().default(false),
  maxVotesPerCategory: integer('max_votes_per_category').notNull().default(1),
  rateLimitPerMinute: integer('rate_limit_per_minute').notNull().default(10),
  resultsPublic: boolean('results_public').notNull().default(true),
  votingPaused: boolean('voting_paused').notNull().default(false),
  maintenanceMode: boolean('maintenance_mode').notNull().default(false),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Supporting production tables
export const contactMessages = pgTable('contact_messages', {
  id: serial('id').primaryKey(),
  fullName: text('full_name').notNull(),
  email: text('email').notNull(),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  status: text('status').notNull().default('UNREAD'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  audience: text('audience').notNull().default('ALL'),
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Persistent Media Storage in PostgreSQL (survives ephemeral container restarts)
export const mediaAssets = pgTable('media_assets', {
  id: serial('id').primaryKey(),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  dataBase64: text('data_base64').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Distributed Rate Limiting Table (shared across Cloud Run instances)
export const rateLimits = pgTable('rate_limits', {
  id: serial('id').primaryKey(),
  bucketKey: text('bucket_key').notNull().unique(),
  windowStart: timestamp('window_start').defaultNow().notNull(),
  hits: integer('hits').notNull().default(1),
});

// Mobile Money (MTN / Telecel / AT) & USSD Verified Vote Transactions
export const momoTransactions = pgTable('momo_transactions', {
  id: serial('id').primaryKey(),
  reference: text('reference').notNull().unique(),
  receiptCode: text('receipt_code').notNull().unique(),
  awardId: integer('award_id')
    .references(() => awards.id, { onDelete: 'cascade' })
    .notNull(),
  categoryId: integer('category_id')
    .references(() => categories.id, { onDelete: 'cascade' })
    .notNull(),
  nomineeId: integer('nominee_id')
    .references(() => nominees.id, { onDelete: 'cascade' })
    .notNull(),
  voterPhone: text('voter_phone').notNull(),
  network: text('network').notNull().default('MTN'), // MTN | TELECEL | AT
  ghanaRegion: text('ghana_region').notNull().default('Greater Accra'),
  amountGhs: integer('amount_ghs').notNull(),
  voteCount: integer('vote_count').notNull(),
  channel: text('channel').notNull().default('WEB_MOMO'), // WEB_MOMO | USSD
  status: text('status').notNull().default('PENDING'), // PENDING | COMPLETED | FAILED
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

// Relations
export const awardsRelations = relations(awards, ({ many }) => ({
  categories: many(categories),
  nominees: many(nominees),
  votes: many(votes),
  momoTransactions: many(momoTransactions),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  award: one(awards, { fields: [categories.awardId], references: [awards.id] }),
  nominees: many(nominees),
  votes: many(votes),
  momoTransactions: many(momoTransactions),
}));

export const nomineesRelations = relations(nominees, ({ one, many }) => ({
  award: one(awards, { fields: [nominees.awardId], references: [awards.id] }),
  category: one(categories, { fields: [nominees.categoryId], references: [categories.id] }),
  votes: many(votes),
  momoTransactions: many(momoTransactions),
}));

export const votersRelations = relations(voters, ({ many }) => ({
  votes: many(votes),
}));

export const votesRelations = relations(votes, ({ one }) => ({
  award: one(awards, { fields: [votes.awardId], references: [awards.id] }),
  category: one(categories, { fields: [votes.categoryId], references: [categories.id] }),
  nominee: one(nominees, { fields: [votes.nomineeId], references: [nominees.id] }),
  voter: one(voters, { fields: [votes.voterId], references: [voters.id] }),
}));
