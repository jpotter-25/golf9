import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cardValue,
  autoCompleteCurrentPeek,
  continueAfterRoundSummary,
  createDeck,
  createGameState,
  deckCountForPlayers,
  discardDrawn,
  drawFromDeck,
  flipForPeek,
  publicGameState,
  revealGridCardForDecision,
  replaceGridCard,
  resolvePendingGridDecision,
  resolvePendingGridDecisionWithoutHeld,
  resolveExpiredTimers,
  scoreGrid,
  startTurns,
  takeDiscard,
  PEEK_DURATION,
  TURN_DURATION,
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

test('deck count scales up for three and four player games', () => {
  assert.equal(deckCountForPlayers(1), 2);
  assert.equal(deckCountForPlayers(2), 2);
  assert.equal(deckCountForPlayers(3), 3);
  assert.equal(deckCountForPlayers(4), 3);
  assert.equal(createDeck(2).length, 104);
  assert.equal(createDeck(3).length, 156);

  const twoPlayers = createGameState([
    { userId: 'u1', displayName: 'One' },
    { userId: 'u2', displayName: 'Two' },
  ]);
  const threePlayers = createGameState([
    { userId: 'u1', displayName: 'One' },
    { userId: 'u2', displayName: 'Two' },
    { userId: 'u3', displayName: 'Three' },
  ]);
  const fourPlayers = createGameState([
    { userId: 'u1', displayName: 'One' },
    { userId: 'u2', displayName: 'Two' },
    { userId: 'u3', displayName: 'Three' },
    { userId: 'u4', displayName: 'Four' },
  ]);

  assert.equal(twoPlayers.drawPile.length, 104 - (2 * 9) - 1);
  assert.equal(threePlayers.drawPile.length, 156 - (3 * 9) - 1);
  assert.equal(fourPlayers.drawPile.length, 156 - (4 * 9) - 1);
});

