const DAY_MS = 24 * 60 * 60 * 1000;
const SEASON_LENGTH_MS = 90 * DAY_MS;
const RANKED_PLAYER_COUNTS = [2, 3, 4];
export const BASE_MMR = 0;
export const PLACEMENT_MATCHES_REQUIRED = 5;

export const SEASON_REWARDS = [
  { id: 's1-bronze-frame-reward', name: 'Bronze Contender Frame', league: 'Bronze', minMmr: 800, cosmeticId: 's1-bronze-frame' },
  { id: 's1-silver-title-reward', name: 'Silver Climber Title', league: 'Silver', minMmr: 1600, cosmeticId: 's1-silver-title' },
  { id: 's1-gold-card-back-reward', name: 'Gold Run Card Back', league: 'Gold', minMmr: 2400, cosmeticId: 's1-gold-card-back' },
  { id: 's1-platinum-table-reward', name: 'Platinum Table Theme', league: 'Platinum', minMmr: 3200, cosmeticId: 's1-platinum-table-theme' },
  { id: 's1-diamond-frame-reward', name: 'Diamond Frame', league: 'Diamond', minMmr: 4000, cosmeticId: 's1-diamond-frame' },
  { id: 's1-master-card-back-reward', name: 'Master Card Back', league: 'Master', minMmr: 4800, cosmeticId: 's1-master-card-back' },
  { id: 's1-legend-title-reward', name: 'Legend Title', league: 'Legend', minMmr: 6000, cosmeticId: 's1-legend-title' },
];

export const DEFAULT_LEAGUE_BANDS = [
  { league: 'Iron', min: 0, max: 799, divisions: ['III', 'II', 'I'] },
  { league: 'Bronze', min: 800, max: 1599, divisions: ['III', 'II', 'I'] },
  { league: 'Silver', min: 1600, max: 2399, divisions: ['III', 'II', 'I'] },
  { league: 'Gold', min: 2400, max: 3199, divisions: ['III', 'II', 'I'] },
  { league: 'Platinum', min: 3200, max: 3999, divisions: ['III', 'II', 'I'] },
  { league: 'Diamond', min: 4000, max: 4799, divisions: ['III', 'II', 'I'] },
  { league: 'Master', min: 4800, max: 5399, divisions: [] },
  { league: 'Grandmaster', min: 5400, max: 5999, divisions: [] },
  { league: 'Legend', min: 6000, max: Infinity, divisions: [] },
];

export const DEFAULT_MMR_DELTAS = {
  2: [22, -18],
  3: [28, 4, -22],
  4: [32, 10, -6, -26],
};

export const DEFAULT_MATCHMAKING = {
  firstRange: 100,
  secondRange: 200,
  expandStartMs: 60_000,
  expandEveryMs: 30_000,
  expandStep: 100,
  expandBase: 300,
  maxRange: 800,
};

export const DEFAULT_SOFT_RESET = {
  anchorMmr: BASE_MMR,
  multiplier: 0.55,
  floor: BASE_MMR,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
}

function configValue(config, key, fallback) {
  return config?.[key] ?? fallback;
}

function leagueBandsFor(config) {
  const bands = Array.isArray(config?.leagueBands) ? config.leagueBands : DEFAULT_LEAGUE_BANDS;
  return bands
    .filter(band => band?.league && Number.isFinite(Number(band.min)))
    .map(band => ({
      league: String(band.league),
      min: Math.max(0, safeInteger(band.min, 0)),
      max: band.max === null || band.max === undefined ? Infinity : Math.max(0, safeInteger(band.max, 0)),
      divisions: Array.isArray(band.divisions) ? band.divisions.map(String).filter(Boolean) : [],
    }))
    .sort((a, b) => a.min - b.min);
}

function rewardsFor(config) {
  return Array.isArray(config?.rewards) && config.rewards.length ? config.rewards : SEASON_REWARDS;
}

