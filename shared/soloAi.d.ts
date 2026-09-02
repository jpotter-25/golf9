import type { Card, GameState, Grid } from './rules';

export type AiDifficulty = 'easy' | 'hard';
export type AiPolicy = AiDifficulty | 'afk';
export type AiGridTarget = { playerIndex: number; r: number; c: number };

export type AiMove = {
  source: 'draw' | 'discard';
  card: Card | null;
  target: AiGridTarget | null;
  discardDrawn: boolean;
  revealThenDecide?: boolean;
  finalCardHesitation?: boolean;
  intent?: string;
};

export type AiTurnFingerprint = {
  gameId: string | null;
  round: number;
  turnSerial: number;
  revision: number;
  playerId: string;
};

export type AiTurnPlan = AiMove & {
  playerIndex: number;
  policy: AiPolicy;
  fingerprint: AiTurnFingerprint;
  cardId: string | null;
};

export function planAiTurn(state: GameState, playerIndex: number, policy?: AiPolicy): AiTurnPlan;
export function executeAiTurn(state: GameState, plan: AiTurnPlan): GameState;
export function chooseAiMove(state: GameState, playerIndex: number, difficulty?: AiPolicy): AiTurnPlan;
export function aiPlayTurn(state: GameState, playerIndex: number, difficulty?: AiPolicy): GameState;
export function chooseAiPeekTargets(state: GameState, playerIndex: number, count?: number): Array<{ r: number; c: number }>;
export function countFaceDownCards(grid: Grid | undefined): number;
