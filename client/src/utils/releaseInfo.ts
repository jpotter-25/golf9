// Purpose: Report the installed native app identity to release-policy checks.

import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type ReleasePlatform = 'android' | 'ios';
export type ReleaseChannel = 'playtest' | 'production';

function configuredChannel(): ReleaseChannel {
  const configured = String(
    process.env.EXPO_PUBLIC_RELEASE_CHANNEL
      || Constants.expoConfig?.extra?.releaseChannel
      || '',
  ).toLowerCase();
  return configured === 'production' ? 'production' : 'playtest';
}

function installedBuild(): number {
  if (__DEV__) return 999_999;
  const parsed = Number.parseInt(String(Application.nativeBuildVersion || '0'), 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export const releaseInfo = {
  platform: (Platform.OS === 'ios' ? 'ios' : 'android') as ReleasePlatform,
  channel: configuredChannel(),
  build: installedBuild(),
  version: Application.nativeApplicationVersion || Constants.expoConfig?.version || '0.0.0',
};

export function releaseHeaders(): Record<string, string> {
  return {
    'X-Golf9-Platform': releaseInfo.platform,
    'X-Golf9-Channel': releaseInfo.channel,
    'X-Golf9-Build': String(releaseInfo.build),
    'X-Golf9-Version': releaseInfo.version,
  };
}

export function releaseSocketAuth() {
  return { ...releaseInfo };
}