function isLegacyDefaultRewards(rewards) {
  if (!Array.isArray(rewards) || rewards.length < 7) return false;
  const byId = new Map(rewards.map(reward => [reward?.id, reward]));
  return byId.get('s1-bronze-frame-reward')?.minMmr === 0
    && byId.get('s1-silver-title-reward')?.minMmr === 1000
    && byId.get('s1-gold-card-back-reward')?.minMmr === 2000
    && byId.get('s1-platinum-table-reward')?.minMmr === 3000
    && byId.get('s1-master-card-back-reward')?.minMmr === 5000;
}

function seasonIdFromStart(startsAt) {
  return `season-${new Date(startsAt).toISOString().slice(0, 10)}`;
}

export function normalizeRankedSeason(input = null, now = Date.now(), config = null) {
  const seasonLengthMs = Math.max(DAY_MS, safeInteger(config?.seasonLengthDays, 90) * DAY_MS);
  const rewards = rewardsFor(config);
  if (input?.id && input.startsAt && input.endsAt && now < input.endsAt) {
    const existingRewards = Array.isArray(input.rewards) && input.rewards.length ? input.rewards : rewards;
    return {
      id: String(input.id),
      name: input.name || 'Season 1',
      startsAt: Number(input.startsAt),
      endsAt: Number(input.endsAt),
      rewards: isLegacyDefaultRewards(existingRewards) ? rewards : existingRewards,
    };
  }

  const startsAt = input?.endsAt && now >= input.endsAt ? Number(input.endsAt) : now;
  return {
    id: seasonIdFromStart(startsAt),
    name: input?.name || 'Season 1',
    startsAt,
    endsAt: startsAt + seasonLengthMs,
    rewards,
  };
}

export function leagueForMmr(rawMmr = BASE_MMR, config = null) {
  const mmr = Math.max(0, safeInteger(rawMmr, BASE_MMR));
  const bands = leagueBandsFor(config);
  const band = bands.find(item => mmr >= item.min && mmr <= item.max) || bands[bands.length - 1] || DEFAULT_LEAGUE_BANDS[0];
  if (!band.divisions.length) {
    return {
      league: band.league,
      division: null,
      name: band.league,
      minMmr: band.min,
      nextLeagueMmr: Number.isFinite(band.max) ? band.max + 1 : null,
    };
  }

  const width = band.max - band.min + 1;
  const step = width / band.divisions.length;
  const divisionIndex = clamp(Math.floor((mmr - band.min) / step), 0, band.divisions.length - 1);
  const division = band.divisions[divisionIndex];
  return {
    league: band.league,
    division,
    name: `${band.league} ${division}`,
    minMmr: band.min,
    nextLeagueMmr: band.max + 1,
  };
}

export function normalizeRankedPlayerCount(value = 2) {
  const count = safeInteger(value, 2);
  return count <= 2 ? 2 : count === 3 ? 3 : 4;
}

function defaultCompetitive(season, config = null, playerCount = 2) {
  const baseMmr = Math.max(0, safeInteger(configValue(config, 'baseMmr', BASE_MMR), BASE_MMR));
  const placementMatchesRequired = Math.max(1, safeInteger(configValue(config, 'placementMatchesRequired', PLACEMENT_MATCHES_REQUIRED), PLACEMENT_MATCHES_REQUIRED));
  const league = leagueForMmr(baseMmr, config);
  return {
    playerCount: normalizeRankedPlayerCount(playerCount),
    seasonId: season.id,
    mmr: baseMmr,
    league,
    placementsPlayed: 0,
    placementMatchesRequired,
    placementComplete: false,
    rankedGames: 0,
    wins: 0,
    losses: 0,
    seasonBestMmr: baseMmr,
    seasonBestLeague: league,
    claimedSeasonRewards: [],
    matchHistory: [],
  };
}

