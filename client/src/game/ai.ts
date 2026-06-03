// src/game/ai.ts
// Purpose: Minimal AI helper for solo mode.

import type { GameState } from './types';
import { pickTarget } from '../../../shared/rules';

export function aiChoose(state: GameState, playerIndex: number): { action: 'drawReplace'; replaceAt: { r: number; c: number } } {
  const player = state.players[playerIndex];
  const topDiscard = state.discardPile[state.discardPile.length - 1] ?? state.drawPile[state.drawPile.length - 1];
  return { action: 'drawReplace', replaceAt: pickTarget(player.grid, topDiscard) };
}
