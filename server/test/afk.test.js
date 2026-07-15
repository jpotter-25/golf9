import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAfkCoinPenalty,
  normalizeAfkConfig,
  placementsWithAfkPenalty,
  recordAutomatedAfkWindow,
  recordHumanAfkAction,
  recordMissedAfkWindow,
} from '../afk.js';

test('AFK takeover starts on the second consecutive miss and keeps cumulative windows', () => {
  const config = normalizeAfkConfig({});
  const first = recordMissedAfkWindow({}, config);
  assert.equal(first.activated, false);
  assert.equal(first.state.consecutiveMisses, 1);
  assert.equal(first.state.automatedWindows, 1);
  assert.equal(first.state.autoplayActive, false);

  const second = recordMissedAfkWindow(first.state, config);
  assert.equal(second.activated, true);
  assert.equal(second.state.consecutiveMisses, 2);
  assert.equal(second.state.automatedWindows, 2);
  assert.equal(second.state.autoplayActive, true);

  const fourth = recordAutomatedAfkWindow(
    recordAutomatedAfkWindow(second.state, config),
    config
  );
  assert.equal(fourth.automatedWindows, 4);
  assert.equal(fourth.penaltyPending, true);
});

test('human action clears takeover streak without clearing cumulative penalty state', () => {
  const active = {
    consecutiveMisses: 3,
    automatedWindows: 5,
    autoplayActive: true,
    penaltyPending: true,
  };
  const reclaimed = recordHumanAfkAction(active);
  assert.equal(reclaimed.consecutiveMisses, 0);
  assert.equal(reclaimed.autoplayActive, false);
  assert.equal(reclaimed.automatedWindows, 5);
  assert.equal(reclaimed.penaltyPending, true);
});

test('coin penalty applies after rewards without taking the balance below zero', () => {
  assert.deepEqual(applyAfkCoinPenalty(275, { coinPenalty: 100 }), {
    balance: 175,
    deducted: 100,
  });
  assert.deepEqual(applyAfkCoinPenalty(40, { coinPenalty: 100 }), {
    balance: 0,
    deducted: 40,
  });
});

test('AFK-ranked placement puts penalized players behind active players', () => {
  assert.deepEqual(placementsWithAfkPenalty([8, 12, 20], [false, false, false]), [1, 2, 3]);
  assert.deepEqual(placementsWithAfkPenalty([8, 30, 20], [true, false, false]), [3, 2, 1]);
  assert.deepEqual(placementsWithAfkPenalty([5, 5, 20], [false, false, true]), [1.5, 1.5, 3]);
});
