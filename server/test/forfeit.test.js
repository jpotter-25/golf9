import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeForfeitConfig,
  placementsWithMatchPenalties,
  publicForfeitStatus,
  recordForfeitSettlement,
  resetForfeitDiscipline,
  setRankedForfeitRestriction,
} from '../forfeit.js';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

function rankedEvent(index, now, seasonId = 'season-one') {
  return {
    eventId: `event-${index}`,
    matchId: `match-${index}`,
    roomCode: `R${index}`,
    matchType: 'ranked',
    seasonId,
    confirmedAt: now - 500,
  };
}

test('ranked forfeits escalate rolling restrictions without touching unrelated state', () => {
  const user = { userId: 'player-one' };
  const season = { id: 'season-one', endsAt: 100 * 24 * HOUR_MS };
  const config = normalizeForfeitConfig({});
  const start = 10 * HOUR_MS;

  const first = recordForfeitSettlement(user, rankedEvent(1, start), season, config, start);
  assert.equal(first.status.ranked.lockedUntil, start + (15 * MINUTE_MS));
  const second = recordForfeitSettlement(user, rankedEvent(2, start + MINUTE_MS), season, config, start + MINUTE_MS);
  assert.equal(second.status.ranked.lockedUntil, start + MINUTE_MS + (120 * MINUTE_MS));
  const third = recordForfeitSettlement(user, rankedEvent(3, start + (2 * MINUTE_MS)), season, config, start + (2 * MINUTE_MS));
  assert.equal(third.status.ranked.lockedUntil, start + (2 * MINUTE_MS) + (1440 * MINUTE_MS));
  assert.equal(third.status.ranked.rollingCount, 3);
});

test('season escalation, lift, and full reset are independently manageable', () => {
  const user = { userId: 'player-two' };
  const season = { id: 'season-one', endsAt: 120 * 24 * HOUR_MS };
  const config = normalizeForfeitConfig({});
  const start = 20 * HOUR_MS;
  let outcome;
  for (let index = 1; index <= 5; index += 1) {
    const now = start + (index * MINUTE_MS);
    outcome = recordForfeitSettlement(user, rankedEvent(index, now), season, config, now);
  }
  assert.equal(outcome.status.ranked.seasonCount, 5);
  assert.ok(outcome.status.ranked.lockedUntil >= start + (5 * MINUTE_MS) + (72 * HOUR_MS));

  setRankedForfeitRestriction(user, null, start + (6 * MINUTE_MS));
  assert.equal(publicForfeitStatus(user, season, config, start + (6 * MINUTE_MS)).ranked.restricted, false);
  assert.equal(publicForfeitStatus(user, season, config, start + (6 * MINUTE_MS)).ranked.seasonCount, 5);

  resetForfeitDiscipline(user, start + (7 * MINUTE_MS));
  const reset = publicForfeitStatus(user, season, config, start + (7 * MINUTE_MS));
  assert.equal(reset.ranked.restricted, false);
  assert.equal(reset.ranked.seasonCount, 0);
});

test('forced placements put forfeits below AFK penalties and active players', () => {
  const placements = placementsWithMatchPenalties(
    [90, 10, 5, 40],
    [false, true, false, false],
    [true, false, false, false]
  );
  assert.deepEqual(placements, [4, 3, 1, 2]);
  assert.deepEqual(
    placementsWithMatchPenalties([40, 20, 10, 5], [false, false, false, false], [true, true, false, false]),
    [4, 4, 2, 1]
  );
});
