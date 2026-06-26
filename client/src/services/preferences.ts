export type GameplayPreferences = {
  sound: boolean;
  music: boolean;
  vibrate: boolean;
  turnAlerts: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
};

const STORAGE_KEY = 'golf9.gameplayPreferences';

function readStoredPreferences(): Partial<GameplayPreferences> {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
      const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    }
  } catch {}
  return {};
}

function writeStoredPreferences(next: GameplayPreferences) {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  } catch {}
}

let preferences: GameplayPreferences = {
  sound: true,
  music: true,
  vibrate: true,
  turnAlerts: true,
  reducedMotion: false,
  highContrast: false,
  ...readStoredPreferences(),
};

const listeners = new Set<(next: GameplayPreferences) => void>();

export function getGameplayPreferences(): GameplayPreferences {
  return preferences;
}

export function setGameplayPreferences(next: Partial<GameplayPreferences>) {
  preferences = { ...preferences, ...next };
  writeStoredPreferences(preferences);
  listeners.forEach(listener => listener(preferences));
}

export function subscribeGameplayPreferences(listener: (next: GameplayPreferences) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
