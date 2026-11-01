type AutoplayState = { active: boolean; forfeited?: boolean };
type RoomSeat = { autoplayActive?: boolean; forfeited?: boolean };

export function viewerRecovery({ online, seated, completed, viewer, seat }: {
  online: boolean;
  seated: boolean;
  completed?: boolean;
  viewer?: AutoplayState;
  seat?: RoomSeat;
}) {
  // A viewer-specific game snapshot wins over a separately delivered room update.
  const forfeited = viewer?.forfeited ?? seat?.forfeited ?? false;
  const active = online && seated && !completed && (forfeited || (viewer?.active ?? seat?.autoplayActive ?? false));
  return { active, forfeited, canReclaim: active && !forfeited };
}

export type GameOverlay = 'quit' | 'pass' | 'summary' | 'shop' | 'avatar' | 'settings' | 'chat' | 'clubChat' | 'notice';

export function selectGameOverlay(flags: Record<GameOverlay, boolean>, visible: boolean, autoplay: boolean): GameOverlay | null {
  if (!visible) return null;
  // Exactly one native presentation, including while swapping between dialogs.
  // A turn announcement must never hide the recovery control or interrupt a sheet.
  const priority: GameOverlay[] = ['quit', 'pass', 'summary', 'shop', 'avatar', 'settings', 'chat', 'clubChat', 'notice'];
  return priority.find(key => flags[key] && !(key === 'notice' && autoplay)) ?? null;
}
