// src/game/gameLogic.ts
// Purpose: Initialize game, manage turns, enforce rules, and compute scores.
// Updates in this drop:
// - True pass-and-play peek flow: each player peeks in order with their own 15s deadline.
// - Column 3-of-a-kind: extra turn triggers only when a column becomes zeroed THIS turn.

import { createDeck, cardValue } from './cards';
import type { Card, GameState, Grid, Player } from './types';

const ROWS = 3;
const COLS = 3;

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
      peekFlips: 0
    });
  }
  const starter = deck.pop()!;
  starter.faceUp = true;

  return {
    id: Math.random().toString(36).slice(2),
    players: ps,
    currentPlayerIndex: 0,
    drawPile: deck,
    discardPile: [starter],
    phase: 'peek',
    topDiscard: starter,
    peekTurnIndex: 0,
    peekEndsAt: Date.now() + 15_000
  };
}

/** Peek: flip one of YOUR cards */
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

/** Move peek to next player, or start the turn phase if everyone is done */
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
      next.peekEndsAt = Date.now() + 15_000;
      return next;
    }
  }
  // no one left → start turns
  return startTurns(next);
}

/** Force flip for the current peeker until they reach 2 flips (used at deadline) */
export function autoCompleteCurrentPeek(state: GameState): GameState {
  const next = structuredClone(state) as GameState;
  if (next.phase !== 'peek' || next.peekTurnIndex == null) return next;
  const p = next.players[next.peekTurnIndex];

  const coords: Array<{ r: number; c: number }> = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const card = p.grid[r][c];
    if (card && !card.faceUp) coords.push({ r, c });
  }
  while (p.peekFlips < 2 && coords.length) {
    const idx = Math.floor(Math.random() * coords.length);
    const { r, c } = coords.splice(idx, 1)[0];
    const card = p.grid[r][c]!;
    card.faceUp = true;
    p.peekFlips += 1;
  }
  return next;
}

export function startTurns(state: GameState): GameState {
  const next = structuredClone(state) as GameState;
  next.phase = 'turn';
  next.peekTurnIndex = undefined;
  next.peekEndsAt = undefined;
  next.currentPlayerIndex = Math.floor(Math.random() * next.players.length);
  next.turnEndsAt = Date.now() + 35_000;
  return next;
}

export function drawFromDeck(state: GameState): { state: GameState; drawn: Card } {
  const next = structuredClone(state) as GameState;
  if (next.drawPile.length === 0) reshuffle(next);
  const card = next.drawPile.pop()!;
  card.faceUp = true;
  next.turnEndsAt = Date.now() + 35_000;
  return { state: next, drawn: card };
}

export function takeDiscard(state: GameState): { state: GameState; drawn: Card | null } {
  const next = structuredClone(state) as GameState;
  const top = next.discardPile[next.discardPile.length - 1] ?? null;
  if (top) next.discardPile.pop();
  next.turnEndsAt = Date.now() + 35_000;
  return { state: next, drawn: top };
}

export function replaceGridCard(state: GameState, playerIndex: number, r: number, c: number, newCard: Card): GameState {
  const next = structuredClone(state) as GameState;
  const player = next.players[playerIndex];
  const replaced = player.grid[r][c];
  player.grid[r][c] = { ...newCard, faceUp: true };
  if (replaced) {
    next.discardPile.push({ ...replaced, faceUp: true });
    next.topDiscard = next.discardPile[next.discardPile.length - 1];
  }
  const newlyCleared = clearThreeOfAKindColumns(player.grid);
  if (newlyCleared) {
    // Extra turn: keep current player; reset timer
    next.turnEndsAt = Date.now() + 35_000;
  } else {
    advanceTurn(next);
  }
  return next;
}

export function discardDrawn(state: GameState, card: Card): GameState {
  const next = structuredClone(state) as GameState;
  next.discardPile.push({ ...card, faceUp: true });
  next.topDiscard = next.discardPile[next.discardPile.length - 1];
  advanceTurn(next);
  return next;
}

/** Returns true only if at least one column changed from non-zeroed to zeroed this call */
function clearThreeOfAKindColumns(grid: Grid): boolean {
  let changed = false;
  for (let c = 0; c < COLS; c++) {
    const col = [grid[0][c], grid[1][c], grid[2][c]];
    if (col.every(card => card && card.faceUp)) {
      const ranks = col.map(card => card!.rank);
      const allZeroedAlready = col.every(card => card!.zeroed === true);
      if (!allZeroedAlready && ranks[0] === ranks[1] && ranks[1] === ranks[2]) {
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
  for (let i = pool.length - 1; i > 0; i++) {
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
  state.turnEndsAt = Date.now() + 35_000;
}

export function isRoundOver(state: GameState): boolean {
  return state.players.every(p => p.grid.flat().every(c => c?.faceUp));
}
