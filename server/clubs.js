// clubs.js
// Purpose: Club persistence helpers, permissions, progression, goals, events, and rewards.

import crypto from 'crypto';
import { DEFAULT_CLUB_CONFIG, normalizeClubConfig } from './economy.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const CLUB_LEVEL_THRESHOLDS = [
  0, 1500, 3500, 6500, 10000, 14500, 19500, 25000, 31500, 39000, 47500, 57000,
];
const CLUB_ANNOUNCEMENT_LIMIT = 1;
const CLUB_DESCRIPTION_MAX = 250;
const CLUB_PROCESSED_RESULT_LIMIT = 500;
const CLUB_DONATION_LEDGER_LIMIT = 200;
const CLUB_TREASURY_GOAL_TITLE_MAX = 60;
const CLUB_TREASURY_GOAL_DESCRIPTION_MAX = 180;
const CLUB_TREASURY_GOAL_MAX = 100_000_000;

export const CLUB_ROLES = ['owner', 'officer', 'member', 'rookie'];

export const CLUB_BRANDING = {
  colorPairs: ['emerald', 'gold', 'sky', 'crimson', 'violet'],
  badgeShapes: ['shield', 'crest', 'diamond', 'circle'],
  bannerStyles: ['classic', 'night', 'fairway', 'champion'],
  badgeIcons: ['shield', 'flag', 'trophy', 'crown', 'star', 'target', 'bolt', 'gem'],
  colors: [
    '#52E5A7', '#4DA3FF', '#FFCC66', '#FF6B6B', '#B99CFF', '#E8ECF1', '#2DD4BF', '#F472B6',
    '#0B1023', '#123B32', '#102448', '#2B2515', '#331A24', '#211B3D',
  ],
};

const CLUB_BRAND_DEFAULTS = {
  emerald: { primaryColor: '#52E5A7', backgroundColor: '#123B32', accentColor: '#2DD4BF' },
  gold: { primaryColor: '#FFCC66', backgroundColor: '#2B2515', accentColor: '#E8ECF1' },
  sky: { primaryColor: '#4DA3FF', backgroundColor: '#102448', accentColor: '#2DD4BF' },
  crimson: { primaryColor: '#FF6B6B', backgroundColor: '#331A24', accentColor: '#FFCC66' },
  violet: { primaryColor: '#B99CFF', backgroundColor: '#211B3D', accentColor: '#F472B6' },
};

const WEEKLY_GOAL_TEMPLATES = [
  { templateId: 'weekly-online-matches', title: 'Club Table Time', metric: 'matches', baseTarget: 6, reward: { clubXp: 500 } },
  { templateId: 'weekly-wins', title: 'Shared Wins', metric: 'wins', baseTarget: 3, reward: { clubXp: 700 } },
  { templateId: 'weekly-column-clears', title: 'Column Crew', metric: 'columnClears', baseTarget: 8, reward: { clubXp: 650 } },
];

const SEASON_OBJECTIVE_TEMPLATES = [
  { templateId: 'season-online-matches', title: 'Season Presence', metric: 'matches', baseTarget: 50, reward: { clubXp: 2500 } },
  { templateId: 'season-ranked-wager', title: 'Competitive Tables', metric: 'rankedOrWager', baseTarget: 20, reward: { clubXp: 3000 } },
  { templateId: 'season-wins', title: 'Club Victories', metric: 'wins', baseTarget: 24, reward: { clubXp: 3500 } },
];

const EVENT_TEMPLATES = [
  { templateId: 'weekend-low-total', title: 'Low Total Weekend', metric: 'lowTotalPoints', reward: { clubXp: 900 } },
  { templateId: 'column-rush', title: 'Column Rush', metric: 'columnClearPoints', reward: { clubXp: 900 } },
  { templateId: 'ranked-surge', title: 'Ranked Surge', metric: 'rankedPoints', reward: { clubXp: 900 } },
];

export const CLUB_REWARD_CATALOG = [
  { id: 'club-level-2-banner', scope: 'club', name: 'Founders Banner', description: 'A club banner for reaching Level 2.', minLevel: 2, unlocks: { kind: 'banner', value: 'founders-banner' } },
  { id: 'club-level-3-badge', scope: 'club', name: 'Club Crest Badge', description: 'A shared club badge shape accent.', minLevel: 3, unlocks: { kind: 'badge', value: 'crest-badge' } },
  { id: 'club-level-5-table', scope: 'club', name: 'Club Felt Theme', description: 'A shared club table theme option.', minLevel: 5, unlocks: { kind: 'tableTheme', value: 'club-felt-table-theme' } },
  { id: 'club-level-8-trophy', scope: 'club', name: 'Weekly Trophy Case', description: 'A club trophy display item.', minLevel: 8, unlocks: { kind: 'trophy', value: 'weekly-trophy-case' } },
  { id: 'club-regular-title', scope: 'member', name: 'Club Regular', description: 'A member title for contributing to your club.', minLevel: 2, minContributionXp: 250, cosmeticId: 'club-regular-title' },
  { id: 'club-crest-card-back', scope: 'member', name: 'Club Crest Cards', description: 'A card back earned through club contribution.', minLevel: 3, minContributionXp: 500, cosmeticId: 'club-crest-card-back' },
  { id: 'club-emerald-frame', scope: 'member', name: 'Club Emerald Frame', description: 'An avatar frame for active clubmates.', minLevel: 5, minContributionXp: 1000, cosmeticId: 'club-emerald-frame' },
  { id: 'club-felt-table-theme', scope: 'member', name: 'Club Felt Table', description: 'A table theme for committed club players.', minLevel: 8, minContributionXp: 2000, cosmeticId: 'club-felt-table-theme' },
  { id: 'club-champion-card-back', scope: 'member', name: 'Club Champion Cards', description: 'A premium card back for major club contributors.', minLevel: 12, minContributionXp: 4000, cosmeticId: 'club-champion-card-back' },
];

