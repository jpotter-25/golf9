import { Linking } from 'react-native';

export async function startNativeAppUpdate(storeUrl: string, _immediate: boolean): Promise<void> {
  if (!storeUrl) throw new Error('Open TestFlight to check for the latest Nine Below build.');
  await Linking.openURL(storeUrl);
}
