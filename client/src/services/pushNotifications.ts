import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import * as api from './api';
import { getInstallId } from '../utils/deviceIdentity';
import { logError } from '../utils/logger';

const CHANNEL_ID = 'game-alerts';
let currentExpoPushToken: string | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function projectId() {
  return Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId || '';
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Game alerts',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#52E5A7',
  });
}

async function getPermissionStatus() {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === 'granted') return existing.status;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status;
}

export async function registerPushNotifications(authToken: string) {
  if (Platform.OS === 'web') return { status: 'unsupported' as const };

  try {
    await ensureAndroidChannel();
    const permission = await getPermissionStatus();
    if (permission !== 'granted') return { status: 'denied' as const };

    const easProjectId = projectId();
    if (!easProjectId) return { status: 'missing-project-id' as const };

    const expoPushToken = (await Notifications.getExpoPushTokenAsync({ projectId: easProjectId })).data;
    const deviceId = await getInstallId();
    currentExpoPushToken = expoPushToken;
    await api.registerPushToken(authToken, {
      expoPushToken,
      deviceId,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
    return { status: 'registered' as const, expoPushToken };
  } catch (error) {
    logError(error, { area: 'push-register' });
    return { status: 'error' as const };
  }
}

export async function unregisterPushNotifications(authToken: string) {
  if (Platform.OS === 'web') return { status: 'unsupported' as const };

  try {
    const deviceId = await getInstallId();
    await api.unregisterPushToken(authToken, {
      expoPushToken: currentExpoPushToken || undefined,
      deviceId,
    });
    currentExpoPushToken = null;
    return { status: 'unregistered' as const };
  } catch (error) {
    logError(error, { area: 'push-unregister' });
    return { status: 'error' as const };
  }
}
