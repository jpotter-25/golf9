// client/src/App.tsx
// Purpose: Root navigation with hidden status bar and immersive nav bar.

import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { ActivityIndicator, AppState, Text, View } from 'react-native';

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
} from './screens';
import { AuthProvider, useAuth } from './context/AuthContext';

export type RootStackParamList = {
  Login: undefined;
  Lobby: undefined;
  OnlineMenu: undefined;
  OnlineRoom: { players: 2 | 3 | 4; rounds: 5 | 9; create?: boolean; joinCode?: string; quickPlay?: boolean; ranked?: boolean; wagerBuyIn?: number };
  RankedQueue: { players: 2 | 3 | 4 };
  Game: { players: number; rounds: 5 | 9; mode: 'passplay' | 'solo' | 'online'; roomCode?: string; roomId?: string; online?: boolean; aiDifficulty?: 'easy' | 'hard' };
  Rules: undefined;
  Profile: undefined;
  Shop: undefined;
  Social: undefined;
  Club: undefined;
  PlayerProfile: { userId: string };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

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

function AppNavigator() {
  const { token, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B1023' }}>
        <ActivityIndicator color="#52E5A7" />
        <Text style={{ color: '#E8ECF1', marginTop: 16 }}>Loading Golf 9...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer theme={theme}>
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
            <Stack.Screen name="Social" component={SocialScreen} />
            <Stack.Screen name="Club" component={ClubScreen} />
            <Stack.Screen name="PlayerProfile" component={PlayerProfileScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
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
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
