// src/App.tsx
// Purpose: Root component that sets up navigation, global providers and screens.
// This version includes Login, Lobby, Game, Rules, Profile and Settings screens.

import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { AppState } from 'react-native';

// Import screens.
import LoginScreen from './screens/LoginScreen';
import LobbyScreen from './screens/LobbyScreen';
import GameScreen from './screens/GameScreen';
import RulesScreen from './screens/RulesScreen';
import ProfileScreen from './screens/ProfileScreen';
import SettingsScreen from './screens/SettingsScreen';

// Define the shape of the navigation stack parameters.
export type RootStackParamList = {
  Login: undefined;
  Lobby: undefined;
  Game: { players: number; mode: 'passplay' | 'solo' | 'online'; roomCode?: string };
  Rules: undefined;
  Profile: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Custom dark theme matching the concept art.
const theme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#0B1023', // deep navy
    card: '#121737',       // panel background
    primary: '#52E5A7',    // green accent
    text: '#E8ECF1',       // light text
    border: '#2A2F57',
    notification: '#FFCC66'
  },
};

// Hide Android navigation bar for a more immersive experience.
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
      <StatusBar style="light" />
      <NavigationContainer theme={theme}>
        <Stack.Navigator
          screenOptions={{ headerShown: false }}
          initialRouteName="Login"
        >
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
