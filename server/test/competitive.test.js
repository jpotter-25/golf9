import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activateCompetitiveSeason,
  endCompetitiveSeason,
  liveCompetitiveConfig,
  normalizeCompetitiveConfigStore,
  publishCompetitiveConfig,
  rollbackCompetitiveConfig,
  saveDraftCompetitiveConfig,
  simulateCompetitiveRating,
  upsertCompetitiveSeason,
  validateCompetitiveConfig,
} from '../competitive.js';
import {
  leagueForMmr,
  normalizeCompetitiveState,
  normalizeRankedSeason,
  previewRankedDelta,
} from '../ranked.js';

function user(overrides = {}) {
  return {
    userId: 'competitive-user',
    displayName: 'CompetitiveUser',
    inventory: { cosmetics: ['classic-card-back'], equipped: {} },
    ...overrides,
  };
}

test('competitive config seeds from current ranked defaults', () => {
  const store = normalizeCompetitiveConfigStore({});
  const config = liveCompetitiveConfig(store);

  assert.equal(config.placementMatchesRequired, 5);
  assert.equal(config.baseMmr, 0);
  assert.equal(config.confidence.returningPlacementMultiplier, 1.35);
  assert.equal(config.confidence.calibrationMatchesRequired, 10);
  assert.deepEqual(config.mmrDeltas[4], [36, 12, -12, -36]);
  assert.equal(leagueForMmr(config.baseMmr, config).name, 'Iron III');
  assert.equal(previewRankedDelta({
    mmr: 1000,
    opponentMmrs: [1000],
    playerCount: 2,
    placement: 1,
    total: 18,
    columnClears: 1,
    placementsPlayed: 5,
  }, config), 24);
});

test('draft competitive edits do not affect live ranked behavior until published', () => {
  const store = normalizeCompetitiveConfigStore({});
  const liveBefore = liveCompetitiveConfig(store);
  saveDraftCompetitiveConfig(store, {
    placementMatchesRequired: 7,
    mmrDeltas: { 2: [50, -5], 3: [50, 0, -5], 4: [50, 15, 0, -5] },
  });

  assert.equal(liveCompetitiveConfig(store).placementMatchesRequired, liveBefore.placementMatchesRequired);
  assert.equal(previewRankedDelta({
    mmr: 1000,
    opponentMmrs: [1000],
    playerCount: 2,
    placement: 1,
    total: 80,
    columnClears: 0,
    placementsPlayed: 5,
  }, liveCompetitiveConfig(store)), 24);

  publishCompetitiveConfig(store, 'tester');
  assert.equal(liveCompetitiveConfig(store).placementMatchesRequired, 7);
  assert.equal(previewRankedDelta({
    mmr: 1000,
    opponentMmrs: [1000],
    playerCount: 2,
    placement: 1,
    total: 80,
    columnClears: 0,
    placementsPlayed: 7,
  }, liveCompetitiveConfig(store)), 50);
});

test('competitive preflight rejects malformed finish curves and search ranges', () => {
  const result = validateCompetitiveConfig({
    mmrDeltas: {
      2: [-5, 5],
      3: [30, 6, -36],
      4: [36, 12, -12, -36],
    },
    matchmaking: {
      firstRange: 500,
      secondRange: 200,
      maxRange: 300,
    },
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes('2-player')));
  assert.ok(result.errors.some(error => error.includes('opening search range')));
});

test('competitive simulator exposes exact admin-only outcome math by confidence stage', () => {
  const established = simulateCompetitiveRating({
    playerCount: 4,
    placement: 1,
    stage: 'established',
    mmr: 1200,
    opponentMmr: 1200,
  });
  const calibration = simulateCompetitiveRating({
    playerCount: 2,
    placement: 1,
    stage: 'calibration',
    mmr: 1200,
    opponentMmr: 1200,
  });
  const returningPlacement = simulateCompetitiveRating({
    playerCount: 2,
    placement: 1,
    stage: 'placement',
    mmr: 1200,
    opponentMmr: 1200,
  });

  assert.equal(established.delta, 36);
  assert.equal(calibration.delta, 28);
  assert.equal(returningPlacement.delta, 32);
});

test('competitive rollback restores previous live config', () => {
  const store = normalizeCompetitiveConfigStore({});
  saveDraftCompetitiveConfig(store, { placementMatchesRequired: 9 });
  const published = publishCompetitiveConfig(store, 'tester');
  assert.equal(liveCompetitiveConfig(store).placementMatchesRequired, 9);

  const result = rollbackCompetitiveConfig(store, published.version.versionId);
  assert.equal(result.error, undefined);
  assert.equal(liveCompetitiveConfig(store).placementMatchesRequired, 5);
});

test('season activation and ending drive ranked soft reset behavior', () => {
  const store = normalizeCompetitiveConfigStore({});
  const startsAt = 1000;
  const endsAt = startsAt + 90 * 24 * 60 * 60 * 1000;
  const { season } = upsertCompetitiveSeason(store, { id: 's2', name: 'Season 2', startsAt, endsAt });
  assert.equal(activateCompetitiveSeason(store, season.id).season.status, 'active');

  const config = liveCompetitiveConfig(store);
  const account = user({ competitive: { seasonId: 's1', mmr: 3000, seasonBestMmr: 3500, placementsPlayed: 5, claimedSeasonRewards: ['old'], matchHistory: [{ matchId: 'old' }] } });
  const rankedSeason = normalizeRankedSeason(season, 2000, config);
  normalizeCompetitiveState(account, rankedSeason, config);

  assert.equal(account.competitive.seasonId, 's2');
  assert.equal(account.competitive.mmr, 1650);
  assert.equal(account.competitive.placementsPlayed, 0);
  assert.deepEqual(account.competitive.claimedSeasonRewards, []);

  const ended = endCompetitiveSeason(store, season.id);
  assert.equal(ended.season.status, 'ended');
});
