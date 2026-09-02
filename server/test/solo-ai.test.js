import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aiPlayTurn,
  chooseAiMove,
  chooseAiPeekTargets,
  executeAiTurn,
  planAiTurn,
} from '../../shared/soloAi.js';
import {
  createGameState,
  flipForPeek,
  resolveExpiredTimers,
} from '../../shared/rules.js';

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
  id,
  turnSerial = 1,
} = {}) {
  const discard = discardRank ? card(discardRank) : null;
  return {
    id: id || `state-${sequence}`,
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
    turnSerial,
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

  const plan = planAiTurn(state, 0, 'hard');
  const target = plan.target;
  assert.ok(target);
  const original = state.players[0].grid[target.r][target.c];
  const next = executeAiTurn(state, plan);

  assert.equal(next.players[0].grid[target.r][target.c].rank, original.rank);
  assert.equal(next.players[0].grid[target.r][target.c].faceUp, true);
  assert.equal(next.topDiscard.rank, '9');
});

test('hard solo AI uses visible grid scores and avoids its last hidden card while trailing', () => {
  const state = baseState({
    aiGrid: [
      row(card('3'), card('4'), card('2')),
      row(card('3'), card('6'), card('K')),
      row(card('4'), card('4'), card('5', false)),
    ],
    opponentGrid: [
      row(card('3'), card('A'), card('K')),
      row(card('A'), card('A'), card('5')),
      row(card('3'), card('9', false), card('2')),
    ],
    drawRank: '7',
    discardRank: 'Q',
  });

  assert.equal(state.players[0].score, 0);
  assert.equal(state.players[1].score, 0);

  const move = chooseAiMove(state, 0, 'hard');

  assert.equal(move.source, 'draw');
  assert.equal(move.discardDrawn, true);
  assert.equal(move.target, null);

  const next = aiPlayTurn(state, 0, 'hard');
  assert.equal(next.players[0].grid[2][2].faceUp, false);
  assert.equal(next.sweepActive, false);
  assert.equal(next.currentPlayerIndex, 1);
});

test('hard solo AI improves a face-up card instead of ending while trailing', () => {
  const state = baseState({
    aiGrid: [
      row(card('3'), card('4'), card('2')),
      row(card('3'), card('6'), card('K')),
      row(card('4'), card('4'), card('5', false)),
    ],
    opponentGrid: [
      row(card('3'), card('A'), card('K')),
      row(card('A'), card('A'), card('5')),
      row(card('3'), card('9', false), card('2')),
    ],
    drawRank: '2',
    discardRank: 'Q',
  });

  const move = chooseAiMove(state, 0, 'hard');

  assert.equal(move.source, 'draw');
  assert.equal(move.discardDrawn, false);
  assert.deepEqual(move.target, { playerIndex: 0, r: 1, c: 1 });
  assert.equal(move.revealThenDecide, false);
});

test('hard solo AI can trigger final turn when holding the lowest score', () => {
  const state = baseState({
    aiGrid: [
      row(card('3'), card('9'), card('5')),
      row(card('A'), card('A'), card('5')),
      row(card('6'), card('8'), card('7', false)),
    ],
    opponentGrid: [
      row(card('10'), card('K'), card('Q')),
      row(card('9'), card('8'), card('7')),
      row(card('6'), card('5'), card('4')),
    ],
    drawRank: '2',
    discardRank: 'Q',
  });
  const move = chooseAiMove(state, 0, 'hard');

  assert.equal(move.source, 'draw');
  assert.deepEqual(move.target, { playerIndex: 0, r: 2, c: 2 });
  assert.equal(move.discardDrawn, false);
});

test('easy solo AI reveals a hidden card and keeps its lower value instead of blindly replacing it', () => {
  const state = baseState({
    aiGrid: [
      row(card('K', false), card('8', false), card('6', false)),
      row(card('7', false), card('3', false), card('4', false)),
      row(card('2', false), card('9', false), card('A', false)),
    ],
    drawRank: 'Q',
    discardRank: '9',
  });

  const move = chooseAiMove(state, 0, 'easy');
  assert.equal(move.source, 'draw');
  assert.equal(move.revealThenDecide, true);
  assert.ok(move.target);
  const original = state.players[0].grid[move.target.r][move.target.c];

  const next = executeAiTurn(state, move);
  assert.equal(next.players[0].grid[move.target.r][move.target.c].rank, original.rank);
  assert.equal(next.players[0].grid[move.target.r][move.target.c].faceUp, true);
  assert.equal(next.topDiscard.rank, 'Q');
});

