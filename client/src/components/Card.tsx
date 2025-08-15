// src/components/Card.tsx
// Purpose: Visual card component with face-up / face-down styles.

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { Card } from '../game/types';

type Props = {
  card: Card | null;
  width: number;
  height: number;
  onPress?: () => void;
};

export default function CardView({ card, width, height, onPress }: Props) {
  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <View style={[styles.card, { width, height, opacity: card ? 1 : 0.6 }]}>
        {card ? (
          card.faceUp ? (
            <View style={styles.faceUp}>
              <Text style={styles.rank}>{card.rank}</Text>
              <Text style={styles.suit}>{card.suit}</Text>
            </View>
          ) : (
            <View style={styles.faceDown}>
              <Text style={styles.back}>GOLF</Text>
            </View>
          )
        ) : (
          <View style={styles.empty}/>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    backgroundColor: '#1A2146',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2A2F57',
    justifyContent: 'center',
    alignItems: 'center'
  },
  faceUp: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  faceDown: { flex: 1, backgroundColor: '#121737', alignItems: 'center', justifyContent: 'center' },
  back: { color: '#52E5A7', fontWeight: '700', letterSpacing: 2 },
  rank: { fontSize: 24, color: '#E8ECF1', fontWeight: '700' },
  suit: { fontSize: 20, color: '#FFCC66', marginTop: 4 }
});
