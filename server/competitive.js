import crypto from 'crypto';
import {
  BASE_MMR,
  DEFAULT_CONFIDENCE_RULES,
  DEFAULT_LEAGUE_BANDS,
  DEFAULT_MATCHMAKING,
  DEFAULT_MMR_DELTAS,
  DEFAULT_SOFT_RESET,
  PLACEMENT_MATCHES_REQUIRED,
  SEASON_REWARDS,
  previewRankedDelta,
} from './ranked.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function now() {
  return Date.now();
}

function safeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
}

function cleanText(value, maxLength = 120) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeLeagueBands(input) {
  const source = Array.isArray(input) && input.length ? input : DEFAULT_LEAGUE_BANDS;
  return source
    .filter(band => band?.league)
    .map((band, index) => {
      const maxNumber = Number(band.max);
      const isOpenEnded = band.max === null
        || band.max === undefined
        || band.max === 'Infinity'
        || band.max === Infinity
        || !Number.isFinite(maxNumber);
      return {
        league: cleanText(band.league, 32) || `League ${index + 1}`,
        min: Math.max(0, safeInteger(band.min, 0)),
        max: isOpenEnded ? null : Math.max(0, safeInteger(band.max, 0)),
        divisions: Array.isArray(band.divisions) ? band.divisions.map(item => cleanText(item, 8)).filter(Boolean) : [],
      };
    })
    .sort((a, b) => a.min - b.min);
}

function normalizeDeltas(input) {
  const source = input || DEFAULT_MMR_DELTAS;
  return {
    2: Array.isArray(source[2] || source['2']) ? (source[2] || source['2']).map(value => Number(value) || 0).slice(0, 2) : DEFAULT_MMR_DELTAS[2],
    3: Array.isArray(source[3] || source['3']) ? (source[3] || source['3']).map(value => Number(value) || 0).slice(0, 3) : DEFAULT_MMR_DELTAS[3],
    4: Array.isArray(source[4] || source['4']) ? (source[4] || source['4']).map(value => Number(value) || 0).slice(0, 4) : DEFAULT_MMR_DELTAS[4],
  };
}

function normalizeRewards(input) {
  const source = Array.isArray(input) && input.length ? input : SEASON_REWARDS;
  return source
    .filter(reward => reward?.id)
    .map(reward => ({
      id: cleanText(reward.id, 80),
      name: cleanText(reward.name, 80),
      league: cleanText(reward.league, 32),
      minMmr: Math.max(0, safeInteger(reward.minMmr, 0)),
      cosmeticId: cleanText(reward.cosmeticId, 80),
    }));
}

function hasLegacyDefaultRankBands(input) {
  if (!Array.isArray(input) || input.length < 8) return false;
  const bands = normalizeLeagueBands(input);
  return bands.length === 8
    && bands[0]?.league === 'Bronze'
    && bands[0]?.min === 0
    && bands[0]?.max === 999
    && bands[1]?.league === 'Silver'
    && bands[1]?.min === 1000
    && bands[4]?.league === 'Diamond'
    && bands[4]?.max === 4999
    && bands[7]?.league === 'Legend'
    && bands[7]?.max === null;
}

export function defaultCompetitiveConfig(timestamp = now()) {
  return {
    versionId: `competitive-default-${timestamp}`,
    publishedAt: timestamp,
    publishedBy: 'system',
    baseMmr: BASE_MMR,
    placementMatchesRequired: PLACEMENT_MATCHES_REQUIRED,
    seasonLengthDays: 90,
    rewardGraceDays: 30,
    strengthAdjustmentCap: 8,
    confidence: { ...DEFAULT_CONFIDENCE_RULES },
    softReset: { ...DEFAULT_SOFT_RESET },
    matchmaking: { ...DEFAULT_MATCHMAKING },
    mmrDeltas: clone(DEFAULT_MMR_DELTAS),
    leagueBands: normalizeLeagueBands(DEFAULT_LEAGUE_BANDS),
    rewards: normalizeRewards(SEASON_REWARDS),
  };
}

