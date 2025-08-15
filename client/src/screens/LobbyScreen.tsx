// src/screens/LobbyScreen.tsx
// Purpose: Pre-game lobby. Choose mode & players, navigate to Game.

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { createRoom } from '../services/network';

type Props = NativeStackScreenProps<RootStackParamList, 'Lobby'>;

export default function LobbyScreen({ navigation }: Props) {
  const [players, setPlayers] = useState(2);
  const [roomCode, setRoomCode] = useState('');
  const [name, setName] = useState('You');

  const go = (mode: 'passplay' | 'solo' | 'online') => {
    navigation.navigate('Game', { players, mode, roomCode: roomCode || undefined });
  };

  const onCreateRoom = async () => {
    const code = await createRoom();
    setRoomCode(code);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Golf 9</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Players</Text>
        <View style={styles.row}>
          {[2,3,4].map(n => (
            <Pressable key={n} onPress={() => setPlayers(n)} style={[styles.pill, players===n && styles.pillActive]}>
              <Text style={styles.pillText}>{n}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Online (optional)</Text>
        <TextInput
          placeholder="Your name"
          placeholderTextColor="#9BA3C7"
          value={name}
          onChangeText={setName}
          style={styles.input}
        />
        <View style={styles.row}>
          <Pressable onPress={onCreateRoom} style={styles.button}>
            <Text style={styles.buttonText}>Create Room</Text>
          </Pressable>
          <TextInput
            placeholder="Room Code"
            placeholderTextColor="#9BA3C7"
            value={roomCode}
            onChangeText={setRoomCode}
            style={[styles.input, { flex: 1 }]}
          />
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <Pressable onPress={() => go('passplay')} style={styles.cta}><Text style={styles.ctaText}>Pass & Play</Text></Pressable>
        <Pressable onPress={() => go('solo')} style={styles.ctaSecondary}><Text style={styles.ctaText}>Solo vs AI</Text></Pressable>
        <Pressable onPress={() => go('online')} style={styles.ctaOutline}><Text style={styles.ctaText}>Online (LAN)</Text></Pressable>

        <Pressable onPress={() => navigation.navigate('Rules')} style={styles.link}>
          <Text style={styles.linkText}>Rules</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#0B1023', gap: 16, justifyContent: 'center' },
  title: { fontSize: 32, color: '#E8ECF1', fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  card: { backgroundColor: '#121737', borderRadius: 16, padding: 16, gap: 12, borderWidth: 1, borderColor: '#2A2F57' },
  label: { color: '#9BA3C7' },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  pill: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: '#2A2F57' },
  pillActive: { backgroundColor: '#1A2146', borderColor: '#52E5A7' },
  pillText: { color: '#E8ECF1', fontSize: 16 },
  input: { color: '#E8ECF1', borderWidth: 1, borderColor: '#2A2F57', borderRadius: 12, padding: 10, minWidth: 140 },
  button: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#1A2146', borderWidth: 1, borderColor: '#2A2F57' },
  buttonText: { color: '#E8ECF1' },
  cta: { backgroundColor: '#52E5A7', padding: 14, borderRadius: 14, alignItems: 'center' },
  ctaSecondary: { backgroundColor: '#3CC2F2', padding: 14, borderRadius: 14, alignItems: 'center' },
  ctaOutline: { borderWidth: 1, borderColor: '#52E5A7', padding: 14, borderRadius: 14, alignItems: 'center' },
  ctaText: { color: '#0B1023', fontWeight: '800' },
  link: { alignItems: 'center', marginTop: 8 },
  linkText: { color: '#9BA3C7', textDecorationLine: 'underline' }
});
