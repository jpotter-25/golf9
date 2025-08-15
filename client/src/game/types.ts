// src/game/types.ts
// Purpose: Shared type definitions for game entities and state.

export type Suit = '♠' | '♥' | '♦' | '♣';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export type Card = {
  id: string;
  suit: Suit;
  rank: Rank;
  faceUp: boolean;
};

export type Grid = (Card | null)[][]; // 3x3

export type Player = {
  id: string;
  name: string;
  grid: Grid;
  score: number;
  hasPeeking: boolean;
};

export type GameMode = 'passplay' | 'solo' | 'online';

export type GameState = {
  id: string;
  players: Player[];
  currentPlayerIndex: number;
  drawPile: Card[];
  discardPile: Card[];
  phase: 'peek' | 'turn' | 'roundEnd';
  topDiscard: Card | null;
  turnEndsAt?: number; // ms epoch for idle-time auto-play
};
