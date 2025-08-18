// src/game/cards.ts
// Purpose: Provide deck creation, shuffling utilities and card scoring.
// This file now implements correct Golf 9 scoring: a 5 counts as –5,
// J/Q = 10 and K = 0.

import type { Card, Suit, Rank, Grid } from './types';

// Define the four suits and all ranks used in a standard deck.
const suits: Suit[] = ['♠','♥','♦','♣'];
const ranks: Rank[] = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

/**
 * Create a shuffled double‑deck of cards for Golf 9.
 * There are two copies of each card to support up to four players.
 */
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
  // Two decks are used in Golf 9.
  return shuffle([...deck, ...deck]);
}

/**
 * In‑place Fisher–Yates shuffle.
 */
export function shuffle<T> (arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Return the Golf 9 score of a card.
 * Zeroed cards are worth 0 points.
 */
export function cardValue(card: Card): number {
  if (card.zeroed) return 0;
  switch (card.rank) {
    case 'A': return 1;
    case '2': return 2;
    case '3': return 3;
    case '4': return 4;
    // In Golf 9 a 5 counts as –5.
    case '5': return -5;
    case '6': return 6;
    case '7': return 7;
    case '8': return 8;
    case '9': return 9;
    case '10': return 10;
    case 'J': return 10;
    case 'Q': return 10;
    // Kings are worth zero.
    case 'K': return 0;
    default: return 0;
  }
}

/**
 * Deep clone a grid of cards.  Useful if you need to copy a player's grid
 * without retaining references.
 */
export function cloneGrid(grid: Grid): Grid {
  return grid.map(row => row.map(c => c ? { ...c } : null));
}
