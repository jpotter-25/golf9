// client/src/App.tsx
// Purpose: Root navigation with hidden status bar and immersive nav bar.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NavigationContainer, DefaultTheme, Theme, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { ActivityIndicator, AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  LoginScreen,
  LobbyScreen,
  GameScreen,
  RulesScreen,
  TutorialScreen,
  ProfileScreen,
  SettingsScreen,
  OnlineMenuScreen,
  OfflineMenuScreen,
  RankedMenuScreen,
  OnlineRoomScreen,
  RankedQueueScreen,
  SocialScreen,
  PlayerProfileScreen,
  ClubScreen,
  ShopScreen,
  InboxScreen,
} from './screens';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ClubRealtimeProvider } from './context/ClubRealtimeContext';
import { ConnectivityProvider, useConnectivity } from './context/ConnectivityContext';
import { AvailabilityProvider, useAvailability } from './context/AvailabilityContext';
import { OfflineSyncProvider } from './context/OfflineSyncContext';
import * as api from './services/api';
import { getGameplayPreferences, subscribeGameplayPreferences, type GameplayPreferences } from './services/preferences';
import { registerPushNotifications, unregisterPushNotifications } from './services/pushNotifications';
import { cacheActiveMatch, clearCachedActiveMatch, loadCachedActiveMatch } from './services/activeMatchCache';