export function normalizeCompetitiveConfig(input = null, fallback = defaultCompetitiveConfig()) {
  const source = input && typeof input === 'object' ? input : {};
  const migrateLegacyRankDefaults = hasLegacyDefaultRankBands(source.leagueBands)
    && safeInteger(source.baseMmr, 1000) === 1000;
  return {
    versionId: cleanText(source.versionId || fallback.versionId || `competitive-${now()}`, 80),
    publishedAt: Number(source.publishedAt || fallback.publishedAt || now()),
    publishedBy: cleanText(source.publishedBy || fallback.publishedBy || 'system', 80),
    baseMmr: migrateLegacyRankDefaults ? BASE_MMR : Math.max(0, safeInteger(source.baseMmr, fallback.baseMmr)),
    placementMatchesRequired: Math.max(1, safeInteger(source.placementMatchesRequired, fallback.placementMatchesRequired)),
    seasonLengthDays: Math.max(1, safeInteger(source.seasonLengthDays, fallback.seasonLengthDays)),
    rewardGraceDays: Math.max(0, safeInteger(source.rewardGraceDays, fallback.rewardGraceDays)),
    strengthAdjustmentCap: Math.max(0, safeInteger(source.strengthAdjustmentCap, fallback.strengthAdjustmentCap)),
    confidence: {
      returningPlacementMultiplier: Number.isFinite(Number(source.confidence?.returningPlacementMultiplier))
        ? Number(source.confidence.returningPlacementMultiplier)
        : fallback.confidence.returningPlacementMultiplier,
      calibrationGainMultiplier: Number.isFinite(Number(source.confidence?.calibrationGainMultiplier))
        ? Number(source.confidence.calibrationGainMultiplier)
        : fallback.confidence.calibrationGainMultiplier,
      calibrationLossMultiplier: Number.isFinite(Number(source.confidence?.calibrationLossMultiplier))
        ? Number(source.confidence.calibrationLossMultiplier)
        : fallback.confidence.calibrationLossMultiplier,
      calibrationMatchesRequired: Math.max(0, safeInteger(source.confidence?.calibrationMatchesRequired, fallback.confidence.calibrationMatchesRequired)),
      firstPlacementStrengthCap: Math.max(0, safeInteger(source.confidence?.firstPlacementStrengthCap, fallback.confidence.firstPlacementStrengthCap)),
    },
    softReset: {
      anchorMmr: migrateLegacyRankDefaults ? DEFAULT_SOFT_RESET.anchorMmr : Math.max(0, safeInteger(source.softReset?.anchorMmr, fallback.softReset.anchorMmr)),
      multiplier: Number.isFinite(Number(source.softReset?.multiplier)) ? Number(source.softReset.multiplier) : fallback.softReset.multiplier,
      floor: migrateLegacyRankDefaults ? DEFAULT_SOFT_RESET.floor : Math.max(0, safeInteger(source.softReset?.floor, fallback.softReset.floor)),
    },
    matchmaking: {
      firstRange: Math.max(0, safeInteger(source.matchmaking?.firstRange, fallback.matchmaking.firstRange)),
      secondRange: Math.max(0, safeInteger(source.matchmaking?.secondRange, fallback.matchmaking.secondRange)),
      expandStartMs: Math.max(1, safeInteger(source.matchmaking?.expandStartMs, fallback.matchmaking.expandStartMs)),
      expandEveryMs: Math.max(1, safeInteger(source.matchmaking?.expandEveryMs, fallback.matchmaking.expandEveryMs)),
      expandStep: Math.max(0, safeInteger(source.matchmaking?.expandStep, fallback.matchmaking.expandStep)),
      expandBase: Math.max(0, safeInteger(source.matchmaking?.expandBase, fallback.matchmaking.expandBase)),
      maxRange: Math.max(0, safeInteger(source.matchmaking?.maxRange, fallback.matchmaking.maxRange)),
    },
    mmrDeltas: normalizeDeltas(source.mmrDeltas || fallback.mmrDeltas),
    leagueBands: normalizeLeagueBands(migrateLegacyRankDefaults ? DEFAULT_LEAGUE_BANDS : source.leagueBands || fallback.leagueBands),
    rewards: normalizeRewards(migrateLegacyRankDefaults ? SEASON_REWARDS : source.rewards || fallback.rewards),
  };
}

