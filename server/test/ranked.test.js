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
  publicCompetitiveState,
  rankedDisplayEmblemChoices,
  resolveDisplayRankEmblem,
  setDisplayRankEmblem,
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

test('ranked delta uses finish curves, hidden confidence stages, and no score bonuses', () => {
  const normalDelta = previewRankedDelta({
    mmr: 1000,
    opponentMmrs: [1000],
    playerCount: 2,
    placement: 1,
    total: 18,
    columnClears: 1,
    placementsPlayed: 5,
    placementComplete: true,
    calibrationMatchesPlayed: 10,
  });
  const sameFinishDifferentScore = previewRankedDelta({
    mmr: 1000,
    opponentMmrs: [1000],
    playerCount: 2,
    placement: 1,
    total: 180,
    columnClears: 0,
    placementsPlayed: 5,
    placementComplete: true,
    calibrationMatchesPlayed: 10,
  });
  const calibrationWin = previewRankedDelta({
    mmr: 1000,
    opponentMmrs: [1000],
    playerCount: 2,
    placement: 1,
    placementComplete: true,
    calibrationMatchesPlayed: 0,
  });
  const calibrationLoss = previewRankedDelta({
    mmr: 1000,
    opponentMmrs: [1000],
    playerCount: 2,
    placement: 2,
    placementComplete: true,
    calibrationMatchesPlayed: 0,
  });
  const returningPlacementWin = previewRankedDelta({
    mmr: 1000,
    opponentMmrs: [1000],
    playerCount: 2,
    placement: 1,
    placementsPlayed: 0,
    placementComplete: false,
    returningPlacement: true,
  });

  assert.equal(normalDelta, 24);
  assert.equal(sameFinishDifferentScore, normalDelta);
  assert.equal(calibrationWin, 28);
  assert.equal(calibrationLoss, -22);
  assert.equal(returningPlacementWin, 32);
  assert.equal(placementForTotals([10, 10, 30], 0), 1.5);
  assert.equal(placementForTotals([10, 10, 30], 2), 3);
});

