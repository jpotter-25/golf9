// src/context/ConnectivityContext.tsx
// Purpose: Shared device connectivity state for offline play and online-only actions.

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

type ConnectivityContextValue = {
  isOnline: boolean;
  isConnectionKnown: boolean;
};

const ConnectivityContext = createContext<ConnectivityContextValue | null>(null);

function connectionFrom(state: NetInfoState): ConnectivityContextValue {
  const isConnectionKnown = state.isConnected !== null;
  const isOnline = state.isConnected === true && state.isInternetReachable !== false;
  return { isOnline, isConnectionKnown };
}

export function ConnectivityProvider({ children }: { children: React.ReactNode }) {
  const [connection, setConnection] = useState<ConnectivityContextValue>({
    isOnline: false,
    isConnectionKnown: false,
  });

  useEffect(() => {
    let mounted = true;
    void NetInfo.fetch().then(state => {
      if (mounted) setConnection(connectionFrom(state));
    });
    const unsubscribe = NetInfo.addEventListener(state => setConnection(connectionFrom(state)));
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo(() => connection, [connection]);
  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>;
}

export function useConnectivity() {
  const context = useContext(ConnectivityContext);
  if (!context) throw new Error('useConnectivity must be used inside ConnectivityProvider');
  return context;
}
