// src/game/gameLogic.ts
// Purpose: Initialize the game, manage turns, enforce rules and compute scores.
// This version implements the negative‑five rule, the forced draw after a
// three‑of‑a‑kind, and correct 25‑second turn and 15‑second peek timers.

import { createDeck, cardValue } from './cards';
import type { Card, GameState, Grid, Player } from './types';

const ROWS = 3;
const COLS = 3;

// Configuration constants.  These match the design document: 25 s per turn and
// 15 s per peek phase.
const TURN_DURATION = 25_000;
const PEEK_DURATION = 15_000;

/**
 * Initialise an empty 3×3 grid.
 */
export function initGrid(): Grid {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null));
}

/**
 * Deal a full game state with the given number of players.  Each player
 * receives a 3×3 grid of face‑down cards.  The discard pile starts with one
 * face‑up card from the deck.  The game enters the peek phase.
 */
export function deal(players: number): GameState {
  let deck = createDeck();
  const ps: Player[] = [];
  for (let i = 0; i < players; i++) {
    const grid = initGrid();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const card = deck.pop()!;
        grid[r][c] = { ...card, faceUp: false };
      }
    }
    ps.push({
      id: `P${i + 1}`,
      name: `Player ${i + 1}`,
      grid,
      score: 0,
      peekFlips: 0
    });
  }
  const starter = deck.pop()!;
  starter.faceUp = true;

  const game: GameState = {
    id: Math.random().toString(36).slice(2),
    players: ps,
    currentPlayerIndex: 0,
    drawPile: deck,
    discardPile: [starter],
    phase: 'peek',
    topDiscard: starter,
    peekTurnIndex: 0,
    peekEndsAt: Date.now() + PEEK_DURATION
  };
  return game;
}

/**
 * Flip a card during the peek phase.  Players may only flip two cards each.
 */
export function flipForPeek(state: GameState, r: number, c: number): GameState {
  const next = structuredClone(state) as GameState;
  if (next.phase !== 'peek' || next.peekTurnIndex == null) return next;

  const p = next.players[next.peekTurnIndex];
  if (p.peekFlips >= 2) return next;

  const card = p.grid[r][c];
  if (card && !card.faceUp) {
    card.faceUp = true;
    p.peekFlips += 1;
  }
  return next;
}

/**
 * Advance the peek turn.  When all players have peeked two cards, the game
 * enters the main turn phase.
 */
export function advancePeek(state: GameState): GameState {
  const next = structuredClone(state) as GameState;
  if (next.phase !== 'peek' || next.peekTurnIndex == null) return next;

  // find next player who still needs peeks
  let idx = next.peekTurnIndex;
  let marched = 0;
  while (marched < next.players.length) {
    idx = (idx + 1) % next.players.length;
    marched++;
    if ((next.players[idx]?.peekFlips ?? 2) < 2) {
      next.peekTurnIndex = idx;
      next.peekEndsAt = Date.now() + PEEK_DURATION;
      return next;
    }
  }
  // no one left → start turns
  return startTurns(next);
}

/**
 * Force a player to finish peeking automatically when the timer expires.
 */
export function autoCompleteCurrentPeek(state: GameState): GameState {
  const next = structuredClone(state) as GameState;
  if (next.phase !== 'peek' || next.peekTurnIndex == null) return next;
  const p = next.players[next.peekTurnIndex];

  const coords: Array<{ r: number; c: number }> = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const card = p.grid[r][c];
    if (card && !card.faceUp) coords.push({ r, c });
  }
  // Randomly flip until they have two cards face‑up.
  while (p.peekFlips < 2 && coords.length) {
    const i = Math.floor(Math.random() * coords.length);
    const { r, c } = coords.splice(i, 1)[0];
    const card = p.grid[r][c]!;
    card.faceUp = true;
    p.peekFlips += 1;
  }
  return next;
}

/**
 * Start the main turn phase.  Choose a random player to begin and set the
 * turn timer.  Also clear any peek state.
 */
export function startTurns(state: GameState): GameState {
  const next = structuredClone(state) as GameState;
  next.phase = 'turn';
  next.peekTurnIndex = undefined;
  next.peekEndsAt = undefined;
  next.currentPlayerIndex = Math.floor(Math.random() * next.players.length);
  next.turnEndsAt = Date.now() + TURN_DURATION;
  next.mustDrawOnlyForPlayerIndex = undefined;
  return next;
}

/**
 * Draw from the deck.  If the deck is empty, reshuffle the discard pile.
 * If the current player is under a forced‑draw restriction, this resets the
 * flag.  The turn timer is also reset.
 */
export function drawFromDeck(state: GameState): { state: GameState; drawn: Card } {
  const next = structuredClone(state) as GameState;
  if (next.drawPile.length === 0) reshuffle(next);
  const card = next.drawPile.pop()!;
  card.faceUp = true;

  const idx = next.currentPlayerIndex;
  // Consume forced draw flag if this player had a bonus turn.
  if (next.mustDrawOnlyForPlayerIndex === idx) {
    next.mustDrawOnlyForPlayerIndex = undefined;
  }

  next.turnEndsAt = Date.now() + TURN_DURATION;
  return { state: next, drawn: card };
}

