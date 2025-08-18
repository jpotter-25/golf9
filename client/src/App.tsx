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
} from './screens';

export type RootStackParamList = {
  Login: undefined;
  Lobby: undefined;
  Game: { players: number; mode: 'passplay' | 'solo' | 'online'; roomCode?: string };
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
      <NavigationContainer theme={theme}>
        <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Login">
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Lobby" component={LobbyScreen} />
          <Stack.Screen name="Game" component={GameScreen} />
          <Stack.Screen name="Rules" component={RulesScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