test('strategically equal hidden targets vary by game while the same turn stays deterministic', () => {
  const selected = new Set();
  for (let index = 0; index < 40; index += 1) {
    const state = baseState({
      id: `varied-game-${index}`,
      aiGrid: Array.from({ length: 3 }, () => row(card('7', false), card('7', false), card('7', false))),
      drawRank: '9',
      discardRank: 'Q',
    });
    const first = planAiTurn(state, 0, 'hard');
    const second = planAiTurn(state, 0, 'hard');
    assert.deepEqual(second, first);
    assert.ok(first.target);
    selected.add(`${first.target.r}:${first.target.c}`);
  }
  assert.ok(selected.size >= 4, `expected varied targets, received ${[...selected].join(', ')}`);
});

test('strategic tie-breaking never displaces a uniquely better column completion', () => {
  for (let index = 0; index < 30; index += 1) {
    const state = baseState({
      id: `completion-game-${index}`,
      aiGrid: [
        row(card('8', false), card('A'), card('7', false)),
        row(card('6', false), card('A'), card('5', false)),
        row(card('4', false), card('9', false), card('3', false)),
      ],
      discardRank: 'A',
    });
    const plan = planAiTurn(state, 0, 'hard');
    assert.equal(plan.source, 'discard');
    assert.deepEqual(plan.target, { playerIndex: 0, r: 2, c: 1 });
  }
});

test('easy and hard share tactical choices outside final-card aggression', () => {
  const state = baseState({
    id: 'shared-tactics',
    aiGrid: [
      row(card('10'), card('2'), card('6', false)),
      row(card('9', false), card('3', false), card('7', false)),
      row(card('4', false), card('8', false), card('2', false)),
    ],
    drawRank: '4',
    discardRank: 'Q',
  });
  const easy = planAiTurn(state, 0, 'easy');
  const hard = planAiTurn(state, 0, 'hard');
  assert.equal(easy.source, hard.source);
  assert.deepEqual(easy.target, hard.target);
  assert.equal(easy.discardDrawn, hard.discardDrawn);
  assert.equal(easy.revealThenDecide, hard.revealThenDecide);
});

test('easy hesitates on twenty percent of eligible final-card opportunities without making a worse play', () => {
  let hesitationCount = 0;
  let hesitationExample = null;
  let decisiveExample = null;
  for (let index = 0; index < 500; index += 1) {
    const state = baseState({
      id: `easy-final-${index}`,
      aiGrid: [
        row(card('3'), card('9'), card('5')),
        row(card('A'), card('A'), card('5')),
        row(card('6'), card('8'), card('7', false)),
      ],
      opponentGrid: [
        row(card('10'), card('K'), card('Q')),
        row(card('9'), card('8'), card('7')),
        row(card('6'), card('5'), card('4')),
      ],
      drawRank: '2',
      discardRank: 'Q',
    });
    const plan = planAiTurn(state, 0, 'easy');
    if (plan.finalCardHesitation) {
      hesitationCount += 1;
      hesitationExample ||= { state, plan };
      assert.notDeepEqual(plan.target, { playerIndex: 0, r: 2, c: 2 });
    } else {
      decisiveExample ||= { state, plan };
      assert.deepEqual(plan.target, { playerIndex: 0, r: 2, c: 2 });
    }
  }
  assert.ok(hesitationCount >= 85 && hesitationCount <= 115, `expected about 20%, received ${hesitationCount}/500`);
  assert.ok(hesitationExample);
  assert.ok(decisiveExample);
  const delayed = executeAiTurn(hesitationExample.state, hesitationExample.plan);
  assert.equal(delayed.players[0].grid[2][2].faceUp, false);
  const finished = executeAiTurn(decisiveExample.state, decisiveExample.plan);
  assert.equal(finished.players[0].grid[2][2].faceUp, true);
});

