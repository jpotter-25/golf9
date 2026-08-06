const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const ONLINE_MATCH_TYPES = new Set(['casual', 'wager', 'ranked']);

export const LEADERBOARD_SCOPES = Object.freeze(['individual', 'clubs', 'club_members']);
export const LEADERBOARD_PERIODS = Object.freeze(['weekly', 'seasonal', 'all_time']);

export const LEADERBOARD_SCORING = Object.freeze({
  label: 'Leaderboard Points',
  abbreviation: 'LP',
  onlineOnly: true,
  rules: Object.freeze([
    '100 LP for completing an online match.',
    '100 bonus LP for a win.',
    'Up to 60 bonus LP for a low final total.',
    '50 bonus LP for Ranked or 25 bonus LP for a Wager table.',
    'Forfeits and offline matches award no LP.',
  ]),
});

function values(source) {
  if (source instanceof Map) return [...source.values()];
  return Array.isArray(source) ? source : [];
}
function safeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

export function utcLeaderboardWeekStart(now = Date.now()) {
  const date = new Date(now);
  const dayStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  return dayStart - (mondayOffset * DAY_MS);
}

export function leaderboardPeriodWindow(period = 'weekly', season = null, now = Date.now()) {
  const key = LEADERBOARD_PERIODS.includes(period) ? period : 'weekly';
  if (key === 'all_time') {
    return { key, label: 'All Time', startsAt: null, endsAt: null };
  }
  if (key === 'seasonal') {
    return {
      key,
      label: safeText(season?.name, 'Current Season'),
      startsAt: Math.max(0, safeInteger(season?.startsAt, 0)) || null,
      endsAt: Math.max(0, safeInteger(season?.endsAt, 0)) || null,
    };
  }
  const startsAt = utcLeaderboardWeekStart(now);
  return { key, label: 'This Week', startsAt, endsAt: startsAt + WEEK_MS };
}

function resultInWindow(result, window) {
  const completedAt = safeInteger(result?.completedAt, 0);
  if (!completedAt) return false;
  if (window.startsAt != null && completedAt < window.startsAt) return false;
  if (window.endsAt != null && completedAt >= window.endsAt) return false;
  return true;
}

function isEligibleOnlineResult(result) {
  return result?.mode === 'online' && ONLINE_MATCH_TYPES.has(String(result?.matchType || ''));
}

function lowTotalBonus(total) {
  return Math.max(0, Math.min(60, 60 - safeInteger(total, 60)));
}

export function leaderboardPointsForPlayer(result, player) {
  if (!isEligibleOnlineResult(result) || !player || player.forfeited) return 0;
  const persisted = Number(player.leaderboard?.points);
  if (Number.isFinite(persisted) && persisted >= 0) return Math.floor(persisted);
  const tableBonus = result.matchType === 'ranked' ? 50 : result.matchType === 'wager' ? 25 : 0;
  return 100 + (player.won ? 100 : 0) + lowTotalBonus(player.total) + tableBonus;
}

export function leaderboardClubIdForPlayer(player) {
  return safeText(
    player?.leaderboard?.clubId
      || player?.progression?.club?.club?.clubId,
    '',
  ) || null;
}

function emptyAggregate(id, name) {
  return {
    id,
    name,
    score: 0,
    wins: 0,
    matches: 0,
    totalSum: 0,
    bestTotal: null,
  };
}

function applyPlayerResult(entry, result, player) {
  const points = leaderboardPointsForPlayer(result, player);
  if (!points) return false;
  const total = safeInteger(player.total, 0);
  entry.score += points;
  entry.wins += player.won ? 1 : 0;
  entry.matches += 1;
  entry.totalSum += total;
  entry.bestTotal = entry.bestTotal == null ? total : Math.min(entry.bestTotal, total);
  return true;
}

function averageTotal(entry) {
  return entry.matches ? Math.round((entry.totalSum / entry.matches) * 10) / 10 : null;
}

function compareEntries(a, b) {
  return b.score - a.score
    || b.wins - a.wins
    || b.matches - a.matches
    || (averageTotal(a) ?? Number.POSITIVE_INFINITY) - (averageTotal(b) ?? Number.POSITIVE_INFINITY)
    || a.name.localeCompare(b.name);
}

function rankedEntries(entries) {
  return entries.sort(compareEntries).map((entry, index) => ({
    ...entry,
    rank: index + 1,
    averageTotal: averageTotal(entry),
    winRate: entry.matches ? Math.round((entry.wins / entry.matches) * 100) : 0,
  }));
}

function publicUserEntry(entry, user, club, member = null) {
  return {
    rank: entry.rank ?? null,
    userId: user.userId,
    displayName: safeText(user.displayName, 'Unknown Player'),
    avatarInitial: safeText(user.displayName, '?').slice(0, 1).toUpperCase(),
    score: entry.score,
    wins: entry.wins,
    matches: entry.matches,
    winRate: entry.winRate ?? 0,
    averageTotal: entry.averageTotal ?? null,
    bestTotal: entry.bestTotal,
    club: club ? {
      clubId: club.clubId,
      name: club.name,
      tag: club.tag,
    } : null,
    role: member?.role ?? null,
  };
}

