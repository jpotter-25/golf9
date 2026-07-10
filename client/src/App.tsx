// client/src/App.tsx
// Purpose: Root navigation with hidden status bar and immersive nav bar.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NavigationContainer, DefaultTheme, Theme, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  LoginScreen,
  LobbyScreen,
  GameScreen,
  RulesScreen,
  ProfileScreen,
  SettingsScreen,
  OnlineMenuScreen,
  OnlineRoomScreen,
  RankedQueueScreen,
  SocialScreen,
  PlayerProfileScreen,
  ClubScreen,
  ShopScreen,
  InboxScreen,
} from './screens';
import { AuthProvider, useAuth } from './context/AuthContext';
import * as api from './services/api';
import { getGameplayPreferences, subscribeGameplayPreferences, type GameplayPreferences } from './services/preferences';
import { registerPushNotifications, unregisterPushNotifications } from './services/pushNotifications';

export type RootStackParamList = {
  Login: undefined;
  Lobby: undefined;
  OnlineMenu: undefined;
  OnlineRoom: { players: 2 | 3 | 4; rounds: 5 | 9; create?: boolean; joinCode?: string; quickPlay?: boolean; ranked?: boolean; wagerBuyIn?: number };
  RankedQueue: { players: 2 | 3 | 4 };
  Game: { players: number; rounds: 5 | 9; mode: 'passplay' | 'solo' | 'online'; roomCode?: string; roomId?: string; online?: boolean; aiDifficulty?: 'easy' | 'hard'; localPlayerNames?: string[] };
  Rules: undefined;
  Profile: undefined;
  Shop: undefined;
  Inbox: undefined;
  Social: undefined;
  Club: undefined;
  PlayerProfile: { userId: string; fromActiveMatchRoomCode?: string };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

const theme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#0B1023',
    card: '#121737',
    primary: '#52E5A7',
    text: '#E8ECF1',
    border: '#2A2F57',
    notification: '#FFCC66',
  },
};

async function applyImmersive() {
  try {
    await NavigationBar.setVisibilityAsync('hidden');   // hide Android nav bar
    await NavigationBar.setBehaviorAsync('inset-swipe');
    await NavigationBar.setPositionAsync('absolute');
    await NavigationBar.setBackgroundColorAsync('transparent');
  } catch {}
}

function gameRouteForRoom(room: api.RoomSummary): RootStackParamList['Game'] {
  return {
    players: room.maxPlayers,
    rounds: room.rounds,
    mode: 'online',
    roomCode: room.code,
    online: true,
  };
}

function isOnActiveGame(room: api.RoomSummary) {
  const current = navigationRef.getCurrentRoute();
  const params = current?.params as Partial<RootStackParamList['Game']> | undefined;
  return current?.name === 'Game' && params?.roomCode === room.code;
}

function isAllowedActiveMatchRoute(room: api.RoomSummary) {
  const current = navigationRef.getCurrentRoute();
  const params = current?.params as Partial<RootStackParamList['PlayerProfile']> | undefined;
  return isOnActiveGame(room) || (current?.name === 'PlayerProfile' && params?.fromActiveMatchRoomCode === room.code);
}

function resetToActiveGame(room: api.RoomSummary) {
  if (!navigationRef.isReady()) return false;
  if (isOnActiveGame(room)) return true;
  navigationRef.reset({
    index: 0,
    routes: [{ name: 'Game', params: gameRouteForRoom(room) }],
  });
  return true;
}