function normalizeSeason(input, fallbackConfig = defaultCompetitiveConfig()) {
  const startsAt = Number(input?.startsAt) || now();
  const endsAt = Number(input?.endsAt) || (startsAt + (fallbackConfig.seasonLengthDays * DAY_MS));
  const id = cleanText(input?.id || `season-${new Date(startsAt).toISOString().slice(0, 10)}`, 80);
  return {
    id,
    name: cleanText(input?.name || id, 80),
    startsAt,
    endsAt: Math.max(startsAt + DAY_MS, endsAt),
    rewards: normalizeRewards(input?.rewards || fallbackConfig.rewards),
    status: ['scheduled', 'active', 'ended'].includes(input?.status) ? input.status : 'scheduled',
    createdAt: Number(input?.createdAt) || now(),
    updatedAt: Number(input?.updatedAt) || now(),
  };
}

export function normalizeCompetitiveConfigStore(store = {}) {
  const live = normalizeCompetitiveConfig(store.live);
  store.live = live;
  store.draft = normalizeCompetitiveConfig(store.draft, live);
  store.versions = Array.isArray(store.versions)
    ? store.versions.filter(version => version?.versionId && version?.config).slice(-20)
    : [];
  store.seasons = Array.isArray(store.seasons)
    ? store.seasons.map(season => normalizeSeason(season, live))
    : [];
  return store;
}

export function liveCompetitiveConfig(store) {
  return normalizeCompetitiveConfigStore(store).live;
}

export function draftCompetitiveConfig(store) {
  return normalizeCompetitiveConfigStore(store).draft;
}

export function saveDraftCompetitiveConfig(store, patch = {}) {
  normalizeCompetitiveConfigStore(store);
  store.draft = normalizeCompetitiveConfig({
    ...store.draft,
    ...patch,
    confidence: { ...store.draft.confidence, ...(patch.confidence || {}) },
    softReset: { ...store.draft.softReset, ...(patch.softReset || {}) },
    matchmaking: { ...store.draft.matchmaking, ...(patch.matchmaking || {}) },
    mmrDeltas: patch.mmrDeltas || store.draft.mmrDeltas,
    leagueBands: patch.leagueBands || store.draft.leagueBands,
    rewards: patch.rewards || store.draft.rewards,
  }, store.live);
  return { draft: store.draft };
}

export function validateCompetitiveConfig(input) {
  const config = normalizeCompetitiveConfig(input);
  const errors = [];
  const warnings = [];
  const bands = config.leagueBands;
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const previous = bands[index - 1];
    if (previous && previous.max !== null && band.min !== previous.max + 1) {
      errors.push(`${band.league} must begin immediately after ${previous.league}.`);
    }
    if (band.max !== null && band.max < band.min) errors.push(`${band.league} has an invalid rating band.`);
    if (band.max === null && index !== bands.length - 1) errors.push(`${band.league} can only be open-ended as the final league.`);
  }
  for (const count of [2, 3, 4]) {
    const deltas = config.mmrDeltas[count];
    if (deltas.length !== count) errors.push(`${count}-player finish curve needs ${count} values.`);
    for (let index = 1; index < deltas.length; index += 1) {
      if (deltas[index] > deltas[index - 1]) errors.push(`${count}-player finish rewards must descend from first to last.`);
    }
    if (deltas[0] <= 0 || deltas.at(-1) >= 0) errors.push(`${count}-player curve must reward first and penalize last.`);
  }
  if (config.matchmaking.firstRange > config.matchmaking.secondRange) errors.push('The opening search range cannot exceed the second search range.');
  if (config.matchmaking.secondRange > config.matchmaking.maxRange) errors.push('The second search range cannot exceed the maximum range.');
  if (config.confidence.calibrationGainMultiplier < 1) warnings.push('Calibration wins are not accelerated.');
  if (config.confidence.calibrationLossMultiplier > 1) warnings.push('Calibration losses are amplified.');
  if (config.softReset.multiplier < 0 || config.softReset.multiplier > 1) errors.push('Season reset retention must be between 0 and 1.');
  return { valid: errors.length === 0, errors, warnings, config };
}

