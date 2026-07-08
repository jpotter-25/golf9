import assert from 'node:assert/strict';
import test from 'node:test';
import { aiPlayTurn, chooseAiMove } from '../../shared/soloAi.js';

let sequence = 0;

function card(rank, faceUp = true) {
  sequence += 1;
  return { id: `${rank}-${sequence}`, suit: 'S', rank, faceUp };
}

function row(a, b, c) {
  return [a, b, c];
}

function baseState({
  aiGrid,
  opponentGrid = [
    row(card('8'), card('7'), card('6')),
    row(card('4', false), card('3', false), card('2', false)),
    row(card('K', false), card('9', false), card('A', false)),
  ],
  drawRank = '9',
  discardRank = 'Q',
  mustDrawOnly = false,
  sweepActive = false,
} = {}) {
  const discard = discardRank ? card(discardRank) : null;
  return {
    id: `state-${sequence}`,
    players: [
      {
        id: 'P1',
        userId: 'ai',
        name: 'AI',
        grid: aiGrid,
        score: 0,
        peekFlips: 2,
        connected: true,
      },
      {
        id: 'P2',
        userId: 'human',
        name: 'Human',
        grid: opponentGrid,
        score: 0,
        peekFlips: 2,
        connected: true,
      },
    ],
    currentPlayerIndex: 0,
    drawPile: [card(drawRank, false)],
    discardPile: discard ? [discard] : [],
    phase: 'turn',
    topDiscard: discard,
    round: 1,
    totalRounds: 5,
    totals: [0, 0],
    sweepActive,
    sweepStarterIndex: null,
    mustDrawOnlyForPlayerIndex: mustDrawOnly ? 0 : undefined,
    pendingDecision: null,
    completed: false,
    revision: 1,
    turnSerial: 1,
  };
}

test('hard solo AI takes the discard when it completes a visible column', () => {
  const state = baseState({
    aiGrid: [
      row(card('A'), card('8'), card('6', false)),
      row(card('A'), card('3', false), card('7', false)),
      row(card('9', false), card('4', false), card('2', false)),
    ],
    discardRank: 'A',
  });

  const move = chooseAiMove(state, 0, 'hard');

  assert.equal(move.source, 'discard');
  assert.deepEqual(move.target, { playerIndex: 0, r: 2, c: 0 });
});

test('hard solo AI does not use hidden ranks to chase fake column clears', () => {
  const state = baseState({
    aiGrid: [
      row(card('Q', false), card('8', false), card('6', false)),
      row(card('Q', false), card('3', false), card('7', false)),
      row(card('4', false), card('4', false), card('2', false)),
    ],
    discardRank: 'Q',
  });

  const move = chooseAiMove(state, 0, 'hard');

  assert.equal(move.source, 'draw');
});

test('hard solo AI reveals hidden cards instead of making small face-up replacements early', () => {
  const state = baseState({
    aiGrid: [
      row(card('10'), card('2'), card('6', false)),
      row(card('9', false), card('3', false), card('7', false)),
      row(card('4', false), card('8', false), card('2', false)),
    ],
    drawRank: '4',
    discardRank: 'Q',
  });

  const move = chooseAiMove(state, 0, 'hard');

  assert.equal(move.source, 'draw');
  assert.equal(move.card.rank, '4');
  assert.equal(move.revealThenDecide, true);
  assert.notDeepEqual(move.target, { playerIndex: 0, r: 0, c: 0 });
});

test('hard solo AI avoids discarding a card an opponent visibly needs', () => {
  const state = baseState({
    aiGrid: [
      row(card('9'), card('8'), card('6', false)),
      row(card('7', false), card('3', false), card('4', false)),
      row(card('2', false), card('K', false), card('A', false)),
    ],
    opponentGrid: [
      row(card('Q'), card('8'), card('6', false)),
      row(card('Q'), card('3', false), card('7', false)),
      row(card('4', false), card('4', false), card('2', false)),
    ],
    drawRank: 'Q',
    discardRank: '9',
    mustDrawOnly: true,
  });

  const move = chooseAiMove(state, 0, 'hard');

  assert.equal(move.source, 'draw');
  assert.equal(move.discardDrawn, false);
  assert.equal(move.card.rank, 'Q');
});

test('hard solo AI uses reveal decisions to keep a better hidden card', () => {
  const state = baseState({
    aiGrid: [
      row(card('5', false), card('8', false), card('6', false)),
      row(card('7', false), card('3', false), card('4', false)),
      row(card('2', false), card('K', false), card('A', false)),
    ],
    drawRank: '9',
    discardRank: 'Q',
  });

  const next = aiPlayTurn(state, 0, 'hard');

  assert.equal(next.players[0].grid[0][0].rank, '5');
  assert.equal(next.players[0].grid[0][0].faceUp, true);
  assert.equal(next.topDiscard.rank, '9');
});
