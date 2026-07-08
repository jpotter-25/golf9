import type { GameState } from './types';
import {
  aiPlayTurn as sharedAiPlayTurn,
  chooseAiMove as sharedChooseAiMove,
  type AiDifficulty,
  type AiMove,
} from '../../../shared/soloAi';

export type { AiDifficulty, AiMove };

export function chooseAiMove(state: GameState, playerIndex: number, difficulty: AiDifficulty): AiMove {
  return sharedChooseAiMove(state, playerIndex, difficulty);
}

export function aiPlayTurn(state: GameState, playerIndex: number, difficulty: AiDifficulty): GameState {
  return sharedAiPlayTurn(state, playerIndex, difficulty) as GameState;
}
