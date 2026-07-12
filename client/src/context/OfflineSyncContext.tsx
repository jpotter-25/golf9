// src/context/OfflineSyncContext.tsx
// Purpose: Queue local match results offline and reconcile them once connectivity returns.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { useConnectivity } from './ConnectivityContext';
import * as api from '../services/api';
import {
  enqueueLocalResult,
  flushQueuedLocalResults,
  queuedLocalResultCount,
  removeQueuedLocalResult,
} from '../services/localResults';

export type LocalResultSyncOutcome = {
  progression: api.MatchProgressionSummary | null;
  queued: boolean;
};

type OfflineSyncContextValue = {
  pendingResults: number;
  syncing: boolean;
  submitLocalResult: (payload: api.LocalResultPayload) => Promise<LocalResultSyncOutcome>;
  syncNow: () => Promise<void>;
};

const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null);

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const { token, user, refreshProfile } = useAuth();
  const { isOnline } = useConnectivity();
  const [pendingResults, setPendingResults] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    setPendingResults(user?.userId ? await queuedLocalResultCount(user.userId) : 0);
  }, [user?.userId]);

  const syncNow = useCallback(async () => {
    if (!token || !user?.userId || !isOnline || syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const synced = await flushQueuedLocalResults(token, user.userId);
      await refreshCount();
      if (synced > 0) await refreshProfile().catch(() => {});
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [isOnline, refreshCount, refreshProfile, token, user?.userId]);

  useEffect(() => {
    void refreshCount();
  }, [refreshCount]);

  useEffect(() => {
    if (isOnline && token) void syncNow();
  }, [isOnline, syncNow, token]);

  const submitLocalResult = useCallback(async (payload: api.LocalResultPayload): Promise<LocalResultSyncOutcome> => {
    if (!token || !user?.userId) return { progression: null, queued: false };
    const entry = await enqueueLocalResult(user.userId, payload);
    await refreshCount();
    if (!isOnline) return { progression: null, queued: true };
    try {
      const response = await api.recordLocalResult(token, entry);
      await removeQueuedLocalResult(entry.clientResultId);
      await refreshCount();
      await refreshProfile().catch(() => {});
      return { progression: response.progression, queued: false };
    } catch {
      return { progression: null, queued: true };
    }
  }, [isOnline, refreshCount, refreshProfile, token, user?.userId]);

  const value = useMemo<OfflineSyncContextValue>(() => ({
    pendingResults,
    syncing,
    submitLocalResult,
    syncNow,
  }), [pendingResults, submitLocalResult, syncNow, syncing]);

  return <OfflineSyncContext.Provider value={value}>{children}</OfflineSyncContext.Provider>;
}

export function useOfflineSync() {
  const context = useContext(OfflineSyncContext);
  if (!context) throw new Error('useOfflineSync must be used inside OfflineSyncProvider');
  return context;
}
