// App.tsx
// Purpose: Root component that sets up navigation and global providers.
// Update: stronger immersive fullscreen; re-applies when app regains focus.

import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { AppState } from 'react-native';

import LobbyScreen from './screens/LobbyScreen';
import GameScreen from './screens/GameScreen';
import RulesScreen from './screens/RulesScreen';

export type RootStackParamList = {
  Lobby: undefined;
  Game: { players: number; mode: 'passplay' | 'solo' | 'online'; roomCode?: string };
  Rules: undefined;
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
    await NavigationBar.setVisibilityAsync('hidden');
    await NavigationBar.setBehaviorAsync('inset-swipe'); // swipe from edge to reveal temporarily
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
      <StatusBar hidden />
      <NavigationContainer theme={theme}>
        <Stack.Navigator initialRouteName="Lobby" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Lobby" component={LobbyScreen} />
          <Stack.Screen name="Game" component={GameScreen} />
          <Stack.Screen name="Rules" component={RulesScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
