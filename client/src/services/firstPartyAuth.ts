import type { AuthProviderKey, AuthProviderStatus, SocialAuthPayload, SocialAuthPurpose } from './api';

// Browser builds retain first-party login; mobile uses nativeSocialAuth.
export function isProviderConfigured(_provider: AuthProviderKey): boolean {
  return false;
}

export async function getSocialCredential(_provider: AuthProviderKey, _purpose?: SocialAuthPurpose, _token?: string | null): Promise<SocialAuthPayload> {
  throw new Error('Use your Nine Below display name and password on this device.');
}

export async function availableSocialProviders(): Promise<AuthProviderStatus> {
  return { google: false, facebook: false, apple: false };
}

export async function signOutProviders(): Promise<void> {
  // First-party sessions are revoked by AuthContext and the server.
}