export function simulateCompetitiveRating(input = {}, configInput = null) {
  const config = normalizeCompetitiveConfig(configInput);
  const playerCount = [2, 3, 4].includes(safeInteger(input.playerCount, 2)) ? safeInteger(input.playerCount, 2) : 2;
  const mmr = Math.max(0, safeInteger(input.mmr, config.baseMmr));
  const opponentMmr = Math.max(0, safeInteger(input.opponentMmr, mmr));
  const stage = ['placement', 'calibration', 'established'].includes(input.stage) ? input.stage : 'established';
  const delta = previewRankedDelta({
    mmr,
    opponentMmrs: Array(playerCount - 1).fill(opponentMmr),
    playerCount,
    placement: Math.max(1, Math.min(playerCount, Number(input.placement) || 1)),
    placementsPlayed: stage === 'placement' ? 0 : config.placementMatchesRequired,
    placementComplete: stage !== 'placement',
    returningPlacement: stage === 'placement',
    calibrationMatchesPlayed: stage === 'calibration' ? 0 : config.confidence.calibrationMatchesRequired,
  }, config);
  return {
    playerCount,
    placement: Math.max(1, Math.min(playerCount, Number(input.placement) || 1)),
    stage,
    ratingBefore: mmr,
    ratingAfter: Math.max(0, mmr + delta),
    delta,
  };
}

export function publishCompetitiveConfig(store, adminName = 'admin') {
  normalizeCompetitiveConfigStore(store);
  const version = {
    versionId: crypto.randomUUID(),
    publishedAt: now(),
    publishedBy: cleanText(adminName, 80) || 'admin',
    config: clone(store.live),
  };
  store.versions.push(version);
  store.versions = store.versions.slice(-20);
  store.live = normalizeCompetitiveConfig({
    ...store.draft,
    versionId: version.versionId,
    publishedAt: version.publishedAt,
    publishedBy: version.publishedBy,
  }, store.live);
  store.draft = clone(store.live);
  return { live: store.live, version };
}

export function rollbackCompetitiveConfig(store, versionId = null) {
  normalizeCompetitiveConfigStore(store);
  const version = versionId
    ? store.versions.find(item => item.versionId === versionId)
    : store.versions.at(-1);
  if (!version) return { error: 'Competitive config version not found.' };
  store.draft = normalizeCompetitiveConfig(version.config, store.live);
  store.live = normalizeCompetitiveConfig(version.config, store.live);
  return { live: store.live, draft: store.draft, version };
}

export function upsertCompetitiveSeason(store, input = {}) {
  normalizeCompetitiveConfigStore(store);
  const season = normalizeSeason(input, store.live);
  const existingIndex = store.seasons.findIndex(item => item.id === season.id);
  if (existingIndex >= 0) store.seasons[existingIndex] = { ...store.seasons[existingIndex], ...season, updatedAt: now() };
  else store.seasons.push(season);
  store.seasons.sort((a, b) => a.startsAt - b.startsAt);
  return { season };
}

export function activateCompetitiveSeason(store, seasonId) {
  normalizeCompetitiveConfigStore(store);
  const season = store.seasons.find(item => item.id === seasonId);
  if (!season) return { error: 'Season not found.' };
  for (const item of store.seasons) {
    if (item.status === 'active') item.status = 'ended';
  }
  season.status = 'active';
  season.updatedAt = now();
  return { season };
}

export function endCompetitiveSeason(store, seasonId) {
  normalizeCompetitiveConfigStore(store);
  const season = store.seasons.find(item => item.id === seasonId);
  if (!season) return { error: 'Season not found.' };
  season.status = 'ended';
  season.endsAt = Math.min(season.endsAt, now());
  season.updatedAt = now();
  return { season };
}

export function publicCompetitiveAdminConfig(store) {
  normalizeCompetitiveConfigStore(store);
  return {
    live: store.live,
    draft: store.draft,
    versions: store.versions.map(version => ({
      versionId: version.versionId,
      publishedAt: version.publishedAt,
      publishedBy: version.publishedBy,
    })).reverse(),
    seasons: store.seasons,
  };
}
