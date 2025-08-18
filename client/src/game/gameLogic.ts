// client/src/game/gameLogic.ts
// Purpose: Core rules engine. Fixes:
// - Auto-advance from peek -> turn when all players flipped 2 cards
// - Safe draw/take operations (keeps timer fresh)
// - Keeps special "must draw from deck" rule for 3-in-a-column

import { createDeck, cardValue } from './cards';
import type { Card, GameState, Grid, Player } from './types';

const ROWS = 3;
const COLS = 3;

const TURN_DURATION = 25_000;
const PEEK_DURATION = 15_000;

export function initGrid(): Grid {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null));
}

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
      peekFlips: 0,
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
    peekEndsAt: Date.now() + PEEK_DURATION,
  };
  return game;
}

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

  // If this player finished peeking, either advance to the next peeker
  // or start turns immediately if everyone is done.
  if (p.peekFlips >= 2) {
    if (allPeeked(next)) {
      return startTurns(next);
    }
    return advancePeek(next);
  }
  return next;
}

export function advancePeek(state: GameState): GameState {
  const next = structuredClone(state) as GameState;
  if (next.phase !== 'peek' || next.peekTurnIndex == null) return next;

  if (allPeeked(next)) {
    return startTurns(next);
  }

  let idx = next.peekTurnIndex;
  for (let i = 0; i < next.players.length; i++) {
    idx = (idx + 1) % next.players.length;
    if (next.players[idx].peekFlips < 2) {
      next.peekTurnIndex = idx;
      next.peekEndsAt = Date.now() + PEEK_DURATION;
      return next;
    }
  }
  // Fallback: if somehow no candidate was found, start turns.
  return startTurns(next);
}

function allPeeked(state: GameState): boolean {
  return state.players.every(p => p.peekFlips >= 2);
}

export function autoCompleteCurrentPeek(state: GameState): GameState {
  const next = structuredClone(state) as GameState;
  if (next.phase !== 'peek' || next.peekTurnIndex == null) return next;
  const p = next.players[next.peekTurnIndex];

  // Flip random hidden cards until player has 2
  const coords: Array<{ r: number; c: number }> = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const card = p.grid[r][c];
    if (card && !card.faceUp) coords.push({ r, c });
  }
  while (p.peekFlips < 2 && coords.length) {
    const i = Math.floor(Math.random() * coords.length);
    const { r, c } = coords.splice(i, 1)[0];
    const card = p.grid[r][c]!;
    card.faceUp = true;
    p.peekFlips += 1;
  }

  if (allPeeked(next)) {
    return startTurns(next);
  }
  return advancePeek(next);
}

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

export function drawFromDeck(state: GameState): { state: GameState; drawn: Card } {
  const next = structuredClone(state) as GameState;
  if (next.phase !== 'turn') return { state: next, drawn: next.drawPile[next.drawPile.length - 1]! };

  if (next.drawPile.length === 0) reshuffle(next);
  const card = next.drawPile.pop()!;
  card.faceUp = true;

  // If player was forced to draw deck, consuming the flag here allows discard next time.
  if (next.mustDrawOnlyForPlayerIndex === next.currentPlayerIndex) {
    next.mustDrawOnlyForPlayerIndex = undefined;
  }

  next.turnEndsAt = Date.now() + TURN_DURATION;
  return { state: next, drawn: card };
}

export function takeDiscard(state: GameState): { state: GameState; drawn: Card | null } {
  const next = structuredClone(state) as GameState;
  if (next.phase !== 'turn') return { state: next, drawn: null };

  if (next.mustDrawOnlyForPlayerIndex === next.currentPlayerIndex) {
    // Forced to draw from deck only
    return drawFromDeck(state);
  }

  const top = next.discardPile.pop() ?? null;
  if (top) top.faceUp = true;
  next.topDiscard = next.discardPile[next.discardPile.length - 1] ?? null;
  next.turnEndsAt = Date.now() + TURN_DURATION;
  return { state: next, drawn: top };
}

export function replaceGridCard(state: GameState, playerIndex: number, r: number, c: number, newCard: Card): GameState {
  const next = structuredClone(state) as GameState;
  const player = next.players[playerIndex];
  const replaced = player.grid[r][c];
  player.grid[r][c] = { ...newCard, faceUp: true };

  if (replaced) {
    next.discardPile.push({ ...replaced, faceUp: true });
    next.topDiscard = next.discardPile[next.discardPile.length - 1] ?? null;
  }

  const cleared = clearThreeOfAKindColumns(player.grid);
  if (cleared) {
    next.mustDrawOnlyForPlayerIndex = playerIndex; // next immediate turn, deck only
    next.turnEndsAt = Date.now() + TURN_DURATION;
  } else {
    advanceTurn(next);
  }
  return next;
}

export function discardDrawn(state: GameState, card: Card): GameState {
  const next = structuredClone(state) as GameState;
  next.discardPile.push({ ...card, faceUp: true });
  next.topDiscard = next.discardPile[next.discardPile.length - 1] ?? null;
  advanceTurn(next);
  return next;
}

function clearThreeOfAKindColumns(grid: Grid): boolean {
  let changed = false;
  for (let c = 0; c < COLS; c++) {
    const col = [grid[0][c], grid[1][c], grid[2][c]];
    if (col.every(card => card && card.faceUp)) {
      const ranks = col.map(card => card!.rank);
      const allZeroed = col.every(card => card!.zeroed);
      if (!allZeroed && ranks[0] === ranks[1] && ranks[1] === ranks[2]) {
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

function advanceTurn(state: GameState) {
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  state.turnEndsAt = Date.now() + TURN_DURATION;
  state.mustDrawOnlyForPlayerIndex = undefined;
}

export function isRoundOver(state: GameState): boolean {
  return state.players.every(p => p.grid.flat().every(c => c?.faceUp));
}