function normalizeCompetitiveRecord(existing = {}, season = normalizeRankedSeason(), config = null, playerCount = 2) {
  const safePlayerCount = normalizeRankedPlayerCount(playerCount);
  const defaults = defaultCompetitive(season, config, safePlayerCount);
  const existingSeasonId = existing.seasonId || season.id;
  const isNewSeason = existingSeasonId !== season.id;
  const previousMmr = Math.max(0, safeInteger(existing.mmr, defaults.mmr));
  const reset = config?.softReset || DEFAULT_SOFT_RESET;
  const resetAnchor = safeInteger(reset.anchorMmr, BASE_MMR);
  const resetMultiplier = Number.isFinite(Number(reset.multiplier)) ? Number(reset.multiplier) : DEFAULT_SOFT_RESET.multiplier;
  const resetFloor = safeInteger(reset.floor, DEFAULT_SOFT_RESET.floor);
  const mmr = isNewSeason
    ? Math.max(resetFloor, resetAnchor + Math.floor((previousMmr - resetAnchor) * resetMultiplier))
    : previousMmr;
  const seasonBestMmr = isNewSeason
    ? mmr
    : Math.max(mmr, Math.max(0, safeInteger(existing.seasonBestMmr, mmr)));
  const placementMatchesRequired = defaults.placementMatchesRequired;
  const placementsPlayed = isNewSeason
    ? 0
    : clamp(safeInteger(existing.placementsPlayed, 0), 0, placementMatchesRequired);
  const claimedSeasonRewards = isNewSeason
    ? []
    : Array.isArray(existing.claimedSeasonRewards) ? existing.claimedSeasonRewards.filter(Boolean) : [];
  const matchHistory = isNewSeason
    ? []
    : Array.isArray(existing.matchHistory) ? existing.matchHistory.filter(Boolean).slice(0, 25) : [];

  return {
    playerCount: safePlayerCount,
    seasonId: season.id,
    mmr,
    league: leagueForMmr(mmr, config),
    placementsPlayed,
    placementMatchesRequired,
    placementComplete: placementsPlayed >= placementMatchesRequired,
    rankedGames: isNewSeason ? 0 : Math.max(0, safeInteger(existing.rankedGames, 0)),
    wins: isNewSeason ? 0 : Math.max(0, safeInteger(existing.wins, 0)),
    losses: isNewSeason ? 0 : Math.max(0, safeInteger(existing.losses, 0)),
    seasonBestMmr,
    seasonBestLeague: leagueForMmr(seasonBestMmr, config),
    claimedSeasonRewards,
    matchHistory,
  };
}

function seedCompetitiveMap(user, season, config = null) {
  const existingMap = user.competitiveByPlayers && typeof user.competitiveByPlayers === 'object'
    ? user.competitiveByPlayers
    : null;
  const legacy = user.competitive && typeof user.competitive === 'object' ? user.competitive : null;
  const source = existingMap || { 2: legacy || {} };
  user.competitiveByPlayers = {};
  for (const count of RANKED_PLAYER_COUNTS) {
    const key = String(count);
    user.competitiveByPlayers[key] = normalizeCompetitiveRecord(source[key] || {}, season, config, count);
  }
  user.competitive = user.competitiveByPlayers['2'];
  return user.competitiveByPlayers;
}

export function normalizeCompetitiveState(user, season = normalizeRankedSeason(), config = null, playerCount = 2) {
  const count = normalizeRankedPlayerCount(playerCount);
  const map = seedCompetitiveMap(user, season, config);
  return map[String(count)];
}

export function publicCompetitiveByPlayers(user, season = normalizeRankedSeason(), config = null) {
  const map = seedCompetitiveMap(user, season, config);
  return Object.fromEntries(RANKED_PLAYER_COUNTS.map(count => [
    String(count),
    publicCompetitiveState(user, season, config, count),
  ]));
}

function publicSeasonReward(competitive, reward) {
  const earned = competitive.seasonBestMmr >= reward.minMmr;
  const claimed = competitive.claimedSeasonRewards.includes(reward.id);
  return { ...reward, earned, claimed };
}

