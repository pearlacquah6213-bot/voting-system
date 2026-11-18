import bcrypt from 'bcryptjs';
import { count } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  admins,
  announcements,
  auditLogs,
  awards,
  categories,
  momoTransactions,
  nominees,
  notifications,
  profiles,
  sponsors,
  systemSettings,
  voters,
  votes,
} from '../db/schema.ts';

let _seedPromise: Promise<void> | null = null;

export async function ensureSeeded(): Promise<void> {
  if (_seedPromise) return _seedPromise;
  _seedPromise = runSeed().catch((err) => {
    _seedPromise = null;
    console.error('Database seed warning:', err);
  });
  return _seedPromise;
}

async function runSeed(): Promise<void> {
  const existingSettings = await db.select({ value: count() }).from(systemSettings);
  if ((existingSettings[0]?.value ?? 0) > 0) {
    return;
  }

  console.log('Seeding Black Star Excellence Honours (Ghana) PostgreSQL database...');

  // 1. System Settings
  await db.insert(systemSettings).values({
    siteName: 'Black Star Excellence Honours',
    siteTagline: 'Celebrating Ghanaian Achievement Across Arts, Innovation, Leadership & Heritage',
    siteLogoUrl: '',
    faviconUrl: '',
    siteDescription:
      'Ghana’s premier independent awards and verified public voting institution honouring visionaries across creative arts, civic architecture, fintech & agritech, and sustainable industry across all 16 regions.',
    contactEmail: 'secretariat@blackstarhonours.gh',
    contactPhone: '+233 30 274 8810',
    contactAddress: 'Independence Avenue, Ridge, Accra, Greater Accra Region, Ghana',
    whatsappNumber: '0591593157',
    developerName: 'Pearlicious Tech Solutions',
    socialLinks: {
      twitter: 'https://x.com/blackstarhonours',
      linkedin: 'https://linkedin.com/company/blackstar-honours-gh',
      instagram: 'https://instagram.com/blackstarhonours.gh',
      youtube: 'https://youtube.com/@blackstarhonoursgh',
    },
    primaryColor: '#0B192C',
    accentColor: '#C59B27',
    requireOtp: true,
    allowEmailOtp: true,
    allowPhoneOtp: true,
    requireCaptcha: true,
    enforceSingleChannelPerVoter: true,
    paidVotingEnabled: true,
    votePriceGhs: 2,
    smsProvider: 'ARKESEL',
    ussdShortcode: '*714*88#',
    productionMode: false,
    maxVotesPerCategory: 1,
    rateLimitPerMinute: 12,
    resultsPublic: true,
    votingPaused: false,
    maintenanceMode: false,
  });

  // 2. Profiles & Admins
  const defaultPasswordHash = await bcrypt.hash('AwardsAdmin!2026', 10);

  const insertedProfiles = await db
    .insert(profiles)
    .values([
      {
        uid: 'seed-superadmin-owner',
        email: 'pearlacquah6213@gmail.com',
        fullName: 'Pearl Acquah',
        avatarUrl: '/src/assets/images/nominee_abena_mensah_1795036944590.jpg',
      },
      {
        uid: 'seed-superadmin-gh',
        email: 'superadmin@blackstarhonours.gh',
        fullName: 'Nana Kwame Boateng',
        avatarUrl: '/src/assets/images/nominee_david_mensah_1795035990350.jpg',
      },
      {
        uid: 'seed-admin-gh',
        email: 'admin@blackstarhonours.gh',
        fullName: 'Efua Mansa Darko',
        avatarUrl: '/src/assets/images/nominee_amara_osei_1795035988497.jpg',
      },
      {
        uid: 'seed-editor-gh',
        email: 'editor@blackstarhonours.gh',
        fullName: 'Kojo Annan-Prah',
        avatarUrl: '/src/assets/images/nominee_elena_rostova_1795035986530.jpg',
      },
    ])
    .onConflictDoNothing()
    .returning();

  const existingAdminCount = await db.select({ value: count() }).from(admins);
  let leadAdminId: number | null = null;

  if ((existingAdminCount[0]?.value ?? 0) === 0) {
    const insertedAdmins = await db
      .insert(admins)
      .values([
        {
          profileId: insertedProfiles[0]?.id ?? null,
          uid: 'seed-superadmin-owner',
          email: 'pearlacquah6213@gmail.com',
          fullName: 'Pearl Acquah',
          passwordHash: defaultPasswordHash,
          role: 'SUPER_ADMIN',
          permissions: ['*'],
          isActive: true,
        },
        {
          profileId: insertedProfiles[1]?.id ?? null,
          uid: 'seed-superadmin-gh',
          email: 'superadmin@blackstarhonours.gh',
          fullName: 'Nana Kwame Boateng',
          passwordHash: defaultPasswordHash,
          role: 'SUPER_ADMIN',
          permissions: ['*'],
          isActive: true,
        },
        {
          profileId: insertedProfiles[2]?.id ?? null,
          uid: 'seed-admin-gh',
          email: 'admin@blackstarhonours.gh',
          fullName: 'Efua Mansa Darko',
          passwordHash: defaultPasswordHash,
          role: 'ADMIN',
          permissions: [
            'awards',
            'categories',
            'nominees',
            'voting',
            'results',
            'voters',
            'sponsors',
            'announcements',
            'reports',
            'audit_logs',
          ],
          isActive: true,
        },
        {
          profileId: insertedProfiles[3]?.id ?? null,
          uid: 'seed-editor-gh',
          email: 'editor@blackstarhonours.gh',
          fullName: 'Kojo Annan-Prah',
          passwordHash: defaultPasswordHash,
          role: 'EDITOR',
          permissions: ['nominees', 'categories', 'announcements'],
          isActive: true,
        },
      ])
      .returning();
    leadAdminId = insertedAdmins[1]?.id ?? insertedAdmins[0]?.id ?? null;
  } else {
    const firstAdmins = await db.select().from(admins).limit(1);
    leadAdminId = firstAdmins[0]?.id ?? null;
  }

  // 3. Awards
  const now = new Date();
  const startsAt = new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000);
  const endsAt = new Date(now.getTime() + 26 * 24 * 60 * 60 * 1000);
  const pastStart = new Date(now.getTime() - 395 * 24 * 60 * 60 * 1000);
  const pastEnd = new Date(now.getTime() - 335 * 24 * 60 * 60 * 1000);

  const insertedAwards = await db
    .insert(awards)
    .values([
      {
        title: 'Black Star Excellence Honours 2026',
        slug: 'black-star-2026',
        editionYear: 2026,
        tagline: 'Honouring Ghanaian Creators, Innovators & Civic Builders',
        description:
          'Convening voters across all 16 regions of Ghana and the global diaspora to celebrate transformative achievements in Ghanaian music & film, civic architecture, fintech & agritech, and sustainable Kente & cocoa craftsmanship ahead of the Accra Gala.',
        logoUrl: '',
        bannerUrl: '/src/assets/images/hero_ghana_gala_1795036943453.jpg',
        votingStartsAt: startsAt,
        votingEndsAt: endsAt,
        isPublished: true,
        isActive: true,
        resultsPublished: true,
        createdBy: leadAdminId,
      },
      {
        title: 'Black Star Heritage Honours 2025',
        slug: 'black-star-2025',
        editionYear: 2025,
        tagline: '2025 Accra Laureate Archive',
        description:
          'Concluded 2025 national honours edition preserved for public reference and laureate citation records.',
        logoUrl: '',
        bannerUrl: '/src/assets/images/cat_ghana_arts_1795036944175.jpg',
        votingStartsAt: pastStart,
        votingEndsAt: pastEnd,
        isPublished: true,
        isActive: false,
        resultsPublished: true,
        createdBy: leadAdminId,
      },
    ])
    .returning();

  const activeAwardId = insertedAwards[0].id;
  const pastAwardId = insertedAwards[1].id;

  // 4. Categories
  const insertedCategories = await db
    .insert(categories)
    .values([
      {
        awardId: activeAwardId,
        name: 'Ghanaian Music, Film & Cultural Arts',
        slug: 'ghana-cultural-arts',
        description:
          'Honouring highlife and Afrobeats composers, independent Ghanaian filmmakers, and cultural archivists elevating Ghana on global stages.',
        imageUrl: '/src/assets/images/cat_ghana_arts_1795036944175.jpg',
        displayOrder: 1,
        isActive: true,
        votingEnabled: true,
        maxVotesPerVoter: 1,
      },
      {
        awardId: activeAwardId,
        name: 'Fintech, Agritech & Digital Innovation',
        slug: 'ghana-digital-innovation',
        description:
          'Celebrating Ghanaian software engineers, mobile-money infrastructure builders, and agritech pioneers empowering farmers from Tamale to Takoradi.',
        imageUrl: '/src/assets/images/cat_technology_1795035985841.jpg',
        displayOrder: 2,
        isActive: true,
        votingEnabled: true,
        maxVotesPerVoter: 1,
      },
      {
        awardId: activeAwardId,
        name: 'Civic Architecture & Urban Heritage',
        slug: 'ghana-civic-architecture',
        description:
          'Public spaces, climate-resilient libraries, and coastal heritage restorations shaping Accra, Kumasi, and Cape Coast.',
        imageUrl: '/src/assets/images/cat_architecture_1795035985198.jpg',
        displayOrder: 3,
        isActive: true,
        votingEnabled: true,
        maxVotesPerVoter: 1,
      },
      {
        awardId: activeAwardId,
        name: 'Sustainable Craft & Clean Industry',
        slug: 'ghana-sustainable-industry',
        description:
          'Ethical Bonwire Kente weaving guilds, value-added cocoa processors, and clean-energy industrial leaders driving Ghanaian manufacturing.',
        imageUrl: '/src/assets/images/cat_sustainability_1795035985952.jpg',
        displayOrder: 4,
        isActive: true,
        votingEnabled: true,
        maxVotesPerVoter: 1,
      },
      {
        awardId: pastAwardId,
        name: '2025 Lifetime Black Star Laureate',
        slug: 'lifetime-laureate-2025',
        description: 'Concluded archival distinction from the 2025 Accra Gala Night.',
        imageUrl: '/src/assets/images/cat_ghana_arts_1795036944175.jpg',
        displayOrder: 1,
        isActive: true,
        votingEnabled: false,
        maxVotesPerVoter: 1,
      },
    ])
    .returning();

  // 5. Nominees (includes 1 PENDING public nomination so Admins can test the approval queue!)
  const insertedNominees = await db
    .insert(nominees)
    .values([
      {
        awardId: activeAwardId,
        categoryId: insertedCategories[0].id,
        nomineeNumber: 'BSX-101',
        fullName: 'Abena Serwaa Mensah',
        roleTitle: 'Music Producer & Sonic Archivist',
        organization: 'Kumasi Sound Heritage',
        photoUrl: '/src/assets/images/nominee_abena_mensah_1795036944590.jpg',
        biography:
          'Abena Serwaa Mensah has produced landmark contemporary highlife and palm-wine acoustic recordings in Kumasi and Accra, digitising over 1,400 classic Ghanaian vinyl sessions while mentoring young female sound engineers.',
        socialLinks: {
          website: 'https://kumasisound.example.gh',
          instagram: 'https://instagram.com/abenasound.gh',
          twitter: 'https://x.com/abenasound_gh',
        },
        nominationStatus: 'APPROVED',
        isActive: true,
        isWinner: true,
      },
      {
        awardId: activeAwardId,
        categoryId: insertedCategories[0].id,
        nomineeNumber: 'BSX-102',
        fullName: 'Amara Osei',
        roleTitle: 'Creative & Heritage Exhibition Director',
        organization: 'Osu Atelier & Gallery',
        photoUrl: '/src/assets/images/nominee_amara_osei_1795035988497.jpg',
        biography:
          'Amara Osei curates contemporary Ghanaian industrial craft, brass-casting, and textile design exhibitions in Osu, Accra, connecting Bonwire master weavers with international museum collections.',
        socialLinks: {
          website: 'https://osuatelier.example.gh',
          instagram: 'https://instagram.com/amaraosei.gh',
          linkedin: 'https://linkedin.com/in/amara-osei-gh',
        },
        nominationStatus: 'APPROVED',
        isActive: true,
        isWinner: false,
      },
      {
        awardId: activeAwardId,
        categoryId: insertedCategories[1].id,
        nomineeNumber: 'BSX-201',
        fullName: 'David Mensah',
        roleTitle: 'Principal Civic Technologist',
        organization: 'Accra Digital Commons',
        photoUrl: '/src/assets/images/nominee_david_mensah_1795035990350.jpg',
        biography:
          'David Mensah built open-source flood early-warning sensor meshes and municipal payment portals across Greater Accra and Sekondi-Takoradi, helping over 90,000 small traders access instant settlement tools.',
        socialLinks: {
          website: 'https://accracommons.example.gh',
          linkedin: 'https://linkedin.com/in/david-mensah-gh',
          twitter: 'https://x.com/dmensah_gh',
        },
        nominationStatus: 'APPROVED',
        isActive: true,
        isWinner: true,
      },
      {
        awardId: activeAwardId,
        categoryId: insertedCategories[1].id,
        nomineeNumber: 'BSX-202',
        fullName: 'Yaw Boadu-Ayeboafo',
        roleTitle: 'Agritech Systems Founder',
        organization: 'Northern Yield Labs, Tamale',
        photoUrl: '/src/assets/images/nominee_marcus_vance_1795035987245.jpg',
        biography:
          'Yaw Boadu-Ayeboafo engineered solar-powered soil-moisture telemetry and Twi/Dagbani voice market advisories supporting 42,000 smallholder farmers across Northern and Savannah Regions.',
        socialLinks: {
          website: 'https://northernyield.example.gh',
          linkedin: 'https://linkedin.com/in/yaw-boadu-gh',
        },
        nominationStatus: 'APPROVED',
        isActive: true,
        isWinner: false,
      },
      {
        awardId: activeAwardId,
        categoryId: insertedCategories[2].id,
        nomineeNumber: 'BSX-301',
        fullName: 'Dr. Nana Ama Osei-Bonsu',
        roleTitle: 'Principal Civic Architect',
        organization: 'Gold Coast Urban Studio',
        photoUrl: '/src/assets/images/nominee_elena_rostova_1795035986530.jpg',
        biography:
          'Dr. Nana Ama Osei-Bonsu designed the passively cooled Jamestown Coastal Library and solar-shaded market canopies in Makola, blending Ghanaian laterite earth masonry with low-carbon structural timber.',
        socialLinks: {
          website: 'https://goldcoasturban.example.gh',
          linkedin: 'https://linkedin.com/in/nana-ama-osei-bonsu',
        },
        nominationStatus: 'APPROVED',
        isActive: true,
        isWinner: true,
      },
      {
        awardId: activeAwardId,
        categoryId: insertedCategories[3].id,
        nomineeNumber: 'BSX-401',
        fullName: 'Dr. Kwesi Tetteh-Kwakye',
        roleTitle: 'Director of Clean Industry & Cocoa Value',
        organization: 'Tema Circular Energy',
        photoUrl: '/src/assets/images/nominee_kenji_takahashi_1795035988682.jpg',
        biography:
          'Dr. Kwesi Tetteh-Kwakye leads biomass-to-clean-steam conversions using cocoa pod husks in Tema and Suhum, cutting industrial fossil fuel demand by 61% while generating rural cooperative income.',
        socialLinks: {
          website: 'https://temacircular.example.gh',
          linkedin: 'https://linkedin.com/in/kwesi-kwakye',
        },
        nominationStatus: 'APPROVED',
        isActive: true,
        isWinner: true,
      },
    ])
    .returning();

  // 6. Voters & Votes across Ghanaian Regions
  const voterRows = await db
    .insert(voters)
    .values([
      { voterCode: 'VTR-23301', email: 'k.mensah@ug.edu.gh', ghanaRegion: 'Greater Accra', verificationMethod: 'EMAIL_OTP', isVerified: true, lastVotedAt: new Date(now.getTime() - 5 * 86400000) },
      { voterCode: 'VTR-23302', email: 'ama.darko@knust.edu.gh', ghanaRegion: 'Ashanti', verificationMethod: 'EMAIL_OTP', isVerified: true, lastVotedAt: new Date(now.getTime() - 4 * 86400000) },
      { voterCode: 'VTR-23303', phone: '+233244190812', ghanaRegion: 'Western', verificationMethod: 'PHONE_OTP', isVerified: true, lastVotedAt: new Date(now.getTime() - 3 * 86400000) },
      { voterCode: 'VTR-23304', email: 'yaw.frimpong@accramail.gh', ghanaRegion: 'Northern', verificationMethod: 'EMAIL_OTP', isVerified: true, lastVotedAt: new Date(now.getTime() - 2 * 86400000) },
      { voterCode: 'VTR-23305', phone: '+233503881920', ghanaRegion: 'Central', verificationMethod: 'PHONE_OTP', isVerified: true, lastVotedAt: new Date(now.getTime() - 1 * 86400000) },
      { voterCode: 'VTR-23306', email: 'efua.quaye@ucc.edu.gh', ghanaRegion: 'Volta', verificationMethod: 'EMAIL_OTP', isVerified: true, lastVotedAt: new Date(now.getTime() - 18 * 3600000) },
      { voterCode: 'VTR-23307', phone: '+233208441009', ghanaRegion: 'Diaspora', verificationMethod: 'PHONE_OTP', isVerified: true, lastVotedAt: new Date(now.getTime() - 6 * 3600000) },
      { voterCode: 'VTR-23308', email: 'kofi.tetteh@tema.gh', ghanaRegion: 'Eastern', verificationMethod: 'EMAIL_OTP', isVerified: true, flaggedSuspicious: true, suspiciousReason: 'Multiple rapid OTP retries from shared proxy', lastVotedAt: new Date(now.getTime() - 2 * 3600000) },
    ])
    .returning();

  const votePairs: Array<{ voterIdx: number; catIdx: number; nomIdx: number; daysAgo: number }> = [
    { voterIdx: 0, catIdx: 0, nomIdx: 0, daysAgo: 5 },
    { voterIdx: 1, catIdx: 0, nomIdx: 0, daysAgo: 4 },
    { voterIdx: 2, catIdx: 0, nomIdx: 1, daysAgo: 3 },
    { voterIdx: 3, catIdx: 0, nomIdx: 0, daysAgo: 2 },
    { voterIdx: 4, catIdx: 0, nomIdx: 0, daysAgo: 1 },
    { voterIdx: 5, catIdx: 0, nomIdx: 1, daysAgo: 0.7 },
    { voterIdx: 6, catIdx: 0, nomIdx: 0, daysAgo: 0.25 },
    { voterIdx: 0, catIdx: 1, nomIdx: 2, daysAgo: 5 },
    { voterIdx: 1, catIdx: 1, nomIdx: 2, daysAgo: 4 },
    { voterIdx: 2, catIdx: 1, nomIdx: 3, daysAgo: 3 },
    { voterIdx: 3, catIdx: 1, nomIdx: 2, daysAgo: 2 },
    { voterIdx: 4, catIdx: 1, nomIdx: 3, daysAgo: 1 },
    { voterIdx: 6, catIdx: 1, nomIdx: 2, daysAgo: 0.25 },
    { voterIdx: 0, catIdx: 2, nomIdx: 4, daysAgo: 5 },
    { voterIdx: 2, catIdx: 2, nomIdx: 4, daysAgo: 3 },
    { voterIdx: 4, catIdx: 2, nomIdx: 4, daysAgo: 1 },
    { voterIdx: 5, catIdx: 2, nomIdx: 4, daysAgo: 0.7 },
    { voterIdx: 1, catIdx: 3, nomIdx: 5, daysAgo: 4 },
    { voterIdx: 3, catIdx: 3, nomIdx: 5, daysAgo: 2 },
    { voterIdx: 7, catIdx: 3, nomIdx: 5, daysAgo: 0.1 },
  ];

  await db.insert(votes).values(
    votePairs.map((vp, idx) => ({
      awardId: activeAwardId,
      categoryId: insertedCategories[vp.catIdx].id,
      nomineeId: insertedNominees[vp.nomIdx].id,
      voterId: voterRows[vp.voterIdx].id,
      receiptCode: `GH-2026-${String(2001 + idx)}`,
      verificationMethod: voterRows[vp.voterIdx].verificationMethod,
      ghanaRegion: voterRows[vp.voterIdx].ghanaRegion,
      castAt: new Date(now.getTime() - vp.daysAgo * 86400000),
    }))
  );

  // Seed sample completed Mobile Money & USSD transactions
  await db.insert(momoTransactions).values([
    {
      reference: 'MOMO-GH-9901',
      receiptCode: 'GH-2026-M901',
      awardId: activeAwardId,
      categoryId: insertedCategories[0].id,
      nomineeId: insertedNominees[0].id,
      voterPhone: '+233244190812',
      network: 'MTN',
      ghanaRegion: 'Ashanti',
      amountGhs: 10,
      voteCount: 5,
      channel: 'WEB_MOMO',
      status: 'COMPLETED',
      completedAt: new Date(now.getTime() - 2 * 86400000),
    },
    {
      reference: 'USSD-GH-9902',
      receiptCode: 'GH-2026-U902',
      awardId: activeAwardId,
      categoryId: insertedCategories[1].id,
      nomineeId: insertedNominees[2].id,
      voterPhone: '+233503881920',
      network: 'TELECEL',
      ghanaRegion: 'Greater Accra',
      amountGhs: 6,
      voteCount: 3,
      channel: 'USSD',
      status: 'COMPLETED',
      completedAt: new Date(now.getTime() - 1 * 86400000),
    },
  ]);

  // 7. Sponsors
  await db.insert(sponsors).values([
    { name: 'Gold Coast Civic Bank', tier: 'Title Partner', websiteUrl: 'https://example.gh/goldcoastbank', displayOrder: 1, isActive: true },
    { name: 'Accra Heritage Foundation', tier: 'Gold Patron', websiteUrl: 'https://example.gh/accraheritage', displayOrder: 2, isActive: true },
    { name: 'Ashanti Innovation Fund', tier: 'Gold Patron', websiteUrl: 'https://example.gh/ashantiinnovation', displayOrder: 3, isActive: true },
    { name: 'Volta Clean Energy Trust', tier: 'Supporting Partner', websiteUrl: 'https://example.gh/voltaclean', displayOrder: 4, isActive: true },
  ]);

  // 8. Announcements
  await db.insert(announcements).values([
    {
      title: '2026 Public Voting Open Across All 16 Regions of Ghana',
      slug: 'ghana-public-voting-open-2026',
      category: 'Schedule',
      summary:
        'Ghanaians at home and in the diaspora can now cast OTP-verified ballots or vote via *714*88# USSD & MoMo ahead of the Accra Gala.',
      content:
        'The Black Star Governance Board confirms that verified public voting is open nationwide and across the Ghanaian diaspora. Voters may verify via Ghanaian mobile SMS (+233) or email OTP, use Mobile Money vote packs, or dial *714*88# on any mobile phone.',
      publishedAt: new Date(now.getTime() - 4 * 86400000),
      isPublished: true,
      createdBy: leadAdminId,
    },
    {
      title: 'Accra International Conference Centre Gala Ceremony Confirmed',
      slug: 'aicc-gala-ceremony-2026',
      category: 'Nominees',
      summary:
        'Finalists from Kumasi, Tamale, Takoradi, Cape Coast, and Accra will gather at AICC for the presentation of trophies.',
      content:
        'The annual Black Star Excellence Honours Gala Night will convene at the Accra International Conference Centre, featuring live highlife orchestral performances and formal jury citation readings.',
      publishedAt: new Date(now.getTime() - 2 * 86400000),
      isPublished: true,
      createdBy: leadAdminId,
    },
    {
      title: 'Independent Ballot Audit & Receipt Verification Now Live',
      slug: 'ghana-ballot-audit-protocol-2026',
      category: 'Governance',
      summary:
        'Voters can now verify their GH-2026 receipt codes online while preserving complete ballot secrecy.',
      content:
        'Every submitted vote and completed MoMo transaction is assigned a unique GH-2026 audit receipt that can be verified instantaneously on the public Verify Receipt page without exposing voter identity or candidate selection.',
      publishedAt: new Date(now.getTime() - 1 * 86400000),
      isPublished: true,
      createdBy: leadAdminId,
    },
  ]);

  // 9. Audit Logs & Notifications
  await db.insert(auditLogs).values([
    {
      adminId: leadAdminId,
      adminEmail: 'superadmin@blackstarhonours.gh',
      adminRole: 'SUPER_ADMIN',
      action: 'PUBLISH_AWARD',
      entityType: 'award',
      entityId: String(activeAwardId),
      details: { title: 'Black Star Excellence Honours 2026', region: 'Ghana' },
    },
    {
      adminId: leadAdminId,
      adminEmail: 'superadmin@blackstarhonours.gh',
      adminRole: 'SUPER_ADMIN',
      action: 'CONFIGURE_VOTING_RULES',
      entityType: 'system_settings',
      entityId: '1',
      details: { requireOtp: true, paidVotingEnabled: true, ussdShortcode: '*714*88#' },
    },
  ]);

  await db.insert(notifications).values([
    {
      audience: 'ALL',
      type: 'VOTING_OPEN',
      title: '2026 Ghana Public Voting Is Open',
      message: 'Verify via email/+233 SMS OTP, Mobile Money, or dial *714*88# USSD ahead of the Accra Gala.',
    },
    {
      audience: 'ALL',
      type: 'ANNOUNCEMENT',
      title: 'Public Nominations & Receipt Verification Active',
      message: 'Submit public nominee recommendations or verify your GH-2026 ballot receipt online.',
    },
  ]);

  console.log('Ghanaian awards seed complete.');
}
