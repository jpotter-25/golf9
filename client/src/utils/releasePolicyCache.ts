// Purpose: Preserve the last mandatory release policy for disconnected launches.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReleasePolicyResponse } from '../services/api';
import { releaseInfo } from './releaseInfo';

const POLICY_KEY = 'golf9.release-policy.v1';
const LATER_KEY_PREFIX = 'golf9.release-policy.later.v1';

export async function loadReleasePolicyCache(): Promise<ReleasePolicyResponse | null> {
  const raw = await AsyncStorage.getItem(POLICY_KEY);
  if (!raw) return null;
  try {
    const cached = JSON.parse(raw) as ReleasePolicyResponse;
    let status: ReleasePolicyResponse['status'] = 'current';
    if (cached.storeReady && cached.minimumBuild > releaseInfo.build) status = 'required';
    else if (cached.storeReady && cached.latestBuild > releaseInfo.build) status = 'recommended';
    return {
      ...cached,
      installedBuild: releaseInfo.build,
      installedVersion: releaseInfo.version,
      status,
      title: status === 'recommended' && cached.status === 'required'
        ? 'Nine Below update available'
        : cached.title,
      message: status === 'recommended' && cached.status === 'required'
        ? 'A newer version of Nine Below is ready. Update now for the latest fixes and features.'
        : cached.message,
    };
  } catch {
    await AsyncStorage.removeItem(POLICY_KEY);
    return null;
  }
}

export async function saveReleasePolicyCache(policy: ReleasePolicyResponse): Promise<void> {
  await AsyncStorage.setItem(POLICY_KEY, JSON.stringify(policy));
}

export async function deferRecommendedBuild(build: number): Promise<void> {
  await AsyncStorage.setItem(`${LATER_KEY_PREFIX}.${build}`, String(Date.now()));
}

export async function isRecommendedBuildDeferred(build: number, now = Date.now()): Promise<boolean> {
  const raw = await AsyncStorage.getItem(`${LATER_KEY_PREFIX}.${build}`);
  const deferredAt = Number(raw || 0);
  return Number.isFinite(deferredAt) && now - deferredAt < 24 * 60 * 60 * 1000;
}
