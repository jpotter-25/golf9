// src/context/AuthContext.tsx
// Purpose: App-wide auth/session state for protected routes.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as api from '../services/api';
import { unregisterPushNotifications } from '../services/pushNotifications';
import { getSocialCredential, signOutProviders } from '../services/socialAuth';
import { clearSession, loadSession, saveSession } from '../utils/sessionStorage';
import { logError } from '../utils/logger';

type AuthContextValue = {
  loading: boolean;
  token: string | null;
  user: api.UserProfile | null;
  signIn: (displayName: string, password: string) => Promise<void>;
  signUp: (displayName: string, password: string, inviteCode?: string) => Promise<void>;
  signInWithSocial: (provider: api.AuthProviderKey) => Promise<api.SocialAuthResponse | (api.SocialProfileRequiredResponse & api.SocialAuthPayload)>;
  completeSocialSignUp: (credential: api.SocialAuthPayload, displayName: string, inviteCode?: string) => Promise<void>;
  linkSocialProvider: (provider: api.AuthProviderKey) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<api.UserProfile | null>(null);

  useEffect(() => {
    loadSession()
      .then(async saved => {
        if (!saved) return;
        const parsed = JSON.parse(saved) as { token: string };
        const profile = await api.me(parsed.token);
        setToken(parsed.token);
        setUser(profile.user);
      })
      .catch(error => {
        logError(error, { area: 'restore-session' });
        clearSession();
      })
      .finally(() => setLoading(false));
  }, []);

  const applyAuth = useCallback(async (response: api.AuthResponse) => {
    setToken(response.token);
    setUser(response.user);
    await saveSession(JSON.stringify({ token: response.token }));
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!token) return;
    const profile = await api.me(token);
    setUser(profile.user);
  }, [token]);

  const value = useMemo<AuthContextValue>(() => ({
    loading,
    token,
    user,
    signIn: async (displayName, password) => applyAuth(await api.login(displayName, password)),
    signUp: async (displayName, password, inviteCode = '') => applyAuth(await api.signup(displayName, password, inviteCode)),
    signInWithSocial: async provider => {
      const credential = await getSocialCredential(provider);
      const response = await api.socialLogin(credential);
      if ('token' in response) await applyAuth(response);
      return 'requiresProfile' in response ? { ...response, ...credential } : response;
    },
    completeSocialSignUp: async (credential, displayName, inviteCode = '') => {
      const response = await api.socialLogin({ ...credential, displayName, inviteCode });
      if (!('token' in response)) throw new Error('Social profile setup is still required.');
      await applyAuth(response);
    },
    linkSocialProvider: async provider => {
      if (!token) throw new Error('Log in before linking an account.');
      const credential = await getSocialCredential(provider);
      const response = await api.linkSocialProvider(token, credential);
      setUser(response.user);
    },
    refreshProfile,
    signOut: async () => {
      if (token) {
        await unregisterPushNotifications(token).catch(error => logError(error, { area: 'push-logout' }));
        await api.logout(token).catch(error => logError(error, { area: 'logout' }));
      }
      await signOutProviders().catch(error => logError(error, { area: 'provider-logout' }));
      setToken(null);
      setUser(null);
      await clearSession();
    },
  }), [applyAuth, loading, refreshProfile, token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
