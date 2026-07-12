// src/services/activeMatchCache.ts
// Purpose: Preserve the online active-match lock when the app restarts without connectivity.

import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVE_MATCH_KEY = 'golf9.active-match.v1';

function activeMatchKey(userId: string) {
  return `${ACTIVE_MATCH_KEY}.${userId}`;
}

export type CachedActiveMatch = {
  userId: string;
  roomCode: string;
  maxPlayers: number;
  rounds: 5 | 9;
  savedAt: number;
};

export async function cacheActiveMatch(match: Omit<CachedActiveMatch, 'savedAt'>) {
  await AsyncStorage.setItem(activeMatchKey(match.userId), JSON.stringify({ ...match, savedAt: Date.now() }));
}

export async function loadCachedActiveMatch(userId: string): Promise<CachedActiveMatch | null> {
  const value = await AsyncStorage.getItem(activeMatchKey(userId));
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as CachedActiveMatch;
    if (parsed.userId !== userId || !parsed.roomCode) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearCachedActiveMatch(userId: string) {
  await AsyncStorage.removeItem(activeMatchKey(userId));
}
