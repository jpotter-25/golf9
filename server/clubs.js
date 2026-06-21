// clubs.js
// Purpose: Club persistence helpers, permissions, progression, goals, events, and rewards.

const DAY_MS = 24 * 60 * 60 * 1000;
const CLUB_LEVEL_THRESHOLDS = [
  0, 1500, 3500, 6500, 10000, 14500, 19500, 25000, 31500, 39000, 47500, 57000,
];
const CLUB_CHAT_HISTORY_LIMIT = 80;
const CLUB_ANNOUNCEMENT_LIMIT = 20;
const CLUB_PROCESSED_RESULT_LIMIT = 500;

export const CLUB_ROLES = ['owner', 'officer', 'member', 'rookie'];

export const CLUB_BRANDING = {
  colorPairs: ['emerald', 'gold', 'sky', 'crimson', 'violet'],
  badgeShapes: ['shield', 'crest', 'diamond', 'circle'],
  bannerStyles: ['classic', 'night', 'fairway', 'champion'],
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

export function normalizeClubTag(value) {
  return String(value || '')
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase()
    .slice(0, 5);
}

function safePreset(value, allowed, fallback) {
  const raw = String(value || '').trim();
  return allowed.includes(raw) ? raw : fallback;
}

export function normalizeClubBranding(input = {}) {
  return {
    colorPair: safePreset(input.colorPair, CLUB_BRANDING.colorPairs, CLUB_BRANDING.colorPairs[0]),
    badgeShape: safePreset(input.badgeShape, CLUB_BRANDING.badgeShapes, CLUB_BRANDING.badgeShapes[0]),
    bannerStyle: safePreset(input.bannerStyle, CLUB_BRANDING.bannerStyles, CLUB_BRANDING.bannerStyles[0]),
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

export function clubProgressionSnapshot(totalXp = 0) {
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
    memberCap: memberCapForLevel(level),
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

export function normalizeClubRecord(club, now = Date.now(), rankedSeason = null) {
  const progression = clubProgressionSnapshot(club.progression?.totalXp ?? club.totalXp ?? 0);
  const memberCap = progression.memberCap;
  club.clubId = String(club.clubId || club.id || '');
  club.name = clampText(club.name, 28) || 'Golf Club';
  club.tag = normalizeClubTag(club.tag) || 'CLUB';
  club.motto = clampText(club.motto, 80);
  club.visibility = 'public_apply';
  club.branding = normalizeClubBranding(club.branding);
  club.createdAt = Number(club.createdAt || now) || now;
  club.updatedAt = Number(club.updatedAt || club.createdAt) || club.createdAt;
  club.progression = progression;
  club.members = Array.isArray(club.members) ? club.members : [];
  club.members = club.members
    .filter(member => member?.userId)
    .map(member => ({
      userId: String(member.userId),
      role: CLUB_ROLES.includes(member.role) ? member.role : 'rookie',
      joinedAt: Number(member.joinedAt || now) || now,
      contributionXp: Math.max(0, Math.floor(Number(member.contributionXp ?? 0) || 0)),
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
  club.chat = Array.isArray(club.chat) ? club.chat.slice(-CLUB_CHAT_HISTORY_LIMIT) : [];
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

export function createClubRecord(owner, payload, now = Date.now()) {
  const name = clampText(payload?.name, 28);
  const tag = normalizeClubTag(payload?.tag);
  if (name.length < 3) return { error: 'Club name must be at least 3 characters.' };
  if (tag.length < 2) return { error: 'Club tag must be 2 to 5 letters or numbers.' };
  const club = normalizeClubRecord({
    clubId: payload?.clubId,
    name,
    tag,
    motto: clampText(payload?.motto, 80),
    branding: normalizeClubBranding(payload?.branding),
    visibility: 'public_apply',
    createdAt: now,
    updatedAt: now,
    progression: { totalXp: 0 },
    members: [{
      userId: owner.userId,
      role: 'owner',
      joinedAt: now,
      contributionXp: 0,
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
  }, now);
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

export function publicClubSummary(club, viewerUserId = null, now = Date.now(), rankedSeason = null) {
  const normalized = normalizeClubRecord(club, now, rankedSeason);
  const member = viewerUserId ? findClubMember(normalized, viewerUserId) : null;
  return {
    clubId: normalized.clubId,
    name: normalized.name,
    tag: normalized.tag,
    motto: normalized.motto,
    level: normalized.progression.level,
    memberCount: normalized.members.length,
    memberCap: normalized.progression.memberCap,
    role: member?.role ?? null,
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

function publicMember(club, users, member) {
  const user = users.get(member.userId);
  return {
    userId: member.userId,
    displayName: user?.displayName || 'Unknown Player',
    avatarInitial: (user?.displayName || '?').trim().slice(0, 1).toUpperCase(),
    role: member.role,
    joinedAt: member.joinedAt,
    contributionXp: member.contributionXp,
    contribution: member.contribution,
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

export function publicClubProfile(club, users, viewerUserId, rankedSeason = null, now = Date.now()) {
  normalizeClubRecord(club, now, rankedSeason);
  const viewerMember = findClubMember(club, viewerUserId);
  const viewerRole = viewerMember?.role ?? null;
  return {
    ...publicClubSummary(club, viewerUserId, now, rankedSeason),
    createdAt: club.createdAt,
    updatedAt: club.updatedAt,
    progression: club.progression,
    members: club.members.map(member => publicMember(club, users, member)),
    joinRequests: canManageRequests(viewerRole) ? club.joinRequests.map(request => publicJoinRequest(users, request)) : [],
    invites: canManageRequests(viewerRole) ? club.invites.map(invite => publicJoinRequest(users, invite)) : [],
    announcements: club.announcements.slice().reverse(),
    goals: {
      weekly: club.goals.weekly.items.map(publicGoal),
      season: club.goals.season.items.map(publicGoal),
    },
    event: {
      ...club.events.active,
      leaderboardScore: club.events.active.score,
    },
    rewards: publicClubRewards(club, viewerUserId),
    chat: club.chat.slice(-CLUB_CHAT_HISTORY_LIMIT),
    permissions: {
      canEdit: canUpdateClub(viewerRole),
      canManageRequests: canManageRequests(viewerRole),
      canPostAnnouncement: canPostAnnouncement(viewerRole),
      canManageMembers: roleRank(viewerRole) >= roleRank('officer'),
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

export function appendClubChatMessage(club, message) {
  club.chat ||= [];
  club.chat.push(message);
  if (club.chat.length > CLUB_CHAT_HISTORY_LIMIT) club.chat.splice(0, club.chat.length - CLUB_CHAT_HISTORY_LIMIT);
}

export function claimClubReward(user, club, rewardId, now = Date.now()) {
  normalizeClubRecord(club, now);
  const reward = CLUB_REWARD_CATALOG.find(item => item.id === rewardId);
  if (!reward) return { error: 'Club reward not found.' };
  const member = findClubMember(club, user.userId);
  if (!member) return { error: 'You are not in this club.' };
  if (club.progression.level < reward.minLevel) return { error: 'Club level is not high enough yet.' };

  if (reward.scope === 'club') {
    if (club.rewards.unlocked.includes(reward.id)) return { error: 'Club reward already unlocked.' };
    if (member.role !== 'owner' && member.role !== 'officer') return { error: 'Only club officers can claim shared club rewards.' };
    club.rewards.unlocked.push(reward.id);
    club.updatedAt = now;
    return { reward: { ...reward, eligible: true, claimed: true }, granted: null };
  }

  if (member.contributionXp < Number(reward.minContributionXp || 0)) return { error: 'Contribute more to claim this member reward.' };
  club.rewards.memberClaims[user.userId] ||= [];
  if (club.rewards.memberClaims[user.userId].includes(reward.id)) return { error: 'Member reward already claimed.' };
  user.inventory ||= {};
  user.inventory.cosmetics ||= [];
  if (reward.cosmeticId && !user.inventory.cosmetics.includes(reward.cosmeticId)) {
    user.inventory.cosmetics.push(reward.cosmeticId);
  }
  club.rewards.memberClaims[user.userId].push(reward.id);
  club.updatedAt = now;
  return { reward: { ...reward, eligible: true, claimed: true }, granted: reward.cosmeticId || null };
}