test('easy never hesitates during the final sweep', () => {
  const state = baseState({
    id: 'easy-final-sweep',
    aiGrid: [
      row(card('6', false), card('5'), card('K')),
      row(card('5'), card('K'), card('5')),
      row(card('K'), card('5'), card('5')),
    ],
    opponentGrid: Array.from({ length: 3 }, () => row(card('5'), card('5'), card('5'))),
    drawRank: 'Q',
    discardRank: '9',
    sweepActive: true,
  });
  state.sweepStarterIndex = 1;
  const plan = planAiTurn(state, 0, 'easy');
  assert.equal(plan.finalCardHesitation, false);
  assert.deepEqual(plan.target, { playerIndex: 0, r: 0, c: 0 });
});

test('opening peek targets are distinct, stable, and varied across games', () => {
  const pairs = new Set();
  for (let index = 0; index < 30; index += 1) {
    const state = baseState({
      id: `peek-game-${index}`,
      aiGrid: Array.from({ length: 3 }, () => row(card('7', false), card('7', false), card('7', false))),
    });
    state.phase = 'peek';
    state.peekTurnIndex = 0;
    state.players[0].peekFlips = 0;
    const first = chooseAiPeekTargets(state, 0, 2);
    const second = chooseAiPeekTargets(state, 0, 2);
    assert.deepEqual(second, first);
    assert.equal(first.length, 2);
    assert.notDeepEqual(first[0], first[1]);
    pairs.add(first.map(target => `${target.r}:${target.c}`).join('|'));
  }
  assert.ok(pairs.size >= 5, `expected varied peek pairs, received ${[...pairs].join(', ')}`);
});

test('easy and hard AI complete 2-, 3-, and 4-player Solo rounds', () => {
  for (const playerCount of [2, 3, 4]) {
    for (const difficulty of ['easy', 'hard']) {
      let state = createGameState(
        Array.from({ length: playerCount }, (_, index) => ({
          userId: `simulation-${playerCount}-${difficulty}-${index}`,
          displayName: `AI ${index + 1}`,
        })),
        { totalRounds: 1 }
      );
      let steps = 0;
      while (state.phase === 'peek' && steps < 100) {
        const playerIndex = state.peekTurnIndex ?? 0;
        const targets = chooseAiPeekTargets(state, playerIndex, 2 - state.players[playerIndex].peekFlips);
        assert.ok(targets.length > 0);
        for (const target of targets) {
          const result = flipForPeek(state, playerIndex, target.r, target.c);
          assert.equal(result.error, undefined);
          state = result.state;
          if (state.phase !== 'peek' || state.peekTurnIndex !== playerIndex) break;
        }
        steps += 1;
      }
      while (state.phase === 'turn' && steps < 500) {
        const plan = planAiTurn(state, state.currentPlayerIndex, difficulty);
        const next = executeAiTurn(state, plan);
        assert.notEqual(next, state);
        assert.ok((next.revision || 0) > (state.revision || 0));
        state = next;
        steps += 1;
      }
      assert.equal(state.phase, 'roundReveal', `${playerCount}P ${difficulty} stopped after ${steps} actions`);
      state = resolveExpiredTimers({ ...state, roundRevealEndsAt: Date.now() - 1 });
      assert.equal(state.phase, 'roundEnd');
      assert.equal(state.completed, true);
    }
  }
});

test('a planned move executes the displayed target and stale plans are rejected', () => {
  const state = baseState({
    id: 'planned-target',
    aiGrid: Array.from({ length: 3 }, () => row(card('7', false), card('7', false), card('7', false))),
    drawRank: '9',
    discardRank: 'Q',
  });
  const plan = planAiTurn(state, 0, 'hard');
  assert.ok(plan.target);
  const next = executeAiTurn(state, plan);
  assert.equal(next.players[0].grid[plan.target.r][plan.target.c].faceUp, true);

  const changed = { ...state, revision: state.revision + 1 };
  assert.equal(executeAiTurn(changed, plan), changed);
});

