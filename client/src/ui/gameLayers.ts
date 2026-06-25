import type { Card } from '../game/types';

export type GameLayerName = 'table' | 'hud' | 'action' | 'social' | 'feedback' | 'modal';

export type GameNotice = {
  id: string;
  title: string;
  body: string;
  tone: 'turn' | 'warning' | 'reward' | 'achievement' | 'system';
  blocking?: boolean;
};

export type GameActionModel = {
  phase: 'peek' | 'draw' | 'selectGrid' | 'decision' | 'reveal' | 'summary' | 'waiting';
  primaryLabel: string;
  secondaryLabel?: string;
  selectedSource?: 'draw' | 'discard' | null;
  selectedCard?: Card | null;
  canUsePiles: boolean;
  canUseGrid: boolean;
  canCancelSelection: boolean;
  disabledReason?: string;
};

export type GameLayerState = {
  table: { visible: true };
  hud: { visible: true; showTimer: boolean; showScores: boolean };
  action: GameActionModel;
  social: { visible: boolean; unreadCount: number };
  feedback: { notice: GameNotice | null; showCelebrations: boolean };
  modal: { active: 'none' | 'chat' | 'settings' | 'roundSummary' | 'passDevice' | 'notice' };
};

export function actionCopy(model: Pick<GameActionModel, 'phase' | 'selectedSource'>) {
  if (model.phase === 'peek') return 'Flip two cards to start.';
  if (model.phase === 'decision') return 'Choose which card stays.';
  if (model.phase === 'selectGrid') {
    return model.selectedSource === 'discard' ? 'Choose a grid card for the discard.' : 'Choose a grid card for the drawn card.';
  }
  if (model.phase === 'reveal') return 'Final hidden cards are revealing.';
  if (model.phase === 'summary') return 'Review the round results.';
  if (model.phase === 'waiting') return 'Waiting for the table.';
  return 'Draw from the deck or take the discard.';
}
