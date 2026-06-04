// client/src/App.tsx
// Purpose: Root navigation with hidden status bar and immersive nav bar.

import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { AppState } from 'react-native';

import {
  LoginScreen,
  LobbyScreen,
  GameScreen,
  RulesScreen,
  ProfileScreen,
  SettingsScreen,
  OnlineRoomScreen,
} from './screens';
import { AuthProvider, useAuth } from './context/AuthContext';

export type RootStackParamList = {
  Login: undefined;
  Lobby: undefined;
  OnlineRoom: { players: number; rounds: 5 | 9; create?: boolean; joinCode?: string };
  Game: { players: number; rounds: 5 | 9; mode: 'passplay' | 'solo' | 'online'; roomCode?: string; roomId?: string; online?: boolean };
  Rules: undefined;
  Profile: undefined;
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
  if (loading) return null;

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
            <Stack.Screen name="OnlineRoom" component={OnlineRoomScreen} />
            <Stack.Screen name="Game" component={GameScreen} />
            <Stack.Screen name="Rules" component={RulesScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
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
