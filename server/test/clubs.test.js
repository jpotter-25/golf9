import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyClubMatchContribution,
  claimClubReward,
  clubProgressionSnapshot,
  createClubRecord,
  findClubMember,
  memberCapForLevel,
  normalizeClubRecord,
} from '../clubs.js';

test('club levels and member caps scale at planned thresholds', () => {
  assert.equal(memberCapForLevel(1), 15);
  assert.equal(memberCapForLevel(3), 20);
  assert.equal(memberCapForLevel(5), 30);
  assert.equal(memberCapForLevel(8), 40);
  assert.equal(memberCapForLevel(12), 50);
  assert.equal(clubProgressionSnapshot(0).level, 1);
  assert.equal(clubProgressionSnapshot(3500).level, 3);
  assert.equal(clubProgressionSnapshot(57000).memberCap, 50);
});

test('club creation normalizes branding, owner, goals, and public capacity', () => {
  const owner = { userId: 'owner-1', displayName: 'Owner' };
  const { club, error } = createClubRecord(owner, {
    clubId: 'club-1',
    name: 'Fairway Friends',
    tag: 'ff9!',
    motto: 'Low totals together',
    branding: { colorPair: 'gold', badgeShape: 'crest', bannerStyle: 'champion' },
  }, 1000);

  assert.equal(error, undefined);
  assert.equal(club.name, 'Fairway Friends');
  assert.equal(club.tag, 'FF9');
  assert.equal(club.branding.colorPair, 'gold');
  assert.equal(club.members[0].role, 'owner');
  assert.equal(club.goals.weekly.items.length, 3);
  assert.equal(club.progression.memberCap, 15);
});

test('club match contribution updates xp, goals, event score, and does not duplicate', () => {
  const owner = { userId: 'owner-1', displayName: 'Owner' };
  const { club } = createClubRecord(owner, { clubId: 'club-1', name: 'Goal Club', tag: 'GOAL' }, 1000);
  const first = applyClubMatchContribution(club, {
    resultId: 'result-1',
    completedAt: 2000,
    userId: owner.userId,
    matchType: 'ranked',
    total: 12,
    won: true,
    columnClears: 2,
  });

  assert.equal(first.skipped, false);
  assert.ok(first.clubXpGained > 0);
  assert.ok(first.eventScoreGained >= 0);
  assert.equal(findClubMember(club, owner.userId).contribution.matches, 1);
  assert.equal(club.goals.weekly.items.find(item => item.metric === 'matches').progress, 1);
  assert.equal(club.goals.weekly.items.find(item => item.metric === 'wins').progress, 1);
  assert.equal(club.goals.weekly.items.find(item => item.metric === 'columnClears').progress, 2);

  const second = applyClubMatchContribution(club, {
    resultId: 'result-1',
    completedAt: 2000,
    userId: owner.userId,
    matchType: 'ranked',
    total: 12,
    won: true,
    columnClears: 2,
  });
  assert.equal(second.skipped, true);
  assert.equal(findClubMember(club, owner.userId).contribution.matches, 1);
});

test('club reward claim grants member cosmetics once', () => {
  const user = {
    userId: 'owner-1',
    displayName: 'Owner',
    inventory: { cosmetics: [], equipped: {} },
  };
  const { club } = createClubRecord(user, { clubId: 'club-1', name: 'Reward Club', tag: 'RWD' }, 1000);
  club.progression.totalXp = 4000;
  normalizeClubRecord(club, 2000);
  findClubMember(club, user.userId).contributionXp = 600;

  const claimed = claimClubReward(user, club, 'club-crest-card-back', 3000);
  assert.equal(claimed.error, undefined);
  assert.equal(claimed.granted, 'club-crest-card-back');
  assert.equal(user.inventory.cosmetics.includes('club-crest-card-back'), true);

  const duplicate = claimClubReward(user, club, 'club-crest-card-back', 4000);
  assert.equal(duplicate.error, 'Member reward already claimed.');
});
