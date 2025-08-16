// src/game/types.ts
// Purpose: Shared type definitions for game entities and state.

export type Suit = '♠' | '♥' | '♦' | '♣';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export type Card = {
  id: string;
  suit: Suit;
  rank: Rank;
  faceUp: boolean;
  /** True when part of a 3-in-a-column match; card counts as 0 and shows green outline. */
  zeroed?: boolean;
};

export type Grid = (Card | null)[][]; // 3x3

export type Player = {
  id: string;
  name: string;
  grid: Grid;
  score: number;
  /** Number of peek flips taken in the pre-round phase (max 2). */
  peekFlips: number;
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

  /** Turn idle cutoff (ms since epoch). */
  turnEndsAt?: number;

  /** PASS-AND-PLAY: which player is currently peeking (index into players) */
  peekTurnIndex?: number;

  /** Deadline for the current player's peek (ms since epoch) */
  peekEndsAt?: number;
};
