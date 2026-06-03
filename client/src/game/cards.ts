// src/game/cards.ts
// Purpose: Typed client exports for the shared Golf 9 deck and scoring rules.

export { createDeck, shuffle, cardValue, scoreGrid, initGrid } from '../../../shared/rules';
export type { Card, Suit, Rank, Grid } from './types';

export function cloneGrid<T>(grid: T[][]): T[][] {
  return grid.map(row => row.map(card => (card && typeof card === 'object' ? { ...card } : card)));
}
