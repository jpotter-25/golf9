// client/src/game/gameLogic.ts
// Purpose: Local-play wrappers around the shared authoritative Nine Below rules.

import type { Card, GameState, Grid, PlayerIdentity } from './types';
import {
  advancePeek as sharedAdvancePeek,
  autoCompleteCurrentPeek as sharedAutoCompleteCurrentPeek,
  dealLocal,
  discardDrawn as sharedDiscardDrawn,
  drawFromDeck as sharedDrawFromDeck,
  flipForPeek as sharedFlipForPeek,
  initGrid,
  isRoundOver,
  replaceGridCard as sharedReplaceGridCard,
  scoreGrid,
  startTurns,
  takeDiscard as sharedTakeDiscard,
} from '../../../shared/rules';

export { initGrid, isRoundOver, scoreGrid as computeScore, startTurns };

type LocalDealOptions = {
  round?: number;
  totalRounds?: number;
  totals?: number[];
  simultaneousPeek?: boolean;
};

export function deal(players: number, identities?: PlayerIdentity[], options?: LocalDealOptions): GameState {
  return dealLocal(players, identities, options) as GameState;
}

export function flipForPeek(state: GameState, r: number, c: number): GameState {
  const playerIndex = state.peekTurnIndex ?? 0;
  return sharedFlipForPeek(state, playerIndex, r, c).state as GameState;
}

export function advancePeek(state: GameState): GameState {
  return sharedAdvancePeek(state) as GameState;
}

export function autoCompleteCurrentPeek(state: GameState): GameState {
  return sharedAutoCompleteCurrentPeek(state) as GameState;
}

export function drawFromDeck(state: GameState): { state: GameState; drawn: Card } {
  const result = sharedDrawFromDeck(state);
  return { state: result.state as GameState, drawn: result.drawn as Card };
}

export function takeDiscard(state: GameState): { state: GameState; drawn: Card | null } {
  const result = sharedTakeDiscard(state);
  return { state: result.state as GameState, drawn: result.drawn as Card | null };
}

export function replaceGridCard(state: GameState, playerIndex: number, r: number, c: number, newCard: Card): GameState {
  return sharedReplaceGridCard(state, playerIndex, r, c, newCard).state as GameState;
}

export function discardDrawn(state: GameState, card: Card): GameState {
  return sharedDiscardDrawn(state, state.currentPlayerIndex, card).state as GameState;
}

export function getGridScore(grid: Grid): number {
  return scoreGrid(grid);
}
