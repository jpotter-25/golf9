// Purpose: Keep store release requirements current and coordinate native updates.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import type { ReleasePolicyResponse } from '../services/api';
import * as api from '../services/api';
import * as network from '../services/network';
import { startNativeAppUpdate } from '../services/nativeAppUpdate';
import { subscribeReleaseRequired } from '../services/releasePolicyEvents';
import {
  deferRecommendedBuild,
  isRecommendedBuildDeferred,
  loadReleasePolicyCache,
  saveReleasePolicyCache,
} from '../utils/releasePolicyCache';
import { logError } from '../utils/logger';
import { useAuth } from './AuthContext';
import { useConnectivity } from './ConnectivityContext';

type ReleasePolicyContextValue = {
  policy: ReleasePolicyResponse | null;
  loading: boolean;
  refreshing: boolean;
  updating: boolean;
  error: string | null;
  recommendedVisible: boolean;
  refresh: () => Promise<void>;
  updateNow: () => Promise<void>;
  remindLater: () => Promise<void>;
};

const ReleasePolicyContext = createContext<ReleasePolicyContextValue | null>(null);

export function ReleasePolicyProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const { isOnline } = useConnectivity();
  const [policy, setPolicy] = useState<ReleasePolicyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendedVisible, setRecommendedVisible] = useState(false);

  const applyPolicy = useCallback((nextPolicy: ReleasePolicyResponse) => {
    setPolicy(nextPolicy);
    setError(null);
    void saveReleasePolicyCache(nextPolicy)
      .catch(cacheError => logError(cacheError, { area: 'release-policy-cache-save' }));
    if (nextPolicy.status !== 'recommended') {
      setRecommendedVisible(false);
      return;
    }
    void isRecommendedBuildDeferred(nextPolicy.latestBuild)
      .then(deferred => setRecommendedVisible(!deferred))
      .catch(cacheError => {
        logError(cacheError, { area: 'release-policy-reminder-load' });
        setRecommendedVisible(true);
      });
  }, []);

  const refresh = useCallback(async () => {
    if (!isOnline) return;
    setRefreshing(true);
    try {
      applyPolicy(await api.appReleasePolicy(token));
    } catch (refreshError) {
      if (refreshError instanceof api.ApiRequestError && refreshError.release) {
        applyPolicy(refreshError.release);
      } else {
        setError(refreshError instanceof Error ? refreshError.message : 'Unable to check for an app update.');
        logError(refreshError, { area: 'release-policy-refresh' });
      }
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [applyPolicy, isOnline, token]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    void loadReleasePolicyCache()
      .then(cached => {
        if (mounted && cached) applyPolicy(cached);
      })
      .catch(cacheError => logError(cacheError, { area: 'release-policy-cache-load' }))
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [applyPolicy]);

  useEffect(() => {
    if (isOnline) void refresh();
  }, [isOnline, refresh]);

  useEffect(() => subscribeReleaseRequired(applyPolicy), [applyPolicy]);

  useEffect(() => {
    if (!token || !isOnline) return;
    network.connect(token);
    const removeUpdate = network.onReleasePolicyUpdate(applyPolicy);
    const removeRequired = network.onReleasePolicyRequired(applyPolicy);
    return () => {
      removeUpdate();
      removeRequired();
    };
  }, [applyPolicy, isOnline, token]);

  useEffect(() => {
    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener('change', nextState => {
      const becameActive = nextState === 'active' && previousState !== 'active';
      previousState = nextState;
      if (becameActive && isOnline) void refresh();
    });
    return () => subscription.remove();
  }, [isOnline, refresh]);

  const updateNow = useCallback(async () => {
    if (!policy) return;
    setUpdating(true);
    setError(null);
    try {
      await startNativeAppUpdate(
        policy.storeUrl,
        policy.status === 'required' || policy.enforcement === 'immediate',
      );
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to open the app store.');
    } finally {
      setUpdating(false);
    }
  }, [policy]);

  const remindLater = useCallback(async () => {
    if (!policy || policy.status !== 'recommended') return;
    await deferRecommendedBuild(policy.latestBuild);
    setRecommendedVisible(false);
  }, [policy]);

  const value = useMemo<ReleasePolicyContextValue>(() => ({
    policy,
    loading,
    refreshing,
    updating,
    error,
    recommendedVisible,
    refresh,
    updateNow,
    remindLater,
  }), [error, loading, policy, recommendedVisible, refresh, refreshing, remindLater, updateNow, updating]);

  return <ReleasePolicyContext.Provider value={value}>{children}</ReleasePolicyContext.Provider>;
}

export function useReleasePolicy() {
  const context = useContext(ReleasePolicyContext);
  if (!context) throw new Error('useReleasePolicy must be used inside ReleasePolicyProvider');
  return context;
}
