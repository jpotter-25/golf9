import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyMatchProgression,
  claimChallengeReward,
  equipCosmetic,
  normalizeUserProgression,
  publicCosmeticCatalog,
  purchaseCosmetic,
  registerSocialMessage,
  xpNeededForLevel,
} from '../progression.js';
import { normalizeRankedSeason } from '../ranked.js';

function user(overrides = {}) {
  return {
    userId: 'user-one',
    displayName: 'PlayerOne',
    salt: 'unused',
    passwordHash: 'unused',
    ...overrides,
  };
}

test('normalizes legacy profile stats into progression defaults', () => {
  const legacy = user({ stats: { gamesPlayed: 3, wins: 2 } });
  normalizeUserProgression(legacy);

  assert.equal(legacy.statistics.gamesPlayed, 3);
  assert.equal(legacy.statistics.wins, 2);
  assert.equal(legacy.statistics.losses, 1);
  assert.equal(legacy.progression.level, 1);
  assert.equal(legacy.currency.coins, 0);
  assert.equal(legacy.currency.dailyBonus.streak, 0);
  assert.ok(legacy.inventory.cosmetics.includes('classic-card-back'));
  assert.ok(legacy.inventory.cosmetics.includes('rookie-title'));
  assert.ok(legacy.inventory.cosmetics.includes('classic-table-theme'));
  assert.equal(legacy.inventory.equipped.tableTheme, 'classic-table-theme');
  assert.equal(legacy.challenges.daily.items.length > 0, true);
});

test('xp curve uses roadmap level bands', () => {
  assert.equal(xpNeededForLevel(1), 1000);
  assert.equal(xpNeededForLevel(10), 2500);
  assert.equal(xpNeededForLevel(25), 5000);
  assert.equal(xpNeededForLevel(50), 5750);
});

test('match progression grants xp, currency, stats, and achievements once', () => {
  const account = user();
  const first = applyMatchProgression(account, {
    mode: 'online',
    total: 8,
    won: true,
    totalRounds: 5,
    roundScores: [7, 12, 10, -1, 8],
    columnClears: 1,
  }, 1000);
  const second = applyMatchProgression(account, {
    mode: 'online',
    total: 44,
    won: false,
    totalRounds: 5,
    roundScores: [13, 9, 11, 4, 7],
    columnClears: 0,
  }, 2000);

  assert.equal(account.statistics.gamesPlayed, 2);
  assert.equal(account.statistics.wins, 1);
  assert.equal(account.statistics.onlineGames, 2);
  assert.equal(account.statistics.columnClears, 1);
  assert.equal(account.statistics.bestRound, -1);
  assert.ok(first.xpGained > second.xpGained);
  assert.equal(first.challengesCompleted.some(item => item.templateId === 'daily_match'), true);
  assert.equal(first.challengesCompleted.some(item => item.templateId === 'daily_low_total'), true);
  assert.equal(account.achievements.filter(item => item.id === 'first_win').length, 1);
  assert.equal(account.achievements.filter(item => item.id === 'column_cleaner').length, 1);
});

test('challenge rewards can be claimed once', () => {
  const account = user();
  const match = applyMatchProgression(account, {
    mode: 'online',
    total: 18,
    won: false,
    totalRounds: 5,
    roundScores: [8, 10, 12, 15, 18],
    columnClears: 0,
  }, 1000);
  const completed = match.challengesCompleted.find(item => item.templateId === 'daily_match');
  assert.ok(completed);

  const claimed = claimChallengeReward(account, completed.id, 2000);
  assert.equal(claimed.error, undefined);
  assert.ok(claimed.progression.xpGained > 0);
  assert.ok(claimed.progression.coinsGained > 0);

  const duplicate = claimChallengeReward(account, completed.id, 3000);
  assert.equal(duplicate.error, 'Challenge reward already claimed.');
});

test('currency shop purchases and equips owned cosmetics', () => {
  const account = user({ currency: { coins: 1000, lifetimeCoins: 1000 } });
  normalizeUserProgression(account);
  const purchased = purchaseCosmetic(account, 'gold-trim-card-back');
  assert.equal(purchased.error, undefined);
  assert.equal(account.inventory.cosmetics.includes('gold-trim-card-back'), true);
  assert.equal(account.currency.coins, 650);

  const equipped = equipCosmetic(account, 'gold-trim-card-back');
  assert.equal(equipped.error, undefined);
  assert.equal(account.inventory.equipped.cardBack, 'gold-trim-card-back');

  const catalog = publicCosmeticCatalog(account);
  assert.equal(catalog.find(item => item.id === 'gold-trim-card-back')?.equipped, true);
  assert.equal(catalog.some(item => item.type === 'tableTheme'), true);
});

test('ranked cosmetics require season-best eligibility and coins', () => {
  const now = Date.now();
  const season = normalizeRankedSeason({ id: 's1', name: 'Season 1', startsAt: now - 1000, endsAt: now + 90 * 24 * 60 * 60 * 1000 }, now);
  const locked = user({ currency: { coins: 5000, lifetimeCoins: 5000 } });
  normalizeUserProgression(locked, now, season);
  const rejected = purchaseCosmetic(locked, 's1-gold-card-back', season);
  assert.match(rejected.error, /Reach Gold/);

  const eligible = user({
    currency: { coins: 5000, lifetimeCoins: 5000 },
    competitive: { seasonId: 's1', mmr: 2100, seasonBestMmr: 2100, placementsPlayed: 5, claimedSeasonRewards: [], matchHistory: [] },
  });
  normalizeUserProgression(eligible, now, season);
  const catalogItem = publicCosmeticCatalog(eligible, season).find(item => item.id === 's1-gold-card-back');
  assert.equal(catalogItem?.eligible, true);
  assert.equal(catalogItem?.price, 2500);

  const purchased = purchaseCosmetic(eligible, 's1-gold-card-back', season);
  assert.equal(purchased.error, undefined);
  assert.equal(eligible.currency.coins, 2500);
  assert.equal(eligible.inventory.cosmetics.includes('s1-gold-card-back'), true);
});

test('social progression unlocks social starter without duplicating it', () => {
  const account = user();
  const first = registerSocialMessage(account, 1000);
  const second = registerSocialMessage(account, 2000);

  assert.equal(account.statistics.socialMessagesSent, 2);
  assert.equal(first.achievementsUnlocked.some(item => item.id === 'social_starter'), true);
  assert.equal(second.achievementsUnlocked.length, 0);
  assert.equal(account.achievements.filter(item => item.id === 'social_starter').length, 1);
});
