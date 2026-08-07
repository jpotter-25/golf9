const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export const CLUB_STANDING_PERIODS = Object.freeze(['weekly', 'seasonal', 'all_time']);

export const CLUB_STANDING_CRITERIA = Object.freeze({
  key: 'ranked_victories',
  label: 'Ranked Victories',
  matchType: 'ranked',
  rules: Object.freeze([
    'Each winning member contributes one victory to their club.',
    'Tied winners each contribute one victory.',
    'Forfeited and AFK-penalized results cannot contribute victories.',
    'Club membership is recorded when the Ranked match begins.',
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

export function utcClubStandingWeekStart(now = Date.now()) {
  const date = new Date(now);
  const dayStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  return dayStart - (mondayOffset * DAY_MS);
}

export function clubStandingPeriodWindow(period = 'weekly', season = null, now = Date.now()) {
  const key = CLUB_STANDING_PERIODS.includes(period) ? period : 'weekly';
  if (key === 'all_time') return { key, label: 'All Time', startsAt: null, endsAt: null };
  if (key === 'seasonal') {
    return {
      key,
      label: safeText(season?.name, 'Current Season'),
      startsAt: Math.max(0, safeInteger(season?.startsAt, 0)) || null,
      endsAt: Math.max(0, safeInteger(season?.endsAt, 0)) || null,
    };
  }
  const startsAt = utcClubStandingWeekStart(now);
  return { key, label: 'This Week', startsAt, endsAt: startsAt + WEEK_MS };
}

function resultInWindow(result, window) {
  const completedAt = safeInteger(result?.completedAt, 0);
  if (!completedAt) return false;
  if (window.startsAt != null && completedAt < window.startsAt) return false;
  if (window.endsAt != null && completedAt >= window.endsAt) return false;
  return true;
}

function isRankedResult(result) {
  return result?.mode === 'online' && result?.matchType === 'ranked';
}

export function clubIdForStandingPlayer(player) {
  return safeText(
    player?.clubIdAtMatchStart
      || player?.leaderboard?.clubId
      || player?.progression?.club?.club?.clubId,
    '',
  ) || null;
}

export function isEligibleClubVictory(player) {
  return !!player?.won
    && !player?.forfeited
    && !player?.afk?.penaltyApplied
    && !player?.afk?.forcedRankedLast;
}

function emptyAggregate(clubId, name) {
  return { clubId, name, victories: 0, rankedResults: 0 };
}

function compareAggregates(a, b) {
  return b.victories - a.victories || a.name.localeCompare(b.name) || a.clubId.localeCompare(b.clubId);
}

function rankAggregates(entries) {
  let previousVictories = null;
  let sharedRank = null;
  return entries.sort(compareAggregates).map((entry, index) => {
    if (entry.victories !== previousVictories) {
      sharedRank = index + 1;
      previousVictories = entry.victories;
    }
    return { ...entry, rank: sharedRank };
  });
}

function publicClubStanding(entry, club) {
  const rankedResults = Math.max(0, safeInteger(entry.rankedResults, 0));
  const victories = Math.max(0, safeInteger(entry.victories, 0));
  return {
    rank: entry.rank ?? null,
    clubId: club.clubId,
    name: club.name,
    tag: club.tag,
    victories,
    rankedResults,
    losses: Math.max(0, rankedResults - victories),
    winRate: rankedResults ? Math.round((victories / rankedResults) * 100) : 0,
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

export function buildClubStandings({
  period = 'weekly',
  clubs = [],
  results = [],
  viewerClubId = null,
  season = null,
  now = Date.now(),
  limit = 100,
} = {}) {
  const window = clubStandingPeriodWindow(period, season, now);
  const clubMap = new Map(values(clubs).filter(club => club?.clubId).map(club => [String(club.clubId), club]));
  const aggregates = new Map();
  const processedPlayers = new Set();

  for (const result of results) {
    if (!isRankedResult(result) || !resultInWindow(result, window)) continue;
    for (const player of result.players || []) {
      const clubId = clubIdForStandingPlayer(player);
      if (!clubId || !clubMap.has(clubId)) continue;
      const playerKey = `${safeText(result.resultId, String(result.completedAt || 'result'))}:${safeText(player.userId, player.displayName)}`;
      if (processedPlayers.has(playerKey)) continue;
      processedPlayers.add(playerKey);
      if (!aggregates.has(clubId)) {
        aggregates.set(clubId, emptyAggregate(clubId, safeText(clubMap.get(clubId)?.name, 'Unknown Club')));
      }
      const aggregate = aggregates.get(clubId);
      aggregate.rankedResults += 1;
      if (isEligibleClubVictory(player)) aggregate.victories += 1;
    }
  }

  const ranked = rankAggregates([...aggregates.values()].filter(entry => entry.rankedResults > 0));
  const normalizedLimit = Math.max(1, Math.min(100, safeInteger(limit, 100)));
  const entries = ranked.slice(0, normalizedLimit).map(entry => publicClubStanding(entry, clubMap.get(entry.clubId)));
  const viewerClub = viewerClubId ? clubMap.get(String(viewerClubId)) || null : null;
  const viewerRanked = viewerClub ? ranked.find(entry => entry.clubId === viewerClub.clubId) || null : null;
  const viewer = viewerRanked && viewerClub
    ? publicClubStanding(viewerRanked, viewerClub)
    : viewerClub
      ? publicClubStanding({ ...emptyAggregate(viewerClub.clubId, viewerClub.name), rank: null }, viewerClub)
      : null;

  return {
    period: window,
    season: seasonSummary(season),
    generatedAt: now,
    criteria: CLUB_STANDING_CRITERIA,
    entries,
    viewer,
  };
}
