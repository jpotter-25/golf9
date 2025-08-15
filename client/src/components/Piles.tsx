// src/components/Piles.tsx
// Purpose: Draw and discard pile UI with top-of-discard preview.

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useScale } from '../utils/scaling';
import type { Card } from '../game/types';
import CardView from './Card';

type Props = {
  drawCount: number;
  topDiscard: Card | null;
  onDraw: () => void;
  onTakeDiscard: () => void;
};

export default function Piles({ drawCount, topDiscard, onDraw, onTakeDiscard }: Props) {
  const { cardW, cardH, gap } = useScale();
  return (
    <View style={{ flexDirection: 'row', gap: gap * 2, alignItems: 'center', justifyContent: 'center' }}>
      <Pressable onPress={onDraw}>
        <View style={[styles.pile, { width: cardW, height: cardH }]}>
          <Text style={styles.pileText}>Draw ({drawCount})</Text>
        </View>
      </Pressable>
      <Pressable onPress={onTakeDiscard} disabled={!topDiscard}>
        <View>
          <Text style={styles.label}>Discard</Text>
          <CardView card={topDiscard ?? null} width={cardW} height={cardH} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pile: {
    borderRadius: 12,
    backgroundColor: '#1A2146',
    borderWidth: 1,
    borderColor: '#2A2F57',
    alignItems: 'center',
    justifyContent: 'center'
  },
  pileText: { color: '#E8ECF1' },
  label: { color: '#9BA3C7', marginBottom: 6, textAlign: 'center' }
});
