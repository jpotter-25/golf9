// Purpose: Report the installed app identity to independent platform release-policy checks.

import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type ReleasePlatform = 'android' | 'ios' | 'web';
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
  const configuredBuild = Platform.OS === 'web'
    ? Constants.expoConfig?.extra?.webBuildNumber
    : Application.nativeBuildVersion;
  const parsed = Number.parseInt(String(configuredBuild || '0'), 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export const releaseInfo = {
  platform: (Platform.OS === 'web' ? 'web' : Platform.OS === 'ios' ? 'ios' : 'android') as ReleasePlatform,
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
