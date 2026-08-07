import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildClubStandings,
  clubIdForStandingPlayer,
  clubStandingPeriodWindow,
  isEligibleClubVictory,
  utcClubStandingWeekStart,
} from '../clubStandings.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 7, 5, 12);
const weekStart = utcClubStandingWeekStart(now);
const season = {
  id: 'season-test',
  name: 'Test Season',
  startsAt: weekStart - (14 * DAY_MS),
  endsAt: weekStart + (30 * DAY_MS),
};

const clubs = [
  { clubId: 'c1', name: 'First Club', tag: 'ONE', progression: { level: 3 }, members: [{ userId: 'u1' }, { userId: 'u2' }] },
  { clubId: 'c2', name: 'Second Club', tag: 'TWO', progression: { level: 2 }, members: [{ userId: 'u3' }, { userId: 'u4' }] },
  { clubId: 'c3', name: 'Third Club', tag: 'THR', progression: { level: 1 }, members: [{ userId: 'u5' }] },
  { clubId: 'c4', name: 'Quiet Club', tag: 'QUI', progression: { level: 1 }, members: [] },
];

function rankedResult(id, completedAt, players) {
  return { resultId: id, completedAt, mode: 'online', matchType: 'ranked', players };
}

const results = [
  rankedResult('weekly-one', weekStart + DAY_MS, [
    { userId: 'u1', won: true, clubIdAtMatchStart: 'c1' },
    { userId: 'u2', won: true, clubIdAtMatchStart: 'c1' },
    { userId: 'u3', won: false, clubIdAtMatchStart: 'c2' },
  ]),
  rankedResult('weekly-two', weekStart + (2 * DAY_MS), [
    { userId: 'u4', won: true, leaderboard: { clubId: 'c2' } },
    { userId: 'u3', won: true, progression: { club: { club: { clubId: 'c2' } } } },
    { userId: 'u5', won: true, clubIdAtMatchStart: 'c3', afk: { penaltyApplied: true } },
    { userId: 'u6', won: true, clubIdAtMatchStart: 'c1', forfeited: true },
  ]),
  rankedResult('older-ranked', weekStart - DAY_MS, [
    { userId: 'u5', won: true, progression: { club: { club: { clubId: 'c3' } } } },
  ]),
  { resultId: 'casual', completedAt: weekStart + DAY_MS, mode: 'online', matchType: 'casual', players: [{ userId: 'u5', won: true, clubIdAtMatchStart: 'c3' }] },
];

test('club-standing windows use Monday UTC, the active season, and open all-time bounds', () => {
  assert.equal(weekStart, Date.UTC(2026, 7, 3));
  assert.deepEqual(clubStandingPeriodWindow('weekly', season, now), {
    key: 'weekly',
    label: 'This Week',
    startsAt: weekStart,
    endsAt: weekStart + (7 * DAY_MS),
  });
  assert.equal(clubStandingPeriodWindow('seasonal', season, now).startsAt, season.startsAt);
  assert.equal(clubStandingPeriodWindow('seasonal', season, now).endsAt, season.endsAt);
  assert.equal(clubStandingPeriodWindow('all_time', season, now).startsAt, null);
});

test('club attribution prefers the match-start snapshot and supports historical result shapes', () => {
  assert.equal(clubIdForStandingPlayer({ clubIdAtMatchStart: 'new', leaderboard: { clubId: 'old' } }), 'new');
  assert.equal(clubIdForStandingPlayer({ leaderboard: { clubId: 'legacy' } }), 'legacy');
  assert.equal(clubIdForStandingPlayer({ progression: { club: { club: { clubId: 'nested' } } } }), 'nested');
});

test('victories exclude forfeited and AFK-penalized winners', () => {
  assert.equal(isEligibleClubVictory({ won: true }), true);
  assert.equal(isEligibleClubVictory({ won: true, forfeited: true }), false);
  assert.equal(isEligibleClubVictory({ won: true, afk: { penaltyApplied: true } }), false);
  assert.equal(isEligibleClubVictory({ won: true, afk: { forcedRankedLast: true } }), false);
});

test('weekly standings count one victory per winning member and share ranks on equal victory totals', () => {
  const weekly = buildClubStandings({ period: 'weekly', clubs, results, viewerClubId: 'c3', season, now });
  assert.deepEqual(weekly.entries.map(entry => [entry.clubId, entry.victories, entry.rankedResults, entry.losses, entry.rank]), [
    ['c1', 2, 3, 1, 1],
    ['c2', 2, 3, 1, 1],
    ['c3', 0, 1, 1, 3],
  ]);
  assert.equal(weekly.viewer.clubId, 'c3');
  assert.equal(weekly.viewer.rank, 3);
  assert.equal(weekly.criteria.key, 'ranked_victories');
});

test('seasonal and all-time standings include older Ranked history while quiet viewer clubs remain unranked', () => {
  const seasonal = buildClubStandings({ period: 'seasonal', clubs, results, viewerClubId: 'c3', season, now });
  assert.equal(seasonal.entries.find(entry => entry.clubId === 'c3').victories, 1);

  const allTime = buildClubStandings({ period: 'all_time', clubs, results, viewerClubId: 'c4', season, now });
  assert.equal(allTime.entries.find(entry => entry.clubId === 'c3').rank, 3);
  assert.equal(allTime.viewer.clubId, 'c4');
  assert.equal(allTime.viewer.rank, null);
  assert.equal(allTime.viewer.rankedResults, 0);
});
