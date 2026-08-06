import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLeaderboard,
  leaderboardPeriodWindow,
  leaderboardPointsForPlayer,
  utcLeaderboardWeekStart,
} from '../leaderboards.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 7, 5, 12);
const weekStart = utcLeaderboardWeekStart(now);
const season = {
  id: 'season-test',
  name: 'Test Season',
  startsAt: weekStart - (14 * DAY_MS),
  endsAt: weekStart + (30 * DAY_MS),
};

const users = [
  { userId: 'u1', displayName: 'Alpha', clubId: 'c1' },
  { userId: 'u2', displayName: 'Bravo', clubId: 'c1' },
  { userId: 'u3', displayName: 'Charlie', clubId: 'c2' },
  { userId: 'hidden', displayName: 'Hidden', clubId: null, archived: true },
];

const clubs = [
  {
    clubId: 'c1',
    name: 'First Club',
    tag: 'ONE',
    progression: { level: 3 },
    branding: { primaryColor: '#111111' },
    members: [
      { userId: 'u1', role: 'owner' },
      { userId: 'u2', role: 'member' },
    ],
  },
  {
    clubId: 'c2',
    name: 'Second Club',
    tag: 'TWO',
    progression: { level: 2 },
    branding: { primaryColor: '#222222' },
    members: [{ userId: 'u3', role: 'owner' }],
  },
];

function onlineResult({ id, completedAt, matchType = 'casual', players }) {
  return { resultId: id, completedAt, mode: 'online', matchType, players };
}

function player(userId, total, won, clubId, extra = {}) {
  return {
    userId,
    displayName: userId,
    total,
    won,
    progression: clubId ? { club: { club: { clubId } } } : {},
    ...extra,
  };
}

const results = [
  onlineResult({
    id: 'old-season',
    completedAt: weekStart - DAY_MS,
    players: [player('u1', 0, true, 'c1')],
  }),
  onlineResult({
    id: 'weekly-ranked',
    completedAt: weekStart + DAY_MS,
    matchType: 'ranked',
    players: [player('u1', 10, true, 'c1')],
  }),
  onlineResult({
    id: 'weekly-casual',
    completedAt: weekStart + (2 * DAY_MS),
    players: [player('u2', 50, false, 'c1')],
  }),
  onlineResult({
    id: 'weekly-wager',
    completedAt: weekStart + (2 * DAY_MS),
    matchType: 'wager',
    players: [player('u3', 20, true, 'c2')],
  }),
  onlineResult({
    id: 'weekly-forfeit',
    completedAt: weekStart + (2 * DAY_MS),
    players: [player('u1', -20, true, 'c1', { forfeited: true })],
  }),
  {
    resultId: 'offline',
    completedAt: weekStart + (2 * DAY_MS),
    mode: 'solo',
    players: [player('u1', 0, true, null)],
  },
  onlineResult({
    id: 'hidden-player',
    completedAt: weekStart + (2 * DAY_MS),
    players: [player('hidden', 0, true, null)],
  }),
];

test('leaderboard period windows use Monday UTC, current season, and open all-time bounds', () => {
  assert.equal(weekStart, Date.UTC(2026, 7, 3));
  assert.deepEqual(leaderboardPeriodWindow('weekly', season, now), {
    key: 'weekly',
    label: 'This Week',
    startsAt: weekStart,
    endsAt: weekStart + (7 * DAY_MS),
  });
  assert.equal(leaderboardPeriodWindow('seasonal', season, now).startsAt, season.startsAt);
  assert.equal(leaderboardPeriodWindow('seasonal', season, now).endsAt, season.endsAt);
  assert.equal(leaderboardPeriodWindow('all_time', season, now).startsAt, null);
});
test('leaderboard scoring rewards completed online performance and excludes offline games and forfeits', () => {
  assert.equal(leaderboardPointsForPlayer(results[1], results[1].players[0]), 300);
  assert.equal(leaderboardPointsForPlayer(results[2], results[2].players[0]), 110);
  assert.equal(leaderboardPointsForPlayer(results[3], results[3].players[0]), 265);
  assert.equal(leaderboardPointsForPlayer(results[4], results[4].players[0]), 0);
  assert.equal(leaderboardPointsForPlayer(results[5], results[5].players[0]), 0);
});

test('individual leaderboard separates weekly and seasonal results and hides archived users', () => {
  const weekly = buildLeaderboard({
    scope: 'individual',
    period: 'weekly',
    users,
    clubs,
    results,
    viewerUserId: 'u2',
    season,
    now,
    isUserVisible: user => !user.archived,
  });
  assert.deepEqual(weekly.entries.map(entry => [entry.userId, entry.score, entry.rank]), [
    ['u1', 300, 1],
    ['u3', 265, 2],
    ['u2', 110, 3],
  ]);
  assert.equal(weekly.viewer.userId, 'u2');
  assert.equal(weekly.viewer.rank, 3);
  assert.equal(weekly.entries.some(entry => entry.userId === 'hidden'), false);

  const seasonal = buildLeaderboard({ scope: 'individual', period: 'seasonal', users, clubs, results, viewerUserId: 'u1', season, now });
  assert.equal(seasonal.entries.find(entry => entry.userId === 'u1').score, 560);
});

test('club leaderboard credits the club represented when each result was completed', () => {
  const weekly = buildLeaderboard({ scope: 'clubs', period: 'weekly', users, clubs, results, viewerUserId: 'u1', season, now });
  assert.deepEqual(weekly.entries.map(entry => [entry.clubId, entry.score]), [
    ['c1', 410],
    ['c2', 265],
  ]);
  assert.equal(weekly.viewer.clubId, 'c1');

  const allTime = buildLeaderboard({ scope: 'clubs', period: 'all_time', users, clubs, results, viewerUserId: 'u1', season, now });
  assert.equal(allTime.entries.find(entry => entry.clubId === 'c1').score, 670);
});

test('club-member leaderboard includes current members and their period contribution to the current club', () => {
  const weekly = buildLeaderboard({ scope: 'club_members', period: 'weekly', users, clubs, results, viewerUserId: 'u2', season, now });
  assert.equal(weekly.subject.clubId, 'c1');
  assert.deepEqual(weekly.entries.map(entry => [entry.userId, entry.score, entry.role]), [
    ['u1', 300, 'owner'],
    ['u2', 110, 'member'],
  ]);
  assert.equal(weekly.viewer.rank, 2);

  const noClub = buildLeaderboard({ scope: 'club_members', period: 'weekly', users, clubs, results, viewerUserId: 'hidden', season, now });
  assert.equal(noClub.subject, null);
  assert.deepEqual(noClub.entries, []);
});
