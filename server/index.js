// index.js
// Purpose: Authoritative Golf 9 API + Socket.IO server for auth, rooms, and online game state.

import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { createPostgresStore } from './postgresStore.js';
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
  takeDiscard,
} from '../shared/rules.js';
import {
  applyMatchProgression,
  claimChallengeReward,
  equipCosmetic,
  normalizeUserProgression,
  publicCosmeticCatalog,
  publicUserProfile,
  purchaseCosmetic,
  registerSocialMessage,
} from './progression.js';
import {
  archiveDraftCatalogItem,
  draftCatalog,
  duplicateDraftCatalogItem,
  liveCatalog,
  normalizeCatalogStore,
  publishCatalog,
  rollbackCatalog,
  saveDraftCatalogItem,
  seedCatalogStore,
  uploadCatalogAsset,
} from './catalog.js';
import {
  applyRankedMatchResult,
  claimSeasonRewards,
  leagueForMmr,
  matchmakingRangeFor,
  normalizeCompetitiveState,
  normalizeRankedSeason,
  placementForTotals,
  publicCompetitiveState,
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
  upsertCompetitiveSeason,
} from './competitive.js';
import {
  calculatePayouts,
  claimDailyTableBonus,
  normalizeBuyIn,
  publicEconomyCatalog,
  rankedBuyInForMmr,
} from './economy.js';
import {
  applyClubMatchContribution,
  appendClubChatMessage,
  canManageMember,
  canManageRequests,
  canPostAnnouncement,
  canUpdateClub,
  claimClubReward,
  CLUB_ROLES,
  createClubRecord,
  findClubMember,
  normalizeClubBranding,
  normalizeClubRecord,
  normalizeClubTag,
  publicClubProfile,
  publicClubSummary,
} from './clubs.js';
import {
  devTestAccountForDisplayName,
  ensureDevTestAccounts,
  shouldSeedDevTestAccounts,
} from './testAccounts.js';
import {
  activeBansFor,
  adminCosmeticCatalogFor,
  adminEconomySummary,
  adminInvites,
  adminMetrics,
  adminTickets,
  adminUserDetail,
  adminUserList,
  banErrorFor,
  cleanAdminReason,
  clearAdminCookie,
  consumeSignupInvite,
  createInviteCode,
  createSupportTicket,
  disableInviteCode,
  ensureBootstrapAdmin,
  loginAdmin,
  normalizeAdminStore,
  normalizeUserAdminFields,
  requireAdmin,
  seedDevelopmentAdmin,
  setAdminCookie,
  signupInvitesRequired,
  trackUserDevice,
  updateSupportTicket,
  addSupportNote,
  validateSignupInvite,
  verifyAdminMfa,
  writeAudit,
} from './admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR = path.join(__dirname, 'data');
const DATA_DIR = process.env.DATA_DIR || DEFAULT_DATA_DIR;
const DATA_FILE = path.join(DATA_DIR, 'auth-store.json');
const ADMIN_PUBLIC_DIR = path.join(__dirname, 'admin-public');
const ASSET_UPLOAD_DIR = path.join(DATA_DIR, 'uploads', 'cosmetics');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const DATABASE_URL = process.env.DATABASE_URL || '';
const PUBLIC_API_URL = process.env.PUBLIC_API_URL || process.env.EXPO_PUBLIC_PROD_SERVER_URL || 'https://games.joinup.us';
const ADMIN_PUBLIC_URL = process.env.ADMIN_PUBLIC_URL || 'https://games.joinup.us/admin';
const PUBLIC_ENV = (process.env.APP_ENV || process.env.EXPO_PUBLIC_APP_ENV || (IS_PRODUCTION ? 'production' : 'development')).toLowerCase();
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const ROOM_TTL_MS = 1000 * 60 * 60 * 2;
const PORT = String(process.env.PORT || 3001);
const EXTRA_LISTEN_PORTS = [...new Set(
  (process.env.EXTRA_LISTEN_PORTS || (IS_PRODUCTION ? '3001' : ''))
    .split(',')
    .map(port => port.trim())
    .filter(port => port && port !== PORT)
)];
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGINS || '*').split(',');
const MAX_PROCESSED_ACTION_IDS = 500;
const ROOM_COUNTDOWN_MS = Number(process.env.ROOM_COUNTDOWN_MS || 3000);
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

const app = express();
app.use(cors({ origin: CLIENT_ORIGINS.includes('*') ? '*' : CLIENT_ORIGINS, credentials: true }));
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return next();
});

