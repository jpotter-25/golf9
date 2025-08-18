// src/screens/LoginScreen.tsx
// Purpose: Landing page for the app.  Presents a welcome message, a "Start"
// button and a link to the Rules page.  Could later be extended to implement
// actual authentication.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Golf 9</Text>
      <Text style={styles.subtitle}>Card Game</Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.replace('Lobby')}
      >
        <Text style={styles.buttonText}>Start Game</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => navigation.navigate('Rules')}
      >
        <Text style={styles.link}>How to Play?</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1023',
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#52E5A7',
    marginBottom: 8
  },
  subtitle: {
    fontSize: 18,
    color: '#E8ECF1',
    marginBottom: 32
  },
  button: {
    backgroundColor: '#52E5A7',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginBottom: 16
  },
  buttonText: {
    color: '#0B1023',
    fontSize: 18,
    fontWeight: 'bold'
  },
  link: {
    color: '#FFCC66',
    textDecorationLine: 'underline',
    fontSize: 16
  }
});
