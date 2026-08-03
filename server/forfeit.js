const HOUR_MS = 60 * 60 * 1000;
const MAX_EVENT_HISTORY = 100;

export const DEFAULT_FORFEIT_CONFIG = Object.freeze({
  enabled: true,
  rankedRollingWindowHours: 24,
  rankedRollingLockMinutes: [15, 120, 1440],
  rankedSeasonLockSteps: [
    { count: 5, durationHours: 72, untilSeasonEnd: false },
    { count: 8, durationHours: 168, untilSeasonEnd: false },
    { count: 12, durationHours: 0, untilSeasonEnd: true },
  ],
});

function integer(value, fallback, min, max) {
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function timestamp(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
}

function normalizeLockMinutes(input) {
  const source = Array.isArray(input) ? input : DEFAULT_FORFEIT_CONFIG.rankedRollingLockMinutes;
  const values = source
    .slice(0, 20)
    .map(value => integer(value, 0, 0, 60 * 24 * 365));
  return values.length ? values : [...DEFAULT_FORFEIT_CONFIG.rankedRollingLockMinutes];
}

function normalizeSeasonSteps(input) {
  const source = Array.isArray(input) ? input : DEFAULT_FORFEIT_CONFIG.rankedSeasonLockSteps;
  const byCount = new Map();
  for (const item of source.slice(0, 20)) {
    const count = integer(item?.count, 0, 1, 10_000);
    if (!count) continue;
    byCount.set(count, {
      count,
      durationHours: integer(item?.durationHours, 0, 0, 24 * 365),
      untilSeasonEnd: item?.untilSeasonEnd === true,
    });
  }
  const values = [...byCount.values()].sort((a, b) => a.count - b.count);
  return values.length ? values : DEFAULT_FORFEIT_CONFIG.rankedSeasonLockSteps.map(item => ({ ...item }));
}

export function normalizeForfeitConfig(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    enabled: source.enabled !== false,
    rankedRollingWindowHours: integer(
      source.rankedRollingWindowHours,
      DEFAULT_FORFEIT_CONFIG.rankedRollingWindowHours,
      1,
      24 * 90
    ),
    rankedRollingLockMinutes: normalizeLockMinutes(source.rankedRollingLockMinutes),
    rankedSeasonLockSteps: normalizeSeasonSteps(source.rankedSeasonLockSteps),
  };
}

export function normalizeForfeitDiscipline(user) {
  const source = user.forfeitDiscipline && typeof user.forfeitDiscipline === 'object'
    ? user.forfeitDiscipline
    : {};
  const events = (Array.isArray(source.events) ? source.events : [])
    .filter(item => item?.eventId && item?.matchId && item?.settledAt)
    .map(item => ({
      eventId: String(item.eventId),
      matchId: String(item.matchId),
      roomCode: item.roomCode ? String(item.roomCode) : null,
      matchType: ['casual', 'wager', 'ranked'].includes(item.matchType) ? item.matchType : 'casual',
      seasonId: item.seasonId ? String(item.seasonId) : null,
      confirmedAt: timestamp(item.confirmedAt) || timestamp(item.settledAt),
      settledAt: timestamp(item.settledAt),
      restrictionEndsAt: timestamp(item.restrictionEndsAt),
    }))
    .filter(item => item.settledAt)
    .sort((a, b) => b.settledAt - a.settledAt)
    .slice(0, MAX_EVENT_HISTORY);
  user.forfeitDiscipline = {
    events,
    rankedLockedUntil: timestamp(source.rankedLockedUntil),
    updatedAt: timestamp(source.updatedAt),
  };
  return user.forfeitDiscipline;
}

function currentSeasonEvents(discipline, season) {
  return discipline.events.filter(event => (
    event.matchType === 'ranked'
    && event.seasonId
    && event.seasonId === season?.id
  ));
}

function rollingRankedEvents(discipline, now, config) {
  const start = now - (config.rankedRollingWindowHours * HOUR_MS);
  return discipline.events.filter(event => event.matchType === 'ranked' && event.settledAt >= start);
}

export function publicForfeitStatus(user, season, inputConfig = {}, now = Date.now()) {
  const config = normalizeForfeitConfig(inputConfig);
  const discipline = normalizeForfeitDiscipline(user);
  const rankedLockedUntil = discipline.rankedLockedUntil && discipline.rankedLockedUntil > now
    ? discipline.rankedLockedUntil
    : null;
  return {
    ranked: {
      restricted: config.enabled && !!rankedLockedUntil,
      lockedUntil: rankedLockedUntil,
      rollingWindowHours: config.rankedRollingWindowHours,
      rollingCount: rollingRankedEvents(discipline, now, config).length,
      seasonId: season?.id || null,
      seasonCount: currentSeasonEvents(discipline, season).length,
    },
  };
}

