// client/src/screens/ProfileScreen.tsx
// Purpose: Authenticated user profile and stats-ready identity record.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { user, signOut } = useAuth();
  return (
    <View style={styles.container}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{user?.avatarInitial ?? '?'}</Text></View>
      <Text style={styles.title}>{user?.displayName ?? 'Player'}</Text>
      <Text style={styles.stat}>User ID: {user?.userId}</Text>
      <Text style={styles.stat}>Games Played: {user?.stats.gamesPlayed ?? 0}</Text>
      <Text style={styles.stat}>Wins: {user?.stats.wins ?? 0}</Text>
      <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}><Text style={styles.buttonText}>Back to Lobby</Text></TouchableOpacity>
      <TouchableOpacity style={[styles.button, styles.logout]} onPress={signOut}><Text style={styles.buttonText}>Log Out</Text></TouchableOpacity>
    </View>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1023', alignItems: 'center', justifyContent: 'center', padding: 20 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#2A2F57', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  avatarText: { color: '#52E5A7', fontSize: 42, fontWeight: '800' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#52E5A7', marginBottom: 24 },
  stat: { fontSize: 16, color: '#E8ECF1', marginBottom: 12, textAlign: 'center' },
  button: { backgroundColor: '#52E5A7', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, marginTop: 16 },
  logout: { backgroundColor: '#FF6B6B' },
  buttonText: { color: '#0B1023', fontSize: 16, fontWeight: 'bold' },
});
