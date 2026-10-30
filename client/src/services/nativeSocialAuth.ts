import { Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { AccessToken, AuthenticationToken, LoginManager, Settings } from 'react-native-fbsdk-next';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { SOCIAL_AUTH_CONFIG } from '../config';
import { socialChallenge } from './api';
import type { AuthConfig, AuthProviderKey, AuthProviderStatus, SocialAuthPayload, SocialAuthPurpose } from './api';

const APPLE_RETURN_URL = 'com.potterwell.ninebelow://auth/apple';
let googleConfigured = false;
let facebookInitialized = false;

export function isProviderConfigured(provider: AuthProviderKey) {
  if (provider === 'apple') return SOCIAL_AUTH_CONFIG.appleEnabled;
  // iOS social login ships only alongside an available equivalent Apple option.
  if (Platform.OS === 'ios' && !SOCIAL_AUTH_CONFIG.appleEnabled) return false;
  if (provider === 'google') return !!SOCIAL_AUTH_CONFIG.googleWebClientId
    && (Platform.OS !== 'ios' || !!SOCIAL_AUTH_CONFIG.googleIosClientId);
  return !!SOCIAL_AUTH_CONFIG.facebookAppId && !!SOCIAL_AUTH_CONFIG.facebookClientToken;
}

export async function availableSocialProviders(config: AuthConfig): Promise<AuthProviderStatus> {
  const apple = isProviderConfigured('apple') && !!config.providers.apple && (Platform.OS === 'ios'
    ? !!config.mobileProviders?.appleIos && await AppleAuthentication.isAvailableAsync()
    : !!config.mobileProviders?.appleAndroid);
  return {
    apple,
    google: !!config.providers.google && isProviderConfigured('google') && (Platform.OS !== 'ios' || apple),
    facebook: !!config.providers.facebook && isProviderConfigured('facebook')
      && (Platform.OS !== 'ios' || (apple && !!config.mobileProviders?.facebookIos)),
  };
}

async function challenge(provider: AuthProviderKey, purpose: SocialAuthPurpose, token?: string | null) {
  const verifier = Array.from(await Crypto.getRandomBytesAsync(32), byte => byte.toString(16).padStart(2, '0')).join('');
  const codeChallenge = (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const result = await socialChallenge({ provider, platform: Platform.OS === 'ios' ? 'ios' : 'android', purpose, codeChallenge }, token);
  return { ...result, verifier };
}

async function googleCredential(): Promise<SocialAuthPayload> {
  if (!googleConfigured) {
    GoogleSignin.configure({ webClientId: SOCIAL_AUTH_CONFIG.googleWebClientId,
      iosClientId: SOCIAL_AUTH_CONFIG.googleIosClientId || undefined, offlineAccess: false });
    googleConfigured = true;
  }
  if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (response.type !== 'success') throw new Error('Google sign-in was cancelled.');
  if (!response.data.idToken) throw new Error('Google did not return a sign-in token.');
  return { provider: 'google', idToken: response.data.idToken };
}

async function facebookCredential(purpose: SocialAuthPurpose, token?: string | null): Promise<SocialAuthPayload> {
  if (!facebookInitialized) {
    Settings.setAppID(SOCIAL_AUTH_CONFIG.facebookAppId);
    Settings.setClientToken(SOCIAL_AUTH_CONFIG.facebookClientToken);
    Settings.setAutoLogAppEventsEnabled(false);
    Settings.setAdvertiserIDCollectionEnabled(false);
    if (Platform.OS === 'ios') await Settings.setAdvertiserTrackingEnabled(false);
    Settings.initializeSDK();
    facebookInitialized = true;
  }
  if (Platform.OS === 'ios') {
    const attempt = await challenge('facebook', purpose, token);
    const result = await LoginManager.logInWithPermissions(['public_profile'], 'limited', attempt.nonce);
    if (result.isCancelled) throw new Error('Facebook sign-in was cancelled.');
    const data = await AuthenticationToken.getAuthenticationTokenIOS();
    if (!data?.authenticationToken) throw new Error('Facebook did not return a sign-in token.');
    return { provider: 'facebook', idToken: data.authenticationToken, challengeId: attempt.challengeId, verifier: attempt.verifier };
  }
  const result = await LoginManager.logInWithPermissions(['public_profile']);
  if (result.isCancelled) throw new Error('Facebook sign-in was cancelled.');
  const data = await AccessToken.getCurrentAccessToken();
  if (!data?.accessToken) throw new Error('Facebook did not return a sign-in token.');
  return { provider: 'facebook', accessToken: data.accessToken };
}

async function appleCredential(purpose: SocialAuthPurpose, token?: string | null): Promise<SocialAuthPayload> {
  const attempt = await challenge('apple', purpose, token);
  const base: SocialAuthPayload = { provider: 'apple', challengeId: attempt.challengeId, verifier: attempt.verifier };
  if (Platform.OS === 'ios') {
    const result = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: attempt.nonce, state: attempt.challengeId,
    });
    if (!result.identityToken || !result.authorizationCode || result.state !== attempt.challengeId) throw new Error('Apple sign-in could not be verified.');
    return { ...base, idToken: result.identityToken, authorizationCode: result.authorizationCode };
  }
  if (!attempt.authorizationUrl || new URL(attempt.authorizationUrl).origin !== 'https://appleid.apple.com') throw new Error('Apple sign-in is unavailable.');
  const result = await WebBrowser.openAuthSessionAsync(attempt.authorizationUrl, APPLE_RETURN_URL);
  if (result.type !== 'success') throw new Error('Apple sign-in was cancelled.');
  const returned = new URL(result.url);
  if (returned.protocol + '//' + returned.host + returned.pathname !== APPLE_RETURN_URL
    || returned.searchParams.get('challengeId') !== attempt.challengeId) throw new Error('Apple sign-in could not be verified.');
  return base;
}

export async function getSocialCredential(provider: AuthProviderKey, purpose: SocialAuthPurpose = 'login', token?: string | null): Promise<SocialAuthPayload> {
  if (!isProviderConfigured(provider)) throw new Error('This sign-in method is not configured for this build.');
  if (provider === 'google') return googleCredential();
  if (provider === 'facebook') return facebookCredential(purpose, token);
  return appleCredential(purpose, token);
}

export async function signOutProviders() {
  if (googleConfigured) await GoogleSignin.signOut().catch(() => null);
  if (facebookInitialized) LoginManager.logOut();
  // Signing out of Nine Below does not sign the device out of its Apple Account.
}