export function publicCompetitiveState(user, season = normalizeRankedSeason(), config = null, playerCount = 2) {
  const competitive = normalizeCompetitiveState(user, season, config, playerCount);
  return {
    ...competitive,
    league: leagueForMmr(competitive.mmr, config),
    seasonBestLeague: leagueForMmr(competitive.seasonBestMmr, config),
    placementsRemaining: Math.max(0, competitive.placementMatchesRequired - competitive.placementsPlayed),
    season: {
      id: season.id,
      name: season.name,
      startsAt: season.startsAt,
      endsAt: season.endsAt,
      rewards: (season.rewards || rewardsFor(config)).map(reward => publicSeasonReward(competitive, reward)),
    },
  };
}

export function matchmakingRangeFor(joinedAt, now = Date.now(), config = null) {
  const rules = { ...DEFAULT_MATCHMAKING, ...(config?.matchmaking || {}) };
  const waitedMs = Math.max(0, now - joinedAt);
  if (waitedMs < 30_000) return safeInteger(rules.firstRange, 100);
  if (waitedMs < 60_000) return safeInteger(rules.secondRange, 200);
  const extra = Math.floor((waitedMs - safeInteger(rules.expandStartMs, 60_000)) / safeInteger(rules.expandEveryMs, 30_000)) * safeInteger(rules.expandStep, 100);
  return clamp(safeInteger(rules.expandBase, 300) + Math.max(0, extra), safeInteger(rules.expandBase, 300), safeInteger(rules.maxRange, 800));
}

function placementBaseDeltas(playerCount, config = null) {
  const source = config?.mmrDeltas || DEFAULT_MMR_DELTAS;
  const key = playerCount <= 2 ? 2 : playerCount === 3 ? 3 : 4;
  const deltas = source[key] || source[String(key)] || DEFAULT_MMR_DELTAS[key];
  return Array.isArray(deltas) && deltas.length ? deltas.map(value => Number(value) || 0) : DEFAULT_MMR_DELTAS[key];
}

export function placementForTotals(totals, index) {
  const total = totals[index];
  const lower = totals.filter(item => item < total).length;
  const tied = totals.filter(item => item === total).length;
  return 1 + lower + ((tied - 1) / 2);
}

function interpolatePlacementDelta(deltas, placement) {
  const lowIndex = clamp(Math.floor(placement) - 1, 0, deltas.length - 1);
  const highIndex = clamp(Math.ceil(placement) - 1, 0, deltas.length - 1);
  if (lowIndex === highIndex) return deltas[lowIndex];
  const fraction = placement - Math.floor(placement);
  return deltas[lowIndex] + ((deltas[highIndex] - deltas[lowIndex]) * fraction);
}

function performanceBonus(total, columnClears, config = null) {
  let bonus = 0;
  if (total <= 0) bonus += 5;
  else if (total <= 20) bonus += 3;
  else if (total <= 40) bonus += 2;
  bonus += clamp(safeInteger(columnClears, 0), 0, 3);
  return clamp(bonus, 0, safeInteger(config?.performanceBonusCap, 5));
}

export function previewRankedDelta({ mmr, opponentMmrs = [], playerCount = 2, placement = 1, total = 0, columnClears = 0, placementsPlayed = 0 }, config = null) {
  const deltas = placementBaseDeltas(playerCount, config);
  const base = interpolatePlacementDelta(deltas, placement);
  const avgOpponentMmr = opponentMmrs.length
    ? opponentMmrs.reduce((sum, value) => sum + safeInteger(value, BASE_MMR), 0) / opponentMmrs.length
    : mmr;
  const strengthCap = safeInteger(config?.strengthAdjustmentCap, 8);
  const strengthAdjustment = clamp(Math.round((avgOpponentMmr - mmr) / 50), -strengthCap, strengthCap);
  const placementMatchesRequired = safeInteger(config?.placementMatchesRequired, PLACEMENT_MATCHES_REQUIRED);
  const multiplier = placementsPlayed < placementMatchesRequired ? Number(config?.placementMultiplier ?? 1.25) : 1;
  return Math.round((base + strengthAdjustment + performanceBonus(total, columnClears, config)) * multiplier);
}

