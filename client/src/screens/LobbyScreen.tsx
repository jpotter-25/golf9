// src/screens/LobbyScreen.tsx
// Purpose: Pre-game menu with player count, rounds selector (5 or 9),
// Pass & Play, Solo vs AI, Online Multiplayer (placeholder), and Rules link.

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Lobby'>;

export default function LobbyScreen({ navigation }: Props) {
  const [players, setPlayers] = useState<2 | 3 | 4>(4);
  const [rounds, setRounds] = useState<5 | 9>(9);

  const pill = (selected: boolean) => [
    styles.pill,
    selected && styles.pillSelected,
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Golf 9</Text>

      {/* Players */}
      <View style={styles.card}>
        <Text style={styles.label}>Players</Text>
        <View style={styles.row}>
          {[2, 3, 4].map((n) => (
            <Pressable key={n} onPress={() => setPlayers(n as 2 | 3 | 4)} style={pill(players === n)}>
              <Text style={styles.pillText}>{n}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Rounds */}
      <View style={styles.card}>
        <Text style={styles.label}>Rounds</Text>
        <View style={styles.row}>
          {[5, 9].map((n) => (
            <Pressable key={n} onPress={() => setRounds(n as 5 | 9)} style={pill(rounds === n)}>
              <Text style={styles.pillText}>{n}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Modes */}
      <View style={{ height: 12 }} />
      <Pressable
        style={[styles.cta, { backgroundColor: '#52E5A7' }]}
        onPress={() => navigation.navigate('Game' as any, { players, mode: 'passplay', rounds } as any)}
      >
        <Text style={styles.ctaText}>Pass & Play</Text>
      </Pressable>

      <View style={{ height: 10 }} />
      <Pressable
        style={[styles.cta, { backgroundColor: '#4DA3FF' }]}
        onPress={() => navigation.navigate('Game' as any, { players, mode: 'solo', rounds } as any)}
      >
        <Text style={styles.ctaText}>Solo vs AI</Text>
      </Pressable>

      <View style={{ height: 10 }} />
      <Pressable
        style={[styles.ctaOutline, { opacity: 0.6 }]}
        disabled
        onPress={() => {}}
      >
        <Text style={styles.ctaOutlineText}>Online Multiplayer (coming soon)</Text>
      </Pressable>

      {/* Footer links */}
      <View style={{ height: 14 }} />
      <Pressable onPress={() => navigation.navigate('Rules' as any)} style={{ alignSelf: 'center', padding: 6 }}>
        <Text style={styles.rulesLink}>Rules</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1023', padding: 16 },
  title: { color: '#E8ECF1', fontSize: 32, fontWeight: '900', marginBottom: 24, textAlign: 'center' },
  card: { backgroundColor: '#121737', borderWidth: 1, borderColor: '#2A2F57', borderRadius: 14, padding: 14, marginBottom: 12 },
  label: { color: '#9BA3C7', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 10 },
  pill: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: '#2A2F57' },
  pillSelected: { backgroundColor: '#1C2553', borderColor: '#4DA3FF' },
  pillText: { color: '#E8ECF1', fontWeight: '700' },

  cta: { padding: 16, borderRadius: 14, alignItems: 'center' },
  ctaText: { color: '#0B1023', fontWeight: '900', fontSize: 16 },

  ctaOutline: {
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2A2F57',
  },
  ctaOutlineText: { color: '#9BA3C7', fontWeight: '800' },

  rulesLink: { color: '#9BA3C7', textDecorationLine: 'underline' },
});
