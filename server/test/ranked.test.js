import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyRankedMatchResult,
  claimSeasonRewards,
  leagueForMmr,
  matchmakingRangeFor,
  normalizeCompetitiveState,
  normalizeRankedSeason,
  placementForTotals,
  previewRankedDelta,
} from '../ranked.js';

function user(overrides = {}) {
  return {
    userId: 'ranked-user',
    displayName: 'RankedUser',
    inventory: { cosmetics: ['classic-card-back'], equipped: {} },
    ...overrides,
  };
}

test('league thresholds and divisions match the ranked plan', () => {
  assert.equal(leagueForMmr(0).name, 'Iron III');
  assert.equal(leagueForMmr(799).name, 'Iron I');
  assert.equal(leagueForMmr(800).name, 'Bronze III');
  assert.equal(leagueForMmr(1599).name, 'Bronze I');
  assert.equal(leagueForMmr(1600).name, 'Silver III');
  assert.equal(leagueForMmr(3199).name, 'Gold I');
  assert.equal(leagueForMmr(4800).name, 'Master');
  assert.equal(leagueForMmr(5400).name, 'Grandmaster');
  assert.equal(leagueForMmr(6000).name, 'Legend');
});

test('legacy profiles receive default ranked state', () => {
  const season = normalizeRankedSeason({ id: 's1', name: 'Season 1', startsAt: 1000, endsAt: 1000 + 90 * 24 * 60 * 60 * 1000 }, 2000);
  const account = user();
  normalizeCompetitiveState(account, season);

  assert.equal(account.competitive.mmr, 0);
  assert.equal(account.competitive.placementsPlayed, 0);
  assert.equal(account.competitive.placementMatchesRequired, 5);
  assert.equal(account.competitive.league.name, 'Iron III');
  assert.equal(account.competitive.seasonId, 's1');
});

test('ranked delta is deterministic and placement matches move faster', () => {
  const placementDelta = previewRankedDelta({
    mmr: 1000,
    opponentMmrs: [1000],
    playerCount: 2,
    placement: 1,
    total: 18,
    columnClears: 1,
    placementsPlayed: 0,
  });
  const normalDelta = previewRankedDelta({
    mmr: 1000,
    opponentMmrs: [1000],
    playerCount: 2,
    placement: 1,
    total: 18,
    columnClears: 1,
    placementsPlayed: 5,
  });

  assert.equal(placementDelta, Math.round(normalDelta * 1.25));
  assert.equal(placementForTotals([10, 10, 30], 0), 1.5);
  assert.equal(placementForTotals([10, 10, 30], 2), 3);
});

test('new ranked seasons soft reset instead of hard reset', () => {
  const nextSeason = normalizeRankedSeason({ id: 's2', name: 'Season 2', startsAt: 1000, endsAt: 1000 + 90 * 24 * 60 * 60 * 1000 }, 2000);
  const account = user({ competitive: { seasonId: 's1', mmr: 3000, seasonBestMmr: 3500, placementsPlayed: 5, claimedSeasonRewards: ['old'], matchHistory: [{ matchId: 'old' }] } });
  normalizeCompetitiveState(account, nextSeason);

  assert.equal(account.competitive.mmr, 1650);
  assert.equal(account.competitive.placementsPlayed, 0);
  assert.deepEqual(account.competitive.claimedSeasonRewards, []);
  assert.deepEqual(account.competitive.matchHistory, []);
});

test('ranked match result updates MMR, placement progress, and history once per call', () => {
  const season = normalizeRankedSeason({ id: 's1', name: 'Season 1', startsAt: 1000, endsAt: 1000 + 90 * 24 * 60 * 60 * 1000 }, 2000);
  const account = user();
  const result = applyRankedMatchResult(account, {
    matchId: 'match-one',
    roomCode: 'ABCD',
    playerCount: 2,
    placement: 1,
    total: 12,
    opponentMmrs: [1000],
    columnClears: 2,
  }, season, 3000);

  assert.equal(result.mmrBefore, 0);
  assert.equal(account.competitive.rankedGames, 1);
  assert.equal(account.competitive.wins, 1);
  assert.equal(account.competitive.placementsPlayed, 1);
  assert.equal(account.competitive.matchHistory.length, 1);
  assert.equal(account.competitive.matchHistory[0].matchId, 'match-one');
  assert.equal(account.competitive.mmr, result.mmrAfter);
  assert.ok(result.mmrDelta > 0);
});

test('ranked ladders are separate by player count', () => {
  const season = normalizeRankedSeason({ id: 's1', name: 'Season 1', startsAt: 1000, endsAt: 1000 + 90 * 24 * 60 * 60 * 1000 }, 2000);
  const account = user();
  const twoPlayer = applyRankedMatchResult(account, {
    matchId: 'two-player-match',
    roomCode: 'TWO2',
    playerCount: 2,
    placement: 1,
    total: 12,
    opponentMmrs: [1000],
    columnClears: 1,
  }, season, 3000);
  const fourPlayer = applyRankedMatchResult(account, {
    matchId: 'four-player-match',
    roomCode: 'FOUR',
    playerCount: 4,
    placement: 4,
    total: 72,
    opponentMmrs: [1000, 1000, 1000],
    columnClears: 0,
  }, season, 4000);

  assert.equal(account.competitiveByPlayers['2'].mmr, twoPlayer.mmrAfter);
  assert.equal(account.competitiveByPlayers['4'].mmr, fourPlayer.mmrAfter);
  assert.equal(account.competitiveByPlayers['3'].mmr, 0);
  assert.notEqual(account.competitiveByPlayers['2'].mmr, account.competitiveByPlayers['4'].mmr);
});

test('matchmaking range expands with queue time', () => {
  assert.equal(matchmakingRangeFor(1000, 1000 + 20_000), 100);
  assert.equal(matchmakingRangeFor(1000, 1000 + 45_000), 200);
  assert.equal(matchmakingRangeFor(1000, 1000 + 90_000), 400);
  assert.equal(matchmakingRangeFor(1000, 1000 + 10 * 60_000), 800);
});

test('season reward claim unlocks ranked shop eligibility without granting cosmetics', () => {
  const season = normalizeRankedSeason({ id: 's1', name: 'Season 1', startsAt: 1000, endsAt: 1000 + 90 * 24 * 60 * 60 * 1000 }, 2000);
  const account = user({ competitive: { seasonId: 's1', mmr: 2500, seasonBestMmr: 2500, placementsPlayed: 5, claimedSeasonRewards: [], matchHistory: [] } });
  normalizeCompetitiveState(account, season);

  const first = claimSeasonRewards(account, season);
  const second = claimSeasonRewards(account, season);

  assert.ok(first.granted.some(item => item.cosmeticId === 's1-gold-card-back'));
  assert.equal(account.inventory.cosmetics.includes('s1-gold-card-back'), false);
  assert.equal(second.granted.length, 0);
});
