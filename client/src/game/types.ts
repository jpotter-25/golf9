// src/game/types.ts
// Purpose: Define shared types for cards, players and game state.  A new
// `mustDrawOnlyForPlayerIndex` flag has been added to support the
// three‑of‑a‑kind bonus rule.

export type Suit = '♠' | '♥' | '♦' | '♣';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export type Card = {
  id: string;
  suit: Suit;
  rank: Rank;
  faceUp: boolean;
  /** When part of a three‑in‑a‑column match, a card is “zeroed” and scores zero. */
  zeroed?: boolean;
};

export type Grid = (Card | null)[][]; // 3×3 layout

export type Player = {
  id: string;
  name: string;
  grid: Grid;
  score: number;
  /** Number of peek flips taken in the pre‑round phase (max 2). */
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

  /** Cached reference to the top of the discard pile for convenience. */
  topDiscard: Card | null;

  /** Turn deadline (ms since epoch).  When Date.now() exceeds this, AI/auto‑draw triggers. */
  turnEndsAt?: number;

  /** For pass‑and‑play peeks: which player is currently peeking (index into players). */
  peekTurnIndex?: number;

  /** Deadline for the current player's peek (ms since epoch). */
  peekEndsAt?: number;

  /**
   * If set to a player index, the specified player must draw from the deck
   * (not the discard pile) at the start of their next turn.  This flag is set
   * when a player clears a column via a three‑of‑a‑kind and is cleared once
   * they draw or when the turn advances.
   */
  mustDrawOnlyForPlayerIndex?: number;
};
