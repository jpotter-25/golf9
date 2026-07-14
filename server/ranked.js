const DAY_MS = 24 * 60 * 60 * 1000;
const RANKED_PLAYER_COUNTS = [2, 3, 4];

export const BASE_MMR = 0;
export const PLACEMENT_MATCHES_REQUIRED = 5;
export const CALIBRATION_MATCHES_REQUIRED = 10;

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
  2: [24, -24],
  3: [30, 6, -36],
  4: [36, 12, -12, -36],
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

export const DEFAULT_CONFIDENCE_RULES = {
  returningPlacementMultiplier: 1.35,
  calibrationGainMultiplier: 1.15,
  calibrationLossMultiplier: 0.9,
  calibrationMatchesRequired: CALIBRATION_MATCHES_REQUIRED,
  firstPlacementStrengthCap: 200,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function configValue(config, key, fallback) {
  return config?.[key] ?? fallback;
}

function confidenceRulesFor(config = null) {
  return {
    ...DEFAULT_CONFIDENCE_RULES,
    ...(config?.confidence || {}),
  };
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

export function publicRank(rank) {
  if (!rank || rank.league === 'Unranked') {
    return { league: 'Unranked', division: null, name: 'Unranked' };
  }
  return {
    league: String(rank.league),
    division: rank.division ? String(rank.division) : null,
    name: String(rank.name || [rank.league, rank.division].filter(Boolean).join(' ')),
  };
}

export function normalizeRankedPlayerCount(value = 2) {
  const count = safeInteger(value, 2);
  return count <= 2 ? 2 : count === 3 ? 3 : 4;
}

function placementCompleteFor(existing, required) {
  return Boolean(existing.placementComplete)
    || safeInteger(existing.placementsPlayed, 0) >= required
    || safeInteger(existing.rankedGames, 0) >= required;
}

function confidenceStage(record) {
  if (!record.placementComplete) return 'placement';
  if (record.calibrationMatchesPlayed < record.calibrationMatchesRequired) return 'calibration';
  return 'established';
}

function defaultCompetitive(season, config = null, playerCount = 2) {
  const baseMmr = Math.max(0, safeInteger(configValue(config, 'baseMmr', BASE_MMR), BASE_MMR));
  const placementMatchesRequired = Math.max(1, safeInteger(configValue(config, 'placementMatchesRequired', PLACEMENT_MATCHES_REQUIRED), PLACEMENT_MATCHES_REQUIRED));
  const calibrationMatchesRequired = Math.max(0, safeInteger(confidenceRulesFor(config).calibrationMatchesRequired, CALIBRATION_MATCHES_REQUIRED));
  const league = leagueForMmr(baseMmr, config);
  return {
    playerCount: normalizeRankedPlayerCount(playerCount),
    seasonId: season.id,
    mmr: baseMmr,
    league,
    placementsPlayed: 0,
    placementMatchesRequired,
    placementComplete: false,
    placementSamples: [],
    placementStrengthSamples: [],
    hasCompletedInitialPlacement: false,
    returningPlacement: false,
    calibrationMatchesPlayed: 0,
    calibrationMatchesRequired,
    confidenceStage: 'placement',
    rankedGames: 0,
    careerRankedGames: 0,
    wins: 0,
    losses: 0,
    seasonBestMmr: baseMmr,
    seasonBestLeague: league,
    careerBestMmr: baseMmr,
    careerBestLeague: league,
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
  const placementMatchesRequired = defaults.placementMatchesRequired;
  const previouslyComplete = placementCompleteFor(existing, placementMatchesRequired);
  const hasCompletedInitialPlacement = Boolean(existing.hasCompletedInitialPlacement) || previouslyComplete;
  const reset = config?.softReset || DEFAULT_SOFT_RESET;
  const resetAnchor = safeInteger(reset.anchorMmr, BASE_MMR);
  const resetMultiplier = safeNumber(reset.multiplier, DEFAULT_SOFT_RESET.multiplier);
  const resetFloor = safeInteger(reset.floor, DEFAULT_SOFT_RESET.floor);
  const mmr = isNewSeason
    ? Math.max(resetFloor, resetAnchor + Math.floor((previousMmr - resetAnchor) * resetMultiplier))
    : previousMmr;
  const rankedGames = isNewSeason ? 0 : Math.max(0, safeInteger(existing.rankedGames, 0));
  const placementsPlayed = isNewSeason
    ? 0
    : clamp(safeInteger(existing.placementsPlayed, previouslyComplete ? placementMatchesRequired : 0), 0, placementMatchesRequired);
  const placementComplete = !isNewSeason && placementsPlayed >= placementMatchesRequired;
  const calibrationMatchesRequired = defaults.calibrationMatchesRequired;
  const inferredCalibration = placementComplete
    ? clamp(rankedGames - placementMatchesRequired, 0, calibrationMatchesRequired)
    : 0;
  const calibrationMatchesPlayed = isNewSeason
    ? 0
    : clamp(safeInteger(existing.calibrationMatchesPlayed, inferredCalibration), 0, calibrationMatchesRequired);
  const seasonBestMmr = isNewSeason
    ? mmr
    : Math.max(mmr, Math.max(0, safeInteger(existing.seasonBestMmr, mmr)));
  const careerBestMmr = Math.max(
    mmr,
    seasonBestMmr,
    Math.max(0, safeInteger(existing.careerBestMmr, seasonBestMmr)),
  );
  const record = {
    playerCount: safePlayerCount,
    seasonId: season.id,
    mmr,
    league: leagueForMmr(mmr, config),
    placementsPlayed,
    placementMatchesRequired,
    placementComplete,
    placementSamples: isNewSeason ? [] : Array.isArray(existing.placementSamples) ? existing.placementSamples.map(Number).filter(Number.isFinite).slice(0, placementMatchesRequired) : [],
    placementStrengthSamples: isNewSeason ? [] : Array.isArray(existing.placementStrengthSamples) ? existing.placementStrengthSamples.map(Number).filter(Number.isFinite).slice(0, placementMatchesRequired) : [],
    hasCompletedInitialPlacement,
    returningPlacement: isNewSeason ? hasCompletedInitialPlacement : Boolean(existing.returningPlacement),
    calibrationMatchesPlayed,
    calibrationMatchesRequired,
    confidenceStage: 'placement',
    rankedGames,
    careerRankedGames: Math.max(rankedGames, Math.max(0, safeInteger(existing.careerRankedGames, rankedGames))),
    wins: isNewSeason ? 0 : Math.max(0, safeInteger(existing.wins, 0)),
    losses: isNewSeason ? 0 : Math.max(0, safeInteger(existing.losses, 0)),
    seasonBestMmr,
    seasonBestLeague: leagueForMmr(seasonBestMmr, config),
    careerBestMmr,
    careerBestLeague: leagueForMmr(careerBestMmr, config),
    claimedSeasonRewards: isNewSeason ? [] : Array.isArray(existing.claimedSeasonRewards) ? existing.claimedSeasonRewards.filter(Boolean) : [],
    matchHistory: isNewSeason ? [] : Array.isArray(existing.matchHistory) ? existing.matchHistory.filter(Boolean).slice(0, 25) : [],
  };
  record.confidenceStage = confidenceStage(record);
  return record;
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
  if (!user.displayRankSelection || typeof user.displayRankSelection !== 'object') user.displayRankSelection = null;
  return user.competitiveByPlayers;
}

export function normalizeCompetitiveState(user, season = normalizeRankedSeason(), config = null, playerCount = 2) {
  const count = normalizeRankedPlayerCount(playerCount);
  const map = seedCompetitiveMap(user, season, config);
  return map[String(count)];
}

function publicSeasonReward(competitive, reward) {
  const earned = competitive.seasonBestMmr >= safeInteger(reward.minMmr, 0);
  const claimed = competitive.claimedSeasonRewards.includes(reward.id);
  return {
    id: reward.id,
    name: reward.name,
    league: reward.league,
    requiredRank: reward.requiredRank || reward.league,
    cosmeticId: reward.cosmeticId,
    earned,
    claimed,
  };
}

function publicMatchHistory(history = []) {
  return history.map(item => ({
    matchId: item.matchId,
    completedAt: item.completedAt,
    roomCode: item.roomCode || null,
    playerCount: item.playerCount,
    total: item.total,
    placement: item.placement,
    rankBefore: publicRank(item.leagueBefore),
    rankAfter: publicRank(item.leagueAfter),
    promoted: Boolean(item.promoted),
    demoted: Boolean(item.demoted),
  }));
}

export function publicCompetitiveState(user, season = normalizeRankedSeason(), config = null, playerCount = 2) {
  const competitive = normalizeCompetitiveState(user, season, config, playerCount);
  const visibleLeague = competitive.placementComplete ? publicRank(competitive.league) : publicRank(null);
  return {
    playerCount: competitive.playerCount,
    seasonId: competitive.seasonId,
    league: visibleLeague,
    placementsPlayed: competitive.placementsPlayed,
    placementMatchesRequired: competitive.placementMatchesRequired,
    placementComplete: competitive.placementComplete,
    placementsRemaining: Math.max(0, competitive.placementMatchesRequired - competitive.placementsPlayed),
    rankedGames: competitive.rankedGames,
    wins: competitive.wins,
    losses: competitive.losses,
    seasonBestLeague: competitive.placementComplete ? publicRank(competitive.seasonBestLeague) : publicRank(null),
    careerBestLeague: competitive.hasCompletedInitialPlacement ? publicRank(competitive.careerBestLeague) : publicRank(null),
    matchHistory: publicMatchHistory(competitive.matchHistory),
    season: {
      id: season.id,
      name: season.name,
      startsAt: season.startsAt,
      endsAt: season.endsAt,
      rewards: (season.rewards || rewardsFor(config)).map(reward => publicSeasonReward(competitive, reward)),
    },
  };
}

export function publicCompetitiveByPlayers(user, season = normalizeRankedSeason(), config = null) {
  seedCompetitiveMap(user, season, config);
  return Object.fromEntries(RANKED_PLAYER_COUNTS.map(count => [
    String(count),
    publicCompetitiveState(user, season, config, count),
  ]));
}

function rankForSelection(record, source) {
  if (source === 'current') return record.placementComplete ? publicRank(record.league) : null;
  if (source === 'careerBest') return record.hasCompletedInitialPlacement ? publicRank(record.careerBestLeague) : null;
  return null;
}

export function rankedDisplayEmblemChoices(user, season = normalizeRankedSeason(), config = null) {
  const map = seedCompetitiveMap(user, season, config);
  const seen = new Set();
  const choices = [];
  for (const count of RANKED_PLAYER_COUNTS) {
    const record = map[String(count)];
    for (const source of ['current', 'careerBest']) {
      const rank = rankForSelection(record, source);
      if (!rank || rank.name === 'Unranked') continue;
      const key = `${count}:${rank.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      choices.push({ playerCount: count, source, league: rank });
    }
  }
  return choices;
}

export function resolveDisplayRankEmblem(user, season = normalizeRankedSeason(), config = null) {
  const selection = user.displayRankSelection;
  if (!selection || typeof selection !== 'object') return null;
  const playerCount = normalizeRankedPlayerCount(selection.playerCount);
  const source = selection.source === 'careerBest' ? 'careerBest' : selection.source === 'current' ? 'current' : null;
  if (!source) return null;
  const record = normalizeCompetitiveState(user, season, config, playerCount);
  const league = rankForSelection(record, source);
  if (!league || league.name === 'Unranked') return null;
  return { playerCount, source, league };
}

export function setDisplayRankEmblem(user, selection, season = normalizeRankedSeason(), config = null) {
  if (selection === null || selection?.remove === true) {
    user.displayRankSelection = null;
    return { displayRankSelection: null, displayRankEmblem: null };
  }
  const playerCount = normalizeRankedPlayerCount(selection?.playerCount);
  const source = selection?.source === 'careerBest' ? 'careerBest' : selection?.source === 'current' ? 'current' : null;
  if (!source) return { error: 'Choose a current or career-best rank emblem.' };
  const record = normalizeCompetitiveState(user, season, config, playerCount);
  if (!rankForSelection(record, source)) return { error: 'That rank emblem has not been earned yet.' };
  user.displayRankSelection = { playerCount, source };
  return {
    displayRankSelection: user.displayRankSelection,
    displayRankEmblem: resolveDisplayRankEmblem(user, season, config),
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
  const key = normalizeRankedPlayerCount(playerCount);
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

function strengthAdjustmentFor(mmr, opponentMmrs, config = null) {
  const avgOpponentMmr = opponentMmrs.length
    ? opponentMmrs.reduce((sum, value) => sum + safeInteger(value, BASE_MMR), 0) / opponentMmrs.length
    : mmr;
  const cap = Math.max(0, safeInteger(config?.strengthAdjustmentCap, 8));
  return clamp(Math.round((avgOpponentMmr - mmr) / 50), -cap, cap);
}

function signSafeAdjustedDelta(base, adjustment) {
  if (base > 0) return Math.max(1, base + adjustment);
  if (base < 0) return Math.min(-1, base + adjustment);
  return 0;
}

export function previewRankedDelta({
  mmr,
  opponentMmrs = [],
  playerCount = 2,
  placement = 1,
  placementsPlayed = PLACEMENT_MATCHES_REQUIRED,
  placementComplete = placementsPlayed >= PLACEMENT_MATCHES_REQUIRED,
  returningPlacement = false,
  calibrationMatchesPlayed = CALIBRATION_MATCHES_REQUIRED,
}, config = null) {
  const base = interpolatePlacementDelta(placementBaseDeltas(playerCount, config), placement);
  const adjusted = signSafeAdjustedDelta(base, strengthAdjustmentFor(mmr, opponentMmrs, config));
  const confidence = confidenceRulesFor(config);
  let multiplier = 1;
  if (!placementComplete && returningPlacement) multiplier = safeNumber(confidence.returningPlacementMultiplier, 1.35);
  else if (placementComplete && calibrationMatchesPlayed < safeInteger(confidence.calibrationMatchesRequired, CALIBRATION_MATCHES_REQUIRED)) {
    multiplier = adjusted >= 0
      ? safeNumber(confidence.calibrationGainMultiplier, 1.15)
      : safeNumber(confidence.calibrationLossMultiplier, 0.9);
  }
  return Math.round(adjusted * multiplier);
}

function placementPercentile(placement, playerCount) {
  if (playerCount <= 1) return 1;
  return clamp(1 - ((placement - 1) / (playerCount - 1)), 0, 1);
}

function firstPlacementMmr(percentile, config = null) {
  const bands = leagueBandsFor(config);
  const iron = bands.find(band => band.league === 'Iron') || bands[0];
  const gold = bands.find(band => band.league === 'Gold') || bands[Math.min(3, bands.length - 1)];
  const averageTarget = Number.isFinite(iron?.max) ? iron.max : 799;
  const perfectCap = Number.isFinite(gold?.max) ? gold.max : 3199;
  if (percentile <= 0.5) return Math.round((percentile / 0.5) * averageTarget);
  return Math.round(averageTarget + (((percentile - 0.5) / 0.5) * (perfectCap - averageTarget)));
}

function firstPlacementStrengthShift(samples, config = null) {
  if (!samples.length) return 0;
  const baseMmr = Math.max(0, safeInteger(config?.baseMmr, BASE_MMR));
  const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const cap = Math.max(0, safeInteger(confidenceRulesFor(config).firstPlacementStrengthCap, 200));
  return clamp(Math.round((average - baseMmr) / 8), -cap, cap);
}

function resultRanks(before, after, wasPlacementComplete, isPlacementComplete) {
  return {
    before: wasPlacementComplete ? publicRank(before) : publicRank(null),
    after: isPlacementComplete ? publicRank(after) : publicRank(null),
  };
}

export function applyRankedMatchResult(user, match, season = normalizeRankedSeason(), now = Date.now(), config = null) {
  const playerCount = normalizeRankedPlayerCount(match.playerCount);
  const before = normalizeCompetitiveState(user, season, config, playerCount);
  const mmrBefore = before.mmr;
  const leagueBefore = leagueForMmr(mmrBefore, config);
  const placement = Number(match.placement) || 1;
  const wasPlacementComplete = before.placementComplete;
  const percentile = placementPercentile(placement, playerCount);
  const placementSamples = [...before.placementSamples];
  const placementStrengthSamples = [...before.placementStrengthSamples];
  let mmrAfter = mmrBefore;
  let delta = 0;

  if (!before.placementComplete && !before.hasCompletedInitialPlacement) {
    placementSamples.push(percentile);
    const opponents = Array.isArray(match.opponentMmrs) ? match.opponentMmrs : [];
    placementStrengthSamples.push(opponents.length
      ? opponents.reduce((sum, value) => sum + safeInteger(value, BASE_MMR), 0) / opponents.length
      : config?.baseMmr ?? BASE_MMR);
    if (before.placementsPlayed + 1 >= before.placementMatchesRequired) {
      const averagePercentile = placementSamples.reduce((sum, value) => sum + value, 0) / placementSamples.length;
      mmrAfter = Math.max(0, firstPlacementMmr(averagePercentile, config) + firstPlacementStrengthShift(placementStrengthSamples, config));
      delta = mmrAfter - mmrBefore;
    }
  } else {
    delta = previewRankedDelta({
      mmr: mmrBefore,
      opponentMmrs: match.opponentMmrs || [],
      playerCount,
      placement,
      placementsPlayed: before.placementsPlayed,
      placementComplete: before.placementComplete,
      returningPlacement: before.returningPlacement,
      calibrationMatchesPlayed: before.calibrationMatchesPlayed,
    }, config);
    mmrAfter = Math.max(0, mmrBefore + delta);
  }

  const placementsPlayed = clamp(before.placementsPlayed + 1, 0, before.placementMatchesRequired);
  const placementComplete = placementsPlayed >= before.placementMatchesRequired;
  const hasCompletedInitialPlacement = before.hasCompletedInitialPlacement || placementComplete;
  const leagueAfter = leagueForMmr(mmrAfter, config);
  const won = placement === 1;
  const seasonBestMmr = Math.max(before.seasonBestMmr, mmrAfter);
  const careerBestMmr = Math.max(before.careerBestMmr, seasonBestMmr);
  const calibrationMatchesPlayed = wasPlacementComplete
    ? clamp(before.calibrationMatchesPlayed + 1, 0, before.calibrationMatchesRequired)
    : before.calibrationMatchesPlayed;
  const ranks = resultRanks(leagueBefore, leagueAfter, wasPlacementComplete, placementComplete);
  const promoted = ranks.before.name !== ranks.after.name && mmrAfter > mmrBefore;
  const demoted = ranks.before.name !== ranks.after.name && mmrAfter < mmrBefore;

  const next = {
    ...before,
    mmr: mmrAfter,
    league: leagueAfter,
    placementsPlayed,
    placementComplete,
    placementSamples: placementSamples.slice(0, before.placementMatchesRequired),
    placementStrengthSamples: placementStrengthSamples.slice(0, before.placementMatchesRequired),
    hasCompletedInitialPlacement,
    returningPlacement: placementComplete ? false : before.returningPlacement,
    calibrationMatchesPlayed,
    confidenceStage: 'placement',
    rankedGames: before.rankedGames + 1,
    careerRankedGames: before.careerRankedGames + 1,
    wins: before.wins + (won ? 1 : 0),
    losses: before.losses + (won ? 0 : 1),
    seasonBestMmr,
    seasonBestLeague: leagueForMmr(seasonBestMmr, config),
    careerBestMmr,
    careerBestLeague: leagueForMmr(careerBestMmr, config),
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
      promoted,
      demoted,
    }, ...before.matchHistory].slice(0, 25),
  };
  next.confidenceStage = confidenceStage(next);
  seedCompetitiveMap(user, season, config);
  user.competitiveByPlayers[String(playerCount)] = next;
  user.competitive = user.competitiveByPlayers['2'];

  return {
    matchType: 'ranked',
    playerCount,
    seasonId: season.id,
    leagueBefore: ranks.before,
    leagueAfter: ranks.after,
    placement,
    placementsPlayed,
    placementMatchesRequired: before.placementMatchesRequired,
    placementComplete,
    promoted,
    demoted,
  };
}

export function claimSeasonRewards(user, season = normalizeRankedSeason(), config = null, playerCount = 2) {
  const count = normalizeRankedPlayerCount(playerCount);
  const competitive = normalizeCompetitiveState(user, season, config, count);
  const granted = [];
  for (const reward of season.rewards || rewardsFor(config)) {
    if (competitive.seasonBestMmr < safeInteger(reward.minMmr, 0)) continue;
    if (competitive.claimedSeasonRewards.includes(reward.id)) continue;
    competitive.claimedSeasonRewards.push(reward.id);
    granted.push({ ...publicSeasonReward(competitive, reward), shopUnlock: true });
  }
  user.competitiveByPlayers[String(count)] = competitive;
  user.competitive = user.competitiveByPlayers['2'];
  return {
    granted,
    competitive: publicCompetitiveState(user, season, config, count),
  };
}
