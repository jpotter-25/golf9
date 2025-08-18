// client/src/components/Piles.tsx
// Purpose: Render the draw pile and discard pile with counts. Allows the user
// to draw from the deck or take the top discard card.

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Card from './Card';
import type { Card as GameCard } from '../game/types';

export type PilesProps = {
  topDiscard: GameCard | null;
  drawPileCount: number;
  // Callbacks for drawing a card or taking the discard card.
  onDraw: () => void;
  onTake: () => void;
  // Optionally disable taking from the discard pile (forced draw).
  disableTake?: boolean;
};

const Piles: React.FC<PilesProps> = ({
  topDiscard,
  drawPileCount,
  onDraw,
  onTake,
  disableTake = false,
}) => {
  return (
    <View style={styles.container}>
      <Pressable onPress={onDraw} style={styles.pile}>
        <Card card={null} />
        <Text style={styles.label}>Deck</Text>
        <Text style={styles.count}>{drawPileCount}</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          if (!disableTake) onTake();
        }}
        style={[styles.pile, disableTake && styles.disabled]}
      >
        <Card card={topDiscard} />
        <Text style={styles.label}>Discard</Text>
        <Text style={styles.count}>{topDiscard ? '' : 'Empty'}</Text>
      </Pressable>
    </View>
  );
};

export default Piles;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 16,
  },
  pile: {
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    color: '#E8ECF1',
    marginTop: 4,
  },
  count: {
    color: '#E8ECF1',
    fontSize: 12,
  },
});
