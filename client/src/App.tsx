// App.tsx
// Purpose: Root component that sets up navigation and global providers.

import React from 'react';
import { NavigationContainer, DefaultTheme, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LobbyScreen from './screens/LobbyScreen';
import GameScreen from './screens/GameScreen';
import RulesScreen from './screens/RulesScreen';

export type RootStackParamList = {
  Lobby: undefined;
  Game: {
    players: number;
    mode: 'passplay' | 'solo' | 'online';
    roomCode?: string;
  };
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

export default function App() {
  return (
    <SafeAreaProvider>
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
