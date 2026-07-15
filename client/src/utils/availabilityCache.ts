// Purpose: Cache the last server-published feature policy for offline navigation.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AvailabilityResponse } from '../services/api';

const KEY_PREFIX = 'golf9.availability.v2';

function cacheKey(scope: string): string {
  return `${KEY_PREFIX}.${encodeURIComponent(scope)}`;
}

export async function saveAvailabilityCache(scope: string, value: AvailabilityResponse): Promise<void> {
  await AsyncStorage.setItem(cacheKey(scope), JSON.stringify(value));
}

export async function loadAvailabilityCache(scope: string): Promise<AvailabilityResponse | null> {
  const key = cacheKey(scope);
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AvailabilityResponse;
  } catch {
    await AsyncStorage.removeItem(key);
    return null;
  }
}
