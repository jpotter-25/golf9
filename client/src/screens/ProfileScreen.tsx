// client/src/screens/ProfileScreen.tsx
// Purpose: Display basic user information and statistics. Currently placeholder
// content; hook into a backend or local store when available.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Profile</Text>
      {/* Replace these values with real user data */}
      <Text style={styles.stat}>Level: 1</Text>
      <Text style={styles.stat}>Currency: 0</Text>
      <Text style={styles.stat}>Rounds Played: 0</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.buttonText}>Back to Lobby</Text>
      </TouchableOpacity>
    </View>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1023',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#52E5A7',
    marginBottom: 24,
  },
  stat: {
    fontSize: 18,
    color: '#E8ECF1',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#52E5A7',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 32,
  },
  buttonText: {
    color: '#0B1023',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