function clampText(value, maxLength) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function safeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
}

export function normalizeClubTag(value) {
  return String(value || '')
    .replace(/[^a-z]/gi, '')
    .toUpperCase()
    .slice(0, 4);
}

function safePreset(value, allowed, fallback) {
  const raw = String(value || '').trim();
  return allowed.includes(raw) ? raw : fallback;
}

export function normalizeClubBranding(input = {}) {
  const colorPair = safePreset(input.colorPair, CLUB_BRANDING.colorPairs, CLUB_BRANDING.colorPairs[0]);
  const defaults = CLUB_BRAND_DEFAULTS[colorPair] || CLUB_BRAND_DEFAULTS.emerald;
  return {
    colorPair,
    badgeShape: safePreset(input.badgeShape, CLUB_BRANDING.badgeShapes, CLUB_BRANDING.badgeShapes[0]),
    bannerStyle: safePreset(input.bannerStyle, CLUB_BRANDING.bannerStyles, CLUB_BRANDING.bannerStyles[0]),
    badgeIcon: safePreset(input.badgeIcon, CLUB_BRANDING.badgeIcons, CLUB_BRANDING.badgeIcons[0]),
    primaryColor: safePreset(input.primaryColor, CLUB_BRANDING.colors, defaults.primaryColor),
    backgroundColor: safePreset(input.backgroundColor, CLUB_BRANDING.colors, defaults.backgroundColor),
    accentColor: safePreset(input.accentColor, CLUB_BRANDING.colors, defaults.accentColor),
  };
}

