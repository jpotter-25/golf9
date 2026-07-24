// client/src/App.tsx
// Purpose: Root navigation with hidden status bar and immersive nav bar.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NavigationContainer, DefaultTheme, Theme, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { ActivityIndicator, AppState, BackHandler, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

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
import { ReleasePolicyProvider, useReleasePolicy } from './context/ReleasePolicyContext';
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
    background: '#1A2943',
    card: '#243655',
    primary: '#67E0B0',
    text: '#F7FAFC',
    border: '#435C7D',
    notification: '#F4C95D',
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
        <Text style={styles.activeGateEyebrow}>Nine Below</Text>
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
        <Text style={styles.availabilityEyebrow}>{isGlobal ? 'Nine Below Live Operations' : feature.label || 'Nine Below'}</Text>
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
              <Text style={styles.availabilityLink} onPress={() => void Linking.openURL('https://ninebelow.potterwell.com/privacy')}>Privacy</Text>
              <Text style={styles.availabilityLink} onPress={() => void Linking.openURL('https://ninebelow.potterwell.com/terms')}>Terms</Text>
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
        <ActivityIndicator color="#67E0B0" />
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

function ReleaseUpdateGate({ navigationTick }: { navigationTick: number }) {
  const { token, user, signOut } = useAuth();
  const { isOnline } = useConnectivity();
  const {
    policy,
    loading,
    refreshing,
    updating,
    error,
    recommendedVisible,
    refresh,
    updateNow,
    remindLater,
  } = useReleasePolicy();
  const [activeMatch, setActiveMatch] = useState<api.RoomSummary | null>(null);
  const [checkingActiveMatch, setCheckingActiveMatch] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (policy?.status !== 'required' || policy.enforcement !== 'after_match' || !token || !user?.userId) {
      setActiveMatch(null);
      setCheckingActiveMatch(false);
      return () => {
        mounted = false;
      };
    }
    setCheckingActiveMatch(true);
    const check = isOnline
      ? api.activeRoom(token).then(response => response.mustRejoin ? response.room : null)
      : loadCachedActiveMatch(user.userId).then(cached => cached ? ({
        code: cached.roomCode,
        hostUserId: '',
        status: 'playing' as const,
        matchType: 'casual' as const,
        isPublic: false,
        maxPlayers: cached.maxPlayers,
        rounds: cached.rounds,
        openSeats: 0,
        economy: { buyIn: 0, pot: 0, chargedAt: null },
        players: [],
      }) : null);
    void check
      .then(room => {
        if (mounted) setActiveMatch(room);
      })
      .catch(() => {
        if (mounted) setActiveMatch(null);
      })
      .finally(() => {
        if (mounted) setCheckingActiveMatch(false);
      });
    return () => {
      mounted = false;
    };
  }, [isOnline, navigationTick, policy?.enforcement, policy?.revision, policy?.status, token, user?.userId]);

  const currentRoute = navigationRef.getCurrentRoute();
  const gameParams = currentRoute?.params as Partial<RootStackParamList['Game']> | undefined;
  const isLocalGame = currentRoute?.name === 'Game' && (gameParams?.mode === 'solo' || gameParams?.mode === 'passplay');
  const isEssentialRoute = currentRoute?.name === 'Inbox'
    || currentRoute?.name === 'Settings'
    || currentRoute?.name === 'Rules'
    || currentRoute?.name === 'Tutorial';
  const isOfflineRoute = currentRoute?.name === 'OfflineMenu' || isLocalGame;
  const finishActiveMatchFirst = policy?.status === 'required'
    && policy.enforcement === 'after_match'
    && !!activeMatch;
  const requiredVisible = policy?.status === 'required'
    && !finishActiveMatchFirst
    && !checkingActiveMatch
    && !isOfflineRoute
    && !isEssentialRoute;
  const recommendationVisible = policy?.status === 'recommended'
    && recommendedVisible
    && currentRoute?.name !== 'Game';

  useEffect(() => {
    if (!requiredVisible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [requiredVisible]);

  if (!policy && loading) return null;

  return (
    <>
      {finishActiveMatchFirst ? (
        <View pointerEvents="none" style={styles.updateAfterMatchBanner}>
          <Text style={styles.updateAfterMatchText}>Update required after this match</Text>
        </View>
      ) : null}
      {requiredVisible ? (
        <View style={styles.releaseGateOverlay}>
          <View style={styles.releaseGateCard}>
            <Text style={styles.releaseGateEyebrow}>Nine Below Update</Text>
            <Text style={styles.releaseGateTitle}>{policy.title || 'Update required'}</Text>
            <Text style={styles.releaseGateCopy}>
              {policy.message || 'Install the latest version of Nine Below to continue online.'}
            </Text>
            <View style={styles.releaseVersionRow}>
              <View style={styles.releaseVersionCell}>
                <Text style={styles.releaseVersionLabel}>Installed</Text>
                <Text style={styles.releaseVersionValue}>Build {policy.installedBuild}</Text>
              </View>
              <View style={styles.releaseVersionCell}>
                <Text style={styles.releaseVersionLabel}>Available</Text>
                <Text style={styles.releaseVersionValue}>Build {policy.latestBuild}</Text>
              </View>
            </View>
            {error ? <Text style={styles.releaseError}>{error}</Text> : null}
            <Pressable
              style={[styles.releasePrimaryButton, updating && styles.releaseButtonDisabled]}
              disabled={updating}
              onPress={() => void updateNow()}
            >
              <Text style={styles.releasePrimaryButtonText}>{updating ? 'Opening Google Play...' : 'Update Now'}</Text>
            </Pressable>
            {token ? (
              <Pressable
                style={styles.releaseSecondaryButton}
                onPress={() => {
                  if (!navigationRef.isReady()) return;
                  navigationRef.reset({ index: 0, routes: [{ name: 'OfflineMenu' }] });
                }}
              >
                <Text style={styles.releaseSecondaryButtonText}>Play Offline</Text>
              </Pressable>
            ) : null}
            <View style={styles.releaseEssentialRow}>
              {token ? (
                <Pressable style={styles.releaseLinkButton} onPress={() => navigationRef.navigate('Inbox')}>
                  <Text style={styles.releaseLink}>Inbox</Text>
                </Pressable>
              ) : null}
              {token ? (
                <Pressable style={styles.releaseLinkButton} onPress={() => navigationRef.navigate('Settings')}>
                  <Text style={styles.releaseLink}>Settings</Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.releaseLinkButton} onPress={() => void Linking.openURL('https://ninebelow.potterwell.com/privacy')}>
                <Text style={styles.releaseLink}>Privacy</Text>
              </Pressable>
              {token ? (
                <Pressable style={styles.releaseLinkButton} onPress={() => void signOut()}>
                  <Text style={styles.releaseLink}>Log Out</Text>
                </Pressable>
              ) : null}
            </View>
            <Pressable style={styles.releaseCheckButton} disabled={refreshing} onPress={() => void refresh()}>
              <Text style={styles.releaseCheckText}>{refreshing ? 'Checking...' : 'Check Again'}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      <Modal
        visible={recommendationVisible}
        transparent
        animationType="fade"
        onRequestClose={() => void remindLater()}
      >
        <View style={styles.releaseModalBackdrop}>
          <View style={styles.releasePromptCard}>
            <Text style={styles.releaseGateEyebrow}>New Build Available</Text>
            <Text style={styles.releasePromptTitle}>{policy?.title || 'Nine Below update available'}</Text>
            <Text style={styles.releaseGateCopy}>{policy?.message}</Text>
            {error ? <Text style={styles.releaseError}>{error}</Text> : null}
            <Pressable style={styles.releasePrimaryButton} onPress={() => void updateNow()} disabled={updating}>
              <Text style={styles.releasePrimaryButtonText}>{updating ? 'Opening Store...' : 'Update'}</Text>
            </Pressable>
            <Pressable style={styles.releaseSecondaryButton} onPress={() => void remindLater()}>
              <Text style={styles.releaseSecondaryButtonText}>Later</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

function AppNavigator() {
  const { token, loading } = useAuth();
  const [navigationTick, setNavigationTick] = useState(0);
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A2943' }}>
        <ActivityIndicator color="#67E0B0" />
        <Text style={{ color: '#F7FAFC', marginTop: 16 }}>Loading Nine Below...</Text>
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
      <ReleaseUpdateGate navigationTick={navigationTick} />
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
          <ReleasePolicyProvider>
            <AvailabilityProvider>
              <OfflineSyncProvider>
                <ClubRealtimeProvider>
                  <PushNotificationRegistration />
                  <AppNavigator />
                </ClubRealtimeProvider>
              </OfflineSyncProvider>
            </AvailabilityProvider>
          </ReleasePolicyProvider>
        </AuthProvider>
      </ConnectivityProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  releaseGateOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1200,
    elevation: 1200,
    backgroundColor: '#1A2943',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  releaseGateCard: {
    width: '100%',
    maxWidth: 440,
    borderWidth: 1,
    borderColor: '#60799A',
    borderRadius: 8,
    backgroundColor: '#243655',
    padding: 24,
  },
  releaseGateEyebrow: {
    color: '#F4C95D',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  releaseGateTitle: {
    color: '#F4F7FF',
    fontSize: 31,
    fontWeight: '900',
    marginTop: 8,
  },
  releaseGateCopy: {
    color: '#D7E2EE',
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '700',
    marginTop: 12,
  },
  releaseVersionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  releaseVersionCell: {
    flex: 1,
    minHeight: 74,
    borderWidth: 1,
    borderColor: '#435C7D',
    borderRadius: 8,
    backgroundColor: '#20344F',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  releaseVersionLabel: {
    color: '#8F99BA',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  releaseVersionValue: {
    color: '#F4F7FF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
  },
  releaseError: {
    color: '#FF858F',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 14,
  },
  releasePrimaryButton: {
    minHeight: 56,
    borderRadius: 8,
    backgroundColor: '#67E0B0',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  releasePrimaryButtonText: {
    color: '#1A2943',
    fontSize: 18,
    fontWeight: '900',
  },
  releaseSecondaryButton: {
    minHeight: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#60799A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  releaseSecondaryButtonText: {
    color: '#F4F7FF',
    fontSize: 16,
    fontWeight: '900',
  },
  releaseButtonDisabled: {
    opacity: 0.65,
  },
  releaseEssentialRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  releaseLinkButton: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  releaseLink: {
    color: '#8FBFFF',
    fontSize: 13,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  releaseCheckButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
    marginTop: 6,
  },
  releaseCheckText: {
    color: '#9BA6C9',
    fontSize: 13,
    fontWeight: '800',
  },
  releaseModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 32, 54, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  releasePromptCard: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: '#60799A',
    borderRadius: 8,
    backgroundColor: '#243655',
    padding: 22,
  },
  releasePromptTitle: {
    color: '#F4F7FF',
    fontSize: 26,
    fontWeight: '900',
    marginTop: 8,
  },
  updateAfterMatchBanner: {
    position: 'absolute',
    zIndex: 1100,
    elevation: 1100,
    top: 8,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#F4C95D',
    borderRadius: 6,
    backgroundColor: 'rgba(36, 54, 85, 0.96)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  updateAfterMatchText: {
    color: '#F4C95D',
    fontSize: 12,
    fontWeight: '900',
  },
  availabilityScreen: {
    flex: 1,
    backgroundColor: '#1A2943',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  availabilityCard: {
    width: '100%',
    maxWidth: 440,
    borderWidth: 1,
    borderColor: '#60799A',
    borderRadius: 8,
    backgroundColor: '#243655',
    padding: 24,
  },
  availabilityEyebrow: {
    color: '#F4C95D',
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
    color: '#D7E2EE',
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '700',
    marginTop: 12,
  },
  availabilityRetry: {
    color: '#67E0B0',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 14,
  },
  availabilityPrimaryButton: {
    minHeight: 54,
    borderRadius: 8,
    backgroundColor: '#67E0B0',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  availabilityPrimaryButtonText: {
    color: '#1A2943',
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
    color: '#D7E2EE',
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
    borderColor: '#435C7D',
    borderRadius: 8,
    backgroundColor: '#243655',
    padding: 24,
  },
  activeGateEyebrow: {
    color: '#F4C95D',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  activeGateTitle: {
    color: '#F7FAFC',
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
    color: '#67E0B0',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 16,
  },
  activeGateButton: {
    marginTop: 24,
    minHeight: 56,
    borderRadius: 8,
    backgroundColor: '#67E0B0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  activeGateButtonDisabled: {
    opacity: 0.65,
  },
  activeGateButtonText: {
    color: '#1A2943',
    fontSize: 18,
    fontWeight: '900',
  },
});