function rollingLockUntil(discipline, now, config) {
  const count = rollingRankedEvents(discipline, now, config).length;
  if (!count || !config.rankedRollingLockMinutes.length) return null;
  const index = Math.min(count, config.rankedRollingLockMinutes.length) - 1;
  const minutes = config.rankedRollingLockMinutes[index];
  return minutes > 0 ? now + (minutes * 60 * 1000) : null;
}

function seasonLockUntil(discipline, season, now, config) {
  const count = currentSeasonEvents(discipline, season).length;
  let until = null;
  for (const step of config.rankedSeasonLockSteps) {
    if (count < step.count) continue;
    const candidate = step.untilSeasonEnd
      ? timestamp(season?.endsAt)
      : step.durationHours > 0
        ? now + (step.durationHours * HOUR_MS)
        : null;
    if (candidate && candidate > now) until = Math.max(until || 0, candidate);
  }
  return until;
}

export function recordForfeitSettlement(user, event, season, inputConfig = {}, now = Date.now()) {
  const config = normalizeForfeitConfig(inputConfig);
  const discipline = normalizeForfeitDiscipline(user);
  const matchId = String(event?.matchId || '');
  const existing = discipline.events.find(item => item.matchId === matchId);
  if (existing) return { duplicate: true, event: existing, status: publicForfeitStatus(user, season, config, now) };

  const record = {
    eventId: String(event?.eventId || matchId),
    matchId,
    roomCode: event?.roomCode ? String(event.roomCode) : null,
    matchType: ['casual', 'wager', 'ranked'].includes(event?.matchType) ? event.matchType : 'casual',
    seasonId: event?.seasonId ? String(event.seasonId) : null,
    confirmedAt: timestamp(event?.confirmedAt) || now,
    settledAt: now,
    restrictionEndsAt: null,
  };
  discipline.events.unshift(record);
  discipline.events = discipline.events.slice(0, MAX_EVENT_HISTORY);

  if (config.enabled && record.matchType === 'ranked') {
    const candidates = [
      discipline.rankedLockedUntil,
      rollingLockUntil(discipline, now, config),
      seasonLockUntil(discipline, season, now, config),
    ].filter(value => value && value > now);
    discipline.rankedLockedUntil = candidates.length ? Math.max(...candidates) : null;
    record.restrictionEndsAt = discipline.rankedLockedUntil;
  }
  discipline.updatedAt = now;
  return { duplicate: false, event: record, status: publicForfeitStatus(user, season, config, now) };
}

export function setRankedForfeitRestriction(user, lockedUntil, now = Date.now()) {
  const discipline = normalizeForfeitDiscipline(user);
  const next = timestamp(lockedUntil);
  discipline.rankedLockedUntil = next && next > now ? next : null;
  discipline.updatedAt = now;
  return discipline.rankedLockedUntil;
}

export function resetForfeitDiscipline(user, now = Date.now()) {
  const discipline = normalizeForfeitDiscipline(user);
  discipline.events = [];
  discipline.rankedLockedUntil = null;
  discipline.updatedAt = now;
  return discipline;
}

export function placementsWithMatchPenalties(totals, afkFlags = [], forfeitFlags = []) {
  return totals.map((rawTotal, index) => {
    if (forfeitFlags[index]) return totals.length;
    const tier = forfeitFlags[index] ? 2 : afkFlags[index] ? 1 : 0;
    const total = Number(rawTotal) || 0;
    const ahead = totals.filter((candidateTotal, candidateIndex) => {
      const candidateTier = forfeitFlags[candidateIndex] ? 2 : afkFlags[candidateIndex] ? 1 : 0;
      return candidateTier < tier || (candidateTier === tier && (Number(candidateTotal) || 0) < total);
    }).length;
    const tied = totals.filter((candidateTotal, candidateIndex) => {
      const candidateTier = forfeitFlags[candidateIndex] ? 2 : afkFlags[candidateIndex] ? 1 : 0;
      return candidateTier === tier && (Number(candidateTotal) || 0) === total;
    }).length;
    return 1 + ahead + ((tied - 1) / 2);
  });
}
