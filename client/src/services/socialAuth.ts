import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { AccessToken, LoginManager, Settings } from 'react-native-fbsdk-next';
import { SOCIAL_AUTH_CONFIG } from '../config';
import type { AuthProviderKey, SocialAuthPayload } from './api';

let googleConfigured = false;
let facebookInitialized = false;

export function isProviderConfigured(provider: AuthProviderKey) {
  if (provider === 'google') return !!SOCIAL_AUTH_CONFIG.googleWebClientId;
  return !!SOCIAL_AUTH_CONFIG.facebookAppId && !!SOCIAL_AUTH_CONFIG.facebookClientToken;
}

function configureGoogle() {
  if (googleConfigured) return;
  if (!SOCIAL_AUTH_CONFIG.googleWebClientId) throw new Error('Google login is not configured for this build.');
  GoogleSignin.configure({
    webClientId: SOCIAL_AUTH_CONFIG.googleWebClientId,
    offlineAccess: false,
  });
  googleConfigured = true;
}

function configureFacebook() {
  if (facebookInitialized) return;
  if (!isProviderConfigured('facebook')) throw new Error('Facebook login is not configured for this build.');
  Settings.setAppID(SOCIAL_AUTH_CONFIG.facebookAppId);
  Settings.setClientToken(SOCIAL_AUTH_CONFIG.facebookClientToken);
  Settings.initializeSDK();
  facebookInitialized = true;
}

export async function getGoogleCredential(): Promise<SocialAuthPayload> {
  configureGoogle();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (response.type !== 'success') throw new Error('Google sign-in was cancelled.');
  const idToken = response.data.idToken;
  if (!idToken) throw new Error('Google did not return a sign-in token.');
  return { provider: 'google', idToken };
}

export async function getFacebookCredential(): Promise<SocialAuthPayload> {
  configureFacebook();
  const result = await LoginManager.logInWithPermissions(['public_profile']);
  if (result.isCancelled) throw new Error('Facebook sign-in was cancelled.');
  const data = await AccessToken.getCurrentAccessToken();
  if (!data?.accessToken) throw new Error('Facebook did not return a sign-in token.');
  return { provider: 'facebook', accessToken: data.accessToken };
}

export async function getSocialCredential(provider: AuthProviderKey): Promise<SocialAuthPayload> {
  return provider === 'google' ? getGoogleCredential() : getFacebookCredential();
}

export async function signOutProviders() {
  await GoogleSignin.signOut().catch(() => null);
  LoginManager.logOut();
}
