import type { AuthProviderKey, SocialAuthPayload } from './api';

// Apple and browser beta builds use the same Nine Below account credentials.
// Native Google/Facebook integrations remain confined to the Android build.
export function isProviderConfigured(_provider: AuthProviderKey): boolean {
  return false;
}

export async function getSocialCredential(_provider: AuthProviderKey): Promise<SocialAuthPayload> {
  throw new Error('Use your Nine Below display name and password on this device.');
}

export async function signOutProviders(): Promise<void> {
  // First-party sessions are revoked by AuthContext and the server.
}
