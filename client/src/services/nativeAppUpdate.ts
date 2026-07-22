// Purpose: Start native store updates with a direct store-link fallback.

import * as ExpoInAppUpdates from 'expo-in-app-updates';
import { Linking, Platform } from 'react-native';

const ANDROID_PACKAGE = 'com.potterwell.ninebelow';

async function openStore(storeUrl: string) {
  if (Platform.OS === 'android') {
    const marketUrl = `market://details?id=${ANDROID_PACKAGE}`;
    if (await Linking.canOpenURL(marketUrl)) {
      await Linking.openURL(marketUrl);
      return;
    }
  }
  if (!storeUrl) throw new Error('The store link is not configured yet.');
  await Linking.openURL(storeUrl);
}

export async function startNativeAppUpdate(storeUrl: string, immediate: boolean): Promise<void> {
  if (Platform.OS === 'android' && !__DEV__) {
    try {
      const check = await ExpoInAppUpdates.checkForUpdate();
      const allowed = immediate ? check.immediateAllowed !== false : check.flexibleAllowed !== false;
      if (check.updateAvailable && allowed && await ExpoInAppUpdates.startUpdate(immediate)) return;
    } catch {
      // The Play flow only works for Play-installed builds, so use the listing as a fallback.
    }
  }
  await openStore(storeUrl);
}
