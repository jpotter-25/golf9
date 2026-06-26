// src/utils/sessionStorage.ts
// Purpose: Persist auth sessions. Native builds use SecureStore; web falls back to localStorage.

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

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
  if (Platform.OS !== 'web') {
    await SecureStore.setItemAsync(KEY, value);
    return;
  }
  storage()?.setItem(KEY, value);
}

export async function loadSession(): Promise<string | null> {
  if (Platform.OS !== 'web') {
    const value = await SecureStore.getItemAsync(KEY);
    memoryValue = value ?? memoryValue;
    return value ?? memoryValue;
  }
  return storage()?.getItem(KEY) ?? memoryValue;
}

export async function clearSession(): Promise<void> {
  memoryValue = null;
  if (Platform.OS !== 'web') {
    await SecureStore.deleteItemAsync(KEY);
    return;
  }
  storage()?.removeItem(KEY);
}
