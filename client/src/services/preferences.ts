export type GameplayPreferences = {
  sound: boolean;
  vibrate: boolean;
  turnAlerts: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
};

let preferences: GameplayPreferences = {
  sound: true,
  vibrate: true,
  turnAlerts: true,
  reducedMotion: false,
  highContrast: false,
};

const listeners = new Set<(next: GameplayPreferences) => void>();

export function getGameplayPreferences(): GameplayPreferences {
  return preferences;
}

export function setGameplayPreferences(next: Partial<GameplayPreferences>) {
  preferences = { ...preferences, ...next };
  listeners.forEach(listener => listener(preferences));
}

export function subscribeGameplayPreferences(listener: (next: GameplayPreferences) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
