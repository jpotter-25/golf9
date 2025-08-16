// src/game/cards.ts
// Purpose: Deck creation, shuffling, and scoring helpers.

import type { Card, Suit, Rank, Grid } from './types';

const suits: Suit[] = ['♠','♥','♦','♣'];
const ranks: Rank[] = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of suits) {
    for (const r of ranks) {
      deck.push({
        id: `${s}-${r}-${Math.random().toString(36).slice(2)}`,
        suit: s,
        rank: r,
        faceUp: false
      });
    }
  }
  return shuffle([...deck, ...deck]); // 2 decks for 3x3 Golf for 2–4 players
}

export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function cardValue(card: Card): number {
  if (card.zeroed) return 0;
  switch (card.rank) {
    case 'A': return 1;
    case '2': return 2;
    case '3': return 3;
    case '4': return 4;
    case '5': return 5; // tweak later if using -5 variant
    case '6': return 6;
    case '7': return 7;
    case '8': return 8;
    case '9': return 9;
    case '10': return 10;
    case 'J': return 10;
    case 'Q': return 10;
    case 'K': return 0;
    default: return 0;
  }
}

export function cloneGrid(grid: Grid): Grid {
  return grid.map(row => row.map(c => c ? { ...c } : null));
}
