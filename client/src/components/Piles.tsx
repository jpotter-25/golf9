// src/components/Piles.tsx
// Purpose: Unified Draw/Discard piles with matching visuals.
// Change in this pass:
//  - The full-card preview is shown ONLY when the active source is "draw".
//    If a player takes from the discard pile, nothing appears on the draw pile.

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { Card } from '../game/types';
import CardView from './Card';
import type { Metrics } from '../utils/scaling';

type Props = {
  drawCount: number; // kept for logic; not displayed
  topDiscard: Card | null;
  held: Card | null;
  metrics: Metrics;
  onDraw: () => void;
  onTakeDiscard: () => void;
  activeSource?: 'draw' | 'discard' | null;
};

export default function Piles({
  drawCount, // eslint-disable-line @typescript-eslint/no-unused-vars
  topDiscard,
  held,
  metrics,
  onDraw,
  onTakeDiscard,
  activeSource,
}: Props) {
  const { cardW, cardH, gap } = metrics;

  // Blue ring sized to hug the card’s outer edge
  const RING_W = 2;
  const ringStyle = {
    width: cardW + RING_W * 2,
    height: cardH + RING_W * 2,
    borderRadius: 12 + RING_W,
    left: -RING_W,
    top: -RING_W,
  } as const;

  return (
    <View style={{ flexDirection: 'row', gap: gap * 2, alignItems: 'flex-end', justifyContent: 'center' }}>
      {/* Draw */}
      <Pressable onPress={onDraw}>
        <View style={styles.pileWrap}>
          <Text style={styles.label}>Draw</Text>

          <View style={{ position: 'relative' }}>
            <CardView card={null} width={cardW} height={cardH} />
            {/* Active ring (outer edge) */}
            <View
              pointerEvents="none"
              style={[
                styles.activeRing,
                ringStyle,
                activeSource === 'draw' && styles.activeVisible,
              ]}
            />
            {/* Full-size preview appears ONLY when pulling from draw */}
            {held && activeSource === 'draw' && (
              <View style={styles.fullOverlay}>
                <CardView card={held} width={cardW} height={cardH} />
              </View>
            )}
          </View>
        </View>
      </Pressable>

      {/* Discard */}
      <Pressable onPress={onTakeDiscard} disabled={!topDiscard}>
        <View style={styles.pileWrap}>
          <Text style={styles.label}>Discard</Text>
          <View style={{ position: 'relative' }}>
            <CardView card={topDiscard ?? null} width={cardW} height={cardH} />
            <View
              pointerEvents="none"
              style={[
                styles.activeRing,
                ringStyle,
                activeSource === 'discard' && styles.activeVisible,
              ]}
            />
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pileWrap: { alignItems: 'center', justifyContent: 'flex-end' },
  label: { color: '#9BA3C7', marginBottom: 6, textAlign: 'center' },

  activeRing: {
    position: 'absolute',
    borderWidth: 0,
    borderColor: '#4DA3FF',
    zIndex: 3,
    borderRadius: 12,
  },
  activeVisible: { borderWidth: 2 },

  fullOverlay: { position: 'absolute', top: 0, left: 0, zIndex: 2 },
});
