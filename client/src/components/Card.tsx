// src/components/Card.tsx
// Purpose: Minimal, modern card visuals.
//  - Back: blank tile.
//  - Face: BIG centered rank + single small suit in the top-left.
//  - Never overlaps: the center gets top padding based on suit size.
//  - Optional green ring + "0" tag for zeroed cards.

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
  const r = Math.round(width * 0.12);

  // Scales
  const tinySuit = Math.max(10, Math.round(width * 0.22));
  const bigRank  = Math.min(
    Math.max(18, Math.round(width * 0.52)),
    Math.round(height * 0.58)
  );
  const zeroMark = Math.max(12, Math.round(width * 0.28));

  const Node = (
    <View
      style={[
        styles.card,
        { width, height, borderRadius: r },
        card?.zeroed && styles.zeroedBorder,
      ]}
    >
      {card ? (
        card.faceUp ? (
          <View style={[styles.face, { paddingTop: tinySuit * 1.6 }]}>
            {/* small suit pinned to corner */}
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                styles.suitCorner,
                { fontSize: tinySuit, color: colorForSuit(card.suit) },
              ]}
            >
              {card.suit}
            </Text>

            {/* big centered rank */}
            <View style={styles.centerWrap}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[
                  styles.rankCenter,
                  { fontSize: bigRank, color: colorForSuit(card.suit) },
                ]}
              >
                {card.rank}
              </Text>
            </View>

            {card.zeroed && (
              <Text style={[styles.zeroTag, { fontSize: zeroMark }]}>0</Text>
            )}
          </View>
        ) : (
          <View style={[styles.back, { borderRadius: r - 2 }]} />
        )
      ) : (
        <View style={styles.back} />
      )}
    </View>
  );

  return onPress ? (
    <Pressable onPress={onPress} style={{ width, height }}>
      {Node}
    </Pressable>
  ) : (
    Node
  );
}

function colorForSuit(suit: string) {
  return suit === '♥' || suit === '♦' ? '#FF7A7A' : '#E8ECF1';
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#101735',
    borderWidth: 1,
    borderColor: '#2A2F57',
    overflow: 'hidden',
  },
  face: { flex: 1 },
  suitCorner: { position: 'absolute', left: 8, top: 6, fontWeight: '700' },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  rankCenter: { fontWeight: '900', letterSpacing: 1 },
  back: { flex: 1, backgroundColor: '#141C3F', borderWidth: 1, borderColor: '#2A2F57' },
  zeroedBorder: { borderColor: '#52E5A7', borderWidth: 2 },
  zeroTag: { position: 'absolute', right: 8, bottom: 6, color: '#52E5A7', fontWeight: '900' },
});