/**
 * Take the top card from the discard pile.  If the current player must draw
 * from the deck (due to clearing a column), this function delegates to
 * drawFromDeck() instead.  The turn timer is reset.
 */
export function takeDiscard(state: GameState): { state: GameState; drawn: Card | null } {
  const next = structuredClone(state) as GameState;
  // Enforce three‑of‑a‑kind extra‑turn rule: redirect to drawFromDeck
  if (next.mustDrawOnlyForPlayerIndex === next.currentPlayerIndex) {
    return drawFromDeck(state);
  }

  const top = next.discardPile[next.discardPile.length - 1] ?? null;
  if (top) next.discardPile.pop();
  next.turnEndsAt = Date.now() + TURN_DURATION;
  return { state: next, drawn: top };
}

/**
 * Replace a card in the current player's grid with a new card.  The replaced
 * card is added to the discard pile.  After placement, check for three‑of‑a‑kind
 * in each column.  If a column was just zeroed, grant the player a bonus
 * turn but force them to draw from the deck on that bonus turn.
 */
export function replaceGridCard(state: GameState, playerIndex: number, r: number, c: number, newCard: Card): GameState {
  const next = structuredClone(state) as GameState;
  const player = next.players[playerIndex];
  const replaced = player.grid[r][c];
  // Place the new card face‑up.
  player.grid[r][c] = { ...newCard, faceUp: true };
  if (replaced) {
    // Discard the replaced card.
    next.discardPile.push({ ...replaced, faceUp: true });
    next.topDiscard = next.discardPile[next.discardPile.length - 1];
  }
  // Detect three‑of‑a‑kind in any column.
  const newlyCleared = clearThreeOfAKindColumns(player.grid);
  if (newlyCleared) {
    // Bonus turn: set forced draw and reset timer, but keep same player.
    next.mustDrawOnlyForPlayerIndex = playerIndex;
    next.turnEndsAt = Date.now() + TURN_DURATION;
  } else {
    // Advance to the next player.
    advanceTurn(next);
  }
  return next;
}

/**
 * Discard a drawn card without replacing a grid card.  This ends the player's
 * turn.  (Used when players decide not to replace any card after drawing.)
 */
export function discardDrawn(state: GameState, card: Card): GameState {
  const next = structuredClone(state) as GameState;
  next.discardPile.push({ ...card, faceUp: true });
  next.topDiscard = next.discardPile[next.discardPile.length - 1];
  advanceTurn(next);
  return next;
}

/**
 * Check each column for three identical ranks and mark them as zeroed.  A column
 * must already be face‑up to qualify.  Returns true if at least one column
 * changed from non‑zeroed to zeroed on this call.
 */
function clearThreeOfAKindColumns(grid: Grid): boolean {
  let changed = false;
  for (let c = 0; c < COLS; c++) {
    const col = [grid[0][c], grid[1][c], grid[2][c]];
    if (col.every(card => card && card.faceUp)) {
      const ranks = col.map(card => card!.rank);
      const allZeroedAlready = col.every(card => card!.zeroed === true);
      if (!allZeroedAlready && ranks[0] === ranks[1] && ranks[1] === ranks[2]) {
        // Zero out the column.
        for (let r = 0; r < ROWS; r++) {
          if (grid[r][c]) {
            grid[r][c]!.zeroed = true;
            grid[r][c]!.faceUp = true;
          }
        }
        changed = true;
      }
    }
  }
  return changed;
}

/**
 * Shuffle the discard pile into the deck, leaving the top discard behind.
 */
function reshuffle(state: GameState) {
  const top = state.discardPile.pop();
  const pool = [...state.discardPile];
  state.discardPile = top ? [top] : [];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  state.drawPile.push(...pool.map(c => ({ ...c, faceUp: false })));
  state.topDiscard = top ?? null;
}

/**
 * Compute the total score of a player's grid.  Zeroed cards count as 0 and
 * face‑down cards should never be scored until they are revealed.
 */
export function computeScore(grid: Grid): number {
  let sum = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const card = grid[r][c];
      if (card) sum += cardValue(card);
    }
  }
  return sum;
}

/**
 * Advance to the next player's turn.  Reset the turn timer and clear any
 * forced draw flag.
 */
function advanceTurn(state: GameState) {
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  state.turnEndsAt = Date.now() + TURN_DURATION;
  state.mustDrawOnlyForPlayerIndex = undefined;
}

/**
 * Determine whether the round is over – i.e., all cards are face‑up.  This is
 * used to trigger scoring and start the next round.
 */
export function isRoundOver(state: GameState): boolean {
  return state.players.every(p => p.grid.flat().every(c => c?.faceUp));
}