function ActiveMatchGate({ navigationTick }: { navigationTick: number }) {
  const { token } = useAuth();
  const [checked, setChecked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [active, setActive] = useState<api.ActiveRoomResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const checkingRef = useRef(false);

  const checkActiveMatch = useCallback(async (showLoader = false) => {
    if (!token || checkingRef.current) return;
    checkingRef.current = true;
    if (showLoader) setChecking(true);
    setError(null);
    try {
      const response = await api.activeRoom(token);
      if (response.mustRejoin && response.room) {
        if (isAllowedActiveMatchRoute(response.room)) {
          setActive(null);
        } else if (resetToActiveGame(response.room)) {
          setActive(null);
        } else {
          setActive(response);
        }
      } else {
        setActive(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to check your active match.');
    } finally {
      checkingRef.current = false;
      setChecked(true);
      setChecking(false);
    }
  }, [token]);

  useEffect(() => {
    setChecked(false);
    setActive(null);
    setError(null);
    if (token) void checkActiveMatch(true);
  }, [checkActiveMatch, token]);

  useEffect(() => {
    if (!token || !checked) return;
    const current = navigationRef.getCurrentRoute();
    if (current?.name !== 'Game') void checkActiveMatch(false);
  }, [checked, checkActiveMatch, navigationTick, token]);

  useEffect(() => {
    if (!token) return;
    let previousState = AppState.currentState;
    const sub = AppState.addEventListener('change', nextState => {
      const becameActive = nextState === 'active' && previousState !== 'active';
      previousState = nextState;
      if (becameActive) void checkActiveMatch(false);
    });
    return () => sub.remove();
  }, [checkActiveMatch, token]);

  const room = active?.room ?? null;
  const showInitialCheck = !!token && checking && !checked;
  const visible = showInitialCheck || !!room || !!error;
  if (!visible) return null;

  return (
    <View style={styles.activeGateOverlay}>
      <View style={styles.activeGateCard}>
        <Text style={styles.activeGateEyebrow}>Golf 9</Text>
        <Text style={styles.activeGateTitle}>
          {room ? 'Match in Progress' : error ? 'Connection Check Needed' : 'Checking Active Match'}
        </Text>
        <Text style={styles.activeGateCopy}>
          {room
            ? `Room ${room.code} is still active. Rejoin this match to keep playing.`
            : error
              ? error
              : 'Looking for an unfinished online match before opening the lobby.'}
        </Text>
        {room ? (
          <Text style={styles.activeGateMeta}>
            {room.maxPlayers} players - {room.rounds} rounds
          </Text>
        ) : null}
        <Pressable
          style={[styles.activeGateButton, checking && styles.activeGateButtonDisabled]}
          disabled={checking}
          onPress={() => {
            if (room && resetToActiveGame(room)) {
              setActive(null);
              return;
            }
            void checkActiveMatch(true);
          }}
        >
          <Text style={styles.activeGateButtonText}>
            {checking ? 'Checking...' : room ? 'Rejoin Match' : 'Retry'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function AppNavigator() {
  const { token, loading } = useAuth();
  const [navigationTick, setNavigationTick] = useState(0);
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B1023' }}>
        <ActivityIndicator color="#52E5A7" />
        <Text style={{ color: '#E8ECF1', marginTop: 16 }}>Loading Golf 9...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={theme}
      onReady={() => setNavigationTick(tick => tick + 1)}
      onStateChange={() => setNavigationTick(tick => tick + 1)}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={token ? 'Lobby' : 'Login'}>
        {!token ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Rules" component={RulesScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Lobby" component={LobbyScreen} />
            <Stack.Screen name="OnlineMenu" component={OnlineMenuScreen} />
            <Stack.Screen name="OnlineRoom" component={OnlineRoomScreen} />
            <Stack.Screen name="RankedQueue" component={RankedQueueScreen} />
            <Stack.Screen name="Game" component={GameScreen} />
            <Stack.Screen name="Rules" component={RulesScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="Shop" component={ShopScreen} />
            <Stack.Screen name="Inbox" component={InboxScreen} />
            <Stack.Screen name="Social" component={SocialScreen} />
            <Stack.Screen name="Club" component={ClubScreen} />
            <Stack.Screen name="PlayerProfile" component={PlayerProfileScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </>
        )}
      </Stack.Navigator>
      {token ? <ActiveMatchGate navigationTick={navigationTick} /> : null}
    </NavigationContainer>
  );
}

function PushNotificationRegistration() {
  const { token } = useAuth();
  const [prefs, setPrefs] = React.useState<GameplayPreferences>(getGameplayPreferences());

  useEffect(() => subscribeGameplayPreferences(setPrefs), []);

  useEffect(() => {
    if (!token) return;
    if (prefs.turnAlerts) {
      void registerPushNotifications(token);
      return;
    }
    void unregisterPushNotifications(token);
  }, [prefs.turnAlerts, token]);

  return null;
}

export default function App() {
  useEffect(() => {
    applyImmersive();
    const sub = AppState.addEventListener('change', () => applyImmersive());
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      {/* Hide the OS status bar */}
      <StatusBar hidden />
      <AuthProvider>
        <PushNotificationRegistration />
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  activeGateOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    elevation: 999,
    backgroundColor: 'rgba(5, 8, 18, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  activeGateCard: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: '#2A2F57',
    borderRadius: 8,
    backgroundColor: '#121737',
    padding: 24,
  },
  activeGateEyebrow: {
    color: '#FFCC66',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  activeGateTitle: {
    color: '#E8ECF1',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0,
  },
  activeGateCopy: {
    color: '#B8C0E0',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 23,
    marginTop: 12,
  },
  activeGateMeta: {
    color: '#52E5A7',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 16,
  },
  activeGateButton: {
    marginTop: 24,
    minHeight: 56,
    borderRadius: 8,
    backgroundColor: '#52E5A7',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  activeGateButtonDisabled: {
    opacity: 0.65,
  },
  activeGateButtonText: {
    color: '#0B1023',
    fontSize: 18,
    fontWeight: '900',
  },
});
