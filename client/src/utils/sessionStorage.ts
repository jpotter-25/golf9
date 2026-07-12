// src/utils/sessionStorage.ts
// Purpose: Persist auth sessions. Native builds use SecureStore; web falls back to localStorage.

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'golf9.session';
const PROFILE_KEY = 'golf9.cached-profile.v1';
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

export async function saveCachedProfile(value: string): Promise<void> {
  if (Platform.OS !== 'web') {
    await AsyncStorage.setItem(PROFILE_KEY, value);
    return;
  }
  storage()?.setItem(PROFILE_KEY, value);
}

export async function loadCachedProfile(): Promise<string | null> {
  if (Platform.OS !== 'web') return AsyncStorage.getItem(PROFILE_KEY);
  return storage()?.getItem(PROFILE_KEY) ?? null;
}

export async function clearCachedProfile(): Promise<void> {
  if (Platform.OS !== 'web') {
    await AsyncStorage.removeItem(PROFILE_KEY);
    return;
  }
  storage()?.removeItem(PROFILE_KEY);
}
