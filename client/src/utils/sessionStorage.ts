// src/utils/sessionStorage.ts
// Purpose: Persist auth sessions. Uses web localStorage where available; native builds should replace this with expo-secure-store.

const KEY = 'golf9.session';
let memoryValue: string | null = null;

function storage(): Storage | null {
  if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
    return globalThis.localStorage;
  }
  return null;
}

export async function saveSession(value: string): Promise<void> {
  memoryValue = value;
  storage()?.setItem(KEY, value);
}

export async function loadSession(): Promise<string | null> {
  return storage()?.getItem(KEY) ?? memoryValue;
}

export async function clearSession(): Promise<void> {
  memoryValue = null;
  storage()?.removeItem(KEY);
}