test('strength adjustment is capped and cannot reverse an outcome sign', () => {
  const strongFieldWin = previewRankedDelta({
    mmr: 1000,
    opponentMmrs: [5000],
    playerCount: 2,
    placement: 1,
  });
  const strongFieldLoss = previewRankedDelta({
    mmr: 1000,
    opponentMmrs: [5000],
    playerCount: 2,
    placement: 2,
  });
  const extremeConfig = { strengthAdjustmentCap: 1000 };
  const overmatchedFavoriteWin = previewRankedDelta({
    mmr: 10000,
    opponentMmrs: [0],
    playerCount: 2,
    placement: 1,
  }, extremeConfig);
  const overmatchedUnderdogLoss = previewRankedDelta({
    mmr: 0,
    opponentMmrs: [10000],
    playerCount: 2,
    placement: 2,
  }, extremeConfig);

  assert.equal(strongFieldWin, 32);
  assert.equal(strongFieldLoss, -16);
  assert.equal(overmatchedFavoriteWin, 1);
  assert.equal(overmatchedUnderdogLoss, -1);
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

test('ranked match result updates internal rating while returning only public rank changes', () => {
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

  assert.equal(Object.hasOwn(result, 'mmrBefore'), false);
  assert.equal(Object.hasOwn(result, 'mmrAfter'), false);
  assert.equal(Object.hasOwn(result, 'mmrDelta'), false);
  assert.equal(account.competitive.rankedGames, 1);
  assert.equal(account.competitive.wins, 1);
  assert.equal(account.competitive.placementsPlayed, 1);
  assert.equal(account.competitive.matchHistory.length, 1);
  assert.equal(account.competitive.matchHistory[0].matchId, 'match-one');
  assert.equal(account.competitive.mmr, 0);
  assert.equal(result.leagueBefore.name, 'Unranked');
  assert.equal(result.leagueAfter.name, 'Unranked');
});

test('first placement stays unranked for four games and maps a perfect set to Gold I', () => {
  const season = normalizeRankedSeason({ id: 's1', name: 'Season 1', startsAt: 1000, endsAt: 1000 + 90 * 24 * 60 * 60 * 1000 }, 2000);
  const account = user();

  for (let index = 0; index < 5; index += 1) {
    const result = applyRankedMatchResult(account, {
      matchId: `placement-${index}`,
      playerCount: 2,
      placement: 1,
      total: 10,
      opponentMmrs: [0],
    }, season, 3000 + index);
    if (index < 4) {
      assert.equal(result.placementComplete, false);
      assert.equal(result.leagueAfter.name, 'Unranked');
      assert.equal(account.competitiveByPlayers['2'].mmr, 0);
    }
  }

  assert.equal(account.competitiveByPlayers['2'].placementComplete, true);
  assert.equal(account.competitiveByPlayers['2'].mmr, 3199);
  assert.equal(account.competitiveByPlayers['2'].league.name, 'Gold I');
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
  const twoPlayerMmr = account.competitiveByPlayers['2'].mmr;
  const fourPlayer = applyRankedMatchResult(account, {
    matchId: 'four-player-match',
    roomCode: 'FOUR',
    playerCount: 4,
    placement: 4,
    total: 72,
    opponentMmrs: [1000, 1000, 1000],
    columnClears: 0,
  }, season, 4000);
  const fourPlayerMmr = account.competitiveByPlayers['4'].mmr;

  assert.equal(twoPlayer.playerCount, 2);
  assert.equal(fourPlayer.playerCount, 4);
  assert.equal(account.competitiveByPlayers['2'].mmr, twoPlayerMmr);
  assert.equal(account.competitiveByPlayers['4'].mmr, fourPlayerMmr);
  assert.equal(account.competitiveByPlayers['3'].mmr, 0);
  assert.equal(account.competitiveByPlayers['2'].placementsPlayed, 1);
  assert.equal(account.competitiveByPlayers['4'].placementsPlayed, 1);
  assert.equal(account.competitiveByPlayers['3'].placementsPlayed, 0);
  assert.equal(account.competitiveByPlayers['2'].matchHistory[0].matchId, 'two-player-match');
  assert.equal(account.competitiveByPlayers['4'].matchHistory[0].matchId, 'four-player-match');
});

test('legacy ranked records preserve ratings and infer hidden calibration progress', () => {
  const season = normalizeRankedSeason({ id: 's1', name: 'Season 1', startsAt: 1000, endsAt: 1000 + 90 * 24 * 60 * 60 * 1000 }, 2000);
  const account = user({
    competitive: {
      seasonId: 's1',
      mmr: 2500,
      seasonBestMmr: 2700,
      careerBestMmr: 3000,
      placementsPlayed: 5,
      rankedGames: 12,
      claimedSeasonRewards: [],
      matchHistory: [],
    },
  });

  normalizeCompetitiveState(account, season);

  assert.equal(account.competitive.mmr, 2500);
  assert.equal(account.competitive.seasonBestMmr, 2700);
  assert.equal(account.competitive.careerBestMmr, 3000);
  assert.equal(account.competitive.calibrationMatchesPlayed, 7);
  assert.equal(account.competitive.confidenceStage, 'calibration');
});

test('public ranked state excludes ratings, formulas, deltas, and confidence internals', () => {
  const season = normalizeRankedSeason({ id: 's1', name: 'Season 1', startsAt: 1000, endsAt: 1000 + 90 * 24 * 60 * 60 * 1000 }, 2000);
  const account = user({
    competitive: {
      seasonId: 's1',
      mmr: 1800,
      seasonBestMmr: 2000,
      careerBestMmr: 2200,
      placementsPlayed: 5,
      placementComplete: true,
      hasCompletedInitialPlacement: true,
      rankedGames: 8,
      calibrationMatchesPlayed: 3,
      matchHistory: [{
        matchId: 'private-rating-match',
        playerCount: 2,
        placement: 1,
        total: 10,
        mmrBefore: 1776,
        mmrAfter: 1800,
        delta: 24,
        leagueBefore: leagueForMmr(1776),
        leagueAfter: leagueForMmr(1800),
      }],
    },
  });

  const publicState = publicCompetitiveState(account, season);

  for (const privateKey of ['mmr', 'seasonBestMmr', 'careerBestMmr', 'calibrationMatchesPlayed', 'calibrationMatchesRequired', 'confidenceStage']) {
    assert.equal(Object.hasOwn(publicState, privateKey), false);
  }
  assert.equal(publicState.league.name, 'Silver III');
  assert.equal(Object.hasOwn(publicState.matchHistory[0], 'delta'), false);
  assert.equal(Object.hasOwn(publicState.matchHistory[0], 'mmrAfter'), false);
  assert.equal(Object.hasOwn(publicState.season.rewards[0], 'minMmr'), false);
});

test('players can display only earned current or career-best rank emblems', () => {
  const season = normalizeRankedSeason({ id: 's1', name: 'Season 1', startsAt: 1000, endsAt: 1000 + 90 * 24 * 60 * 60 * 1000 }, 2000);
  const account = user({
    competitiveByPlayers: {
      2: {
        seasonId: 's1', mmr: 1000, seasonBestMmr: 1000, careerBestMmr: 1800,
        placementsPlayed: 5, placementComplete: true, hasCompletedInitialPlacement: true,
      },
      3: { seasonId: 's1', placementsPlayed: 2, placementComplete: false },
      4: {
        seasonId: 's1', mmr: 2600, seasonBestMmr: 2600, careerBestMmr: 3200,
        placementsPlayed: 5, placementComplete: true, hasCompletedInitialPlacement: true,
      },
    },
  });

  assert.equal(resolveDisplayRankEmblem(account, season), null);
  const choices = rankedDisplayEmblemChoices(account, season);
  assert.ok(choices.some(choice => choice.playerCount === 2 && choice.source === 'current'));
  assert.ok(choices.some(choice => choice.playerCount === 4 && choice.source === 'careerBest'));
  assert.equal(choices.some(choice => choice.playerCount === 3), false);

  const selected = setDisplayRankEmblem(account, { playerCount: 4, source: 'current' }, season);
  assert.equal(selected.displayRankEmblem.league.name, 'Gold III');
  assert.equal(resolveDisplayRankEmblem(account, season).playerCount, 4);
  assert.ok(setDisplayRankEmblem(account, { playerCount: 3, source: 'current' }, season).error);
  assert.equal(setDisplayRankEmblem(account, null, season).displayRankEmblem, null);
});

test('display emblem choices preserve the ladder identity for matching ranks', () => {
  const season = normalizeRankedSeason({ id: 's1', name: 'Season 1', startsAt: 1000, endsAt: 1000 + 90 * 24 * 60 * 60 * 1000 }, 2000);
  const completed = {
    seasonId: 's1', mmr: 1000, seasonBestMmr: 1000, careerBestMmr: 1000,
    placementsPlayed: 5, placementComplete: true, hasCompletedInitialPlacement: true,
  };
  const account = user({ competitiveByPlayers: { 2: completed, 3: completed } });
  const choices = rankedDisplayEmblemChoices(account, season);

  assert.ok(choices.some(choice => choice.playerCount === 2 && choice.league.name !== 'Unranked'));
  assert.ok(choices.some(choice => choice.playerCount === 3 && choice.league.name !== 'Unranked'));
  assert.equal(choices.filter(choice => choice.playerCount === 2).length, 1);
  assert.equal(choices.filter(choice => choice.playerCount === 3).length, 1);
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
