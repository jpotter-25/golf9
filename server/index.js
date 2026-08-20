// index.js
// Purpose: Authoritative Nine Below API + Socket.IO server for auth, rooms, and online game state.

import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import cors from 'cors';
import nodemailer from 'nodemailer';
import { OAuth2Client } from 'google-auth-library';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { createPostgresStore } from './postgresStore.js';
import {
  normalizeCredentialVerifier,
  persistentCredentialVerifier,
} from './securityTokens.js';
import {
  cardValue,
  continueAfterRoundSummary,
  createGameState,
  discardDrawn,
  drawFromDeck,
  flipForPeek,
  pickTarget,
  publicGameState,
  revealGridCardForDecision,
  replaceGridCard,
  resolvePendingGridDecision,
  resolvePendingGridDecisionWithoutHeld,
  resolveExpiredTimers,
  sanitizePlayerIdentity,
  sharedPlayerCosmetics,
  takeDiscard,
  PEEK_DURATION,
  TURN_DURATION,
} from '../shared/rules.js';
import { aiPlayTurn, chooseAiMove } from '../shared/soloAi.js';
import {
  applyAfkCoinPenalty,
  autoplayCueFromMove,
  autoplayTargetCueMs,
  normalizeAfkConfig,
  normalizeAfkPlayerState,
  recordAutomatedAfkWindow,
  recordHumanAfkAction,
  recordMissedAfkWindow,
} from './afk.js';
import {
  applyMatchProgression,
  claimChallengeReward,
  equipCosmetic,
  normalizeUserProgression,
  publicCosmeticCatalog,
  publicUserProfile,
  purchaseCosmetic,
  recordOnlineMatchForfeit,
  registerSocialMessage,
  xpNeededForLevel,
} from './progression.js';
import {
  archiveDraftCatalogItem,
  draftCatalog,
  duplicateDraftCatalogItem,
  liveCatalog,
  normalizeCatalogStore,
  catalogAssetRequirements,
  publishCatalog,
  rollbackCatalog,
  saveDraftCatalogItem,
  seedCatalogStore,
  uploadCatalogAsset,
} from './catalog.js';
import {
  BASE_MMR,
  applyRankedMatchResult,
  claimSeasonRewards,
  eligibleRankedEntriesForSeed,
  leagueForMmr,
  matchmakingRangeFor,
  normalizeCompetitiveState,
  normalizeRankedPlayerCount,
  normalizeRankedSeason,
  publicCompetitiveByPlayers,
  publicCompetitiveState,
  rankedDisplayEmblemChoices,
  resolveDisplayRankEmblem,
  selectRankedMatchEntries,
  setDisplayRankEmblem,
} from './ranked.js';
import {
  activateCompetitiveSeason,
  draftCompetitiveConfig,
  endCompetitiveSeason,
  liveCompetitiveConfig,
  normalizeCompetitiveConfigStore,
  publicCompetitiveAdminConfig,
  publishCompetitiveConfig,
  rollbackCompetitiveConfig,
  saveDraftCompetitiveConfig,
  simulateCompetitiveRating,
  upsertCompetitiveSeason,
  validateCompetitiveConfig,
} from './competitive.js';
import {
  calculatePayouts,
  claimDailyTableBonus,
  normalizeEconomyConfigStore,
  normalizeBuyIn,
  publicDailyBonus,
  publicEconomyCatalog,
  rankedBuyInForMmr,
} from './economy.js';
import {
  applyClubMatchContribution,
  canManageMember,
  canManageRequests,
  canPostAnnouncement,
  canUpdateClub,
  clearClubTreasuryGoal,
  claimClubReward,
  CLUB_ROLES,
  createClubRecord,
  donateToClubTreasury,
  findClubMember,
  normalizeClubBranding,
  normalizeClubRecord,
  normalizeClubTag,
  publicClubProfile as buildPublicClubProfile,
  publicClubSummary as buildPublicClubSummary,
  purchaseClubPrestige,
  setClubTreasuryGoal,
  syncClubRewards,
} from './clubs.js';
import { buildClubStandings, CLUB_STANDING_PERIODS } from './clubStandings.js';
import {
  devTestAccountForDisplayName,
  ensureDevTestAccounts,
  shouldSeedDevTestAccounts,
} from './testAccounts.js';
import {
  activeBansFor,
  adminAccounts,
  adminCosmeticCatalogFor,
  adminEconomySummary,
  adminInvites,
  adminMetrics,
  adminRoleOptions,
  adminTickets,
  adminUserDetail,
  adminUserList,
  banErrorFor,
  cleanAdminReason,
  clearAdminCookie,
  completeAdminPasswordRecovery,
  confirmAdminMfaEnrollment,
  createAdminAccount,
  consumeSignupInvite,
  createInviteCode,
  createPublicSupportTicket,
  createSupportTicket,
  disableInviteCode,
  ensureBootstrapAdmin,
  adminHasPermission,
  loginAdmin,
  normalizeAdminStore,
  normalizeUserAdminFields,
  publicAdmin,
  publicSupportTicket,
  isUserArchived,
  requireAdmin,
  requestAdminPasswordRecovery,
  resetAdminPassword,
  seedDevelopmentAdmin,
  setAdminCookie,
  signupInvitesRequired,
  startAdminMfaEnrollment,
  trackUserDevice,
  updateAdminAccount,
  updateSupportTicket,
  addSupportNote,
  addRequesterSupportReply,
  validateSignupInvite,
  verifyAdminMfa,
  writeAudit,
} from './admin.js';
import {
  adminMailLog,
  claimMailForUser,
  cleanFeedbackPayload,
  createSystemMail,
  deleteMailForUser,
  mailEntriesForUser,
  mailSummaryForUser,
  markMailRead,
  normalizeMailEntries,
} from './mail.js';
import {
  availabilityAdminView,
  cancelAvailabilitySchedule,
  featureDefinition,
  normalizeAvailabilityStore,
  processAvailabilitySchedules,
  publicAvailability,
  publishAvailabilityChange,
  resolveFeatureAvailability,
  restoreAvailabilityRevision,
  scheduleAvailabilityChange,
  unavailablePayload,
  updateAvailabilityTesters,
} from './availability.js';
import {
  cancelReleasePolicySchedule,
  normalizeReleasePolicyStore,
  processReleasePolicySchedules,
  publishReleasePolicyChange,
  releasePolicyAdminView,
  resolveReleasePolicy,
  restoreReleasePolicyRevision,
  scheduleReleasePolicyChange,
  updateRequiredPayload,
} from './releasePolicy.js';
import {
  normalizeForfeitConfig,
  normalizeForfeitDiscipline,
  placementsWithMatchPenalties,
  publicForfeitStatus,
  recordForfeitSettlement,
  resetForfeitDiscipline,
  setRankedForfeitRestriction,
} from './forfeit.js';
import {
  adminEarlyAccessCampaigns,
  adminEarlyAccessSignups,
  applyEarlyAccessRetention,
  cancelEarlyAccessCampaign,
  claimEarlyAccessDelivery,
  completeEarlyAccessDelivery,
  completeEarlyAccessOnboarding,
  confirmEarlyAccessSignup,
  createEarlyAccessCampaign,
  decryptEarlyAccessContact,
  earlyAccessConfirmationEmail,
  earlyAccessCsv,
  earlyAccessPreferences,
  earlyAccessSecurityStatus,
  earlyAccessSummary,
  encryptEarlyAccessContact,
  eraseEarlyAccessSignup,
  failEarlyAccessDelivery,
  markEarlyAccessActivated,
  normalizeEarlyAccessStore,
  previewEarlyAccessCampaign,
  previewEarlyAccessCampaignEmail,
  publicEarlyAccessConfig,
  redactEarlyAccessError,
  renderEarlyAccessCampaignEmail,
  retryEarlyAccessCampaignFailures,
  scheduleEarlyAccessCampaign,
  submitEarlyAccessSignup,
  unsubscribeEarlyAccess,
  updateEarlyAccessCampaign,
  updateEarlyAccessConfig,
  updateEarlyAccessSignup,
  validateEarlyAccessFeedback,
} from './earlyAccess.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR = path.join(__dirname, 'data');
const DATA_DIR = process.env.DATA_DIR || DEFAULT_DATA_DIR;
const DATA_FILE = path.join(DATA_DIR, 'auth-store.json');
const ADMIN_PUBLIC_DIR = path.join(__dirname, 'admin-public');
const PRODUCT_PUBLIC_DIR = path.join(__dirname, 'product-public');
const ASSET_UPLOAD_DIR = path.join(DATA_DIR, 'uploads', 'cosmetics');
const RAW_PUBLIC_ENV = (process.env.APP_ENV || process.env.EXPO_PUBLIC_APP_ENV || process.env.NODE_ENV || '').toLowerCase();
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || RAW_PUBLIC_ENV === 'production';
const DATABASE_URL = process.env.DATABASE_URL || '';
const PUBLIC_API_URL = normalizePublicUrl(process.env.PUBLIC_API_URL || process.env.EXPO_PUBLIC_PROD_SERVER_URL || 'https://ninebelow.potterwell.com');
const ADMIN_PUBLIC_URL = normalizeAdminPublicUrl(process.env.ADMIN_PUBLIC_URL, PUBLIC_API_URL);
const PUBLIC_ENV = (process.env.APP_ENV || process.env.EXPO_PUBLIC_APP_ENV || (IS_PRODUCTION ? 'production' : 'development')).toLowerCase();
const ALLOW_UNSAFE_JSON_IN_PRODUCTION = process.env.ALLOW_JSON_STORE_IN_PRODUCTION === '1' || process.env.ALLOW_JSON_FALLBACK_ON_DB_ERROR === '1';
const GOOGLE_CLIENT_IDS = (process.env.GOOGLE_CLIENT_IDS || process.env.GOOGLE_CLIENT_ID || '')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);
const FACEBOOK_APP_ID = String(process.env.FACEBOOK_APP_ID || '').trim();
const FACEBOOK_APP_SECRET = String(process.env.FACEBOOK_APP_SECRET || '').trim();
const SOCIAL_AUTH_TEST_MODE = process.env.SOCIAL_AUTH_TEST_MODE === '1';
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_ACCESS_TOKEN = String(process.env.EXPO_ACCESS_TOKEN || '').trim();
const PUSH_TEST_MODE = process.env.PUSH_TEST_MODE === '1';
const PUSH_DAILY_SCAN_MS = Math.max(60_000, Number(process.env.PUSH_DAILY_SCAN_MS || 60_000));
const pushTestOutbox = [];
function positiveTimeout(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.max(1_000, parsed) : fallback;
}
const ADMIN_EMAIL_TEST_MODE = process.env.ADMIN_EMAIL_TEST_MODE === '1';
const ADMIN_SMTP_HOST = String(process.env.ADMIN_SMTP_HOST || '').trim();
const ADMIN_SMTP_PORT = Number(process.env.ADMIN_SMTP_PORT || 587);
const ADMIN_SMTP_USER = String(process.env.ADMIN_SMTP_USER || '').trim();
const ADMIN_SMTP_PASS = String(process.env.ADMIN_SMTP_PASS || '').trim();
const ADMIN_SMTP_FROM = String(process.env.ADMIN_SMTP_FROM || process.env.ADMIN_BOOTSTRAP_EMAIL || '').trim();
const ADMIN_SMTP_SECURE = ['1', 'true', 'yes'].includes(String(process.env.ADMIN_SMTP_SECURE || '').trim().toLowerCase());
const ADMIN_SMTP_CONNECTION_TIMEOUT_MS = positiveTimeout(process.env.ADMIN_SMTP_CONNECTION_TIMEOUT_MS, 10_000);
const ADMIN_SMTP_GREETING_TIMEOUT_MS = positiveTimeout(process.env.ADMIN_SMTP_GREETING_TIMEOUT_MS, 10_000);
const ADMIN_SMTP_SOCKET_TIMEOUT_MS = positiveTimeout(process.env.ADMIN_SMTP_SOCKET_TIMEOUT_MS, 20_000);
const SUPPORT_INBOX_EMAIL = String(process.env.SUPPORT_INBOX_EMAIL || 'app-developer@potterwell.com').trim();
const EARLY_ACCESS_CAMPAIGN_EMAIL_ENABLED = process.env.EARLY_ACCESS_CAMPAIGN_EMAIL_ENABLED === '1';
const EARLY_ACCESS_POSTAL_ADDRESS = String(process.env.EARLY_ACCESS_POSTAL_ADDRESS || '').trim();
const EARLY_ACCESS_REPLY_TO = String(process.env.EARLY_ACCESS_REPLY_TO || SUPPORT_INBOX_EMAIL).trim();
const EARLY_ACCESS_EMAILS_PER_MINUTE = Math.max(1, Math.min(600, Number(process.env.EARLY_ACCESS_EMAILS_PER_MINUTE) || 60));
const adminEmailTestOutbox = [];
let adminSmtpTransport = null;
const ACCOUNT_DELETION_CODE_TTL_MS = 1000 * 60 * 15;
const ACCOUNT_DELETION_REQUEST_TTL_MS = 1000 * 60 * 60 * 24;
const ACCOUNT_DELETION_MAX_ATTEMPTS = 5;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const ROOM_TTL_MS = 1000 * 60 * 60 * 2;
const PORT = String(process.env.PORT || 3001);
const EXTRA_LISTEN_PORTS = [...new Set(
  (process.env.EXTRA_LISTEN_PORTS || (IS_PRODUCTION ? '3001' : ''))
    .split(',')
    .map(port => port.trim())
    .filter(port => port && port !== PORT)
)];
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGINS || '*')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const PUBLIC_WEB_ORIGINS = new Set([
  'https://potterwell.com',
  'https://www.potterwell.com',
  'https://ninebelow.potterwell.com',
  ...CLIENT_ORIGINS.filter(origin => origin !== '*'),
]);
const MAX_PROCESSED_ACTION_IDS = 500;
const ROOM_COUNTDOWN_MS = Number(process.env.ROOM_COUNTDOWN_MS || 10000);
const CHAT_HISTORY_LIMIT = 80;
const CHAT_MESSAGE_MAX_LENGTH = 160;
const CHAT_RATE_LIMIT_MS = 800;
const CHAT_PRESETS = [
  'Nice play!',
  'Good luck!',
  'That was close!',
  'Huge clear!',
  'Your turn!',
  'One more card!',
  'Good game!',
  'Well played!',
  'Ouch.',
  'No way!',
];
const CHAT_EMOJIS = ['👍', '👏', '🔥', '😮', '😂', '😬', '🤝', '🎯', '🏌️', '💀'];
const CHAT_STICKERS = [
  '\u{1F3CC}\uFE0F Nice shot',
  '\u{1F525} Hot streak',
  '\u{1F9E0} Big brain',
  '\u{1F92F} No way',
  '\u{1F44F} Golf clap',
  '\u{1F3AF} Bullseye',
];
const CHAT_GIFTS = [
  { id: 'gift-good-luck', label: 'Good Luck', icon: '\u{1F340}', price: 5 },
  { id: 'gift-cheer', label: 'Cheer', icon: '\u{1F389}', price: 10 },
  { id: 'gift-tissues', label: 'Tissues', icon: '\u{1F9FB}', price: 15 },
  { id: 'gift-coffee', label: 'Coffee', icon: '\u{2615}', price: 25 },
  { id: 'gift-wine', label: 'Wine', icon: '\u{1F377}', price: 40 },
  { id: 'gift-golf', label: 'Golf Flag', icon: '\u{26F3}', price: 75 },
  { id: 'gift-gem', label: 'Gem Spark', icon: '\u{1F48E}', price: 250 },
  { id: 'gift-crown', label: 'Crown Toss', icon: '\u{1F451}', price: 500 },
];
const CHAT_BLOCKED_TERMS = new Set([
  'fuck', 'fucks', 'fucker', 'fuckers', 'fucking', 'shit', 'shits', 'shitty', 'bitch', 'bitches',
  'cunt', 'cunts', 'asshole', 'assholes', 'dick', 'dicks', 'cock', 'cocks', 'pussy', 'pussies',
  'slut', 'sluts', 'whore', 'whores', 'porn', 'blowjob', 'handjob', 'rimjob', 'rape', 'rapist',
  'molest', 'molester', 'nigger', 'nigga', 'kike', 'spic', 'chink', 'gook', 'wetback', 'beaner',
  'coon', 'raghead', 'towelhead', 'paki', 'fag', 'faggot', 'tranny',
]);
const ROOM_INVITE_TTL_MS = 1000 * 60 * 30;
const SOCIAL_RECENT_LIMIT = 20;
const CLUB_CHAT_RATE_LIMIT_MS = 1000;
const MAX_PUSH_TOKENS_PER_USER = 12;
const PUSH_TEMPLATE_KEYS = ['turn', 'dailyBonus', 'roomInvite', 'friendRequest', 'mail'];
const DEFAULT_NOTIFICATION_CONFIG = {
  enabled: true,
  types: {
    turn: {
      enabled: true,
      title: 'Your turn in Nine Below',
      body: 'Room {roomCode} is waiting on you.',
    },
    dailyBonus: {
      enabled: true,
      title: 'Daily bonus ready',
      body: 'Claim {reward} free coins in Nine Below.',
    },
    roomInvite: {
      enabled: true,
      title: 'Game invite',
      body: '{fromDisplayName} invited you to room {roomCode}.',
    },
    friendRequest: {
      enabled: true,
      title: 'New friend request',
      body: '{fromDisplayName} wants to connect on Nine Below.',
    },
    mail: {
      enabled: true,
      title: 'New Nine Below mail',
      body: '{title}',
    },
  },
  custom: {
    enabled: true,
  },
};

function normalizePublicUrl(value) {
  const fallback = 'https://ninebelow.potterwell.com';
  try {
    const parsed = new URL(String(value || fallback).trim() || fallback);
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return fallback;
  }
}

function normalizeAdminPublicUrl(value, publicApiUrl) {
  const fallback = new URL('/admin', `${publicApiUrl}/`).toString().replace(/\/$/, '');
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  try {
    const parsed = new URL(raw, `${publicApiUrl}/`);
    return new URL('/admin', parsed.origin).toString().replace(/\/$/, '');
  } catch {
    return fallback;
  }
}

const app = express();
if (IS_PRODUCTION) app.set('trust proxy', Math.max(1, Number(process.env.TRUST_PROXY_HOPS || 1)));
app.use(cors({
  origin(origin, callback) {
    if (!origin || CLIENT_ORIGINS.includes('*') || PUBLIC_WEB_ORIGINS.has(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin is not allowed.'));
  },
  credentials: true,
}));
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (IS_PRODUCTION) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  return next();
});

const adminRequestWindow = new Map();
app.use('/admin/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Pragma', 'no-cache');
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const bucket = `${ip}:${Math.floor(Date.now() / 60000)}`;
  const count = (adminRequestWindow.get(bucket) || 0) + 1;
  adminRequestWindow.set(bucket, count);
  if (adminRequestWindow.size > 2000) {
    for (const key of adminRequestWindow.keys()) {
      if (!key.includes(String(Math.floor(Date.now() / 60000)))) adminRequestWindow.delete(key);
    }
  }
  if (count > 120) return res.status(429).json({ error: 'Too many admin requests. Slow down and try again.' });

  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.headers.origin || '';
    const host = req.headers.host || '';
    if (origin) {
      try {
        if (new URL(origin).host !== host) return res.status(403).json({ error: 'Invalid admin request origin.' });
      } catch {
        return res.status(403).json({ error: 'Invalid admin request origin.' });
      }
    }
  }
  return next();
});

const accountDeletionRequestWindow = new Map();
function accountDeletionRateLimit(req, res, next) {
  const now = Date.now();
  const currentWindow = Math.floor(now / (10 * 60 * 1000));
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const bucket = `${ip}:${currentWindow}`;
  const count = (accountDeletionRequestWindow.get(bucket) || 0) + 1;
  accountDeletionRequestWindow.set(bucket, count);
  if (accountDeletionRequestWindow.size > 1000) {
    for (const key of accountDeletionRequestWindow.keys()) {
      if (!key.endsWith(`:${currentWindow}`)) accountDeletionRequestWindow.delete(key);
    }
  }
  if (count > 12) {
    return res.status(429).json({
      error: 'Too many account deletion attempts. Wait a few minutes and try again.',
    });
  }
  return next();
}

const publicSupportRequestWindow = new Map();
function publicSupportRateLimit(req, res, next) {
  const now = Date.now();
  const currentWindow = Math.floor(now / (15 * 60 * 1000));
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const bucket = `${ip}:${currentWindow}`;
  const count = (publicSupportRequestWindow.get(bucket) || 0) + 1;
  publicSupportRequestWindow.set(bucket, count);
  if (publicSupportRequestWindow.size > 1000) {
    for (const key of publicSupportRequestWindow.keys()) {
      if (!key.endsWith(`:${currentWindow}`)) publicSupportRequestWindow.delete(key);
    }
  }
  if (count > 6) {
    return res.status(429).json({
      error: 'Too many support requests. Wait a few minutes and try again.',
    });
  }
  return next();
}

const earlyAccessRequestWindow = new Map();
function earlyAccessRateLimit(req, res, next) {
  const currentWindow = Math.floor(Date.now() / (15 * 60 * 1000));
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const bucket = `${req.path}:${ip}:${currentWindow}`;
  const count = (earlyAccessRequestWindow.get(bucket) || 0) + 1;
  earlyAccessRequestWindow.set(bucket, count);
  if (earlyAccessRequestWindow.size > 2000) {
    for (const key of earlyAccessRequestWindow.keys()) {
      if (!key.endsWith(`:${currentWindow}`)) earlyAccessRequestWindow.delete(key);
    }
  }
  if (count > 12) return res.status(429).json({ error: 'Too many early-access requests. Wait a few minutes and try again.' });
  return next();
}

const playerLoginRequestWindow = new Map();
function playerLoginRateLimit(req, res, next) {
  const currentWindow = Math.floor(Date.now() / (15 * 60 * 1000));
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const accountKey = crypto.createHash('sha256')
    .update(String(req.body?.displayName || '').trim().toLowerCase())
    .digest('hex')
    .slice(0, 20);
  const buckets = [`ip:${ip}:${currentWindow}`, `account:${accountKey}:${currentWindow}`];
  const blocked = buckets.some(bucket => (playerLoginRequestWindow.get(bucket) || 0) >= 10);
  if (blocked) return res.status(429).json({ error: 'Too many login attempts. Wait a few minutes and try again.' });
  for (const bucket of buckets) playerLoginRequestWindow.set(bucket, (playerLoginRequestWindow.get(bucket) || 0) + 1);
  if (playerLoginRequestWindow.size > 4000) {
    for (const key of playerLoginRequestWindow.keys()) {
      if (!key.endsWith(`:${currentWindow}`)) playerLoginRequestWindow.delete(key);
    }
  }
  return next();
}

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: CLIENT_ORIGINS.includes('*') ? '*' : CLIENT_ORIGINS } });
const listeningServers = [server];

/** @type {Map<string, { userId: string; displayName: string; passwordHash: string; salt: string; stats: { gamesPlayed: number; wins: number } }>} */
const users = new Map();
/** @type {Map<string, { token: string; userId: string; expiresAt: number }>} */
const sessions = new Map();
/** @type {Array<{ resultId: string; completedAt: number; roomCode: string; round: number; totalRounds: number; players: Array<{ userId: string; displayName: string; total: number; won: boolean }> }>} */
const results = [];
/** @type {Map<string, any>} */
const rooms = new Map();
/** @type {Map<string, { roomCode: string; userId: string }>} */
const sockets = new Map();
/** @type {Map<string, Set<string>>} */
const userSockets = new Map();
/** @type {Map<string, Set<string>>} */
const clubForegroundSockets = new Map();
/** @type {Map<string, any>} */
const rankedQueue = new Map();
/** @type {Map<string, any>} */
const clubs = new Map();
/** @type {Array<any>} */
const mailEntries = [];
/** @type {Array<any>} */
const accountDeletionRequests = [];
/** @type {Map<string, number>} */
const clubChatRate = new Map();
const competitiveStore = normalizeCompetitiveConfigStore({});
let rankedSeason = normalizeRankedSeason(null, Date.now(), liveCompetitiveConfig(competitiveStore));
const adminStore = normalizeAdminStore({});
const catalogStore = normalizeCatalogStore({});
const economyStore = normalizeEconomyConfigStore({});
let availabilityStore = normalizeAvailabilityStore({});
let afkConfigStore = normalizeAfkConfig({});
let forfeitConfigStore = normalizeForfeitConfig({});
let releasePolicyStore = normalizeReleasePolicyStore({});
const earlyAccessStore = normalizeEarlyAccessStore({});
const postgresStore = createPostgresStore(DATABASE_URL);
const googleOAuthClient = new OAuth2Client();
let storeReady = false;
let storeLoadError = null;
let databaseHealthCache = { checkedAt: 0, result: null, pending: null };
let smtpHealthCache = { checkedAt: 0, result: null, pending: null };
const operationalHealthStates = new Map();
const operationalHealthEvents = [];
let lastDailyPushScanAt = 0;
let storeMigrationPending = false;
let earlyAccessDeliveryRunning = false;
let lastEarlyAccessDeliveryAt = 0;
let lastEarlyAccessRetentionAt = 0;

function storageStatus() {
  return {
    provider: postgresStore ? 'postgres' : 'json',
    durable: !!postgresStore,
    databaseConfigured: !!DATABASE_URL,
    production: IS_PRODUCTION,
    unsafeJsonAllowed: ALLOW_UNSAFE_JSON_IN_PRODUCTION,
    ready: storeReady,
    error: storeLoadError ? 'Persistence failed to load.' : null,
  };
}

function safeHealthErrorCode(value) {
  return String(value || 'UNKNOWN_ERROR').replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 80);
}

function databaseHealthMessage(errorCode) {
  const code = safeHealthErrorCode(errorCode).toUpperCase();
  if (code.includes('CERT') || code.includes('TLS') || code.includes('ALTNAME')) {
    return 'Database TLS verification failed. The pinned CA or presented certificate may have changed.';
  }
  if (['28P01', '28000'].includes(code) || code.includes('AUTH')) {
    return 'Database authentication failed. Review the Railway database credentials.';
  }
  if (code.includes('TIMEOUT') || code === 'ETIMEDOUT') {
    return 'The database did not answer within the health-check timeout.';
  }
  if (['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN'].includes(code)) {
    return 'The database network connection is unavailable.';
  }
  return 'The live database query failed.';
}

function databaseCertificateHealth() {
  const pem = String(process.env.DATABASE_SSL_CA || '').replace(/\\n/g, '\n').trim();
  if (!pem) return { configured: false, expiresAt: null, daysRemaining: null, error: null };
  try {
    const certificate = new crypto.X509Certificate(pem);
    const expiresAt = Date.parse(certificate.validTo);
    return {
      configured: true,
      expiresAt: Number.isFinite(expiresAt) ? expiresAt : null,
      daysRemaining: Number.isFinite(expiresAt) ? Math.floor((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)) : null,
      error: null,
    };
  } catch {
    return { configured: true, expiresAt: null, daysRemaining: null, error: 'The configured database CA cannot be parsed.' };
  }
}

async function liveDatabaseHealth({ force = false } = {}) {
  if (!postgresStore) return { ok: !IS_PRODUCTION, checkedAt: Date.now(), provider: 'json', latencyMs: null };
  const cacheMs = 8_000;
  if (!force && databaseHealthCache.result && Date.now() - databaseHealthCache.checkedAt < cacheMs) {
    return databaseHealthCache.result;
  }
  if (databaseHealthCache.pending) return databaseHealthCache.pending;
  databaseHealthCache.pending = postgresStore.healthCheck({ timeoutMs: 3_000 })
    .then(result => {
      databaseHealthCache = { checkedAt: result.checkedAt, result: { ...result, provider: 'postgres' }, pending: null };
      return databaseHealthCache.result;
    })
    .catch(error => {
      const checkedAt = Date.now();
      const result = {
        ok: false,
        checkedAt,
        provider: 'postgres',
        latencyMs: null,
        errorCode: safeHealthErrorCode(error?.code),
      };
      databaseHealthCache = { checkedAt, result, pending: null };
      return result;
    });
  return databaseHealthCache.pending;
}

function rankedConfig() {
  return liveCompetitiveConfig(competitiveStore);
}

function publicRankedCatalog() {
  const config = rankedConfig();
  rankedSeason = normalizeRankedSeason(rankedSeason, Date.now(), config);
  return {
    placementMatchesRequired: config.placementMatchesRequired,
    rankPath: config.leagueBands.flatMap(band => (band.divisions?.length
      ? band.divisions.map(division => ({ league: band.league, division, name: `${band.league} ${division}` }))
      : [{ league: band.league, division: null, name: band.league }])),
    season: {
      id: rankedSeason.id,
      name: rankedSeason.name,
      startsAt: rankedSeason.startsAt,
      endsAt: rankedSeason.endsAt,
      rewards: (rankedSeason.rewards || config.rewards || []).map(reward => ({
        id: reward.id,
        name: reward.name,
        league: reward.league,
        requiredRank: reward.requiredRank || reward.league,
        cosmeticId: reward.cosmeticId,
        earned: false,
        claimed: false,
      })),
    },
  };
}

function economyConfig() {
  return normalizeEconomyConfigStore(economyStore);
}

function clubConfig() {
  return economyConfig().clubConfig;
}

function normalizeClub(club, now = Date.now(), season = rankedSeason) {
  return normalizeClubRecord(club, now, season, clubConfig());
}

function onlineClubUserIds() {
  return new Set([...clubForegroundSockets.entries()]
    .filter(([, socketIds]) => socketIds.size > 0)
    .map(([userId]) => userId));
}

function publicClubSummary(club, viewerUserId = null, now = Date.now(), season = rankedSeason) {
  return buildPublicClubSummary(club, viewerUserId, now, season, clubConfig(), onlineClubUserIds());
}

function publicClubProfile(club, clubUsers, viewerUserId, season = rankedSeason, now = Date.now()) {
  return buildPublicClubProfile(club, clubUsers, viewerUserId, season, now, clubConfig(), onlineClubUserIds());
}

function uniqueByUserId(items) {
  const seen = new Set();
  const unique = [];
  for (const item of Array.isArray(items) ? items : []) {
    const userId = String(item?.userId || '');
    if (!userId || seen.has(userId)) continue;
    seen.add(userId);
    unique.push({ ...item, userId });
  }
  return unique;
}

function normalizeSocial(user) {
  user.social ||= {};
  user.social.friends = uniqueByUserId(user.social.friends)
    .map(item => ({ userId: item.userId, since: Number(item.since || Date.now()) || Date.now() }));
  user.social.incomingRequests = uniqueByUserId(user.social.incomingRequests)
    .filter(item => item.id)
    .map(item => ({ id: String(item.id), userId: item.userId, createdAt: Number(item.createdAt || Date.now()) || Date.now() }));
  user.social.outgoingRequests = uniqueByUserId(user.social.outgoingRequests)
    .filter(item => item.id)
    .map(item => ({ id: String(item.id), userId: item.userId, createdAt: Number(item.createdAt || Date.now()) || Date.now() }));
  user.social.roomInvites = (Array.isArray(user.social.roomInvites) ? user.social.roomInvites : [])
    .filter(item => item?.id && item?.roomCode && item?.fromUserId)
    .map(item => ({
      id: String(item.id),
      roomCode: String(item.roomCode).toUpperCase(),
      fromUserId: String(item.fromUserId),
      createdAt: Number(item.createdAt || Date.now()) || Date.now(),
      expiresAt: Number(item.expiresAt || (Date.now() + ROOM_INVITE_TTL_MS)) || (Date.now() + ROOM_INVITE_TTL_MS),
    }));
  return user.social;
}

function normalizeUserClub(user) {
  user.clubId = user.clubId ? String(user.clubId) : null;
  return user.clubId;
}

function normalizeProvider(value) {
  const provider = String(value || '').trim().toLowerCase();
  return provider === 'google' || provider === 'facebook' ? provider : '';
}

function providerLabel(provider) {
  return provider === 'facebook' ? 'Facebook' : 'Google';
}

function socialProviderEnabled(provider) {
  if (SOCIAL_AUTH_TEST_MODE) return true;
  if (provider === 'google') return GOOGLE_CLIENT_IDS.length > 0;
  if (provider === 'facebook') return !!FACEBOOK_APP_ID && !!FACEBOOK_APP_SECRET;
  return false;
}

function socialProviderConfig() {
  return {
    google: socialProviderEnabled('google'),
    facebook: socialProviderEnabled('facebook'),
  };
}

function normalizeAuthProviders(user) {
  user.authProviders = user.authProviders && typeof user.authProviders === 'object' ? user.authProviders : {};
  for (const provider of ['google', 'facebook']) {
    const item = user.authProviders[provider];
    const providerUserId = String(item?.providerUserId || item?.id || '').trim();
    if (!providerUserId) {
      delete user.authProviders[provider];
      continue;
    }
    user.authProviders[provider] = {
      provider,
      providerUserId,
      email: String(item.email || '').trim().toLowerCase(),
      emailVerified: !!item.emailVerified,
      displayName: String(item.displayName || '').trim(),
      linkedAt: Number(item.linkedAt || Date.now()) || Date.now(),
      lastLoginAt: Number(item.lastLoginAt || item.linkedAt || Date.now()) || Date.now(),
    };
  }
  return user.authProviders;
}

function publicAuthProviders(user) {
  normalizeAuthProviders(user);
  return {
    google: !!user.authProviders.google,
    facebook: !!user.authProviders.facebook,
  };
}

function publicCompetitiveRankOnly(competitive = {}) {
  const publicRank = rank => rank ? {
    league: rank.league || 'Unranked',
    division: rank.division ?? null,
    name: rank.name || 'Unranked',
  } : null;
  return {
    league: publicRank(competitive.league),
    placementComplete: !!competitive.placementComplete,
    placementsRemaining: competitive.placementsRemaining ?? 0,
    rankedGames: competitive.rankedGames ?? 0,
    wins: competitive.wins ?? 0,
    losses: competitive.losses ?? 0,
    seasonBestLeague: publicRank(competitive.seasonBestLeague),
    careerBestLeague: publicRank(competitive.careerBestLeague),
  };
}

function publicCompetitiveByPlayersRankOnly(competitiveByPlayers = {}) {
  return Object.fromEntries(Object.entries(competitiveByPlayers || {}).map(([count, value]) => [count, publicCompetitiveRankOnly(value)]));
}

function normalizePushTokenValue(value) {
  const token = String(value || '').trim();
  if (!/^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(token)) return '';
  return token;
}

function normalizePushPlatform(value) {
  const platform = String(value || '').trim().toLowerCase();
  return platform === 'ios' || platform === 'android' || platform === 'web' ? platform : 'unknown';
}

function cleanPushText(value, maxLength = 120) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizeNotificationConfig(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const next = structuredClone(DEFAULT_NOTIFICATION_CONFIG);
  next.enabled = source.enabled !== false;
  for (const key of PUSH_TEMPLATE_KEYS) {
    const patch = source.types?.[key] || {};
    next.types[key] = {
      enabled: patch.enabled !== false,
      title: cleanPushText(patch.title || next.types[key].title, 80) || next.types[key].title,
      body: cleanPushText(patch.body || next.types[key].body, 180) || next.types[key].body,
    };
  }
  next.custom = { enabled: source.custom?.enabled !== false };
  return next;
}

function notificationConfig() {
  adminStore.notificationConfig = normalizeNotificationConfig(adminStore.notificationConfig);
  return adminStore.notificationConfig;
}

function adminEmailConfigStatus() {
  const portConfigured = Number.isInteger(ADMIN_SMTP_PORT) && ADMIN_SMTP_PORT > 0 && ADMIN_SMTP_PORT <= 65_535;
  const credentialsConfigured = !!ADMIN_SMTP_USER && !!ADMIN_SMTP_PASS;
  const credentialsValid = credentialsConfigured;
  const enabled = ADMIN_EMAIL_TEST_MODE || (
    !!ADMIN_SMTP_HOST
    && !!ADMIN_SMTP_FROM
    && portConfigured
    && credentialsConfigured
  );
  return {
    enabled,
    testMode: ADMIN_EMAIL_TEST_MODE,
    hostConfigured: !!ADMIN_SMTP_HOST,
    fromConfigured: !!ADMIN_SMTP_FROM,
    credentialsConfigured,
    credentialsValid,
    portConfigured,
    port: portConfigured ? ADMIN_SMTP_PORT : null,
    secure: ADMIN_SMTP_SECURE,
  };
}

function adminRecoveryEmailEnabled() {
  return adminEmailConfigStatus().enabled;
}

function adminEmailTransport() {
  if (adminSmtpTransport) return adminSmtpTransport;
  if (!adminRecoveryEmailEnabled() || ADMIN_EMAIL_TEST_MODE) {
    throw new Error('Email delivery is not configured.');
  }
  const auth = ADMIN_SMTP_USER && ADMIN_SMTP_PASS
    ? { user: ADMIN_SMTP_USER, pass: ADMIN_SMTP_PASS }
    : undefined;
  adminSmtpTransport = nodemailer.createTransport({
    host: ADMIN_SMTP_HOST,
    port: ADMIN_SMTP_PORT,
    secure: ADMIN_SMTP_SECURE,
    requireTLS: !ADMIN_SMTP_SECURE,
    auth,
    pool: true,
    maxConnections: 2,
    maxMessages: 50,
    connectionTimeout: ADMIN_SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: ADMIN_SMTP_GREETING_TIMEOUT_MS,
    socketTimeout: ADMIN_SMTP_SOCKET_TIMEOUT_MS,
  });
  return adminSmtpTransport;
}

async function liveSmtpHealth({ force = false } = {}) {
  const config = adminEmailConfigStatus();
  if (config.testMode) {
    return { ok: true, checkedAt: Date.now(), latencyMs: 0, mode: 'test', errorCode: null };
  }
  if (!config.enabled) {
    return { ok: false, checkedAt: Date.now(), latencyMs: null, mode: 'disabled', errorCode: 'SMTP_NOT_CONFIGURED' };
  }
  const cacheMs = 60_000;
  if (!force && smtpHealthCache.result && Date.now() - smtpHealthCache.checkedAt < cacheMs) {
    return smtpHealthCache.result;
  }
  if (smtpHealthCache.pending) return smtpHealthCache.pending;
  const startedAt = Date.now();
  smtpHealthCache.pending = adminEmailTransport().verify()
    .then(() => {
      const checkedAt = Date.now();
      const result = { ok: true, checkedAt, latencyMs: checkedAt - startedAt, mode: 'smtp', errorCode: null };
      smtpHealthCache = { checkedAt, result, pending: null };
      return result;
    })
    .catch(error => {
      const checkedAt = Date.now();
      const result = {
        ok: false,
        checkedAt,
        latencyMs: checkedAt - startedAt,
        mode: 'smtp',
        errorCode: safeHealthErrorCode(error?.code || error?.responseCode || 'SMTP_VERIFY_FAILED'),
      };
      smtpHealthCache = { checkedAt, result, pending: null };
      return result;
    });
  return smtpHealthCache.pending;
}

async function sendTransactionalEmail(message, testMetadata = {}) {
  if (ADMIN_EMAIL_TEST_MODE) {
    adminEmailTestOutbox.push({ ...message, ...testMetadata, sentAt: Date.now() });
    return { accepted: [message.to], testMode: true };
  }
  if (!adminRecoveryEmailEnabled()) throw new Error('Email delivery is not configured.');
  return adminEmailTransport().sendMail({
    from: ADMIN_SMTP_FROM,
    to: message.to,
    replyTo: message.replyTo,
    subject: message.subject,
    text: message.text,
    html: message.html,
    headers: message.headers,
  });
}

async function sendAdminRecoveryCode({ admin, code, expiresAt }) {
  const message = {
    to: admin.email,
    subject: 'Nine Below admin password recovery code',
    text: [
      `Hello ${admin.displayName},`,
      '',
      `Your Nine Below admin password recovery code is ${code}.`,
      `It expires at ${new Date(expiresAt).toLocaleString()}.`,
      '',
      'If you did not request this code, ignore this message and review admin audit logs.',
    ].join('\n'),
  };
  await sendTransactionalEmail(message, { type: 'admin-recovery', adminId: admin.adminId, code, expiresAt });
}

async function sendAccountDeletionCode({ user, requestId, email, code, expiresAt }) {
  const message = {
    to: email,
    subject: 'Nine Below account deletion verification code',
    text: [
      `Hello ${user.displayName},`,
      '',
      `Your Nine Below account deletion verification code is ${code}.`,
      `It expires at ${new Date(expiresAt).toLocaleString()}.`,
      '',
      'Only enter this code on ninebelow.potterwell.com. If you did not request account deletion, ignore this message and your account will remain unchanged.',
    ].join('\n'),
  };
  await sendTransactionalEmail(message, {
    type: 'account-deletion',
    userId: anonymizedDeletedUserId(user.userId),
    requestId,
    code,
    expiresAt,
  });
}

function supportTrackingUrl(ticket, accessToken) {
  const reference = encodeURIComponent(ticket.publicReference || '');
  const token = encodeURIComponent(accessToken || '');
  return `${PUBLIC_API_URL}/support/ticket?reference=${reference}#token=${token}`;
}

function hydrateEarlyAccessSupportTicket(ticket, options = {}) {
  if (!ticket?.earlyAccessSignupId) return ticket;
  const stored = adminStore.supportTickets.find(item => item.ticketId === ticket.ticketId);
  const payload = decryptEarlyAccessContact(stored?.protectedPayloadEncrypted, process.env);
  if (!payload) return ticket;
  const includePii = options.includePii !== false;
  return {
    ...ticket,
    displayName: includePii ? (payload.displayName || payload.contactName || 'Early access tester') : 'Early access tester',
    contactName: includePii ? (payload.contactName || 'Early access tester') : 'Early access tester',
    contactEmail: includePii ? (payload.contactEmail || null) : null,
    website: includePii ? (payload.website || ticket.website) : '',
    message: payload.message || ticket.message,
  };
}

function protectEarlyAccessFeedbackTicket(ticket, signupId) {
  const stored = adminStore.supportTickets.find(item => item.ticketId === ticket.ticketId);
  if (!stored) return;
  stored.earlyAccessSignupId = String(signupId || '');
  stored.protectedPayloadEncrypted = encryptEarlyAccessContact({
    displayName: ticket.displayName,
    contactName: ticket.contactName,
    contactEmail: ticket.contactEmail,
    website: ticket.website,
    message: ticket.message,
  }, process.env);
  stored.displayName = 'Early access tester';
  stored.contactName = 'Early access tester';
  stored.contactEmail = '';
  stored.website = '';
  stored.message = 'Protected early-access feedback. Authorized staff can view this case in the admin console.';
}

function eraseLinkedEarlyAccessFeedback(signupIds, at = Date.now()) {
  const targets = new Set((signupIds || []).map(String).filter(Boolean));
  if (!targets.size) return 0;
  let erased = 0;
  for (const ticket of adminStore.supportTickets) {
    if (!targets.has(String(ticket.earlyAccessSignupId || ''))) continue;
    ticket.displayName = 'Erased early-access participant';
    ticket.contactName = 'Erased early-access participant';
    ticket.contactEmail = '';
    ticket.website = '';
    ticket.message = 'Early-access feedback removed under the participant erasure policy.';
    ticket.protectedPayloadEncrypted = '';
    ticket.publicAccessTokenHash = null;
    ticket.notes = [];
    ticket.status = 'closed';
    ticket.updatedAt = at;
    erased += 1;
  }
  return erased;
}

async function sendSupportEmailQuietly(message, metadata = {}) {
  try {
    await sendTransactionalEmail(message, metadata);
    return true;
  } catch (error) {
    console.error('Support email delivery failed:', redactEarlyAccessError(error?.message || error));
    return false;
  }
}

async function sendPublicSupportOpened(ticket, accessToken) {
  const trackingUrl = supportTrackingUrl(ticket, accessToken);
  const sourceLabel = ticket.source === 'potterwell' ? 'Potterwell' : 'Nine Below';
  await Promise.all([
    sendSupportEmailQuietly({
      to: ticket.contactEmail,
      subject: `${sourceLabel} support case ${ticket.publicReference}`,
      text: [
        `Hello ${ticket.contactName},`,
        '',
        `We received your ${sourceLabel} support request.`,
        `Case: ${ticket.publicReference}`,
        `Subject: ${ticket.subject}`,
        '',
        'Use this private link to follow the case and reply:',
        trackingUrl,
        '',
        'Keep this link private. It provides access to your support conversation.',
      ].join('\n'),
    }, { type: 'support-opened-requester', ticketId: ticket.ticketId }),
    sendSupportEmailQuietly({
      to: SUPPORT_INBOX_EMAIL,
      replyTo: ticket.contactEmail,
      subject: `[${ticket.publicReference}] ${ticket.subject}`,
      text: [
        `New ${sourceLabel} support request`,
        '',
        `Case: ${ticket.publicReference}`,
        `From: ${ticket.contactName} <${ticket.contactEmail}>`,
        `Category: ${ticket.category}`,
        `Source page: ${ticket.website || 'not supplied'}`,
        '',
        ticket.message,
        '',
        `Manage this case at ${ADMIN_PUBLIC_URL}`,
      ].join('\n'),
    }, { type: 'support-opened-staff', ticketId: ticket.ticketId }),
  ]);
}

function queueSupportEmail(label, task) {
  setImmediate(() => {
    Promise.resolve()
      .then(task)
      .catch(error => console.error(`${label} failed:`, redactEarlyAccessError(error?.message || error)));
  });
}

function earlyAccessCampaignEmailStatus() {
  const security = earlyAccessSecurityStatus();
  const postalAddressConfigured = !!EARLY_ACCESS_POSTAL_ADDRESS;
  const enabled = adminRecoveryEmailEnabled()
    && security.ready
    && postalAddressConfigured
    && (EARLY_ACCESS_CAMPAIGN_EMAIL_ENABLED || ADMIN_EMAIL_TEST_MODE);
  return {
    enabled,
    deliveryEnabled: EARLY_ACCESS_CAMPAIGN_EMAIL_ENABLED || ADMIN_EMAIL_TEST_MODE,
    emailConfigured: adminRecoveryEmailEnabled(),
    postalAddressConfigured,
    security,
    emailsPerMinute: EARLY_ACCESS_EMAILS_PER_MINUTE,
  };
}

function earlyAccessIpHash(req) {
  const key = String(process.env.EARLY_ACCESS_TOKEN_SECRET || 'nine-below-local-early-access-ip');
  return crypto.createHmac('sha256', key).update(String(req.ip || req.socket?.remoteAddress || '')).digest('hex');
}

function earlyAccessReferrerHost(req, body = {}) {
  const raw = String(body.referrer || req.headers.referer || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw).host;
  } catch {
    return '';
  }
}

function earlyAccessHoneypotFilled(body = {}) {
  return [body.company, body.faxNumber__nb_ea_29, body.websiteUrl].some(value => String(value || '').trim());
}

async function sendEarlyAccessConfirmation(result) {
  const message = earlyAccessConfirmationEmail({
    email: result.email,
    firstName: result.firstName,
    confirmationToken: result.confirmationToken,
    baseUrl: PUBLIC_API_URL,
  });
  return sendTransactionalEmail(message, {
    type: 'early-access-confirmation',
    signupId: result.signup.signupId,
    confirmationToken: result.confirmationToken,
  });
}

function mergeEarlyAccessRecord(collection, record, key) {
  if (!record?.[key]) return null;
  const existing = collection.find(item => item[key] === record[key]);
  if (existing) {
    if (Number(existing.updatedAt || 0) > Number(record.updatedAt || 0)) return existing;
    return Object.assign(existing, record);
  }
  collection.push(record);
  return record;
}

async function processEarlyAccessEmailQueue() {
  if (earlyAccessDeliveryRunning || !storeReady || !earlyAccessCampaignEmailStatus().enabled) return;
  const minimumInterval = Math.ceil(60_000 / EARLY_ACCESS_EMAILS_PER_MINUTE);
  if (Date.now() - lastEarlyAccessDeliveryAt < minimumInterval) return;
  earlyAccessDeliveryRunning = true;
  let claimed = null;
  try {
    if (postgresStore) {
      const databaseClaim = await postgresStore.claimEarlyAccessDelivery();
      if (!databaseClaim) return;
      const delivery = mergeEarlyAccessRecord(earlyAccessStore.deliveries, databaseClaim.delivery, 'deliveryId');
      const campaign = mergeEarlyAccessRecord(earlyAccessStore.campaigns, databaseClaim.campaign, 'campaignId');
      const signup = mergeEarlyAccessRecord(earlyAccessStore.signups, databaseClaim.signup, 'signupId');
      normalizeEarlyAccessStore(earlyAccessStore);
      if (!delivery) return;
      if (!campaign || !signup || campaign.status === 'cancelled' || signup.consentStatus !== 'confirmed') {
        delivery.status = 'skipped';
        delivery.leaseExpiresAt = null;
        delivery.lastError = !campaign ? 'Campaign missing.' : !signup ? 'Signup missing.' : campaign.status === 'cancelled' ? 'Campaign cancelled.' : 'Recipient is not subscribed.';
        delivery.updatedAt = Date.now();
        await postgresStore.saveEarlyAccessQueueContext({ delivery, campaign, signup });
        return;
      }
      campaign.status = 'sending';
      campaign.updatedAt = Date.now();
      claimed = { delivery, campaign, signup };
    } else {
      claimed = claimEarlyAccessDelivery(earlyAccessStore);
      if (!claimed) return;
      saveStore();
    }
    lastEarlyAccessDeliveryAt = Date.now();
    try {
      if (postgresStore) {
        const currentSignup = await postgresStore.getEarlyAccessSignup(claimed.signup.signupId);
        if (!currentSignup || currentSignup.consentStatus !== 'confirmed' || currentSignup.erasedAt) {
          claimed.delivery.status = 'skipped';
          claimed.delivery.leaseExpiresAt = null;
          claimed.delivery.lastError = 'Recipient is not subscribed.';
          claimed.delivery.updatedAt = Date.now();
          claimed.signup = currentSignup || claimed.signup;
          await postgresStore.saveEarlyAccessQueueContext(claimed);
          return;
        }
        claimed.signup = mergeEarlyAccessRecord(earlyAccessStore.signups, currentSignup, 'signupId');
      }
      const message = renderEarlyAccessCampaignEmail(claimed.campaign, claimed.signup, claimed.delivery, {
        env: process.env,
        baseUrl: PUBLIC_API_URL,
        postalAddress: EARLY_ACCESS_POSTAL_ADDRESS,
      });
      message.replyTo = EARLY_ACCESS_REPLY_TO;
      const smtpResult = await sendTransactionalEmail(message, {
        type: 'early-access-campaign',
        campaignId: claimed.campaign.campaignId,
        deliveryId: claimed.delivery.deliveryId,
        signupId: claimed.signup.signupId,
      });
      if (!Array.isArray(smtpResult?.accepted) || smtpResult.accepted.length === 0) {
        throw new Error('SMTP did not accept the recipient address.');
      }
      completeEarlyAccessDelivery(earlyAccessStore, claimed.delivery.deliveryId);
    } catch (error) {
      const responseCode = Number(error?.responseCode || 0);
      failEarlyAccessDelivery(earlyAccessStore, claimed.delivery.deliveryId, error, { permanent: responseCode >= 500 && responseCode < 600 });
      console.error('Early-access email delivery failed:', redactEarlyAccessError(error?.message || error));
    }
    if (postgresStore) await postgresStore.saveEarlyAccessQueueContext(claimed);
    else saveStore();
  } catch (error) {
    console.error('Early-access queue processing failed:', redactEarlyAccessError(error?.message || error));
  } finally {
    earlyAccessDeliveryRunning = false;
  }
}

function publicSupportHoneypotFilled(body = {}) {
  return [body.company, body.supportFaxNumber__nb_71]
    .some(value => String(value || '').trim());
}

async function sendSupportRequesterUpdate(ticket, message, status = null) {
  if (!ticket?.contactEmail || !ticket?.publicReference) return false;
  const statusLine = status ? `Status: ${status.replaceAll('_', ' ')}` : null;
  return sendSupportEmailQuietly({
    to: ticket.contactEmail,
    subject: `Update for support case ${ticket.publicReference}`,
    text: [
      `Hello ${ticket.contactName || ticket.displayName || 'there'},`,
      '',
      statusLine,
      message || 'Your support case has been updated.',
      '',
      'Use the private tracking link from your original confirmation email to view the conversation or reply.',
      '',
      'Potterwell Support',
    ].filter(Boolean).join('\n'),
  }, { type: 'support-requester-update', ticketId: ticket.ticketId, status });
}

function renderPushTemplate(template, data = {}) {
  return cleanPushText(template, 220).replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => cleanPushText(data[key], 80));
}

function normalizePushNotifications(user) {
  const existing = user.pushNotifications && typeof user.pushNotifications === 'object' ? user.pushNotifications : {};
  const sourceTokens = Array.isArray(existing.tokens)
    ? existing.tokens
    : Array.isArray(user.pushTokens)
      ? user.pushTokens
      : [];
  const seen = new Set();
  const tokens = [];
  for (const raw of sourceTokens) {
    const token = normalizePushTokenValue(raw?.expoPushToken || raw?.token || raw);
    if (!token || seen.has(token)) continue;
    seen.add(token);
    tokens.push({
      token,
      deviceId: String(raw?.deviceId || '').trim(),
      platform: normalizePushPlatform(raw?.platform),
      createdAt: Number(raw?.createdAt || Date.now()) || Date.now(),
      updatedAt: Number(raw?.updatedAt || raw?.createdAt || Date.now()) || Date.now(),
    });
  }
  user.pushNotifications = {
    tokens: tokens.slice(0, MAX_PUSH_TOKENS_PER_USER),
    lastKeys: existing.lastKeys && typeof existing.lastKeys === 'object' ? existing.lastKeys : {},
  };
  delete user.pushTokens;
  return user.pushNotifications;
}

function upsertPushToken(user, body = {}) {
  const token = normalizePushTokenValue(body.expoPushToken || body.pushToken || body.token);
  if (!token) return { error: 'Invalid Expo push token.' };
  const now = Date.now();
  const deviceId = String(body.deviceId || '').trim();
  const platform = normalizePushPlatform(body.platform);
  const push = normalizePushNotifications(user);
  const existing = push.tokens.find(item => item.token === token);
  push.tokens = push.tokens.filter(item => item.token !== token && (!deviceId || item.deviceId !== deviceId));
  push.tokens.unshift({
    token,
    deviceId,
    platform,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });
  push.tokens = push.tokens.slice(0, MAX_PUSH_TOKENS_PER_USER);
  return { token, pushTokenCount: push.tokens.length };
}

function removePushToken(user, body = {}) {
  const token = normalizePushTokenValue(body.expoPushToken || body.pushToken || body.token);
  const deviceId = String(body.deviceId || '').trim();
  const push = normalizePushNotifications(user);
  if (!token && !deviceId) return { error: 'A push token or device ID is required.' };
  push.tokens = push.tokens.filter(item => {
    if (token && item.token === token) return false;
    if (deviceId && item.deviceId === deviceId) return false;
    return true;
  });
  return { pushTokenCount: push.tokens.length };
}

function utcDayKey(now = Date.now()) {
  const date = new Date(now);
  return String(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

async function sendExpoPushMessages(messages) {
  if (!messages.length) return [];
  if (PUSH_TEST_MODE) {
    pushTestOutbox.push(...messages.map(message => ({ ...message, sentAt: Date.now() })));
    return messages.map(() => ({ status: 'ok' }));
  }
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${EXPO_ACCESS_TOKEN}`;
  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(messages),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.errors?.[0]?.message || body?.error || `Expo push failed: ${response.status}`);
  return Array.isArray(body?.data) ? body.data : [];
}

async function sendQueuedPush(user, payload) {
  const push = normalizePushNotifications(user);
  const tokens = push.tokens.slice();
  if (!tokens.length) return;
  const messages = tokens.map(item => ({
    to: item.token,
    sound: 'default',
    title: payload.title,
    body: payload.body,
    data: payload.data || {},
    priority: 'high',
    channelId: 'game-alerts',
  }));
  const tickets = await sendExpoPushMessages(messages);
  const invalidTokens = new Set();
  tickets.forEach((ticket, index) => {
    if (ticket?.status === 'error' && ticket?.details?.error === 'DeviceNotRegistered') {
      invalidTokens.add(tokens[index]?.token);
    }
  });
  if (invalidTokens.size) {
    push.tokens = push.tokens.filter(item => !invalidTokens.has(item.token));
    saveStore();
  }
}

function queuePushToUser(userId, payload) {
  const user = users.get(userId);
  if (!visiblePlayer(user)) return false;
  const push = normalizePushNotifications(user);
  if (!push.tokens.length) return false;
  const keyName = payload.keyName || payload.type || 'notification';
  if (payload.dedupeKey) {
    if (push.lastKeys[keyName] === payload.dedupeKey) return false;
    push.lastKeys[keyName] = payload.dedupeKey;
  }
  sendQueuedPush(user, payload).catch(error => {
    console.error('Push notification failed:', error);
  });
  return true;
}

function queueConfiguredPushToUser(userId, type, payload = {}) {
  const config = notificationConfig();
  if (!config.enabled) return false;
  const typeConfig = config.types[type];
  if (!typeConfig?.enabled) return false;
  return queuePushToUser(userId, {
    ...payload,
    type,
    title: renderPushTemplate(typeConfig.title, payload.templateData),
    body: renderPushTemplate(typeConfig.body, payload.templateData),
  });
}

function queueAdminCustomPush({ title, body, targetUserId = null, data = {} } = {}) {
  const config = notificationConfig();
  if (!config.enabled || !config.custom.enabled) return { queued: 0, targetedUsers: 0 };
  const safeTitle = cleanPushText(title, 80);
  const safeBody = cleanPushText(body, 180);
  if (!safeTitle || !safeBody) return { error: 'Title and message are required.' };
  const targets = targetUserId ? [users.get(targetUserId)].filter(visiblePlayer) : activePlayerAccounts();
  let queued = 0;
  for (const user of targets) {
    if (queuePushToUser(user.userId, {
      type: 'custom',
      keyName: 'custom',
      dedupeKey: `custom:${Date.now()}:${crypto.randomUUID()}:${user.userId}`,
      title: safeTitle,
      body: safeBody,
      data: { type: 'custom', ...data },
    })) queued += 1;
  }
  return { queued, targetedUsers: targets.length };
}

function normalizeUserRecord(user, now = Date.now()) {
  normalizeUserProgression(user, now, rankedSeason, rankedConfig());
  normalizeSocial(user);
  normalizeUserClub(user);
  normalizeAuthProviders(user);
  normalizePushNotifications(user);
  normalizeUserAdminFields(user);
  normalizeForfeitDiscipline(user);
  return user;
}

function reconcileClubMemberships(now = Date.now()) {
  let changed = false;
  for (const club of clubs.values()) normalizeClub(club, now, rankedSeason);
  for (const user of users.values()) normalizeUserClub(user);

  const ownerlessClubs = [];
  for (const club of clubs.values()) {
    club.members = club.members.filter(member => users.has(member.userId));
    if (!club.members.length) {
      ownerlessClubs.push(club.clubId);
      continue;
    }
    if (!club.members.some(member => member.role === 'owner')) club.members[0].role = 'owner';
    for (const member of club.members) {
      const user = users.get(member.userId);
      if (user) user.clubId = club.clubId;
    }
  }
  for (const clubId of ownerlessClubs) clubs.delete(clubId);

  for (const user of users.values()) {
    if (!user.clubId) continue;
    const club = clubs.get(user.clubId);
    if (!club || !findClubMember(club, user.userId)) user.clubId = null;
  }
  for (const club of clubs.values()) {
    if (syncClubRewards(club, users, now).changed) changed = true;
  }
  return changed;
}

function normalizeAccountDeletionRequests(entries, now = Date.now()) {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter(entry => entry?.requestId && entry?.userId && entry?.codeHash)
    .map(entry => ({
      requestId: String(entry.requestId),
      userId: String(entry.userId),
      codeHash: String(entry.codeHash),
      createdAt: Number(entry.createdAt || now),
      expiresAt: Number(entry.expiresAt || now),
      attempts: Math.max(0, Math.trunc(Number(entry.attempts || 0))),
      usedAt: entry.usedAt ? Number(entry.usedAt) : null,
    }))
    .filter(entry => !entry.usedAt && entry.expiresAt > now);
}

function applyStoreState(parsed = {}) {
  users.clear();
  sessions.clear();
  results.splice(0, results.length);
  mailEntries.splice(0, mailEntries.length);
  accountDeletionRequests.splice(0, accountDeletionRequests.length);
  clubs.clear();
  normalizeCatalogStore(Object.assign(catalogStore, parsed.catalog || {}));
  seedCatalogStore(catalogStore);
  Object.assign(economyStore, normalizeEconomyConfigStore(parsed.economyConfig || {}));
  const storedAvailability = parsed.availabilityConfig || {};
  availabilityStore = normalizeAvailabilityStore(storedAvailability);
  if (storedAvailability?.entries?.leaderboards?.state !== 'hidden') {
    availabilityStore = publishAvailabilityChange(availabilityStore, {
      featureKey: 'leaderboards',
      entry: {
        state: 'hidden',
        title: 'Leaderboard retired',
        message: 'Update Nine Below to view the new Club Standings.',
      },
      actor: 'system',
      reason: 'Retire the LP leaderboard during the Club Standings migration.',
      now: Date.now(),
    }).store;
    storeMigrationPending = true;
  }
  afkConfigStore = normalizeAfkConfig(parsed.afkConfig || {});
  forfeitConfigStore = normalizeForfeitConfig(parsed.forfeitConfig || {});
  releasePolicyStore = normalizeReleasePolicyStore(parsed.releasePolicy || {});
  normalizeAdminStore(Object.assign(adminStore, {
    admins: parsed.admins || [],
    adminSessions: parsed.adminSessions || [],
    adminAudit: parsed.adminAudit || [],
    adminRecoveryRequests: parsed.adminRecoveryRequests || [],
    supportTickets: parsed.supportTickets || [],
    bans: parsed.bans || [],
    inviteCodes: parsed.inviteCodes || [],
    notificationConfig: parsed.notificationConfig || {},
  }));
  normalizeEarlyAccessStore(Object.assign(earlyAccessStore, {
    config: parsed.earlyAccessConfig || {},
    signups: parsed.earlyAccessSignups || [],
    campaigns: parsed.earlyAccessCampaigns || [],
    deliveries: parsed.earlyAccessDeliveries || [],
  }));
  normalizeCompetitiveConfigStore(Object.assign(competitiveStore, parsed.competitiveConfig || {}));
  rankedSeason = normalizeRankedSeason(parsed.rankedSeason, Date.now(), rankedConfig());
  for (const club of parsed.clubs || []) {
    const normalized = normalizeClub(club, Date.now(), rankedSeason);
    if (normalized.clubId) clubs.set(normalized.clubId, normalized);
  }
  for (const user of parsed.users || []) users.set(user.userId, normalizeUserRecord(user));
  for (const session of parsed.sessions || []) {
    if (session.expiresAt > Date.now()) {
      const token = normalizeCredentialVerifier(session.token, 'player-session');
      sessions.set(token, { ...session, token });
    }
  }
  results.push(...(parsed.results || []));
  mailEntries.push(...normalizeMailEntries(parsed.mailEntries || []));
  accountDeletionRequests.push(...normalizeAccountDeletionRequests(parsed.accountDeletionRequests || []));
  storeMigrationPending = reconcileClubMemberships() || storeMigrationPending;
}

function loadJsonStore() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    applyStoreState(JSON.parse(raw));
  } catch {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    applyStoreState({});
  }
}

function storeSnapshot() {
  normalizeCatalogStore(catalogStore);
  seedCatalogStore(catalogStore);
  Object.assign(economyStore, normalizeEconomyConfigStore(economyStore));
  normalizeCompetitiveConfigStore(competitiveStore);
  normalizeAdminStore(adminStore);
  rankedSeason = normalizeRankedSeason(rankedSeason, Date.now(), rankedConfig());
  reconcileClubMemberships();
  for (const user of users.values()) normalizeUserRecord(user);
  for (const club of clubs.values()) normalizeClub(club, Date.now(), rankedSeason);
  return {
    users: [...users.values()],
    sessions: [...sessions.values()],
    results,
    mailEntries: normalizeMailEntries(mailEntries),
    accountDeletionRequests: normalizeAccountDeletionRequests(accountDeletionRequests),
    rankedSeason,
    competitiveConfig: competitiveStore,
    economyConfig: economyStore,
    availabilityConfig: availabilityStore,
    afkConfig: afkConfigStore,
    forfeitConfig: forfeitConfigStore,
    releasePolicy: releasePolicyStore,
    catalog: catalogStore,
    clubs: [...clubs.values()],
    admins: adminStore.admins,
    adminSessions: adminStore.adminSessions,
    adminAudit: adminStore.adminAudit,
    adminRecoveryRequests: adminStore.adminRecoveryRequests,
    supportTickets: adminStore.supportTickets,
    bans: adminStore.bans,
    inviteCodes: adminStore.inviteCodes,
    notificationConfig: notificationConfig(),
    earlyAccessConfig: earlyAccessStore.config,
    earlyAccessSignups: earlyAccessStore.signups,
    earlyAccessCampaigns: earlyAccessStore.campaigns,
    earlyAccessDeliveries: earlyAccessStore.deliveries,
  };
}

async function loadStore() {
  if (postgresStore) {
    const state = await postgresStore.load();
    applyStoreState(state);
    return;
  }
  loadJsonStore();
}

function saveStore() {
  const snapshot = storeSnapshot();
  if (postgresStore) {
    postgresStore.scheduleSave(storeSnapshot);
    return;
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(snapshot, null, 2));
}

function seedLocalTestAccounts() {
  if (!shouldSeedDevTestAccounts(DATA_DIR, DEFAULT_DATA_DIR)) return;
  if (ensureDevTestAccounts(users, rankedSeason)) saveStore();
}

function seedAdminAccounts() {
  const changed = ensureBootstrapAdmin(adminStore) || seedDevelopmentAdmin(adminStore);
  if (changed) saveStore();
}

function makeCode() {
  let code = crypto.randomBytes(3).toString('hex').slice(0, 4).toUpperCase();
  while (rooms.has(code)) code = crypto.randomBytes(3).toString('hex').slice(0, 4).toUpperCase();
  return code;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const passwordHash = crypto.pbkdf2Sync(password, salt, 120_000, 32, 'sha256').toString('hex');
  return { salt, passwordHash };
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function timingSafeTextEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function passwordMatches(user, password) {
  if (!user?.salt || !user?.passwordHash || typeof password !== 'string') return false;
  const candidate = hashPassword(password, user.salt).passwordHash;
  return timingSafeTextEqual(candidate, user.passwordHash);
}

function anonymizedDeletedUserId(userId) {
  const clean = String(userId || '');
  if (clean.startsWith('deleted:')) return clean;
  return `deleted:${sha256(clean).slice(0, 24)}`;
}

function verifiedDeletionEmails(user) {
  normalizeAuthProviders(user);
  return [...new Set(
    Object.values(user.authProviders || {})
      .filter(link => link?.emailVerified && link?.email)
      .map(link => String(link.email).trim().toLowerCase())
      .filter(Boolean)
  )];
}

function findDeletionUser(displayName, email = '') {
  const cleanName = cleanPlayerNameCandidate(displayName).toLowerCase();
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanName) return null;
  return [...users.values()].find(user => {
    if (String(user.displayName || '').trim().toLowerCase() !== cleanName) return false;
    return !cleanEmail || verifiedDeletionEmails(user).includes(cleanEmail);
  }) || null;
}

function accountDeletionCodeHash(requestId, code) {
  return sha256(`${requestId}:${String(code || '').trim()}`);
}

async function verifyAccountDeletionCredential(user, body = {}) {
  const confirmation = String(body.confirmation || '').trim().toUpperCase();
  if (confirmation !== 'DELETE') return { error: 'Type DELETE to confirm account deletion.' };

  const method = String(body.method || '').trim().toLowerCase();
  if (method === 'password') {
    if (!passwordMatches(user, String(body.password || ''))) {
      return { error: 'Password verification failed.' };
    }
    return { method };
  }

  const provider = normalizeProvider(method);
  if (!provider) return { error: 'Choose a valid account verification method.' };
  normalizeAuthProviders(user);
  const linkedProvider = user.authProviders[provider];
  if (!linkedProvider) return { error: `${providerLabel(provider)} is not linked to this account.` };

  let profile;
  try {
    profile = await verifySocialProfile(provider, body);
  } catch (error) {
    return {
      error: error instanceof Error
        ? error.message
        : `${providerLabel(provider)} verification failed.`,
    };
  }
  if (profile.providerUserId !== linkedProvider.providerUserId) {
    return { error: `${providerLabel(provider)} verification did not match this account.` };
  }
  return { method: provider };
}

function anonymizeClubUserReferences(club, userId, deletedUserId) {
  removeUserFromClub(club, userId);
  if (Array.isArray(club.prestige?.history)) {
    club.prestige.history = club.prestige.history.map(item => (
      item?.purchasedBy === userId ? { ...item, purchasedBy: deletedUserId } : item
    ));
  }
  if (Array.isArray(club.treasury?.donations)) {
    club.treasury.donations = club.treasury.donations.map(item => (
      item?.userId === userId ? { ...item, userId: deletedUserId } : item
    ));
  }
  if (club.treasuryGoal?.createdBy === userId) club.treasuryGoal.createdBy = deletedUserId;
  if (Array.isArray(club.announcements)) {
    club.announcements = club.announcements.map(item => ({
      ...item,
      ...(item?.userId === userId ? { userId: deletedUserId, displayName: 'Deleted Player' } : {}),
      ...(item?.authorUserId === userId ? { authorUserId: deletedUserId, authorName: 'Deleted Player' } : {}),
    }));
  }
  const contributors = club.events?.active?.contributors;
  if (contributors && Object.prototype.hasOwnProperty.call(contributors, userId)) {
    contributors[deletedUserId] = (Number(contributors[deletedUserId]) || 0) + (Number(contributors[userId]) || 0);
    delete contributors[userId];
  }
  const memberClaims = club.rewards?.memberClaims;
  if (memberClaims && Object.prototype.hasOwnProperty.call(memberClaims, userId)) {
    memberClaims[deletedUserId] = [
      ...new Set([...(memberClaims[deletedUserId] || []), ...(memberClaims[userId] || [])]),
    ];
    delete memberClaims[userId];
  }
}

function anonymizeDeletedUserHistory(userId, deletedUserId) {
  for (const result of results) {
    result.players = (result.players || []).map(player => (
      player.userId === userId
        ? { ...player, userId: deletedUserId, displayName: 'Deleted Player' }
        : player
    ));
  }

  for (const ticket of adminStore.supportTickets || []) {
    if (ticket.userId !== userId) continue;
    ticket.userId = deletedUserId;
    ticket.displayName = 'Deleted Player';
    ticket.contactName = 'Deleted Player';
    ticket.contactEmail = '';
    ticket.deviceHash = '';
    ticket.publicAccessTokenHash = '';
    ticket.updatedAt = Date.now();
  }

  for (const ban of adminStore.bans || []) {
    if (ban.userId === userId) ban.userId = deletedUserId;
    if (ban.userId === deletedUserId) ban.deviceHash = '';
  }

  for (const invite of adminStore.inviteCodes || []) {
    invite.uses = (invite.uses || []).map(use => (
      use.userId === userId
        ? { ...use, userId: deletedUserId, displayName: 'Deleted Player' }
        : use
    ));
  }
}

function removeDeletedUserSocialReferences(userId) {
  for (const other of users.values()) {
    if (other.userId === userId) continue;
    normalizeSocial(other);
    other.social.friends = other.social.friends.filter(item => item.userId !== userId);
    other.social.incomingRequests = other.social.incomingRequests.filter(item => item.userId !== userId);
    other.social.outgoingRequests = other.social.outgoingRequests.filter(item => item.userId !== userId);
    other.social.roomInvites = other.social.roomInvites.filter(item => item.fromUserId !== userId);
  }
}

function removeDeletedUserRooms(userId) {
  const activeRoom = activePlayingRoomForUser(userId);
  if (activeRoom) {
    return {
      error: 'Finish your active match before deleting your account.',
      activeRoom: roomSummary(activeRoom),
    };
  }
  for (const [code, room] of rooms) {
    if (!(room.players || []).some(player => player.userId === userId)) continue;
    cancelRoomCountdown(room);
    cancelAllAutoplaySchedules(room);
    refundWaitingRoom(room);
    io.to(code).emit('room:cancelled', {
      error: 'This table closed because a player deleted their account.',
      code: 'ACCOUNT_DELETED',
    });
    rooms.delete(code);
  }
  return { ok: true };
}

function disconnectDeletedUser(userId) {
  io.to(`user:${userId}`).emit('account:deleted', { ok: true });
  for (const socketId of userSockets.get(userId) || []) {
    io.sockets.sockets.get(socketId)?.disconnect(true);
  }
  userSockets.delete(userId);
  clubForegroundSockets.delete(userId);
}

function deletePlayerAccount(user, req, source = 'authenticated') {
  const userId = user.userId;
  const deletedUserId = anonymizedDeletedUserId(userId);
  const roomCleanup = removeDeletedUserRooms(userId);
  if (roomCleanup.error) return roomCleanup;

  normalizePushNotifications(user);
  user.pushNotifications.tokens = [];
  revokeUserSessions(userId);
  rankedQueue.delete(userId);
  removeDeletedUserSocialReferences(userId);
  for (const club of clubs.values()) anonymizeClubUserReferences(club, userId, deletedUserId);
  reconcileClubMemberships();
  anonymizeDeletedUserHistory(userId, deletedUserId);

  for (let index = mailEntries.length - 1; index >= 0; index -= 1) {
    if (mailEntries[index]?.userId === userId) mailEntries.splice(index, 1);
  }
  for (let index = accountDeletionRequests.length - 1; index >= 0; index -= 1) {
    if (accountDeletionRequests[index]?.userId === userId) accountDeletionRequests.splice(index, 1);
  }

  users.delete(userId);
  writeAudit(
    adminStore,
    req,
    null,
    'auth.account.deleted',
    { userId: deletedUserId },
    { source }
  );
  disconnectDeletedUser(userId);
  saveStore();
  return { ok: true };
}

const PLAYER_NAME_MIN_LENGTH = 2;
const PLAYER_NAME_MAX_LENGTH = 12;
const PLAYER_NAME_PATTERN = /^[A-Za-z0-9_-]+$/;

function cleanPlayerNameCandidate(value) {
  return String(value || '').trim();
}

function validateNewDisplayName(displayName, existingUserId = null) {
  const clean = cleanPlayerNameCandidate(displayName);
  if (clean.length < PLAYER_NAME_MIN_LENGTH) return { error: `Display name must be at least ${PLAYER_NAME_MIN_LENGTH} characters.` };
  if (clean.length > PLAYER_NAME_MAX_LENGTH) return { error: `Display name must be ${PLAYER_NAME_MAX_LENGTH} characters or fewer.` };
  if (!PLAYER_NAME_PATTERN.test(clean)) return { error: 'Display name can only use letters, numbers, dashes, and underscores.' };
  const duplicate = [...users.values()].find(user => user.userId !== existingUserId && user.displayName.toLowerCase() === clean.toLowerCase());
  if (duplicate) return { error: 'Display name is already taken.' };
  return { displayName: clean };
}

function suggestedSocialDisplayName(profile) {
  const base = String(profile.displayName || profile.email?.split('@')[0] || `${providerLabel(profile.provider)} Player`)
    .replace(/\s+/g, '')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .trim()
    .slice(0, PLAYER_NAME_MAX_LENGTH);
  return base.length >= PLAYER_NAME_MIN_LENGTH ? base : `${providerLabel(profile.provider)}Player`.slice(0, PLAYER_NAME_MAX_LENGTH);
}

function findUserByProvider(provider, providerUserId) {
  for (const user of users.values()) {
    normalizeAuthProviders(user);
    if (user.authProviders[provider]?.providerUserId === providerUserId) return user;
  }
  return null;
}

function socialLinkFromProfile(profile, now = Date.now()) {
  return {
    provider: profile.provider,
    providerUserId: profile.providerUserId,
    email: String(profile.email || '').trim().toLowerCase(),
    emailVerified: !!profile.emailVerified,
    displayName: String(profile.displayName || '').trim(),
    linkedAt: now,
    lastLoginAt: now,
  };
}

function mockSocialProfile(provider, body = {}) {
  if (!SOCIAL_AUTH_TEST_MODE) return null;
  const token = String(provider === 'google' ? body.idToken : body.accessToken || '').trim();
  if (!token.startsWith(`mock:${provider}:`)) throw new Error(`${providerLabel(provider)} test token is invalid.`);
  const [, , providerUserId, email = '', ...nameParts] = token.split(':');
  const displayName = String(body.mockProfile?.displayName || nameParts.join(' ') || providerLabel(provider)).trim();
  return {
    provider,
    providerUserId: String(body.mockProfile?.providerUserId || providerUserId || '').trim(),
    email: String(body.mockProfile?.email || email || '').trim().toLowerCase(),
    emailVerified: true,
    displayName,
  };
}

async function verifyGoogleProfile(body = {}) {
  const mock = mockSocialProfile('google', body);
  if (mock) return mock;
  if (!GOOGLE_CLIENT_IDS.length) throw new Error('Google login is not configured.');
  const idToken = String(body.idToken || '').trim();
  if (!idToken) throw new Error('Google login token is missing.');
  const ticket = await googleOAuthClient.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_IDS });
  const payload = ticket.getPayload();
  if (!payload?.sub) throw new Error('Google login token is invalid.');
  return {
    provider: 'google',
    providerUserId: String(payload.sub),
    email: String(payload.email || '').trim().toLowerCase(),
    emailVerified: !!payload.email_verified,
    displayName: String(payload.name || payload.given_name || '').trim(),
  };
}

async function verifyFacebookProfile(body = {}) {
  const mock = mockSocialProfile('facebook', body);
  if (mock) return mock;
  if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) throw new Error('Facebook login is not configured.');
  const accessToken = String(body.accessToken || '').trim();
  if (!accessToken) throw new Error('Facebook login token is missing.');
  const appToken = `${FACEBOOK_APP_ID}|${FACEBOOK_APP_SECRET}`;
  const debugUrl = new URL('https://graph.facebook.com/debug_token');
  debugUrl.searchParams.set('input_token', accessToken);
  debugUrl.searchParams.set('access_token', appToken);
  const debugRes = await fetch(debugUrl);
  const debug = await debugRes.json().catch(() => ({}));
  const data = debug.data || {};
  if (!debugRes.ok || !data.is_valid || String(data.app_id || '') !== FACEBOOK_APP_ID || !data.user_id) {
    throw new Error('Facebook login token is invalid.');
  }
  const profileUrl = new URL('https://graph.facebook.com/me');
  profileUrl.searchParams.set('fields', 'id,name,email');
  profileUrl.searchParams.set('access_token', accessToken);
  const profileRes = await fetch(profileUrl);
  const profile = await profileRes.json().catch(() => ({}));
  if (!profileRes.ok || String(profile.id || '') !== String(data.user_id)) throw new Error('Facebook profile lookup failed.');
  return {
    provider: 'facebook',
    providerUserId: String(profile.id),
    email: String(profile.email || '').trim().toLowerCase(),
    emailVerified: !!profile.email,
    displayName: String(profile.name || '').trim(),
  };
}

async function verifySocialProfile(provider, body = {}) {
  if (!socialProviderEnabled(provider)) throw new Error(`${providerLabel(provider)} login is not configured.`);
  return provider === 'google' ? verifyGoogleProfile(body) : verifyFacebookProfile(body);
}

function createSocialUser(profile, displayName) {
  const now = Date.now();
  const userId = crypto.randomUUID();
  const user = normalizeUserProgression({
    userId,
    displayName,
    salt: '',
    passwordHash: '',
    authProviders: { [profile.provider]: socialLinkFromProfile(profile, now) },
    stats: { gamesPlayed: 0, wins: 0 },
  }, now, rankedSeason, rankedConfig());
  normalizeAuthProviders(user);
  return user;
}

function publicClubForUser(user) {
  const club = user?.clubId ? clubs.get(user.clubId) : null;
  return club ? publicClubSummary(club, user.userId) : null;
}

function safeUser(user) {
  return {
    ...publicUserProfile(user, rankedSeason, rankedConfig()),
    club: publicClubForUser(user),
    authProviders: publicAuthProviders(user),
    passwordSignIn: !!(user.passwordHash && user.salt),
    forfeitStatus: publicForfeitStatus(user, rankedSeason, forfeitConfigStore),
  };
}

function totalXpForLevelStart(level) {
  const targetLevel = Math.max(1, Math.min(500, Math.trunc(Number(level) || 1)));
  let totalXp = 0;
  for (let currentLevel = 1; currentLevel < targetLevel; currentLevel += 1) {
    totalXp += xpNeededForLevel(currentLevel);
  }
  return totalXp;
}

function currentCatalog() {
  return liveCatalog(catalogStore);
}

function cosmeticsFor(user) {
  return publicCosmeticCatalog(user, rankedSeason, currentCatalog(), rankedConfig());
}

function adminPlayerDetail(user) {
  const detail = adminUserDetail(
    user,
    rankedSeason,
    results,
    adminCosmeticCatalogFor(user, rankedSeason, currentCatalog(), rankedConfig()),
    publicEconomyCatalog(user, economyConfig()),
    rankedConfig()
  );
  const discipline = normalizeForfeitDiscipline(user);
  return {
    ...detail,
    forfeitDiscipline: {
      ...publicForfeitStatus(user, rankedSeason, forfeitConfigStore),
      events: discipline.events,
      updatedAt: discipline.updatedAt,
    },
  };
}

function adminClubDetail(club) {
  normalizeClub(club, Date.now(), rankedSeason);
  const owner = club.members.find(member => member.role === 'owner');
  return {
    ...publicClubProfile(club, users, owner?.userId || null, rankedSeason),
    adminStatus: club.adminStatus || { frozenAt: null, frozenReason: '', disbandedAt: null },
    joinRequests: club.joinRequests.map(request => {
      const user = users.get(request.userId);
      return {
        id: request.id,
        userId: request.userId,
        displayName: user?.displayName || 'Unknown Player',
        createdAt: request.createdAt,
        message: request.message || '',
      };
    }),
    invites: club.invites.map(invite => {
      const user = users.get(invite.userId);
      return {
        id: invite.id,
        userId: invite.userId,
        displayName: user?.displayName || 'Unknown Player',
        createdAt: invite.createdAt,
        message: invite.message || '',
      };
    }),
    processedResultCount: club.processedResultIds.length,
  };
}

function adminClubSummaries(query = '') {
  const needle = String(query || '').trim().toLowerCase();
  return [...clubs.values()]
    .filter(club => !needle || club.name.toLowerCase().includes(needle) || club.tag.toLowerCase().includes(needle) || club.clubId.toLowerCase().includes(needle))
    .slice(0, 100)
    .map(club => {
      normalizeClub(club, Date.now(), rankedSeason);
      const owner = club.members.find(member => member.role === 'owner');
      return {
        ...publicClubSummary(club, null, Date.now(), rankedSeason),
        ownerUserId: owner?.userId || null,
        ownerName: owner ? users.get(owner.userId)?.displayName || 'Unknown Player' : 'No owner',
        requestCount: club.joinRequests.length,
        eventScore: club.events?.active?.score || 0,
        adminStatus: club.adminStatus || { frozenAt: null, frozenReason: '', disbandedAt: null },
      };
    });
}

function adminCompetitiveOverview() {
  const config = rankedConfig();
  const rankedUsers = [...users.values()];
  const ladders = {};
  const recentMovement = [];
  for (const playerCount of [2, 3, 4]) {
    const leagueDistribution = {};
    let totalMmr = 0;
    let participants = 0;
    let placements = 0;
    let calibration = 0;
    let established = 0;
    for (const user of rankedUsers) {
      const record = normalizeCompetitiveState(user, rankedSeason, config, playerCount);
      const hasParticipated = record.rankedGames > 0 || record.placementsPlayed > 0;
      if (!hasParticipated) continue;
      const league = record.placementComplete ? record.league.name : 'Unranked';
      leagueDistribution[league] = (leagueDistribution[league] || 0) + 1;
      totalMmr += Number(record.mmr || 0);
      participants += 1;
      if (record.confidenceStage === 'placement') placements += 1;
      if (record.confidenceStage === 'calibration') calibration += 1;
      if (record.confidenceStage === 'established') established += 1;
      for (const history of record.matchHistory || []) {
        if (!history?.leagueBefore || !history?.leagueAfter || history.leagueBefore.name === history.leagueAfter.name) continue;
        recentMovement.push({
          userId: user.userId,
          displayName: user.displayName,
          playerCount,
          completedAt: history.completedAt,
          from: history.leagueBefore.name,
          to: history.leagueAfter.name,
          delta: history.delta,
        });
      }
    }
    ladders[String(playerCount)] = {
      playerCount,
      participants,
      averageMmr: participants ? Math.round(totalMmr / participants) : 0,
      leagueDistribution,
      confidence: { placements, calibration, established },
    };
  }
  const activeRankedRooms = [...rooms.values()].filter(room => room.matchType === 'ranked' && !room.game?.completed);
  return {
    season: rankedSeason,
    config,
    rankedPlayers: new Set(rankedUsers
      .filter(user => [2, 3, 4].some(count => normalizeCompetitiveState(user, rankedSeason, config, count).rankedGames > 0))
      .map(user => user.userId)).size,
    totalPlayers: rankedUsers.length,
    activeQueues: rankedQueue.size,
    activeRankedRooms: activeRankedRooms.length,
    ladders,
    recentMovement: recentMovement.sort((a, b) => b.completedAt - a.completedAt).slice(0, 20),
  };
}

function adminRankedQueues() {
  const now = Date.now();
  return {
    queues: [...rankedQueue.values()].map(entry => ({
      ...entry,
      waitMs: now - entry.joinedAt,
      searchRange: matchmakingRangeFor(entry.joinedAt, now, rankedConfig()),
    })),
    rooms: [...rooms.values()]
      .filter(room => room.matchType === 'ranked' && !room.game?.completed)
      .map(roomSummary),
  };
}

function normalizeAdminCompetitiveAdjustment(user, body = {}) {
  const config = rankedConfig();
  const playerCount = normalizeRankedPlayerCount(body.playerCount || body.maxPlayers || 2);
  const competitive = normalizeCompetitiveState(user, rankedSeason, config, playerCount);
  const before = { ...competitive, league: competitive.league, seasonBestLeague: competitive.seasonBestLeague };
  const patch = {};
  if (body.mmr !== undefined) patch.mmr = Math.max(0, Math.floor(Number(body.mmr) || 0));
  if (body.seasonBestMmr !== undefined) patch.seasonBestMmr = Math.max(0, Math.floor(Number(body.seasonBestMmr) || 0));
  if (body.careerBestMmr !== undefined) patch.careerBestMmr = Math.max(0, Math.floor(Number(body.careerBestMmr) || 0));
  if (body.placementsPlayed !== undefined) patch.placementsPlayed = Math.max(0, Math.floor(Number(body.placementsPlayed) || 0));
  if (body.calibrationMatchesPlayed !== undefined) patch.calibrationMatchesPlayed = Math.max(0, Math.floor(Number(body.calibrationMatchesPlayed) || 0));
  if (body.rankedGames !== undefined) patch.rankedGames = Math.max(0, Math.floor(Number(body.rankedGames) || 0));
  if (body.wins !== undefined) patch.wins = Math.max(0, Math.floor(Number(body.wins) || 0));
  if (body.losses !== undefined) patch.losses = Math.max(0, Math.floor(Number(body.losses) || 0));
  if (Array.isArray(body.claimedSeasonRewards)) patch.claimedSeasonRewards = body.claimedSeasonRewards.map(String).filter(Boolean);
  const next = { ...competitive, ...patch, playerCount };
  next.placementsPlayed = Math.min(next.placementsPlayed, next.placementMatchesRequired);
  next.placementComplete = next.placementsPlayed >= next.placementMatchesRequired;
  next.hasCompletedInitialPlacement = next.hasCompletedInitialPlacement || next.placementComplete;
  next.calibrationMatchesPlayed = Math.min(next.calibrationMatchesPlayed, next.calibrationMatchesRequired);
  next.confidenceStage = !next.placementComplete
    ? 'placement'
    : next.calibrationMatchesPlayed < next.calibrationMatchesRequired ? 'calibration' : 'established';
  next.seasonBestMmr = Math.max(next.mmr, next.seasonBestMmr);
  next.careerBestMmr = Math.max(next.mmr, next.seasonBestMmr, next.careerBestMmr || 0);
  next.league = leagueForMmr(next.mmr, config);
  next.seasonBestLeague = leagueForMmr(next.seasonBestMmr, config);
  next.careerBestLeague = leagueForMmr(next.careerBestMmr, config);
  if (body.clearHistory) next.matchHistory = [];
  next.matchHistory = [{
    matchId: `admin-${crypto.randomUUID()}`,
    completedAt: Date.now(),
    roomCode: null,
    playerCount,
    total: 0,
    placement: 0,
    mmrBefore: before.mmr,
    mmrAfter: next.mmr,
    delta: next.mmr - before.mmr,
    leagueBefore: before.league,
    leagueAfter: next.league,
    adminAdjustment: true,
  }, ...(next.matchHistory || [])].slice(0, 25);
  user.competitiveByPlayers[String(playerCount)] = next;
  user.competitive = user.competitiveByPlayers['2'];
  return { before, after: next };
}

function requireClubAdminReason(req, res) {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) {
    res.status(400).json({ error: 'Reason is required.' });
    return null;
  }
  return reason;
}

function frozenClubResponse(club, res) {
  if (!club?.adminStatus?.frozenAt) return false;
  res.status(423).json({ error: 'This club is temporarily frozen by Nine Below support.' });
  return true;
}

function isFriend(user, targetUserId) {
  normalizeSocial(user);
  return user.social.friends.some(friend => friend.userId === targetUserId);
}

function relationshipBetween(viewer, target) {
  if (!viewer || !target) return 'none';
  if (viewer.userId === target.userId) return 'self';
  normalizeSocial(viewer);
  if (isFriend(viewer, target.userId)) return 'friend';
  if (viewer.social.outgoingRequests.some(request => request.userId === target.userId)) return 'outgoing';
  if (viewer.social.incomingRequests.some(request => request.userId === target.userId)) return 'incoming';
  return 'none';
}

function activeRoomForUser(userId) {
  return [...rooms.values()].find(room =>
    (room.status === 'lobby' || room.status === 'playing')
    && !room.game?.completed
    && room.players.some(player => player.userId === userId)
    && !room.forfeits?.has(userId)
  ) || null;
}

function activePlayingRoomForUser(userId) {
  return [...rooms.values()].find(room =>
    room.status === 'playing'
    && room.game
    && !room.game.completed
    && room.players.some(player => player.userId === userId)
    && !room.forfeits?.has(userId)
  ) || null;
}

function pendingForfeitedRoomForUser(userId) {
  return [...rooms.values()].find(room => (
    room.status === 'playing'
    && room.game
    && !room.game.completed
    && room.forfeits?.has(userId)
  )) || null;
}

function refreshActivePlayingRoomForUser(userId) {
  let room = activePlayingRoomForUser(userId);
  if (!room) return null;
  const gameChanged = resolveRoomExpiredTimers(room);
  if (gameChanged) {
    recordCompletedGame(room);
    room.updatedAt = Date.now();
    broadcastRoom(room);
  }
  room = activePlayingRoomForUser(userId);
  return room || null;
}

function activeRoomPayloadForUser(userId) {
  const room = refreshActivePlayingRoomForUser(userId);
  if (!room) return { active: false, mustRejoin: false, room: null, game: null };
  return {
    active: true,
    mustRejoin: true,
    room: roomSummary(room),
    game: gameViewFor(room, userId),
  };
}

function activeMatchConflictForUser(userId) {
  const pendingForfeit = pendingForfeitedRoomForUser(userId);
  if (pendingForfeit) {
    const gameChanged = resolveRoomExpiredTimers(pendingForfeit);
    if (gameChanged) {
      recordCompletedGame(pendingForfeit);
      pendingForfeit.updatedAt = Date.now();
      broadcastRoom(pendingForfeit);
    }
    if (!pendingForfeit.game.completed) {
      return {
        error: 'Your forfeited match is still finishing. Online matchmaking unlocks when that match ends.',
        pendingForfeit: true,
      };
    }
  }
  const room = refreshActivePlayingRoomForUser(userId);
  if (!room) return null;
  return {
    error: 'Finish your active match before joining another table.',
    activeRoom: roomSummary(room),
  };
}

function blockActiveMatch(req, res) {
  const conflict = activeMatchConflictForUser(req.auth.user.userId);
  if (!conflict) return false;
  res.status(409).json(conflict);
  return true;
}

function blockRankedForfeitRestriction(req, res) {
  const status = publicForfeitStatus(req.auth.user, rankedSeason, forfeitConfigStore);
  if (!status.ranked.restricted) return false;
  const until = new Date(status.ranked.lockedUntil).toISOString();
  res.status(423).json({
    error: `Ranked matchmaking is restricted until ${until} because of repeated forfeits.`,
    forfeitStatus: status,
  });
  return true;
}

function userStatus(userId) {
  const activeSockets = userSockets.get(userId);
  const room = activeRoomForUser(userId);
  return {
    online: !!activeSockets?.size,
    inRoom: !!room,
    roomCode: room?.code ?? null,
    roomStatus: room?.status ?? null,
    matchType: room?.matchType ?? null,
  };
}

function publicPlayerCard(viewer, target, extra = {}) {
  const profile = safeUser(target);
  return {
    userId: profile.userId,
    displayName: profile.displayName,
    avatarInitial: profile.avatarInitial,
    level: profile.progression.level,
    stats: profile.stats,
    statistics: {
      gamesPlayed: profile.statistics.gamesPlayed,
      wins: profile.statistics.wins,
      bestTotal: profile.statistics.bestTotal,
      bestRound: profile.statistics.bestRound,
      columnClears: profile.statistics.columnClears,
    },
    competitive: {
      league: profile.competitive.league,
      rankedGames: profile.competitive.rankedGames,
      wins: profile.competitive.wins,
    },
    competitiveByPlayers: publicCompetitiveByPlayersRankOnly(profile.competitiveByPlayers),
    displayRankEmblem: profile.displayRankEmblem,
    cosmetics: sharedPlayerCosmetics(profile.inventory.equipped),
    club: profile.club,
    relationship: relationshipBetween(viewer, target),
    status: userStatus(target.userId),
    ...extra,
  };
}

function publicRecentMatches(userId, limit = 5) {
  return results
    .filter(result => result.players.some(player => player.userId === userId))
    .slice()
    .reverse()
    .slice(0, limit)
    .map(result => {
      const player = result.players.find(item => item.userId === userId);
      return {
        resultId: result.resultId,
        completedAt: result.completedAt,
        matchType: result.matchType || result.mode || 'casual',
        total: player?.total ?? 0,
        won: !!player?.won,
        playerCount: result.players.length,
      };
    });
}

function publicViewedProfile(viewer, target) {
  const profile = safeUser(target);
  const unlockedAchievements = profile.achievements
    .filter(item => item.unlockedAt)
    .slice()
    .sort((a, b) => (b.unlockedAt || 0) - (a.unlockedAt || 0));
  return {
    userId: profile.userId,
    displayName: profile.displayName,
    avatarInitial: profile.avatarInitial,
    progression: profile.progression,
    stats: profile.stats,
    statistics: profile.statistics,
    achievements: unlockedAchievements,
    competitive: publicCompetitiveRankOnly(profile.competitive),
    competitiveByPlayers: publicCompetitiveByPlayersRankOnly(profile.competitiveByPlayers),
    displayRankEmblem: profile.displayRankEmblem,
    cosmetics: sharedPlayerCosmetics(profile.inventory.equipped),
    club: profile.club,
    relationship: relationshipBetween(viewer, target),
    status: userStatus(target.userId),
    recentMatches: publicRecentMatches(target.userId),
  };
}

function publicRequest(viewer, request, direction) {
  const target = users.get(request.userId);
  if (!visiblePlayer(target)) return null;
  return {
    id: request.id,
    createdAt: request.createdAt,
    direction,
    player: publicPlayerCard(viewer, target),
  };
}

function pruneRoomInvites(user, now = Date.now()) {
  normalizeSocial(user);
  const before = user.social.roomInvites.length;
  user.social.roomInvites = user.social.roomInvites.filter(invite => {
    const room = rooms.get(invite.roomCode);
    return invite.expiresAt > now && room && room.status === 'lobby' && room.players.length < room.maxPlayers;
  });
  return before !== user.social.roomInvites.length;
}

function publicRoomInvite(viewer, invite) {
  const room = rooms.get(invite.roomCode);
  const from = users.get(invite.fromUserId);
  if (!room || !visiblePlayer(from)) return null;
  return {
    id: invite.id,
    roomCode: invite.roomCode,
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt,
    from: publicPlayerCard(viewer, from),
    room: roomSummary(room),
  };
}

function recentPlayersFor(user) {
  const seen = new Map();
  for (const result of results.slice().reverse()) {
    const current = result.players.find(player => player.userId === user.userId);
    if (!current) continue;
    for (const player of result.players) {
      if (player.userId === user.userId || !visiblePlayer(users.get(player.userId)) || seen.has(player.userId)) continue;
      seen.set(player.userId, {
        completedAt: result.completedAt,
        matchType: result.matchType || result.mode || 'casual',
        opponentTotal: player.total,
        yourTotal: current.total,
        youWon: !!current.won,
      });
    }
    if (seen.size >= SOCIAL_RECENT_LIMIT) break;
  }
  return [...seen.entries()].map(([userId, meta]) => {
    const target = users.get(userId);
    return target ? publicPlayerCard(user, target, { recent: meta }) : null;
  }).filter(Boolean);
}

function socialSummary(user) {
  normalizeSocial(user);
  const changed = pruneRoomInvites(user);
  if (changed) saveStore();
  return {
    friends: user.social.friends
      .map(friend => {
        const target = users.get(friend.userId);
        return visiblePlayer(target) ? publicPlayerCard(user, target, { since: friend.since }) : null;
      })
      .filter(Boolean),
    incomingRequests: user.social.incomingRequests.map(request => publicRequest(user, request, 'incoming')).filter(Boolean),
    outgoingRequests: user.social.outgoingRequests.map(request => publicRequest(user, request, 'outgoing')).filter(Boolean),
    roomInvites: user.social.roomInvites.map(invite => publicRoomInvite(user, invite)).filter(Boolean),
    recentPlayers: recentPlayersFor(user),
  };
}

function emitSocialUpdate(userId) {
  const user = users.get(userId);
  if (!user) return;
  io.to(`user:${userId}`).emit('social:update', socialSummary(user));
}

function clubSocketRoom(clubId) {
  return `club:${clubId}`;
}

function emitClubPresence(clubId) {
  const club = clubs.get(clubId);
  if (!club) return;
  const online = onlineClubUserIds();
  const onlineUserIds = club.members.map(member => member.userId).filter(userId => online.has(userId));
  io.to(clubSocketRoom(clubId)).emit('club:presence', {
    clubId,
    onlineUserIds,
    onlineMemberCount: onlineUserIds.length,
  });
}

function emitClubUpdate(clubId) {
  const club = clubs.get(clubId);
  if (!club) return;
  if (syncClubRewards(club, users, Date.now()).changed) saveStore();
  for (const member of club.members || []) {
    io.to(`user:${member.userId}`).emit('club:update', {
      clubId,
      club: publicClubProfile(club, users, member.userId, rankedSeason),
    });
    emitSocialUpdate(member.userId);
  }
  emitClubPresence(clubId);
}

function userClubApplications(userId) {
  return [...clubs.values()]
    .flatMap(club => (club.joinRequests || [])
      .filter(request => request.userId === userId)
      .map(request => ({
        id: request.id,
        club: publicClubSummary(club, userId),
        createdAt: request.createdAt,
        message: request.message || '',
      })));
}

function userClubInvitations(userId) {
  return [...clubs.values()]
    .flatMap(club => (club.invites || [])
      .filter(invite => invite.userId === userId)
      .map(invite => ({
        id: invite.id,
        club: publicClubSummary(club, userId),
        createdAt: invite.createdAt,
        fromUserId: invite.fromUserId || null,
        fromDisplayName: users.get(invite.fromUserId)?.displayName || 'Club officer',
      })));
}

function clubById(clubId) {
  return clubs.get(String(clubId || ''));
}

function currentClubRole(user, club) {
  return findClubMember(club, user.userId)?.role || null;
}

function clubAccessError(user, action = 'join') {
  normalizeUserRecord(user);
  const config = clubConfig();
  const requiredLevel = action === 'create' ? config.minCreateLevel : config.minJoinLevel;
  const level = Number(user.progression?.level || 1);
  if (level < requiredLevel) {
    return {
      status: 403,
      error: action === 'create'
        ? `Reach Level ${requiredLevel} before creating a club.`
        : `Reach Level ${requiredLevel} before joining clubs.`,
      requiredLevel,
      level,
    };
  }
  return null;
}

function clubNameOrTagTaken(name, tag, exceptClubId = null) {
  const normalizedName = String(name || '').trim().toLowerCase();
  const normalizedTag = normalizeClubTag(tag);
  return [...clubs.values()].some(club =>
    club.clubId !== exceptClubId
    && (club.name.toLowerCase() === normalizedName || club.tag === normalizedTag)
  );
}

function removeUserFromClub(club, userId) {
  club.members = club.members.filter(member => member.userId !== userId);
  club.joinRequests = club.joinRequests.filter(request => request.userId !== userId);
  club.invites = club.invites.filter(invite => invite.userId !== userId);
  const user = users.get(userId);
  if (user?.clubId === club.clubId) user.clubId = null;
}

function removeRequestsBetween(one, two) {
  normalizeSocial(one);
  normalizeSocial(two);
  one.social.incomingRequests = one.social.incomingRequests.filter(request => request.userId !== two.userId);
  one.social.outgoingRequests = one.social.outgoingRequests.filter(request => request.userId !== two.userId);
  two.social.incomingRequests = two.social.incomingRequests.filter(request => request.userId !== one.userId);
  two.social.outgoingRequests = two.social.outgoingRequests.filter(request => request.userId !== one.userId);
}

function addFriendship(one, two, now = Date.now()) {
  normalizeSocial(one);
  normalizeSocial(two);
  if (!isFriend(one, two.userId)) one.social.friends.push({ userId: two.userId, since: now });
  if (!isFriend(two, one.userId)) two.social.friends.push({ userId: one.userId, since: now });
  removeRequestsBetween(one, two);
}

function removeFriendship(one, two) {
  normalizeSocial(one);
  normalizeSocial(two);
  one.social.friends = one.social.friends.filter(friend => friend.userId !== two.userId);
  two.social.friends = two.social.friends.filter(friend => friend.userId !== one.userId);
}

function findUserByIdentifier(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  return users.get(raw)
    || [...users.values()].find(user => user.displayName.toLowerCase() === raw.toLowerCase())
    || null;
}

function publicChatHistory(room) {
  return [...(room.chat || [])];
}

function normalizeChatForFilter(text) {
  const mapped = text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[0]/g, 'o')
    .replace(/[1!|]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[4@]/g, 'a')
    .replace(/[5$]/g, 's')
    .replace(/[7+]/g, 't')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return mapped ? mapped.split(/\s+/).map(token => token.replace(/(.)\1{2,}/g, '$1')) : [];
}

function chatTextIsBlocked(text) {
  const tokens = normalizeChatForFilter(text);
  if (!tokens.length) return false;
  for (let start = 0; start < tokens.length; start += 1) {
    let joined = '';
    for (let end = start; end < Math.min(tokens.length, start + 8); end += 1) {
      joined += tokens[end];
      if (CHAT_BLOCKED_TERMS.has(joined)) return true;
    }
  }
  return tokens.some(token => CHAT_BLOCKED_TERMS.has(token));
}

function cleanChatText(raw) {
  const text = String(raw || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return { error: 'Message is empty.' };
  if (text.length > CHAT_MESSAGE_MAX_LENGTH) return { error: `Message must be ${CHAT_MESSAGE_MAX_LENGTH} characters or fewer.` };
  if (chatTextIsBlocked(text)) return { error: 'Message blocked by chat filter.' };
  return { text };
}

function cleanChatPayload(type, rawText) {
  const kind = type === 'emoji' ? 'emoji' : type === 'preset' ? 'preset' : type === 'sticker' ? 'sticker' : type === 'gift' ? 'gift' : 'text';
  let cleaned;
  if (kind === 'emoji') {
    const text = String(rawText || '').trim();
    if (!CHAT_EMOJIS.includes(text)) return { error: 'Unknown reaction.' };
    cleaned = { text };
  } else if (kind === 'sticker') {
    const text = String(rawText || '').trim();
    if (!CHAT_STICKERS.includes(text)) return { error: 'Unknown sticker.' };
    cleaned = { text };
  } else if (kind === 'gift') {
    const gift = CHAT_GIFTS.find(item => item.id === String(rawText || '').trim());
    if (!gift) return { error: 'Unknown gift.' };
    cleaned = { text: gift.label, giftId: gift.id, giftIcon: gift.icon, giftPrice: gift.price };
  } else if (kind === 'preset') {
    const text = String(rawText || '').trim();
    if (!CHAT_PRESETS.includes(text)) return { error: 'Unknown quick chat.' };
    cleaned = cleanChatText(text);
  } else {
    cleaned = cleanChatText(rawText);
  }
  if (cleaned.error) return { error: cleaned.error };
  return { kind, text: cleaned.text, giftId: cleaned.giftId || null, giftIcon: cleaned.giftIcon || null, giftPrice: Number(cleaned.giftPrice || 0) };
}

function makeChatMessage(room, userId, type, rawText, targetUserId = null) {
  const player = room.players.find(item => item.userId === userId);
  if (!player) return { error: 'You are not a member of this room.' };
  const cleaned = cleanChatPayload(type, rawText);
  if (cleaned.error) return { error: cleaned.error };
  let target = null;
  if (cleaned.kind === 'gift') {
    target = room.players.find(item => item.userId === String(targetUserId || ''));
    if (!target) return { error: 'Gift target not found.' };
    if (target.userId === userId) return { error: 'Choose another player for gifts.' };
    const sender = users.get(userId);
    if (!sender) return { error: 'Gift sender not found.' };
    normalizeUserProgression(sender, Date.now(), rankedSeason, rankedConfig());
    if (sender.currency.coins < cleaned.giftPrice) return { error: `You need ${cleaned.giftPrice} coins to send this gift.` };
    sender.currency.coins -= cleaned.giftPrice;
  }
  return {
    message: {
      id: crypto.randomUUID(),
      userId,
      displayName: player.displayName,
      avatarInitial: player.avatarInitial,
      type: cleaned.kind,
      text: cleaned.text,
      giftId: cleaned.giftId || undefined,
      giftIcon: cleaned.giftIcon || undefined,
      giftPrice: cleaned.giftPrice || undefined,
      targetUserId: target?.userId,
      targetDisplayName: target?.displayName,
      createdAt: Date.now(),
    },
  };
}

function makeClubChatMessage(club, user, type, rawText) {
  if (!findClubMember(club, user.userId)) return { error: 'You are not a member of this club.' };
  const cleaned = cleanChatPayload(type, rawText);
  if (cleaned.error) return { error: cleaned.error };
  if (cleaned.kind === 'gift') return { error: 'Gifts are only available at tables.' };
  return {
    message: {
      id: crypto.randomUUID(),
      clubId: club.clubId,
      userId: user.userId,
      displayName: user.displayName,
      avatarInitial: user.displayName.trim().slice(0, 1).toUpperCase(),
      type: cleaned.kind,
      text: cleaned.text,
      createdAt: Date.now(),
    },
  };
}

function addChatMessage(room, message) {
  room.chat ||= [];
  room.chat.push(message);
  if (room.chat.length > CHAT_HISTORY_LIMIT) room.chat.splice(0, room.chat.length - CHAT_HISTORY_LIMIT);
}

function emitProgressionCelebrations(room, userId, displayName, avatarInitial, progression) {
  const items = [
    ...(progression?.achievementsUnlocked || []).map(item => `Unlocked: ${item.name}`),
    ...(progression?.challengesCompleted || []).map(item => `Challenge complete: ${item.title}`),
  ];
  if (progression?.levelAfter > progression?.levelBefore) {
    items.unshift(`Reached Level ${progression.levelAfter}`);
  }
  for (const text of items.slice(0, 4)) {
    io.to(room.code).emit('game:celebration', {
      id: crypto.randomUUID(),
      userId,
      displayName,
      avatarInitial,
      type: 'preset',
      text,
      createdAt: Date.now(),
    });
  }
}

function userResults(userId) {
  return results
    .filter(result => result.players.some(player => player.userId === userId))
    .sort((a, b) => b.completedAt - a.completedAt);
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const storedToken = persistentCredentialVerifier(token, 'player-session');
  const session = { token: storedToken, userId, expiresAt: Date.now() + SESSION_TTL_MS };
  sessions.set(storedToken, session);
  saveStore();
  return { ...session, token };
}

function visiblePlayer(user) {
  return !!user && !isUserArchived(user);
}

function activePlayerAccounts() {
  return [...users.values()].filter(visiblePlayer);
}

function revokeUserSessions(userId) {
  let revoked = 0;
  sessions.forEach((session, token) => {
    if (session.userId === userId) {
      sessions.delete(token);
      revoked += 1;
    }
  });
  return revoked;
}

function authenticateToken(token) {
  if (!token) return null;
  const storedToken = persistentCredentialVerifier(token, 'player-session');
  const session = sessions.get(storedToken);
  if (!session || session.expiresAt <= Date.now()) {
    if (session) sessions.delete(storedToken);
    return null;
  }
  const user = users.get(session.userId);
  return user ? { session, user } : null;
}

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const auth = authenticateToken(token);
  if (!auth) return res.status(401).json({ error: 'Authentication required.' });
  const moderationError = banErrorFor(adminStore, auth.user);
  if (moderationError) return res.status(403).json({ error: moderationError });
  req.auth = auth;
  return next();
}

function optionalPlayerAuth(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  return authenticateToken(token);
}

function availabilityResolution(featureKey, userId = null) {
  return resolveFeatureAvailability(availabilityStore, featureKey, userId);
}

function blockedAvailability(featureKey, userId = null) {
  const resolution = availabilityResolution(featureKey, userId);
  return resolution.state === 'live' ? null : resolution;
}

function requireFeature(featureKeyOrResolver) {
  return (req, res, next) => {
    const featureKey = typeof featureKeyOrResolver === 'function'
      ? featureKeyOrResolver(req)
      : featureKeyOrResolver;
    if (!featureDefinition(featureKey)) return res.status(500).json({ error: 'Feature availability is not registered.' });
    const resolution = blockedAvailability(featureKey, req.auth?.user?.userId || null);
    if (resolution) return res.status(503).json(unavailablePayload(resolution));
    return next();
  };
}

function rankedFeatureKey(playerCount) {
  return `ranked.${Math.max(2, Math.min(4, Number(playerCount) || 2))}p`;
}

function roomAvailabilityFeature(room) {
  if (room?.availabilityFeature && featureDefinition(room.availabilityFeature)) return room.availabilityFeature;
  if (room?.matchType === 'ranked') return rankedFeatureKey(room.ranked?.playerCount || room.maxPlayers);
  if (room?.matchType === 'wager') return 'casual.wagers';
  return 'casual.create_room';
}

function socketFeatureUnavailable(featureKey, userId) {
  const resolution = blockedAvailability(featureKey, userId);
  return resolution ? unavailablePayload(resolution) : null;
}

function blockRoomFeature(room, userId, res) {
  const resolution = blockedAvailability(roomAvailabilityFeature(room), userId);
  if (!resolution) return false;
  res.status(503).json(unavailablePayload(resolution));
  return true;
}

function normalizeReleasePlatform(value) {
  const platform = String(value || '').trim().toLowerCase();
  if (platform === 'mobile') return 'android';
  return ['android', 'ios'].includes(platform) ? platform : null;
}

function normalizeReleaseChannel(value) {
  const channel = String(value || '').trim().toLowerCase();
  return ['playtest', 'production'].includes(channel) ? channel : 'playtest';
}

function releaseClientFromHeaders(headers = {}) {
  const platform = normalizeReleasePlatform(headers['x-golf9-platform']);
  if (!platform) return null;
  return {
    platform,
    channel: normalizeReleaseChannel(headers['x-golf9-channel']),
    build: Number.parseInt(String(headers['x-golf9-build'] || '0'), 10) || 0,
    version: String(headers['x-golf9-version'] || ''),
  };
}

function releaseClientFromSocket(socket) {
  const auth = socket.handshake.auth || {};
  return {
    platform: normalizeReleasePlatform(auth.platform || socket.handshake.headers?.['x-golf9-platform']) || 'android',
    channel: normalizeReleaseChannel(auth.channel || socket.handshake.headers?.['x-golf9-channel']),
    build: Number.parseInt(String(auth.build || socket.handshake.headers?.['x-golf9-build'] || '0'), 10) || 0,
    version: String(auth.version || socket.handshake.headers?.['x-golf9-version'] || ''),
  };
}

function releasePolicyForClient(client) {
  return client ? resolveReleasePolicy(releasePolicyStore, client) : null;
}

function releaseGuardExemptPath(pathname) {
  return [
    '/app/release-policy',
    '/app/availability',
    '/rooms/active',
    '/health',
    '/admin',
    '/auth',
    '/mail',
    '/support',
    '/feedback',
    '/push-tokens',
    '/privacy',
    '/terms',
    '/account/delete',
    '/early-access',
  ].some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

app.use((req, res, next) => {
  const client = releaseClientFromHeaders(req.headers);
  if (!client || releaseGuardExemptPath(req.path)) return next();
  const policy = releasePolicyForClient(client);
  if (!policy || policy.status !== 'required') return next();
  const auth = optionalPlayerAuth(req);
  const activeRoom = auth ? activePlayingRoomForUser(auth.user.userId) : null;
  if (policy.enforcement === 'after_match' && activeRoom) return next();
  return res.status(426).json(updateRequiredPayload(policy));
});

function roomSummary(room) {
  return {
    code: room.code,
    hostUserId: room.hostUserId,
    status: room.status,
    matchType: room.matchType || 'casual',
    availabilityFeature: roomAvailabilityFeature(room),
    isPublic: !!room.isPublic,
    maxPlayers: room.maxPlayers,
    rounds: room.rounds,
    openSeats: Math.max(0, room.maxPlayers - room.players.length),
    countdownEndsAt: room.countdownEndsAt || null,
    economy: room.economy ? {
      buyIn: room.economy.buyIn || 0,
      pot: (room.economy.buyIn || 0) * room.maxPlayers,
      chargedAt: room.economy.chargedAt || null,
    } : { buyIn: 0, pot: 0, chargedAt: null },
    ranked: room.matchType === 'ranked' ? {
      seasonId: room.ranked?.seasonId || rankedSeason.id,
      league: leagueForMmr(room.ranked?.averageMmr ?? BASE_MMR, rankedConfig()).name,
      playerCount: room.ranked?.playerCount || room.maxPlayers,
      buyIn: room.economy?.buyIn || 0,
    } : null,
    players: room.players.map(player => {
      const account = users.get(player.userId);
      const safeAccount = account ? safeUser(account) : null;
      return {
        userId: player.userId,
        displayName: player.displayName,
        avatarInitial: player.avatarInitial,
        level: safeAccount?.progression?.level ?? 1,
        progression: safeAccount?.progression ?? null,
        competitive: safeAccount ? publicCompetitiveRankOnly(safeAccount.competitive) : null,
        displayRankEmblem: safeAccount?.displayRankEmblem || null,
        cosmetics: sharedPlayerCosmetics(safeAccount?.inventory?.equipped || player.inventory?.equipped || player.cosmetics || null),
        club: safeAccount?.club || null,
        ready: true,
        connected: room.connected.get(player.userId) || false,
        autoplayActive: afkPlayerState(room, player.userId).autoplayActive,
        forfeited: room.forfeits?.has(player.userId) || false,
        isHost: player.userId === room.hostUserId,
      };
    }),
  };
}

function broadcastRoom(room) {
  if (!syncRoomCountdown(room)) return;
  ensureAutoplaySchedules(room);
  io.to(room.code).emit('room:update', roomSummary(room));
  if (room.game) {
    for (const player of room.players) {
      io.to(`${room.code}:${player.userId}`).emit('game:state', gameViewFor(room, player.userId));
    }
    maybeSendTurnPush(room);
  }
}

function maybeSendTurnPush(room) {
  const game = room.game;
  if (!game || game.completed || game.phase !== 'turn') return;
  const activePlayer = game.players?.[game.currentPlayerIndex];
  if (!activePlayer?.userId) return;
  if (afkPlayerState(room, activePlayer.userId).autoplayActive) return;
  const foreground = room.foreground?.get(activePlayer.userId);
  const connected = room.connected?.get(activePlayer.userId) || false;
  if (foreground || (foreground == null && connected)) return;
  const key = `${room.code}:${game.round}:${game.turnSerial || 0}:${activePlayer.userId}`;
  const roomPlayer = room.players.find(player => player.userId === activePlayer.userId);
  queueConfiguredPushToUser(activePlayer.userId, 'turn', {
    keyName: 'turn',
    dedupeKey: key,
    templateData: {
      roomCode: room.code,
      displayName: roomPlayer?.displayName || activePlayer.displayName || '',
    },
    data: {
      type: 'turn',
      roomCode: room.code,
      roomId: game.id,
      displayName: roomPlayer?.displayName || activePlayer.displayName || '',
    },
  });
}

function queueDailyBonusPushes(now = Date.now()) {
  let queued = 0;
  const dayKey = `daily:${utcDayKey(now)}`;
  for (const user of users.values()) {
    const push = normalizePushNotifications(user);
    if (!push.tokens.length) continue;
    const bonus = publicDailyBonus(user, now);
    if (!bonus.canClaim) continue;
    const didQueue = queueConfiguredPushToUser(user.userId, 'dailyBonus', {
      keyName: 'dailyBonus',
      dedupeKey: dayKey,
      templateData: {
        reward: String(bonus.reward),
      },
      data: {
        type: 'dailyBonus',
        reward: String(bonus.reward),
      },
    });
    if (didQueue) queued += 1;
  }
  return queued;
}

function gameViewFor(room, userId) {
  const view = publicGameState(
    room.game,
    userId,
    room.held.get(userId) || null,
    room.heldSource?.get(userId) || null,
    room.heldMustReplace?.get(userId) || false,
    room.heldCanDiscard?.get(userId) || false
  );
  const playerAfk = afkPlayerState(room, userId);
  return {
    ...view,
    viewerAutoplay: {
      active: playerAfk.autoplayActive,
      consecutiveMisses: playerAfk.consecutiveMisses,
      automatedWindows: playerAfk.automatedWindows,
      penaltyPending: playerAfk.penaltyPending,
      takeoverThreshold: afkConfigStore.takeoverMisses,
      penaltyThreshold: afkConfigStore.penaltyAutomatedWindows,
      forfeited: room.forfeits?.has(userId) || false,
    },
  };
}

function afkPlayerState(room, userId) {
  room.afkStates ||= new Map();
  const normalized = normalizeAfkPlayerState(room.afkStates.get(userId));
  room.afkStates.set(userId, normalized);
  return normalized;
}

function setAfkPlayerState(room, userId, state) {
  room.afkStates ||= new Map();
  const normalized = normalizeAfkPlayerState(state);
  room.afkStates.set(userId, normalized);
  return normalized;
}

function autoplayWindowFor(room, userId) {
  const game = room.game;
  if (!game || game.completed || room.status !== 'playing') return null;
  if (!afkPlayerState(room, userId).autoplayActive) return null;
  if (game.phase === 'turn') {
    const player = game.players?.[game.currentPlayerIndex];
    if (player?.userId !== userId) return null;
    return {
      phase: 'turn',
      key: `${game.id}:turn:${game.round || 1}:${game.turnEndsAt || 0}:${userId}`,
    };
  }
  if (game.phase === 'peek') {
    const player = game.players?.find(item => item.userId === userId);
    if (!player || player.peekFlips >= 2) return null;
    return {
      phase: 'peek',
      key: `${game.id}:peek:${game.round || 1}:${game.peekEndsAt || 0}:${userId}`,
    };
  }
  return null;
}

function cancelAutoplaySchedule(room, userId) {
  const schedule = room.autoplaySchedules?.get(userId);
  if (!schedule) return;
  clearTimeout(schedule.cueTimer);
  clearTimeout(schedule.targetCueTimer);
  clearTimeout(schedule.commitTimer);
  room.autoplaySchedules.delete(userId);
}

function cancelAllAutoplaySchedules(room) {
  for (const userId of room.autoplaySchedules?.keys?.() || []) cancelAutoplaySchedule(room, userId);
}

function autoplayCueFor(room, userId, window) {
  if (window.phase === 'peek') {
    return { source: 'peek', intent: 'complete-initial-peek', target: null, action: 'wait' };
  }
  const playerIndex = getRoomPlayerIndex(room, userId);
  const move = chooseAiMove(room.game, playerIndex, 'easy');
  return autoplayCueFromMove(move);
}

function emitAutoplayCue(room, userId, window, stage = 'source') {
  const current = autoplayWindowFor(room, userId);
  if (!current || current.key !== window.key) return;
  const scheduled = room.autoplaySchedules?.get(userId);
  if (!scheduled || scheduled.key !== window.key) return;
  const cue = scheduled.cue;
  io.to(room.code).emit('game:autoplay:cue', {
    userId,
    phase: window.phase,
    stage,
    source: cue.source,
    intent: cue.intent,
    target: stage === 'target' ? cue.target : null,
    action: stage === 'target' ? cue.action : null,
    round: room.game.round || 1,
    turnSerial: room.game.turnSerial || 0,
    windowKey: window.key,
  });
}

function recordAutomatedWindow(room, userId) {
  return setAfkPlayerState(
    room,
    userId,
    recordAutomatedAfkWindow(afkPlayerState(room, userId), afkConfigStore)
  );
}

function commitAutoplayWindow(room, userId, window) {
  const scheduled = room.autoplaySchedules?.get(userId);
  if (!scheduled || scheduled.key !== window.key) return;
  room.autoplaySchedules.delete(userId);
  const current = autoplayWindowFor(room, userId);
  if (!current || current.key !== window.key) return;

  const playerIndex = getRoomPlayerIndex(room, userId);
  if (playerIndex < 0) return;
  const beforeGame = room.game;
  let next = room.game;
  if (window.phase === 'turn') {
    next = aiPlayTurn(room.game, playerIndex, 'easy');
  } else {
    for (let r = 0; r < 3 && next.phase === 'peek' && next.players[playerIndex]?.peekFlips < 2; r += 1) {
      for (let c = 0; c < 3 && next.phase === 'peek' && next.players[playerIndex]?.peekFlips < 2; c += 1) {
        if (!next.players[playerIndex]?.grid?.[r]?.[c]?.faceUp) {
          const flipped = flipForPeek(next, playerIndex, r, c);
          if (!flipped.error) next = flipped.state;
        }
      }
    }
  }
  if (next === beforeGame || (next.revision || 0) === (beforeGame.revision || 0)) return;

  trackColumnClears(room, userId, countNewClearedColumns(beforeGame, next, playerIndex));
  room.game = next;
  recordAutomatedWindow(room, userId);
  captureRoundProgress(room);
  recordCompletedGame(room);
  room.updatedAt = Date.now();
  broadcastRoom(room);
}

function scheduleAutoplayWindow(room, userId, window) {
  const config = normalizeAfkConfig(afkConfigStore);
  const cue = autoplayCueFor(room, userId, window);
  const cueTimer = setTimeout(() => emitAutoplayCue(room, userId, window, 'source'), config.sourceCueMs);
  const targetCueTimer = window.phase === 'turn'
    ? setTimeout(() => emitAutoplayCue(room, userId, window, 'target'), autoplayTargetCueMs(config))
    : null;
  const commitTimer = setTimeout(() => commitAutoplayWindow(room, userId, window), config.commitMs);
  cueTimer.unref?.();
  targetCueTimer?.unref?.();
  commitTimer.unref?.();
  room.autoplaySchedules.set(userId, { ...window, cue, cueTimer, targetCueTimer, commitTimer });
}

function ensureAutoplaySchedules(room) {
  room.autoplaySchedules ||= new Map();
  const desired = new Map();
  for (const player of room.players || []) {
    const window = autoplayWindowFor(room, player.userId);
    if (window) desired.set(player.userId, window);
  }
  for (const [userId, schedule] of room.autoplaySchedules) {
    if (desired.get(userId)?.key !== schedule.key) cancelAutoplaySchedule(room, userId);
  }
  for (const [userId, window] of desired) {
    if (!room.autoplaySchedules.has(userId)) scheduleAutoplayWindow(room, userId, window);
  }
}

function roomMissWindowKey(room, userId, phase) {
  const game = room.game;
  return phase === 'peek'
    ? `${game.id}:peek:${game.round || 1}:${game.peekEndsAt || 0}:${userId}`
    : `${game.id}:turn:${game.round || 1}:${game.turnEndsAt || 0}:${userId}`;
}

function recordRoomMissedWindow(room, userId, phase) {
  if (!userId) return false;
  room.afkProcessedWindows ||= new Set();
  const key = roomMissWindowKey(room, userId, phase);
  if (room.afkProcessedWindows.has(key)) return false;
  room.afkProcessedWindows.add(key);
  const result = recordMissedAfkWindow(afkPlayerState(room, userId), afkConfigStore);
  setAfkPlayerState(room, userId, result.state);
  if (result.activated) {
    queuePushToUser(userId, {
      type: 'autoplay',
      keyName: 'autoplay',
      dedupeKey: `${room.code}:${key}`,
      title: 'Autoplay is active',
      body: 'Nine Below is playing for you. Tap to take back control.',
      data: { type: 'autoplay', roomCode: room.code, roomId: room.game?.id },
    });
  }
  return true;
}

function recordHumanRoomAction(room, userId) {
  const current = afkPlayerState(room, userId);
  if (!current.autoplayActive && current.consecutiveMisses === 0) return current;
  cancelAutoplaySchedule(room, userId);
  return setAfkPlayerState(room, userId, recordHumanAfkAction(current));
}

function getRoomPlayerIndex(room, userId) {
  return room.game?.players.findIndex(player => player.userId === userId) ?? -1;
}

function chooseTimedOutPendingDecision(game, heldCard, source) {
  if (source === 'discard') return 'drawn';
  const pending = game.pendingDecision;
  const revealed = pending ? game.players[pending.playerIndex]?.grid?.[pending.r]?.[pending.c] : null;
  if (!revealed) return 'drawn';
  return cardValue(heldCard) <= cardValue(revealed) ? 'drawn' : 'revealed';
}

function settleHeldCardBeforeForfeit(room, userId) {
  const idx = getRoomPlayerIndex(room, userId);
  if (idx < 0 || room.game?.phase !== 'turn' || room.game.currentPlayerIndex !== idx) return false;
  room.held ||= new Map();
  room.heldSource ||= new Map();
  room.heldMustReplace ||= new Map();
  room.heldCanDiscard ||= new Map();
  const heldCard = room.held.get(userId);
  const beforeGame = room.game;
  let result = null;
  if (room.game.pendingDecision && !heldCard) {
    result = resolvePendingGridDecisionWithoutHeld(room.game, idx);
  } else if (heldCard && room.game.pendingDecision) {
    result = resolvePendingGridDecision(
      room.game,
      idx,
      heldCard,
      chooseTimedOutPendingDecision(room.game, heldCard, room.heldSource.get(userId))
    );
  } else if (heldCard) {
    const target = pickTarget(room.game.players[idx].grid, heldCard);
    result = replaceGridCard(room.game, idx, target.r, target.c, heldCard);
  }
  if (!result || result.error) return false;
  trackColumnClears(room, userId, countNewClearedColumns(beforeGame, result.state, idx));
  room.game = result.state;
  captureRoundProgress(room);
  room.held.delete(userId);
  room.heldSource.delete(userId);
  room.heldMustReplace.delete(userId);
  room.heldCanDiscard.delete(userId);
  return true;
}

function detachUserFromGameRoom(room, userId) {
  for (const socketId of userSockets.get(userId) || []) {
    const userSocket = io.sockets.sockets.get(socketId);
    const link = sockets.get(socketId);
    if (link?.roomCode === room.code) sockets.delete(socketId);
    userSocket?.leave(room.code);
    userSocket?.leave(`${room.code}:${userId}`);
  }
  room.connected.set(userId, false);
  room.foreground?.set(userId, false);
}

function forfeitOnlineMatch(room, userId) {
  if (!room?.game || room.game.completed || room.status !== 'playing') {
    return { error: 'This match is no longer active.' };
  }
  if (room.forfeits?.has(userId)) {
    return { ok: true, duplicate: true, matchType: room.matchType, buyIn: room.economy?.buyIn || 0 };
  }
  const playerIndex = getRoomPlayerIndex(room, userId);
  if (playerIndex < 0) return { error: 'You are not seated in this game.' };

  room.forfeits ||= new Map();
  const record = {
    eventId: crypto.randomUUID(),
    confirmedAt: Date.now(),
    matchType: room.matchType,
  };
  room.forfeits.set(userId, record);
  cancelAutoplaySchedule(room, userId);
  settleHeldCardBeforeForfeit(room, userId);
  const afk = afkPlayerState(room, userId);
  setAfkPlayerState(room, userId, {
    ...afk,
    autoplayActive: true,
    consecutiveMisses: Math.max(afk.consecutiveMisses, afkConfigStore.takeoverMisses),
    penaltyPending: false,
  });
  room.roundSummaryAcks?.add(userId);
  detachUserFromGameRoom(room, userId);
  captureRoundProgress(room);
  recordCompletedGame(room);
  room.updatedAt = Date.now();
  broadcastRoom(room);
  saveStore();
  return {
    ok: true,
    matchType: room.matchType,
    buyIn: room.economy?.buyIn || 0,
    pendingUntilMatchEnds: !room.game.completed,
  };
}

function countFaceDownCards(grid) {
  if (!grid) return 0;
  let count = 0;
  for (const row of grid) {
    for (const card of row) {
      if (card && !card.faceUp) count += 1;
    }
  }
  return count;
}

function progressionEntry(room, userId) {
  room.progressionStats ||= new Map();
  if (!room.progressionStats.has(userId)) {
    room.progressionStats.set(userId, { columnClears: 0, roundScores: [] });
  }
  return room.progressionStats.get(userId);
}

function countNewClearedColumns(before, after, playerIndex) {
  const beforeGrid = before?.players?.[playerIndex]?.grid;
  const afterGrid = after?.players?.[playerIndex]?.grid;
  if (!beforeGrid || !afterGrid) return 0;
  let cleared = 0;
  for (let c = 0; c < 3; c += 1) {
    const beforeColumn = [beforeGrid[0]?.[c], beforeGrid[1]?.[c], beforeGrid[2]?.[c]];
    const afterColumn = [afterGrid[0]?.[c], afterGrid[1]?.[c], afterGrid[2]?.[c]];
    if (beforeColumn.some(Boolean) && afterColumn.every(card => !card)) cleared += 1;
  }
  return cleared;
}

function trackColumnClears(room, userId, count) {
  if (!count) return;
  progressionEntry(room, userId).columnClears += count;
}

function captureRoundProgress(room) {
  if (!room.game?.lastRoundNumber || !Array.isArray(room.game.lastRoundScores)) return;
  room.progressionRoundKeys ||= new Set();
  const key = `${room.game.lastRoundNumber}:${room.game.lastRoundScores.join(',')}`;
  if (room.progressionRoundKeys.has(key)) return;
  room.progressionRoundKeys.add(key);
  room.game.players.forEach((player, index) => {
    progressionEntry(room, player.userId).roundScores.push(room.game.lastRoundScores[index] || 0);
  });
}

function resolveRoomExpiredTimers(room) {
  if (!room.game) return false;
  room.heldSource ||= new Map();
  room.heldMustReplace ||= new Map();
  room.heldCanDiscard ||= new Map();
  const beforeGame = room.game;
  const before = {
    revision: room.game.revision || 0,
    phase: room.game.phase,
    currentPlayerIndex: room.game.currentPlayerIndex,
    peekTurnIndex: room.game.peekTurnIndex,
    turnEndsAt: room.game.turnEndsAt,
    peekEndsAt: room.game.peekEndsAt,
    round: room.game.round,
    completed: room.game.completed,
  };

  const now = Date.now();
  if (room.game.phase === 'turn' && room.game.turnEndsAt && now >= room.game.turnEndsAt) {
    const idx = room.game.currentPlayerIndex;
    const userId = room.game.players[idx]?.userId;
    recordRoomMissedWindow(room, userId, 'turn');
    const heldCard = userId ? room.held.get(userId) : null;
    if (userId && room.game.pendingDecision && !heldCard) {
      const result = resolvePendingGridDecisionWithoutHeld(room.game, idx);
      if (!result.error) {
        trackColumnClears(room, userId, countNewClearedColumns(beforeGame, result.state, idx));
        room.game = result.state;
        captureRoundProgress(room);
        room.heldSource.delete(userId);
        room.heldMustReplace.delete(userId);
        room.heldCanDiscard.delete(userId);
        return true;
      }
    }
    if (userId && heldCard) {
      let result;
      if (room.game.pendingDecision) {
        result = resolvePendingGridDecision(
          room.game,
          idx,
          heldCard,
          chooseTimedOutPendingDecision(room.game, heldCard, room.heldSource.get(userId))
        );
      } else {
        const target = pickTarget(room.game.players[idx].grid, heldCard);
        result = replaceGridCard(room.game, idx, target.r, target.c, heldCard);
      }
      if (!result.error) {
        trackColumnClears(room, userId, countNewClearedColumns(beforeGame, result.state, idx));
        room.game = result.state;
        captureRoundProgress(room);
        room.held.delete(userId);
        room.heldSource.delete(userId);
        room.heldMustReplace.delete(userId);
        room.heldCanDiscard.delete(userId);
        return true;
      }
    }
  }

  if (room.game.phase === 'peek' && room.game.peekEndsAt && now >= room.game.peekEndsAt) {
    for (const player of room.game.players || []) {
      if (player.peekFlips < 2) recordRoomMissedWindow(room, player.userId, 'peek');
    }
  }

  const next = resolveExpiredTimers(room.game);
  const changed = (next.revision || 0) !== before.revision
    || next.phase !== before.phase
    || next.currentPlayerIndex !== before.currentPlayerIndex
    || next.peekTurnIndex !== before.peekTurnIndex
    || next.turnEndsAt !== before.turnEndsAt
    || next.peekEndsAt !== before.peekEndsAt
    || next.round !== before.round
    || next.completed !== before.completed;
  if (changed) {
    if (before.phase === 'roundSummary' && next.phase !== 'roundSummary') {
      room.roundSummaryAcks = new Set();
    }
    const userId = beforeGame.players?.[before.currentPlayerIndex]?.userId;
    if (userId) trackColumnClears(room, userId, countNewClearedColumns(beforeGame, next, before.currentPlayerIndex));
    room.game = next;
    captureRoundProgress(room);
  }
  return changed;
}

function isValidActionId(actionId) {
  return typeof actionId === 'string' && /^[a-z0-9-]{8,80}$/i.test(actionId);
}

function isGridCoordinate(payload) {
  return Number.isInteger(payload?.r) && Number.isInteger(payload?.c)
    && payload.r >= 0 && payload.r < 3
    && payload.c >= 0 && payload.c < 3;
}

function rememberActionId(room, actionId) {
  room.processedActionIds.add(actionId);
  while (room.processedActionIds.size > MAX_PROCESSED_ACTION_IDS) {
    const oldest = room.processedActionIds.values().next().value;
    room.processedActionIds.delete(oldest);
  }
}

function normalizeRoomOptions({ maxPlayers = 4, rounds = 9, buyIn = 0 } = {}) {
  return {
    maxPlayers: Math.max(2, Math.min(4, Number(maxPlayers) || 4)),
    rounds: Number(rounds) === 5 ? 5 : 9,
    buyIn: normalizeBuyIn(buyIn, economyConfig()),
  };
}

function normalizeWagerOptions(body = {}) {
  const options = normalizeRoomOptions(body);
  return { ...options, buyIn: normalizeBuyIn(body.buyIn, economyConfig()) };
}

function normalizeRankedRoomOptions(body = {}) {
  const options = normalizeRoomOptions(body);
  return {
    ...options,
    maxPlayers: normalizeRankedPlayerCount(options.maxPlayers),
    rounds: 9,
    buyIn: 0,
  };
}

function cancelRoomCountdown(room) {
  if (room.countdownTimer) clearTimeout(room.countdownTimer);
  room.countdownTimer = null;
  room.countdownEndsAt = null;
}

function blockedRoomAvailability(room) {
  const featureKey = roomAvailabilityFeature(room);
  for (const player of room.players) {
    const resolution = blockedAvailability(featureKey, player.userId);
    if (resolution) return resolution;
  }
  return null;
}

function refundWaitingRoom(room) {
  const entries = room.economy?.entries || {};
  if (!room.economy?.chargedAt || room.economy?.payoutRecorded || room.economy?.refundedAt) return false;
  for (const [userId, rawAmount] of Object.entries(entries)) {
    const user = users.get(userId);
    const amount = Math.max(0, Number(rawAmount) || 0);
    if (!user || !amount) continue;
    normalizeUserProgression(user, Date.now(), rankedSeason, rankedConfig());
    user.currency.coins += amount;
  }
  room.economy.refundedAt = Date.now();
  return true;
}

function cancelUnavailableLobby(room, resolution) {
  if (!room || room.status !== 'lobby') return false;
  cancelRoomCountdown(room);
  cancelAllAutoplaySchedules(room);
  refundWaitingRoom(room);
  const payload = unavailablePayload(resolution || blockedRoomAvailability(room));
  io.to(room.code).emit('room:cancelled', payload);
  for (const player of room.players) io.to(`user:${player.userId}`).emit('room:cancelled', { ...payload, roomCode: room.code });
  rooms.delete(room.code);
  return true;
}

function reconcileAvailabilityState() {
  let changed = false;
  for (const [userId, entry] of [...rankedQueue.entries()]) {
    const resolution = blockedAvailability(rankedFeatureKey(entry.maxPlayers), userId);
    if (!resolution) continue;
    rankedQueue.delete(userId);
    io.to(`user:${userId}`).emit('ranked:cancelled', unavailablePayload(resolution));
    changed = true;
  }
  for (const room of [...rooms.values()]) {
    if (room.status !== 'lobby') continue;
    const resolution = blockedRoomAvailability(room);
    if (!resolution) continue;
    if (cancelUnavailableLobby(room, resolution)) changed = true;
  }
  if (changed) saveStore();
  return changed;
}

function syncRoomCountdown(room) {
  if (room.status !== 'lobby') {
    cancelRoomCountdown(room);
    return true;
  }

  const unavailable = blockedRoomAvailability(room);
  if (unavailable) {
    cancelUnavailableLobby(room, unavailable);
    return false;
  }

  if (room.players.length !== room.maxPlayers) {
    cancelRoomCountdown(room);
    return true;
  }

  if (room.countdownEndsAt) return true;
  room.countdownEndsAt = Date.now() + ROOM_COUNTDOWN_MS;
  room.countdownTimer = setTimeout(() => {
    const current = rooms.get(room.code);
    if (!current || current.status !== 'lobby' || current.players.length !== current.maxPlayers) return;
    const currentUnavailable = blockedRoomAvailability(current);
    if (currentUnavailable) {
      cancelUnavailableLobby(current, currentUnavailable);
      saveStore();
      return;
    }
    try {
      startRoomGame(current, { requireReady: false });
      broadcastRoom(current);
    } catch {
      cancelRoomCountdown(current);
      broadcastRoom(current);
    }
  }, ROOM_COUNTDOWN_MS);
  return true;
}

function addUserToRoom(room, user) {
  if (room.players.some(player => player.userId === user.userId)) return;
  if (room.players.length >= room.maxPlayers) throw new Error('Room is full.');
  const player = safeUser(user);
  room.players.push(player);
  room.ready.set(player.userId, true);
  room.connected.set(player.userId, false);
  room.foreground?.set(player.userId, false);
}

function makeRoom(hostUser, {
  maxPlayers = 4,
  rounds = 9,
  matchType = 'casual',
  ranked = null,
  buyIn = 0,
  isPublic = false,
  availabilityFeature = null,
} = {}) {
  const options = normalizeRoomOptions({ maxPlayers, rounds, buyIn });
  const code = makeCode();
  const host = safeUser(hostUser);
  const safeMatchType = matchType === 'ranked' ? 'ranked' : matchType === 'wager' ? 'wager' : 'casual';
  const room = {
    code,
    hostUserId: host.userId,
    matchType: safeMatchType,
    availabilityFeature: featureDefinition(availabilityFeature)
      ? availabilityFeature
      : safeMatchType === 'ranked'
        ? rankedFeatureKey(options.maxPlayers)
        : safeMatchType === 'wager'
          ? 'casual.wagers'
          : 'casual.create_room',
    ranked,
    economy: {
      buyIn: safeMatchType === 'wager' ? options.buyIn : 0,
      chargedAt: null,
      payouts: {},
    },
    maxPlayers: options.maxPlayers,
    rounds: options.rounds,
    isPublic: Boolean(isPublic),
    status: 'lobby',
    players: [host],
    ready: new Map([[host.userId, true]]),
    connected: new Map([[host.userId, false]]),
    foreground: new Map([[host.userId, false]]),
    game: null,
    processedActionIds: new Set(),
    held: new Map(),
    heldSource: new Map(),
    heldMustReplace: new Map(),
    heldCanDiscard: new Map(),
    roundSummaryAcks: new Set(),
    progressionStats: new Map(),
    progressionRoundKeys: new Set(),
    afkStates: new Map(),
    afkProcessedWindows: new Set(),
    autoplaySchedules: new Map(),
    forfeits: new Map(),
    chat: [],
    chatRate: new Map(),
    countdownEndsAt: null,
    countdownTimer: null,
    updatedAt: Date.now(),
  };
  rooms.set(code, room);
  return room;
}

function rankedQueueKey(options) {
  return `${options.maxPlayers}:${options.rounds}`;
}

function activeRankedRoomForUser(userId) {
  return [...rooms.values()].find(room =>
    room.matchType === 'ranked'
    && (room.status === 'lobby' || room.status === 'playing')
    && !room.game?.completed
    && room.players.some(player => player.userId === userId)
    && !room.forfeits?.has(userId)
  ) || null;
}

function rankedQueueEntry(user, options) {
  const competitive = normalizeCompetitiveState(user, rankedSeason, rankedConfig(), options.maxPlayers);
  const buyIn = rankedBuyInForMmr(competitive.mmr);
  return {
    userId: user.userId,
    displayName: user.displayName,
    avatarInitial: user.displayName.trim().slice(0, 1).toUpperCase(),
    maxPlayers: options.maxPlayers,
    rounds: options.rounds,
    buyIn,
    key: rankedQueueKey(options),
    mmr: competitive.mmr,
    joinedAt: Date.now(),
  };
}

function rankedClubIdForUser(userId) {
  const user = users.get(String(userId || ''));
  const club = user?.clubId ? clubs.get(String(user.clubId)) : null;
  return club && findClubMember(club, user.userId) ? club.clubId : null;
}

function liveRankedQueueEntry(entry) {
  return { ...entry, clubId: rankedClubIdForUser(entry.userId) };
}

function liveRankedQueueGroup(key) {
  return [...rankedQueue.values()]
    .filter(item => item.key === key)
    .map(liveRankedQueueEntry);
}

function publicRankedQueueStatus(userId) {
  const activeRoom = activeRankedRoomForUser(userId);
  if (activeRoom) {
    return {
      queued: false,
      matchedRoomCode: activeRoom.code,
      room: roomSummary(activeRoom),
      status: activeRoom.status,
    };
  }

  const entry = rankedQueue.get(userId);
  if (!entry) return { queued: false, matchedRoomCode: null, room: null, status: 'idle' };
  const liveEntry = liveRankedQueueEntry(entry);
  const eligiblePlayers = Math.min(
    entry.maxPlayers,
    eligibleRankedEntriesForSeed(liveEntry, liveRankedQueueGroup(entry.key), Date.now(), rankedConfig()).length,
  );
  return {
    queued: true,
    matchedRoomCode: null,
    room: null,
    status: 'searching',
    maxPlayers: entry.maxPlayers,
    rounds: entry.rounds,
    joinedAt: entry.joinedAt,
    buyIn: 0,
    pot: 0,
    queuedPlayers: eligiblePlayers,
    eligiblePlayers,
    clubSeparated: !!liveEntry.clubId,
  };
}

function removeUserFromRankedQueue(userId) {
  rankedQueue.delete(userId);
}

function buyInError(user, buyIn) {
  normalizeUserProgression(user, Date.now(), rankedSeason, rankedConfig());
  if (!buyIn) return null;
  if (user.currency.coins >= buyIn) return null;
  return `You need ${buyIn} coins for this table. Play Free Play to build your coins back up.`;
}

function createRankedRoom(entries) {
  rankedSeason = normalizeRankedSeason(rankedSeason, Date.now(), rankedConfig());
  const usersForRoom = entries.map(entry => users.get(entry.userId)).filter(Boolean);
  if (usersForRoom.length !== entries.length) return null;
  const averageMmr = Math.round(entries.reduce((sum, entry) => sum + entry.mmr, 0) / entries.length);
  const mmrSnapshot = Object.fromEntries(entries.map(entry => [entry.userId, entry.mmr]));
  const clubSnapshot = Object.fromEntries(entries.map(entry => [entry.userId, entry.clubId || null]));
  const room = makeRoom(usersForRoom[0], {
    maxPlayers: entries[0].maxPlayers,
    rounds: entries[0].rounds,
    matchType: 'ranked',
    availabilityFeature: rankedFeatureKey(entries[0].maxPlayers),
    buyIn: 0,
    ranked: {
      seasonId: rankedSeason.id,
      averageMmr,
      playerCount: entries[0].maxPlayers,
      mmrSnapshot,
      clubSnapshot,
    },
  });

  for (const user of usersForRoom.slice(1)) addUserToRoom(room, user);
  for (const player of room.players) room.ready.set(player.userId, true);
  for (const entry of entries) rankedQueue.delete(entry.userId);
  room.updatedAt = Date.now();
  broadcastRoom(room);
  return room;
}

function tryMatchRankedQueue(now = Date.now()) {
  const groups = new Map();
  for (const entry of rankedQueue.values()) {
    if (!groups.has(entry.key)) groups.set(entry.key, []);
    groups.get(entry.key).push(entry);
  }

  const matchedRooms = [];
  for (const entries of groups.values()) {
    const liveEntries = entries.map(liveRankedQueueEntry).sort((a, b) => a.joinedAt - b.joinedAt);
    for (const seed of liveEntries) {
      if (!rankedQueue.has(seed.userId)) continue;
      const available = liveEntries.filter(entry => rankedQueue.has(entry.userId));
      const selected = selectRankedMatchEntries(seed, available, now, rankedConfig());
      if (selected.length < seed.maxPlayers) continue;
      const room = createRankedRoom(selected);
      if (room) matchedRooms.push(room);
    }
  }
  return matchedRooms;
}

function chargeRoomBuyIns(room) {
  const buyIn = Number(room.economy?.buyIn || 0);
  if (!buyIn || room.economy?.chargedAt) return;
  const accountUsers = room.players.map(player => users.get(player.userId));
  if (accountUsers.some(user => !user)) throw new Error('Every player must have an account for this table.');

  for (const user of accountUsers) {
    normalizeUserProgression(user, Date.now(), rankedSeason);
    if (user.currency.coins < buyIn) {
      throw new Error(`${user.displayName} does not have enough coins for this table.`);
    }
  }

  for (const user of accountUsers) {
    user.currency.coins -= buyIn;
  }
  room.economy.chargedAt = Date.now();
  room.economy.entries = Object.fromEntries(room.players.map(player => [player.userId, buyIn]));
  room.economy.pot = buyIn * room.players.length;
  saveStore();
}

function applyEconomyPayouts(room, result) {
  const buyIn = Number(room.economy?.buyIn || 0);
  if (!buyIn || room.economy?.payoutRecorded) return new Map();
  const payouts = calculatePayouts(result.players, buyIn, {
    ineligibleUserIds: result.players.filter(player => player.forfeited).map(player => player.userId),
  });
  const payoutMap = new Map(payouts.map(item => [item.userId, item]));

  for (const payout of payouts) {
    const user = users.get(payout.userId);
    if (!user) continue;
    normalizeUserProgression(user, Date.now(), rankedSeason);
    user.currency.coins += payout.payout;
    user.currency.lifetimeCoins += payout.payout;
  }

  room.economy.payoutRecorded = true;
  room.economy.payouts = Object.fromEntries(payouts.map(item => [item.userId, item]));
  return payoutMap;
}

function applyClubContributions(room, result) {
  if (result.mode !== 'online' || !['casual', 'wager', 'ranked'].includes(result.matchType)) return;
  const byClub = new Map();
  for (const player of result.players) {
    if (player.forfeited) continue;
    const user = users.get(player.userId);
    const club = user?.clubId ? clubs.get(user.clubId) : null;
    if (!club || !findClubMember(club, user.userId)) continue;
    if (!byClub.has(club.clubId)) byClub.set(club.clubId, { club, players: [] });
    byClub.get(club.clubId).players.push({ player, user });
  }

  for (const { club, players } of byClub.values()) {
    normalizeClub(club, result.completedAt, rankedSeason);
    if (club.processedResultIds.includes(result.resultId)) continue;
    const summaries = [];
    for (const { player } of players) {
      const telemetry = room.progressionStats?.get(player.userId) || {};
      const contribution = applyClubMatchContribution(club, {
        resultId: result.resultId,
        processedKey: result.resultId,
        skipProcessedCheck: true,
        skipProcessedRecord: true,
        completedAt: result.completedAt,
        userId: player.userId,
        matchType: result.matchType,
        total: player.total,
        won: player.won,
        columnClears: Math.max(0, Math.floor(Number(telemetry.columnClears || 0) || 0)),
      }, rankedSeason);
      if (!contribution.skipped) {
        player.progression ||= {};
        player.progression.club = contribution;
        summaries.push(contribution);
      }
    }
    club.processedResultIds.push(result.resultId);
    club.updatedAt = result.completedAt;
    normalizeClub(club, result.completedAt, rankedSeason);
    syncClubRewards(club, users, result.completedAt);
    emitClubUpdate(club.clubId);
    if (summaries.some(summary => summary.completedGoals?.length)) {
      for (const { player } of players) {
        const roomPlayer = room.players.find(item => item.userId === player.userId);
        io.to(room.code).emit('game:celebration', {
          id: crypto.randomUUID(),
          userId: player.userId,
          displayName: player.displayName,
          avatarInitial: roomPlayer?.avatarInitial,
          type: 'preset',
          text: `${club.tag} club goal complete`,
          createdAt: Date.now(),
        });
      }
    }
  }
}

function startRoomGame(room, { requireReady = false } = {}) {
  if (room.players.length < 2) throw new Error('At least two players are required.');
  if (requireReady && !room.players.every(player => room.ready.get(player.userId))) throw new Error('All players must be ready.');
  chargeRoomBuyIns(room);
  cancelRoomCountdown(room);
  cancelAllAutoplaySchedules(room);
  room.status = 'playing';
  room.held = new Map();
  room.heldSource = new Map();
  room.heldMustReplace = new Map();
  room.heldCanDiscard = new Map();
  room.roundSummaryAcks = new Set();
  room.progressionStats = new Map();
  room.progressionRoundKeys = new Set();
  room.afkStates = new Map();
  room.afkProcessedWindows = new Set();
  room.autoplaySchedules = new Map();
  room.forfeits = new Map();
  room.game = createGameState(
    room.players.map(player => {
      const account = users.get(player.userId) || player;
      return sanitizePlayerIdentity({
        ...account,
        displayRankEmblem: users.has(player.userId)
          ? resolveDisplayRankEmblem(account, rankedSeason, rankedConfig())
          : null,
      });
    }),
    { totalRounds: room.rounds, simultaneousPeek: true }
  );
  room.resultRecorded = false;
  room.updatedAt = Date.now();
}

function recordCompletedGame(room) {
  if (!room.game?.completed || room.resultRecorded) return;
  captureRoundProgress(room);
  const totals = room.game.totals || room.game.players.map(player => 0);
  const matchType = room.matchType === 'ranked' ? 'ranked' : room.matchType === 'wager' ? 'wager' : 'casual';
  const forfeitFlags = room.game.players.map(player => room.forfeits?.has(player.userId) || false);
  const activeTotals = totals.filter((_total, index) => !forfeitFlags[index]);
  const winningTotal = activeTotals.length ? Math.min(...activeTotals) : Number.NEGATIVE_INFINITY;
  const afkPenaltyFlags = room.game.players.map((player, index) => (
    !forfeitFlags[index] && afkPlayerState(room, player.userId).penaltyPending
  ));
  const rankedPlacements = placementsWithMatchPenalties(totals, afkPenaltyFlags, forfeitFlags);
  const completedAt = Date.now();
  const result = {
    resultId: crypto.randomUUID(),
    completedAt,
    roomCode: room.code,
    matchType,
    mode: 'online',
    round: room.game.round,
    totalRounds: room.game.totalRounds,
    players: room.game.players.map((player, index) => {
      const forfeited = forfeitFlags[index];
      const forfeit = room.forfeits?.get(player.userId) || null;
      return {
        userId: player.userId,
        displayName: player.name,
        clubIdAtMatchStart: room.ranked?.clubSnapshot?.[player.userId] || null,
        total: totals[index] || 0,
        won: !forfeited && (totals[index] || 0) === winningTotal,
        forfeited,
        forfeit: forfeited ? {
          confirmedAt: forfeit?.confirmedAt || completedAt,
          permanentAi: true,
        } : null,
        afk: {
          automatedWindows: afkPlayerState(room, player.userId).automatedWindows,
          penaltyApplied: afkPenaltyFlags[index],
          forcedRankedLast: matchType === 'ranked' && afkPenaltyFlags[index],
          coinPenalty: 0,
        },
      };
    }),
  };
  const payoutMap = applyEconomyPayouts(room, result);

  for (const player of result.players) {
    const user = users.get(player.userId);
    if (!user) continue;
    const telemetry = room.progressionStats?.get(player.userId) || {};
    const economy = payoutMap.get(player.userId) || null;
    if (economy) {
      player.economy = {
        ...economy,
        pot: room.economy?.pot || ((room.economy?.buyIn || 0) * result.players.length),
      };
    }
    player.progression = player.forfeited
      ? recordOnlineMatchForfeit(user, result.completedAt)
      : applyMatchProgression(user, {
        mode: 'online',
        total: player.total,
        won: player.won,
        totalRounds: room.game.totalRounds,
        roundScores: telemetry.roundScores || room.game.lastRoundScores || [],
        columnClears: telemetry.columnClears || 0,
        coinScale: room.matchType === 'wager' || room.matchType === 'ranked' ? 0 : 1,
      });
    if (player.economy) player.progression.economy = player.economy;
    if (matchType === 'ranked') {
      const playerIndex = result.players.findIndex(item => item.userId === player.userId);
      const snapshot = room.ranked?.mmrSnapshot || {};
      const opponentMmrs = result.players
        .filter(item => item.userId !== player.userId)
        .map(item => {
          const opponent = users.get(item.userId);
          const ladder = opponent ? normalizeCompetitiveState(opponent, rankedSeason, rankedConfig(), result.players.length) : null;
          return Number(snapshot[item.userId] ?? ladder?.mmr ?? BASE_MMR);
        });
      const ranked = applyRankedMatchResult(user, {
        matchId: result.resultId,
        roomCode: room.code,
        playerCount: result.players.length,
        placement: rankedPlacements[playerIndex],
        total: player.total,
        opponentMmrs,
        columnClears: telemetry.columnClears || 0,
        forfeited: player.forfeited,
      }, rankedSeason, result.completedAt, rankedConfig());
      player.ranked = ranked;
      player.progression.ranked = ranked;
    }
    if (player.forfeited) {
      const settlement = recordForfeitSettlement(user, {
        eventId: room.forfeits?.get(player.userId)?.eventId,
        matchId: result.resultId,
        roomCode: room.code,
        matchType,
        seasonId: matchType === 'ranked' ? (room.ranked?.seasonId || rankedSeason.id) : null,
        confirmedAt: room.forfeits?.get(player.userId)?.confirmedAt,
      }, rankedSeason, forfeitConfigStore, result.completedAt);
      player.forfeit.restriction = settlement.status.ranked;
      rankedQueue.delete(player.userId);
    }
    if (player.afk.penaltyApplied) {
      user.currency ||= { coins: 0 };
      const penalty = applyAfkCoinPenalty(user.currency.coins, afkConfigStore);
      user.currency.coins = penalty.balance;
      player.afk.coinPenalty = penalty.deducted;
      player.progression.afk = player.afk;
    }
    const roomPlayer = room.players.find(item => item.userId === player.userId);
    if (!player.forfeited) {
      emitProgressionCelebrations(room, player.userId, player.displayName, roomPlayer?.avatarInitial, player.progression);
    }
  }

  applyClubContributions(room, result);
  results.push(result);
  room.resultRecorded = true;
  saveStore();
}

const LEGAL_CONTACT_EMAIL = process.env.LEGAL_CONTACT_EMAIL || 'app-developer@potterwell.com';
const LEGAL_EFFECTIVE_DATE = 'August 18, 2026';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function legalEmailLink(subject = '') {
  const email = escapeHtml(LEGAL_CONTACT_EMAIL);
  const query = subject ? `?subject=${encodeURIComponent(subject)}` : '';
  return `<a href="mailto:${email}${query}">${email}</a>`;
}

function legalPage(title, sections, canonicalPath) {
  const content = sections.map(section => `
    <section>
      <h2>${escapeHtml(section.title)}</h2>
      ${section.body.map(paragraph => `<p>${paragraph}</p>`).join('\n')}
    </section>
  `).join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} | Nine Below</title>
    <meta name="description" content="${escapeHtml(title)} for Nine Below, a Potterwell product." />
    <meta name="robots" content="index,follow" />
    <link rel="canonical" href="${escapeHtml(`${PUBLIC_API_URL}${canonicalPath}`)}" />
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background: #08111f;
        color: #f5f7fb;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.6;
      }
      main {
        width: min(880px, calc(100% - 32px));
        margin: 0 auto;
        padding: 48px 0 64px;
      }
      header {
        border-bottom: 1px solid rgba(255, 255, 255, 0.14);
        margin-bottom: 28px;
        padding-bottom: 20px;
      }
      .eyebrow {
        color: #ffd166;
        font-size: 0.84rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      h1 {
        font-size: clamp(2.1rem, 7vw, 4.6rem);
        line-height: 0.95;
        margin: 10px 0 12px;
      }
      h2 {
        color: #71e2aa;
        font-size: 1.15rem;
        margin: 28px 0 8px;
      }
      p { color: #dbe4f0; margin: 0 0 12px; }
      a { color: #ffd166; }
      .muted { color: #95a3b8; }
      .panel {
        background: rgba(18, 29, 55, 0.75);
        border: 1px solid rgba(113, 226, 170, 0.22);
        border-radius: 8px;
        padding: 18px;
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div class="eyebrow">Nine Below by Potterwell</div>
        <h1>${escapeHtml(title)}</h1>
        <p class="muted">Effective date: ${LEGAL_EFFECTIVE_DATE}</p>
      </header>
      <div class="panel">
        ${content}
      </div>
    </main>
  </body>
</html>`;
}

function sendLegalPage(res, title, sections, canonicalPath) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  res.send(legalPage(title, sections, canonicalPath));
}

app.use('/brand', express.static(PRODUCT_PUBLIC_DIR, {
  fallthrough: false,
  setHeaders: res => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=86400');
  },
}));

app.get('/', (_req, res) => {
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  res.sendFile(path.join(PRODUCT_PUBLIC_DIR, 'index.html'));
});

function sendEarlyAccessPage(res, fileName, options = {}) {
  if (options.private) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  return res.sendFile(path.join(PRODUCT_PUBLIC_DIR, fileName));
}

app.get('/early-access', (_req, res) => sendEarlyAccessPage(res, 'early-access.html'));
app.get('/early-access/confirm', (_req, res) => sendEarlyAccessPage(res, 'early-access-confirm.html', { private: true }));
app.get('/early-access/onboarding', (_req, res) => sendEarlyAccessPage(res, 'early-access-onboarding.html', { private: true }));
app.get('/early-access/feedback', (_req, res) => sendEarlyAccessPage(res, 'early-access-feedback.html', { private: true }));
app.get('/early-access/preferences', (req, res) => {
  if (req.query.token) {
    const result = earlyAccessPreferences(earlyAccessStore, req.query.token, { env: process.env });
    if (result.error) return res.status(404).json({ error: result.error });
    return res.json(result);
  }
  return sendEarlyAccessPage(res, 'early-access-preferences.html', { private: true });
});

app.get('/early-access/config', (_req, res) => {
  const config = publicEarlyAccessConfig(earlyAccessStore);
  const confirmationReady = adminRecoveryEmailEnabled() && earlyAccessSecurityStatus().ready;
  return res.json({
    ...config,
    enrollmentStatus: confirmationReady ? config.enrollmentStatus : 'paused',
    statusMessage: confirmationReady ? config.statusMessage : 'Early-access registration will open soon.',
    platforms: ['ios', 'android', 'web_future'],
  });
});

app.get('/support/ticket', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  res.sendFile(path.join(PRODUCT_PUBLIC_DIR, 'support-ticket.html'));
});

app.get('/health', (_req, res) => res.json({ ok: true, ready: storeReady, env: PUBLIC_ENV, storage: storageStatus() }));
app.get('/health/ready', (_req, res) => {
  if (storeReady) return res.json({ ok: true, ready: true, storage: storageStatus() });
  return res.status(503).json({
    ok: false,
    ready: false,
    error: storeLoadError ? 'Persistence failed to load.' : 'Persistence is still loading.',
    storage: storageStatus(),
  });
});

app.get('/app/availability', (req, res) => {
  const auth = optionalPlayerAuth(req);
  return res.json(publicAvailability(availabilityStore, auth?.user?.userId || null));
});

app.get('/app/release-policy', (req, res) => {
  const client = releaseClientFromHeaders(req.headers) || {
    platform: normalizeReleasePlatform(req.query.platform) || 'android',
    channel: normalizeReleaseChannel(req.query.channel),
    build: Number.parseInt(String(req.query.build || '0'), 10) || 0,
    version: String(req.query.version || ''),
  };
  return res.json(resolveReleasePolicy(releasePolicyStore, client));
});

app.get('/privacy', (_req, res) => sendLegalPage(res, 'Privacy Policy', [
  {
    title: 'What Nine Below Collects',
    body: [
      'Nine Below collects the information needed to run the game, protect accounts, and keep online matches working. This can include your display name, generated user ID, password hash for direct sign-in, linked Google or Facebook account identifiers, invite or tester status, friends, clubs, gameplay history, scores, rankings, virtual currency, cosmetics, chat messages, support requests, and moderation records.',
      'We may also collect basic technical information such as IP address, device or browser details, server logs, crash details, notification push tokens, notification preferences, and connection events so we can secure the service, send requested game alerts, and troubleshoot bugs.',
    ],
  },
  {
    title: 'How We Use Information',
    body: [
      'We use this information to create and secure accounts, verify Google and Facebook sign-ins, match players into rooms, run games, save progress, show leaderboards and profiles, operate chat and social features, send enabled push notifications, provide support, prevent abuse, and improve Nine Below.',
      'Google and Facebook login are used only to verify your identity and link your Nine Below account. Nine Below does not receive your Google or Facebook password.',
    ],
  },
  {
    title: 'Early Access And Testing Email',
    body: [
      'If you join the Nine Below early-access list, we collect your email address, optional first name, mobile platform interests, consent record, signup source, and any optional device, operating-system, or platform-account information you provide after selection. We use this information to confirm your request, organize controlled testing waves, provide installation and invite details, explain testing goals, receive feedback, and send program updates.',
      'Early-access email requires confirmation. Selection is not guaranteed. You can withdraw consent immediately through the preferences or unsubscribe link in any early-access message. Early-access contact information is encrypted in storage and is available only to authorized Potterwell administrators and service providers needed to operate email, hosting, database, and app-store testing.',
    ],
  },
  {
    title: 'Sharing',
    body: [
      'We do not sell personal information. We share information only when needed to operate Nine Below, such as with hosting, database, app-store, authentication, and infrastructure providers, or when required by law or necessary to protect the game and its players.',
      'Some in-game information, such as display name, avatar initial, match activity, scores, profile stats, club membership, and chat messages, may be visible to other players depending on the feature you use.',
    ],
  },
  {
    title: 'Retention And Deletion',
    body: [
      'We keep account and gameplay information while your account is active or as needed to operate Nine Below, resolve disputes, prevent abuse, and satisfy legal or store-platform requirements. While signed in to Nine Below, you can delete your account under <strong>Settings &gt; Account and sign-in &gt; Delete My Account</strong>.',
      'If you no longer have access to the app, use the secure <a href="/account/delete">account deletion web fallback</a>. It verifies account ownership and completes deletion without requiring a manual email request.',
      'When an account is deleted, we will delete or anonymize personal account data where reasonably possible. Some records may be kept if needed for security, fraud prevention, legal compliance, or completed transaction/history integrity.',
      'Unconfirmed early-access records are removed after their confirmation link has been expired for 30 days. Confirmed consent is refreshed after 24 months; if it is not renewed within 30 days of that request, contact information is erased. After an early-access unsubscribe request, contact information is erased within 30 days and a limited suppression record may be retained for up to 24 months so the address is not contacted again.',
    ],
  },
  {
    title: 'Children',
    body: [
      'Nine Below is not intended for children under 13. If you believe a child provided personal information, contact us and we will review the request.',
    ],
  },
  {
    title: 'Contact',
    body: [
      `Questions about this policy can be sent to ${legalEmailLink()}.`,
    ],
  },
], '/privacy'));

app.get('/terms', (_req, res) => sendLegalPage(res, 'Terms of Service', [
  {
    title: 'Using Nine Below',
    body: [
      'By using Nine Below, you agree to play fairly, follow the rules shown in the app, and use the service only for lawful personal entertainment. You are responsible for activity on your account.',
      'Do not cheat, exploit bugs, interfere with servers, harass other players, impersonate others, upload malicious content, or use Nine Below in a way that harms the service or other players.',
    ],
  },
  {
    title: 'Accounts And Access',
    body: [
      'We may limit, suspend, or remove access to accounts or features when needed to protect Nine Below, enforce these terms, respond to abuse, or comply with law or platform requirements.',
      'Online features may change, pause, or be unavailable from time to time while we test, improve, or maintain the app.',
    ],
  },
  {
    title: 'Virtual Items And Progress',
    body: [
      'Nine Below may include virtual currency, rankings, rewards, cosmetics, clubs, and other progression features. These items have no cash value and may be changed, balanced, reset, or removed as the game evolves, especially during testing.',
      'If real-money purchases are added later, additional store terms may apply through Google Play, Apple, or another payment provider.',
    ],
  },
  {
    title: 'Content And Conduct',
    body: [
      'You are responsible for the names, chat messages, club content, and other content you submit. Keep it respectful and do not submit content that is illegal, abusive, hateful, sexually explicit, threatening, infringing, or otherwise harmful.',
      'We may moderate, restrict, or remove content and accounts that violate these terms or disrupt the game.',
    ],
  },
  {
    title: 'Disclaimers',
    body: [
      'Nine Below is provided as is and as available. We do our best to keep the game reliable, but we do not guarantee uninterrupted access, error-free gameplay, or permanent availability of any feature.',
      `For questions, contact ${legalEmailLink()}.`,
    ],
  },
], '/terms'));

app.get('/account/delete', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  res.sendFile(path.join(PRODUCT_PUBLIC_DIR, 'account-delete.html'));
});

app.post('/account/delete/request', accountDeletionRateLimit, async (req, res) => {
  const displayName = cleanPlayerNameCandidate(req.body?.displayName);
  const email = String(req.body?.email || '').trim().toLowerCase();
  const requestId = crypto.randomUUID();
  const user = findDeletionUser(displayName, email);
  const now = Date.now();

  accountDeletionRequests.splice(
    0,
    accountDeletionRequests.length,
    ...normalizeAccountDeletionRequests(accountDeletionRequests, now)
  );

  if (user && email) {
    const code = String(crypto.randomInt(100000, 1000000));
    const expiresAt = now + ACCOUNT_DELETION_CODE_TTL_MS;
    for (let index = accountDeletionRequests.length - 1; index >= 0; index -= 1) {
      if (accountDeletionRequests[index]?.userId === user.userId) accountDeletionRequests.splice(index, 1);
    }
    accountDeletionRequests.push({
      requestId,
      userId: user.userId,
      codeHash: accountDeletionCodeHash(requestId, code),
      createdAt: now,
      expiresAt,
      attempts: 0,
      usedAt: null,
    });
    try {
      await sendAccountDeletionCode({ user, requestId, email, code, expiresAt });
      saveStore();
    } catch (error) {
      const index = accountDeletionRequests.findIndex(entry => entry.requestId === requestId);
      if (index >= 0) accountDeletionRequests.splice(index, 1);
      saveStore();
      console.error('Account deletion verification email failed:', error?.message || error);
    }
  }

  return res.status(202).json({
    ok: true,
    requestId,
    expiresInSeconds: Math.floor(ACCOUNT_DELETION_CODE_TTL_MS / 1000),
    message: 'If the display name and verified email match an account, a verification code has been sent.',
  });
});

app.post('/account/delete/password', accountDeletionRateLimit, async (req, res) => {
  const user = findDeletionUser(req.body?.displayName);
  if (!user) return res.status(401).json({ error: 'Account verification failed.' });
  const verification = await verifyAccountDeletionCredential(user, {
    method: 'password',
    password: req.body?.password,
    confirmation: req.body?.confirmation,
  });
  if (verification.error) {
    const confirmationError = String(req.body?.confirmation || '').trim().toUpperCase() !== 'DELETE';
    return res.status(confirmationError ? 400 : 401).json({ error: verification.error });
  }
  const result = deletePlayerAccount(user, req, 'public-password');
  if (result.error) return res.status(409).json(result);
  return res.json({ ok: true });
});

app.post('/account/delete/confirm', accountDeletionRateLimit, (req, res) => {
  if (String(req.body?.confirmation || '').trim().toUpperCase() !== 'DELETE') {
    return res.status(400).json({ error: 'Type DELETE to confirm account deletion.' });
  }
  const requestId = String(req.body?.requestId || '').trim();
  const code = String(req.body?.code || '').trim();
  const request = accountDeletionRequests.find(entry => entry.requestId === requestId);
  const now = Date.now();
  if (
    !request
    || request.usedAt
    || request.expiresAt <= now
    || request.attempts >= ACCOUNT_DELETION_MAX_ATTEMPTS
  ) {
    return res.status(401).json({ error: 'This verification request is invalid or expired.' });
  }

  request.attempts += 1;
  const validCode = timingSafeTextEqual(
    request.codeHash,
    accountDeletionCodeHash(requestId, code)
  );
  if (!validCode) {
    saveStore();
    return res.status(401).json({ error: 'The verification code is invalid.' });
  }

  const user = users.get(request.userId);
  if (!user) {
    request.usedAt = now;
    saveStore();
    return res.status(404).json({ error: 'This account is no longer available.' });
  }
  const result = deletePlayerAccount(user, req, 'verified-email');
  if (result.error) return res.status(409).json(result);
  return res.json({ ok: true });
});

app.use('/admin', (req, res, next) => {
  const rawUrl = req.originalUrl || req.url || '';
  let decodedUrl = rawUrl;
  try {
    decodedUrl = decodeURIComponent(rawUrl);
  } catch {
    decodedUrl = rawUrl;
  }
  if (/^\/admin\/https?:\/\//i.test(decodedUrl) || /^\/admin\/https?:/i.test(decodedUrl)) {
    return res.redirect(302, '/admin/');
  }
  return next();
});
app.use('/admin', express.static(ADMIN_PUBLIC_DIR));
app.get('/admin', (_req, res) => res.sendFile(path.join(ADMIN_PUBLIC_DIR, 'index.html')));
app.use('/assets/cosmetics', express.static(ASSET_UPLOAD_DIR, {
  fallthrough: false,
  setHeaders: res => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=86400');
  },
}));

app.get('/admin/api/auth/recovery/config', (_req, res) => {
  res.json(adminEmailConfigStatus());
});

app.post('/admin/api/auth/recovery/request', async (req, res) => {
  if (!adminRecoveryEmailEnabled()) return res.status(503).json({ error: 'Admin password recovery email is not configured yet.' });
  try {
    const result = await requestAdminPasswordRecovery(adminStore, req, req.body?.identifier, sendAdminRecoveryCode);
    if (result.changed) saveStore();
    return res.json({ ok: true, message: 'If that admin account can recover by email, a code has been sent.' });
  } catch (error) {
    console.error('Admin password recovery request failed:', error);
    saveStore();
    return res.status(500).json({ error: 'Recovery email could not be sent. Check SMTP settings.' });
  }
});

app.post('/admin/api/auth/recovery/complete', (req, res) => {
  const result = completeAdminPasswordRecovery(adminStore, req, req.body || {});
  if (result.changed) saveStore();
  if (result.error) return res.status(400).json({ error: result.error });
  return res.json({ ok: true });
});

app.get('/admin/api/auth/recovery/test-outbox', requireAdmin(adminStore, 'admin:write'), (_req, res) => {
  if (!ADMIN_EMAIL_TEST_MODE) return res.status(404).json({ error: 'Not found.' });
  return res.json({ messages: adminEmailTestOutbox.slice(-50) });
});

app.post('/admin/api/auth/login', (req, res) => {
  const result = loginAdmin(adminStore, req, req.body?.displayName, req.body?.password);
  if (result.changed) saveStore();
  if (result.error) return res.status(result.status || 401).json({ error: result.error });
  setAdminCookie(res, result.sessionToken, { secure: IS_PRODUCTION });
  saveStore();
  return res.json(result);
});

app.post('/admin/api/auth/mfa/verify', (req, res) => {
  const cookieToken = String(req.headers.cookie || '').match(/(?:^|;\s*)golf9_admin=([^;]+)/)?.[1];
  const headerToken = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const result = verifyAdminMfa(adminStore, req, decodeURIComponent(cookieToken || headerToken || ''), req.body?.code);
  if (result.error) return res.status(403).json({ error: result.error });
  saveStore();
  return res.json(result);
});

app.post('/admin/api/auth/mfa/enroll/start', async (req, res) => {
  const cookieToken = String(req.headers.cookie || '').match(/(?:^|;\s*)golf9_admin=([^;]+)/)?.[1];
  const headerToken = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const result = await startAdminMfaEnrollment(
    adminStore,
    req,
    decodeURIComponent(cookieToken || headerToken || ''),
  );
  if (result.changed) saveStore();
  if (result.error) return res.status(result.status || 400).json({ error: result.error, code: result.code });
  return res.json(result);
});

app.post('/admin/api/auth/mfa/enroll/confirm', (req, res) => {
  const cookieToken = String(req.headers.cookie || '').match(/(?:^|;\s*)golf9_admin=([^;]+)/)?.[1];
  const headerToken = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const result = confirmAdminMfaEnrollment(
    adminStore,
    req,
    decodeURIComponent(cookieToken || headerToken || ''),
    req.body?.code,
  );
  if (result.changed) saveStore();
  if (result.error) return res.status(result.status || 400).json({ error: result.error, code: result.code });
  return res.json(result);
});

app.post('/admin/api/auth/logout', requireAdmin(adminStore), (req, res) => {
  adminStore.adminSessions = adminStore.adminSessions.filter(session => session.token !== req.admin.session.token);
  writeAudit(adminStore, req, req.admin.admin, 'admin.logout', { adminId: req.admin.admin.adminId });
  clearAdminCookie(res, { secure: IS_PRODUCTION });
  saveStore();
  return res.json({ ok: true });
});

app.get('/admin/api/auth/me', requireAdmin(adminStore), (req, res) => res.json({
  admin: publicAdmin(req.admin.admin),
}));

function liveOpsImpactSummary() {
  const waitingRooms = [...rooms.values()].filter(room => room.status === 'lobby');
  const playingRooms = [...rooms.values()].filter(room => room.status === 'playing' && !room.game?.completed);
  return {
    queuedPlayers: rankedQueue.size,
    waitingRooms: waitingRooms.length,
    waitingPlayers: waitingRooms.reduce((total, room) => total + room.players.length, 0),
    activeMatchesProtected: playingRooms.length,
    activePlayersProtected: playingRooms.reduce((total, room) => total + room.players.length, 0),
  };
}

function healthMetric(label, value) {
  return { label, value: String(value ?? 'Not available') };
}

function worstHealthStatus(statuses) {
  const rank = { healthy: 0, warning: 1, critical: 2 };
  return statuses.reduce((worst, status) => (rank[status] > rank[worst] ? status : worst), 'healthy');
}

function smtpHealthMessage(errorCode) {
  const code = safeHealthErrorCode(errorCode).toUpperCase();
  if (code.includes('AUTH') || code.includes('EAUTH') || code === '535') return 'SMTP rejected the configured sender credentials.';
  if (code.includes('CERT') || code.includes('TLS')) return 'SMTP TLS verification failed.';
  if (code.includes('TIMEOUT') || code === 'ETIMEDOUT') return 'SMTP did not answer within the connection timeout.';
  if (code === 'SMTP_NOT_CONFIGURED') return 'Transactional email is not fully configured.';
  return 'The SMTP verification request failed.';
}

function recordOperationalHealthTransitions(checks, checkedAt) {
  for (const check of checks) {
    const previousStatus = operationalHealthStates.get(check.id) || null;
    operationalHealthStates.set(check.id, check.status);
    if (previousStatus === check.status || (!previousStatus && check.status === 'healthy')) continue;
    const event = {
      id: crypto.randomUUID(),
      checkId: check.id,
      title: check.title,
      previousStatus,
      status: check.status,
      summary: check.summary,
      at: checkedAt,
    };
    operationalHealthEvents.unshift(event);
    operationalHealthEvents.splice(50);
    const message = `[health] ${check.title}: ${previousStatus || 'initial'} -> ${check.status} (${check.summary})`;
    if (check.status === 'critical') console.error(message);
    else if (check.status === 'warning') console.warn(message);
    else console.info(message);
  }
}

async function adminHealthReport({ force = false } = {}) {
  const checkedAt = Date.now();
  const [database, smtp] = await Promise.all([
    liveDatabaseHealth({ force }),
    liveSmtpHealth({ force }),
  ]);
  const checks = [];
  const memory = process.memoryUsage();
  const impact = liveOpsImpactSummary();

  checks.push({
    id: 'api-runtime',
    title: 'API & Runtime',
    status: storeReady ? 'healthy' : 'critical',
    summary: storeReady ? 'The Nine Below server is ready and responding.' : 'The server is responding, but persistence is not ready.',
    checkedAt,
    metrics: [
      healthMetric('Uptime', `${Math.floor(process.uptime() / 60).toLocaleString()} min`),
      healthMetric('Memory', `${Math.round(memory.rss / 1024 / 1024).toLocaleString()} MB`),
      healthMetric('Node', process.version),
      healthMetric('Environment', PUBLIC_ENV),
    ],
    details: [
      storeLoadError ? 'Persistence failed during server startup.' : 'HTTP and Socket.IO are running in this process.',
      `Process started ${new Date(Date.now() - (process.uptime() * 1000)).toISOString()}.`,
    ],
    guidance: storeReady ? [] : ['Review the active Railway deployment logs and the Database & Persistence check.'],
  });

  const certificate = databaseCertificateHealth();
  const databaseRuntime = postgresStore?.runtimeStatus?.() || {};
  const saveFailureActive = !!databaseRuntime.lastFailedSaveAt
    && (!databaseRuntime.lastSuccessfulSaveAt || databaseRuntime.lastFailedSaveAt > databaseRuntime.lastSuccessfulSaveAt);
  const pinConfigured = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== '0'
    && !!String(process.env.DATABASE_SSL_CA || '').trim()
    && !!String(process.env.DATABASE_SSL_CA_SHA256 || '').trim();
  const certificateCritical = certificate.error || (certificate.daysRemaining !== null && certificate.daysRemaining < 7);
  const certificateWarning = certificate.daysRemaining !== null && certificate.daysRemaining < 30;
  let databaseStatus = 'healthy';
  if (!database.ok || !storeReady || saveFailureActive || (IS_PRODUCTION && !postgresStore) || certificateCritical) databaseStatus = 'critical';
  else if ((IS_PRODUCTION && !pinConfigured) || certificateWarning) databaseStatus = 'warning';
  const databaseSummary = !database.ok
    ? databaseHealthMessage(database.errorCode)
    : saveFailureActive
      ? 'The database is reachable, but the most recent persistence save failed.'
      : certificateCritical
        ? (certificate.error || 'The pinned database CA expires in less than seven days.')
        : database.provider === 'postgres'
          ? 'A live PostgreSQL query succeeded.'
          : 'Local JSON persistence is active outside production.';
  checks.push({
    id: 'database',
    title: 'Database & Persistence',
    status: databaseStatus,
    summary: databaseSummary,
    checkedAt: database.checkedAt || checkedAt,
    latencyMs: database.latencyMs,
    metrics: [
      healthMetric('Provider', database.provider === 'postgres' ? 'PostgreSQL' : 'Local JSON'),
      healthMetric('Live query', database.ok ? 'Passed' : 'Failed'),
      healthMetric('TLS CA pin', pinConfigured ? 'Verified' : (IS_PRODUCTION ? 'Incomplete' : 'Not required locally')),
      healthMetric('CA remaining', certificate.daysRemaining === null ? 'Not available' : `${certificate.daysRemaining.toLocaleString()} days`),
    ],
    details: [
      database.latencyMs === null ? 'No database latency was recorded.' : `Live SELECT 1 latency was ${database.latencyMs} ms.`,
      certificate.expiresAt ? `The configured CA certificate expires ${new Date(certificate.expiresAt).toISOString()}.` : 'No CA expiration date is available.',
      databaseRuntime.lastSuccessfulSaveAt ? `Last successful queued save: ${new Date(databaseRuntime.lastSuccessfulSaveAt).toISOString()}.` : 'No queued save has completed since this process started.',
      databaseRuntime.lastFailedSaveAt ? `Last failed queued save: ${new Date(databaseRuntime.lastFailedSaveAt).toISOString()} (${safeHealthErrorCode(databaseRuntime.lastSaveErrorCode)}).` : 'No queued save failures have been recorded since this process started.',
    ],
    guidance: databaseStatus === 'healthy' ? [] : [
      'Review Railway PostgreSQL status and the active deployment logs.',
      'If Railway rotated its certificate authority, verify the new CA and fingerprint before updating DATABASE_SSL_CA and DATABASE_SSL_CA_SHA256.',
    ],
  });

  const emailConfig = adminEmailConfigStatus();
  const emailStatus = smtp.ok ? (smtp.mode === 'test' && IS_PRODUCTION ? 'warning' : 'healthy') : (IS_PRODUCTION ? 'critical' : 'warning');
  checks.push({
    id: 'email',
    title: 'Transactional Email',
    status: emailStatus,
    summary: smtp.ok
      ? (smtp.mode === 'test' ? 'Email is being captured by the test outbox.' : 'SMTP accepted a live connection and authentication check.')
      : smtpHealthMessage(smtp.errorCode),
    checkedAt: smtp.checkedAt || checkedAt,
    latencyMs: smtp.latencyMs,
    metrics: [
      healthMetric('Mode', smtp.mode === 'test' ? 'Test outbox' : smtp.mode === 'smtp' ? 'SMTP' : 'Disabled'),
      healthMetric('Sender', emailConfig.fromConfigured ? 'Configured' : 'Missing'),
      healthMetric('Credentials', emailConfig.credentialsConfigured ? 'Configured' : 'Missing'),
      healthMetric('TLS', emailConfig.secure ? 'Implicit TLS' : 'STARTTLS required'),
    ],
    details: [
      smtp.latencyMs === null ? 'No SMTP latency was recorded.' : `SMTP verification latency was ${smtp.latencyMs} ms.`,
      smtp.errorCode ? `Safe provider error code: ${safeHealthErrorCode(smtp.errorCode)}.` : 'No SMTP verification error is active.',
      'Sender addresses and SMTP credentials are deliberately hidden from this dashboard.',
    ],
    guidance: smtp.ok ? [] : ['Review the SMTP variables and provider status, then use Refresh now to run another verification.'],
  });

  const earlySummary = earlyAccessSummary(earlyAccessStore);
  const earlyEmail = earlyAccessCampaignEmailStatus();
  const staleSending = earlyAccessStore.deliveries.filter(delivery => delivery.status === 'sending'
    && Number(delivery.leaseExpiresAt || 0) > 0
    && Number(delivery.leaseExpiresAt) < checkedAt).length;
  let earlyStatus = 'healthy';
  if (!earlyEmail.security.ready || staleSending > 0 || (earlyAccessStore.config.enrollmentStatus === 'open' && !smtp.ok)) earlyStatus = 'critical';
  else if (Number(earlySummary.deliveries.failed || 0) > 0) earlyStatus = 'warning';
  checks.push({
    id: 'early-access',
    title: 'Early Access',
    status: earlyStatus,
    summary: staleSending > 0
      ? `${staleSending.toLocaleString()} email delivery lease(s) are stuck.`
      : Number(earlySummary.deliveries.failed || 0) > 0
        ? `${Number(earlySummary.deliveries.failed).toLocaleString()} early-access delivery attempt(s) need review.`
        : `Registration is ${earlyAccessStore.config.enrollmentStatus}; the delivery queue has no active failures.`,
    checkedAt,
    metrics: [
      healthMetric('Registration', earlyAccessStore.config.enrollmentStatus),
      healthMetric('Confirmed', earlySummary.confirmed),
      healthMetric('Queued', earlySummary.deliveries.queued || 0),
      healthMetric('Failed', earlySummary.deliveries.failed || 0),
    ],
    details: [
      earlyEmail.security.ready ? 'PII encryption and token-signing requirements are satisfied.' : 'Early-access encryption or token-signing configuration is incomplete.',
      earlyEmail.deliveryEnabled ? 'Campaign delivery is enabled.' : 'Campaign delivery is intentionally locked by configuration.',
      earlyEmail.postalAddressConfigured ? 'The campaign postal-address requirement is configured.' : 'The campaign postal-address requirement is not configured, so campaigns remain locked.',
      `${staleSending.toLocaleString()} expired sending lease(s) are awaiting recovery.`,
    ],
    guidance: earlyStatus === 'healthy' ? [] : ['Open the Early Access tab to inspect failed deliveries and campaign state.'],
  });

  const availability = availabilityAdminView(availabilityStore, checkedAt);
  const globalAvailability = availability.entries?.global?.state || 'live';
  const gameStatus = globalAvailability === 'live' ? 'healthy' : 'warning';
  checks.push({
    id: 'game-services',
    title: 'Game Services',
    status: gameStatus,
    summary: globalAvailability === 'live'
      ? 'Player-facing game services are live.'
      : `Global player availability is intentionally set to ${globalAvailability}.`,
    checkedAt,
    metrics: [
      healthMetric('Socket connections', io.engine.clientsCount || 0),
      healthMetric('Active matches', impact.activeMatchesProtected),
      healthMetric('Waiting rooms', impact.waitingRooms),
      healthMetric('Ranked queue', impact.queuedPlayers),
    ],
    details: [
      `${impact.activePlayersProtected.toLocaleString()} player(s) are protected in active matches.`,
      `${impact.waitingPlayers.toLocaleString()} player(s) are currently waiting in rooms.`,
      `${availability.schedules?.length || 0} availability change(s) are scheduled.`,
    ],
    guidance: gameStatus === 'healthy' ? [] : ['Open Live Ops to review the active maintenance message, affected features, and restoration schedule.'],
  });

  const openTickets = adminStore.supportTickets.filter(ticket => !['resolved', 'closed'].includes(ticket.status));
  const agedTickets = openTickets.filter(ticket => checkedAt - Number(ticket.createdAt || checkedAt) > 7 * 24 * 60 * 60 * 1000).length;
  const notificationEnabled = notificationConfig().enabled;
  const operationsStatus = agedTickets > 0 ? 'warning' : 'healthy';
  checks.push({
    id: 'notifications-support',
    title: 'Notifications & Support',
    status: operationsStatus,
    summary: agedTickets > 0
        ? `${agedTickets.toLocaleString()} support ticket(s) have been open for more than seven days.`
        : 'Notification configuration and the support queue have no active warnings.',
    checkedAt,
    metrics: [
      healthMetric('Push', PUSH_TEST_MODE ? 'Test mode' : notificationEnabled ? 'Enabled' : 'Disabled'),
      healthMetric('Open tickets', openTickets.length),
      healthMetric('Older than 7 days', agedTickets),
      healthMetric('Test pushes queued', pushTestOutbox.length),
    ],
    details: [
      PUSH_TEST_MODE ? 'Push messages are being captured by the test outbox.' : EXPO_ACCESS_TOKEN ? 'Expo enhanced push security is configured.' : 'Expo push delivery is using the standard endpoint without enhanced access-token enforcement.',
      'Support requester details remain protected by admin permissions and are not included here.',
    ],
    guidance: operationsStatus === 'healthy' ? [] : ['Open Notifications to review push configuration or Support to triage the oldest tickets.'],
  });

  const publicHttps = PUBLIC_API_URL.startsWith('https://');
  const adminHttps = ADMIN_PUBLIC_URL.startsWith('https://');
  const wildcardCors = CLIENT_ORIGINS.includes('*');
  let securityStatus = 'healthy';
  if (IS_PRODUCTION && (!publicHttps || !adminHttps)) securityStatus = 'critical';
  else if (IS_PRODUCTION && (wildcardCors || ALLOW_UNSAFE_JSON_IN_PRODUCTION)) securityStatus = 'warning';
  const deploymentId = String(process.env.RAILWAY_DEPLOYMENT_ID || '').trim();
  const commitSha = String(process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || '').trim();
  checks.push({
    id: 'security-deployment',
    title: 'Security & Deployment',
    status: securityStatus,
    summary: securityStatus === 'healthy'
      ? 'Production transport and storage safety checks are satisfied.'
      : securityStatus === 'critical'
        ? 'A production URL is not configured for HTTPS.'
        : 'A production safety exception or wildcard client origin is enabled.',
    checkedAt,
    metrics: [
      healthMetric('HTTPS', publicHttps && adminHttps ? 'Required URLs secure' : 'Review URLs'),
      healthMetric('Client origins', wildcardCors ? 'Wildcard' : `${CLIENT_ORIGINS.length} allowed`),
      healthMetric('Deployment', deploymentId ? deploymentId.slice(0, 12) : 'Local / unavailable'),
      healthMetric('Commit', commitSha ? commitSha.slice(0, 12) : 'Unavailable'),
    ],
    details: [
      ALLOW_UNSAFE_JSON_IN_PRODUCTION ? 'Emergency JSON persistence fallback is permitted.' : 'Emergency JSON persistence fallback is disabled.',
      wildcardCors ? 'Socket.IO accepts a wildcard client origin.' : 'Socket.IO client origins are explicitly restricted.',
      'Secret values, database addresses, and account PII are never returned by this endpoint.',
    ],
    guidance: securityStatus === 'healthy' ? [] : ['Review PUBLIC_API_URL, ADMIN_PUBLIC_URL, CLIENT_ORIGINS, and emergency persistence settings in Railway.'],
  });

  recordOperationalHealthTransitions(checks, checkedAt);
  const counts = Object.fromEntries(['healthy', 'warning', 'critical'].map(status => [
    status,
    checks.filter(check => check.status === status).length,
  ]));
  return {
    status: worstHealthStatus(checks.map(check => check.status)),
    checkedAt,
    refreshAfterMs: 10_000,
    counts,
    checks,
    recentEvents: operationalHealthEvents.slice(0, 20),
  };
}

function applyAvailabilityStore(nextStore, revision = null, { reconcile = true } = {}) {
  availabilityStore = normalizeAvailabilityStore(nextStore);
  if (reconcile) reconcileAvailabilityState();
  saveStore();
  io.emit('availability:update', {
    revision: revision?.revision || availabilityStore.revision,
    changedAt: Date.now(),
  });
}

function applyReleasePolicyStore(nextStore, revision = null) {
  releasePolicyStore = normalizeReleasePolicyStore(nextStore);
  saveStore();
  for (const socket of io.sockets.sockets.values()) {
    socket.emit('release-policy:update', releasePolicyForClient(socket.releaseClient));
  }
}

app.get('/admin/api/live-ops', requireAdmin(adminStore, 'availability:read'), (_req, res) => {
  const view = availabilityAdminView(availabilityStore);
  return res.json({
    ...view,
    testers: view.testerUserIds.map(userId => users.get(userId)).filter(Boolean).map(user => ({
      userId: user.userId,
      displayName: user.displayName,
      playerTag: user.playerTag || null,
      level: user.progression?.level || 1,
    })),
    impact: liveOpsImpactSummary(),
    afkConfig: afkConfigStore,
    forfeitConfig: forfeitConfigStore,
    releasePolicy: releasePolicyAdminView(releasePolicyStore),
  });
});

app.post('/admin/api/live-ops/releases/publish', requireAdmin(adminStore, 'availability:write'), (req, res) => {
  try {
    const reason = cleanAdminReason(req.body?.reason);
    const result = publishReleasePolicyChange(releasePolicyStore, {
      platform: req.body?.platform,
      channel: req.body?.channel,
      entry: req.body?.entry,
      actor: req.admin.admin.displayName,
      reason,
    });
    applyReleasePolicyStore(result.store, result.revision);
    writeAudit(adminStore, req, req.admin.admin, 'admin.live_ops.release.publish', {
      platform: req.body?.platform,
      channel: req.body?.channel,
    }, {
      reason,
      latestBuild: result.entry.latestBuild,
      minimumBuild: result.entry.minimumBuild,
      storeReady: result.entry.storeReady,
      enforcement: result.entry.enforcement,
    });
    return res.json({ ok: true, releasePolicy: releasePolicyAdminView(releasePolicyStore) });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post('/admin/api/live-ops/releases/schedule', requireAdmin(adminStore, 'availability:write'), (req, res) => {
  try {
    const reason = cleanAdminReason(req.body?.reason);
    const result = scheduleReleasePolicyChange(releasePolicyStore, {
      platform: req.body?.platform,
      channel: req.body?.channel,
      entry: req.body?.entry,
      activateAt: req.body?.activateAt,
      replace: req.body?.replace === true,
      actor: req.admin.admin.displayName,
      reason,
    });
    applyReleasePolicyStore(result.store, result.revision);
    writeAudit(adminStore, req, req.admin.admin, 'admin.live_ops.release.schedule', {
      key: result.schedule.key,
    }, {
      reason,
      activateAt: result.schedule.activateAt,
      replace: req.body?.replace === true,
    });
    return res.json({ ok: true, releasePolicy: releasePolicyAdminView(releasePolicyStore) });
  } catch (error) {
    const status = /pending schedule/i.test(error.message) ? 409 : 400;
    return res.status(status).json({ error: error.message });
  }
});

app.post('/admin/api/live-ops/releases/schedules/:key/cancel', requireAdmin(adminStore, 'availability:write'), (req, res) => {
  try {
    const reason = cleanAdminReason(req.body?.reason);
    const result = cancelReleasePolicySchedule(releasePolicyStore, req.params.key, {
      actor: req.admin.admin.displayName,
      reason,
    });
    applyReleasePolicyStore(result.store, result.revision);
    writeAudit(adminStore, req, req.admin.admin, 'admin.live_ops.release.schedule.cancel', {
      key: req.params.key,
    }, { reason });
    return res.json({ ok: true, releasePolicy: releasePolicyAdminView(releasePolicyStore) });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post('/admin/api/live-ops/releases/revisions/:revisionId/restore', requireAdmin(adminStore, 'availability:write'), (req, res) => {
  try {
    const reason = cleanAdminReason(req.body?.reason);
    const result = restoreReleasePolicyRevision(releasePolicyStore, req.params.revisionId, {
      actor: req.admin.admin.displayName,
      reason,
    });
    applyReleasePolicyStore(result.store, result.revision);
    writeAudit(adminStore, req, req.admin.admin, 'admin.live_ops.release.revision.restore', {
      revisionId: req.params.revisionId,
    }, {
      reason,
      restoredRevision: result.restoredRevision.revision,
    });
    return res.json({ ok: true, releasePolicy: releasePolicyAdminView(releasePolicyStore) });
  } catch (error) {
    return res.status(/not found/i.test(error.message) ? 404 : 400).json({ error: error.message });
  }
});

app.post('/admin/api/live-ops/afk', requireAdmin(adminStore, 'availability:write'), (req, res) => {
  try {
    const reason = cleanAdminReason(req.body?.reason);
    const previous = afkConfigStore;
    afkConfigStore = normalizeAfkConfig(req.body?.config || {});
    writeAudit(adminStore, req, req.admin.admin, 'admin.live_ops.afk.update', { scope: 'online_matches' }, {
      reason,
      previous,
      next: afkConfigStore,
    });
    saveStore();
    return res.json({ ok: true, afkConfig: afkConfigStore });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post('/admin/api/live-ops/forfeit', requireAdmin(adminStore, 'availability:write'), (req, res) => {
  try {
    const reason = cleanAdminReason(req.body?.reason);
    if (!reason) return res.status(400).json({ error: 'Reason is required.' });
    const previous = forfeitConfigStore;
    forfeitConfigStore = normalizeForfeitConfig(req.body?.config || {});
    writeAudit(adminStore, req, req.admin.admin, 'admin.live_ops.forfeit.update', { scope: 'ranked_matchmaking' }, {
      reason,
      previous,
      next: forfeitConfigStore,
    });
    saveStore();
    return res.json({ ok: true, forfeitConfig: forfeitConfigStore });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.get('/admin/api/live-ops/testers', requireAdmin(adminStore, 'availability:read'), (req, res) => {
  const query = String(req.query.q || '').trim().toLowerCase();
  const matches = activePlayerAccounts()
    .filter(user => !query
      || user.displayName.toLowerCase().includes(query)
      || String(user.playerTag || '').toLowerCase().includes(query)
      || user.userId.toLowerCase().includes(query))
    .slice(0, 50)
    .map(user => ({
      userId: user.userId,
      displayName: user.displayName,
      playerTag: user.playerTag || null,
      level: user.progression?.level || 1,
      selected: availabilityStore.testerUserIds.includes(user.userId),
    }));
  return res.json({ users: matches });
});

app.post('/admin/api/live-ops/testers', requireAdmin(adminStore, 'availability:write'), (req, res) => {
  try {
    const reason = cleanAdminReason(req.body?.reason);
    const testerUserIds = [...new Set((Array.isArray(req.body?.testerUserIds) ? req.body.testerUserIds : [])
      .map(value => String(value || '').trim())
      .filter(userId => users.has(userId) && !isUserArchived(users.get(userId))))];
    const result = updateAvailabilityTesters(availabilityStore, testerUserIds, {
      actor: req.admin.admin.displayName,
      reason,
    });
    applyAvailabilityStore(result.store, result.revision, { reconcile: false });
    writeAudit(adminStore, req, req.admin.admin, 'admin.live_ops.testers.update', { testerCount: testerUserIds.length }, { reason });
    saveStore();
    return res.json({ ok: true, liveOps: availabilityAdminView(availabilityStore) });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post('/admin/api/live-ops/publish', requireAdmin(adminStore, 'availability:write'), (req, res) => {
  try {
    const reason = cleanAdminReason(req.body?.reason);
    const testerUserIds = req.body?.testerUserIds === undefined
      ? undefined
      : [...new Set((Array.isArray(req.body.testerUserIds) ? req.body.testerUserIds : [])
        .map(value => String(value || '').trim())
        .filter(userId => users.has(userId) && !isUserArchived(users.get(userId))))];
    const result = publishAvailabilityChange(availabilityStore, {
      featureKey: req.body?.featureKey,
      entry: req.body?.entry,
      testerUserIds,
      restoreAt: req.body?.restoreAt,
      actor: req.admin.admin.displayName,
      reason,
    });
    applyAvailabilityStore(result.store, result.revision);
    writeAudit(adminStore, req, req.admin.admin, 'admin.live_ops.publish', { featureKey: req.body?.featureKey }, {
      reason,
      state: result.entry.state,
      restoreAt: req.body?.restoreAt || null,
      testerCount: result.store.testerUserIds.length,
    });
    saveStore();
    return res.json({ ok: true, liveOps: availabilityAdminView(availabilityStore), impact: liveOpsImpactSummary() });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post('/admin/api/live-ops/schedule', requireAdmin(adminStore, 'availability:write'), (req, res) => {
  try {
    const reason = cleanAdminReason(req.body?.reason);
    const result = scheduleAvailabilityChange(availabilityStore, {
      featureKey: req.body?.featureKey,
      entry: req.body?.entry,
      activateAt: req.body?.activateAt,
      restoreAt: req.body?.restoreAt,
      replace: req.body?.replace === true,
      actor: req.admin.admin.displayName,
      reason,
    });
    applyAvailabilityStore(result.store, result.revision, { reconcile: false });
    writeAudit(adminStore, req, req.admin.admin, 'admin.live_ops.schedule', { featureKey: req.body?.featureKey }, {
      reason,
      activateAt: result.schedule.activateAt,
      restoreAt: result.schedule.restoreAt,
      replace: req.body?.replace === true,
    });
    saveStore();
    return res.json({ ok: true, liveOps: availabilityAdminView(availabilityStore) });
  } catch (error) {
    const status = /already has a pending schedule/i.test(error.message) ? 409 : 400;
    return res.status(status).json({ error: error.message });
  }
});

app.post('/admin/api/live-ops/schedules/:featureKey/cancel', requireAdmin(adminStore, 'availability:write'), (req, res) => {
  try {
    const reason = cleanAdminReason(req.body?.reason);
    const result = cancelAvailabilitySchedule(availabilityStore, req.params.featureKey, {
      actor: req.admin.admin.displayName,
      reason,
    });
    applyAvailabilityStore(result.store, result.revision);
    writeAudit(adminStore, req, req.admin.admin, 'admin.live_ops.schedule.cancel', { featureKey: req.params.featureKey }, { reason });
    saveStore();
    return res.json({ ok: true, liveOps: availabilityAdminView(availabilityStore) });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post('/admin/api/live-ops/revisions/:revisionId/restore', requireAdmin(adminStore, 'availability:write'), (req, res) => {
  try {
    const reason = cleanAdminReason(req.body?.reason);
    const result = restoreAvailabilityRevision(availabilityStore, req.params.revisionId, {
      actor: req.admin.admin.displayName,
      reason,
    });
    applyAvailabilityStore(result.store, result.revision);
    writeAudit(adminStore, req, req.admin.admin, 'admin.live_ops.revision.restore', { revisionId: req.params.revisionId }, {
      reason,
      restoredRevision: result.restoredRevision.revision,
    });
    saveStore();
    return res.json({ ok: true, liveOps: availabilityAdminView(availabilityStore), impact: liveOpsImpactSummary() });
  } catch (error) {
    return res.status(/not found/i.test(error.message) ? 404 : 400).json({ error: error.message });
  }
});

app.get('/admin/api/admins', requireAdmin(adminStore, 'admin:write'), (_req, res) => {
  res.json({
    admins: adminAccounts(adminStore),
    roles: adminRoleOptions(),
    recovery: { enabled: adminRecoveryEmailEnabled() },
  });
});

app.post('/admin/api/admins', requireAdmin(adminStore, 'admin:write'), (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  const result = createAdminAccount(adminStore, req, req.admin.admin, req.body || {});
  if (result.error) return res.status(result.error.includes('already') ? 409 : 400).json({ error: result.error });
  saveStore();
  return res.status(201).json(result);
});

app.patch('/admin/api/admins/:adminId', requireAdmin(adminStore, 'admin:write'), (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  const result = updateAdminAccount(adminStore, req, req.admin.admin, req.params.adminId, req.body || {});
  if (result.error) return res.status(result.error.includes('not found') ? 404 : result.error.includes('already') ? 409 : 400).json({ error: result.error });
  saveStore();
  return res.json(result);
});

app.post('/admin/api/admins/:adminId/password-reset', requireAdmin(adminStore, 'admin:write'), (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  const result = resetAdminPassword(adminStore, req, req.admin.admin, req.params.adminId, req.body || {});
  if (result.error) return res.status(result.error.includes('not found') ? 404 : 400).json({ error: result.error });
  saveStore();
  return res.json(result);
});

app.post('/admin/api/admins/:adminId/sessions/revoke', requireAdmin(adminStore, 'admin:write'), (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  const targetId = String(req.params.adminId);
  const before = adminStore.adminSessions.length;
  adminStore.adminSessions = adminStore.adminSessions.filter(session => session.adminId !== targetId);
  const revokedSessions = before - adminStore.adminSessions.length;
  writeAudit(adminStore, req, req.admin.admin, 'admin.admins.sessions.revoke', { adminId: targetId }, { reason, revokedSessions });
  saveStore();
  return res.json({ ok: true, revokedSessions });
});

app.get('/admin/api/users', requireAdmin(adminStore, 'users:read'), (req, res) => {
  writeAudit(adminStore, req, req.admin.admin, 'admin.users.search', {}, { query: String(req.query.q || ''), archived: req.query.archived === '1' });
  saveStore();
  return res.json({ users: adminUserList(users, rankedSeason, req.query.q, rankedConfig(), { archived: req.query.archived === '1' }) });
});

function bulkAdminTargets(rawIds, finder) {
  const ids = [...new Set((Array.isArray(rawIds) ? rawIds : [])
    .map(value => String(value || '').trim())
    .filter(Boolean))].slice(0, 250);
  return ids.map(id => {
    const target = finder(id);
    return target ? { id, target } : { id, error: 'Not found.' };
  });
}

function bulkActionResult(id, target, extra = {}) {
  return { id, ok: true, userId: target?.userId, clubId: target?.clubId, name: target?.displayName || target?.name || '', ...extra };
}

app.post('/admin/api/users/bulk', requireAdmin(adminStore), (req, res) => {
  const action = String(req.body?.action || '').trim();
  const reason = cleanAdminReason(req.body?.reason);
  const permissionByAction = {
    revokeSessions: 'users:write',
    archive: 'users:write',
    restore: 'users:write',
    grantCoins: 'economy:write',
    grantXp: 'economy:write',
    chat_mute: 'moderation:write',
    suspension: 'moderation:write',
    account_ban: 'moderation:write',
    clear_moderation: 'moderation:write',
  };
  const requiredPermission = permissionByAction[action];
  if (!requiredPermission) return res.status(400).json({ error: 'Unsupported bulk player action.' });
  if (!adminHasPermission(req.admin.admin, requiredPermission)) return res.status(403).json({ error: 'Admin permission denied.' });
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });

  const targets = bulkAdminTargets(req.body?.userIds, findUserByIdentifier);
  if (!targets.length) return res.status(400).json({ error: 'Select at least one player.' });
  const amount = Math.trunc(Number(req.body?.amount) || 0);
  const durationMs = Math.max(0, Math.trunc(Number(req.body?.durationMs) || 0));
  if ((action === 'grantCoins' || action === 'grantXp') && (!Number.isFinite(amount) || amount === 0)) {
    return res.status(400).json({ error: 'Bulk amount is required.' });
  }

  const resultsOut = [];
  for (const item of targets) {
    if (item.error) {
      resultsOut.push({ id: item.id, ok: false, error: item.error });
      continue;
    }
    const user = item.target;
    try {
      if (action === 'revokeSessions') {
        resultsOut.push(bulkActionResult(item.id, user, { revoked: revokeUserSessions(user.userId) }));
      } else if (action === 'archive') {
        normalizeUserAdminFields(user);
        const wasArchived = isUserArchived(user);
        const timestamp = Date.now();
        user.adminArchive.archivedAt = timestamp;
        user.adminArchive.archivedBy = req.admin.admin.adminId;
        user.adminArchive.archivedByName = req.admin.admin.displayName;
        user.adminArchive.archiveReason = reason;
        user.adminArchive.restoredAt = null;
        user.adminArchive.restoredBy = null;
        user.adminArchive.restoredByName = null;
        user.adminArchive.restoreReason = null;
        const revokedSessions = revokeUserSessions(user.userId);
        normalizePushNotifications(user).tokens = [];
        rankedQueue.delete(user.userId);
        io.to(`user:${user.userId}`).emit('account:archived', { archivedAt: user.adminArchive.archivedAt });
        resultsOut.push(bulkActionResult(item.id, user, { wasArchived, revokedSessions }));
      } else if (action === 'restore') {
        normalizeUserAdminFields(user);
        const wasArchived = isUserArchived(user);
        const timestamp = Date.now();
        user.adminArchive.restoredAt = timestamp;
        user.adminArchive.restoredBy = req.admin.admin.adminId;
        user.adminArchive.restoredByName = req.admin.admin.displayName;
        user.adminArchive.restoreReason = reason;
        resultsOut.push(bulkActionResult(item.id, user, { wasArchived }));
      } else if (action === 'grantCoins') {
        user.currency ||= { coins: 0, lifetimeCoins: 0 };
        const before = user.currency.coins || 0;
        user.currency.coins = Math.max(0, before + amount);
        if (amount > 0) user.currency.lifetimeCoins = Math.max(user.currency.lifetimeCoins || 0, user.currency.coins);
        resultsOut.push(bulkActionResult(item.id, user, { before, after: user.currency.coins }));
      } else if (action === 'grantXp') {
        normalizeUserRecord(user);
        const before = { ...user.progression };
        user.progression = { totalXp: Math.max(0, before.totalXp + amount) };
        normalizeUserRecord(user);
        resultsOut.push(bulkActionResult(item.id, user, { before, after: user.progression }));
      } else {
        user.moderation ||= {};
        if (action === 'clear_moderation') {
          user.moderation = { accountBannedAt: null, suspendedUntil: null, chatMutedUntil: null, reason: '', updatedAt: Date.now() };
          for (const ban of adminStore.bans) {
            if (ban.userId === user.userId) ban.revokedAt = Date.now();
          }
        } else if (action === 'chat_mute') {
          user.moderation.chatMutedUntil = Date.now() + (durationMs || 24 * 60 * 60 * 1000);
        } else if (action === 'suspension') {
          user.moderation.suspendedUntil = Date.now() + (durationMs || 24 * 60 * 60 * 1000);
        } else if (action === 'account_ban') {
          user.moderation.accountBannedAt = Date.now();
        }
        if (action !== 'clear_moderation') {
          user.moderation.reason = reason;
          user.moderation.updatedAt = Date.now();
          adminStore.bans.push({
            banId: crypto.randomUUID(),
            type: action,
            userId: user.userId,
            deviceHash: null,
            reason,
            createdAt: Date.now(),
            expiresAt: durationMs ? Date.now() + durationMs : null,
            revokedAt: null,
            createdBy: req.admin.admin.adminId,
          });
        }
        resultsOut.push(bulkActionResult(item.id, user));
      }
    } catch (error) {
      resultsOut.push({ id: item.id, ok: false, userId: user.userId, name: user.displayName, error: error.message });
    }
  }

  writeAudit(adminStore, req, req.admin.admin, `admin.users.bulk.${action}`, {}, {
    reason,
    requested: targets.length,
    succeeded: resultsOut.filter(item => item.ok).length,
    failed: resultsOut.filter(item => !item.ok).length,
    amount: action === 'grantCoins' || action === 'grantXp' ? amount : undefined,
    durationMs: durationMs || undefined,
  });
  saveStore();
  return res.json({ ok: true, results: resultsOut });
});

app.get('/admin/api/users/:userId', requireAdmin(adminStore, 'users:read'), (req, res) => {
  const user = findUserByIdentifier(req.params.userId);
  if (!user) return res.status(404).json({ error: 'Player not found.' });
  writeAudit(adminStore, req, req.admin.admin, 'admin.users.read', { userId: user.userId });
  saveStore();
  return res.json({
    user: adminPlayerDetail(user),
  });
});

app.post('/admin/api/users/:userId/forfeit-discipline', requireAdmin(adminStore, 'competitive:write'), (req, res) => {
  const user = findUserByIdentifier(req.params.userId);
  if (!user) return res.status(404).json({ error: 'Player not found.' });
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  const action = String(req.body?.action || '');
  const before = structuredClone(normalizeForfeitDiscipline(user));
  if (action === 'lift') {
    setRankedForfeitRestriction(user, null);
  } else if (action === 'reset') {
    resetForfeitDiscipline(user);
  } else if (action === 'set') {
    const durationHours = Math.trunc(Number(req.body?.durationHours));
    if (!Number.isFinite(durationHours) || durationHours < 1 || durationHours > 24 * 365) {
      return res.status(400).json({ error: 'Restriction duration must be between 1 and 8760 hours.' });
    }
    setRankedForfeitRestriction(user, Date.now() + (durationHours * 60 * 60 * 1000));
  } else {
    return res.status(400).json({ error: 'Choose lift, reset, or set.' });
  }
  rankedQueue.delete(user.userId);
  const after = structuredClone(normalizeForfeitDiscipline(user));
  writeAudit(adminStore, req, req.admin.admin, `admin.users.forfeit.${action}`, { userId: user.userId }, {
    reason,
    before,
    after,
  });
  saveStore();
  return res.json({ user: adminPlayerDetail(user) });
});

app.patch('/admin/api/users/:userId/profile', requireAdmin(adminStore, 'users:write'), (req, res) => {
  const user = findUserByIdentifier(req.params.userId);
  if (!user) return res.status(404).json({ error: 'Player not found.' });
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  const before = { displayName: user.displayName };
  const displayNameCheck = validateNewDisplayName(req.body?.displayName ?? user.displayName, user.userId);
  if (displayNameCheck.error) return res.status(displayNameCheck.error.includes('taken') ? 409 : 400).json({ error: displayNameCheck.error });
  user.displayName = displayNameCheck.displayName;
  writeAudit(adminStore, req, req.admin.admin, 'admin.users.profile.update', { userId: user.userId }, { reason, before, after: { displayName: user.displayName } });
  saveStore();
  return res.json({ user: safeUser(user) });
});

app.post('/admin/api/users/:userId/password-reset', requireAdmin(adminStore, 'users:write'), (req, res) => {
  const user = findUserByIdentifier(req.params.userId);
  if (!user) return res.status(404).json({ error: 'Player not found.' });
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  const temporaryPassword = String(req.body?.temporaryPassword || crypto.randomBytes(6).toString('base64url'));
  if (temporaryPassword.length < 6) return res.status(400).json({ error: 'Temporary password must be at least 6 characters.' });
  const credentials = hashPassword(temporaryPassword);
  user.salt = credentials.salt;
  user.passwordHash = credentials.passwordHash;
  user.forcePasswordChange = true;
  sessions.forEach((session, token) => {
    if (session.userId === user.userId) sessions.delete(token);
  });
  writeAudit(adminStore, req, req.admin.admin, 'admin.users.password.reset', { userId: user.userId }, { reason });
  saveStore();
  return res.json({ ok: true, temporaryPassword });
});

app.post('/admin/api/users/:userId/sessions/revoke', requireAdmin(adminStore, 'users:write'), (req, res) => {
  const user = findUserByIdentifier(req.params.userId);
  if (!user) return res.status(404).json({ error: 'Player not found.' });
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  let revoked = 0;
  sessions.forEach((session, token) => {
    if (session.userId === user.userId) {
      sessions.delete(token);
      revoked += 1;
    }
  });
  writeAudit(adminStore, req, req.admin.admin, 'admin.users.sessions.revoke', { userId: user.userId }, { reason, revoked });
  saveStore();
  return res.json({ ok: true, revoked });
});

app.post('/admin/api/users/:userId/archive', requireAdmin(adminStore, 'users:write'), (req, res) => {
  const user = findUserByIdentifier(req.params.userId);
  if (!user) return res.status(404).json({ error: 'Player not found.' });
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  normalizeUserAdminFields(user);
  const wasArchived = isUserArchived(user);
  const timestamp = Date.now();
  user.adminArchive.archivedAt = timestamp;
  user.adminArchive.archivedBy = req.admin.admin.adminId;
  user.adminArchive.archivedByName = req.admin.admin.displayName;
  user.adminArchive.archiveReason = reason;
  user.adminArchive.restoredAt = null;
  user.adminArchive.restoredBy = null;
  user.adminArchive.restoredByName = null;
  user.adminArchive.restoreReason = null;
  const revokedSessions = revokeUserSessions(user.userId);
  normalizePushNotifications(user).tokens = [];
  rankedQueue.delete(user.userId);
  io.to(`user:${user.userId}`).emit('account:archived', { archivedAt: user.adminArchive.archivedAt });
  writeAudit(adminStore, req, req.admin.admin, 'admin.users.archive', { userId: user.userId }, { reason, wasArchived, revokedSessions });
  saveStore();
  return res.json({
    user: adminPlayerDetail(user),
    revokedSessions,
  });
});

app.post('/admin/api/users/:userId/restore', requireAdmin(adminStore, 'users:write'), (req, res) => {
  const user = findUserByIdentifier(req.params.userId);
  if (!user) return res.status(404).json({ error: 'Player not found.' });
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  normalizeUserAdminFields(user);
  const wasArchived = isUserArchived(user);
  const timestamp = Date.now();
  user.adminArchive.restoredAt = timestamp;
  user.adminArchive.restoredBy = req.admin.admin.adminId;
  user.adminArchive.restoredByName = req.admin.admin.displayName;
  user.adminArchive.restoreReason = reason;
  writeAudit(adminStore, req, req.admin.admin, 'admin.users.restore', { userId: user.userId }, { reason, wasArchived });
  saveStore();
  return res.json({
    user: adminPlayerDetail(user),
  });
});

app.post('/admin/api/users/:userId/coins/adjust', requireAdmin(adminStore, 'economy:write'), (req, res) => {
  const user = findUserByIdentifier(req.params.userId);
  if (!user) return res.status(404).json({ error: 'Player not found.' });
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  const amount = Math.trunc(Number(req.body?.amount) || 0);
  if (!Number.isFinite(amount) || amount === 0) return res.status(400).json({ error: 'Coin adjustment amount is required.' });
  user.currency ||= { coins: 0, lifetimeCoins: 0 };
  const before = user.currency.coins || 0;
  user.currency.coins = Math.max(0, before + amount);
  if (amount > 0) user.currency.lifetimeCoins = Math.max(user.currency.lifetimeCoins || 0, user.currency.coins);
  writeAudit(adminStore, req, req.admin.admin, 'admin.users.coins.adjust', { userId: user.userId }, { reason, amount, before, after: user.currency.coins });
  saveStore();
  return res.json({ user: safeUser(user), before, after: user.currency.coins });
});

app.post('/admin/api/users/:userId/progression/adjust', requireAdmin(adminStore, 'economy:write'), (req, res) => {
  const user = findUserByIdentifier(req.params.userId);
  if (!user) return res.status(404).json({ error: 'Player not found.' });
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  normalizeUserRecord(user);
  const before = { ...user.progression };
  const hasXpDelta = req.body?.xpDelta !== undefined && req.body?.xpDelta !== null && String(req.body.xpDelta).trim() !== '';
  const hasTotalXp = req.body?.totalXp !== undefined && req.body?.totalXp !== null && String(req.body.totalXp).trim() !== '';
  const hasLevel = req.body?.level !== undefined && req.body?.level !== null && String(req.body.level).trim() !== '';
  const operationCount = [hasXpDelta, hasTotalXp, hasLevel].filter(Boolean).length;
  if (operationCount !== 1) return res.status(400).json({ error: 'Provide exactly one progression operation: XP delta, total XP, or target level.' });

  let operation = 'xpDelta';
  let value = 0;
  let nextTotalXp = before.totalXp;
  if (hasXpDelta) {
    value = Math.trunc(Number(req.body.xpDelta));
    if (!Number.isFinite(value) || value === 0) return res.status(400).json({ error: 'XP adjustment amount is required.' });
    nextTotalXp = Math.max(0, before.totalXp + value);
  }
  if (hasTotalXp) {
    operation = 'totalXp';
    value = Math.trunc(Number(req.body.totalXp));
    if (!Number.isFinite(value) || value < 0) return res.status(400).json({ error: 'Total XP must be zero or greater.' });
    nextTotalXp = value;
  }
  if (hasLevel) {
    operation = 'level';
    value = Math.trunc(Number(req.body.level));
    if (!Number.isFinite(value) || value < 1 || value > 500) return res.status(400).json({ error: 'Target level must be between 1 and 500.' });
    nextTotalXp = totalXpForLevelStart(value);
  }

  user.progression = { totalXp: nextTotalXp };
  normalizeUserRecord(user);
  const after = { ...user.progression };
  writeAudit(adminStore, req, req.admin.admin, 'admin.users.progression.adjust', { userId: user.userId }, { reason, operation, value, before, after });
  saveStore();
  return res.json({ user: safeUser(user), before, after });
});

app.post('/admin/api/users/:userId/competitive/adjust', requireAdmin(adminStore, 'competitive:write'), (req, res) => {
  const user = findUserByIdentifier(req.params.userId);
  if (!user) return res.status(404).json({ error: 'Player not found.' });
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  const result = normalizeAdminCompetitiveAdjustment(user, req.body || {});
  writeAudit(adminStore, req, req.admin.admin, 'admin.users.competitive.adjust', { userId: user.userId }, { reason, before: result.before, after: result.after });
  saveStore();
  return res.json({ user: safeUser(user), competitive: result.after });
});

app.post('/admin/api/users/:userId/cosmetics/grant', requireAdmin(adminStore, 'cosmetics:write'), (req, res) => {
  const user = findUserByIdentifier(req.params.userId);
  if (!user) return res.status(404).json({ error: 'Player not found.' });
  const reason = cleanAdminReason(req.body?.reason);
  const cosmeticId = String(req.body?.cosmeticId || '');
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  const catalog = cosmeticsFor(user);
  const item = catalog.find(cosmetic => cosmetic.id === cosmeticId);
  if (!item) return res.status(404).json({ error: 'Cosmetic not found.' });
  user.inventory ||= { cosmetics: [], equipped: {} };
  if (!user.inventory.cosmetics.includes(cosmeticId)) user.inventory.cosmetics.push(cosmeticId);
  writeAudit(adminStore, req, req.admin.admin, 'admin.users.cosmetics.grant', { userId: user.userId, cosmeticId }, { reason });
  saveStore();
  return res.json({ user: safeUser(user), cosmetics: cosmeticsFor(user) });
});

app.post('/admin/api/users/:userId/cosmetics/revoke', requireAdmin(adminStore, 'cosmetics:write'), (req, res) => {
  const user = findUserByIdentifier(req.params.userId);
  if (!user) return res.status(404).json({ error: 'Player not found.' });
  const reason = cleanAdminReason(req.body?.reason);
  const cosmeticId = String(req.body?.cosmeticId || '');
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  user.inventory ||= { cosmetics: [], equipped: {} };
  user.inventory.cosmetics = user.inventory.cosmetics.filter(id => id !== cosmeticId);
  for (const [slot, equippedId] of Object.entries(user.inventory.equipped || {})) {
    if (equippedId === cosmeticId) delete user.inventory.equipped[slot];
  }
  normalizeUserRecord(user);
  writeAudit(adminStore, req, req.admin.admin, 'admin.users.cosmetics.revoke', { userId: user.userId, cosmeticId }, { reason });
  saveStore();
  return res.json({ user: safeUser(user), cosmetics: cosmeticsFor(user) });
});

app.post('/admin/api/users/:userId/cosmetics/equip', requireAdmin(adminStore, 'cosmetics:write'), (req, res) => {
  const user = findUserByIdentifier(req.params.userId);
  if (!user) return res.status(404).json({ error: 'Player not found.' });
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  const result = equipCosmetic(user, String(req.body?.cosmeticId || ''), currentCatalog(), rankedSeason, rankedConfig());
  if (result.error) return res.status(400).json({ error: result.error });
  writeAudit(adminStore, req, req.admin.admin, 'admin.users.cosmetics.equip', { userId: user.userId, cosmeticId: req.body?.cosmeticId }, { reason });
  saveStore();
  return res.json({ user: safeUser(user), cosmetics: cosmeticsFor(user) });
});

app.post('/admin/api/users/:userId/moderation', requireAdmin(adminStore, 'moderation:write'), (req, res) => {
  const user = findUserByIdentifier(req.params.userId);
  if (!user) return res.status(404).json({ error: 'Player not found.' });
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  const action = String(req.body?.action || 'account_ban');
  const durationMs = Math.max(0, Math.trunc(Number(req.body?.durationMs) || 0));
  const deviceHash = String(req.body?.deviceHash || user.knownDevices?.[0]?.deviceHash || '');
  if (action === 'clear') {
    user.moderation = { accountBannedAt: null, suspendedUntil: null, chatMutedUntil: null, reason: '', updatedAt: Date.now() };
    for (const ban of adminStore.bans) {
      if (ban.userId === user.userId || (deviceHash && ban.deviceHash === deviceHash)) ban.revokedAt = Date.now();
    }
  } else if (action === 'chat_mute') {
    user.moderation.chatMutedUntil = durationMs ? Date.now() + durationMs : null;
  } else if (action === 'suspension') {
    user.moderation.suspendedUntil = Date.now() + (durationMs || 24 * 60 * 60 * 1000);
  } else {
    user.moderation.accountBannedAt = Date.now();
  }
  user.moderation.reason = reason;
  user.moderation.updatedAt = Date.now();
  if (action !== 'clear') {
    adminStore.bans.push({
      banId: crypto.randomUUID(),
      type: action === 'device_ban' ? 'device_ban' : action === 'chat_mute' ? 'chat_mute' : action === 'suspension' ? 'suspension' : 'account_ban',
      userId: action === 'device_ban' ? null : user.userId,
      deviceHash: action === 'device_ban' ? deviceHash : null,
      reason,
      createdAt: Date.now(),
      expiresAt: durationMs ? Date.now() + durationMs : null,
      revokedAt: null,
      createdBy: req.admin.admin.adminId,
    });
  }
  writeAudit(adminStore, req, req.admin.admin, 'admin.users.moderation', { userId: user.userId }, { reason, action, durationMs, deviceHash: deviceHash || null });
  saveStore();
  return res.json({ user: safeUser(user), bans: activeBansFor(adminStore, user, deviceHash) });
});

app.get('/admin/api/support/tickets', requireAdmin(adminStore, 'support:read'), (req, res) => {
  const includePii = adminHasPermission(req.admin.admin, 'earlyAccess:piiRead');
  return res.json({
    tickets: adminTickets(adminStore, req.query.status).map(ticket => hydrateEarlyAccessSupportTicket(ticket, { includePii })),
  });
});

app.patch('/admin/api/support/tickets/:ticketId', requireAdmin(adminStore, 'support:write'), async (req, res) => {
  const result = updateSupportTicket(adminStore, req.params.ticketId, req.body || {});
  if (result.error) return res.status(404).json({ error: result.error });
  const notificationTicket = hydrateEarlyAccessSupportTicket(result.ticket);
  result.ticket = hydrateEarlyAccessSupportTicket(result.ticket, {
    includePii: adminHasPermission(req.admin.admin, 'earlyAccess:piiRead'),
  });
  writeAudit(adminStore, req, req.admin.admin, 'admin.support.ticket.update', { ticketId: req.params.ticketId }, req.body || {});
  saveStore();
  if (result.previousStatus !== result.ticket.status && result.ticket.publicAccessEnabled) {
    const statusMessage = result.ticket.status === 'resolved'
      ? 'Your support case has been marked resolved. Reply through your private case link if you still need help.'
      : result.ticket.status === 'closed'
        ? 'Your support case has been closed. This message is your closure receipt.'
        : `Your support case is now ${String(result.ticket.status).replaceAll('_', ' ')}.`;
    await sendSupportRequesterUpdate(notificationTicket, statusMessage, result.ticket.status);
  }
  return res.json(result);
});

app.post('/admin/api/support/tickets/:ticketId/notes', requireAdmin(adminStore, 'support:write'), async (req, res) => {
  const isPublic = req.body?.public === true;
  const result = addSupportNote(adminStore, req.params.ticketId, req.admin.admin, req.body?.note, { public: isPublic });
  if (result.error) return res.status(400).json({ error: result.error });
  const notificationTicket = hydrateEarlyAccessSupportTicket(result.ticket);
  result.ticket = hydrateEarlyAccessSupportTicket(result.ticket, {
    includePii: adminHasPermission(req.admin.admin, 'earlyAccess:piiRead'),
  });
  writeAudit(adminStore, req, req.admin.admin, 'admin.support.ticket.note', { ticketId: req.params.ticketId }, { public: isPublic });
  saveStore();
  if (isPublic && result.ticket.publicAccessEnabled) {
    await sendSupportRequesterUpdate(notificationTicket, req.body?.note, result.ticket.status);
  }
  return res.json(result);
});

function adminMailRecipients(body = {}) {
  const mode = String(body.targetType || body.mode || 'all').trim();
  if (mode === 'all') return { recipients: activePlayerAccounts(), targetLabel: 'all' };
  const rawTargets = String(body.targetUsers || body.target || body.userId || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  if (!rawTargets.length) return { error: 'Enter at least one recipient.' };
  const recipients = [];
  const missing = [];
  for (const raw of rawTargets) {
    const user = findUserByIdentifier(raw);
    if (!user || !visiblePlayer(user)) missing.push(raw);
    else recipients.push(user);
  }
  if (missing.length) return { error: `Recipient not found or archived: ${missing.slice(0, 3).join(', ')}` };
  return { recipients, targetLabel: mode === 'one' ? rawTargets[0] : `${rawTargets.length} selected` };
}

app.get('/admin/api/mail', requireAdmin(adminStore, 'mail:read'), (_req, res) => res.json({
  history: adminMailLog(mailEntries),
  cosmetics: liveCatalog(catalogStore).filter(item => item.enabled !== false && !item.archivedAt),
}));

app.post('/admin/api/mail', requireAdmin(adminStore, 'mail:write'), (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  const recipientResult = adminMailRecipients(req.body || {});
  if (recipientResult.error) return res.status(400).json({ error: recipientResult.error });
  const result = createSystemMail(mailEntries, recipientResult.recipients, req.admin.admin, req.body || {}, liveCatalog(catalogStore));
  if (result.error) return res.status(400).json({ error: result.error });
  let pushed = 0;
  for (const user of recipientResult.recipients) {
    if (queueConfiguredPushToUser(user.userId, 'mail', {
      keyName: 'mail',
      dedupeKey: `mail:${result.batchId}:${user.userId}`,
      templateData: { title: req.body?.title || 'New Nine Below mail', displayName: user.displayName },
      data: { type: 'mail', batchId: result.batchId },
    })) pushed += 1;
    io.to(`user:${user.userId}`).emit('mail:update', mailSummaryForUser(mailEntries, user.userId));
  }
  writeAudit(adminStore, req, req.admin.admin, 'admin.mail.send', { batchId: result.batchId }, {
    reason,
    target: recipientResult.targetLabel,
    recipientCount: result.count,
    pushQueued: pushed,
    attachments: result.attachments,
  });
  saveStore();
  return res.status(201).json({ ...result, pushQueued: pushed, history: adminMailLog(mailEntries) });
});

app.get('/admin/api/audit', requireAdmin(adminStore, 'audit:read'), (_req, res) => res.json({ audit: adminStore.adminAudit.slice().reverse().slice(0, 250) }));
app.get('/admin/api/catalog/cosmetics', requireAdmin(adminStore, 'catalog:read'), (req, res) => {
  const user = req.query.userId ? findUserByIdentifier(req.query.userId) : [...users.values()][0];
  return res.json({
    live: liveCatalog(catalogStore),
    draft: draftCatalog(catalogStore),
    cosmetics: user ? cosmeticsFor(user) : liveCatalog(catalogStore),
    assetRequirements: catalogAssetRequirements(),
  });
});

app.get('/admin/api/catalog/asset-requirements', requireAdmin(adminStore, 'catalog:read'), (_req, res) => {
  res.json({ assetRequirements: catalogAssetRequirements() });
});

app.post('/admin/api/catalog/cosmetics', requireAdmin(adminStore, 'catalog:write'), (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  const result = saveDraftCatalogItem(catalogStore, req.body?.item || req.body || {});
  if (result.error) return res.status(400).json({ error: result.error });
  writeAudit(adminStore, req, req.admin.admin, 'admin.catalog.cosmetic.create', { cosmeticId: result.item.id }, { reason });
  saveStore();
  return res.json({ item: result.item, draft: draftCatalog(catalogStore) });
});

app.patch('/admin/api/catalog/cosmetics/:id', requireAdmin(adminStore, 'catalog:write'), (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  const result = saveDraftCatalogItem(catalogStore, { ...(req.body?.item || req.body || {}), id: req.params.id });
  if (result.error) return res.status(400).json({ error: result.error });
  writeAudit(adminStore, req, req.admin.admin, 'admin.catalog.cosmetic.update', { cosmeticId: result.item.id }, { reason });
  saveStore();
  return res.json({ item: result.item, draft: draftCatalog(catalogStore) });
});

app.post('/admin/api/catalog/cosmetics/:id/asset', requireAdmin(adminStore, 'catalog:write'), (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  const result = uploadCatalogAsset(catalogStore, ASSET_UPLOAD_DIR, '/assets/cosmetics', req.params.id, req.body || {});
  if (result.error) return res.status(400).json({ error: result.error });
  writeAudit(adminStore, req, req.admin.admin, 'admin.catalog.cosmetic.asset.upload', { cosmeticId: req.params.id }, { reason, asset: result.asset });
  saveStore();
  return res.json({ item: result.item, asset: result.asset });
});

app.post('/admin/api/catalog/cosmetics/:id/duplicate', requireAdmin(adminStore, 'catalog:write'), (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  const result = duplicateDraftCatalogItem(catalogStore, req.params.id);
  if (result.error) return res.status(404).json({ error: result.error });
  writeAudit(adminStore, req, req.admin.admin, 'admin.catalog.cosmetic.duplicate', { cosmeticId: req.params.id, newCosmeticId: result.item.id }, { reason });
  saveStore();
  return res.json({ item: result.item, draft: draftCatalog(catalogStore) });
});

app.post('/admin/api/catalog/cosmetics/:id/archive', requireAdmin(adminStore, 'catalog:write'), (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  const result = archiveDraftCatalogItem(catalogStore, req.params.id);
  if (result.error) return res.status(404).json({ error: result.error });
  writeAudit(adminStore, req, req.admin.admin, 'admin.catalog.cosmetic.archive', { cosmeticId: req.params.id }, { reason });
  saveStore();
  return res.json({ item: result.item, draft: draftCatalog(catalogStore) });
});

app.post('/admin/api/catalog/publish', requireAdmin(adminStore, 'catalog:write'), (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  const result = publishCatalog(catalogStore, req.admin.admin.displayName);
  writeAudit(adminStore, req, req.admin.admin, 'admin.catalog.publish', { versionId: result.version?.versionId }, { reason, itemCount: result.cosmetics.length });
  saveStore();
  return res.json(result);
});

app.get('/admin/api/catalog/versions', requireAdmin(adminStore, 'catalog:read'), (_req, res) => {
  return res.json({ versions: catalogStore.versions.slice().reverse().map(version => ({ ...version, items: undefined, itemCount: version.items?.length || 0 })) });
});

app.post('/admin/api/catalog/versions/:versionId/rollback', requireAdmin(adminStore, 'catalog:write'), (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  const result = rollbackCatalog(catalogStore, req.params.versionId);
  if (result.error) return res.status(404).json({ error: result.error });
  writeAudit(adminStore, req, req.admin.admin, 'admin.catalog.rollback', { versionId: req.params.versionId }, { reason });
  saveStore();
  return res.json(result);
});

app.get('/admin/api/economy', requireAdmin(adminStore, 'metrics:read'), (_req, res) => {
  const config = economyConfig();
  return res.json({ economy: adminEconomySummary(users, config), config });
});

app.patch('/admin/api/economy/config', requireAdmin(adminStore, 'economy:write'), (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  const before = economyConfig();
  const next = normalizeEconomyConfigStore({
    ...economyStore,
    ...(req.body?.config || req.body || {}),
    updatedAt: Date.now(),
    updatedBy: req.admin.admin.displayName,
  });
  Object.assign(economyStore, next);
  writeAudit(adminStore, req, req.admin.admin, 'admin.economy.config.update', {}, { reason, before, after: next });
  saveStore();
  return res.json({ economy: adminEconomySummary(users, next), config: next });
});

app.get('/admin/api/competitive/overview', requireAdmin(adminStore, 'competitive:read'), (_req, res) => res.json({ overview: adminCompetitiveOverview() }));

app.get('/admin/api/competitive/config', requireAdmin(adminStore, 'competitive:read'), (_req, res) => {
  const config = publicCompetitiveAdminConfig(competitiveStore);
  res.json({ ...config, preflight: validateCompetitiveConfig(config.draft) });
});

app.patch('/admin/api/competitive/config/draft', requireAdmin(adminStore, 'competitive:write'), (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  const result = saveDraftCompetitiveConfig(competitiveStore, req.body?.config || req.body || {});
  const preflight = validateCompetitiveConfig(result.draft);
  writeAudit(adminStore, req, req.admin.admin, 'admin.competitive.config.update', {}, { reason });
  saveStore();
  return res.json({ draft: result.draft, preflight });
});

app.post('/admin/api/competitive/config/publish', requireAdmin(adminStore, 'competitive:write'), (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  const preflight = validateCompetitiveConfig(draftCompetitiveConfig(competitiveStore));
  if (!preflight.valid) return res.status(400).json({ error: 'Fix competitive preflight errors before publishing.', preflight });
  const result = publishCompetitiveConfig(competitiveStore, req.admin.admin.displayName);
  rankedSeason = normalizeRankedSeason(rankedSeason, Date.now(), rankedConfig());
  for (const user of users.values()) normalizeCompetitiveState(user, rankedSeason, rankedConfig());
  writeAudit(adminStore, req, req.admin.admin, 'admin.competitive.config.publish', { versionId: result.version.versionId }, { reason });
  saveStore();
  return res.json({ live: result.live, version: result.version, overview: adminCompetitiveOverview() });
});

app.post('/admin/api/competitive/simulate', requireAdmin(adminStore, 'competitive:read'), (req, res) => {
  const config = req.body?.useDraft === false ? liveCompetitiveConfig(competitiveStore) : draftCompetitiveConfig(competitiveStore);
  return res.json({ simulation: simulateCompetitiveRating(req.body || {}, config) });
});

app.post('/admin/api/competitive/config/rollback', requireAdmin(adminStore, 'competitive:write'), (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  const result = rollbackCompetitiveConfig(competitiveStore, req.body?.versionId || null);
  if (result.error) return res.status(404).json({ error: result.error });
  rankedSeason = normalizeRankedSeason(rankedSeason, Date.now(), rankedConfig());
  for (const user of users.values()) normalizeCompetitiveState(user, rankedSeason, rankedConfig());
  writeAudit(adminStore, req, req.admin.admin, 'admin.competitive.config.rollback', { versionId: result.version.versionId }, { reason });
  saveStore();
  return res.json({ live: result.live, draft: result.draft, version: result.version });
});

app.post('/admin/api/competitive/seasons', requireAdmin(adminStore, 'competitive:write'), (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  const result = upsertCompetitiveSeason(competitiveStore, req.body?.season || req.body || {});
  writeAudit(adminStore, req, req.admin.admin, 'admin.competitive.season.create', { seasonId: result.season.id }, { reason });
  saveStore();
  return res.json({ season: result.season, config: publicCompetitiveAdminConfig(competitiveStore) });
});

app.patch('/admin/api/competitive/seasons/:seasonId', requireAdmin(adminStore, 'competitive:write'), (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  const result = upsertCompetitiveSeason(competitiveStore, { ...(req.body?.season || req.body || {}), id: req.params.seasonId });
  writeAudit(adminStore, req, req.admin.admin, 'admin.competitive.season.update', { seasonId: result.season.id }, { reason });
  saveStore();
  return res.json({ season: result.season, config: publicCompetitiveAdminConfig(competitiveStore) });
});

app.post('/admin/api/competitive/seasons/:seasonId/activate', requireAdmin(adminStore, 'competitive:write'), (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  if (req.body?.confirm !== `ACTIVATE ${req.params.seasonId}`) return res.status(400).json({ error: `Type ACTIVATE ${req.params.seasonId} to confirm.` });
  const result = activateCompetitiveSeason(competitiveStore, req.params.seasonId);
  if (result.error) return res.status(404).json({ error: result.error });
  rankedSeason = normalizeRankedSeason(result.season, Date.now(), rankedConfig());
  for (const user of users.values()) normalizeCompetitiveState(user, rankedSeason, rankedConfig());
  writeAudit(adminStore, req, req.admin.admin, 'admin.competitive.season.activate', { seasonId: result.season.id }, { reason, highPriority: true });
  saveStore();
  return res.json({ season: rankedSeason, config: publicCompetitiveAdminConfig(competitiveStore), overview: adminCompetitiveOverview() });
});

app.post('/admin/api/competitive/seasons/:seasonId/end', requireAdmin(adminStore, 'competitive:write'), (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  if (req.body?.confirm !== `END ${req.params.seasonId}`) return res.status(400).json({ error: `Type END ${req.params.seasonId} to confirm.` });
  const result = endCompetitiveSeason(competitiveStore, req.params.seasonId);
  if (result.error) return res.status(404).json({ error: result.error });
  rankedSeason = normalizeRankedSeason({ ...rankedSeason, endsAt: Date.now() }, Date.now() + 1, rankedConfig());
  for (const user of users.values()) normalizeCompetitiveState(user, rankedSeason, rankedConfig());
  writeAudit(adminStore, req, req.admin.admin, 'admin.competitive.season.end', { seasonId: req.params.seasonId, nextSeasonId: rankedSeason.id }, { reason, highPriority: true });
  saveStore();
  return res.json({ ended: result.season, season: rankedSeason, config: publicCompetitiveAdminConfig(competitiveStore), overview: adminCompetitiveOverview() });
});

app.get('/admin/api/competitive/queues', requireAdmin(adminStore, 'competitive:read'), (_req, res) => res.json(adminRankedQueues()));

app.delete('/admin/api/competitive/queues/:userId', requireAdmin(adminStore, 'competitive:write'), (req, res) => {
  const reason = cleanAdminReason(req.query.reason || req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  const existed = rankedQueue.delete(req.params.userId);
  if (existed) io.to(`user:${req.params.userId}`).emit('ranked:queue:cancelled', { reason: 'Queue cancelled by Nine Below support.' });
  writeAudit(adminStore, req, req.admin.admin, 'admin.competitive.queue.cancel', { userId: req.params.userId }, { reason, existed });
  saveStore();
  return res.json({ ok: true, existed, ...adminRankedQueues() });
});

app.get('/admin/api/rooms', requireAdmin(adminStore, 'metrics:read'), (_req, res) => res.json({ rooms: [...rooms.values()].map(roomSummary) }));
app.get('/admin/api/clubs', requireAdmin(adminStore, 'metrics:read'), (req, res) => res.json({ clubs: adminClubSummaries(req.query.q) }));

app.post('/admin/api/clubs/bulk', requireAdmin(adminStore, 'clubs:write'), (req, res) => {
  const action = String(req.body?.action || '').trim();
  const reason = requireClubAdminReason(req, res);
  if (!reason) return;
  const supported = new Set(['freeze', 'unfreeze', 'adjustXp', 'announce', 'rewardGrant', 'rewardRevoke']);
  if (!supported.has(action)) return res.status(400).json({ error: 'Unsupported bulk club action.' });
  const targets = bulkAdminTargets(req.body?.clubIds, id => clubs.get(String(id || '')));
  if (!targets.length) return res.status(400).json({ error: 'Select at least one club.' });
  const amount = Math.trunc(Number(req.body?.amount) || 0);
  const rewardId = String(req.body?.rewardId || '').trim();
  const text = String(req.body?.text || '').replace(/\s+/g, ' ').trim().slice(0, 280);
  if (action === 'adjustXp' && (!Number.isFinite(amount) || amount === 0)) return res.status(400).json({ error: 'XP adjustment amount is required.' });
  if ((action === 'rewardGrant' || action === 'rewardRevoke') && !rewardId) return res.status(400).json({ error: 'Reward id is required.' });
  if (action === 'announce' && !text) return res.status(400).json({ error: 'Announcement text is required.' });

  const resultsOut = [];
  for (const item of targets) {
    if (item.error) {
      resultsOut.push({ id: item.id, ok: false, error: item.error });
      continue;
    }
    const club = item.target;
    try {
      if (action === 'freeze' || action === 'unfreeze') {
        club.adminStatus ||= { frozenAt: null, frozenReason: '', disbandedAt: null };
        if (action === 'unfreeze') {
          club.adminStatus.frozenAt = null;
          club.adminStatus.frozenReason = '';
        } else {
          club.adminStatus.frozenAt = Date.now();
          club.adminStatus.frozenReason = reason;
        }
      }
      if (action === 'adjustXp') {
        const before = club.progression?.totalXp || 0;
        club.progression ||= { totalXp: 0 };
        club.progression.totalXp = Math.max(0, before + amount);
        resultsOut.push(bulkActionResult(item.id, club, { before, after: club.progression.totalXp }));
      } else if (action === 'announce') {
        const announcement = {
          id: crypto.randomUUID(),
          authorUserId: req.admin.admin.adminId,
          authorName: `Admin: ${req.admin.admin.displayName}`,
          text,
          createdAt: Date.now(),
        };
        club.announcements = [announcement];
        resultsOut.push(bulkActionResult(item.id, club, { announcementId: announcement.id }));
      } else if (action === 'rewardGrant' || action === 'rewardRevoke') {
        club.rewards ||= { unlocked: [], memberClaims: {} };
        if (action === 'rewardGrant' && !club.rewards.unlocked.includes(rewardId)) club.rewards.unlocked.push(rewardId);
        if (action === 'rewardRevoke') club.rewards.unlocked = club.rewards.unlocked.filter(id => id !== rewardId);
        resultsOut.push(bulkActionResult(item.id, club, { rewardId }));
      } else {
        resultsOut.push(bulkActionResult(item.id, club));
      }
      club.updatedAt = Date.now();
      normalizeClub(club, Date.now(), rankedSeason);
    } catch (error) {
      resultsOut.push({ id: item.id, ok: false, clubId: club.clubId, name: club.name, error: error.message });
    }
  }
  writeAudit(adminStore, req, req.admin.admin, `admin.clubs.bulk.${action}`, {}, {
    reason,
    requested: targets.length,
    succeeded: resultsOut.filter(item => item.ok).length,
    failed: resultsOut.filter(item => !item.ok).length,
    amount: action === 'adjustXp' ? amount : undefined,
    rewardId: rewardId || undefined,
  });
  saveStore();
  return res.json({ ok: true, results: resultsOut });
});

app.get('/admin/api/clubs/:clubId', requireAdmin(adminStore, 'metrics:read'), (req, res) => {
  const club = clubs.get(String(req.params.clubId || ''));
  if (!club) return res.status(404).json({ error: 'Club not found.' });
  writeAudit(adminStore, req, req.admin.admin, 'admin.clubs.read', { clubId: club.clubId });
  saveStore();
  return res.json({ club: adminClubDetail(club) });
});

app.patch('/admin/api/clubs/:clubId', requireAdmin(adminStore, 'clubs:write'), (req, res) => {
  const club = clubs.get(String(req.params.clubId || ''));
  if (!club) return res.status(404).json({ error: 'Club not found.' });
  const reason = requireClubAdminReason(req, res);
  if (!reason) return;
  const before = { name: club.name, tag: club.tag, motto: club.motto, description: club.description, branding: club.branding };
  if (req.body?.name !== undefined) club.name = String(req.body.name);
  if (req.body?.tag !== undefined) club.tag = normalizeClubTag(req.body.tag);
  if (req.body?.motto !== undefined) club.motto = String(req.body.motto);
  if (req.body?.description !== undefined) club.description = String(req.body.description);
  if (req.body?.branding !== undefined) club.branding = normalizeClubBranding(req.body.branding);
  club.updatedAt = Date.now();
  normalizeClub(club, Date.now(), rankedSeason);
  writeAudit(adminStore, req, req.admin.admin, 'admin.clubs.update', { clubId: club.clubId }, { reason, before, after: { name: club.name, tag: club.tag, motto: club.motto, description: club.description, branding: club.branding } });
  saveStore();
  return res.json({ club: adminClubDetail(club) });
});

app.patch('/admin/api/clubs/:clubId/members/:userId', requireAdmin(adminStore, 'clubs:write'), (req, res) => {
  const club = clubs.get(String(req.params.clubId || ''));
  if (!club) return res.status(404).json({ error: 'Club not found.' });
  const reason = requireClubAdminReason(req, res);
  if (!reason) return;
  const member = findClubMember(club, req.params.userId);
  if (!member) return res.status(404).json({ error: 'Club member not found.' });
  const before = { role: member.role, contributionXp: member.contributionXp };
  if (req.body?.role !== undefined) {
    const nextRole = String(req.body.role);
    if (!CLUB_ROLES.includes(nextRole)) return res.status(400).json({ error: 'Invalid club role.' });
    if (nextRole === 'owner') {
      for (const item of club.members) {
        if (item.role === 'owner') item.role = 'officer';
      }
    }
    member.role = nextRole;
  }
  if (req.body?.contributionXp !== undefined) member.contributionXp = Math.max(0, Math.floor(Number(req.body.contributionXp) || 0));
  club.updatedAt = Date.now();
  normalizeClub(club, Date.now(), rankedSeason);
  writeAudit(adminStore, req, req.admin.admin, 'admin.clubs.member.update', { clubId: club.clubId, userId: member.userId }, { reason, before, after: { role: member.role, contributionXp: member.contributionXp } });
  saveStore();
  return res.json({ club: adminClubDetail(club) });
});

app.delete('/admin/api/clubs/:clubId/members/:userId', requireAdmin(adminStore, 'clubs:write'), (req, res) => {
  const club = clubs.get(String(req.params.clubId || ''));
  if (!club) return res.status(404).json({ error: 'Club not found.' });
  const reason = cleanAdminReason(req.query.reason || req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  const member = findClubMember(club, req.params.userId);
  if (!member) return res.status(404).json({ error: 'Club member not found.' });
  if (member.role === 'owner' && club.members.length > 1) return res.status(400).json({ error: 'Transfer ownership before removing the owner.' });
  club.members = club.members.filter(item => item.userId !== member.userId);
  const user = users.get(member.userId);
  if (user?.clubId === club.clubId) user.clubId = null;
  club.updatedAt = Date.now();
  normalizeClub(club, Date.now(), rankedSeason);
  writeAudit(adminStore, req, req.admin.admin, 'admin.clubs.member.remove', { clubId: club.clubId, userId: member.userId }, { reason, role: member.role });
  saveStore();
  return res.json({ club: adminClubDetail(club) });
});

app.post('/admin/api/clubs/:clubId/xp/adjust', requireAdmin(adminStore, 'clubs:write'), (req, res) => {
  const club = clubs.get(String(req.params.clubId || ''));
  if (!club) return res.status(404).json({ error: 'Club not found.' });
  const reason = requireClubAdminReason(req, res);
  if (!reason) return;
  const amount = Math.trunc(Number(req.body?.amount) || 0);
  if (!Number.isFinite(amount) || amount === 0) return res.status(400).json({ error: 'XP adjustment amount is required.' });
  const before = club.progression?.totalXp || 0;
  club.progression.totalXp = Math.max(0, before + amount);
  club.updatedAt = Date.now();
  normalizeClub(club, Date.now(), rankedSeason);
  writeAudit(adminStore, req, req.admin.admin, 'admin.clubs.xp.adjust', { clubId: club.clubId }, { reason, amount, before, after: club.progression.totalXp });
  saveStore();
  return res.json({ club: adminClubDetail(club) });
});

app.post('/admin/api/clubs/:clubId/rewards/grant', requireAdmin(adminStore, 'clubs:write'), (req, res) => {
  const club = clubs.get(String(req.params.clubId || ''));
  if (!club) return res.status(404).json({ error: 'Club not found.' });
  const reason = requireClubAdminReason(req, res);
  if (!reason) return;
  const rewardId = String(req.body?.rewardId || '');
  club.rewards ||= { unlocked: [], memberClaims: {} };
  if (!club.rewards.unlocked.includes(rewardId)) club.rewards.unlocked.push(rewardId);
  club.updatedAt = Date.now();
  writeAudit(adminStore, req, req.admin.admin, 'admin.clubs.reward.grant', { clubId: club.clubId, rewardId }, { reason });
  saveStore();
  return res.json({ club: adminClubDetail(club) });
});

app.post('/admin/api/clubs/:clubId/rewards/revoke', requireAdmin(adminStore, 'clubs:write'), (req, res) => {
  const club = clubs.get(String(req.params.clubId || ''));
  if (!club) return res.status(404).json({ error: 'Club not found.' });
  const reason = requireClubAdminReason(req, res);
  if (!reason) return;
  const rewardId = String(req.body?.rewardId || '');
  club.rewards ||= { unlocked: [], memberClaims: {} };
  club.rewards.unlocked = club.rewards.unlocked.filter(id => id !== rewardId);
  club.updatedAt = Date.now();
  writeAudit(adminStore, req, req.admin.admin, 'admin.clubs.reward.revoke', { clubId: club.clubId, rewardId }, { reason });
  saveStore();
  return res.json({ club: adminClubDetail(club) });
});

app.post('/admin/api/clubs/:clubId/announcements', requireAdmin(adminStore, 'clubs:write'), (req, res) => {
  const club = clubs.get(String(req.params.clubId || ''));
  if (!club) return res.status(404).json({ error: 'Club not found.' });
  const reason = requireClubAdminReason(req, res);
  if (!reason) return;
  const text = String(req.body?.text || '').replace(/\s+/g, ' ').trim().slice(0, 280);
  if (!text) return res.status(400).json({ error: 'Announcement text is required.' });
  const announcement = {
    id: crypto.randomUUID(),
    authorUserId: req.admin.admin.adminId,
    authorName: `Admin: ${req.admin.admin.displayName}`,
    text,
    createdAt: Date.now(),
  };
  club.announcements = [announcement];
  club.updatedAt = Date.now();
  normalizeClub(club, Date.now(), rankedSeason);
  writeAudit(adminStore, req, req.admin.admin, 'admin.clubs.announcement', { clubId: club.clubId, announcementId: announcement.id }, { reason });
  saveStore();
  return res.json({ announcement, club: adminClubDetail(club) });
});

app.post('/admin/api/clubs/:clubId/moderation', requireAdmin(adminStore, 'clubs:write'), (req, res) => {
  const club = clubs.get(String(req.params.clubId || ''));
  if (!club) return res.status(404).json({ error: 'Club not found.' });
  const reason = requireClubAdminReason(req, res);
  if (!reason) return;
  const action = String(req.body?.action || 'freeze');
  club.adminStatus ||= { frozenAt: null, frozenReason: '', disbandedAt: null };
  if (action === 'unfreeze') {
    club.adminStatus.frozenAt = null;
    club.adminStatus.frozenReason = '';
  } else if (action === 'disband') {
    for (const member of club.members) {
      const user = users.get(member.userId);
      if (user?.clubId === club.clubId) user.clubId = null;
    }
    club.adminStatus.disbandedAt = Date.now();
    clubs.delete(club.clubId);
    writeAudit(adminStore, req, req.admin.admin, 'admin.clubs.disband', { clubId: req.params.clubId }, { reason });
    saveStore();
    return res.json({ ok: true });
  } else {
    club.adminStatus.frozenAt = Date.now();
    club.adminStatus.frozenReason = reason;
  }
  club.updatedAt = Date.now();
  writeAudit(adminStore, req, req.admin.admin, 'admin.clubs.moderation', { clubId: club.clubId }, { reason, action });
  saveStore();
  return res.json({ club: adminClubDetail(club) });
});

app.get('/admin/api/metrics', requireAdmin(adminStore, 'metrics:read'), (_req, res) => res.json({
  metrics: {
    ...adminMetrics(users, rooms, clubs, adminStore.supportTickets),
    storage: storageStatus(),
  },
}));

app.get('/admin/api/health', requireAdmin(adminStore, 'metrics:read'), async (req, res) => {
  try {
    const health = await adminHealthReport({ force: req.query.refresh === '1' });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ health });
  } catch (error) {
    console.error('Admin health report failed:', safeHealthErrorCode(error?.code || error?.name));
    return res.status(503).json({ error: 'The health report could not be completed.' });
  }
});

app.get('/admin/api/notifications', requireAdmin(adminStore, 'notifications:read'), (_req, res) => {
  const registeredUsers = [...users.values()].filter(user => normalizePushNotifications(user).tokens.length).length;
  const registeredTokens = [...users.values()].reduce((sum, user) => sum + normalizePushNotifications(user).tokens.length, 0);
  return res.json({
    config: notificationConfig(),
    stats: { registeredUsers, registeredTokens },
  });
});

app.patch('/admin/api/notifications', requireAdmin(adminStore, 'notifications:write'), (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Audit reason is required.' });
  const before = notificationConfig();
  const next = normalizeNotificationConfig(req.body?.config || req.body || {});
  adminStore.notificationConfig = next;
  writeAudit(adminStore, req, req.admin.admin, 'admin.notifications.config.update', {}, { reason, before, after: next });
  saveStore();
  return res.json({ config: notificationConfig() });
});

app.post('/admin/api/notifications/send', requireAdmin(adminStore, 'notifications:write'), (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Audit reason is required.' });
  const targetInput = cleanPushText(req.body?.targetUserId || req.body?.target || '', 80);
  const target = targetInput ? findUserByIdentifier(targetInput) : null;
  if (targetInput && !target) return res.status(404).json({ error: 'Target user not found.' });
  const result = queueAdminCustomPush({
    title: req.body?.title,
    body: req.body?.body,
    targetUserId: target?.userId || null,
    data: {
      campaignId: cleanPushText(req.body?.campaignId || '', 60),
    },
  });
  if (result.error) return res.status(400).json({ error: result.error });
  writeAudit(adminStore, req, req.admin.admin, 'admin.notifications.custom.send', { userId: target?.userId || null }, {
    reason,
    title: cleanPushText(req.body?.title, 80),
    targetedUsers: result.targetedUsers,
    queued: result.queued,
  });
  saveStore();
  return res.json(result);
});

app.get('/admin/api/notifications/test-outbox', requireAdmin(adminStore, 'notifications:read'), (_req, res) => {
  if (!PUSH_TEST_MODE) return res.status(404).json({ error: 'Push test outbox is disabled.' });
  return res.json({ messages: pushTestOutbox.slice(-100) });
});

app.get('/admin/api/early-access/summary', requireAdmin(adminStore, 'earlyAccess:read'), (_req, res) => {
  return res.json({
    summary: earlyAccessSummary(earlyAccessStore),
    config: publicEarlyAccessConfig(earlyAccessStore),
    email: earlyAccessCampaignEmailStatus(),
    inviteRequired: signupInvitesRequired(),
  });
});

app.patch('/admin/api/early-access/config', requireAdmin(adminStore, 'earlyAccess:send'), (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Audit reason is required.' });
  const before = publicEarlyAccessConfig(earlyAccessStore);
  const config = updateEarlyAccessConfig(earlyAccessStore, req.body?.config || req.body || {});
  writeAudit(adminStore, req, req.admin.admin, 'admin.early_access.config.update', {}, { reason, before, after: config });
  saveStore();
  return res.json({ config });
});

app.get('/admin/api/early-access/signups', requireAdmin(adminStore, 'earlyAccess:read'), (req, res) => {
  return res.json({
    signups: adminEarlyAccessSignups(earlyAccessStore, req.query, {
      env: process.env,
      includePii: adminHasPermission(req.admin.admin, 'earlyAccess:piiRead'),
    }),
  });
});

app.patch('/admin/api/early-access/signups/:signupId', requireAdmin(adminStore, 'earlyAccess:write'), async (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Audit reason is required.' });
  const result = updateEarlyAccessSignup(earlyAccessStore, req.params.signupId, req.body || {}, req.admin.admin, {
    env: process.env,
    includePii: adminHasPermission(req.admin.admin, 'earlyAccess:piiRead'),
  });
  if (result.error) return res.status(400).json({ error: result.error });
  writeAudit(adminStore, req, req.admin.admin, 'admin.early_access.signup.update', { signupId: req.params.signupId }, {
    reason,
    testerStage: result.signup.testerStage,
    tags: result.signup.tags,
  });
  saveStore();
  if (postgresStore) await postgresStore.saveEarlyAccessSignup(earlyAccessStore.signups.find(item => item.signupId === req.params.signupId));
  return res.json(result);
});

app.post('/admin/api/early-access/signups/:signupId/erase', requireAdmin(adminStore, 'earlyAccess:erase'), async (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Audit reason is required.' });
  const result = eraseEarlyAccessSignup(earlyAccessStore, req.params.signupId, { env: process.env });
  if (result.error) return res.status(404).json({ error: result.error });
  const linkedTicketsErased = eraseLinkedEarlyAccessFeedback([req.params.signupId]);
  writeAudit(adminStore, req, req.admin.admin, 'admin.early_access.signup.erase', { signupId: req.params.signupId }, { reason, linkedTicketsErased });
  saveStore();
  if (postgresStore) await postgresStore.saveEarlyAccessSignup(earlyAccessStore.signups.find(item => item.signupId === req.params.signupId));
  return res.json(result);
});

app.get('/admin/api/early-access/export.csv', requireAdmin(adminStore, 'earlyAccess:export'), (req, res) => {
  const csv = earlyAccessCsv(earlyAccessStore, req.query, { env: process.env });
  writeAudit(adminStore, req, req.admin.admin, 'admin.early_access.export', {}, {
    format: req.query.format === 'google-play' ? 'google-play' : 'general',
    platform: String(req.query.platform || ''),
    status: String(req.query.status || ''),
  });
  saveStore();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="nine-below-early-access-${req.query.format === 'google-play' ? 'google-play' : 'signups'}.csv"`);
  return res.send(csv);
});

app.get('/admin/api/early-access/campaigns', requireAdmin(adminStore, 'earlyAccess:send'), (_req, res) => {
  return res.json({ campaigns: adminEarlyAccessCampaigns(earlyAccessStore) });
});

app.post('/admin/api/early-access/campaigns', requireAdmin(adminStore, 'earlyAccess:send'), (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Audit reason is required.' });
  const result = createEarlyAccessCampaign(earlyAccessStore, req.body || {}, req.admin.admin);
  if (result.error) return res.status(400).json({ error: result.error });
  writeAudit(adminStore, req, req.admin.admin, 'admin.early_access.campaign.create', { campaignId: result.campaign.campaignId }, { reason, internalName: result.campaign.internalName });
  saveStore();
  return res.status(201).json(result);
});

app.patch('/admin/api/early-access/campaigns/:campaignId', requireAdmin(adminStore, 'earlyAccess:send'), (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Audit reason is required.' });
  const result = updateEarlyAccessCampaign(earlyAccessStore, req.params.campaignId, req.body || {});
  if (result.error) return res.status(400).json({ error: result.error });
  writeAudit(adminStore, req, req.admin.admin, 'admin.early_access.campaign.update', { campaignId: result.campaign.campaignId }, { reason });
  saveStore();
  return res.json(result);
});

app.get('/admin/api/early-access/campaigns/:campaignId/preview', requireAdmin(adminStore, 'earlyAccess:send'), (req, res) => {
  const result = previewEarlyAccessCampaign(earlyAccessStore, req.params.campaignId, { env: process.env });
  if (result.error) return res.status(404).json({ error: result.error });
  return res.json(result);
});

app.post('/admin/api/early-access/campaigns/:campaignId/test-send', requireAdmin(adminStore, 'earlyAccess:send'), async (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Audit reason is required.' });
  const campaign = earlyAccessStore.campaigns.find(item => item.campaignId === req.params.campaignId);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found.' });
  if (!req.admin.admin.email) return res.status(400).json({ error: 'Your admin account needs a recovery email for test sends.' });
  if (!earlyAccessCampaignEmailStatus().enabled) return res.status(503).json({ error: 'Early-access campaign email is not fully configured.' });
  try {
    const message = previewEarlyAccessCampaignEmail(campaign, req.admin.admin.email, {
      env: process.env,
      baseUrl: PUBLIC_API_URL,
      postalAddress: EARLY_ACCESS_POSTAL_ADDRESS,
    });
    message.replyTo = EARLY_ACCESS_REPLY_TO;
    await sendTransactionalEmail(message, { type: 'early-access-test-send', campaignId: campaign.campaignId });
    writeAudit(adminStore, req, req.admin.admin, 'admin.early_access.campaign.test_send', { campaignId: campaign.campaignId }, { reason });
    saveStore();
    return res.json({ ok: true });
  } catch (error) {
    return res.status(502).json({ error: error?.message || 'Test email could not be sent.' });
  }
});

app.post('/admin/api/early-access/campaigns/:campaignId/schedule', requireAdmin(adminStore, 'earlyAccess:send'), (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Audit reason is required.' });
  const campaign = earlyAccessStore.campaigns.find(item => item.campaignId === req.params.campaignId);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found.' });
  if (!earlyAccessCampaignEmailStatus().enabled) return res.status(503).json({ error: 'Early-access campaign email is not fully configured.' });
  if (campaign.type === 'access' && !signupInvitesRequired()) {
    return res.status(409).json({ error: 'Enable the signup invite gate before scheduling an access campaign.' });
  }
  const result = scheduleEarlyAccessCampaign(earlyAccessStore, campaign.campaignId, req.admin.admin, {
    env: process.env,
    scheduledAt: req.body?.scheduledAt ? new Date(req.body.scheduledAt).getTime() : Date.now(),
    createInvite(signup, selectedCampaign) {
      const created = createInviteCode(adminStore, req.admin.admin, {
        label: `${selectedCampaign.internalName} - ${selectedCampaign.targetPlatform}`,
        note: `Generated for early-access signup ${signup.signupId}`,
        maxUses: 1,
        expiresAt: selectedCampaign.startAt ? selectedCampaign.startAt + (30 * 24 * 60 * 60 * 1000) : null,
        earlyAccessSignupId: signup.signupId,
        earlyAccessCampaignId: selectedCampaign.campaignId,
      });
      return created.invite;
    },
  });
  if (result.error) return res.status(400).json({ error: result.error });
  writeAudit(adminStore, req, req.admin.admin, 'admin.early_access.campaign.schedule', { campaignId: campaign.campaignId }, {
    reason,
    recipientCount: result.deliveries.length,
    scheduledAt: result.campaign.scheduledAt,
  });
  saveStore();
  return res.json(result);
});

app.post('/admin/api/early-access/campaigns/:campaignId/cancel', requireAdmin(adminStore, 'earlyAccess:send'), (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Audit reason is required.' });
  const queuedInviteIds = earlyAccessStore.deliveries
    .filter(item => item.campaignId === req.params.campaignId && item.status !== 'sent' && item.inviteId)
    .map(item => item.inviteId);
  const result = cancelEarlyAccessCampaign(earlyAccessStore, req.params.campaignId);
  if (result.error) return res.status(400).json({ error: result.error });
  for (const inviteId of queuedInviteIds) disableInviteCode(adminStore, inviteId, `Campaign cancelled: ${reason}`);
  writeAudit(adminStore, req, req.admin.admin, 'admin.early_access.campaign.cancel', { campaignId: req.params.campaignId }, { reason });
  saveStore();
  return res.json(result);
});

app.post('/admin/api/early-access/campaigns/:campaignId/retry-failed', requireAdmin(adminStore, 'earlyAccess:send'), (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Audit reason is required.' });
  const result = retryEarlyAccessCampaignFailures(earlyAccessStore, req.params.campaignId);
  if (result.error) return res.status(404).json({ error: result.error });
  writeAudit(adminStore, req, req.admin.admin, 'admin.early_access.campaign.retry_failed', { campaignId: req.params.campaignId }, { reason, count: result.count });
  saveStore();
  return res.json(result);
});

app.get('/admin/api/invites', requireAdmin(adminStore, 'invites:read'), (_req, res) => {
  res.json({
    inviteRequired: signupInvitesRequired(),
    invites: adminInvites(adminStore),
  });
});

app.post('/admin/api/invites', requireAdmin(adminStore, 'invites:write'), (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  const result = createInviteCode(adminStore, req.admin.admin, req.body || {});
  if (result.error) return res.status(400).json({ error: result.error });
  writeAudit(adminStore, req, req.admin.admin, 'admin.invites.create', { inviteId: result.invite.inviteId }, { reason, codePreview: result.invite.codePreview });
  saveStore();
  return res.json(result);
});

app.post('/admin/api/invites/:inviteId/disable', requireAdmin(adminStore, 'invites:write'), (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  const result = disableInviteCode(adminStore, req.params.inviteId, reason);
  if (result.error) return res.status(404).json({ error: result.error });
  writeAudit(adminStore, req, req.admin.admin, 'admin.invites.disable', { inviteId: result.invite.inviteId }, { reason, codePreview: result.invite.codePreview });
  saveStore();
  return res.json(result);
});

app.post('/support/tickets', requireAuth, (req, res) => {
  const result = createSupportTicket(adminStore, req, req.auth.user, req.body || {});
  if (result.error) return res.status(400).json({ error: result.error });
  saveStore();
  return res.json(result);
});

app.post('/support/public', publicSupportRateLimit, (req, res) => {
  if (publicSupportHoneypotFilled(req.body)) {
    return res.status(202).json({ ok: true });
  }
  const result = createPublicSupportTicket(adminStore, req, req.body || {});
  if (result.error) return res.status(400).json({ error: result.error });
  saveStore();
  const emailDelivery = adminRecoveryEmailEnabled() ? 'queued' : 'not_configured';
  res.status(201).json({
    ok: true,
    reference: result.ticket.publicReference,
    accessToken: result.accessToken,
    trackingUrl: supportTrackingUrl(result.ticket, result.accessToken),
    emailDelivery,
  });
  queueSupportEmail(
    `Support case ${result.ticket.publicReference} email delivery`,
    () => sendPublicSupportOpened(result.ticket, result.accessToken),
  );
});

app.get('/support/public/:reference', (req, res) => {
  const result = publicSupportTicket(adminStore, req.params.reference, req.query.token, { hydrate: hydrateEarlyAccessSupportTicket });
  if (result.error) return res.status(404).json({ error: result.error });
  return res.json(result);
});

app.post('/support/public/:reference/replies', publicSupportRateLimit, (req, res) => {
  if (publicSupportHoneypotFilled(req.body)) return res.status(202).json({ ok: true });
  const result = addRequesterSupportReply(adminStore, req.params.reference, req.body?.accessToken, req.body || {});
  if (result.error) return res.status(result.error.includes('closed') ? 409 : 404).json({ error: result.error });
  result.ticket = hydrateEarlyAccessSupportTicket(result.ticket);
  writeAudit(adminStore, req, null, 'support.ticket.requester_reply', { ticketId: result.ticket.ticketId });
  saveStore();
  res.json({
    ok: true,
    emailDelivery: adminRecoveryEmailEnabled() ? 'queued' : 'not_configured',
  });
  queueSupportEmail(
    `Support case ${result.ticket.publicReference} reply email delivery`,
    () => sendSupportEmailQuietly({
      to: SUPPORT_INBOX_EMAIL,
      replyTo: result.ticket.contactEmail,
      subject: `[${result.ticket.publicReference}] Requester replied`,
      text: [
        `${result.ticket.contactName} replied to ${result.ticket.publicReference}.`,
        '',
        String(req.body?.message || '').trim(),
        '',
        `Manage this case at ${ADMIN_PUBLIC_URL}`,
      ].join('\n'),
    }, { type: 'support-requester-reply', ticketId: result.ticket.ticketId }),
  );
});

app.post('/early-access/signups', earlyAccessRateLimit, async (req, res) => {
  if (earlyAccessHoneypotFilled(req.body)) return res.status(202).json({ ok: true, message: 'Check your email to confirm your signup.' });
  if (!adminRecoveryEmailEnabled() || !earlyAccessSecurityStatus().ready) {
    return res.status(503).json({ error: 'Early-access registration is not available yet.' });
  }
  let result;
  try {
    result = submitEarlyAccessSignup(earlyAccessStore, req.body || {}, {
      env: process.env,
      ipHash: earlyAccessIpHash(req),
      referrerHost: earlyAccessReferrerHost(req, req.body || {}),
    });
  } catch (error) {
    console.error('Early-access signup security configuration failed:', redactEarlyAccessError(error?.message || error));
    return res.status(503).json({ error: 'Early-access registration is not available yet.' });
  }
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  saveStore();
  if (postgresStore) await postgresStore.saveEarlyAccessSignup(result.signup);
  if (result.queued) {
    queueSupportEmail('Early-access confirmation delivery', () => sendEarlyAccessConfirmation(result));
  }
  return res.status(202).json({ ok: true, message: 'Check your email to confirm your signup.' });
});

app.post('/early-access/confirm', earlyAccessRateLimit, async (req, res) => {
  const result = confirmEarlyAccessSignup(earlyAccessStore, req.body?.token, { env: process.env });
  if (result.error) return res.status(400).json({ error: result.error });
  writeAudit(adminStore, req, null, 'early_access.consent.confirmed', { signupId: result.signup.signupId });
  saveStore();
  if (postgresStore) await postgresStore.saveEarlyAccessSignup(result.signup);
  return res.json({ ok: true, message: 'Your Nine Below early-access signup is confirmed.' });
});

app.post('/early-access/preferences', earlyAccessRateLimit, (req, res) => {
  const result = earlyAccessPreferences(earlyAccessStore, req.body?.token, { env: process.env });
  if (result.error) return res.status(404).json({ error: result.error });
  return res.json(result);
});

app.get('/early-access/unsubscribe', (req, res) => {
  const token = String(req.query.token || '');
  if (!token) return res.redirect(302, '/early-access');
  if (token.startsWith('u1.')) {
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
    const action = `/early-access/unsubscribe?token=${encodeURIComponent(token)}`;
    return res.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Unsubscribe from Nine Below</title><style>body{font-family:Arial,sans-serif;background:#07182a;color:#eef6f3;padding:32px}main{max-width:520px;margin:auto;background:#10223d;padding:28px;border-radius:10px}button{background:#57dda8;color:#061421;border:0;border-radius:6px;padding:14px 20px;font-weight:700}</style></head><body><main><h1>Unsubscribe from Nine Below early access?</h1><p>This will stop early-access email for this signup. You can join again later with a fresh confirmation.</p><form method="post" action="${escapeHtml(action)}"><button type="submit">Confirm unsubscribe</button></form></main></body></html>`);
  }
  return res.redirect(302, `/early-access/preferences#token=${encodeURIComponent(token)}`);
});

app.post('/early-access/unsubscribe', earlyAccessRateLimit, async (req, res) => {
  const result = unsubscribeEarlyAccess(earlyAccessStore, req.body?.token || req.query.token, { env: process.env });
  if (result.signup) writeAudit(adminStore, req, null, 'early_access.consent.unsubscribed', { signupId: result.signup.signupId });
  saveStore();
  if (postgresStore && result.signup) await postgresStore.saveEarlyAccessSignup(result.signup);
  return res.json({ ok: true, message: 'You have been unsubscribed from Nine Below early-access email.' });
});

app.post('/early-access/onboarding', earlyAccessRateLimit, async (req, res) => {
  const result = completeEarlyAccessOnboarding(earlyAccessStore, req.body?.token, req.body || {}, { env: process.env });
  if (result.error) return res.status(400).json({ error: result.error });
  writeAudit(adminStore, req, null, 'early_access.onboarding.completed', { signupId: result.signup.signupId });
  saveStore();
  if (postgresStore) await postgresStore.saveEarlyAccessSignup(result.signup);
  return res.json({ ok: true, message: 'Tester setup is complete.' });
});

app.post('/early-access/feedback', earlyAccessRateLimit, (req, res) => {
  if (earlyAccessHoneypotFilled(req.body)) return res.status(202).json({ ok: true });
  const validated = validateEarlyAccessFeedback(earlyAccessStore, req.body?.token, req.body || {}, { env: process.env });
  if (validated.error) return res.status(400).json({ error: validated.error });
  const feedback = validated.feedback;
  const result = createPublicSupportTicket(adminStore, req, {
    source: 'ninebelow',
    website: `${PUBLIC_API_URL}/early-access/feedback`,
    name: feedback.contactName,
    email: feedback.contactEmail,
    category: `early_access_${feedback.category}`,
    subject: `Early access ${feedback.severity}: ${feedback.category}`,
    message: [
      `Signup: ${feedback.signupId}`,
      `Severity: ${feedback.severity}`,
      `Build: ${feedback.build || 'not supplied'}`,
      `Device: ${feedback.device || 'not supplied'}`,
      '',
      `Steps: ${feedback.steps || 'not supplied'}`,
      `Expected: ${feedback.expected || 'not supplied'}`,
      `Actual: ${feedback.actual}`,
    ].join('\n'),
  });
  if (result.error) return res.status(400).json({ error: result.error });
  protectEarlyAccessFeedbackTicket(result.ticket, feedback.signupId);
  writeAudit(adminStore, req, null, 'early_access.feedback.created', { signupId: feedback.signupId, ticketId: result.ticket.ticketId });
  saveStore();
  res.status(201).json({
    ok: true,
    reference: result.ticket.publicReference,
    trackingUrl: supportTrackingUrl(result.ticket, result.accessToken),
  });
  queueSupportEmail(
    `Early-access feedback ${result.ticket.publicReference} email delivery`,
    () => sendPublicSupportOpened(result.ticket, result.accessToken),
  );
});

app.get('/auth/config', (_req, res) => {
  res.json({
    environment: PUBLIC_ENV,
    inviteRequired: signupInvitesRequired(),
    apiUrl: PUBLIC_API_URL,
    adminUrl: ADMIN_PUBLIC_URL,
    providers: socialProviderConfig(),
  });
});

app.post('/auth/signup', (req, res) => {
  const displayNameCheck = validateNewDisplayName(req.body.displayName);
  const password = String(req.body.password || '');
  const inviteCheck = validateSignupInvite(adminStore, req.body?.inviteCode, signupInvitesRequired());
  if (inviteCheck.error) return res.status(403).json({ error: inviteCheck.error });
  if (displayNameCheck.error) return res.status(displayNameCheck.error.includes('taken') ? 409 : 400).json({ error: displayNameCheck.error });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  const userId = crypto.randomUUID();
  const { salt, passwordHash } = hashPassword(password);
  const user = normalizeUserProgression({ userId, displayName: displayNameCheck.displayName, salt, passwordHash, stats: { gamesPlayed: 0, wins: 0 } });
  const deviceHash = trackUserDevice(user, req, req.body?.deviceId);
  const moderationError = banErrorFor(adminStore, user, deviceHash);
  if (moderationError) return res.status(403).json({ error: moderationError });
  const invite = consumeSignupInvite(adminStore, inviteCheck.invite, user);
  users.set(userId, user);
  const session = createSession(userId);
  if (invite) {
    if (invite.earlyAccessSignupId) markEarlyAccessActivated(earlyAccessStore, invite.earlyAccessSignupId, userId);
    writeAudit(adminStore, req, null, 'auth.signup.invite_used', { userId, inviteId: invite.inviteId, earlyAccessSignupId: invite.earlyAccessSignupId || null }, { codePreview: invite.codePreview || null });
  }
  saveStore();
  return res.json({ token: session.token, user: safeUser(user) });
});

app.post('/auth/login', playerLoginRateLimit, (req, res) => {
  const displayName = String(req.body.displayName || '').trim();
  const rawPassword = String(req.body.password || '');
  const password = rawPassword.trim();
  const user = [...users.values()].find(item => item.displayName.toLowerCase() === displayName.toLowerCase());
  if (!user) return res.status(401).json({ error: 'Invalid credentials.' });
  const deviceHash = trackUserDevice(user, req, req.body?.deviceId);
  const moderationError = banErrorFor(adminStore, user, deviceHash);
  if (moderationError) return res.status(403).json({ error: moderationError });
  const rawHash = hashPassword(rawPassword, user.salt).passwordHash;
  const trimmedHash = rawPassword === password ? rawHash : hashPassword(password, user.salt).passwordHash;
  if (rawHash !== user.passwordHash && trimmedHash !== user.passwordHash) {
    const testAccount = shouldSeedDevTestAccounts(DATA_DIR, DEFAULT_DATA_DIR)
      ? devTestAccountForDisplayName(displayName)
      : null;
    if (!testAccount || password.toLowerCase() !== testAccount.password.toLowerCase()) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    const credentials = hashPassword(testAccount.password);
    user.salt = credentials.salt;
    user.passwordHash = credentials.passwordHash;
    normalizeUserRecord(user);
    saveStore();
  }
  const session = createSession(user.userId);
  return res.json({ token: session.token, user: safeUser(user) });
});

app.post('/auth/social/login', async (req, res) => {
  const provider = normalizeProvider(req.body?.provider);
  if (!provider) return res.status(400).json({ error: 'Unsupported social login provider.' });
  let profile;
  try {
    profile = await verifySocialProfile(provider, req.body);
  } catch (error) {
    return res.status(401).json({ error: error instanceof Error ? error.message : `${providerLabel(provider)} login failed.` });
  }

  const linkedUser = findUserByProvider(provider, profile.providerUserId);
  if (linkedUser) {
    const deviceHash = trackUserDevice(linkedUser, req, req.body?.deviceId);
    const moderationError = banErrorFor(adminStore, linkedUser, deviceHash);
    if (moderationError) return res.status(403).json({ error: moderationError });
    linkedUser.authProviders[provider].lastLoginAt = Date.now();
    const session = createSession(linkedUser.userId);
    saveStore();
    return res.json({ token: session.token, user: safeUser(linkedUser) });
  }

  const displayName = String(req.body?.displayName || '').trim();
  if (!displayName) {
    return res.json({
      requiresProfile: true,
      provider,
      suggestedDisplayName: suggestedSocialDisplayName(profile),
      inviteRequired: signupInvitesRequired(),
    });
  }

  const inviteCheck = validateSignupInvite(adminStore, req.body?.inviteCode, signupInvitesRequired());
  if (inviteCheck.error) return res.status(403).json({ error: inviteCheck.error });
  const displayNameCheck = validateNewDisplayName(displayName);
  if (displayNameCheck.error) return res.status(displayNameCheck.error.includes('taken') ? 409 : 400).json({ error: displayNameCheck.error });

  const user = createSocialUser(profile, displayNameCheck.displayName);
  const deviceHash = trackUserDevice(user, req, req.body?.deviceId);
  const moderationError = banErrorFor(adminStore, user, deviceHash);
  if (moderationError) return res.status(403).json({ error: moderationError });
  const invite = consumeSignupInvite(adminStore, inviteCheck.invite, user);
  users.set(user.userId, user);
  const session = createSession(user.userId);
  writeAudit(adminStore, req, null, 'auth.signup.social', { userId: user.userId, provider });
  if (invite) {
    if (invite.earlyAccessSignupId) markEarlyAccessActivated(earlyAccessStore, invite.earlyAccessSignupId, user.userId);
    writeAudit(adminStore, req, null, 'auth.signup.invite_used', { userId: user.userId, inviteId: invite.inviteId, earlyAccessSignupId: invite.earlyAccessSignupId || null }, { codePreview: invite.codePreview || null });
  }
  saveStore();
  return res.json({ token: session.token, user: safeUser(user) });
});

app.post('/auth/social/link', requireAuth, async (req, res) => {
  const provider = normalizeProvider(req.body?.provider);
  if (!provider) return res.status(400).json({ error: 'Unsupported social login provider.' });
  let profile;
  try {
    profile = await verifySocialProfile(provider, req.body);
  } catch (error) {
    return res.status(401).json({ error: error instanceof Error ? error.message : `${providerLabel(provider)} link failed.` });
  }

  const linkedUser = findUserByProvider(provider, profile.providerUserId);
  if (linkedUser && linkedUser.userId !== req.auth.user.userId) {
    return res.status(409).json({ error: `${providerLabel(provider)} is already linked to another Nine Below profile.` });
  }

  normalizeAuthProviders(req.auth.user);
  const current = req.auth.user.authProviders[provider];
  if (current && current.providerUserId !== profile.providerUserId) {
    return res.status(409).json({ error: `This profile is already linked to a different ${providerLabel(provider)} account.` });
  }

  const now = Date.now();
  req.auth.user.authProviders[provider] = current
    ? { ...current, ...socialLinkFromProfile(profile, current.linkedAt || now), linkedAt: current.linkedAt || now, lastLoginAt: now }
    : socialLinkFromProfile(profile, now);
  normalizeAuthProviders(req.auth.user);
  writeAudit(adminStore, req, null, 'auth.social.link', { userId: req.auth.user.userId, provider });
  saveStore();
  return res.json({ user: safeUser(req.auth.user) });
});

app.post('/auth/logout', requireAuth, (req, res) => {
  sessions.delete(req.auth.session.token);
  saveStore();
  return res.json({ ok: true });
});

app.delete('/auth/account', requireAuth, accountDeletionRateLimit, async (req, res) => {
  const activeRoom = activePlayingRoomForUser(req.auth.user.userId);
  if (activeRoom) {
    return res.status(409).json({
      error: 'Finish your active match before deleting your account.',
      activeRoom: roomSummary(activeRoom),
    });
  }
  const verification = await verifyAccountDeletionCredential(req.auth.user, req.body || {});
  if (verification.error) {
    const confirmationError = String(req.body?.confirmation || '').trim().toUpperCase() !== 'DELETE';
    return res.status(confirmationError ? 400 : 401).json({ error: verification.error });
  }
  const result = deletePlayerAccount(req.auth.user, req, `in-app-${verification.method}`);
  if (result.error) return res.status(409).json(result);
  return res.json({ ok: true });
});

app.get('/auth/me', requireAuth, (req, res) => res.json({ user: safeUser(req.auth.user) }));

app.get('/profile/me', requireAuth, requireFeature('profile'), (req, res) => res.json({ user: safeUser(req.auth.user) }));

app.get('/clubs/standings', requireAuth, requireFeature('clubs.standings'), (req, res) => {
  const period = String(req.query.period || 'weekly');
  if (!CLUB_STANDING_PERIODS.includes(period)) return res.status(400).json({ error: 'Choose a valid club-standing period.' });
  return res.json(buildClubStandings({
    period,
    clubs,
    results,
    viewerClubId: req.auth.user.clubId || null,
    season: rankedSeason,
    now: Date.now(),
  }));
});

app.get('/leaderboards', requireAuth, (_req, res) => res.status(410).json({
  error: 'This leaderboard has retired. Update Nine Below to view Club Standings.',
  code: 'LEADERBOARD_RETIRED',
}));

app.get('/mail/summary', requireAuth, requireFeature('inbox'), (req, res) => {
  return res.json({ summary: mailSummaryForUser(mailEntries, req.auth.user.userId) });
});

app.get('/mail', requireAuth, requireFeature('inbox'), (req, res) => {
  return res.json({
    mail: mailEntriesForUser(mailEntries, req.auth.user.userId),
    summary: mailSummaryForUser(mailEntries, req.auth.user.userId),
  });
});

app.post('/mail/:mailId/read', requireAuth, requireFeature('inbox'), (req, res) => {
  const result = markMailRead(mailEntries, req.auth.user.userId, String(req.params.mailId || ''));
  if (result.error) return res.status(404).json({ error: result.error });
  saveStore();
  return res.json({ ...result, summary: mailSummaryForUser(mailEntries, req.auth.user.userId) });
});

app.post('/mail/:mailId/claim', requireAuth, requireFeature('inbox'), (req, res) => {
  const result = claimMailForUser(mailEntries, req.auth.user, liveCatalog(catalogStore), String(req.params.mailId || ''));
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  saveStore();
  return res.json({
    ...result,
    user: safeUser(req.auth.user),
    cosmetics: cosmeticsFor(req.auth.user),
    summary: mailSummaryForUser(mailEntries, req.auth.user.userId),
  });
});

app.delete('/mail/:mailId', requireAuth, requireFeature('inbox'), (req, res) => {
  const result = deleteMailForUser(mailEntries, req.auth.user.userId, String(req.params.mailId || ''));
  if (result.error) return res.status(404).json({ error: result.error });
  saveStore();
  return res.json({ ...result, summary: mailSummaryForUser(mailEntries, req.auth.user.userId) });
});

app.post('/mail/feedback', requireAuth, (req, res) => {
  const payload = cleanFeedbackPayload(req.body || {});
  if (payload.error) return res.status(400).json({ error: payload.error });
  const result = createSupportTicket(adminStore, req, req.auth.user, payload);
  if (result.error) return res.status(400).json({ error: result.error });
  writeAudit(adminStore, req, null, 'player.feedback.mailbox', { userId: req.auth.user.userId }, { category: payload.category });
  saveStore();
  return res.status(201).json(result);
});

app.post('/push/register', requireAuth, (req, res) => {
  const result = upsertPushToken(req.auth.user, req.body || {});
  if (result.error) return res.status(400).json({ error: result.error });
  saveStore();
  return res.json({ ok: true, pushTokenCount: result.pushTokenCount });
});

app.post('/push/unregister', requireAuth, (req, res) => {
  const result = removePushToken(req.auth.user, req.body || {});
  if (result.error) return res.status(400).json({ error: result.error });
  saveStore();
  return res.json({ ok: true, pushTokenCount: result.pushTokenCount });
});

app.get('/social/me', requireAuth, requireFeature('social'), (req, res) => res.json({ social: socialSummary(req.auth.user) }));

app.get('/players/search', requireAuth, requireFeature('social'), (req, res) => {
  const query = String(req.query.q || '').trim().toLowerCase();
  if (query.length < 2) return res.json({ players: [] });
  const players = [...users.values()]
    .filter(user => user.userId !== req.auth.user.userId && visiblePlayer(user) && user.displayName.toLowerCase().includes(query))
    .slice(0, 12)
    .map(user => publicPlayerCard(req.auth.user, user));
  return res.json({ players });
});

app.get('/profiles/:userId', requireAuth, requireFeature('profile'), (req, res) => {
  const target = users.get(String(req.params.userId || ''));
  if (!visiblePlayer(target)) return res.status(404).json({ error: 'Player not found.' });
  return res.json({ profile: publicViewedProfile(req.auth.user, target) });
});

app.get('/clubs/me', requireAuth, requireFeature('clubs'), (req, res) => {
  const club = req.auth.user.clubId ? clubById(req.auth.user.clubId) : null;
  if (!club) {
    return res.json({
      club: null,
      applications: userClubApplications(req.auth.user.userId),
      invitations: userClubInvitations(req.auth.user.userId),
      recommended: [...clubs.values()]
        .sort((a, b) => b.progression.totalXp - a.progression.totalXp)
        .slice(0, 8)
        .map(item => publicClubSummary(item, req.auth.user.userId)),
    });
  }
  if (syncClubRewards(club, users, Date.now()).changed) saveStore();
  return res.json({
    club: publicClubProfile(club, users, req.auth.user.userId, rankedSeason),
    applications: [],
    invitations: [],
  });
});

app.post('/clubs', requireAuth, requireFeature('clubs.management'), (req, res) => {
  if (req.auth.user.clubId && clubs.has(req.auth.user.clubId)) return res.status(409).json({ error: 'You are already in a club.' });
  const access = clubAccessError(req.auth.user, 'create');
  if (access) return res.status(access.status).json(access);
  const config = clubConfig();
  normalizeUserRecord(req.auth.user);
  if (req.auth.user.currency.coins < config.createCost) {
    return res.status(402).json({
      error: `Creating a club costs ${config.createCost.toLocaleString('en-US')} coins.`,
      requiredCoins: config.createCost,
      coins: req.auth.user.currency.coins,
    });
  }
  const name = String(req.body?.name || '').trim();
  const tag = normalizeClubTag(req.body?.tag);
  if (clubNameOrTagTaken(name, tag)) return res.status(409).json({ error: 'Club name or tag is already taken.' });
  const created = createClubRecord(req.auth.user, {
    clubId: crypto.randomUUID(),
    name,
    tag,
    motto: req.body?.motto,
    description: req.body?.description,
    branding: req.body?.branding,
  }, Date.now(), config);
  if (created.error) return res.status(400).json({ error: created.error });
  req.auth.user.currency.coins -= config.createCost;
  clubs.set(created.club.clubId, created.club);
  req.auth.user.clubId = created.club.clubId;
  saveStore();
  return res.json({ club: publicClubProfile(created.club, users, req.auth.user.userId, rankedSeason), user: safeUser(req.auth.user) });
});

app.get('/clubs/search', requireAuth, requireFeature('clubs'), (req, res) => {
  const query = String(req.query.q || '').trim().toLowerCase();
  const pool = [...clubs.values()].filter(club => {
    if (!query) return true;
    return club.name.toLowerCase().includes(query) || club.tag.toLowerCase().includes(query);
  });
  return res.json({
    clubs: pool
      .sort((a, b) => b.progression.totalXp - a.progression.totalXp)
      .slice(0, 20)
      .map(club => publicClubSummary(club, req.auth.user.userId)),
  });
});

app.get('/clubs/:clubId', requireAuth, requireFeature('clubs'), (req, res) => {
  const club = clubById(req.params.clubId);
  if (!club) return res.status(404).json({ error: 'Club not found.' });
  return res.json({ club: publicClubProfile(club, users, req.auth.user.userId, rankedSeason) });
});

app.patch('/clubs/:clubId', requireAuth, requireFeature('clubs.management'), (req, res) => {
  const club = clubById(req.params.clubId);
  if (!club) return res.status(404).json({ error: 'Club not found.' });
  if (frozenClubResponse(club, res)) return;
  const role = currentClubRole(req.auth.user, club);
  if (!canUpdateClub(role)) return res.status(403).json({ error: 'Only the club owner can edit club identity.' });

  const nextName = String(req.body?.name ?? club.name).replace(/\s+/g, ' ').trim().slice(0, 28);
  const nextTag = normalizeClubTag(req.body?.tag ?? club.tag);
  if (nextName.length < 3) return res.status(400).json({ error: 'Club name must be at least 3 characters.' });
  if (nextTag.length < 1) return res.status(400).json({ error: 'Club tag must be 1 to 4 letters.' });
  if (clubNameOrTagTaken(nextName, nextTag, club.clubId)) return res.status(409).json({ error: 'Club name or tag is already taken.' });

  club.name = nextName;
  club.tag = nextTag;
  club.motto = String(req.body?.motto ?? club.motto).replace(/\s+/g, ' ').trim().slice(0, 80);
  club.description = String(req.body?.description ?? club.description).replace(/\s+/g, ' ').trim().slice(0, 250);
  club.branding = normalizeClubBranding(req.body?.branding || club.branding);
  club.updatedAt = Date.now();
  saveStore();
  emitClubUpdate(club.clubId);
  return res.json({ club: publicClubProfile(club, users, req.auth.user.userId, rankedSeason) });
});

app.post('/clubs/:clubId/requests', requireAuth, requireFeature('clubs'), (req, res) => {
  const club = clubById(req.params.clubId);
  if (!club) return res.status(404).json({ error: 'Club not found.' });
  if (frozenClubResponse(club, res)) return;
  normalizeClub(club);
  const access = clubAccessError(req.auth.user, 'join');
  if (access) return res.status(access.status).json(access);
  if (req.auth.user.clubId && clubs.has(req.auth.user.clubId)) return res.status(409).json({ error: 'Leave your current club before joining another.' });
  if (club.members.length >= club.progression.memberCap) return res.status(409).json({ error: 'Club is full.' });
  if (club.joinRequests.some(request => request.userId === req.auth.user.userId)) return res.status(409).json({ error: 'Request already sent.' });
  const request = {
    id: crypto.randomUUID(),
    userId: req.auth.user.userId,
    createdAt: Date.now(),
    message: String(req.body?.message || '').replace(/\s+/g, ' ').trim().slice(0, 80),
  };
  club.joinRequests.push(request);
  club.updatedAt = request.createdAt;
  saveStore();
  emitClubUpdate(club.clubId);
  return res.json({ request, club: publicClubSummary(club, req.auth.user.userId) });
});

app.post('/clubs/:clubId/requests/:requestId/accept', requireAuth, requireFeature('clubs.management'), (req, res) => {
  const club = clubById(req.params.clubId);
  if (!club) return res.status(404).json({ error: 'Club not found.' });
  if (frozenClubResponse(club, res)) return;
  normalizeClub(club);
  const role = currentClubRole(req.auth.user, club);
  if (!canManageRequests(role)) return res.status(403).json({ error: 'Only owners and officers can approve requests.' });
  const request = club.joinRequests.find(item => item.id === req.params.requestId);
  const target = request ? users.get(request.userId) : null;
  if (!request || !visiblePlayer(target)) return res.status(404).json({ error: 'Request not found.' });
  const access = clubAccessError(target, 'join');
  if (access) return res.status(access.status).json({ ...access, error: `That player must reach Level ${access.requiredLevel} before joining clubs.` });
  if (target.clubId && clubs.has(target.clubId)) return res.status(409).json({ error: 'That player is already in a club.' });
  if (club.members.length >= club.progression.memberCap) return res.status(409).json({ error: 'Club is full.' });
  club.joinRequests = club.joinRequests.filter(item => item.id !== request.id);
  club.members.push({
    userId: target.userId,
    role: 'rookie',
    joinedAt: Date.now(),
    contributionXp: 0,
    coinContribution: 0,
    contribution: { matches: 0, wins: 0, columnClears: 0, rankedOrWager: 0 },
  });
  target.clubId = club.clubId;
  club.updatedAt = Date.now();
  saveStore();
  emitClubUpdate(club.clubId);
  emitSocialUpdate(target.userId);
  return res.json({ club: publicClubProfile(club, users, req.auth.user.userId, rankedSeason), member: publicPlayerCard(req.auth.user, target) });
});

app.post('/clubs/:clubId/requests/:requestId/reject', requireAuth, requireFeature('clubs.management'), (req, res) => {
  const club = clubById(req.params.clubId);
  if (!club) return res.status(404).json({ error: 'Club not found.' });
  if (frozenClubResponse(club, res)) return;
  const role = currentClubRole(req.auth.user, club);
  if (!canManageRequests(role)) return res.status(403).json({ error: 'Only owners and officers can reject requests.' });
  const before = club.joinRequests.length;
  club.joinRequests = club.joinRequests.filter(item => item.id !== req.params.requestId);
  if (before === club.joinRequests.length) return res.status(404).json({ error: 'Request not found.' });
  club.updatedAt = Date.now();
  saveStore();
  emitClubUpdate(club.clubId);
  return res.json({ club: publicClubProfile(club, users, req.auth.user.userId, rankedSeason) });
});

app.post('/clubs/:clubId/invites', requireAuth, requireFeature('clubs.management'), (req, res) => {
  const club = clubById(req.params.clubId);
  if (!club) return res.status(404).json({ error: 'Club not found.' });
  if (frozenClubResponse(club, res)) return;
  normalizeClub(club);
  const role = currentClubRole(req.auth.user, club);
  if (!canManageRequests(role)) return res.status(403).json({ error: 'Only owners and officers can invite players.' });
  const target = findUserByIdentifier(req.body?.userId || req.body?.displayName);
  if (!visiblePlayer(target)) return res.status(404).json({ error: 'Player not found.' });
  const access = clubAccessError(target, 'join');
  if (access) return res.status(access.status).json({ ...access, error: `That player must reach Level ${access.requiredLevel} before joining clubs.` });
  if (target.clubId && clubs.has(target.clubId)) return res.status(409).json({ error: 'That player is already in a club.' });
  if (club.members.length >= club.progression.memberCap) return res.status(409).json({ error: 'Club is full.' });
  const existing = club.invites.find(invite => invite.userId === target.userId);
  const invite = existing || { id: crypto.randomUUID(), userId: target.userId, createdAt: Date.now(), fromUserId: req.auth.user.userId };
  if (!existing) club.invites.push(invite);
  club.updatedAt = Date.now();
  saveStore();
  emitClubUpdate(club.clubId);
  emitSocialUpdate(target.userId);
  return res.json({ invite, club: publicClubProfile(club, users, req.auth.user.userId, rankedSeason) });
});

app.post('/clubs/:clubId/invites/:inviteId/accept', requireAuth, requireFeature('clubs'), (req, res) => {
  const club = clubById(req.params.clubId);
  if (!club) return res.status(404).json({ error: 'Club invitation not found.' });
  if (frozenClubResponse(club, res)) return;
  normalizeClub(club);
  const invite = club.invites.find(item => item.id === req.params.inviteId && item.userId === req.auth.user.userId);
  if (!invite) return res.status(404).json({ error: 'Club invitation not found.' });
  const access = clubAccessError(req.auth.user, 'join');
  if (access) return res.status(access.status).json(access);
  if (req.auth.user.clubId && clubs.has(req.auth.user.clubId)) return res.status(409).json({ error: 'Leave your current club before joining another.' });
  if (club.members.length >= club.progression.memberCap) return res.status(409).json({ error: 'Club is full.' });

  club.invites = club.invites.filter(item => item.id !== invite.id);
  club.joinRequests = club.joinRequests.filter(item => item.userId !== req.auth.user.userId);
  for (const otherClub of clubs.values()) {
    if (otherClub.clubId === club.clubId) continue;
    otherClub.joinRequests = otherClub.joinRequests.filter(item => item.userId !== req.auth.user.userId);
    otherClub.invites = otherClub.invites.filter(item => item.userId !== req.auth.user.userId);
  }
  club.members.push({
    userId: req.auth.user.userId,
    role: 'rookie',
    joinedAt: Date.now(),
    contributionXp: 0,
    coinContribution: 0,
    contribution: { matches: 0, wins: 0, columnClears: 0, rankedOrWager: 0 },
  });
  req.auth.user.clubId = club.clubId;
  club.updatedAt = Date.now();
  io.in(`user:${req.auth.user.userId}`).socketsJoin(clubSocketRoom(club.clubId));
  saveStore();
  emitClubUpdate(club.clubId);
  emitSocialUpdate(req.auth.user.userId);
  return res.json({
    club: publicClubProfile(club, users, req.auth.user.userId, rankedSeason),
    user: safeUser(req.auth.user),
    invitations: [],
  });
});

app.delete('/clubs/:clubId/invites/:inviteId', requireAuth, requireFeature('clubs'), (req, res) => {
  const club = clubById(req.params.clubId);
  if (!club) return res.status(404).json({ error: 'Club invitation not found.' });
  const before = club.invites.length;
  club.invites = club.invites.filter(item => !(item.id === req.params.inviteId && item.userId === req.auth.user.userId));
  if (before === club.invites.length) return res.status(404).json({ error: 'Club invitation not found.' });
  club.updatedAt = Date.now();
  saveStore();
  emitClubUpdate(club.clubId);
  emitSocialUpdate(req.auth.user.userId);
  return res.json({ ok: true, invitations: userClubInvitations(req.auth.user.userId) });
});

app.post('/clubs/:clubId/donate', requireAuth, requireFeature('clubs.treasury'), (req, res) => {
  const club = clubById(req.params.clubId);
  if (!club) return res.status(404).json({ error: 'Club not found.' });
  if (frozenClubResponse(club, res)) return;
  const result = donateToClubTreasury(req.auth.user, club, req.body?.amount, Date.now(), clubConfig());
  if (result.error) return res.status(400).json({ error: result.error });
  saveStore();
  emitClubUpdate(club.clubId);
  return res.json({
    ...result,
    club: publicClubProfile(club, users, req.auth.user.userId, rankedSeason),
    user: safeUser(req.auth.user),
  });
});

app.put('/clubs/:clubId/treasury-goal', requireAuth, requireFeature('clubs.treasury'), (req, res) => {
  const club = clubById(req.params.clubId);
  if (!club) return res.status(404).json({ error: 'Club not found.' });
  if (frozenClubResponse(club, res)) return;
  const result = setClubTreasuryGoal(req.auth.user, club, req.body || {}, Date.now());
  if (result.error) return res.status(result.error.startsWith('Only ') ? 403 : 400).json({ error: result.error });
  saveStore();
  emitClubUpdate(club.clubId);
  return res.json({ ...result, club: publicClubProfile(club, users, req.auth.user.userId, rankedSeason) });
});

app.delete('/clubs/:clubId/treasury-goal', requireAuth, requireFeature('clubs.treasury'), (req, res) => {
  const club = clubById(req.params.clubId);
  if (!club) return res.status(404).json({ error: 'Club not found.' });
  if (frozenClubResponse(club, res)) return;
  const result = clearClubTreasuryGoal(req.auth.user, club, Date.now());
  if (result.error) return res.status(result.error.startsWith('Only ') ? 403 : 400).json({ error: result.error });
  saveStore();
  emitClubUpdate(club.clubId);
  return res.json({ ...result, club: publicClubProfile(club, users, req.auth.user.userId, rankedSeason) });
});

app.post('/clubs/:clubId/prestige', requireAuth, requireFeature('clubs.treasury'), (req, res) => {
  const club = clubById(req.params.clubId);
  if (!club) return res.status(404).json({ error: 'Club not found.' });
  if (frozenClubResponse(club, res)) return;
  const result = purchaseClubPrestige(req.auth.user, club, clubConfig(), Date.now());
  if (result.error) return res.status(400).json({ error: result.error, nextPrestige: result.nextPrestige || null });
  saveStore();
  emitClubUpdate(club.clubId);
  return res.json({
    ...result,
    club: publicClubProfile(club, users, req.auth.user.userId, rankedSeason),
  });
});

app.post('/clubs/:clubId/leave', requireAuth, requireFeature('clubs'), (req, res) => {
  const club = clubById(req.params.clubId);
  if (!club || !findClubMember(club, req.auth.user.userId)) return res.status(404).json({ error: 'Club not found.' });
  if (frozenClubResponse(club, res)) return;
  const member = findClubMember(club, req.auth.user.userId);
  if (member.role === 'owner' && club.members.length > 1) return res.status(409).json({ error: 'Transfer ownership before leaving.' });
  removeUserFromClub(club, req.auth.user.userId);
  io.in(`user:${req.auth.user.userId}`).socketsLeave(clubSocketRoom(club.clubId));
  if (!club.members.length) clubs.delete(club.clubId);
  else club.updatedAt = Date.now();
  saveStore();
  emitClubUpdate(club.clubId);
  emitSocialUpdate(req.auth.user.userId);
  return res.json({ ok: true, club: null });
});

app.patch('/clubs/:clubId/members/:userId', requireAuth, requireFeature('clubs.management'), (req, res) => {
  const club = clubById(req.params.clubId);
  if (!club) return res.status(404).json({ error: 'Club not found.' });
  if (frozenClubResponse(club, res)) return;
  const actor = findClubMember(club, req.auth.user.userId);
  const target = findClubMember(club, req.params.userId);
  if (!actor || !target) return res.status(404).json({ error: 'Member not found.' });
  const nextRole = String(req.body?.role || target.role);
  if (!['owner', 'officer', 'member', 'rookie'].includes(nextRole)) return res.status(400).json({ error: 'Invalid role.' });
  if (nextRole === 'owner') {
    if (actor.role !== 'owner' || target.userId === actor.userId) return res.status(403).json({ error: 'Only the owner can transfer ownership.' });
    actor.role = 'officer';
    target.role = 'owner';
    club.updatedAt = Date.now();
    saveStore();
    emitClubUpdate(club.clubId);
    return res.json({ club: publicClubProfile(club, users, req.auth.user.userId, rankedSeason) });
  }
  if (!canManageMember(actor.role, target.role, nextRole)) return res.status(403).json({ error: 'You cannot manage that member.' });
  target.role = nextRole;
  club.updatedAt = Date.now();
  saveStore();
  emitClubUpdate(club.clubId);
  return res.json({ club: publicClubProfile(club, users, req.auth.user.userId, rankedSeason) });
});

app.delete('/clubs/:clubId/members/:userId', requireAuth, requireFeature('clubs.management'), (req, res) => {
  const club = clubById(req.params.clubId);
  if (!club) return res.status(404).json({ error: 'Club not found.' });
  if (frozenClubResponse(club, res)) return;
  const actor = findClubMember(club, req.auth.user.userId);
  const target = findClubMember(club, req.params.userId);
  if (!actor || !target) return res.status(404).json({ error: 'Member not found.' });
  if (!canManageMember(actor.role, target.role, target.role)) return res.status(403).json({ error: 'You cannot remove that member.' });
  removeUserFromClub(club, target.userId);
  club.updatedAt = Date.now();
  saveStore();
  emitClubUpdate(club.clubId);
  emitSocialUpdate(target.userId);
  return res.json({ club: publicClubProfile(club, users, req.auth.user.userId, rankedSeason) });
});

app.post('/clubs/:clubId/announcements', requireAuth, requireFeature('clubs.management'), (req, res) => {
  const club = clubById(req.params.clubId);
  if (!club) return res.status(404).json({ error: 'Club not found.' });
  if (frozenClubResponse(club, res)) return;
  const role = currentClubRole(req.auth.user, club);
  if (!canPostAnnouncement(role)) return res.status(403).json({ error: 'Only owners and officers can post announcements.' });
  const cleaned = cleanChatText(req.body?.text);
  if (cleaned.error) return res.status(400).json({ error: cleaned.error });
  const announcement = {
    id: crypto.randomUUID(),
    userId: req.auth.user.userId,
    displayName: req.auth.user.displayName,
    avatarInitial: req.auth.user.displayName.trim().slice(0, 1).toUpperCase(),
    text: cleaned.text,
    createdAt: Date.now(),
  };
  club.announcements = [announcement];
  club.updatedAt = announcement.createdAt;
  saveStore();
  io.to(clubSocketRoom(club.clubId)).emit('club:announcement', announcement);
  emitClubUpdate(club.clubId);
  return res.json({ announcement, club: publicClubProfile(club, users, req.auth.user.userId, rankedSeason) });
});

app.delete('/clubs/:clubId/announcements/:announcementId', requireAuth, requireFeature('clubs.management'), (req, res) => {
  const club = clubById(req.params.clubId);
  if (!club) return res.status(404).json({ error: 'Club not found.' });
  if (frozenClubResponse(club, res)) return;
  const role = currentClubRole(req.auth.user, club);
  if (!canPostAnnouncement(role)) return res.status(403).json({ error: 'Only owners and officers can manage announcements.' });
  const before = club.announcements.length;
  club.announcements = club.announcements.filter(item => item.id !== req.params.announcementId);
  if (before === club.announcements.length) return res.status(404).json({ error: 'Announcement not found.' });
  club.updatedAt = Date.now();
  saveStore();
  emitClubUpdate(club.clubId);
  return res.json({ club: publicClubProfile(club, users, req.auth.user.userId, rankedSeason) });
});

app.post('/clubs/rewards/claim', requireAuth, requireFeature('clubs'), (req, res) => {
  const club = req.auth.user.clubId ? clubById(req.auth.user.clubId) : null;
  if (!club) return res.status(404).json({ error: 'Join a club before claiming club rewards.' });
  if (frozenClubResponse(club, res)) return;
  const result = claimClubReward(req.auth.user, club, String(req.body?.rewardId || ''), Date.now());
  if (result.error) return res.status(400).json({ error: result.error });
  saveStore();
  emitClubUpdate(club.clubId);
  return res.json({
    ...result,
    club: publicClubProfile(club, users, req.auth.user.userId, rankedSeason),
    user: safeUser(req.auth.user),
    cosmetics: cosmeticsFor(req.auth.user),
  });
});

app.post('/friends/requests', requireAuth, requireFeature('social'), (req, res) => {
  const target = findUserByIdentifier(req.body?.userId || req.body?.displayName);
  if (!visiblePlayer(target)) return res.status(404).json({ error: 'Player not found.' });
  if (target.userId === req.auth.user.userId) return res.status(400).json({ error: 'You cannot add yourself.' });
  normalizeSocial(req.auth.user);
  normalizeSocial(target);
  if (isFriend(req.auth.user, target.userId)) return res.status(409).json({ error: 'You are already friends.' });

  const incoming = req.auth.user.social.incomingRequests.find(request => request.userId === target.userId);
  if (incoming) {
    addFriendship(req.auth.user, target);
    saveStore();
    emitSocialUpdate(req.auth.user.userId);
    emitSocialUpdate(target.userId);
    return res.json({ social: socialSummary(req.auth.user), friend: publicPlayerCard(req.auth.user, target) });
  }

  const existing = req.auth.user.social.outgoingRequests.find(request => request.userId === target.userId);
  let outgoingRequest = existing;
  if (!existing) {
    const request = { id: crypto.randomUUID(), userId: target.userId, createdAt: Date.now() };
    req.auth.user.social.outgoingRequests.push(request);
    target.social.incomingRequests.push({ ...request, userId: req.auth.user.userId });
    outgoingRequest = request;
  }
  saveStore();
  emitSocialUpdate(req.auth.user.userId);
  emitSocialUpdate(target.userId);
  queueConfiguredPushToUser(target.userId, 'friendRequest', {
    keyName: 'friendRequest',
    dedupeKey: outgoingRequest?.id || `friend:${req.auth.user.userId}:${target.userId}`,
    templateData: {
      fromDisplayName: req.auth.user.displayName,
    },
    data: {
      type: 'friendRequest',
      fromUserId: req.auth.user.userId,
    },
  });
  return res.json({ social: socialSummary(req.auth.user) });
});

app.post('/friends/requests/:requestId/accept', requireAuth, requireFeature('social'), (req, res) => {
  normalizeSocial(req.auth.user);
  const request = req.auth.user.social.incomingRequests.find(item => item.id === req.params.requestId);
  const from = request ? users.get(request.userId) : null;
  if (!request || !visiblePlayer(from)) return res.status(404).json({ error: 'Friend request not found.' });
  addFriendship(req.auth.user, from);
  saveStore();
  emitSocialUpdate(req.auth.user.userId);
  emitSocialUpdate(from.userId);
  return res.json({ social: socialSummary(req.auth.user), friend: publicPlayerCard(req.auth.user, from) });
});

app.post('/friends/requests/:requestId/reject', requireAuth, requireFeature('social'), (req, res) => {
  normalizeSocial(req.auth.user);
  const request = req.auth.user.social.incomingRequests.find(item => item.id === req.params.requestId);
  const from = request ? users.get(request.userId) : null;
  if (!request || !visiblePlayer(from)) return res.status(404).json({ error: 'Friend request not found.' });
  removeRequestsBetween(req.auth.user, from);
  saveStore();
  emitSocialUpdate(req.auth.user.userId);
  emitSocialUpdate(from.userId);
  return res.json({ social: socialSummary(req.auth.user) });
});

app.delete('/friends/requests/:requestId', requireAuth, requireFeature('social'), (req, res) => {
  normalizeSocial(req.auth.user);
  const outgoing = req.auth.user.social.outgoingRequests.find(item => item.id === req.params.requestId);
  const incoming = req.auth.user.social.incomingRequests.find(item => item.id === req.params.requestId);
  const other = users.get(outgoing?.userId || incoming?.userId || '');
  if (!visiblePlayer(other)) return res.status(404).json({ error: 'Friend request not found.' });
  removeRequestsBetween(req.auth.user, other);
  saveStore();
  emitSocialUpdate(req.auth.user.userId);
  emitSocialUpdate(other.userId);
  return res.json({ social: socialSummary(req.auth.user) });
});

app.delete('/friends/:userId', requireAuth, requireFeature('social'), (req, res) => {
  const target = users.get(String(req.params.userId || ''));
  if (!visiblePlayer(target) || !isFriend(req.auth.user, target.userId)) return res.status(404).json({ error: 'Friend not found.' });
  removeFriendship(req.auth.user, target);
  saveStore();
  emitSocialUpdate(req.auth.user.userId);
  emitSocialUpdate(target.userId);
  return res.json({ social: socialSummary(req.auth.user) });
});

app.get('/economy/catalog', requireAuth, (req, res) => res.json(publicEconomyCatalog(req.auth.user, economyConfig())));

app.post('/economy/daily-bonus/claim', requireAuth, (req, res) => {
  const result = claimDailyTableBonus(req.auth.user);
  if (result.error) return res.status(400).json({ error: result.error, dailyBonus: result.dailyBonus, user: safeUser(req.auth.user) });
  saveStore();
  return res.json({ ...result, user: safeUser(req.auth.user), economy: publicEconomyCatalog(req.auth.user, economyConfig()) });
});

app.get('/ranked/catalog', requireAuth, (_req, res) => {
  return res.json({ catalog: publicRankedCatalog() });
});

app.get('/ranked/me', requireAuth, (req, res) => {
  rankedSeason = normalizeRankedSeason(rankedSeason, Date.now(), rankedConfig());
  normalizeCompetitiveState(req.auth.user, rankedSeason, rankedConfig());
  return res.json({
    competitive: publicCompetitiveState(req.auth.user, rankedSeason, rankedConfig()),
    competitiveByPlayers: publicCompetitiveByPlayers(req.auth.user, rankedSeason, rankedConfig()),
    displayRankSelection: req.auth.user.displayRankSelection || null,
    displayRankEmblem: resolveDisplayRankEmblem(req.auth.user, rankedSeason, rankedConfig()),
    displayRankEmblemChoices: rankedDisplayEmblemChoices(req.auth.user, rankedSeason, rankedConfig()),
    queue: publicRankedQueueStatus(req.auth.user.userId),
    forfeitStatus: publicForfeitStatus(req.auth.user, rankedSeason, forfeitConfigStore),
  });
});

app.patch('/ranked/display-emblem', requireAuth, (req, res) => {
  const result = setDisplayRankEmblem(req.auth.user, req.body || null, rankedSeason, rankedConfig());
  if (result.error) return res.status(400).json(result);
  for (const room of rooms.values()) {
    const gamePlayer = room.game?.players?.find(player => player.userId === req.auth.user.userId);
    if (gamePlayer) gamePlayer.displayRankEmblem = result.displayRankEmblem;
    if (room.players.some(player => player.userId === req.auth.user.userId)) broadcastRoom(room);
  }
  saveStore();
  return res.json({ ...result, user: safeUser(req.auth.user), choices: rankedDisplayEmblemChoices(req.auth.user, rankedSeason, rankedConfig()) });
});

app.post('/ranked/queue', requireAuth, requireFeature(req => rankedFeatureKey(req.body?.maxPlayers)), (req, res) => {
  rankedSeason = normalizeRankedSeason(rankedSeason, Date.now(), rankedConfig());
  if (blockRankedForfeitRestriction(req, res)) return;
  if (blockActiveMatch(req, res)) return;
  const activeRoom = activeRankedRoomForUser(req.auth.user.userId);
  if (activeRoom) {
    return res.json({
      queue: publicRankedQueueStatus(req.auth.user.userId),
      competitive: publicCompetitiveState(req.auth.user, rankedSeason, rankedConfig(), activeRoom.maxPlayers),
      competitiveByPlayers: publicCompetitiveByPlayers(req.auth.user, rankedSeason, rankedConfig()),
    });
  }
  const options = normalizeRankedRoomOptions(req.body || {});
  const competitive = normalizeCompetitiveState(req.auth.user, rankedSeason, rankedConfig(), options.maxPlayers);
  const buyIn = rankedBuyInForMmr(competitive.mmr);
  const error = buyInError(req.auth.user, buyIn);
  if (error) return res.status(402).json({ error, buyIn, balance: req.auth.user.currency.coins });
  removeUserFromRankedQueue(req.auth.user.userId);
  rankedQueue.set(req.auth.user.userId, rankedQueueEntry(req.auth.user, options));
  tryMatchRankedQueue();
  return res.json({
    queue: publicRankedQueueStatus(req.auth.user.userId),
    competitive: publicCompetitiveState(req.auth.user, rankedSeason, rankedConfig(), options.maxPlayers),
    competitiveByPlayers: publicCompetitiveByPlayers(req.auth.user, rankedSeason, rankedConfig()),
  });
});

app.get('/ranked/queue', requireAuth, requireFeature(req => {
  const queue = rankedQueue.get(req.auth.user.userId);
  return rankedFeatureKey(queue?.maxPlayers || req.query.maxPlayers || 2);
}), (req, res) => {
  tryMatchRankedQueue();
  const queue = publicRankedQueueStatus(req.auth.user.userId);
  const playerCount = queue.room?.maxPlayers || queue.maxPlayers || 2;
  return res.json({
    queue,
    competitive: publicCompetitiveState(req.auth.user, rankedSeason, rankedConfig(), playerCount),
    competitiveByPlayers: publicCompetitiveByPlayers(req.auth.user, rankedSeason, rankedConfig()),
  });
});

app.delete('/ranked/queue', requireAuth, (req, res) => {
  removeUserFromRankedQueue(req.auth.user.userId);
  return res.json({ queue: publicRankedQueueStatus(req.auth.user.userId) });
});

app.post('/ranked/season/rewards/claim', requireAuth, (req, res) => {
  rankedSeason = normalizeRankedSeason(rankedSeason, Date.now(), rankedConfig());
  const result = claimSeasonRewards(req.auth.user, rankedSeason, rankedConfig());
  saveStore();
  return res.json({ ...result, user: safeUser(req.auth.user), cosmetics: cosmeticsFor(req.auth.user) });
});

app.get('/cosmetics/catalog', requireAuth, requireFeature('profile'), (req, res) => res.json({ cosmetics: cosmeticsFor(req.auth.user) }));

app.post('/challenges/claim', requireAuth, (req, res) => {
  const result = claimChallengeReward(req.auth.user, String(req.body?.challengeId || ''));
  if (result.error) return res.status(400).json({ error: result.error });
  saveStore();
  return res.json({ ...result, user: safeUser(req.auth.user) });
});

app.post('/cosmetics/purchase', requireAuth, requireFeature('shop'), (req, res) => {
  const result = purchaseCosmetic(req.auth.user, String(req.body?.cosmeticId || ''), rankedSeason, currentCatalog(), rankedConfig());
  if (result.error) return res.status(400).json({ error: result.error });
  saveStore();
  return res.json({ ...result, user: safeUser(req.auth.user), cosmetics: cosmeticsFor(req.auth.user) });
});

app.post('/cosmetics/equip', requireAuth, requireFeature('profile'), (req, res) => {
  const result = equipCosmetic(req.auth.user, String(req.body?.cosmeticId || ''), currentCatalog(), rankedSeason, rankedConfig());
  if (result.error) return res.status(400).json({ error: result.error });
  saveStore();
  return res.json({ ...result, user: safeUser(req.auth.user), cosmetics: cosmeticsFor(req.auth.user) });
});

app.get('/results/me', requireAuth, (req, res) => res.json({ results: userResults(req.auth.user.userId) }));

app.post('/results/local', requireAuth, requireFeature(req => req.body?.mode === 'solo' ? 'offline.solo_ai' : 'offline.pass_play'), (req, res) => {
  const clientResultId = String(req.body?.clientResultId || '').trim();
  if (clientResultId && !/^[A-Za-z0-9_-]{8,80}$/.test(clientResultId)) {
    return res.status(400).json({ error: 'Invalid local result identifier.' });
  }
  if (clientResultId) {
    const existing = results.find(result => (
      result.clientResultId === clientResultId
      && result.players?.[0]?.userId === req.auth.user.userId
    ));
    if (existing) {
      return res.json({
        result: existing,
        progression: existing.players?.[0]?.progression || null,
        user: safeUser(req.auth.user),
        duplicate: true,
      });
    }
  }
  const mode = req.body?.mode === 'solo' ? 'solo' : 'passplay';
  const totalRounds = Number(req.body?.totalRounds) === 5 ? 5 : 9;
  const submittedCompletedAt = Number(req.body?.completedAt);
  const now = Date.now();
  const completedAt = Number.isFinite(submittedCompletedAt)
    && submittedCompletedAt >= now - (90 * 24 * 60 * 60 * 1000)
    && submittedCompletedAt <= now + (5 * 60 * 1000)
    ? Math.floor(submittedCompletedAt)
    : now;
  const submittedPlayers = Array.isArray(req.body?.players) ? req.body.players : [];
  const normalizedPlayers = submittedPlayers.length
    ? submittedPlayers.slice(0, 4).map((player, index) => ({
      userId: index === 0 ? req.auth.user.userId : `local-${index + 1}`,
      displayName: index === 0 ? req.auth.user.displayName : String(player.displayName || `Player ${index + 1}`).slice(0, 32),
      total: Number(player.total ?? 0) || 0,
      won: Boolean(player.won),
    }))
    : [{
      userId: req.auth.user.userId,
      displayName: req.auth.user.displayName,
      total: Number(req.body?.total ?? 0) || 0,
      won: Boolean(req.body?.won),
    }];
  const winningTotal = Math.min(...normalizedPlayers.map(player => player.total));
  for (const player of normalizedPlayers) player.won = player.total === winningTotal;
  const accountPlayer = normalizedPlayers[0];
  const progression = applyMatchProgression(req.auth.user, {
    mode,
    total: accountPlayer.total,
    won: accountPlayer.won,
    totalRounds,
    roundScores: Array.isArray(req.body?.roundScores) ? req.body.roundScores.filter(Number.isFinite) : [],
    columnClears: Number(req.body?.columnClears ?? 0) || 0,
  });
  accountPlayer.progression = progression;

  const result = {
    resultId: crypto.randomUUID(),
    clientResultId: clientResultId || null,
    completedAt,
    roomCode: null,
    mode,
    round: totalRounds,
    totalRounds,
    players: normalizedPlayers,
  };
  results.push(result);
  saveStore();
  return res.json({ result, progression, user: safeUser(req.auth.user) });
});

app.get('/rooms/active', requireAuth, (req, res) => res.json(activeRoomPayloadForUser(req.auth.user.userId)));

app.post('/rooms', requireAuth, requireFeature('casual.create_room'), (req, res) => {
  if (blockActiveMatch(req, res)) return;
  const room = makeRoom(req.auth.user, {
    ...(req.body || {}),
    isPublic: req.body?.isPublic !== false,
    availabilityFeature: 'casual.create_room',
  });
  return res.json({ room: roomSummary(room) });
});

app.get('/rooms/open', requireAuth, requireFeature(req => req.query.matchType === 'wager' ? 'casual.wagers' : 'casual'), (req, res) => {
  const matchType = ['casual', 'wager'].includes(String(req.query.matchType || ''))
    ? String(req.query.matchType)
    : null;
  const maxPlayers = req.query.maxPlayers ? normalizeRankedPlayerCount(req.query.maxPlayers) : null;
  const rounds = req.query.rounds ? (Number(req.query.rounds) === 5 ? 5 : 9) : null;
  const buyIn = req.query.buyIn !== undefined ? normalizeBuyIn(req.query.buyIn, economyConfig()) : null;
  const openRooms = [...rooms.values()]
    .filter(room => room.isPublic)
    .filter(room => room.status === 'lobby')
    .filter(room => room.players.length < room.maxPlayers)
    .filter(room => !room.players.some(player => player.userId === req.auth.user.userId))
    .filter(room => !blockedAvailability(roomAvailabilityFeature(room), req.auth.user.userId))
    .filter(room => !matchType || room.matchType === matchType)
    .filter(room => !maxPlayers || room.maxPlayers === maxPlayers)
    .filter(room => !rounds || room.rounds === rounds)
    .filter(room => buyIn === null || (room.economy?.buyIn || 0) === buyIn)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 50)
    .map(roomSummary);
  return res.json({ rooms: openRooms });
});

app.post('/rooms/quick-play', requireAuth, requireFeature('casual.auto_match'), (req, res) => {
  if (blockActiveMatch(req, res)) return;
  const options = normalizeRoomOptions(req.body || {});
  const existingForUser = [...rooms.values()].find(room =>
    room.status === 'lobby'
    && room.isPublic
    && room.matchType === 'casual'
    && room.maxPlayers === options.maxPlayers
    && room.rounds === options.rounds
    && room.players.some(player => player.userId === req.auth.user.userId)
  );
  let room = existingForUser || [...rooms.values()].find(item =>
    item.status === 'lobby'
    && item.isPublic
    && item.matchType === 'casual'
    && item.maxPlayers === options.maxPlayers
    && item.rounds === options.rounds
    && item.players.length < item.maxPlayers
    && !item.players.some(player => player.userId === req.auth.user.userId)
  );

  if (!room) room = makeRoom(req.auth.user, { ...options, isPublic: true, availabilityFeature: 'casual.auto_match' });
  else {
    try {
      addUserToRoom(room, req.auth.user);
    } catch (error) {
      return res.status(409).json({ error: error.message });
    }
  }

  room.isPublic = true;
  room.updatedAt = Date.now();
  broadcastRoom(room);
  return res.json({ room: roomSummary(room) });
});

app.post('/rooms/wager-play', requireAuth, requireFeature('casual.wagers'), (req, res) => {
  if (blockActiveMatch(req, res)) return;
  const options = normalizeWagerOptions(req.body || {});
  if (!options.buyIn) return res.status(400).json({ error: 'Choose a wager table buy-in.' });
  const error = buyInError(req.auth.user, options.buyIn);
  if (error) return res.status(402).json({ error, buyIn: options.buyIn, balance: req.auth.user.currency.coins });

  const existingForUser = [...rooms.values()].find(room =>
    room.status === 'lobby'
    && room.isPublic
    && room.matchType === 'wager'
    && room.economy?.buyIn === options.buyIn
    && room.maxPlayers === options.maxPlayers
    && room.rounds === options.rounds
    && room.players.some(player => player.userId === req.auth.user.userId)
  );
  let room = existingForUser || [...rooms.values()].find(item =>
    item.status === 'lobby'
    && item.isPublic
    && item.matchType === 'wager'
    && item.economy?.buyIn === options.buyIn
    && item.maxPlayers === options.maxPlayers
    && item.rounds === options.rounds
    && item.players.length < item.maxPlayers
    && !item.players.some(player => player.userId === req.auth.user.userId)
  );

  if (!room) room = makeRoom(req.auth.user, {
    ...options,
    matchType: 'wager',
    buyIn: options.buyIn,
    isPublic: true,
    availabilityFeature: 'casual.wagers',
  });
  else {
    try {
      addUserToRoom(room, req.auth.user);
    } catch (errorToReport) {
      return res.status(409).json({ error: errorToReport.message });
    }
  }

  room.isPublic = true;
  room.updatedAt = Date.now();
  broadcastRoom(room);
  return res.json({ room: roomSummary(room) });
});

app.post('/rooms/:code/join', requireAuth, requireFeature('casual.join_room'), (req, res) => {
  if (blockActiveMatch(req, res)) return;
  const room = rooms.get(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found.' });
  if (blockRoomFeature(room, req.auth.user.userId, res)) return;
  if (room.status !== 'lobby') return res.status(409).json({ error: 'Game already started.' });
  if (room.economy?.buyIn) {
    const error = buyInError(req.auth.user, room.economy.buyIn);
    if (error) return res.status(402).json({ error, buyIn: room.economy.buyIn, balance: req.auth.user.currency.coins });
  }
  try {
    addUserToRoom(room, req.auth.user);
  } catch (error) {
    return res.status(409).json({ error: error.message });
  }
  room.updatedAt = Date.now();
  broadcastRoom(room);
  return res.json({ room: roomSummary(room) });
});

app.post('/rooms/:code/invites', requireAuth, requireFeature('social'), (req, res) => {
  const room = rooms.get(req.params.code.toUpperCase());
  const target = users.get(String(req.body?.userId || ''));
  if (!room) return res.status(404).json({ error: 'Room not found.' });
  if (blockRoomFeature(room, req.auth.user.userId, res)) return;
  if (!visiblePlayer(target)) return res.status(404).json({ error: 'Friend not found.' });
  if (room.status !== 'lobby') return res.status(409).json({ error: 'Invites are only available before the game starts.' });
  if (!room.players.some(player => player.userId === req.auth.user.userId)) return res.status(403).json({ error: 'Join the room before inviting friends.' });
  if (!isFriend(req.auth.user, target.userId)) return res.status(403).json({ error: 'Only friends can be invited from the friends list.' });
  if (room.players.some(player => player.userId === target.userId)) return res.status(409).json({ error: 'That player is already in this room.' });
  if (room.players.length >= room.maxPlayers) return res.status(409).json({ error: 'Room is full.' });

  normalizeSocial(target);
  target.social.roomInvites = target.social.roomInvites.filter(invite => !(invite.roomCode === room.code && invite.fromUserId === req.auth.user.userId));
  const invite = {
    id: crypto.randomUUID(),
    roomCode: room.code,
    fromUserId: req.auth.user.userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + ROOM_INVITE_TTL_MS,
  };
  target.social.roomInvites.push(invite);
  saveStore();
  emitSocialUpdate(target.userId);
  queueConfiguredPushToUser(target.userId, 'roomInvite', {
    keyName: 'roomInvite',
    dedupeKey: invite.id,
    templateData: {
      fromDisplayName: req.auth.user.displayName,
      roomCode: room.code,
    },
    data: {
      type: 'roomInvite',
      inviteId: invite.id,
      roomCode: room.code,
      fromUserId: req.auth.user.userId,
    },
  });
  return res.json({ invite: publicRoomInvite(target, invite), social: socialSummary(req.auth.user) });
});

app.post('/rooms/invites/:inviteId/accept', requireAuth, requireFeature('casual.join_room'), (req, res) => {
  if (blockActiveMatch(req, res)) return;
  normalizeSocial(req.auth.user);
  const invite = req.auth.user.social.roomInvites.find(item => item.id === req.params.inviteId);
  if (!invite) return res.status(404).json({ error: 'Invite not found.' });
  const room = rooms.get(invite.roomCode);
  const inviter = users.get(invite.fromUserId);
  if (!visiblePlayer(inviter)) {
    req.auth.user.social.roomInvites = req.auth.user.social.roomInvites.filter(item => item.id !== invite.id);
    saveStore();
    return res.status(404).json({ error: 'Invite is no longer available.' });
  }
  if (!room || room.status !== 'lobby') {
    req.auth.user.social.roomInvites = req.auth.user.social.roomInvites.filter(item => item.id !== invite.id);
    saveStore();
    return res.status(404).json({ error: 'Room is no longer available.' });
  }
  if (blockRoomFeature(room, req.auth.user.userId, res)) return;
  if (room.economy?.buyIn) {
    const error = buyInError(req.auth.user, room.economy.buyIn);
    if (error) return res.status(402).json({ error, buyIn: room.economy.buyIn, balance: req.auth.user.currency.coins });
  }
  try {
    addUserToRoom(room, req.auth.user);
  } catch (error) {
    return res.status(409).json({ error: error.message });
  }
  req.auth.user.social.roomInvites = req.auth.user.social.roomInvites.filter(item => item.id !== invite.id);
  room.updatedAt = Date.now();
  saveStore();
  broadcastRoom(room);
  emitSocialUpdate(req.auth.user.userId);
  return res.json({ room: roomSummary(room), social: socialSummary(req.auth.user) });
});

app.delete('/rooms/invites/:inviteId', requireAuth, (req, res) => {
  normalizeSocial(req.auth.user);
  const before = req.auth.user.social.roomInvites.length;
  req.auth.user.social.roomInvites = req.auth.user.social.roomInvites.filter(item => item.id !== req.params.inviteId);
  if (before === req.auth.user.social.roomInvites.length) return res.status(404).json({ error: 'Invite not found.' });
  saveStore();
  emitSocialUpdate(req.auth.user.userId);
  return res.json({ social: socialSummary(req.auth.user) });
});

function socketAuth(socket) {
  const token = socket.handshake.auth?.token;
  const auth = authenticateToken(token);
  if (!auth) return null;
  const deviceHash = trackUserDevice(auth.user, {
    headers: {
      'x-golf9-device-id': socket.handshake.auth?.deviceId || socket.handshake.headers?.['x-golf9-device-id'],
      'x-golf9-platform': socket.handshake.auth?.platform || socket.handshake.headers?.['user-agent'],
      'user-agent': socket.handshake.headers?.['user-agent'],
    },
  });
  const moderationError = banErrorFor(adminStore, auth.user, deviceHash);
  if (moderationError) return null;
  return auth;
}

io.use((socket, next) => {
  const auth = socketAuth(socket);
  if (!auth) return next(new Error('Authentication required.'));
  socket.auth = auth;
  socket.releaseClient = releaseClientFromSocket(socket);
  return next();
});

io.on('connection', (socket) => {
  const connectedUserId = socket.auth.user.userId;
  const connectedReleasePolicy = releasePolicyForClient(socket.releaseClient);
  socket.emit('release-policy:update', connectedReleasePolicy);
  socket.use(([eventName, payload], next) => {
    const policy = releasePolicyForClient(socket.releaseClient);
    if (!policy || policy.status !== 'required') return next();
    const activeRoom = activePlayingRoomForUser(connectedUserId);
    const activeRoomCode = activeRoom?.code || null;
    const eventRoomCode = String(payload?.code || '').trim().toUpperCase();
    const activeMatchEvents = new Set([
      'room:join',
      'presence:state',
      'chat:send',
      'game:intent',
      'game:take-control',
      'game:forfeit',
    ]);
    if (policy.enforcement === 'after_match'
      && activeRoomCode
      && activeMatchEvents.has(eventName)
      && eventRoomCode === activeRoomCode) return next();
    const blocked = updateRequiredPayload(policy);
    socket.emit('release-policy:required', blocked);
    const error = new Error(blocked.error);
    error.data = blocked;
    return next(error);
  });
  socket.emit('availability:update', {
    revision: availabilityStore.revision,
    availability: publicAvailability(availabilityStore, connectedUserId),
  });
  socket.join(`user:${connectedUserId}`);
  if (!userSockets.has(connectedUserId)) userSockets.set(connectedUserId, new Set());
  userSockets.get(connectedUserId).add(socket.id);
  if (!clubForegroundSockets.has(connectedUserId)) clubForegroundSockets.set(connectedUserId, new Set());
  clubForegroundSockets.get(connectedUserId).add(socket.id);
  const connectedClub = socket.auth.user.clubId ? clubById(socket.auth.user.clubId) : null;
  if (connectedClub && findClubMember(connectedClub, connectedUserId)) {
    socket.join(clubSocketRoom(connectedClub.clubId));
    emitClubPresence(connectedClub.clubId);
  }

  socket.on('room:join', ({ code }, cb = () => {}) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room) return cb({ error: 'Room not found.' });
    const userId = socket.auth.user.userId;
    if (!room.players.some(player => player.userId === userId)) return cb({ error: 'You are not a member of this room.' });
    if (room.forfeits?.has(userId)) return cb({ error: 'You forfeited this match and cannot rejoin it.' });
    if (room.status !== 'playing') {
      const unavailable = socketFeatureUnavailable(roomAvailabilityFeature(room), userId);
      if (unavailable) return cb(unavailable);
    }
    socket.join(room.code);
    socket.join(`${room.code}:${userId}`);
    sockets.set(socket.id, { roomCode: room.code, userId });
    room.connected.set(userId, true);
    room.foreground ||= new Map();
    room.foreground.set(userId, true);
    const gameChanged = resolveRoomExpiredTimers(room);
    if (gameChanged) recordCompletedGame(room);
    room.updatedAt = Date.now();
    broadcastRoom(room);
    socket.emit('chat:history', publicChatHistory(room));
    return cb({ room: roomSummary(room), game: room.game ? gameViewFor(room, userId) : null, chat: publicChatHistory(room) });
  });

  socket.on('room:ready', ({ code }, cb = () => {}) => {
    const room = rooms.get(String(code || '').toUpperCase());
    const userId = socket.auth.user.userId;
    if (!room || !room.players.some(player => player.userId === userId)) return cb({ error: 'Room not found.' });
    if (room.status !== 'lobby') return cb({ error: 'Game already started.' });
    const unavailable = socketFeatureUnavailable(roomAvailabilityFeature(room), userId);
    if (unavailable) return cb(unavailable);
    room.ready.set(userId, true);
    room.updatedAt = Date.now();
    broadcastRoom(room);
    return cb({ room: roomSummary(room) });
  });

  socket.on('room:start', ({ code }, cb = () => {}) => {
    const room = rooms.get(String(code || '').toUpperCase());
    const userId = socket.auth.user.userId;
    if (!room) return cb({ error: 'Room not found.' });
    if (room.hostUserId !== userId) return cb({ error: 'Only the host can start.' });
    const unavailable = socketFeatureUnavailable(roomAvailabilityFeature(room), userId);
    if (unavailable) return cb(unavailable);
    try {
      startRoomGame(room, { requireReady: false });
      broadcastRoom(room);
      return cb({ ok: true });
    } catch (error) {
      return cb({ error: error.message });
    }
  });

  socket.on('room:leave', ({ code }, cb = () => {}) => {
    const room = rooms.get(String(code || '').toUpperCase());
    const userId = socket.auth.user.userId;
    if (!room) return cb({ ok: true });
    if (room.status === 'playing' && room.game && !room.game.completed) {
      return cb({
        error: 'Finish your active match before leaving the table.',
        activeRoom: roomSummary(room),
      });
    }
    room.players = room.players.filter(player => player.userId !== userId);
    room.ready.delete(userId);
    room.connected.delete(userId);
    room.foreground?.delete(userId);
    if (room.hostUserId === userId && room.players.length) room.hostUserId = room.players[0].userId;
    cancelRoomCountdown(room);
    if (!room.players.length) {
      cancelAllAutoplaySchedules(room);
      rooms.delete(room.code);
    }
    else broadcastRoom(room);
    room.chatRate?.delete(userId);
    socket.leave(room.code);
    socket.leave(`${room.code}:${userId}`);
    return cb({ ok: true });
  });

  socket.on('game:forfeit', ({ code }, cb = () => {}) => {
    const room = rooms.get(String(code || '').toUpperCase());
    const userId = socket.auth.user.userId;
    if (!room || !room.players.some(player => player.userId === userId)) return cb({ error: 'Game not found.' });
    return cb(forfeitOnlineMatch(room, userId));
  });

  socket.on('presence:state', ({ code, foreground }, cb = () => {}) => {
    const room = rooms.get(String(code || '').toUpperCase());
    const userId = socket.auth.user.userId;
    if (!room || !room.players.some(player => player.userId === userId)) return cb({ error: 'Room not found.' });
    if (room.forfeits?.has(userId)) return cb({ error: 'You forfeited this match.' });
    room.foreground ||= new Map();
    room.connected.set(userId, true);
    room.foreground.set(userId, foreground !== false);
    room.updatedAt = Date.now();
    maybeSendTurnPush(room);
    return cb({ ok: true });
  });

  socket.on('chat:send', ({ code, type = 'text', text, targetUserId = null }, cb = () => {}) => {
    const room = rooms.get(String(code || '').toUpperCase());
    const userId = socket.auth.user.userId;
    if (!room || !room.players.some(player => player.userId === userId)) return cb({ error: 'Room not found.' });
    if (room.forfeits?.has(userId)) return cb({ error: 'You forfeited this match.' });
    if (activeBansFor(adminStore, socket.auth.user).some(ban => ban.type === 'chat_mute')) return cb({ error: 'Chat is muted for this account.' });
    room.chatRate ||= new Map();
    const now = Date.now();
    const lastSentAt = room.chatRate.get(userId) || 0;
    if (now - lastSentAt < CHAT_RATE_LIMIT_MS) return cb({ error: 'Slow down before sending another chat.' });
    const result = makeChatMessage(room, userId, type, text, targetUserId);
    if (result.error) return cb({ error: result.error });
    room.chatRate.set(userId, now);
    addChatMessage(room, result.message);
    const user = users.get(userId);
    if (user) {
      const progression = registerSocialMessage(user, now);
      emitProgressionCelebrations(room, userId, result.message.displayName, result.message.avatarInitial, progression);
    }
    room.updatedAt = now;
    saveStore();
    io.to(room.code).emit('chat:message', result.message);
    return cb({ ok: true, message: result.message });
  });

  socket.on('club:join', ({ clubId }, cb = () => {}) => {
    const club = clubById(clubId || socket.auth.user.clubId);
    const userId = socket.auth.user.userId;
    const unavailable = socketFeatureUnavailable('clubs', userId);
    if (unavailable) return cb(unavailable);
    if (!club || !findClubMember(club, userId)) return cb({ error: 'Club not found.' });
    socket.join(clubSocketRoom(club.clubId));
    if (!clubForegroundSockets.has(userId)) clubForegroundSockets.set(userId, new Set());
    clubForegroundSockets.get(userId).add(socket.id);
    socket.emit('club:chat:history', []);
    emitClubPresence(club.clubId);
    return cb({
      club: publicClubProfile(club, users, userId, rankedSeason),
      chat: [],
    });
  });

  socket.on('club:presence:state', ({ foreground }, cb = () => {}) => {
    const user = socket.auth.user;
    const unavailable = socketFeatureUnavailable('clubs', user.userId);
    if (unavailable) return cb(unavailable);
    const club = user.clubId ? clubById(user.clubId) : null;
    if (!club || !findClubMember(club, user.userId)) return cb({ error: 'Club not found.' });
    if (!clubForegroundSockets.has(user.userId)) clubForegroundSockets.set(user.userId, new Set());
    const foregroundSockets = clubForegroundSockets.get(user.userId);
    if (foreground === false) foregroundSockets.delete(socket.id);
    else foregroundSockets.add(socket.id);
    if (!foregroundSockets.size) clubForegroundSockets.delete(user.userId);
    emitClubPresence(club.clubId);
    return cb({ ok: true });
  });

  socket.on('club:chat:send', ({ clubId, type = 'text', text }, cb = () => {}) => {
    const club = clubById(clubId || socket.auth.user.clubId);
    const user = socket.auth.user;
    const unavailable = socketFeatureUnavailable('clubs.chat', user.userId);
    if (unavailable) return cb(unavailable);
    if (!club || !findClubMember(club, user.userId)) return cb({ error: 'Club not found.' });
    if (club.adminStatus?.frozenAt) return cb({ error: 'This club is temporarily frozen by Nine Below support.' });
    if (activeBansFor(adminStore, user).some(ban => ban.type === 'chat_mute')) return cb({ error: 'Chat is muted for this account.' });
    const now = Date.now();
    const rateKey = `${club.clubId}:${user.userId}`;
    const lastSentAt = clubChatRate.get(rateKey) || 0;
    if (now - lastSentAt < CLUB_CHAT_RATE_LIMIT_MS) return cb({ error: 'Slow down before sending another club chat.' });
    const result = makeClubChatMessage(club, user, type, text);
    if (result.error) return cb({ error: result.error });
    clubChatRate.set(rateKey, now);
    io.to(clubSocketRoom(club.clubId)).emit('club:chat:message', result.message);
    return cb({ ok: true, message: result.message });
  });

  socket.on('game:intent', ({ code, actionId, type, payload }, cb = () => {}) => {
    const room = rooms.get(String(code || '').toUpperCase());
    const userId = socket.auth.user.userId;
    if (!room || !room.game) return cb({ error: 'Game not found.' });
    if (room.forfeits?.has(userId)) return cb({ error: 'You forfeited this match.' });
    if (!isValidActionId(actionId)) return cb({ error: 'Invalid action id.' });
    if (!['peek', 'draw', 'takeDiscard', 'switchDiscardToDraw', 'reveal', 'replace', 'discard', 'continueRound'].includes(type)) return cb({ error: 'Unknown action.' });
    if ((type === 'peek' || type === 'reveal' || type === 'replace') && !isGridCoordinate(payload)) return cb({ error: 'Invalid grid coordinate.' });
    if (room.processedActionIds.has(actionId)) return cb({ ok: true, duplicate: true });
    if (resolveRoomExpiredTimers(room)) {
      recordCompletedGame(room);
      room.updatedAt = Date.now();
      broadcastRoom(room);
      return cb({ error: 'Timer expired. Board updated.' });
    }
    const idx = getRoomPlayerIndex(room, userId);
    if (idx < 0) return cb({ error: 'You are not seated in this game.' });
    room.held ||= new Map();
    room.heldSource ||= new Map();
    room.heldMustReplace ||= new Map();
    room.heldCanDiscard ||= new Map();
    const beforeGame = room.game;
    let result = { state: room.game, error: 'Unknown action.' };
    let drawn = null;
    if (type === 'continueRound') {
      if (room.game.phase !== 'roundSummary') return cb({ error: 'Round summary is not active.' });
      captureRoundProgress(room);
      room.roundSummaryAcks ||= new Set();
      room.roundSummaryAcks.add(userId);
      const allAcknowledged = room.players.every(player => room.roundSummaryAcks.has(player.userId));
      result = allAcknowledged ? continueAfterRoundSummary(room.game) : { state: room.game };
      if (!result.error && allAcknowledged) room.roundSummaryAcks = new Set();
    }
    if (type === 'peek') result = flipForPeek(room.game, idx, payload.r, payload.c);
    if (type === 'draw' || type === 'takeDiscard') {
      if (room.game.currentPlayerIndex !== idx) return cb({ error: 'Not your turn.' });
      if (room.held.get(userId)) return cb({ error: 'You already have a held card.' });
      result = type === 'draw' ? drawFromDeck(room.game) : takeDiscard(room.game);
      drawn = result.drawn || null;
      if (drawn) {
        const faceDownCount = countFaceDownCards(room.game.players[idx]?.grid);
        const isBonusDraw = room.game.mustDrawOnlyForPlayerIndex === idx;
        room.held.set(userId, drawn);
        room.heldSource.set(userId, type === 'draw' ? 'draw' : 'discard');
        room.heldMustReplace.set(userId, type === 'takeDiscard' && faceDownCount === 1 && !room.game.sweepActive);
        room.heldCanDiscard.set(userId, type === 'draw' && (isBonusDraw || (faceDownCount === 1 && !room.game.sweepActive)));
      }
    }
    if (type === 'switchDiscardToDraw') {
      if (room.game.currentPlayerIndex !== idx) return cb({ error: 'Not your turn.' });
      if (room.game.pendingDecision) return cb({ error: 'Finish the revealed-card decision first.' });
      const heldCard = room.held.get(userId);
      const heldSource = room.heldSource.get(userId);
      if (!heldCard || heldSource !== 'discard') return cb({ error: 'No discard card to switch.' });

      const restoredState = structuredClone(room.game);
      const restoredCard = { ...heldCard, faceUp: true };
      restoredState.discardPile.push(restoredCard);
      restoredState.topDiscard = restoredCard;
      result = drawFromDeck(restoredState);
      drawn = result.drawn || null;
      if (drawn) {
        const faceDownCount = countFaceDownCards(result.state.players[idx]?.grid);
        const isBonusDraw = result.state.mustDrawOnlyForPlayerIndex === idx;
        room.held.set(userId, drawn);
        room.heldSource.set(userId, 'draw');
        room.heldMustReplace.set(userId, false);
        room.heldCanDiscard.set(userId, isBonusDraw || (faceDownCount === 1 && !result.state.sweepActive));
      }
    }
    if (type === 'reveal') {
      if (!room.held.get(userId)) return cb({ error: 'Draw or take a card first.' });
      result = revealGridCardForDecision(room.game, idx, payload.r, payload.c);
    }
    if (type === 'replace' || type === 'discard') {
      const heldCard = room.held.get(userId);
      const heldSource = room.heldSource.get(userId);
      const heldCanDiscard = room.heldCanDiscard.get(userId) || false;
      if (!heldCard) return cb({ error: 'Draw or take a card first.' });
      if (type === 'discard' && heldSource === 'discard' && !room.game.pendingDecision) {
        return cb({ error: 'Cards taken from the discard pile must be played to your grid.' });
      }
      if (type === 'discard' && heldSource === 'draw' && !heldCanDiscard && !room.game.pendingDecision) {
        return cb({ error: 'Drawn cards can only be discarded when you have one face-down card left.' });
      }
      if (room.game.pendingDecision) {
        result = resolvePendingGridDecision(room.game, idx, heldCard, type === 'replace' ? 'drawn' : 'revealed');
      } else if (type === 'replace') {
        const target = room.game.players[idx]?.grid?.[payload.r]?.[payload.c];
        if (target && !target.faceUp) return cb({ error: 'Reveal that card before choosing whether to replace it.' });
        result = replaceGridCard(room.game, idx, payload.r, payload.c, heldCard);
      } else {
        result = discardDrawn(room.game, idx, heldCard);
      }
      if (!result.error) {
        room.held.delete(userId);
        room.heldSource.delete(userId);
        room.heldMustReplace.delete(userId);
        room.heldCanDiscard.delete(userId);
      }
    }
    if (result.error) return cb({ error: result.error });
    if (type !== 'continueRound') recordHumanRoomAction(room, userId);
    trackColumnClears(room, userId, countNewClearedColumns(beforeGame, result.state, idx));
    room.game = result.state;
    captureRoundProgress(room);
    recordCompletedGame(room);
    rememberActionId(room, actionId);
    room.updatedAt = Date.now();
    broadcastRoom(room);
    return cb({ ok: true, drawn });
  });

  socket.on('game:take-control', ({ code }, cb = () => {}) => {
    const room = rooms.get(String(code || '').toUpperCase());
    const userId = socket.auth.user.userId;
    if (!room?.game || room.game.completed || room.status !== 'playing') return cb({ error: 'Game not found.' });
    if (room.forfeits?.has(userId)) return cb({ error: 'A forfeited seat remains under permanent autoplay.' });
    const playerIndex = getRoomPlayerIndex(room, userId);
    if (playerIndex < 0) return cb({ error: 'You are not seated in this game.' });
    const afk = afkPlayerState(room, userId);
    if (!afk.autoplayActive) return cb({ ok: true, game: gameViewFor(room, userId) });
    recordHumanRoomAction(room, userId);
    if (room.game.phase === 'turn' && room.game.currentPlayerIndex === playerIndex) {
      room.game = { ...room.game, turnEndsAt: Date.now() + TURN_DURATION };
    } else if (room.game.phase === 'peek' && room.game.players[playerIndex]?.peekFlips < 2) {
      room.game = { ...room.game, peekEndsAt: Date.now() + PEEK_DURATION };
    }
    room.updatedAt = Date.now();
    broadcastRoom(room);
    saveStore();
    return cb({ ok: true, game: gameViewFor(room, userId) });
  });

  socket.on('disconnect', () => {
    const activeSockets = userSockets.get(connectedUserId);
    activeSockets?.delete(socket.id);
    if (activeSockets && !activeSockets.size) userSockets.delete(connectedUserId);
    const foregroundSockets = clubForegroundSockets.get(connectedUserId);
    foregroundSockets?.delete(socket.id);
    if (foregroundSockets && !foregroundSockets.size) clubForegroundSockets.delete(connectedUserId);
    const club = socket.auth.user.clubId ? clubById(socket.auth.user.clubId) : null;
    if (club) emitClubPresence(club.clubId);
    const link = sockets.get(socket.id);
    if (!link) return;
    const room = rooms.get(link.roomCode);
    sockets.delete(socket.id);
    if (!room) return;
    const stillConnected = [...sockets.values()].some(item => item.roomCode === link.roomCode && item.userId === link.userId);
    room.connected.set(link.userId, stillConnected);
    if (!stillConnected) room.foreground?.set(link.userId, false);
    room.updatedAt = Date.now();
    broadcastRoom(room);
  });
});

setInterval(async () => {
  if (!storeReady) return;
  const now = Date.now();
  const scheduleResult = processAvailabilitySchedules(availabilityStore, { now });
  if (scheduleResult.changes.length) {
    const latestRevision = scheduleResult.changes.at(-1)?.revision || null;
    applyAvailabilityStore(scheduleResult.store, latestRevision);
  }
  const releaseScheduleResult = processReleasePolicySchedules(releasePolicyStore, { now });
  if (releaseScheduleResult.changes.length) {
    const latestRevision = releaseScheduleResult.changes.at(-1)?.revision || null;
    applyReleasePolicyStore(releaseScheduleResult.store, latestRevision);
  }
  rankedSeason = normalizeRankedSeason(rankedSeason, now, rankedConfig());
  tryMatchRankedQueue(now);
  if (now - lastDailyPushScanAt >= PUSH_DAILY_SCAN_MS) {
    lastDailyPushScanAt = now;
    queueDailyBonusPushes(now);
  }
  if (now - lastEarlyAccessRetentionAt >= 24 * 60 * 60 * 1000) {
    lastEarlyAccessRetentionAt = now;
    const retention = applyEarlyAccessRetention(earlyAccessStore, { now, env: process.env });
    const linkedTicketsErased = eraseLinkedEarlyAccessFeedback([
      ...retention.erasedSignupIds,
      ...retention.removedSignupIds,
    ], now);
    if (retention.changed || linkedTicketsErased) saveStore();
    if (postgresStore && retention.erasedSignupIds.length) {
      for (const signupId of retention.erasedSignupIds) {
        const signup = earlyAccessStore.signups.find(item => item.signupId === signupId);
        if (signup) await postgresStore.saveEarlyAccessSignup(signup);
      }
    }
    if (postgresStore && retention.removedSignupIds.length) {
      try {
        await postgresStore.deleteEarlyAccessSignups(retention.removedSignupIds);
      } catch (error) {
        console.error('Early-access retention deletion failed:', redactEarlyAccessError(error?.message || error));
        return;
      }
    }
    for (const reconfirmation of retention.reconfirmations) {
      queueSupportEmail('Early-access reconfirmation email', () => sendEarlyAccessConfirmation(reconfirmation));
    }
  }
  void processEarlyAccessEmailQueue();
  for (const [token, session] of sessions) if (session.expiresAt <= now) sessions.delete(token);
  for (const [code, room] of rooms) {
    const gameChanged = resolveRoomExpiredTimers(room);
    recordCompletedGame(room);
    const keepActiveMatch = room.status === 'playing' && room.game && !room.game.completed;
    if (!keepActiveMatch && now - room.updatedAt > ROOM_TTL_MS) {
      cancelRoomCountdown(room);
      cancelAllAutoplaySchedules(room);
      rooms.delete(code);
    }
    else if (gameChanged) {
      room.updatedAt = now;
      broadcastRoom(room);
    }
    else ensureAutoplaySchedules(room);
  }
  saveStore();
}, 1000);

function startHttpListeners() {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Nine Below authoritative server listening on port ${PORT}`);
  });
  for (const extraPort of EXTRA_LISTEN_PORTS) {
    const extraServer = http.createServer(app);
    io.attach(extraServer, { cors: { origin: CLIENT_ORIGINS.includes('*') ? '*' : CLIENT_ORIGINS } });
    listeningServers.push(extraServer);
    extraServer.listen(extraPort, '0.0.0.0', () => {
      console.log(`Nine Below fallback listener active on port ${extraPort}`);
    });
  }
}

async function initializePersistence() {
  if (IS_PRODUCTION && !postgresStore && !ALLOW_UNSAFE_JSON_IN_PRODUCTION) {
    throw new Error('DATABASE_URL is required in production. Set ALLOW_JSON_STORE_IN_PRODUCTION=1 only for an emergency temporary fallback.');
  }

  try {
    await loadStore();
    seedLocalTestAccounts();
    seedAdminAccounts();
    const scheduleResult = processAvailabilitySchedules(availabilityStore, { now: Date.now() });
    availabilityStore = scheduleResult.store;
    if (scheduleResult.changes.length) storeMigrationPending = true;
    const releaseScheduleResult = processReleasePolicySchedules(releasePolicyStore, { now: Date.now() });
    releasePolicyStore = releaseScheduleResult.store;
    if (releaseScheduleResult.changes.length) storeMigrationPending = true;
    reconcileAvailabilityState();
    if (storeMigrationPending) {
      storeMigrationPending = false;
      saveStore();
    }
    storeReady = true;
    storeLoadError = null;
    console.log('Nine Below persistence loaded.');
  } catch (error) {
    storeReady = false;
    storeLoadError = error;
    console.error('Nine Below persistence failed to load:', error);
    if (!IS_PRODUCTION || ALLOW_UNSAFE_JSON_IN_PRODUCTION) {
      console.warn('Falling back to local JSON store after persistence failure.');
      loadJsonStore();
      seedLocalTestAccounts();
      seedAdminAccounts();
      storeReady = true;
      storeLoadError = null;
      return;
    }
    throw error;
  }
}

async function startServer() {
  await initializePersistence();
  startHttpListeners();
}

async function shutdown() {
  try {
    if (storeReady) saveStore();
    if (postgresStore) await postgresStore.close();
  } finally {
    let remaining = listeningServers.length;
    const finish = () => {
      remaining -= 1;
      if (remaining <= 0) process.exit(0);
    };
    for (const activeServer of listeningServers) activeServer.close(finish);
    setTimeout(() => process.exit(0), 1000).unref();
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startServer().catch(error => {
  console.error('Failed to start Nine Below server:', error);
  process.exit(1);
});