function publicClubEntry(entry, club) {
  return {
    rank: entry.rank ?? null,
    clubId: club.clubId,
    name: club.name,
    tag: club.tag,
    score: entry.score,
    wins: entry.wins,
    matches: entry.matches,
    winRate: entry.winRate ?? 0,
    averageTotal: entry.averageTotal ?? null,
    bestTotal: entry.bestTotal,
    level: Math.max(1, safeInteger(club.progression?.level ?? club.level, 1)),
    memberCount: Array.isArray(club.members) ? club.members.length : Math.max(0, safeInteger(club.memberCount, 0)),
    branding: club.branding || null,
  };
}

function seasonSummary(season) {
  return season ? {
    id: safeText(season.id, ''),
    name: safeText(season.name, 'Current Season'),
    startsAt: Math.max(0, safeInteger(season.startsAt, 0)) || null,
    endsAt: Math.max(0, safeInteger(season.endsAt, 0)) || null,
  } : null;
}

function baseResponse(scope, window, season, now) {
  return {
    scope,
    period: window,
    season: seasonSummary(season),
    generatedAt: now,
    scoring: LEADERBOARD_SCORING,
  };
}

export function buildLeaderboard({
  scope = 'individual',
  period = 'weekly',
  users = [],
  clubs = [],
  results = [],
  viewerUserId = null,
  season = null,
  now = Date.now(),
  limit = 100,
  isUserVisible = () => true,
} = {}) {
  const safeScope = LEADERBOARD_SCOPES.includes(scope) ? scope : 'individual';
  const window = leaderboardPeriodWindow(period, season, now);
  const userMap = new Map(values(users).filter(user => user?.userId).map(user => [String(user.userId), user]));
  const clubMap = new Map(values(clubs).filter(club => club?.clubId).map(club => [String(club.clubId), club]));
  const viewer = userMap.get(String(viewerUserId || '')) || null;
  const viewerClub = viewer?.clubId ? clubMap.get(String(viewer.clubId)) || null : null;
  const aggregates = new Map();

  if (safeScope === 'clubs') {
    for (const club of clubMap.values()) aggregates.set(club.clubId, emptyAggregate(club.clubId, safeText(club.name, 'Unknown Club')));
  } else if (safeScope === 'club_members' && viewerClub) {
    for (const member of viewerClub.members || []) {
      const user = userMap.get(String(member.userId));
      if (!user || !isUserVisible(user)) continue;
      aggregates.set(user.userId, emptyAggregate(user.userId, safeText(user.displayName, 'Unknown Player')));
    }
  }

  for (const result of results) {
    if (!isEligibleOnlineResult(result) || !resultInWindow(result, window)) continue;
    for (const player of result.players || []) {
      const user = userMap.get(String(player?.userId || ''));
      if (!user || !isUserVisible(user)) continue;
      let aggregateId = user.userId;
      if (safeScope === 'clubs' || safeScope === 'club_members') {
        const attributedClubId = leaderboardClubIdForPlayer(player);
        if (!attributedClubId) continue;
        if (safeScope === 'clubs') aggregateId = attributedClubId;
        else if (viewerClub && attributedClubId === viewerClub.clubId && aggregates.has(user.userId)) aggregateId = user.userId;
        else continue;
      }
      if (!aggregates.has(aggregateId)) {
        const name = safeScope === 'clubs'
          ? safeText(clubMap.get(aggregateId)?.name, 'Unknown Club')
          : safeText(user.displayName, 'Unknown Player');
        aggregates.set(aggregateId, emptyAggregate(aggregateId, name));
      }
      applyPlayerResult(aggregates.get(aggregateId), result, player);
    }
  }

  let ranked = rankedEntries([...aggregates.values()]
    .filter(entry => safeScope !== 'individual' || entry.score > 0)
    .filter(entry => safeScope !== 'clubs' || clubMap.has(entry.id)));

  const viewerTargetId = safeScope === 'clubs' ? viewerClub?.clubId : viewer?.userId;
  const viewerRanked = viewerTargetId ? ranked.find(entry => entry.id === viewerTargetId) || null : null;
  const selected = ranked.slice(0, Math.max(1, Math.min(100, safeInteger(limit, 100))));

  const response = baseResponse(safeScope, window, season, now);
  if (safeScope === 'clubs') {
    return {
      ...response,
      subject: null,
      entries: selected.map(entry => publicClubEntry(entry, clubMap.get(entry.id))),
      viewer: viewerRanked && viewerClub ? publicClubEntry(viewerRanked, viewerClub) : null,
    };
  }

  const subject = safeScope === 'club_members' && viewerClub ? {
    clubId: viewerClub.clubId,
    name: viewerClub.name,
    tag: viewerClub.tag,
    branding: viewerClub.branding || null,
  } : null;
  const publicEntry = entry => {
    const user = userMap.get(entry.id);
    const currentClub = user?.clubId ? clubMap.get(String(user.clubId)) || null : null;
    const member = viewerClub?.members?.find(item => String(item.userId) === entry.id) || null;
    return publicUserEntry(entry, user, currentClub, safeScope === 'club_members' ? member : null);
  };
  return {
    ...response,
    subject,
    entries: selected.map(publicEntry),
    viewer: viewerRanked ? publicEntry(viewerRanked) : viewer && isUserVisible(viewer)
      ? publicUserEntry({ ...emptyAggregate(viewer.userId, viewer.displayName), rank: null, averageTotal: null, winRate: 0 }, viewer, viewerClub)
      : null,
  };
}
