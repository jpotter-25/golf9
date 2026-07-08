import type { Card, GameState, Grid } from './rules';

export type AiDifficulty = 'easy' | 'hard';
export type AiGridTarget = { playerIndex: number; r: number; c: number };

export type AiMove = {
  source: 'draw' | 'discard';
  card: Card | null;
  target: AiGridTarget | null;
  discardDrawn: boolean;
  revealThenDecide?: boolean;
  intent?: string;
};

export function chooseAiMove(state: GameState, playerIndex: number, difficulty?: AiDifficulty): AiMove;
export function aiPlayTurn(state: GameState, playerIndex: number, difficulty?: AiDifficulty): GameState;
export function countFaceDownCards(grid: Grid | undefined): number;
