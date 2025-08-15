// src/game/ai.ts
// Purpose: Minimal AI for solo mode. Picks discard if beneficial, else draws and replaces highest-value card.

import type { GameState, Card } from './types';
import { cardValue } from './cards';

type Coord = { r: number; c: number };

export function aiChoose(state: GameState, playerIndex: number): { action: 'discard' | 'drawReplace', replaceAt?: Coord } {
  const player = state.players[playerIndex];
  const topDiscard = state.discardPile[state.discardPile.length - 1] ?? null;

  const findHighest = (): Coord => {
    let best: Coord = { r: 0, c: 0 };
    let bestV = -Infinity;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const card = player.grid[r][c];
      if (card) {
        const v = card.faceUp ? cardValue(card) : 10; // unknown is risky, treat as 10
        if (v > bestV) { bestV = v; best = { r, c }; }
      }
    }
    return best;
  };

  if (topDiscard) {
    // If discard helps (lower than highest), take it
    const highest = findHighest();
    const current = player.grid[highest.r][highest.c];
    const currentVal = current ? cardValue(current) : 10;
    if (cardValue(topDiscard) < currentVal) {
      return { action: 'drawReplace', replaceAt: highest };
    }
  }
  // otherwise: draw and replace highest
  return { action: 'drawReplace', replaceAt: findHighest() };
}
