import assert from 'node:assert/strict';
import test from 'node:test';
import { calculatePayouts, claimDailyTableBonus, normalizeBuyIn, normalizeClubConfig, normalizeEconomyConfigStore, payoutSlotsFor, publicEconomyCatalog, rankedBuyInForMmr } from '../economy.js';

const DAY_MS = 24 * 60 * 60 * 1000;

test('payout slots follow wager table rules', () => {
  assert.deepEqual(payoutSlotsFor(2, 100), [200, 0]);
  assert.deepEqual(payoutSlotsFor(3, 100), [250, 50, 0]);
  assert.deepEqual(payoutSlotsFor(4, 100), [300, 100, 0, 0]);
});

test('payouts preserve the full pot and support ties', () => {
  const three = calculatePayouts([
    { userId: 'a', total: 10 },
    { userId: 'b', total: 20 },
    { userId: 'c', total: 30 },
  ], 100);
  assert.equal(three.find(item => item.userId === 'a')?.payout, 250);
  assert.equal(three.find(item => item.userId === 'b')?.payout, 50);
  assert.equal(three.reduce((sum, item) => sum + item.payout, 0), 300);

  const tiedFirst = calculatePayouts([
    { userId: 'a', total: 10 },
    { userId: 'b', total: 10 },
    { userId: 'c', total: 30 },
    { userId: 'd', total: 40 },
  ], 100);
  assert.equal(tiedFirst.reduce((sum, item) => sum + item.payout, 0), 400);
  assert.equal(tiedFirst.find(item => item.userId === 'a')?.payout, 200);
  assert.equal(tiedFirst.find(item => item.userId === 'b')?.payout, 200);
});

test('ranked entry fee is free across all MMR bands', () => {
  assert.equal(rankedBuyInForMmr(0), 0);
  assert.equal(rankedBuyInForMmr(999), 0);
  assert.equal(rankedBuyInForMmr(1000), 0);
  assert.equal(rankedBuyInForMmr(2500), 0);
  assert.equal(rankedBuyInForMmr(3000), 0);
});

test('daily table bonus recovers low-balance players on a rolling 24-hour clock', () => {
  const account = { currency: { coins: 0, lifetimeCoins: 0 } };
  const firstClaimAt = Date.UTC(2026, 0, 1, 12);
  const first = claimDailyTableBonus(account, firstClaimAt);
  const duplicate = claimDailyTableBonus(account, firstClaimAt + (6 * 60 * 60 * 1000));
  const nextMorning = claimDailyTableBonus(account, Date.UTC(2026, 0, 2, 8));
  const second = claimDailyTableBonus(account, firstClaimAt + DAY_MS);

  assert.equal(first.reward, 150);
  assert.equal(duplicate.error, 'Daily Table Bonus already claimed.');
  assert.equal(duplicate.dailyBonus.nextAvailableAt, firstClaimAt + DAY_MS);
  assert.equal(nextMorning.error, 'Daily Table Bonus already claimed.');
  assert.equal(second.reward, 125);
  assert.equal(account.currency.coins, 275);
  assert.equal(account.currency.dailyBonus.streak, 2);
});

test('economy catalog explains coin sources and deprecates ranked fees', () => {
  const account = { currency: { coins: 10, lifetimeCoins: 10 } };
  const catalog = publicEconomyCatalog(account);
  assert.equal(catalog.rankedFees.length, 0);
  assert.equal(catalog.dailyBonus?.canClaim, true);
  assert.ok(catalog.coinSources.some(item => item.id === 'free-play'));
});

test('configured wager steps feed the public economy catalog and buy-in validation', () => {
  const config = normalizeEconomyConfigStore({
    wagerTables: [
      { id: 'free', buyIn: 0, label: 'Free' },
      { id: 'wager-50', buyIn: 50, label: '50' },
      { id: 'wager-1000', buyIn: 1000, label: '1k' },
      { id: 'wager-50000', buyIn: 50000, label: '50k' },
      { id: 'wager-100000', buyIn: 100000, label: '100k' },
    ],
  });
  const catalog = publicEconomyCatalog(null, config);
  assert.deepEqual(catalog.wagerTables.map(table => table.buyIn), [0, 50, 1000, 50000, 100000]);
  assert.equal(normalizeBuyIn(100000, config), 100000);
  assert.equal(normalizeBuyIn(750, config), 0);
});

test('club economy config defaults and admin-configured prestige tiers normalize safely', () => {
  const config = normalizeEconomyConfigStore({
    clubConfig: {
      minJoinLevel: 12,
      minCreateLevel: 14,
      createCost: 7500,
      prestigeTiers: [
        { tier: 1, name: 'Starter', treasuryCost: 7500, memberCap: 12, minClubLevel: 1, minMembers: 1 },
        { tier: 2, name: 'Big Club', treasuryCost: 15000, memberCap: 24, minClubLevel: 4, minMembers: 8, minWeeklyMatches: 20 },
      ],
    },
  });
  assert.equal(config.clubConfig.minJoinLevel, 1);
  assert.equal(config.clubConfig.minCreateLevel, 14);
  assert.equal(config.clubConfig.createCost, 7500);
  assert.deepEqual(config.clubConfig.prestigeTiers.map(tier => tier.memberCap), [12, 24]);

  const catalog = publicEconomyCatalog(null, config);
  assert.equal(catalog.clubConfig.prestigeTiers[1].name, 'Big Club');
  assert.equal(normalizeClubConfig({}).minJoinLevel, 1);
});
