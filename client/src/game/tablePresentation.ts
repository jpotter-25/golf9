import type { Card, GameState } from './types';

/** Read-only pile display; never use the table's public card as the viewer's hand. */
export function tablePilePresentation(
  state: GameState,
  isOnline: boolean,
  viewerHeld: Card | null,
  viewerSource: 'draw' | 'discard' | null,
) {
  const publicHeld = isOnline && state.phase === 'turn' && !state.completed
    && state.tableHeld?.playerIndex === state.currentPlayerIndex
    ? state.tableHeld : null;
  return {
    held: publicHeld?.card ?? viewerHeld,
    activeSource: publicHeld?.source ?? viewerSource,
  };
}
