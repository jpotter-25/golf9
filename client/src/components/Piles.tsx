// client/src/components/Piles.tsx
// Purpose: Render the draw and discard piles.  Accepts multiple aliases for
// properties used in GameScreen: 'drawCount' is an alias for 'drawPileCount',
// and 'onTakeDiscard' is an alias for 'onTake'.  Extra props are ignored.

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Card from './Card';
import type { Card as GameCard } from '../game/types';

export type PilesProps = {
  topDiscard: GameCard | null;
  drawPileCount?: number; // modern prop name
  drawCount?: number;     // alias used in GameScreen
  onDraw: () => void;
  onTake?: () => void;        // modern callback name
  onTakeDiscard?: () => void; // alias used in GameScreen
  activeSource?: 'draw' | 'discard' | null;
  disableTake?: boolean;
  [key: string]: unknown; // allow any other props without error
};

const Piles: React.FC<PilesProps> = (props) => {
  const {
    topDiscard,
    drawPileCount,
    drawCount,
    onDraw,
    onTake,
    onTakeDiscard,
    disableTake = false,
  } = props;

  const handleTake = () => {
    if (disableTake) {
      return;
    }
    if (onTake) {
      onTake();
    } else if (onTakeDiscard) {
      onTakeDiscard();
    }
  };

  const pileCount = drawPileCount ?? drawCount ?? 0;

  return (
    <View style={styles.container}>
      <Pressable onPress={onDraw} style={styles.pile}>
        <Card card={null} />
        <Text style={styles.label}>Deck</Text>
        <Text style={styles.count}>{pileCount}</Text>
      </Pressable>
      <Pressable onPress={handleTake} style={[styles.pile, disableTake && styles.disabled]}>
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