const adminRequestWindow = new Map();
app.use('/admin/api', (req, res, next) => {
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
/** @type {Map<string, any>} */
const rankedQueue = new Map();
/** @type {Map<string, any>} */
const clubs = new Map();
/** @type {Map<string, number>} */
const clubChatRate = new Map();
const competitiveStore = normalizeCompetitiveConfigStore({});
let rankedSeason = normalizeRankedSeason(null, Date.now(), liveCompetitiveConfig(competitiveStore));
const adminStore = normalizeAdminStore({});
const catalogStore = normalizeCatalogStore({});
const postgresStore = createPostgresStore(DATABASE_URL);
let storeReady = false;
let storeLoadError = null;

function rankedConfig() {
  return liveCompetitiveConfig(competitiveStore);
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

function normalizeUserRecord(user, now = Date.now()) {
  normalizeUserProgression(user, now, rankedSeason, rankedConfig());
  normalizeSocial(user);
  normalizeUserClub(user);
  normalizeUserAdminFields(user);
  return user;
}

function reconcileClubMemberships(now = Date.now()) {
  for (const club of clubs.values()) normalizeClubRecord(club, now, rankedSeason);
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
}

function applyStoreState(parsed = {}) {
  users.clear();
  sessions.clear();
  results.splice(0, results.length);
  clubs.clear();
  normalizeCatalogStore(Object.assign(catalogStore, parsed.catalog || {}));
  seedCatalogStore(catalogStore);
  normalizeAdminStore(Object.assign(adminStore, {
    admins: parsed.admins || [],
    adminSessions: parsed.adminSessions || [],
    adminAudit: parsed.adminAudit || [],
    supportTickets: parsed.supportTickets || [],
    bans: parsed.bans || [],
    inviteCodes: parsed.inviteCodes || [],
  }));
  normalizeCompetitiveConfigStore(Object.assign(competitiveStore, parsed.competitiveConfig || {}));
  rankedSeason = normalizeRankedSeason(parsed.rankedSeason, Date.now(), rankedConfig());
  for (const club of parsed.clubs || []) {
    const normalized = normalizeClubRecord(club, Date.now(), rankedSeason);
    if (normalized.clubId) clubs.set(normalized.clubId, normalized);
  }
  for (const user of parsed.users || []) users.set(user.userId, normalizeUserRecord(user));
  for (const session of parsed.sessions || []) {
    if (session.expiresAt > Date.now()) sessions.set(session.token, session);
  }
  results.push(...(parsed.results || []));
  reconcileClubMemberships();
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
  normalizeCompetitiveConfigStore(competitiveStore);
  normalizeAdminStore(adminStore);
  rankedSeason = normalizeRankedSeason(rankedSeason, Date.now(), rankedConfig());
  reconcileClubMemberships();
  for (const user of users.values()) normalizeUserRecord(user);
  for (const club of clubs.values()) normalizeClubRecord(club, Date.now(), rankedSeason);
  return {
    users: [...users.values()],
    sessions: [...sessions.values()],
    results,
    rankedSeason,
    competitiveConfig: competitiveStore,
    catalog: catalogStore,
    clubs: [...clubs.values()],
    admins: adminStore.admins,
    adminSessions: adminStore.adminSessions,
    adminAudit: adminStore.adminAudit,
    supportTickets: adminStore.supportTickets,
    bans: adminStore.bans,
    inviteCodes: adminStore.inviteCodes,
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

function publicClubForUser(user) {
  const club = user?.clubId ? clubs.get(user.clubId) : null;
  return club ? publicClubSummary(club, user.userId) : null;
}

function safeUser(user) {
  return {
    ...publicUserProfile(user, rankedSeason, rankedConfig()),
    club: publicClubForUser(user),
  };
}

function currentCatalog() {
  return liveCatalog(catalogStore);
}

function cosmeticsFor(user) {
  return publicCosmeticCatalog(user, rankedSeason, currentCatalog(), rankedConfig());
}

function adminClubDetail(club) {
  normalizeClubRecord(club, Date.now(), rankedSeason);
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
      normalizeClubRecord(club, Date.now(), rankedSeason);
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
  const rankedUsers = [...users.values()].map(user => {
    normalizeCompetitiveState(user, rankedSeason, config);
    return user;
  });
  const leagueDistribution = {};
  let totalMmr = 0;
  const recentMovement = [];
  for (const user of rankedUsers) {
    const league = user.competitive?.league?.name || leagueForMmr(user.competitive?.mmr || 1000, config).name;
    leagueDistribution[league] = (leagueDistribution[league] || 0) + 1;
    totalMmr += Number(user.competitive?.mmr || 0);
    for (const history of user.competitive?.matchHistory || []) {
      if (!history?.leagueBefore || !history?.leagueAfter || history.leagueBefore.name === history.leagueAfter.name) continue;
      recentMovement.push({
        userId: user.userId,
        displayName: user.displayName,
        completedAt: history.completedAt,
        from: history.leagueBefore.name,
        to: history.leagueAfter.name,
        delta: history.delta,
      });
    }
  }
  const activeRankedRooms = [...rooms.values()].filter(room => room.matchType === 'ranked' && !room.game?.completed);
  return {
    season: rankedSeason,
    config,
    rankedPlayers: rankedUsers.filter(user => user.competitive?.rankedGames > 0 || user.competitive?.placementsPlayed > 0).length,
    totalPlayers: rankedUsers.length,
    averageMmr: rankedUsers.length ? Math.round(totalMmr / rankedUsers.length) : 0,
    activeQueues: rankedQueue.size,
    activeRankedRooms: activeRankedRooms.length,
    leagueDistribution,
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
  normalizeCompetitiveState(user, rankedSeason, config);
  const before = { ...user.competitive, league: user.competitive.league, seasonBestLeague: user.competitive.seasonBestLeague };
  const patch = {};
  if (body.mmr !== undefined) patch.mmr = Math.max(0, Math.floor(Number(body.mmr) || 0));
  if (body.seasonBestMmr !== undefined) patch.seasonBestMmr = Math.max(0, Math.floor(Number(body.seasonBestMmr) || 0));
  if (body.placementsPlayed !== undefined) patch.placementsPlayed = Math.max(0, Math.floor(Number(body.placementsPlayed) || 0));
  if (body.rankedGames !== undefined) patch.rankedGames = Math.max(0, Math.floor(Number(body.rankedGames) || 0));
  if (body.wins !== undefined) patch.wins = Math.max(0, Math.floor(Number(body.wins) || 0));
  if (body.losses !== undefined) patch.losses = Math.max(0, Math.floor(Number(body.losses) || 0));
  if (Array.isArray(body.claimedSeasonRewards)) patch.claimedSeasonRewards = body.claimedSeasonRewards.map(String).filter(Boolean);
  user.competitive = { ...user.competitive, ...patch };
  user.competitive.placementsPlayed = Math.min(user.competitive.placementsPlayed, user.competitive.placementMatchesRequired);
  user.competitive.placementComplete = user.competitive.placementsPlayed >= user.competitive.placementMatchesRequired;
  user.competitive.seasonBestMmr = Math.max(user.competitive.mmr, user.competitive.seasonBestMmr);
  user.competitive.league = leagueForMmr(user.competitive.mmr, config);
  user.competitive.seasonBestLeague = leagueForMmr(user.competitive.seasonBestMmr, config);
  if (body.clearHistory) user.competitive.matchHistory = [];
  user.competitive.matchHistory = [{
    matchId: `admin-${crypto.randomUUID()}`,
    completedAt: Date.now(),
    roomCode: null,
    playerCount: 0,
    total: 0,
    placement: 0,
    mmrBefore: before.mmr,
    mmrAfter: user.competitive.mmr,
    delta: user.competitive.mmr - before.mmr,
    leagueBefore: before.league,
    leagueAfter: user.competitive.league,
    adminAdjustment: true,
  }, ...(user.competitive.matchHistory || [])].slice(0, 25);
  return { before, after: user.competitive };
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
  res.status(423).json({ error: 'This club is temporarily frozen by Golf 9 support.' });
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
  ) || null;
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
      mmr: profile.competitive.mmr,
      league: profile.competitive.league,
      rankedGames: profile.competitive.rankedGames,
      wins: profile.competitive.wins,
    },
    cosmetics: profile.inventory.equipped,
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
    competitive: {
      mmr: profile.competitive.mmr,
      league: profile.competitive.league,
      placementComplete: profile.competitive.placementComplete,
      rankedGames: profile.competitive.rankedGames,
      wins: profile.competitive.wins,
      losses: profile.competitive.losses,
      seasonBestLeague: profile.competitive.seasonBestLeague,
    },
    cosmetics: profile.inventory.equipped,
    club: profile.club,
    relationship: relationshipBetween(viewer, target),
    status: userStatus(target.userId),
    recentMatches: publicRecentMatches(target.userId),
  };
}

function publicRequest(viewer, request, direction) {
  const target = users.get(request.userId);
  if (!target) return null;
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
  if (!room || !from) return null;
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
      if (player.userId === user.userId || !users.has(player.userId) || seen.has(player.userId)) continue;
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
        return target ? publicPlayerCard(user, target, { since: friend.since }) : null;
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

function emitClubUpdate(clubId) {
  const club = clubs.get(clubId);
  if (!club) return;
  io.to(clubSocketRoom(clubId)).emit('club:update', {
    clubId,
    club: publicClubProfile(club, users, null, rankedSeason),
  });
  for (const member of club.members || []) emitSocialUpdate(member.userId);
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

function clubById(clubId) {
  return clubs.get(String(clubId || ''));
}

function currentClubRole(user, club) {
  return findClubMember(club, user.userId)?.role || null;
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
  const kind = type === 'emoji' ? 'emoji' : type === 'preset' ? 'preset' : type === 'sticker' ? 'sticker' : 'text';
  let cleaned;
  if (kind === 'emoji') {
    const text = String(rawText || '').trim();
    if (!CHAT_EMOJIS.includes(text)) return { error: 'Unknown reaction.' };
    cleaned = { text };
  } else if (kind === 'sticker') {
    const text = String(rawText || '').trim();
    if (!CHAT_STICKERS.includes(text)) return { error: 'Unknown sticker.' };
    cleaned = { text };
  } else if (kind === 'preset') {
    const text = String(rawText || '').trim();
    if (!CHAT_PRESETS.includes(text)) return { error: 'Unknown quick chat.' };
    cleaned = cleanChatText(text);
  } else {
    cleaned = cleanChatText(rawText);
  }
  if (cleaned.error) return { error: cleaned.error };
  return { kind, text: cleaned.text };
}

function makeChatMessage(room, userId, type, rawText) {
  const player = room.players.find(item => item.userId === userId);
  if (!player) return { error: 'You are not a member of this room.' };
  const cleaned = cleanChatPayload(type, rawText);
  if (cleaned.error) return { error: cleaned.error };
  return {
    message: {
      id: crypto.randomUUID(),
      userId,
      displayName: player.displayName,
      avatarInitial: player.avatarInitial,
      type: cleaned.kind,
      text: cleaned.text,
      createdAt: Date.now(),
    },
  };
}

function makeClubChatMessage(club, user, type, rawText) {
  if (!findClubMember(club, user.userId)) return { error: 'You are not a member of this club.' };
  const cleaned = cleanChatPayload(type, rawText);
  if (cleaned.error) return { error: cleaned.error };
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
  const session = { token, userId, expiresAt: Date.now() + SESSION_TTL_MS };
  sessions.set(token, session);
  saveStore();
  return session;
}

function authenticateToken(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (session) sessions.delete(token);
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

function roomSummary(room) {
  return {
    code: room.code,
    hostUserId: room.hostUserId,
    status: room.status,
    matchType: room.matchType || 'casual',
    maxPlayers: room.maxPlayers,
    rounds: room.rounds,
    countdownEndsAt: room.countdownEndsAt || null,
    economy: room.economy ? {
      buyIn: room.economy.buyIn || 0,
      pot: (room.economy.buyIn || 0) * room.maxPlayers,
      chargedAt: room.economy.chargedAt || null,
    } : { buyIn: 0, pot: 0, chargedAt: null },
    ranked: room.matchType === 'ranked' ? {
      seasonId: room.ranked?.seasonId || rankedSeason.id,
      averageMmr: room.ranked?.averageMmr || null,
      buyIn: room.economy?.buyIn || 0,
    } : null,
    players: room.players.map(player => ({
      userId: player.userId,
      displayName: player.displayName,
      avatarInitial: player.avatarInitial,
      ready: room.ready.get(player.userId) || false,
      connected: room.connected.get(player.userId) || false,
      isHost: player.userId === room.hostUserId,
    })),
  };
}

function broadcastRoom(room) {
  syncRoomCountdown(room);
  io.to(room.code).emit('room:update', roomSummary(room));
  if (room.game) {
    for (const player of room.players) {
      io.to(`${room.code}:${player.userId}`).emit('game:state', gameViewFor(room, player.userId));
    }
  }
}

function gameViewFor(room, userId) {
  return publicGameState(
    room.game,
    userId,
    room.held.get(userId) || null,
    room.heldSource?.get(userId) || null,
    room.heldMustReplace?.get(userId) || false,
    room.heldCanDiscard?.get(userId) || false
  );
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
    buyIn: normalizeBuyIn(buyIn),
  };
}

function normalizeWagerOptions(body = {}) {
  const options = normalizeRoomOptions(body);
  return { ...options, buyIn: normalizeBuyIn(body.buyIn) };
}

function cancelRoomCountdown(room) {
  if (room.countdownTimer) clearTimeout(room.countdownTimer);
  room.countdownTimer = null;
  room.countdownEndsAt = null;
}

function syncRoomCountdown(room) {
  if (room.status !== 'lobby') {
    cancelRoomCountdown(room);
    return;
  }

  if (room.players.length !== room.maxPlayers) {
    cancelRoomCountdown(room);
    return;
  }

  if (room.countdownEndsAt) return;
  room.countdownEndsAt = Date.now() + ROOM_COUNTDOWN_MS;
  room.countdownTimer = setTimeout(() => {
    const current = rooms.get(room.code);
    if (!current || current.status !== 'lobby' || current.players.length !== current.maxPlayers) return;
    try {
      startRoomGame(current, { requireReady: false });
      broadcastRoom(current);
    } catch {
      cancelRoomCountdown(current);
      broadcastRoom(current);
    }
  }, ROOM_COUNTDOWN_MS);
}

function addUserToRoom(room, user) {
  if (room.players.some(player => player.userId === user.userId)) return;
  if (room.players.length >= room.maxPlayers) throw new Error('Room is full.');
  const player = safeUser(user);
  room.players.push(player);
  room.ready.set(player.userId, false);
  room.connected.set(player.userId, false);
}

function makeRoom(hostUser, { maxPlayers = 4, rounds = 9, matchType = 'casual', ranked = null, buyIn = 0 } = {}) {
  const options = normalizeRoomOptions({ maxPlayers, rounds, buyIn });
  const code = makeCode();
  const host = safeUser(hostUser);
  const safeMatchType = matchType === 'ranked' ? 'ranked' : matchType === 'wager' ? 'wager' : 'casual';
  const room = {
    code,
    hostUserId: host.userId,
    matchType: safeMatchType,
    ranked,
    economy: {
      buyIn: safeMatchType === 'wager' ? options.buyIn : 0,
      chargedAt: null,
      payouts: {},
    },
    maxPlayers: options.maxPlayers,
    rounds: options.rounds,
    status: 'lobby',
    players: [host],
    ready: new Map([[host.userId, false]]),
    connected: new Map([[host.userId, false]]),
    game: null,
    processedActionIds: new Set(),
    held: new Map(),
    heldSource: new Map(),
    heldMustReplace: new Map(),
    heldCanDiscard: new Map(),
    roundSummaryAcks: new Set(),
    progressionStats: new Map(),
    progressionRoundKeys: new Set(),
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
  ) || null;
}

function rankedQueueEntry(user, options) {
  normalizeCompetitiveState(user, rankedSeason, rankedConfig());
  const buyIn = rankedBuyInForMmr(user.competitive.mmr);
  return {
    userId: user.userId,
    displayName: user.displayName,
    avatarInitial: user.displayName.trim().slice(0, 1).toUpperCase(),
    maxPlayers: options.maxPlayers,
    rounds: options.rounds,
    buyIn,
    key: rankedQueueKey(options),
    mmr: user.competitive.mmr,
    joinedAt: Date.now(),
  };
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
  return {
    queued: true,
    matchedRoomCode: null,
    room: null,
    status: 'searching',
    maxPlayers: entry.maxPlayers,
    rounds: entry.rounds,
    joinedAt: entry.joinedAt,
    searchRange: matchmakingRangeFor(entry.joinedAt, Date.now(), rankedConfig()),
    buyIn: 0,
    pot: 0,
    queuedPlayers: [...rankedQueue.values()].filter(item => item.key === entry.key).length,
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
  const room = makeRoom(usersForRoom[0], {
    maxPlayers: entries[0].maxPlayers,
    rounds: entries[0].rounds,
    matchType: 'ranked',
    buyIn: 0,
    ranked: {
      seasonId: rankedSeason.id,
      averageMmr,
      mmrSnapshot,
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
    entries.sort((a, b) => a.joinedAt - b.joinedAt);
    for (const seed of entries) {
      if (!rankedQueue.has(seed.userId)) continue;
      const seedRange = matchmakingRangeFor(seed.joinedAt, now, rankedConfig());
      const compatible = entries
        .filter(entry => rankedQueue.has(entry.userId))
        .filter(entry => Math.abs(entry.mmr - seed.mmr) <= Math.min(seedRange, matchmakingRangeFor(entry.joinedAt, now, rankedConfig())))
        .sort((a, b) => a.joinedAt - b.joinedAt);
      if (compatible.length < seed.maxPlayers) continue;
      const room = createRankedRoom(compatible.slice(0, seed.maxPlayers));
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
  const payouts = calculatePayouts(result.players, buyIn);
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
    const user = users.get(player.userId);
    const club = user?.clubId ? clubs.get(user.clubId) : null;
    if (!club || !findClubMember(club, user.userId)) continue;
    if (!byClub.has(club.clubId)) byClub.set(club.clubId, { club, players: [] });
    byClub.get(club.clubId).players.push({ player, user });
  }

  for (const { club, players } of byClub.values()) {
    normalizeClubRecord(club, result.completedAt, rankedSeason);
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
    normalizeClubRecord(club, result.completedAt, rankedSeason);
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
  room.status = 'playing';
  room.held = new Map();
  room.heldSource = new Map();
  room.heldMustReplace = new Map();
  room.heldCanDiscard = new Map();
  room.roundSummaryAcks = new Set();
  room.progressionStats = new Map();
  room.progressionRoundKeys = new Set();
  room.game = createGameState(
    room.players.map(player => sanitizePlayerIdentity(users.get(player.userId) || player)),
    { totalRounds: room.rounds, simultaneousPeek: true }
  );
  room.resultRecorded = false;
  room.updatedAt = Date.now();
}

function recordCompletedGame(room) {
  if (!room.game?.completed || room.resultRecorded) return;
  captureRoundProgress(room);
  const totals = room.game.totals || room.game.players.map(player => 0);
  const winningTotal = Math.min(...totals);
  const matchType = room.matchType === 'ranked' ? 'ranked' : room.matchType === 'wager' ? 'wager' : 'casual';
  const result = {
    resultId: crypto.randomUUID(),
    completedAt: Date.now(),
    roomCode: room.code,
    matchType,
    mode: 'online',
    round: room.game.round,
    totalRounds: room.game.totalRounds,
    players: room.game.players.map((player, index) => ({
      userId: player.userId,
      displayName: player.name,
      total: totals[index] || 0,
      won: (totals[index] || 0) === winningTotal,
    })),
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
    player.progression = applyMatchProgression(user, {
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
        .map(item => Number(snapshot[item.userId] ?? users.get(item.userId)?.competitive?.mmr ?? 1000));
      const ranked = applyRankedMatchResult(user, {
        matchId: result.resultId,
        roomCode: room.code,
        playerCount: result.players.length,
        placement: placementForTotals(totals, playerIndex),
        total: player.total,
        opponentMmrs,
        columnClears: telemetry.columnClears || 0,
      }, rankedSeason, result.completedAt, rankedConfig());
      player.ranked = ranked;
      player.progression.ranked = ranked;
    }
    const roomPlayer = room.players.find(item => item.userId === player.userId);
    emitProgressionCelebrations(room, player.userId, player.displayName, roomPlayer?.avatarInitial, player.progression);
  }

  applyClubContributions(room, result);
  results.push(result);
  room.resultRecorded = true;
  saveStore();
}

app.get('/health', (_req, res) => res.json({ ok: true, ready: storeReady, env: PUBLIC_ENV }));
app.get('/health/ready', (_req, res) => {
  if (storeReady) return res.json({ ok: true, ready: true });
  return res.status(503).json({
    ok: false,
    ready: false,
    error: storeLoadError ? 'Persistence failed to load.' : 'Persistence is still loading.',
  });
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

app.post('/admin/api/auth/login', (req, res) => {
  const result = loginAdmin(adminStore, req, req.body?.displayName, req.body?.password);
  if (result.error) return res.status(401).json({ error: result.error });
  setAdminCookie(res, result.sessionToken);
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

app.post('/admin/api/auth/logout', requireAdmin(adminStore), (req, res) => {
  adminStore.adminSessions = adminStore.adminSessions.filter(session => session.token !== req.admin.session.token);
  writeAudit(adminStore, req, req.admin.admin, 'admin.logout', { adminId: req.admin.admin.adminId });
  clearAdminCookie(res);
  saveStore();
  return res.json({ ok: true });
});

app.get('/admin/api/auth/me', requireAdmin(adminStore), (req, res) => res.json({
  admin: {
    adminId: req.admin.admin.adminId,
    displayName: req.admin.admin.displayName,
    role: req.admin.admin.role,
  },
}));

app.get('/admin/api/users', requireAdmin(adminStore, 'users:read'), (req, res) => {
  writeAudit(adminStore, req, req.admin.admin, 'admin.users.search', {}, { query: String(req.query.q || '') });
  saveStore();
  return res.json({ users: adminUserList(users, rankedSeason, req.query.q, rankedConfig()) });
});

app.get('/admin/api/users/:userId', requireAdmin(adminStore, 'users:read'), (req, res) => {
  const user = findUserByIdentifier(req.params.userId);
  if (!user) return res.status(404).json({ error: 'Player not found.' });
  writeAudit(adminStore, req, req.admin.admin, 'admin.users.read', { userId: user.userId });
  saveStore();
  return res.json({
    user: adminUserDetail(
      user,
      rankedSeason,
      results,
      adminCosmeticCatalogFor(user, rankedSeason, currentCatalog(), rankedConfig()),
      publicEconomyCatalog(user),
      rankedConfig()
    ),
  });
});

app.patch('/admin/api/users/:userId/profile', requireAdmin(adminStore, 'users:write'), (req, res) => {
  const user = findUserByIdentifier(req.params.userId);
  if (!user) return res.status(404).json({ error: 'Player not found.' });
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  const before = { displayName: user.displayName };
  const nextDisplayName = String(req.body?.displayName ?? user.displayName).replace(/\s+/g, ' ').trim().slice(0, 32);
  if (nextDisplayName.length < 2) return res.status(400).json({ error: 'Display name must be at least 2 characters.' });
  const duplicate = [...users.values()].find(item => item.userId !== user.userId && item.displayName.toLowerCase() === nextDisplayName.toLowerCase());
  if (duplicate) return res.status(409).json({ error: 'Display name is already taken.' });
  user.displayName = nextDisplayName;
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

app.post('/admin/api/users/:userId/competitive/adjust', requireAdmin(adminStore, 'competitive:write'), (req, res) => {
  const user = findUserByIdentifier(req.params.userId);
  if (!user) return res.status(404).json({ error: 'Player not found.' });
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  const result = normalizeAdminCompetitiveAdjustment(user, req.body || {});
  writeAudit(adminStore, req, req.admin.admin, 'admin.users.competitive.adjust', { userId: user.userId }, { reason, before: result.before, after: result.after });
  saveStore();
  return res.json({ user: safeUser(user), competitive: publicCompetitiveState(user, rankedSeason, rankedConfig()) });
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

app.get('/admin/api/support/tickets', requireAdmin(adminStore, 'support:read'), (req, res) => res.json({ tickets: adminTickets(adminStore, req.query.status) }));

app.patch('/admin/api/support/tickets/:ticketId', requireAdmin(adminStore, 'support:write'), (req, res) => {
  const result = updateSupportTicket(adminStore, req.params.ticketId, req.body || {});
  if (result.error) return res.status(404).json({ error: result.error });
  writeAudit(adminStore, req, req.admin.admin, 'admin.support.ticket.update', { ticketId: req.params.ticketId }, req.body || {});
  saveStore();
  return res.json(result);
});

app.post('/admin/api/support/tickets/:ticketId/notes', requireAdmin(adminStore, 'support:write'), (req, res) => {
  const result = addSupportNote(adminStore, req.params.ticketId, req.admin.admin, req.body?.note);
  if (result.error) return res.status(400).json({ error: result.error });
  writeAudit(adminStore, req, req.admin.admin, 'admin.support.ticket.note', { ticketId: req.params.ticketId });
  saveStore();
  return res.json(result);
});

app.get('/admin/api/audit', requireAdmin(adminStore, 'audit:read'), (_req, res) => res.json({ audit: adminStore.adminAudit.slice().reverse().slice(0, 250) }));
app.get('/admin/api/catalog/cosmetics', requireAdmin(adminStore, 'catalog:read'), (req, res) => {
  const user = req.query.userId ? findUserByIdentifier(req.query.userId) : [...users.values()][0];
  return res.json({
    live: liveCatalog(catalogStore),
    draft: draftCatalog(catalogStore),
    cosmetics: user ? cosmeticsFor(user) : liveCatalog(catalogStore),
  });
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

app.get('/admin/api/economy', requireAdmin(adminStore, 'metrics:read'), (_req, res) => res.json({ economy: adminEconomySummary(users) }));
app.get('/admin/api/competitive/overview', requireAdmin(adminStore, 'competitive:read'), (_req, res) => res.json({ overview: adminCompetitiveOverview() }));

app.get('/admin/api/competitive/config', requireAdmin(adminStore, 'competitive:read'), (_req, res) => {
  res.json(publicCompetitiveAdminConfig(competitiveStore));
});

app.patch('/admin/api/competitive/config/draft', requireAdmin(adminStore, 'competitive:write'), (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  const result = saveDraftCompetitiveConfig(competitiveStore, req.body?.config || req.body || {});
  writeAudit(adminStore, req, req.admin.admin, 'admin.competitive.config.update', {}, { reason });
  saveStore();
  return res.json({ draft: result.draft });
});

app.post('/admin/api/competitive/config/publish', requireAdmin(adminStore, 'competitive:write'), (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  const result = publishCompetitiveConfig(competitiveStore, req.admin.admin.displayName);
  rankedSeason = normalizeRankedSeason(rankedSeason, Date.now(), rankedConfig());
  for (const user of users.values()) normalizeCompetitiveState(user, rankedSeason, rankedConfig());
  writeAudit(adminStore, req, req.admin.admin, 'admin.competitive.config.publish', { versionId: result.version.versionId }, { reason });
  saveStore();
  return res.json({ live: result.live, version: result.version, overview: adminCompetitiveOverview() });
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
  if (existed) io.to(`user:${req.params.userId}`).emit('ranked:queue:cancelled', { reason: 'Queue cancelled by Golf 9 support.' });
  writeAudit(adminStore, req, req.admin.admin, 'admin.competitive.queue.cancel', { userId: req.params.userId }, { reason, existed });
  saveStore();
  return res.json({ ok: true, existed, ...adminRankedQueues() });
});

app.get('/admin/api/rooms', requireAdmin(adminStore, 'metrics:read'), (_req, res) => res.json({ rooms: [...rooms.values()].map(roomSummary) }));
app.get('/admin/api/clubs', requireAdmin(adminStore, 'metrics:read'), (req, res) => res.json({ clubs: adminClubSummaries(req.query.q) }));

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
  const before = { name: club.name, tag: club.tag, motto: club.motto, branding: club.branding };
  if (req.body?.name !== undefined) club.name = String(req.body.name);
  if (req.body?.tag !== undefined) club.tag = normalizeClubTag(req.body.tag);
  if (req.body?.motto !== undefined) club.motto = String(req.body.motto);
  if (req.body?.branding !== undefined) club.branding = normalizeClubBranding(req.body.branding);
  club.updatedAt = Date.now();
  normalizeClubRecord(club, Date.now(), rankedSeason);
  writeAudit(adminStore, req, req.admin.admin, 'admin.clubs.update', { clubId: club.clubId }, { reason, before, after: { name: club.name, tag: club.tag, motto: club.motto, branding: club.branding } });
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
  normalizeClubRecord(club, Date.now(), rankedSeason);
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
  normalizeClubRecord(club, Date.now(), rankedSeason);
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
  normalizeClubRecord(club, Date.now(), rankedSeason);
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
  club.announcements.push(announcement);
  club.updatedAt = Date.now();
  normalizeClubRecord(club, Date.now(), rankedSeason);
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

app.get('/admin/api/metrics', requireAdmin(adminStore, 'metrics:read'), (_req, res) => res.json({ metrics: adminMetrics(users, rooms, clubs, adminStore.supportTickets) }));

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
  writeAudit(adminStore, req, req.admin.admin, 'admin.invites.create', { inviteId: result.invite.inviteId, code: result.invite.code }, { reason });
  saveStore();
  return res.json(result);
});

app.post('/admin/api/invites/:inviteId/disable', requireAdmin(adminStore, 'invites:write'), (req, res) => {
  const reason = cleanAdminReason(req.body?.reason);
  if (!reason) return res.status(400).json({ error: 'Reason is required.' });
  const result = disableInviteCode(adminStore, req.params.inviteId, reason);
  if (result.error) return res.status(404).json({ error: result.error });
  writeAudit(adminStore, req, req.admin.admin, 'admin.invites.disable', { inviteId: result.invite.inviteId, code: result.invite.code }, { reason });
  saveStore();
  return res.json(result);
});

app.post('/support/tickets', requireAuth, (req, res) => {
  const result = createSupportTicket(adminStore, req, req.auth.user, req.body || {});
  if (result.error) return res.status(400).json({ error: result.error });
  saveStore();
  return res.json(result);
});

app.get('/auth/config', (_req, res) => {
  res.json({
    environment: PUBLIC_ENV,
    inviteRequired: signupInvitesRequired(),
    apiUrl: PUBLIC_API_URL,
    adminUrl: ADMIN_PUBLIC_URL,
  });
});

app.post('/auth/signup', (req, res) => {
  const displayName = String(req.body.displayName || '').trim();
  const password = String(req.body.password || '');
  const inviteCheck = validateSignupInvite(adminStore, req.body?.inviteCode, signupInvitesRequired());
  if (inviteCheck.error) return res.status(403).json({ error: inviteCheck.error });
  if (displayName.length < 2) return res.status(400).json({ error: 'Display name must be at least 2 characters.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  const duplicate = [...users.values()].find(user => user.displayName.toLowerCase() === displayName.toLowerCase());
  if (duplicate) return res.status(409).json({ error: 'Display name is already taken.' });
  const userId = crypto.randomUUID();
  const { salt, passwordHash } = hashPassword(password);
  const user = normalizeUserProgression({ userId, displayName, salt, passwordHash, stats: { gamesPlayed: 0, wins: 0 } });
  const deviceHash = trackUserDevice(user, req, req.body?.deviceId);
  const moderationError = banErrorFor(adminStore, user, deviceHash);
  if (moderationError) return res.status(403).json({ error: moderationError });
  const invite = consumeSignupInvite(adminStore, inviteCheck.invite, user);
  users.set(userId, user);
  const session = createSession(userId);
  if (invite) writeAudit(adminStore, req, null, 'auth.signup.invite_used', { userId, inviteId: invite.inviteId, code: invite.code });
  saveStore();
  return res.json({ token: session.token, user: safeUser(user) });
});

app.post('/auth/login', (req, res) => {
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

app.post('/auth/logout', requireAuth, (req, res) => {
  sessions.delete(req.auth.session.token);
  saveStore();
  return res.json({ ok: true });
});

app.get('/auth/me', requireAuth, (req, res) => res.json({ user: safeUser(req.auth.user) }));

app.get('/profile/me', requireAuth, (req, res) => res.json({ user: safeUser(req.auth.user) }));

app.get('/social/me', requireAuth, (req, res) => res.json({ social: socialSummary(req.auth.user) }));

app.get('/players/search', requireAuth, (req, res) => {
  const query = String(req.query.q || '').trim().toLowerCase();
  if (query.length < 2) return res.json({ players: [] });
  const players = [...users.values()]
    .filter(user => user.userId !== req.auth.user.userId && user.displayName.toLowerCase().includes(query))
    .slice(0, 12)
    .map(user => publicPlayerCard(req.auth.user, user));
  return res.json({ players });
});

app.get('/profiles/:userId', requireAuth, (req, res) => {
  const target = users.get(String(req.params.userId || ''));
  if (!target) return res.status(404).json({ error: 'Player not found.' });
  return res.json({ profile: publicViewedProfile(req.auth.user, target) });
});

app.get('/clubs/me', requireAuth, (req, res) => {
  const club = req.auth.user.clubId ? clubById(req.auth.user.clubId) : null;
  if (!club) {
    return res.json({
      club: null,
      applications: userClubApplications(req.auth.user.userId),
      recommended: [...clubs.values()]
        .sort((a, b) => b.progression.totalXp - a.progression.totalXp)
        .slice(0, 8)
        .map(item => publicClubSummary(item, req.auth.user.userId)),
    });
  }
  return res.json({ club: publicClubProfile(club, users, req.auth.user.userId, rankedSeason), applications: [] });
});

app.post('/clubs', requireAuth, (req, res) => {
  if (req.auth.user.clubId && clubs.has(req.auth.user.clubId)) return res.status(409).json({ error: 'You are already in a club.' });
  const name = String(req.body?.name || '').trim();
  const tag = normalizeClubTag(req.body?.tag);
  if (clubNameOrTagTaken(name, tag)) return res.status(409).json({ error: 'Club name or tag is already taken.' });
  const created = createClubRecord(req.auth.user, {
    clubId: crypto.randomUUID(),
    name,
    tag,
    motto: req.body?.motto,
    branding: req.body?.branding,
  });
  if (created.error) return res.status(400).json({ error: created.error });
  clubs.set(created.club.clubId, created.club);
  req.auth.user.clubId = created.club.clubId;
  saveStore();
  return res.json({ club: publicClubProfile(created.club, users, req.auth.user.userId, rankedSeason) });
});

app.get('/clubs/search', requireAuth, (req, res) => {
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

app.get('/clubs/:clubId', requireAuth, (req, res) => {
  const club = clubById(req.params.clubId);
  if (!club) return res.status(404).json({ error: 'Club not found.' });
  return res.json({ club: publicClubProfile(club, users, req.auth.user.userId, rankedSeason) });
});

app.patch('/clubs/:clubId', requireAuth, (req, res) => {
  const club = clubById(req.params.clubId);
  if (!club) return res.status(404).json({ error: 'Club not found.' });
  if (frozenClubResponse(club, res)) return;
  const role = currentClubRole(req.auth.user, club);
  if (!canUpdateClub(role)) return res.status(403).json({ error: 'Only the club owner can edit club identity.' });

  const nextName = String(req.body?.name ?? club.name).replace(/\s+/g, ' ').trim().slice(0, 28);
  const nextTag = normalizeClubTag(req.body?.tag ?? club.tag);
  if (nextName.length < 3) return res.status(400).json({ error: 'Club name must be at least 3 characters.' });
  if (nextTag.length < 2) return res.status(400).json({ error: 'Club tag must be 2 to 5 letters or numbers.' });
  if (clubNameOrTagTaken(nextName, nextTag, club.clubId)) return res.status(409).json({ error: 'Club name or tag is already taken.' });

  club.name = nextName;
  club.tag = nextTag;
  club.motto = String(req.body?.motto ?? club.motto).replace(/\s+/g, ' ').trim().slice(0, 80);
  club.branding = normalizeClubBranding(req.body?.branding || club.branding);
  club.updatedAt = Date.now();
  saveStore();
  emitClubUpdate(club.clubId);
  return res.json({ club: publicClubProfile(club, users, req.auth.user.userId, rankedSeason) });
});

app.post('/clubs/:clubId/requests', requireAuth, (req, res) => {
  const club = clubById(req.params.clubId);
  if (!club) return res.status(404).json({ error: 'Club not found.' });
  if (frozenClubResponse(club, res)) return;
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

app.post('/clubs/:clubId/requests/:requestId/accept', requireAuth, (req, res) => {
  const club = clubById(req.params.clubId);
  if (!club) return res.status(404).json({ error: 'Club not found.' });
  if (frozenClubResponse(club, res)) return;
  const role = currentClubRole(req.auth.user, club);
  if (!canManageRequests(role)) return res.status(403).json({ error: 'Only owners and officers can approve requests.' });
  const request = club.joinRequests.find(item => item.id === req.params.requestId);
  const target = request ? users.get(request.userId) : null;
  if (!request || !target) return res.status(404).json({ error: 'Request not found.' });
  if (target.clubId && clubs.has(target.clubId)) return res.status(409).json({ error: 'That player is already in a club.' });
  if (club.members.length >= club.progression.memberCap) return res.status(409).json({ error: 'Club is full.' });
  club.joinRequests = club.joinRequests.filter(item => item.id !== request.id);
  club.members.push({
    userId: target.userId,
    role: 'rookie',
    joinedAt: Date.now(),
    contributionXp: 0,
    contribution: { matches: 0, wins: 0, columnClears: 0, rankedOrWager: 0 },
  });
  target.clubId = club.clubId;
  club.updatedAt = Date.now();
  saveStore();
  emitClubUpdate(club.clubId);
  emitSocialUpdate(target.userId);
  return res.json({ club: publicClubProfile(club, users, req.auth.user.userId, rankedSeason), member: publicPlayerCard(req.auth.user, target) });
});

app.post('/clubs/:clubId/requests/:requestId/reject', requireAuth, (req, res) => {
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

app.post('/clubs/:clubId/invites', requireAuth, (req, res) => {
  const club = clubById(req.params.clubId);
  if (!club) return res.status(404).json({ error: 'Club not found.' });
  if (frozenClubResponse(club, res)) return;
  const role = currentClubRole(req.auth.user, club);
  if (!canManageRequests(role)) return res.status(403).json({ error: 'Only owners and officers can invite players.' });
  const target = findUserByIdentifier(req.body?.userId || req.body?.displayName);
  if (!target) return res.status(404).json({ error: 'Player not found.' });
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

app.post('/clubs/:clubId/leave', requireAuth, (req, res) => {
  const club = clubById(req.params.clubId);
  if (!club || !findClubMember(club, req.auth.user.userId)) return res.status(404).json({ error: 'Club not found.' });
  if (frozenClubResponse(club, res)) return;
  const member = findClubMember(club, req.auth.user.userId);
  if (member.role === 'owner' && club.members.length > 1) return res.status(409).json({ error: 'Transfer ownership before leaving.' });
  removeUserFromClub(club, req.auth.user.userId);
  if (!club.members.length) clubs.delete(club.clubId);
  else club.updatedAt = Date.now();
  saveStore();
  emitClubUpdate(club.clubId);
  emitSocialUpdate(req.auth.user.userId);
  return res.json({ ok: true, club: null });
});

app.patch('/clubs/:clubId/members/:userId', requireAuth, (req, res) => {
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

app.delete('/clubs/:clubId/members/:userId', requireAuth, (req, res) => {
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

app.post('/clubs/:clubId/announcements', requireAuth, (req, res) => {
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
  club.announcements.push(announcement);
  club.announcements = club.announcements.slice(-20);
  club.updatedAt = announcement.createdAt;
  saveStore();
  io.to(clubSocketRoom(club.clubId)).emit('club:announcement', announcement);
  emitClubUpdate(club.clubId);
  return res.json({ announcement, club: publicClubProfile(club, users, req.auth.user.userId, rankedSeason) });
});

app.delete('/clubs/:clubId/announcements/:announcementId', requireAuth, (req, res) => {
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

app.post('/clubs/rewards/claim', requireAuth, (req, res) => {
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

app.post('/friends/requests', requireAuth, (req, res) => {
  const target = findUserByIdentifier(req.body?.userId || req.body?.displayName);
  if (!target) return res.status(404).json({ error: 'Player not found.' });
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
  if (!existing) {
    const request = { id: crypto.randomUUID(), userId: target.userId, createdAt: Date.now() };
    req.auth.user.social.outgoingRequests.push(request);
    target.social.incomingRequests.push({ ...request, userId: req.auth.user.userId });
  }
  saveStore();
  emitSocialUpdate(req.auth.user.userId);
  emitSocialUpdate(target.userId);
  return res.json({ social: socialSummary(req.auth.user) });
});

app.post('/friends/requests/:requestId/accept', requireAuth, (req, res) => {
  normalizeSocial(req.auth.user);
  const request = req.auth.user.social.incomingRequests.find(item => item.id === req.params.requestId);
  const from = request ? users.get(request.userId) : null;
  if (!request || !from) return res.status(404).json({ error: 'Friend request not found.' });
  addFriendship(req.auth.user, from);
  saveStore();
  emitSocialUpdate(req.auth.user.userId);
  emitSocialUpdate(from.userId);
  return res.json({ social: socialSummary(req.auth.user), friend: publicPlayerCard(req.auth.user, from) });
});

app.post('/friends/requests/:requestId/reject', requireAuth, (req, res) => {
  normalizeSocial(req.auth.user);
  const request = req.auth.user.social.incomingRequests.find(item => item.id === req.params.requestId);
  const from = request ? users.get(request.userId) : null;
  if (!request || !from) return res.status(404).json({ error: 'Friend request not found.' });
  removeRequestsBetween(req.auth.user, from);
  saveStore();
  emitSocialUpdate(req.auth.user.userId);
  emitSocialUpdate(from.userId);
  return res.json({ social: socialSummary(req.auth.user) });
});

app.delete('/friends/requests/:requestId', requireAuth, (req, res) => {
  normalizeSocial(req.auth.user);
  const outgoing = req.auth.user.social.outgoingRequests.find(item => item.id === req.params.requestId);
  const incoming = req.auth.user.social.incomingRequests.find(item => item.id === req.params.requestId);
  const other = users.get(outgoing?.userId || incoming?.userId || '');
  if (!other) return res.status(404).json({ error: 'Friend request not found.' });
  removeRequestsBetween(req.auth.user, other);
  saveStore();
  emitSocialUpdate(req.auth.user.userId);
  emitSocialUpdate(other.userId);
  return res.json({ social: socialSummary(req.auth.user) });
});

app.delete('/friends/:userId', requireAuth, (req, res) => {
  const target = users.get(String(req.params.userId || ''));
  if (!target || !isFriend(req.auth.user, target.userId)) return res.status(404).json({ error: 'Friend not found.' });
  removeFriendship(req.auth.user, target);
  saveStore();
  emitSocialUpdate(req.auth.user.userId);
  emitSocialUpdate(target.userId);
  return res.json({ social: socialSummary(req.auth.user) });
});

app.get('/economy/catalog', requireAuth, (req, res) => res.json(publicEconomyCatalog(req.auth.user)));

app.post('/economy/daily-bonus/claim', requireAuth, (req, res) => {
  const result = claimDailyTableBonus(req.auth.user);
  if (result.error) return res.status(400).json({ error: result.error, dailyBonus: result.dailyBonus, user: safeUser(req.auth.user) });
  saveStore();
  return res.json({ ...result, user: safeUser(req.auth.user), economy: publicEconomyCatalog(req.auth.user) });
});

app.get('/ranked/me', requireAuth, (req, res) => {
  rankedSeason = normalizeRankedSeason(rankedSeason, Date.now(), rankedConfig());
  normalizeCompetitiveState(req.auth.user, rankedSeason, rankedConfig());
  return res.json({
    competitive: publicCompetitiveState(req.auth.user, rankedSeason, rankedConfig()),
    queue: publicRankedQueueStatus(req.auth.user.userId),
  });
});

app.post('/ranked/queue', requireAuth, (req, res) => {
  rankedSeason = normalizeRankedSeason(rankedSeason, Date.now(), rankedConfig());
  const activeRoom = activeRankedRoomForUser(req.auth.user.userId);
  if (activeRoom) {
    return res.json({ queue: publicRankedQueueStatus(req.auth.user.userId), competitive: publicCompetitiveState(req.auth.user, rankedSeason, rankedConfig()) });
  }
  const options = normalizeRoomOptions(req.body || {});
  normalizeCompetitiveState(req.auth.user, rankedSeason, rankedConfig());
  const buyIn = rankedBuyInForMmr(req.auth.user.competitive.mmr);
  const error = buyInError(req.auth.user, buyIn);
  if (error) return res.status(402).json({ error, buyIn, balance: req.auth.user.currency.coins });
  removeUserFromRankedQueue(req.auth.user.userId);
  rankedQueue.set(req.auth.user.userId, rankedQueueEntry(req.auth.user, options));
  tryMatchRankedQueue();
  return res.json({ queue: publicRankedQueueStatus(req.auth.user.userId), competitive: publicCompetitiveState(req.auth.user, rankedSeason, rankedConfig()) });
});

app.get('/ranked/queue', requireAuth, (req, res) => {
  tryMatchRankedQueue();
  return res.json({ queue: publicRankedQueueStatus(req.auth.user.userId), competitive: publicCompetitiveState(req.auth.user, rankedSeason, rankedConfig()) });
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

app.get('/cosmetics/catalog', requireAuth, (req, res) => res.json({ cosmetics: cosmeticsFor(req.auth.user) }));

app.post('/challenges/claim', requireAuth, (req, res) => {
  const result = claimChallengeReward(req.auth.user, String(req.body?.challengeId || ''));
  if (result.error) return res.status(400).json({ error: result.error });
  saveStore();
  return res.json({ ...result, user: safeUser(req.auth.user) });
});

app.post('/cosmetics/purchase', requireAuth, (req, res) => {
  const result = purchaseCosmetic(req.auth.user, String(req.body?.cosmeticId || ''), rankedSeason, currentCatalog(), rankedConfig());
  if (result.error) return res.status(400).json({ error: result.error });
  saveStore();
  return res.json({ ...result, user: safeUser(req.auth.user), cosmetics: cosmeticsFor(req.auth.user) });
});

app.post('/cosmetics/equip', requireAuth, (req, res) => {
  const result = equipCosmetic(req.auth.user, String(req.body?.cosmeticId || ''), currentCatalog(), rankedSeason, rankedConfig());
  if (result.error) return res.status(400).json({ error: result.error });
  saveStore();
  return res.json({ ...result, user: safeUser(req.auth.user), cosmetics: cosmeticsFor(req.auth.user) });
});

app.get('/results/me', requireAuth, (req, res) => res.json({ results: userResults(req.auth.user.userId) }));

app.post('/results/local', requireAuth, (req, res) => {
  const mode = req.body?.mode === 'solo' ? 'solo' : 'passplay';
  const totalRounds = Number(req.body?.totalRounds) === 5 ? 5 : 9;
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
    completedAt: Date.now(),
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

app.post('/rooms', requireAuth, (req, res) => {
  const room = makeRoom(req.auth.user, req.body || {});
  return res.json({ room: roomSummary(room) });
});

app.post('/rooms/quick-play', requireAuth, (req, res) => {
  const options = normalizeRoomOptions(req.body || {});
  const existingForUser = [...rooms.values()].find(room =>
    room.status === 'lobby'
    && room.matchType === 'casual'
    && room.maxPlayers === options.maxPlayers
    && room.rounds === options.rounds
    && room.players.some(player => player.userId === req.auth.user.userId)
  );
  let room = existingForUser || [...rooms.values()].find(item =>
    item.status === 'lobby'
    && item.matchType === 'casual'
    && item.maxPlayers === options.maxPlayers
    && item.rounds === options.rounds
    && item.players.length < item.maxPlayers
    && !item.players.some(player => player.userId === req.auth.user.userId)
  );

  if (!room) room = makeRoom(req.auth.user, options);
  else {
    try {
      addUserToRoom(room, req.auth.user);
    } catch (error) {
      return res.status(409).json({ error: error.message });
    }
  }

  room.updatedAt = Date.now();
  broadcastRoom(room);
  return res.json({ room: roomSummary(room) });
});

app.post('/rooms/wager-play', requireAuth, (req, res) => {
  const options = normalizeWagerOptions(req.body || {});
  if (!options.buyIn) return res.status(400).json({ error: 'Choose a wager table buy-in.' });
  const error = buyInError(req.auth.user, options.buyIn);
  if (error) return res.status(402).json({ error, buyIn: options.buyIn, balance: req.auth.user.currency.coins });

  const existingForUser = [...rooms.values()].find(room =>
    room.status === 'lobby'
    && room.matchType === 'wager'
    && room.economy?.buyIn === options.buyIn
    && room.maxPlayers === options.maxPlayers
    && room.rounds === options.rounds
    && room.players.some(player => player.userId === req.auth.user.userId)
  );
  let room = existingForUser || [...rooms.values()].find(item =>
    item.status === 'lobby'
    && item.matchType === 'wager'
    && item.economy?.buyIn === options.buyIn
    && item.maxPlayers === options.maxPlayers
    && item.rounds === options.rounds
    && item.players.length < item.maxPlayers
    && !item.players.some(player => player.userId === req.auth.user.userId)
  );

  if (!room) room = makeRoom(req.auth.user, { ...options, matchType: 'wager', buyIn: options.buyIn });
  else {
    try {
      addUserToRoom(room, req.auth.user);
    } catch (errorToReport) {
      return res.status(409).json({ error: errorToReport.message });
    }
  }

  room.updatedAt = Date.now();
  broadcastRoom(room);
  return res.json({ room: roomSummary(room) });
});

app.post('/rooms/:code/join', requireAuth, (req, res) => {
  const room = rooms.get(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found.' });
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

app.post('/rooms/:code/invites', requireAuth, (req, res) => {
  const room = rooms.get(req.params.code.toUpperCase());
  const target = users.get(String(req.body?.userId || ''));
  if (!room) return res.status(404).json({ error: 'Room not found.' });
  if (!target) return res.status(404).json({ error: 'Friend not found.' });
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
  return res.json({ invite: publicRoomInvite(target, invite), social: socialSummary(req.auth.user) });
});

app.post('/rooms/invites/:inviteId/accept', requireAuth, (req, res) => {
  normalizeSocial(req.auth.user);
  const invite = req.auth.user.social.roomInvites.find(item => item.id === req.params.inviteId);
  if (!invite) return res.status(404).json({ error: 'Invite not found.' });
  const room = rooms.get(invite.roomCode);
  if (!room || room.status !== 'lobby') {
    req.auth.user.social.roomInvites = req.auth.user.social.roomInvites.filter(item => item.id !== invite.id);
    saveStore();
    return res.status(404).json({ error: 'Room is no longer available.' });
  }
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
  return next();
});

io.on('connection', (socket) => {
  const connectedUserId = socket.auth.user.userId;
  socket.join(`user:${connectedUserId}`);
  if (!userSockets.has(connectedUserId)) userSockets.set(connectedUserId, new Set());
  userSockets.get(connectedUserId).add(socket.id);

  socket.on('room:join', ({ code }, cb = () => {}) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room) return cb({ error: 'Room not found.' });
    const userId = socket.auth.user.userId;
    if (!room.players.some(player => player.userId === userId)) return cb({ error: 'You are not a member of this room.' });
    socket.join(room.code);
    socket.join(`${room.code}:${userId}`);
    sockets.set(socket.id, { roomCode: room.code, userId });
    room.connected.set(userId, true);
    const gameChanged = resolveRoomExpiredTimers(room);
    if (gameChanged) recordCompletedGame(room);
    room.updatedAt = Date.now();
    broadcastRoom(room);
    socket.emit('chat:history', publicChatHistory(room));
    return cb({ room: roomSummary(room), game: room.game ? gameViewFor(room, userId) : null, chat: publicChatHistory(room) });
  });

  socket.on('room:ready', ({ code, ready }, cb = () => {}) => {
    const room = rooms.get(String(code || '').toUpperCase());
    const userId = socket.auth.user.userId;
    if (!room || !room.players.some(player => player.userId === userId)) return cb({ error: 'Room not found.' });
    if (room.status !== 'lobby') return cb({ error: 'Game already started.' });
    room.ready.set(userId, Boolean(ready));
    room.updatedAt = Date.now();
    broadcastRoom(room);
    return cb({ room: roomSummary(room) });
  });

  socket.on('room:start', ({ code }, cb = () => {}) => {
    const room = rooms.get(String(code || '').toUpperCase());
    const userId = socket.auth.user.userId;
    if (!room) return cb({ error: 'Room not found.' });
    if (room.hostUserId !== userId) return cb({ error: 'Only the host can start.' });
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
    room.players = room.players.filter(player => player.userId !== userId);
    room.ready.delete(userId);
    room.connected.delete(userId);
    if (room.hostUserId === userId && room.players.length) room.hostUserId = room.players[0].userId;
    cancelRoomCountdown(room);
    if (!room.players.length) rooms.delete(room.code);
    else broadcastRoom(room);
    room.chatRate?.delete(userId);
    socket.leave(room.code);
    socket.leave(`${room.code}:${userId}`);
    return cb({ ok: true });
  });

  socket.on('chat:send', ({ code, type = 'text', text }, cb = () => {}) => {
    const room = rooms.get(String(code || '').toUpperCase());
    const userId = socket.auth.user.userId;
    if (!room || !room.players.some(player => player.userId === userId)) return cb({ error: 'Room not found.' });
    if (activeBansFor(adminStore, socket.auth.user).some(ban => ban.type === 'chat_mute')) return cb({ error: 'Chat is muted for this account.' });
    room.chatRate ||= new Map();
    const now = Date.now();
    const lastSentAt = room.chatRate.get(userId) || 0;
    if (now - lastSentAt < CHAT_RATE_LIMIT_MS) return cb({ error: 'Slow down before sending another chat.' });
    const result = makeChatMessage(room, userId, type, text);
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
    if (!club || !findClubMember(club, userId)) return cb({ error: 'Club not found.' });
    socket.join(clubSocketRoom(club.clubId));
    socket.emit('club:chat:history', club.chat || []);
    return cb({
      club: publicClubProfile(club, users, userId, rankedSeason),
      chat: club.chat || [],
    });
  });

  socket.on('club:chat:send', ({ clubId, type = 'text', text }, cb = () => {}) => {
    const club = clubById(clubId || socket.auth.user.clubId);
    const user = socket.auth.user;
    if (!club || !findClubMember(club, user.userId)) return cb({ error: 'Club not found.' });
    if (club.adminStatus?.frozenAt) return cb({ error: 'This club is temporarily frozen by Golf 9 support.' });
    if (activeBansFor(adminStore, user).some(ban => ban.type === 'chat_mute')) return cb({ error: 'Chat is muted for this account.' });
    const now = Date.now();
    const rateKey = `${club.clubId}:${user.userId}`;
    const lastSentAt = clubChatRate.get(rateKey) || 0;
    if (now - lastSentAt < CLUB_CHAT_RATE_LIMIT_MS) return cb({ error: 'Slow down before sending another club chat.' });
    const result = makeClubChatMessage(club, user, type, text);
    if (result.error) return cb({ error: result.error });
    clubChatRate.set(rateKey, now);
    appendClubChatMessage(club, result.message);
    club.updatedAt = now;
    saveStore();
    io.to(clubSocketRoom(club.clubId)).emit('club:chat:message', result.message);
    return cb({ ok: true, message: result.message });
  });

  socket.on('game:intent', ({ code, actionId, type, payload }, cb = () => {}) => {
    const room = rooms.get(String(code || '').toUpperCase());
    const userId = socket.auth.user.userId;
    if (!room || !room.game) return cb({ error: 'Game not found.' });
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
      const heldMustReplace = room.heldMustReplace.get(userId) || false;
      const heldCanDiscard = room.heldCanDiscard.get(userId) || false;
      if (!heldCard) return cb({ error: 'Draw or take a card first.' });
      if (type === 'discard' && heldSource === 'discard' && (!room.game.pendingDecision || heldMustReplace)) {
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
    trackColumnClears(room, userId, countNewClearedColumns(beforeGame, result.state, idx));
    room.game = result.state;
    captureRoundProgress(room);
    recordCompletedGame(room);
    rememberActionId(room, actionId);
    room.updatedAt = Date.now();
    broadcastRoom(room);
    return cb({ ok: true, drawn });
  });

  socket.on('disconnect', () => {
    const activeSockets = userSockets.get(connectedUserId);
    activeSockets?.delete(socket.id);
    if (activeSockets && !activeSockets.size) userSockets.delete(connectedUserId);
    const link = sockets.get(socket.id);
    if (!link) return;
    const room = rooms.get(link.roomCode);
    sockets.delete(socket.id);
    if (!room) return;
    const stillConnected = [...sockets.values()].some(item => item.roomCode === link.roomCode && item.userId === link.userId);
    room.connected.set(link.userId, stillConnected);
    room.updatedAt = Date.now();
    broadcastRoom(room);
  });
});

setInterval(() => {
  const now = Date.now();
  rankedSeason = normalizeRankedSeason(rankedSeason, now, rankedConfig());
  tryMatchRankedQueue(now);
  for (const [token, session] of sessions) if (session.expiresAt <= now) sessions.delete(token);
  for (const [code, room] of rooms) {
    const gameChanged = resolveRoomExpiredTimers(room);
    recordCompletedGame(room);
    if (now - room.updatedAt > ROOM_TTL_MS) {
      cancelRoomCountdown(room);
      rooms.delete(code);
    }
    else if (gameChanged) {
      room.updatedAt = now;
      broadcastRoom(room);
    }
  }
  saveStore();
}, 1000);

async function startServer() {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Golf9 authoritative server listening on port ${PORT}`);
  });
  for (const extraPort of EXTRA_LISTEN_PORTS) {
    const extraServer = http.createServer(app);
    io.attach(extraServer, { cors: { origin: CLIENT_ORIGINS.includes('*') ? '*' : CLIENT_ORIGINS } });
    listeningServers.push(extraServer);
    extraServer.listen(extraPort, '0.0.0.0', () => {
      console.log(`Golf9 fallback listener active on port ${extraPort}`);
    });
  }
  try {
    await loadStore();
    seedLocalTestAccounts();
    seedAdminAccounts();
    storeReady = true;
    storeLoadError = null;
    console.log('Golf9 persistence loaded.');
  } catch (error) {
    storeReady = false;
    storeLoadError = error;
    console.error('Golf9 persistence failed to load:', error);
    if (!IS_PRODUCTION || process.env.ALLOW_JSON_FALLBACK_ON_DB_ERROR === '1') {
      console.warn('Falling back to local JSON store after persistence failure.');
      loadJsonStore();
      seedLocalTestAccounts();
      seedAdminAccounts();
      storeReady = true;
      storeLoadError = null;
    }
  }
}

async function shutdown() {
  try {
    saveStore();
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
  console.error('Failed to start Golf9 server:', error);
  process.exit(1);
});
