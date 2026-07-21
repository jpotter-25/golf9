// Purpose: Shared live-operations policy, cache, refresh, and player-facing feature gates.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { AvailabilityEntry, AvailabilityResponse, FeatureKey } from '../services/api';
import * as api from '../services/api';
import * as network from '../services/network';
import { loadAvailabilityCache, saveAvailabilityCache } from '../utils/availabilityCache';
import { logError } from '../utils/logger';
import { useAuth } from './AuthContext';
import { useConnectivity } from './ConnectivityContext';

type AvailabilityContextValue = {
  policy: AvailabilityResponse | null;
  loading: boolean;
  refreshing: boolean;
  testerPreview: boolean;
  entry: (featureKey: FeatureKey) => AvailabilityEntry;
  isAvailable: (featureKey: FeatureKey) => boolean;
  isVisible: (featureKey: FeatureKey) => boolean;
  showUnavailable: (featureKey: FeatureKey) => void;
  refresh: () => Promise<void>;
};

const DEFAULT_ENTRY: AvailabilityEntry = {
  featureKey: 'global',
  state: 'live',
  configuredState: 'live',
  inheritedFrom: null,
  title: '',
  message: '',
  retryAt: null,
  testerPreview: false,
  previewState: null,
  previewTitle: '',
  previewMessage: '',
  label: '',
  parent: null,
};

const AvailabilityContext = createContext<AvailabilityContextValue | null>(null);

export function AvailabilityProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  const { isOnline } = useConnectivity();
  const cacheScope = user?.userId ?? 'guest';
  const [policyState, setPolicyState] = useState<{ scope: string; value: AvailabilityResponse | null }>({
    scope: '',
    value: null,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [noticeFeature, setNoticeFeature] = useState<FeatureKey | null>(null);
  const policy = policyState.scope === cacheScope ? policyState.value : null;

  const applyPolicy = useCallback((nextPolicy: AvailabilityResponse) => {
    setPolicyState({ scope: cacheScope, value: nextPolicy });
    void saveAvailabilityCache(cacheScope, nextPolicy)
      .catch(error => logError(error, { area: 'availability-cache-save' }));
  }, [cacheScope]);

  const refresh = useCallback(async () => {
    if (!isOnline) return;
    setRefreshing(true);
    try {
      applyPolicy(await api.appAvailability(token));
    } catch (error) {
      logError(error, { area: 'availability-refresh' });
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [applyPolicy, isOnline, token]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setPolicyState({ scope: cacheScope, value: null });
    void loadAvailabilityCache(cacheScope)
      .then(cached => {
        if (mounted && cached) {
          setPolicyState(current => (
            current.scope === cacheScope && current.value
              ? current
              : { scope: cacheScope, value: cached }
          ));
        }
      })
      .catch(error => logError(error, { area: 'availability-cache-load' }))
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [cacheScope]);

  useEffect(() => {
    if (isOnline) void refresh();
  }, [isOnline, refresh]);

  useEffect(() => {
    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener('change', nextState => {
      const becameActive = nextState === 'active' && previousState !== 'active';
      previousState = nextState;
      if (becameActive && isOnline) void refresh();
    });
    return () => subscription.remove();
  }, [isOnline, refresh]);

  useEffect(() => {
    if (!token || !isOnline) return;
    network.connect(token);
    return network.onAvailabilityUpdate(update => {
      if (update.availability) {
        applyPolicy(update.availability);
      } else {
        void refresh();
      }
    });
  }, [applyPolicy, isOnline, refresh, token]);

  const entry = useCallback((featureKey: FeatureKey): AvailabilityEntry => {
    const current = policy?.features[featureKey];
    return current ?? { ...DEFAULT_ENTRY, featureKey };
  }, [policy]);

  const value = useMemo<AvailabilityContextValue>(() => ({
    policy,
    loading,
    refreshing,
    testerPreview: policy?.testerPreview ?? false,
    entry,
    isAvailable: featureKey => entry(featureKey).state === 'live',
    isVisible: featureKey => entry(featureKey).state !== 'hidden',
    showUnavailable: featureKey => setNoticeFeature(featureKey),
    refresh,
  }), [entry, loading, policy, refresh, refreshing]);

  const notice = noticeFeature ? entry(noticeFeature) : null;
  return (
    <AvailabilityContext.Provider value={value}>
      {children}
      {value.testerPreview ? (
        <View pointerEvents="none" style={styles.testerPreviewBadge}>
          <Text style={styles.testerPreviewText}>Tester Preview</Text>
        </View>
      ) : null}
      <Modal visible={!!notice} transparent animationType="fade" onRequestClose={() => setNoticeFeature(null)}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.eyebrow}>{notice?.label || 'Nine Below'}</Text>
            <Text style={styles.title}>
              {notice?.title || (notice?.state === 'coming_soon' ? 'Coming Soon' : 'Temporarily Unavailable')}
            </Text>
            <Text style={styles.copy}>
              {notice?.message || 'This area is not available right now. Please check again soon.'}
            </Text>
            {notice?.retryAt ? (
              <Text style={styles.retry}>Expected update: {new Date(notice.retryAt).toLocaleString()}</Text>
            ) : null}
            <Pressable style={styles.button} onPress={() => setNoticeFeature(null)}>
              <Text style={styles.buttonText}>Got It</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </AvailabilityContext.Provider>
  );
}

export function useAvailability() {
  const context = useContext(AvailabilityContext);
  if (!context) throw new Error('useAvailability must be used inside AvailabilityProvider');
  return context;
}

const styles = StyleSheet.create({
  testerPreviewBadge: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: '#FFCC66',
    borderRadius: 6,
    backgroundColor: 'rgba(18, 23, 55, 0.96)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  testerPreviewText: {
    color: '#FFCC66',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 7, 17, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3C4676',
    backgroundColor: '#121737',
    padding: 22,
  },
  eyebrow: {
    color: '#FFCC66',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: '#F4F7FF',
    fontSize: 27,
    fontWeight: '900',
    marginTop: 8,
  },
  copy: {
    color: '#C9D1EA',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 10,
  },
  retry: {
    color: '#52E5A7',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 12,
  },
  button: {
    minHeight: 52,
    borderRadius: 8,
    backgroundColor: '#52E5A7',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#0B1023',
    fontSize: 17,
    fontWeight: '900',
  },
});