test('match timer defaults give players enough time to act', () => {
  assert.equal(PEEK_DURATION, 30_000);
  assert.equal(TURN_DURATION, 45_000);
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

test('simultaneous peek lets players flip independently and auto-completes everyone', () => {
  let state = createGameState([
    { userId: 'u1', displayName: 'One' },
    { userId: 'u2', displayName: 'Two' },
  ], { simultaneousPeek: true });

  let result = flipForPeek(state, 1, 0, 0);
  assert.equal(result.error, undefined);
  assert.equal(result.state.players[1].peekFlips, 1);

  state = result.state;
  result = flipForPeek(state, 0, 0, 0);
  assert.equal(result.error, undefined);
  state = result.state;
  result = flipForPeek(state, 0, 0, 1);
  assert.equal(result.error, undefined);
  assert.equal(result.state.phase, 'peek');
  state = result.state;
  result = flipForPeek(state, 1, 0, 1);
  assert.equal(result.error, undefined);
  assert.equal(result.state.phase, 'turn');

  state = createGameState([
    { userId: 'u1', displayName: 'One' },
    { userId: 'u2', displayName: 'Two' },
  ], { simultaneousPeek: true });
  const completed = autoCompleteCurrentPeek(state);
  assert.equal(completed.phase, 'turn');
  assert.equal(completed.players.every(player => player.peekFlips === 2), true);
});

test('mid-turn actions preserve the original turn deadline', () => {
  const deadline = 987654321;

  let state = startTurns(createGameState([
    { userId: 'u1', displayName: 'One' },
    { userId: 'u2', displayName: 'Two' },
  ]));
  state.currentPlayerIndex = 0;
  state.turnEndsAt = deadline;
  const draw = drawFromDeck(state);
  assert.equal(draw.error, undefined);
  assert.equal(draw.state.turnEndsAt, deadline);

  state = startTurns(createGameState([
    { userId: 'u1', displayName: 'One' },
    { userId: 'u2', displayName: 'Two' },
  ]));
  state.currentPlayerIndex = 0;
  state.turnEndsAt = deadline;
  const discard = takeDiscard(state);
  assert.equal(discard.error, undefined);
  assert.equal(discard.state.turnEndsAt, deadline);

  state = startTurns(createGameState([
    { userId: 'u1', displayName: 'One' },
    { userId: 'u2', displayName: 'Two' },
  ]));
  state.currentPlayerIndex = 0;
  state.turnEndsAt = deadline;
  state.players[0].grid[0][0].faceUp = false;
  const reveal = revealGridCardForDecision(state, 0, 0, 0);
  assert.equal(reveal.error, undefined);
  assert.equal(reveal.state.turnEndsAt, deadline);
});

test('turn-ending actions start a fresh deadline for the next turn', () => {
  const deadline = 987654321;

  let state = startTurns(createGameState([
    { userId: 'u1', displayName: 'One' },
    { userId: 'u2', displayName: 'Two' },
  ]));
  state.currentPlayerIndex = 0;
  state.turnEndsAt = deadline;
  let result = replaceGridCard(state, 0, 0, 0, card('3'));
  assert.equal(result.error, undefined);
  assert.equal(result.state.currentPlayerIndex, 1);
  assert.equal(typeof result.state.turnEndsAt, 'number');
  assert.notEqual(result.state.turnEndsAt, deadline);

  state = startTurns(createGameState([
    { userId: 'u1', displayName: 'One' },
    { userId: 'u2', displayName: 'Two' },
  ]));
  state.currentPlayerIndex = 0;
  state.turnEndsAt = deadline;
  result = discardDrawn(state, 0, card('4'));
  assert.equal(result.error, undefined);
  assert.equal(result.state.currentPlayerIndex, 1);
  assert.equal(typeof result.state.turnEndsAt, 'number');
  assert.notEqual(result.state.turnEndsAt, deadline);

  state = startTurns(createGameState([
    { userId: 'u1', displayName: 'One' },
    { userId: 'u2', displayName: 'Two' },
  ]));
  state.currentPlayerIndex = 0;
  state.turnEndsAt = deadline;
  state.players[0].grid[0][0].faceUp = false;
  const reveal = revealGridCardForDecision(state, 0, 0, 0);
  result = resolvePendingGridDecision(reveal.state, 0, card('5'), 'drawn');
  assert.equal(result.error, undefined);
  assert.equal(result.state.currentPlayerIndex, 1);
  assert.equal(typeof result.state.turnEndsAt, 'number');
  assert.notEqual(result.state.turnEndsAt, deadline);
});

test('replaceGridCard clears a completed three-of-a-kind column to discard', () => {
  let state = createGameState([
    { userId: 'u1', displayName: 'One' },
    { userId: 'u2', displayName: 'Two' },
  ]);
  state = startTurns(state);
  state.currentPlayerIndex = 0;
  state.players[0].grid = [
    [card('7'), card('2'), card('3')],
    [card('7'), card('4'), card('5')],
    [card('9'), card('6'), card('K')],
  ];
  const discardCount = state.discardPile.length;

  const result = replaceGridCard(state, 0, 2, 0, card('7'));
  assert.equal(result.error, undefined);
  assert.equal(result.state.players[0].grid[0][0], null);
  assert.equal(result.state.players[0].grid[1][0], null);
  assert.equal(result.state.players[0].grid[2][0], null);
  assert.equal(result.state.discardPile.length, discardCount + 4);
  assert.equal(result.state.discardPile.slice(-4).map(item => item.rank).sort().join(','), '7,7,7,9');
  assert.equal(result.state.topDiscard.rank, '7');
  assert.equal(scoreGrid(result.state.players[0].grid), 10);
});

test('clearing the last grid column skips impossible bonus turns', () => {
  let state = createGameState([
    { userId: 'u1', displayName: 'One' },
    { userId: 'u2', displayName: 'Two' },
  ]);
  state = startTurns(state);
  state.currentPlayerIndex = 0;
  state.players[0].grid = [
    [card('7'), null, null],
    [card('7'), null, null],
    [card('9'), null, null],
  ];

  const result = replaceGridCard(state, 0, 2, 0, card('7'));
  assert.equal(result.error, undefined);
  assert.equal(result.state.players[0].grid.flat().every(cell => cell === null), true);
  assert.equal(result.state.sweepActive, true);
  assert.equal(result.state.sweepStarterIndex, 0);
  assert.equal(result.state.currentPlayerIndex, 1);
  assert.equal(result.state.mustDrawOnlyForPlayerIndex, undefined);
  assert.equal(typeof result.state.turnEndsAt, 'number');
});

test('discardDrawn leaves the final hidden card face-down and keeps the round live', () => {
  let state = createGameState([
    { userId: 'u1', displayName: 'One' },
    { userId: 'u2', displayName: 'Two' },
  ]);
  state = startTurns(state);
  state.currentPlayerIndex = 0;
  for (const row of state.players[0].grid) {
    for (const cell of row) cell.faceUp = true;
  }
  state.players[0].grid[2][2] = card('8', { faceUp: false });

  const result = discardDrawn(state, 0, card('4'));
  assert.equal(result.error, undefined);
  assert.equal(result.state.players[0].grid[2][2].faceUp, false);
  assert.equal(result.state.sweepActive, false);
  assert.equal(result.state.sweepStarterIndex, null);
  assert.equal(result.state.currentPlayerIndex, 1);
  assert.equal(result.state.topDiscard.rank, '4');
});

test('keep revealed three-of-kind during final pass awards an extra turn', () => {
  let state = createGameState([
    { userId: 'u1', displayName: 'One' },
    { userId: 'u2', displayName: 'Two' },
  ]);
  state = startTurns(state);
  state.currentPlayerIndex = 1;
  state.sweepActive = true;
  state.sweepStarterIndex = 0;
  state.players[1].grid = [
    [card('9'), card('2'), card('3')],
    [card('9'), card('4'), card('5')],
    [card('9', { faceUp: false }), card('6'), card('7')],
  ];

  const reveal = revealGridCardForDecision(state, 1, 2, 0);
  assert.equal(reveal.error, undefined);
  const result = resolvePendingGridDecision(reveal.state, 1, card('K'), 'revealed');
  assert.equal(result.error, undefined);
  assert.equal(result.state.phase, 'turn');
  assert.equal(result.state.currentPlayerIndex, 1);
  assert.equal(result.state.mustDrawOnlyForPlayerIndex, 1);
  assert.equal(result.state.players[1].grid[0][0], null);
  assert.equal(result.state.players[1].grid[1][0], null);
  assert.equal(result.state.players[1].grid[2][0], null);
  assert.equal(result.state.discardPile.slice(-4).map(item => item.rank).sort().join(','), '9,9,9,K');
});

test('discard drawn does not reveal a final hidden card even if it would clear a column', () => {
  let state = createGameState([
    { userId: 'u1', displayName: 'One' },
    { userId: 'u2', displayName: 'Two' },
  ]);
  state = startTurns(state);
  state.currentPlayerIndex = 0;
  state.players[0].grid = [
    [card('5'), card('2'), card('3')],
    [card('5'), card('4'), card('6')],
    [card('5', { faceUp: false }), card('7'), card('8')],
  ];

  const result = discardDrawn(state, 0, card('Q'));
  assert.equal(result.error, undefined);
  assert.equal(result.state.phase, 'turn');
  assert.equal(result.state.currentPlayerIndex, 1);
  assert.equal(result.state.mustDrawOnlyForPlayerIndex, undefined);
  assert.equal(result.state.players[0].grid[0][0].rank, '5');
  assert.equal(result.state.players[0].grid[1][0].rank, '5');
  assert.equal(result.state.players[0].grid[2][0].rank, '5');
  assert.equal(result.state.players[0].grid[2][0].faceUp, false);
  assert.equal(result.state.topDiscard.rank, 'Q');
});

test('final pass reveals hidden cards before advancing to next round', () => {
  let state = createGameState([
    { userId: 'u1', displayName: 'One' },
    { userId: 'u2', displayName: 'Two' },
  ], { totalRounds: 5 });
  state = startTurns(state);
  state.currentPlayerIndex = 0;
  state.round = 1;
  state.totals = [0, 0];
  state.sweepActive = true;
  state.sweepStarterIndex = 1;

  state.players[0].grid = [
    [card('9'), card('2'), card('3')],
    [card('4'), card('5'), card('6')],
    [card('7'), card('8'), card('10')],
  ];
  state.players[1].grid = [
    [card('8', { faceUp: false }), card('2'), card('3')],
    [card('4'), card('K', { faceUp: false }), card('6')],
    [card('7'), card('8'), card('10')],
  ];

  const result = replaceGridCard(state, 0, 0, 0, card('3'));
  assert.equal(result.error, undefined);
  assert.equal(result.state.phase, 'roundReveal');
  assert.equal(result.state.players.every(player => player.grid.flat().every(cell => !cell || cell.faceUp)), true);
  assert.equal(result.state.lastRoundNumber, 1);
  assert.ok(result.state.lastRoundScores?.length);
  assert.equal(typeof result.state.roundRevealEndsAt, 'number');

  result.state.roundRevealEndsAt = Date.now() - 1;
  const summary = resolveExpiredTimers(result.state);
  assert.equal(summary.phase, 'roundSummary');
  assert.equal(summary.round, 1);
  assert.equal(summary.peekEndsAt, undefined);
  assert.equal(typeof summary.roundSummaryEndsAt, 'number');

  const next = continueAfterRoundSummary(summary);
  assert.equal(next.error, undefined);
  assert.equal(next.state.phase, 'peek');
  assert.equal(next.state.round, 2);
  assert.deepEqual(next.state.lastRoundScores, result.state.lastRoundScores);
  assert.deepEqual(next.state.lastRoundTotals, result.state.lastRoundTotals);
});

test('final pass completes when the selected total round is reached', () => {
  let state = createGameState([
    { userId: 'u1', displayName: 'One' },
    { userId: 'u2', displayName: 'Two' },
  ], { totalRounds: 5 });
  state = startTurns(state);
  state.currentPlayerIndex = 0;
  state.round = 5;
  state.totalRounds = 5;
  state.totals = [30, 40];
  state.sweepActive = true;
  state.sweepStarterIndex = 1;

  state.players[0].grid = [
    [card('9'), card('2'), card('3')],
    [card('4'), card('5'), card('6')],
    [card('7'), card('8'), card('10')],
  ];
  state.players[1].grid = [
    [card('8', { faceUp: false }), card('2'), card('3')],
    [card('4'), card('K', { faceUp: false }), card('6')],
    [card('7'), card('8'), card('10')],
  ];

  const result = replaceGridCard(state, 0, 0, 0, card('3'));
  assert.equal(result.error, undefined);
  assert.equal(result.state.phase, 'roundReveal');
  assert.equal(result.state.lastRoundNumber, 5);

  result.state.roundRevealEndsAt = Date.now() - 1;
  const completed = resolveExpiredTimers(result.state);
  assert.equal(completed.phase, 'roundEnd');
  assert.equal(completed.completed, true);
  assert.equal(completed.round, 5);
  assert.equal(completed.totalRounds, 5);
  assert.deepEqual(completed.lastRoundTotals, completed.totals);

  const next = continueAfterRoundSummary(completed);
  assert.equal(next.error, 'Round summary is not active.');
  assert.equal(next.state.round, 5);
});

test('publicGameState exposes viewer held card while masking draw pile', () => {
  const state = createGameState([
    { userId: 'u1', displayName: 'One' },
    { userId: 'u2', displayName: 'Two' },
  ]);
  state.players[0].grid[0][0] = card('9', { faceUp: false });
  const held = card('3');
  const view = publicGameState(state, 'u1', held, 'draw', true, true);
  assert.deepEqual(view.viewerHeldCard, held);
  assert.equal(view.viewerHeldSource, 'draw');
  assert.equal(view.viewerHeldMustReplace, true);
  assert.equal(view.viewerHeldCanDiscard, true);
  assert.equal(view.drawPile.length, state.drawPile.length);
  assert.equal(view.drawPile.every(c => c.faceUp === false), true);
  assert.notEqual(view.players[0].grid[0][0].rank, state.players[0].grid[0][0].rank);
});

test('extra turns require drawing from the deck', () => {
  let state = createGameState([
    { userId: 'u1', displayName: 'One' },
    { userId: 'u2', displayName: 'Two' },
  ]);
  state = startTurns(state);
  state.currentPlayerIndex = 0;
  state.mustDrawOnlyForPlayerIndex = 0;

  const result = takeDiscard(state);
  assert.equal(result.error, 'Extra turns must draw from the deck.');
});

test('face-down replacement reveals first and resolves either card choice', () => {
  let state = createGameState([
    { userId: 'u1', displayName: 'One' },
    { userId: 'u2', displayName: 'Two' },
  ]);
  state = startTurns(state);
  state.currentPlayerIndex = 0;
  state.players[0].grid[0][0] = card('9', { faceUp: false });

  let reveal = revealGridCardForDecision(state, 0, 0, 0);
  assert.equal(reveal.error, undefined);
  assert.equal(reveal.state.players[0].grid[0][0].faceUp, true);
  assert.deepEqual(reveal.state.pendingDecision, {
    playerIndex: 0,
    r: 0,
    c: 0,
    cardId: reveal.state.players[0].grid[0][0].id,
  });

  const keepRevealed = resolvePendingGridDecision(reveal.state, 0, card('K'), 'revealed');
  assert.equal(keepRevealed.error, undefined);
  assert.equal(keepRevealed.state.pendingDecision, null);
  assert.equal(keepRevealed.state.players[0].grid[0][0].rank, '9');
  assert.equal(keepRevealed.state.topDiscard.rank, 'K');

  state = startTurns(state);
  state.currentPlayerIndex = 0;
  state.players[0].grid[1][1] = card('Q', { faceUp: false });
  reveal = revealGridCardForDecision(state, 0, 1, 1);
  const keepDrawn = resolvePendingGridDecision(reveal.state, 0, card('5'), 'drawn');
  assert.equal(keepDrawn.error, undefined);
  assert.equal(keepDrawn.state.players[0].grid[1][1].rank, '5');
  assert.equal(keepDrawn.state.topDiscard.rank, 'Q');
});

test('stale pending decision without a held card keeps revealed card and advances', () => {
  let state = createGameState([
    { userId: 'u1', displayName: 'One' },
    { userId: 'u2', displayName: 'Two' },
  ]);
  state = startTurns(state);
  state.currentPlayerIndex = 0;
  state.players[0].grid[0][0] = card('9', { faceUp: false });

  const reveal = revealGridCardForDecision(state, 0, 0, 0);
  assert.equal(reveal.error, undefined);
  const resolved = resolvePendingGridDecisionWithoutHeld(reveal.state, 0);
  assert.equal(resolved.error, undefined);
  assert.equal(resolved.state.pendingDecision, null);
  assert.equal(resolved.state.players[0].grid[0][0].rank, '9');
  assert.equal(resolved.state.players[0].grid[0][0].faceUp, true);
  assert.equal(resolved.state.currentPlayerIndex, 1);
});
