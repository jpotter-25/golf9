import assert from 'node:assert/strict';
import test from 'node:test';
import { calculatePayouts, claimDailyTableBonus, payoutSlotsFor, publicEconomyCatalog, rankedBuyInForMmr } from '../economy.js';

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

test('daily table bonus recovers low-balance players once per day', () => {
  const account = { currency: { coins: 0, lifetimeCoins: 0 } };
  const first = claimDailyTableBonus(account, Date.UTC(2026, 0, 1, 12));
  const duplicate = claimDailyTableBonus(account, Date.UTC(2026, 0, 1, 18));
  const second = claimDailyTableBonus(account, Date.UTC(2026, 0, 2, 12));

  assert.equal(first.reward, 150);
  assert.equal(duplicate.error, 'Daily Table Bonus already claimed.');
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