export type RootStackParamList = {
  Login: undefined;
  Lobby: undefined;
  CasualMenu: undefined;
  RankedMenu: undefined;
  OfflineMenu: undefined;
  OnlineRoom: { players: 2 | 3 | 4; rounds: 5 | 9; create?: boolean; joinCode?: string; quickPlay?: boolean; ranked?: boolean; wagerBuyIn?: number };
  RankedQueue: { players: 2 | 3 | 4 };
  Game: { players: number; rounds: 5 | 9; mode: 'passplay' | 'solo' | 'online'; roomCode?: string; roomId?: string; online?: boolean; aiDifficulty?: 'easy' | 'hard'; localPlayerNames?: string[] };
  Rules: undefined;
  Tutorial: undefined;
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
  const { token, user } = useAuth();
  const { isOnline, isConnectionKnown } = useConnectivity();
  const [checked, setChecked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [active, setActive] = useState<api.ActiveRoomResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const checkingRef = useRef(false);

  const checkActiveMatch = useCallback(async (showLoader = false) => {
    if (!token || !user?.userId || checkingRef.current) return;
    if (!isOnline) {
      const cached = await loadCachedActiveMatch(user.userId);
      if (cached) {
        const room: api.RoomSummary = {
          code: cached.roomCode,
          hostUserId: '',
          status: 'playing',
          matchType: 'casual',
          isPublic: false,
          maxPlayers: cached.maxPlayers,
          rounds: cached.rounds,
          openSeats: 0,
          economy: { buyIn: 0, pot: 0, chargedAt: null },
          players: [],
        };
        setActive({ active: true, mustRejoin: true, room, game: null });
      } else {
        setActive(null);
      }
      setChecked(true);
      setChecking(false);
      setError(null);
      return;
    }
    checkingRef.current = true;
    if (showLoader) setChecking(true);
    setError(null);
    try {
      const response = await api.activeRoom(token);
      if (response.mustRejoin && response.room) {
        await cacheActiveMatch({
          userId: user.userId,
          roomCode: response.room.code,
          maxPlayers: response.room.maxPlayers,
          rounds: response.room.rounds,
        });
        if (isAllowedActiveMatchRoute(response.room)) {
          setActive(null);
        } else if (resetToActiveGame(response.room)) {
          setActive(null);
        } else {
          setActive(response);
        }
      } else {
        await clearCachedActiveMatch(user.userId);
        setActive(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to check your active match.');
    } finally {
      checkingRef.current = false;
      setChecked(true);
      setChecking(false);
    }
  }, [isOnline, token, user?.userId]);

  useEffect(() => {
    setChecked(false);
    setActive(null);
    setError(null);
    if (token && isConnectionKnown) void checkActiveMatch(true);
  }, [checkActiveMatch, isConnectionKnown, token]);

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
            ? isOnline
              ? `Room ${room.code} is still active. Rejoin this match to keep playing.`
              : `Room ${room.code} is still active. Reconnect to return to the table.`
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
          style={[styles.activeGateButton, (checking || (!!room && !isOnline)) && styles.activeGateButtonDisabled]}
          disabled={checking || (!!room && !isOnline)}
          onPress={() => {
            if (room && isOnline && resetToActiveGame(room)) {
              setActive(null);
              return;
            }
            void checkActiveMatch(true);
          }}
        >
          <Text style={styles.activeGateButtonText}>
            {checking ? 'Checking...' : room ? isOnline ? 'Rejoin Match' : 'Waiting for Connection' : 'Retry'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function LockedFeature({ featureKey }: { featureKey: api.FeatureKey }) {
  const { entry, refresh, refreshing } = useAvailability();
  const { signOut } = useAuth();
  const feature = entry(featureKey);
  const isGlobal = feature.inheritedFrom === 'global' || feature.featureKey === 'global';
  const retryLabel = feature.retryAt
    ? new Date(feature.retryAt).toLocaleString()
    : null;

  return (
    <View style={styles.availabilityScreen}>
      <View style={styles.availabilityCard}>
        <Text style={styles.availabilityEyebrow}>{isGlobal ? 'Golf 9 Live Operations' : feature.label || 'Golf 9'}</Text>
        <Text style={styles.availabilityTitle}>
          {feature.title || (feature.state === 'coming_soon' ? 'Coming Soon' : 'Temporarily Unavailable')}
        </Text>
        <Text style={styles.availabilityCopy}>
          {feature.message || 'This area is not available right now. Please check again soon.'}
        </Text>
        {retryLabel ? <Text style={styles.availabilityRetry}>Expected update: {retryLabel}</Text> : null}
        <Pressable style={styles.availabilityPrimaryButton} onPress={() => void refresh()} disabled={refreshing}>
          <Text style={styles.availabilityPrimaryButtonText}>{refreshing ? 'Checking...' : 'Check Again'}</Text>
        </Pressable>
        {isGlobal ? (
          <>
            <View style={styles.availabilityEssentialRow}>
              <Pressable style={styles.availabilitySecondaryButton} onPress={() => navigationRef.navigate('Inbox')}>
                <Text style={styles.availabilitySecondaryButtonText}>Inbox & Support</Text>
              </Pressable>
              <Pressable style={styles.availabilitySecondaryButton} onPress={() => navigationRef.navigate('Settings')}>
                <Text style={styles.availabilitySecondaryButtonText}>Settings</Text>
              </Pressable>
            </View>
            <View style={styles.availabilityLegalRow}>
              <Text style={styles.availabilityLink} onPress={() => void Linking.openURL('https://games.joinup.us/privacy')}>Privacy</Text>
              <Text style={styles.availabilityLink} onPress={() => void Linking.openURL('https://games.joinup.us/terms')}>Terms</Text>
              <Text style={styles.availabilityLink} onPress={() => void signOut()}>Log Out</Text>
            </View>
          </>
        ) : (
          <Pressable style={styles.availabilitySecondaryButton} onPress={() => navigationRef.goBack()}>
            <Text style={styles.availabilitySecondaryButtonText}>Go Back</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function AvailabilityRoute({ featureKey, children }: { featureKey: api.FeatureKey; children: React.ReactNode }) {
  const { entry, loading } = useAvailability();
  if (loading) {
    return (
      <View style={styles.availabilityScreen}>
        <ActivityIndicator color="#52E5A7" />
        <Text style={styles.availabilityLoadingText}>Checking availability...</Text>
      </View>
    );
  }
  if (entry(featureKey).state !== 'live') return <LockedFeature featureKey={featureKey} />;
  return <>{children}</>;
}

function LobbyRoute(props: React.ComponentProps<typeof LobbyScreen>) {
  return <AvailabilityRoute featureKey="global"><LobbyScreen {...props} /></AvailabilityRoute>;
}

function CasualMenuRoute(props: React.ComponentProps<typeof OnlineMenuScreen>) {
  return <AvailabilityRoute featureKey="casual"><OnlineMenuScreen {...props} /></AvailabilityRoute>;
}

function RankedMenuRoute(props: React.ComponentProps<typeof RankedMenuScreen>) {
  return <AvailabilityRoute featureKey="ranked"><RankedMenuScreen {...props} /></AvailabilityRoute>;
}

function OfflineMenuRoute(props: React.ComponentProps<typeof OfflineMenuScreen>) {
  return <AvailabilityRoute featureKey="offline"><OfflineMenuScreen {...props} /></AvailabilityRoute>;
}

function OnlineRoomRoute(props: React.ComponentProps<typeof OnlineRoomScreen>) {
  const params = props.route.params;
  let featureKey: api.FeatureKey = 'casual';
  if (params.ranked) featureKey = `ranked.${params.players}p` as api.FeatureKey;
  else if (params.wagerBuyIn) featureKey = 'casual.wagers';
  else if (params.quickPlay) featureKey = 'casual.auto_match';
  else if (params.joinCode) featureKey = 'casual.join_room';
  else if (params.create) featureKey = 'casual.create_room';
  return <AvailabilityRoute featureKey={featureKey}><OnlineRoomScreen {...props} /></AvailabilityRoute>;
}

function RankedQueueRoute(props: React.ComponentProps<typeof RankedQueueScreen>) {
  const featureKey = `ranked.${props.route.params.players}p` as api.FeatureKey;
  return <AvailabilityRoute featureKey={featureKey}><RankedQueueScreen {...props} /></AvailabilityRoute>;
}

function RulesRoute(props: React.ComponentProps<typeof RulesScreen>) {
  return <AvailabilityRoute featureKey="rules"><RulesScreen {...props} /></AvailabilityRoute>;
}

function TutorialRoute(props: React.ComponentProps<typeof TutorialScreen>) {
  return <AvailabilityRoute featureKey="tutorial"><TutorialScreen {...props} /></AvailabilityRoute>;
}

function ProfileRoute(props: React.ComponentProps<typeof ProfileScreen>) {
  return <AvailabilityRoute featureKey="profile"><ProfileScreen {...props} /></AvailabilityRoute>;
}

function ShopRoute(props: React.ComponentProps<typeof ShopScreen>) {
  return <AvailabilityRoute featureKey="shop"><ShopScreen {...props} /></AvailabilityRoute>;
}

function InboxRoute(props: React.ComponentProps<typeof InboxScreen>) {
  return <AvailabilityRoute featureKey="inbox"><InboxScreen {...props} /></AvailabilityRoute>;
}

function SocialRoute(props: React.ComponentProps<typeof SocialScreen>) {
  return <AvailabilityRoute featureKey="social"><SocialScreen {...props} /></AvailabilityRoute>;
}

function ClubRoute(props: React.ComponentProps<typeof ClubScreen>) {
  return <AvailabilityRoute featureKey="clubs"><ClubScreen {...props} /></AvailabilityRoute>;
}

function PlayerProfileRoute(props: React.ComponentProps<typeof PlayerProfileScreen>) {
  return <AvailabilityRoute featureKey="profile"><PlayerProfileScreen {...props} /></AvailabilityRoute>;
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
            <Stack.Screen name="Tutorial" component={TutorialScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Lobby" component={LobbyRoute} />
            <Stack.Screen name="CasualMenu" component={CasualMenuRoute} />
            <Stack.Screen name="RankedMenu" component={RankedMenuRoute} />
            <Stack.Screen name="OfflineMenu" component={OfflineMenuRoute} />
            <Stack.Screen name="OnlineRoom" component={OnlineRoomRoute} />
            <Stack.Screen name="RankedQueue" component={RankedQueueRoute} />
            <Stack.Screen name="Game" component={GameScreen} />
            <Stack.Screen name="Rules" component={RulesRoute} />
            <Stack.Screen name="Tutorial" component={TutorialRoute} />
            <Stack.Screen name="Profile" component={ProfileRoute} />
            <Stack.Screen name="Shop" component={ShopRoute} />
            <Stack.Screen name="Inbox" component={InboxRoute} />
            <Stack.Screen name="Social" component={SocialRoute} />
            <Stack.Screen name="Club" component={ClubRoute} />
            <Stack.Screen name="PlayerProfile" component={PlayerProfileRoute} />
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
  const { isOnline } = useConnectivity();
  const [prefs, setPrefs] = React.useState<GameplayPreferences>(getGameplayPreferences());

  useEffect(() => subscribeGameplayPreferences(setPrefs), []);

  useEffect(() => {
    if (!token || !isOnline) return;
    if (prefs.turnAlerts) {
      void registerPushNotifications(token);
      return;
    }
    void unregisterPushNotifications(token);
  }, [isOnline, prefs.turnAlerts, token]);

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
      <ConnectivityProvider>
        <AuthProvider>
          <AvailabilityProvider>
            <OfflineSyncProvider>
              <ClubRealtimeProvider>
                <PushNotificationRegistration />
                <AppNavigator />
              </ClubRealtimeProvider>
            </OfflineSyncProvider>
          </AvailabilityProvider>
        </AuthProvider>
      </ConnectivityProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  availabilityScreen: {
    flex: 1,
    backgroundColor: '#080C1C',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  availabilityCard: {
    width: '100%',
    maxWidth: 440,
    borderWidth: 1,
    borderColor: '#394574',
    borderRadius: 8,
    backgroundColor: '#121737',
    padding: 24,
  },
  availabilityEyebrow: {
    color: '#FFCC66',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  availabilityTitle: {
    color: '#F4F7FF',
    fontSize: 30,
    fontWeight: '900',
    marginTop: 10,
  },
  availabilityCopy: {
    color: '#C9D1EA',
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '700',
    marginTop: 12,
  },
  availabilityRetry: {
    color: '#52E5A7',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 14,
  },
  availabilityPrimaryButton: {
    minHeight: 54,
    borderRadius: 8,
    backgroundColor: '#52E5A7',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  availabilityPrimaryButtonText: {
    color: '#0B1023',
    fontSize: 17,
    fontWeight: '900',
  },
  availabilityEssentialRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  availabilitySecondaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3C4676',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingHorizontal: 12,
  },
  availabilitySecondaryButtonText: {
    color: '#F4F7FF',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  availabilityLegalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 22,
  },
  availabilityLink: {
    color: '#8FBFFF',
    fontSize: 14,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  availabilityLoadingText: {
    color: '#C9D1EA',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 14,
  },
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