test('online AFK keeps the legacy conservative policy separate from smarter Solo Easy', () => {
  const state = baseState({
    id: 'afk-policy',
    aiGrid: Array.from({ length: 3 }, () => row(card('7', false), card('7', false), card('7', false))),
    drawRank: '9',
    discardRank: 'Q',
  });
  const afk = planAiTurn(state, 0, 'afk');
  assert.equal(afk.policy, 'afk');
  assert.deepEqual(afk.target, { playerIndex: 0, r: 0, c: 0 });
});

test('hard solo AI prioritizes a hidden card over a one-point visible improvement late in a round', () => {
  const state = baseState({
    aiGrid: [
      row(card('9'), card('K'), card('2', false)),
      row(card('4'), card('3'), card('7')),
      row(card('6'), card('5'), card('A', false)),
    ],
    drawRank: '8',
    discardRank: 'Q',
  });

  const move = chooseAiMove(state, 0, 'hard');

  assert.equal(move.source, 'draw');
  assert.equal(move.revealThenDecide, true);
  assert.notDeepEqual(move.target, { playerIndex: 0, r: 0, c: 0 });
  assert.equal(state.players[0].grid[move.target.r][move.target.c].faceUp, false);
});

test('hard solo AI does not replace a visible 9 with a discard 6 while hidden cards remain', () => {
  const state = baseState({
    aiGrid: [
      row(card('9'), card('K'), card('2', false)),
      row(card('4'), card('3'), card('7')),
      row(card('6'), card('5'), card('A', false)),
    ],
    drawRank: '4',
    discardRank: '6',
  });

  assert.equal(chooseAiMove(state, 0, 'hard').source, 'draw');
});

test('a later hard AI seat treats every opponent as competition without sacrificing its own score', () => {
  const state = baseState({
    aiGrid: [
      row(card('6', false), card('K'), card('2', false)),
      row(card('9'), card('5'), card('K')),
      row(card('8'), card('4'), card('5')),
    ],
    drawRank: 'Q',
    discardRank: '9',
    sweepActive: true,
  });
  const ai = state.players[0];
  const queenThreat = {
    ...state.players[1],
    userId: 'queen-threat',
    grid: [
      row(card('Q'), card('3'), card('4')),
      row(card('Q'), card('2'), card('5')),
      row(card('7', false), card('8'), card('9')),
    ],
  };
  const leader = {
    ...state.players[1],
    userId: 'leader',
    grid: Array.from({ length: 3 }, () => row(card('5'), card('5'), card('5'))),
  };
  const fourth = {
    ...state.players[1],
    userId: 'fourth',
    grid: Array.from({ length: 3 }, () => row(card('3'), card('4'), card('7', false))),
  };
  state.players = [queenThreat, leader, ai, fourth];
  state.currentPlayerIndex = 2;
  state.sweepStarterIndex = 0;
  state.totals = [0, 0, 0, 0];

  const move = chooseAiMove(state, 2, 'hard');
  assert.equal(move.source, 'draw');
  assert.equal(move.revealThenDecide, true);
  assert.deepEqual(move.target, { playerIndex: 2, r: 0, c: 0 });

  const next = aiPlayTurn(state, 2, 'hard');
  assert.equal(next.players[2].grid[0][0].rank, '6');
  assert.equal(next.players[2].grid[0][0].faceUp, true);
  assert.equal(next.topDiscard.rank, 'Q');
});

test('hard solo AI reveals its last hidden card during the final sweep instead of worsening a King', () => {
  const state = baseState({
    aiGrid: [
      row(card('6', false), card('5'), card('K')),
      row(card('5'), card('K'), card('5')),
      row(card('K'), card('5'), card('5')),
    ],
    opponentGrid: Array.from({ length: 3 }, () => row(card('5'), card('5'), card('5'))),
    drawRank: 'Q',
    discardRank: '9',
    sweepActive: true,
  });
  state.sweepStarterIndex = 1;

  const move = chooseAiMove(state, 0, 'hard');
  assert.equal(move.revealThenDecide, true);
  assert.deepEqual(move.target, { playerIndex: 0, r: 0, c: 0 });

  const next = aiPlayTurn(state, 0, 'hard');
  assert.equal(next.players[0].grid[0][0].rank, '6');
  assert.equal(next.players[0].grid[1][1].rank, 'K');
  assert.equal(next.topDiscard.rank, 'Q');
});
