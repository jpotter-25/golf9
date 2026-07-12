import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyClubMatchContribution,
  clearClubTreasuryGoal,
  claimClubReward,
  clubProgressionSnapshot,
  createClubRecord,
  donateToClubTreasury,
  findClubMember,
  memberCapForLevel,
  normalizeClubRecord,
  publicClubProfile,
  purchaseClubPrestige,
  setClubTreasuryGoal,
  syncClubRewards,
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

test('club creation normalizes branding, identity, owner, goals, and public capacity', () => {
  const owner = { userId: 'owner-1', displayName: 'Owner' };
  const { club, error } = createClubRecord(owner, {
    clubId: 'club-1',
    name: 'Fairway Friends',
    tag: 'ff-9!',
    motto: 'Low totals together',
    description: 'A welcoming club for regular table players.',
    branding: {
      colorPair: 'gold',
      badgeShape: 'crest',
      bannerStyle: 'champion',
      badgeIcon: 'crown',
      primaryColor: '#FFCC66',
      backgroundColor: '#2B2515',
      accentColor: '#F472B6',
    },
  }, 1000);

  assert.equal(error, undefined);
  assert.equal(club.name, 'Fairway Friends');
  assert.equal(club.tag, 'FF');
  assert.equal(club.description, 'A welcoming club for regular table players.');
  assert.equal(club.branding.colorPair, 'gold');
  assert.equal(club.branding.badgeIcon, 'crown');
  assert.equal(club.branding.accentColor, '#F472B6');
  assert.equal(club.members[0].role, 'owner');
  assert.equal(club.goals.weekly.items.length, 3);
  assert.equal(club.progression.memberCap, 15);
});

test('club tags use one to four letters and announcements keep only the latest entry', () => {
  const owner = { userId: 'owner-1', displayName: 'Owner' };
  const { club } = createClubRecord(owner, { clubId: 'club-1', name: 'Tag Club', tag: 'a-1bcdef' }, 1000);
  assert.equal(club.tag, 'ABCD');
  club.announcements = [
    { id: 'old', text: 'Old', createdAt: 1000 },
    { id: 'new', text: 'New', createdAt: 2000 },
  ];
  normalizeClubRecord(club, 3000);
  assert.deepEqual(club.announcements.map(item => item.id), ['new']);
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
  assert.equal(duplicate.error, undefined);
  assert.equal(duplicate.alreadyClaimed, true);
  assert.equal(user.inventory.cosmetics.filter(item => item === 'club-crest-card-back').length, 1);
});

test('eligible club rewards synchronize automatically and idempotently', () => {
  const user = {
    userId: 'owner-1',
    displayName: 'Owner',
    inventory: { cosmetics: [], equipped: {} },
  };
  const users = new Map([[user.userId, user]]);
  const { club } = createClubRecord(user, { clubId: 'club-1', name: 'Auto Reward Club', tag: 'AUTO' }, 1000);
  club.progression.totalXp = 4000;
  normalizeClubRecord(club, 2000);
  findClubMember(club, user.userId).contributionXp = 600;

  const first = syncClubRewards(club, users, 3000);
  const second = syncClubRewards(club, users, 4000);

  assert.equal(first.changed, true);
  assert.deepEqual(first.clubRewards.sort(), ['club-level-2-banner', 'club-level-3-badge']);
  assert.equal(first.memberRewards.some(item => item.rewardId === 'club-regular-title'), true);
  assert.equal(first.memberRewards.some(item => item.rewardId === 'club-crest-card-back'), true);
  assert.equal(second.changed, false);
  assert.equal(user.inventory.cosmetics.filter(item => item === 'club-crest-card-back').length, 1);
});