export function applyRankedMatchResult(user, match, season = normalizeRankedSeason(), now = Date.now(), config = null) {
  const playerCount = normalizeRankedPlayerCount(match.playerCount);
  const before = normalizeCompetitiveState(user, season, config, playerCount);
  const mmrBefore = before.mmr;
  const leagueBefore = leagueForMmr(mmrBefore, config);
  const placement = Number(match.placement) || 1;
  const delta = previewRankedDelta({
    mmr: mmrBefore,
    opponentMmrs: match.opponentMmrs || [],
    playerCount,
    placement,
    total: safeInteger(match.total, 0),
    columnClears: safeInteger(match.columnClears, 0),
    placementsPlayed: before.placementsPlayed,
  }, config);
  const mmrAfter = Math.max(0, mmrBefore + delta);
  const placementsPlayed = clamp(before.placementsPlayed + 1, 0, before.placementMatchesRequired);
  const leagueAfter = leagueForMmr(mmrAfter, config);
  const won = placement === 1;
  const seasonBestMmr = Math.max(before.seasonBestMmr, mmrAfter);

  const next = {
    ...before,
    mmr: mmrAfter,
    league: leagueAfter,
    placementsPlayed,
    placementComplete: placementsPlayed >= before.placementMatchesRequired,
    rankedGames: before.rankedGames + 1,
    wins: before.wins + (won ? 1 : 0),
    losses: before.losses + (won ? 0 : 1),
    seasonBestMmr,
    seasonBestLeague: leagueForMmr(seasonBestMmr, config),
    matchHistory: [{
      matchId: match.matchId,
      completedAt: now,
      roomCode: match.roomCode || null,
      playerCount,
      total: safeInteger(match.total, 0),
      placement,
      mmrBefore,
      mmrAfter,
      delta,
      leagueBefore,
      leagueAfter,
    }, ...before.matchHistory].slice(0, 25),
  };
  seedCompetitiveMap(user, season, config);
  user.competitiveByPlayers[String(playerCount)] = next;
  user.competitive = user.competitiveByPlayers['2'];

  return {
    matchType: 'ranked',
    playerCount,
    seasonId: season.id,
    mmrBefore,
    mmrAfter,
    mmrDelta: delta,
    leagueBefore,
    leagueAfter,
    placement,
    placementsPlayed,
    placementMatchesRequired: before.placementMatchesRequired,
    placementComplete: placementsPlayed >= before.placementMatchesRequired,
    promoted: leagueBefore.name !== leagueAfter.name && mmrAfter > mmrBefore,
    demoted: leagueBefore.name !== leagueAfter.name && mmrAfter < mmrBefore,
  };
}

export function claimSeasonRewards(user, season = normalizeRankedSeason(), config = null, playerCount = 2) {
  const count = normalizeRankedPlayerCount(playerCount);
  const competitive = normalizeCompetitiveState(user, season, config, count);
  const granted = [];
  for (const reward of season.rewards || rewardsFor(config)) {
    if (competitive.seasonBestMmr < reward.minMmr) continue;
    if (competitive.claimedSeasonRewards.includes(reward.id)) continue;
    competitive.claimedSeasonRewards.push(reward.id);
    granted.push({
      ...publicSeasonReward(competitive, reward),
      shopUnlock: true,
    });
  }
  user.competitiveByPlayers[String(count)] = competitive;
  user.competitive = user.competitiveByPlayers['2'];
  return {
    granted,
    competitive: publicCompetitiveState(user, season, config, count),
  };
}
