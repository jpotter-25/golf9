import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cardValue,
  createGameState,
  flipForPeek,
  publicGameState,
  replaceGridCard,
  scoreGrid,
  startTurns,
} from '../../shared/rules.js';

function card(rank, extra = {}) {
  return { id: `${rank}-${Math.random()}`, suit: '♠', rank, faceUp: true, ...extra };
}

test('cardValue and scoreGrid centralize Golf 9 scoring', () => {
  assert.equal(cardValue(card('A')), 1);
  assert.equal(cardValue(card('5')), -5);
  assert.equal(cardValue(card('J')), 10);
  assert.equal(cardValue(card('Q')), 10);
  assert.equal(cardValue(card('K')), 0);
  assert.equal(cardValue(card('9', { zeroed: true })), 0);

  const grid = [
    [card('A'), card('5'), card('K')],
    [card('J'), card('Q'), card('2')],
    [card('9', { zeroed: true }), card('3'), card('4')],
  ];
  assert.equal(scoreGrid(grid), 25);
});

test('peek validation enforces current peeker and two-card limit', () => {
  let state = createGameState([
    { userId: 'u1', displayName: 'One' },
    { userId: 'u2', displayName: 'Two' },
  ]);

  const wrongPlayer = flipForPeek(state, 1, 0, 0);
  assert.equal(wrongPlayer.error, 'Not your peek turn.');

  let result = flipForPeek(state, 0, 0, 0);
  assert.equal(result.error, undefined);
  state = result.state;
  result = flipForPeek(state, 0, 0, 1);
  assert.equal(result.error, undefined);
  assert.equal(result.state.peekTurnIndex, 1);
});

test('replaceGridCard zeroes a completed three-of-a-kind column from shared rules', () => {
  let state = createGameState([
    { userId: 'u1', displayName: 'One' },
    { userId: 'u2', displayName: 'Two' },
  ]);
  state = startTurns(state);
  state.currentPlayerIndex = 0;
  state.players[0].grid[0][0] = card('7');
  state.players[0].grid[1][0] = card('7');
  state.players[0].grid[2][0] = card('9');

  const result = replaceGridCard(state, 0, 2, 0, card('7'));
  assert.equal(result.error, undefined);
  assert.equal(result.state.players[0].grid[0][0].zeroed, true);
  assert.equal(result.state.players[0].grid[1][0].zeroed, true);
  assert.equal(result.state.players[0].grid[2][0].zeroed, true);
  assert.equal(scoreGrid(result.state.players[0].grid), scoreGrid(result.state.players[0].grid));
});

test('publicGameState exposes viewer held card while masking draw pile', () => {
  const state = createGameState([
    { userId: 'u1', displayName: 'One' },
    { userId: 'u2', displayName: 'Two' },
  ]);
  const held = card('3');
  const view = publicGameState(state, 'u1', held);
  assert.deepEqual(view.viewerHeldCard, held);
  assert.equal(view.drawPile.length, state.drawPile.length);
  assert.equal(view.drawPile.every(c => c.faceUp === false), true);
});
