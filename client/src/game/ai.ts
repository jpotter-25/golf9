import type { GameState } from './types';
import {
  aiPlayTurn as sharedAiPlayTurn,
  chooseAiPeekTargets as sharedChooseAiPeekTargets,
  chooseAiMove as sharedChooseAiMove,
  executeAiTurn as sharedExecuteAiTurn,
  planAiTurn as sharedPlanAiTurn,
  type AiDifficulty,
  type AiMove,
  type AiTurnPlan,
} from '../../../shared/soloAi';

export type { AiDifficulty, AiMove, AiTurnPlan };

export function planAiTurn(state: GameState, playerIndex: number, difficulty: AiDifficulty): AiTurnPlan {
  return sharedPlanAiTurn(state, playerIndex, difficulty);
}

export function executeAiTurn(state: GameState, plan: AiTurnPlan): GameState {
  return sharedExecuteAiTurn(state, plan) as GameState;
}

export function chooseAiPeekTargets(state: GameState, playerIndex: number, count = 2): Array<{ r: number; c: number }> {
  return sharedChooseAiPeekTargets(state, playerIndex, count);
}

export function chooseAiMove(state: GameState, playerIndex: number, difficulty: AiDifficulty): AiMove {
  return sharedChooseAiMove(state, playerIndex, difficulty);
}

export function aiPlayTurn(state: GameState, playerIndex: number, difficulty: AiDifficulty): GameState {
  return sharedAiPlayTurn(state, playerIndex, difficulty) as GameState;
}