test('treasury goals validate permissions, persist in profiles, and clear', () => {
  const owner = { userId: 'owner-1', displayName: 'Owner' };
  const member = { userId: 'member-1', displayName: 'Member' };
  const users = new Map([[owner.userId, owner], [member.userId, member]]);
  const { club } = createClubRecord(owner, { clubId: 'club-1', name: 'Goal Club', tag: 'GOAL' }, 1000);
  club.members.push({
    userId: member.userId,
    role: 'member',
    joinedAt: 1000,
    contributionXp: 0,
    coinContribution: 0,
    contribution: { matches: 0, wins: 0, columnClears: 0, rankedOrWager: 0 },
  });

  const forbidden = setClubTreasuryGoal(member, club, { title: 'Nope', targetAmount: 1000 }, 2000);
  assert.match(forbidden.error, /owners and officers/);

  const created = setClubTreasuryGoal(owner, club, {
    title: 'Tournament entry',
    description: 'Fund our next club event.',
    targetAmount: 12500,
  }, 3000);
  assert.equal(created.error, undefined);
  assert.equal(created.treasuryGoal.targetAmount, 12500);
  normalizeClubRecord(club, 3500);
  assert.equal(publicClubProfile(club, users, owner.userId, null, 3500).treasuryGoal.title, 'Tournament entry');

  const cleared = clearClubTreasuryGoal(owner, club, 4000);
  assert.equal(cleared.error, undefined);
  assert.equal(publicClubProfile(club, users, owner.userId, null, 4000).treasuryGoal, null);
});

test('public club presence exposes online member count and per-member state', () => {
  const owner = { userId: 'owner-1', displayName: 'Owner' };
  const member = { userId: 'member-1', displayName: 'Member' };
  const users = new Map([[owner.userId, owner], [member.userId, member]]);
  const { club } = createClubRecord(owner, { clubId: 'club-1', name: 'Presence Club', tag: 'LIVE' }, 1000);
  club.members.push({
    userId: member.userId,
    role: 'member',
    joinedAt: 1000,
    contributionXp: 0,
    coinContribution: 0,
    contribution: { matches: 0, wins: 0, columnClears: 0, rankedOrWager: 0 },
  });

  const profile = publicClubProfile(club, users, owner.userId, null, 2000, undefined, new Set([owner.userId]));
  assert.equal(profile.onlineMemberCount, 1);
  assert.equal(profile.members.find(item => item.userId === owner.userId).isOnline, true);
  assert.equal(profile.members.find(item => item.userId === member.userId).isOnline, false);
});

test('club donations fund treasury and prestige purchases persist member cap', () => {
  const config = {
    minJoinLevel: 10,
    minCreateLevel: 10,
    createCost: 5000,
    prestigeTiers: [
      { tier: 1, name: 'Founding Club', treasuryCost: 5000, memberCap: 15, minClubLevel: 1, minMembers: 1 },
      { tier: 2, name: 'Growing Club', treasuryCost: 100, memberCap: 20, minClubLevel: 3, minMembers: 1, minWeeklyMatches: 2 },
    ],
  };
  const owner = {
    userId: 'owner-1',
    displayName: 'Owner',
    currency: { coins: 250, lifetimeCoins: 250 },
  };
  const { club } = createClubRecord(owner, { clubId: 'club-1', name: 'Prestige Club', tag: 'PRG' }, 1000, config);

  const donated = donateToClubTreasury(owner, club, 150, 2000, config);
  assert.equal(donated.error, undefined);
  assert.equal(owner.currency.coins, 100);
  assert.equal(club.treasury.balance, 150);
  assert.equal(findClubMember(club, owner.userId).coinContribution, 150);

  const blocked = purchaseClubPrestige(owner, club, config, 2500);
  assert.match(blocked.error, /requirements/);

  club.progression.totalXp = 3500;
  normalizeClubRecord(club, 3000, null, config);
  club.goals.weekly.items.find(item => item.metric === 'matches').progress = 2;
  const purchased = purchaseClubPrestige(owner, club, config, 3500);
  assert.equal(purchased.error, undefined);
  assert.equal(club.prestige.tier, 2);
  assert.equal(club.treasury.balance, 50);
  assert.equal(club.progression.memberCap, 20);

  club.progression.totalXp = 0;
  normalizeClubRecord(club, 4000, null, config);
  assert.equal(club.progression.memberCap, 20);
});
