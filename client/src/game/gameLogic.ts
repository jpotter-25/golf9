// src/game/gameLogic.ts
// Purpose: Initialize game, manage turns, enforce rules, and compute scores.

import { createDeck, cardValue, cloneGrid } from './cards';
import type { Card, GameState, Grid, Player } from './types';

const ROWS = 3;
const COLS = 3;

export function initGrid(): Grid {
  const g: Grid = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null));
  return g;
}

export function deal(players: number): GameState {
  let deck = createDeck();
  const ps: Player[] = [];
  for (let i = 0; i < players; i++) {
    const grid = initGrid();
    // deal 9 cards face down
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const card = deck.pop()!;
        grid[r][c] = { ...card, faceUp: false };
      }
    }
    ps.push({
      id: `P${i+1}`,
      name: `Player ${i+1}`,
      grid,
      score: 0,
      hasPeeking: true,
    });
  }
  // starter card to discard pile
  const starter = deck.pop()!;
  starter.faceUp = true;
  const state: GameState = {
    id: Math.random().toString(36).slice(2),
    players: ps,
    currentPlayerIndex: 0,
    drawPile: deck,
    discardPile: [starter],
    phase: 'peek',
    topDiscard: starter,
  };
  return state;
}

export function flipForPeek(state: GameState, playerIndex: number, r: number, c: number): GameState {
  const next = structuredClone(state) as GameState;
  const p = next.players[playerIndex];
  if (!p.hasPeeking) return next;
  const card = p.grid[r][c];
  if (card && !card.faceUp) {
    card.faceUp = true;
    p.hasPeeking = false;
  }
  return next;
}

export function startTurns(state: GameState): GameState {
  const next = structuredClone(state) as GameState;
  next.phase = 'turn';
  next.turnEndsAt = Date.now() + 35_000; // 35s idle auto-play window
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
  clearThreeOfAKindColumns(player.grid);
  advanceTurn(next);
  return next;
}

// If the player discards the drawn card instead of replacing a grid card
export function discardDrawn(state: GameState, card: Card): GameState {
  const next = structuredClone(state) as GameState;
  next.discardPile.push({ ...card, faceUp: true });
  next.topDiscard = next.discardPile[next.discardPile.length - 1];
  advanceTurn(next);
  return next;
}

function clearThreeOfAKindColumns(grid: Grid) {
  for (let c = 0; c < 3; c++) {
    const col = [grid[0][c], grid[1][c], grid[2][c]];
    if (col.every(card => card && card.faceUp)) {
      const ranks = col.map(card => card!.rank);
      if (ranks[0] === ranks[1] && ranks[1] === ranks[2]) {
        // three-of-a-kind column clears to 0
        for (let r = 0; r < 3; r++) {
          if (grid[r][c]) grid[r][c]!.rank = 'K'; // treat as 0 points (King)
          grid[r][c]!.faceUp = true;
        }
      }
    }
  }
}

function reshuffle(state: GameState) {
  // simple reshuffle: leave top discard, shuffle others into draw
  const top = state.discardPile.pop();
  const pool = [...state.discardPile];
  state.discardPile = top ? [top] : [];
  // basic Fisher-Yates
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  state.drawPile.push(...pool.map(c => ({ ...c, faceUp: false })));
  state.topDiscard = top ?? null;
}

export function computeScore(grid: Grid): number {
  let sum = 0;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
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
  // Round ends when all cards face-up for all players
  return state.players.every(p => p.grid.flat().every(c => c?.faceUp));
}