function utcDayStart(now = Date.now()) {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function utcWeekStart(now = Date.now()) {
  const start = utcDayStart(now);
  const day = new Date(start).getUTCDay();
  const mondayOffset = (day + 6) % 7;
  return start - (mondayOffset * DAY_MS);
}

export function clubLevelForXp(totalXp = 0) {
  const xp = Math.max(0, Math.floor(Number(totalXp) || 0));
  let level = 1;
  for (let i = 1; i < CLUB_LEVEL_THRESHOLDS.length; i += 1) {
    if (xp >= CLUB_LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  if (xp >= CLUB_LEVEL_THRESHOLDS[CLUB_LEVEL_THRESHOLDS.length - 1]) {
    level = CLUB_LEVEL_THRESHOLDS.length + Math.floor((xp - CLUB_LEVEL_THRESHOLDS[CLUB_LEVEL_THRESHOLDS.length - 1]) / 12000);
  }
  return Math.max(1, level);
}

export function memberCapForLevel(level = 1) {
  if (level >= 12) return 50;
  if (level >= 8) return 40;
  if (level >= 5) return 30;
  if (level >= 3) return 20;
  return 15;
}

export function clubProgressionSnapshot(totalXp = 0, memberCapOverride = null) {
  const xp = Math.max(0, Math.floor(Number(totalXp) || 0));
  const level = clubLevelForXp(xp);
  const index = Math.min(level - 1, CLUB_LEVEL_THRESHOLDS.length - 1);
  const currentLevelXp = CLUB_LEVEL_THRESHOLDS[index] ?? CLUB_LEVEL_THRESHOLDS[CLUB_LEVEL_THRESHOLDS.length - 1];
  const nextLevelXp = CLUB_LEVEL_THRESHOLDS[index + 1] ?? (currentLevelXp + 12000);
  return {
    level,
    totalXp: xp,
    currentLevelXp: Math.max(0, xp - currentLevelXp),
    nextLevelXp: Math.max(1, nextLevelXp - currentLevelXp),
    levelProgress: Math.max(0, Math.min(1, (xp - currentLevelXp) / Math.max(1, nextLevelXp - currentLevelXp))),
    memberCap: Math.max(1, Math.floor(Number(memberCapOverride ?? memberCapForLevel(level)) || 15)),
  };
}

function prestigeTierFor(clubConfig, tier = 1) {
  const config = normalizeClubConfig(clubConfig || DEFAULT_CLUB_CONFIG);
  const safeTier = Math.max(1, safeInteger(tier, 1));
  const exact = config.prestigeTiers.find(item => item.tier === safeTier);
  if (exact) return exact;
  const previous = config.prestigeTiers.filter(item => item.tier <= safeTier).at(-1);
  return previous || config.prestigeTiers[0];
}

function nextPrestigeTierFor(club, clubConfig) {
  const config = normalizeClubConfig(clubConfig || DEFAULT_CLUB_CONFIG);
  const currentTier = Math.max(1, safeInteger(club?.prestige?.tier, 1));
  return config.prestigeTiers.find(item => item.tier > currentTier) || null;
}

function normalizeClubPrestige(club, now = Date.now()) {
  const tier = Math.max(1, safeInteger(club.prestige?.tier ?? club.prestigeTier, 1));
  const history = Array.isArray(club.prestige?.history) ? club.prestige.history : [];
  return {
    tier,
    purchasedAt: safeInteger(club.prestige?.purchasedAt ?? club.createdAt, now) || now,
    history: history
      .filter(item => item && safeInteger(item.tier, 0) > 0)
      .map(item => ({
        tier: Math.max(1, safeInteger(item.tier, 1)),
        purchasedAt: safeInteger(item.purchasedAt, now) || now,
        purchasedBy: item.purchasedBy ? String(item.purchasedBy) : null,
        treasuryCost: Math.max(0, safeInteger(item.treasuryCost ?? item.cost, 0)),
      }))
      .slice(-20),
  };
}

function normalizeClubTreasury(club, now = Date.now()) {
  const donations = Array.isArray(club.treasury?.donations) ? club.treasury.donations : [];
  return {
    balance: Math.max(0, safeInteger(club.treasury?.balance, 0)),
    lifetimeDonated: Math.max(0, safeInteger(club.treasury?.lifetimeDonated, 0)),
    donations: donations
      .filter(item => item?.userId && safeInteger(item.amount, 0) > 0)
      .map(item => ({
        id: String(item.id || crypto.randomUUID()),
        userId: String(item.userId),
        amount: Math.max(1, safeInteger(item.amount, 1)),
        createdAt: safeInteger(item.createdAt, now) || now,
      }))
      .slice(-CLUB_DONATION_LEDGER_LIMIT),
  };
}

function normalizeClubTreasuryGoal(goal, now = Date.now()) {
  if (!goal || typeof goal !== 'object') return null;
  const title = clampText(goal.title, CLUB_TREASURY_GOAL_TITLE_MAX);
  const description = clampText(goal.description, CLUB_TREASURY_GOAL_DESCRIPTION_MAX);
  const targetAmount = Math.min(CLUB_TREASURY_GOAL_MAX, Math.max(0, safeInteger(goal.targetAmount, 0)));
  if (!title || !targetAmount) return null;
  return {
    title,
    description,
    targetAmount,
    createdBy: goal.createdBy ? String(goal.createdBy) : null,
    createdAt: safeInteger(goal.createdAt, now) || now,
    updatedAt: safeInteger(goal.updatedAt, now) || now,
  };
}

function targetScale(memberCap) {
  return Math.max(1, Math.ceil(Number(memberCap || 15) / 15));
}

function buildGoal(template, kind, periodStart, expiresAt, memberCap, previous = null) {
  const target = template.baseTarget * targetScale(memberCap);
  return {
    id: `${kind}:${template.templateId}:${periodStart}`,
    templateId: template.templateId,
    kind,
    title: template.title,
    metric: template.metric,
    target,
    progress: Math.min(target, Number(previous?.progress ?? 0) || 0),
    reward: template.reward,
    periodStart,
    expiresAt,
    completedAt: previous?.completedAt ?? null,
    claimedAt: previous?.claimedAt ?? null,
  };
}

function normalizeGoalBucket(bucket, kind, templates, periodStart, expiresAt, memberCap) {
  const previousItems = bucket?.periodStart === periodStart ? bucket.items || [] : [];
  return {
    periodStart,
    expiresAt,
    items: templates.map(template => buildGoal(
      template,
      kind,
      periodStart,
      expiresAt,
      memberCap,
      previousItems.find(item => item.templateId === template.templateId)
    )),
  };
}

export function currentClubEvent(now = Date.now()) {
  const periodStart = utcWeekStart(now);
  const rawIndex = Math.floor(periodStart / (7 * DAY_MS));
  const index = ((rawIndex % EVENT_TEMPLATES.length) + EVENT_TEMPLATES.length) % EVENT_TEMPLATES.length;
  const template = EVENT_TEMPLATES[index];
  return {
    id: `event:${template.templateId}:${periodStart}`,
    templateId: template.templateId,
    title: template.title,
    metric: template.metric,
    startsAt: periodStart,
    endsAt: periodStart + (7 * DAY_MS),
    reward: template.reward,
  };
}

function normalizeClubEvent(club, now = Date.now()) {
  const active = currentClubEvent(now);
  const previous = club.events?.active?.id === active.id ? club.events.active : null;
  return {
    active: {
      ...active,
      score: Number(previous?.score ?? 0) || 0,
      contributors: previous?.contributors && typeof previous.contributors === 'object' ? previous.contributors : {},
      rewardClaimedAt: previous?.rewardClaimedAt ?? null,
    },
    history: Array.isArray(club.events?.history) ? club.events.history.slice(-12) : [],
  };
}

export function normalizeClubRecord(club, now = Date.now(), rankedSeason = null, clubConfig = DEFAULT_CLUB_CONFIG) {
  const config = normalizeClubConfig(clubConfig || DEFAULT_CLUB_CONFIG);
  club.clubId = String(club.clubId || club.id || '');
  club.name = clampText(club.name, 28) || 'Golf Club';
  club.tag = normalizeClubTag(club.tag) || 'CLUB';
  club.motto = clampText(club.motto, 80);
  club.description = clampText(club.description, CLUB_DESCRIPTION_MAX);
  club.visibility = 'public_apply';
  club.branding = normalizeClubBranding(club.branding);
  club.createdAt = Number(club.createdAt || now) || now;
  club.updatedAt = Number(club.updatedAt || club.createdAt) || club.createdAt;
  club.prestige = normalizeClubPrestige(club, now);
  club.treasury = normalizeClubTreasury(club, now);
  club.treasuryGoal = normalizeClubTreasuryGoal(club.treasuryGoal, now);
  const activePrestigeTier = prestigeTierFor(config, club.prestige.tier);
  const progression = clubProgressionSnapshot(club.progression?.totalXp ?? club.totalXp ?? 0, activePrestigeTier.memberCap);
  const memberCap = progression.memberCap;
  club.progression = progression;
  club.members = Array.isArray(club.members) ? club.members : [];
  club.members = club.members
    .filter(member => member?.userId)
    .map(member => ({
      userId: String(member.userId),
      role: CLUB_ROLES.includes(member.role) ? member.role : 'rookie',
      joinedAt: Number(member.joinedAt || now) || now,
      contributionXp: Math.max(0, Math.floor(Number(member.contributionXp ?? 0) || 0)),
      coinContribution: Math.max(0, Math.floor(Number(member.coinContribution ?? 0) || 0)),
      contribution: {
        matches: Math.max(0, Math.floor(Number(member.contribution?.matches ?? 0) || 0)),
        wins: Math.max(0, Math.floor(Number(member.contribution?.wins ?? 0) || 0)),
        columnClears: Math.max(0, Math.floor(Number(member.contribution?.columnClears ?? 0) || 0)),
        rankedOrWager: Math.max(0, Math.floor(Number(member.contribution?.rankedOrWager ?? 0) || 0)),
      },
    }));
  if (!club.members.some(member => member.role === 'owner') && club.members[0]) club.members[0].role = 'owner';
  club.joinRequests = Array.isArray(club.joinRequests) ? club.joinRequests.filter(request => request?.id && request?.userId) : [];
  club.invites = Array.isArray(club.invites) ? club.invites.filter(invite => invite?.id && invite?.userId) : [];
  club.announcements = Array.isArray(club.announcements) ? club.announcements.slice(-CLUB_ANNOUNCEMENT_LIMIT) : [];
  club.chat = [];
  club.processedResultIds = Array.isArray(club.processedResultIds) ? club.processedResultIds.slice(-CLUB_PROCESSED_RESULT_LIMIT) : [];
  club.goals ||= {};
  const weekStart = utcWeekStart(now);
  club.goals.weekly = normalizeGoalBucket(club.goals.weekly, 'weekly', WEEKLY_GOAL_TEMPLATES, weekStart, weekStart + (7 * DAY_MS), memberCap);
  const seasonStart = Number(rankedSeason?.startsAt || weekStart);
  const seasonEnd = Number(rankedSeason?.endsAt || (seasonStart + (90 * DAY_MS)));
  club.goals.season = normalizeGoalBucket(club.goals.season, 'season', SEASON_OBJECTIVE_TEMPLATES, seasonStart, seasonEnd, memberCap);
  club.events = normalizeClubEvent(club, now);
  club.rewards ||= {};
  club.rewards.unlocked = Array.isArray(club.rewards.unlocked) ? club.rewards.unlocked : [];
  club.rewards.memberClaims = club.rewards.memberClaims && typeof club.rewards.memberClaims === 'object' ? club.rewards.memberClaims : {};
  return club;
}

export function createClubRecord(owner, payload, now = Date.now(), clubConfig = DEFAULT_CLUB_CONFIG) {
  const name = clampText(payload?.name, 28);
  const tag = normalizeClubTag(payload?.tag);
  if (name.length < 3) return { error: 'Club name must be at least 3 characters.' };
  if (tag.length < 1) return { error: 'Club tag must be 1 to 4 letters.' };
  const club = normalizeClubRecord({
    clubId: payload?.clubId,
    name,
    tag,
    motto: clampText(payload?.motto, 80),
    description: clampText(payload?.description, CLUB_DESCRIPTION_MAX),
    branding: normalizeClubBranding(payload?.branding),
    visibility: 'public_apply',
    createdAt: now,
    updatedAt: now,
    prestige: {
      tier: 1,
      purchasedAt: now,
      history: [{
        tier: 1,
        purchasedAt: now,
        purchasedBy: owner.userId,
        treasuryCost: Math.max(0, safeInteger(normalizeClubConfig(clubConfig).createCost, 0)),
      }],
    },
    treasury: { balance: 0, lifetimeDonated: 0, donations: [] },
    treasuryGoal: null,
    progression: { totalXp: 0 },
    members: [{
      userId: owner.userId,
      role: 'owner',
      joinedAt: now,
      contributionXp: 0,
      coinContribution: 0,
      contribution: { matches: 0, wins: 0, columnClears: 0, rankedOrWager: 0 },
    }],
    joinRequests: [],
    invites: [],
    announcements: [],
    chat: [],
    processedResultIds: [],
    goals: {},
    events: {},
    rewards: { unlocked: [], memberClaims: {} },
  }, now, null, clubConfig);
  return { club };
}

export function findClubMember(club, userId) {
  return club?.members?.find(member => member.userId === userId) || null;
}

function roleRank(role) {
  if (role === 'owner') return 4;
  if (role === 'officer') return 3;
  if (role === 'member') return 2;
  if (role === 'rookie') return 1;
  return 0;
}

export function canManageRequests(role) {
  return roleRank(role) >= roleRank('officer');
}

export function canPostAnnouncement(role) {
  return roleRank(role) >= roleRank('officer');
}

export function canUpdateClub(role) {
  return role === 'owner';
}

export function canManageMember(actorRole, targetRole, nextRole = targetRole) {
  if (actorRole === 'owner') {
    if (nextRole === 'owner') return false;
    return targetRole !== 'owner';
  }
  if (actorRole === 'officer') {
    return roleRank(targetRole) < roleRank('officer') && roleRank(nextRole) < roleRank('officer');
  }
  return false;
}

function clubActivitySnapshot(club) {
  const weeklyMatches = Number(club.goals?.weekly?.items?.find(item => item.metric === 'matches')?.progress ?? 0) || 0;
  const seasonMatches = Number(club.goals?.season?.items?.find(item => item.metric === 'matches')?.progress ?? 0) || 0;
  return {
    weeklyMatches: Math.max(0, Math.floor(weeklyMatches)),
    seasonMatches: Math.max(0, Math.floor(seasonMatches)),
  };
}

export function publicClubPrestigeStatus(club, clubConfig = DEFAULT_CLUB_CONFIG) {
  const config = normalizeClubConfig(clubConfig || DEFAULT_CLUB_CONFIG);
  const current = prestigeTierFor(config, club.prestige?.tier || 1);
  const next = nextPrestigeTierFor(club, config);
  const activity = clubActivitySnapshot(club);
  if (!next) {
    return {
      current,
      next: null,
      maxed: true,
      eligible: false,
      treasuryNeeded: 0,
      requirements: [],
    };
  }
  const requirements = [
    {
      id: 'treasury',
      label: 'Treasury',
      current: club.treasury?.balance || 0,
      target: next.treasuryCost,
      complete: (club.treasury?.balance || 0) >= next.treasuryCost,
    },
    {
      id: 'clubLevel',
      label: 'Club level',
      current: club.progression?.level || 1,
      target: next.minClubLevel,
      complete: (club.progression?.level || 1) >= next.minClubLevel,
    },
    {
      id: 'members',
      label: 'Members',
      current: club.members?.length || 0,
      target: next.minMembers,
      complete: (club.members?.length || 0) >= next.minMembers,
    },
  ];
  if (next.minWeeklyMatches > 0) {
    requirements.push({
      id: 'weeklyMatches',
      label: 'Weekly activity',
      current: activity.weeklyMatches,
      target: next.minWeeklyMatches,
      complete: activity.weeklyMatches >= next.minWeeklyMatches,
    });
  }
  if (next.minSeasonMatches > 0) {
    requirements.push({
      id: 'seasonMatches',
      label: 'Season activity',
      current: activity.seasonMatches,
      target: next.minSeasonMatches,
      complete: activity.seasonMatches >= next.minSeasonMatches,
    });
  }
  return {
    current,
    next,
    maxed: false,
    eligible: requirements.every(item => item.complete),
    treasuryNeeded: Math.max(0, next.treasuryCost - (club.treasury?.balance || 0)),
    requirements,
  };
}

export function publicClubSummary(club, viewerUserId = null, now = Date.now(), rankedSeason = null, clubConfig = DEFAULT_CLUB_CONFIG, onlineUserIds = null) {
  const normalized = normalizeClubRecord(club, now, rankedSeason, clubConfig);
  const member = viewerUserId ? findClubMember(normalized, viewerUserId) : null;
  const prestige = publicClubPrestigeStatus(normalized, clubConfig);
  const online = onlineUserIds instanceof Set ? onlineUserIds : new Set();
  return {
    clubId: normalized.clubId,
    name: normalized.name,
    tag: normalized.tag,
    motto: normalized.motto,
    description: normalized.description,
    level: normalized.progression.level,
    memberCount: normalized.members.length,
    memberCap: normalized.progression.memberCap,
    onlineMemberCount: normalized.members.filter(item => online.has(item.userId)).length,
    role: member?.role ?? null,
    prestige: {
      tier: normalized.prestige.tier,
      name: prestige.current.name,
      memberCap: prestige.current.memberCap,
    },
    branding: normalized.branding,
    badge: {
      colorPair: normalized.branding.colorPair,
      shape: normalized.branding.badgeShape,
      bannerStyle: normalized.branding.bannerStyle,
    },
  };
}

function publicGoal(goal) {
  return {
    id: goal.id,
    templateId: goal.templateId,
    kind: goal.kind,
    title: goal.title,
    metric: goal.metric,
    target: goal.target,
    progress: Math.min(goal.target, goal.progress),
    reward: goal.reward,
    periodStart: goal.periodStart,
    expiresAt: goal.expiresAt,
    completedAt: goal.completedAt,
    claimedAt: goal.claimedAt,
    complete: goal.progress >= goal.target,
  };
}

function publicMember(club, users, member, onlineUserIds = null) {
  const user = users.get(member.userId);
  const online = onlineUserIds instanceof Set ? onlineUserIds.has(member.userId) : false;
  return {
    userId: member.userId,
    displayName: user?.displayName || 'Unknown Player',
    avatarInitial: (user?.displayName || '?').trim().slice(0, 1).toUpperCase(),
    role: member.role,
    joinedAt: member.joinedAt,
    contributionXp: member.contributionXp,
    coinContribution: member.coinContribution || 0,
    contribution: member.contribution,
    isOnline: online,
  };
}

function publicJoinRequest(users, request) {
  const user = users.get(request.userId);
  return {
    id: request.id,
    userId: request.userId,
    displayName: user?.displayName || 'Unknown Player',
    avatarInitial: (user?.displayName || '?').trim().slice(0, 1).toUpperCase(),
    createdAt: request.createdAt,
    message: request.message || '',
  };
}

export function publicClubRewards(club, viewerUserId = null) {
  const member = viewerUserId ? findClubMember(club, viewerUserId) : null;
  const memberClaims = viewerUserId ? club.rewards.memberClaims?.[viewerUserId] || [] : [];
  return CLUB_REWARD_CATALOG.map(reward => {
    const eligible = club.progression.level >= reward.minLevel
      && (reward.scope === 'club' || Number(member?.contributionXp ?? 0) >= Number(reward.minContributionXp ?? 0));
    const claimed = reward.scope === 'club'
      ? club.rewards.unlocked.includes(reward.id)
      : memberClaims.includes(reward.id);
    return {
      ...reward,
      eligible,
      claimed,
    };
  });
}

function publicDonationStats(club, users, viewerUserId = null) {
  const topDonors = club.members
    .filter(member => (member.coinContribution || 0) > 0)
    .map(member => ({
      userId: member.userId,
      displayName: users.get(member.userId)?.displayName || 'Unknown Player',
      amount: member.coinContribution || 0,
    }))
    .sort((a, b) => b.amount - a.amount || a.displayName.localeCompare(b.displayName))
    .slice(0, 10);
  return {
    topDonors,
    viewerDonated: viewerUserId ? findClubMember(club, viewerUserId)?.coinContribution || 0 : 0,
    recent: (club.treasury?.donations || []).slice(-10).reverse().map(item => ({
      id: item.id,
      userId: item.userId,
      displayName: users.get(item.userId)?.displayName || 'Unknown Player',
      amount: item.amount,
      createdAt: item.createdAt,
    })),
  };
}

export function publicClubProfile(club, users, viewerUserId, rankedSeason = null, now = Date.now(), clubConfig = DEFAULT_CLUB_CONFIG, onlineUserIds = null) {
  normalizeClubRecord(club, now, rankedSeason, clubConfig);
  const viewerMember = findClubMember(club, viewerUserId);
  const viewerRole = viewerMember?.role ?? null;
  const prestige = publicClubPrestigeStatus(club, clubConfig);
  const canPrestige = canManageRequests(viewerRole) && prestige.eligible && !prestige.maxed;
  return {
    ...publicClubSummary(club, viewerUserId, now, rankedSeason, clubConfig, onlineUserIds),
    createdAt: club.createdAt,
    updatedAt: club.updatedAt,
    progression: club.progression,
    treasury: {
      balance: club.treasury.balance,
      lifetimeDonated: club.treasury.lifetimeDonated,
    },
    treasuryGoal: club.treasuryGoal ? { ...club.treasuryGoal } : null,
    donationStats: publicDonationStats(club, users, viewerUserId),
    nextPrestige: prestige.maxed ? null : {
      tier: prestige.next.tier,
      name: prestige.next.name,
      treasuryCost: prestige.next.treasuryCost,
      memberCap: prestige.next.memberCap,
      perks: prestige.next.perks,
      requirements: prestige.requirements,
      treasuryNeeded: prestige.treasuryNeeded,
      eligible: prestige.eligible,
    },
    canPrestige,
    members: club.members.map(member => publicMember(club, users, member, onlineUserIds)),
    joinRequests: canManageRequests(viewerRole) ? club.joinRequests.map(request => publicJoinRequest(users, request)) : [],
    invites: canManageRequests(viewerRole) ? club.invites.map(invite => publicJoinRequest(users, invite)) : [],
    announcements: club.announcements.slice().reverse().map(item => ({
      ...item,
      userId: String(item.userId || item.authorUserId || 'club'),
      displayName: item.displayName || item.authorName || 'Club',
    })),
    goals: {
      weekly: club.goals.weekly.items.map(publicGoal),
      season: club.goals.season.items.map(publicGoal),
    },
    event: {
      ...club.events.active,
      leaderboardScore: club.events.active.score,
    },
    rewards: publicClubRewards(club, viewerUserId),
    chat: [],
    permissions: {
      canEdit: canUpdateClub(viewerRole),
      canManageRequests: canManageRequests(viewerRole),
      canPostAnnouncement: canPostAnnouncement(viewerRole),
      canManageMembers: roleRank(viewerRole) >= roleRank('officer'),
      canPrestige,
    },
  };
}

function goalDelta(goal, contribution) {
  switch (goal.metric) {
    case 'matches':
      return 1;
    case 'wins':
      return contribution.won ? 1 : 0;
    case 'columnClears':
      return contribution.columnClears;
    case 'rankedOrWager':
      return contribution.matchType === 'ranked' || contribution.matchType === 'wager' ? 1 : 0;
    default:
      return 0;
  }
}

function updateGoalItems(items, contribution, club) {
  const completed = [];
  for (const goal of items) {
    if (goal.claimedAt) continue;
    const delta = goalDelta(goal, contribution);
    if (!delta) continue;
    const wasComplete = !!goal.completedAt;
    goal.progress = Math.min(goal.target, goal.progress + delta);
    if (!wasComplete && goal.progress >= goal.target) {
      goal.completedAt = contribution.completedAt;
      club.progression.totalXp += Number(goal.reward?.clubXp ?? 0) || 0;
      completed.push(publicGoal(goal));
    }
  }
  return completed;
}

function eventScoreDelta(event, contribution) {
  switch (event.metric) {
    case 'lowTotalPoints':
      return Math.max(0, 60 - contribution.total);
    case 'columnClearPoints':
      return contribution.columnClears * 10;
    case 'rankedPoints':
      return contribution.matchType === 'ranked' ? 20 + (contribution.won ? 15 : 0) : 0;
    default:
      return contribution.won ? 10 : 3;
  }
}

export function applyClubMatchContribution(club, contribution, rankedSeason = null) {
  normalizeClubRecord(club, contribution.completedAt, rankedSeason);
  const processedKey = contribution.processedKey || contribution.resultId;
  if (!contribution.skipProcessedCheck && club.processedResultIds.includes(processedKey)) {
    return { skipped: true, reason: 'already_processed' };
  }

  const member = findClubMember(club, contribution.userId);
  if (!member) return { skipped: true, reason: 'not_member' };

  const matchXp = 120
    + (contribution.won ? 100 : 0)
    + (contribution.matchType === 'ranked' ? 80 : contribution.matchType === 'wager' ? 60 : 0)
    + (contribution.total <= 20 ? 50 : contribution.total <= 40 ? 25 : 0)
    + (contribution.columnClears * 45);

  club.progression.totalXp += matchXp;
  member.contributionXp += matchXp;
  member.contribution.matches += 1;
  member.contribution.wins += contribution.won ? 1 : 0;
  member.contribution.columnClears += contribution.columnClears;
  member.contribution.rankedOrWager += contribution.matchType === 'ranked' || contribution.matchType === 'wager' ? 1 : 0;

  const completedGoals = [
    ...updateGoalItems(club.goals.weekly.items, contribution, club),
    ...updateGoalItems(club.goals.season.items, contribution, club),
  ];

  const eventDelta = eventScoreDelta(club.events.active, contribution);
  if (eventDelta) {
    club.events.active.score += eventDelta;
    club.events.active.contributors[contribution.userId] = (club.events.active.contributors[contribution.userId] || 0) + eventDelta;
  }

  if (!contribution.skipProcessedRecord) {
    club.processedResultIds.push(processedKey);
    if (club.processedResultIds.length > CLUB_PROCESSED_RESULT_LIMIT) {
      club.processedResultIds.splice(0, club.processedResultIds.length - CLUB_PROCESSED_RESULT_LIMIT);
    }
  }
  club.updatedAt = contribution.completedAt;
  normalizeClubRecord(club, contribution.completedAt, rankedSeason);

  return {
    skipped: false,
    clubXpGained: matchXp,
    eventScoreGained: eventDelta,
    completedGoals,
    club: publicClubSummary(club, contribution.userId, contribution.completedAt, rankedSeason),
  };
}

export function donateToClubTreasury(user, club, amount, now = Date.now(), clubConfig = DEFAULT_CLUB_CONFIG) {
  normalizeClubRecord(club, now, null, clubConfig);
  const member = findClubMember(club, user.userId);
  if (!member) return { error: 'Join this club before donating.' };
  const safeAmount = Math.max(0, safeInteger(amount, 0));
  if (!safeAmount) return { error: 'Donation amount is required.' };
  user.currency ||= { coins: 0, lifetimeCoins: 0 };
  user.currency.coins = Math.max(0, safeInteger(user.currency.coins, 0));
  if (user.currency.coins < safeAmount) return { error: 'Not enough coins to donate.' };
  user.currency.coins -= safeAmount;
  club.treasury.balance += safeAmount;
  club.treasury.lifetimeDonated += safeAmount;
  member.coinContribution = (member.coinContribution || 0) + safeAmount;
  const donation = {
    id: crypto.randomUUID(),
    userId: user.userId,
    amount: safeAmount,
    createdAt: now,
  };
  club.treasury.donations.push(donation);
  club.treasury.donations = club.treasury.donations.slice(-CLUB_DONATION_LEDGER_LIMIT);
  club.updatedAt = now;
  return { donation, treasury: club.treasury };
}

export function setClubTreasuryGoal(user, club, payload = {}, now = Date.now()) {
  normalizeClubRecord(club, now);
  const member = findClubMember(club, user.userId);
  if (!member) return { error: 'Join this club before updating its treasury goal.' };
  if (!canManageRequests(member.role)) return { error: 'Only club owners and officers can update the treasury goal.' };
  const goal = normalizeClubTreasuryGoal({
    title: payload.title,
    description: payload.description,
    targetAmount: payload.targetAmount,
    createdBy: club.treasuryGoal?.createdBy || user.userId,
    createdAt: club.treasuryGoal?.createdAt || now,
    updatedAt: now,
  }, now);
  if (!goal) return { error: 'Treasury goal title and a positive target amount are required.' };
  club.treasuryGoal = goal;
  club.updatedAt = now;
  return { treasuryGoal: goal };
}

export function clearClubTreasuryGoal(user, club, now = Date.now()) {
  normalizeClubRecord(club, now);
  const member = findClubMember(club, user.userId);
  if (!member) return { error: 'Join this club before updating its treasury goal.' };
  if (!canManageRequests(member.role)) return { error: 'Only club owners and officers can update the treasury goal.' };
  club.treasuryGoal = null;
  club.updatedAt = now;
  return { treasuryGoal: null };
}

export function purchaseClubPrestige(user, club, clubConfig = DEFAULT_CLUB_CONFIG, now = Date.now()) {
  normalizeClubRecord(club, now, null, clubConfig);
  const member = findClubMember(club, user.userId);
  if (!member) return { error: 'Join this club before buying prestige.' };
  if (!canManageRequests(member.role)) return { error: 'Only club owners and officers can buy prestige.' };
  const status = publicClubPrestigeStatus(club, clubConfig);
  if (status.maxed) return { error: 'Club is already at the highest prestige tier.' };
  if (!status.eligible) {
    const missing = status.requirements.filter(item => !item.complete).map(item => item.label).join(', ');
    return { error: `Prestige requirements are not met yet: ${missing}.`, nextPrestige: status };
  }
  if (club.treasury.balance < status.next.treasuryCost) return { error: 'Club treasury does not have enough coins yet.', nextPrestige: status };
  club.treasury.balance -= status.next.treasuryCost;
  club.prestige.tier = status.next.tier;
  club.prestige.purchasedAt = now;
  club.prestige.history.push({
    tier: status.next.tier,
    purchasedAt: now,
    purchasedBy: user.userId,
    treasuryCost: status.next.treasuryCost,
  });
  club.prestige.history = club.prestige.history.slice(-20);
  club.updatedAt = now;
  normalizeClubRecord(club, now, null, clubConfig);
  return { prestige: club.prestige, treasury: club.treasury };
}

export function syncClubRewards(club, users, now = Date.now()) {
  normalizeClubRecord(club, now);
  const userMap = users instanceof Map
    ? users
    : new Map((Array.isArray(users) ? users : []).filter(Boolean).map(user => [user.userId, user]));
  const clubRewards = [];
  const memberRewards = [];
  let changed = false;

  for (const reward of CLUB_REWARD_CATALOG) {
    if (club.progression.level < reward.minLevel) continue;
    if (reward.scope === 'club') {
      if (!club.rewards.unlocked.includes(reward.id)) {
        club.rewards.unlocked.push(reward.id);
        clubRewards.push(reward.id);
        changed = true;
      }
      continue;
    }

    for (const member of club.members) {
      if (Number(member.contributionXp || 0) < Number(reward.minContributionXp || 0)) continue;
      const user = userMap.get(member.userId);
      if (!user) continue;
      club.rewards.memberClaims[member.userId] ||= [];
      if (club.rewards.memberClaims[member.userId].includes(reward.id)) continue;
      user.inventory ||= {};
      user.inventory.cosmetics ||= [];
      if (reward.cosmeticId && !user.inventory.cosmetics.includes(reward.cosmeticId)) {
        user.inventory.cosmetics.push(reward.cosmeticId);
      }
      club.rewards.memberClaims[member.userId].push(reward.id);
      memberRewards.push({ userId: member.userId, rewardId: reward.id, cosmeticId: reward.cosmeticId || null });
      changed = true;
    }
  }

  if (changed) club.updatedAt = now;
  return { changed, clubRewards, memberRewards };
}

export function claimClubReward(user, club, rewardId, now = Date.now()) {
  normalizeClubRecord(club, now);
  const reward = CLUB_REWARD_CATALOG.find(item => item.id === rewardId);
  if (!reward) return { error: 'Club reward not found.' };
  const member = findClubMember(club, user.userId);
  if (!member) return { error: 'You are not in this club.' };
  if (club.progression.level < reward.minLevel) return { error: 'Club level is not high enough yet.' };

  if (reward.scope === 'member' && member.contributionXp < Number(reward.minContributionXp || 0)) {
    return { error: 'Contribute more to earn this member reward.' };
  }
  const wasClaimed = reward.scope === 'club'
    ? club.rewards.unlocked.includes(reward.id)
    : (club.rewards.memberClaims[user.userId] || []).includes(reward.id);
  syncClubRewards(club, new Map([[user.userId, user]]), now);
  return {
    reward: { ...reward, eligible: true, claimed: true },
    granted: reward.scope === 'member' ? reward.cosmeticId || null : null,
    alreadyClaimed: wasClaimed,
  };
}
