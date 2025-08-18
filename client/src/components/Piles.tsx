// client/src/components/Piles.tsx
// Purpose: Render the draw and discard piles.  Accepts optional metrics to
// scale card sizes.  Also supports both 'drawPileCount' and 'drawCount' as
// aliases, and both 'onTake' and 'onTakeDiscard' callbacks for compatibility
// with GameScreen.

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Card from './Card';
import type { Card as GameCard } from '../game/types';
import type { Metrics } from '../utils/scaling';

export type PilesProps = {
  topDiscard: GameCard | null;
  drawPileCount?: number;
  drawCount?: number; // alias used in GameScreen
  onDraw: () => void;
  onTake?: () => void;
  onTakeDiscard?: () => void; // alias used in GameScreen
  /** Optional metrics to size the pile cards. */
  metrics?: Metrics;
  disableTake?: boolean;
  [key: string]: unknown;
};

const Piles: React.FC<PilesProps> = ({
  topDiscard,
  drawPileCount,
  drawCount,
  onDraw,
  onTake,
  onTakeDiscard,
  metrics,
  disableTake = false,
}) => {
  // Choose the appropriate callback for taking the discard pile.
  const handleTake = () => {
    if (disableTake) return;
    if (onTake) onTake();
    else if (onTakeDiscard) onTakeDiscard();
  };

  // Determine pile count, preferring drawPileCount then drawCount.
  const pileCount = drawPileCount ?? drawCount ?? 0;

  // Determine card dimensions based on metrics.
  const cardW = metrics ? metrics.cardW : 60;
  const cardH = metrics ? metrics.cardH : 90;
  const margin = metrics ? metrics.gap / 2 : 4;

  return (
    <View style={styles.container}>
      <Pressable onPress={onDraw} style={styles.pile}>
        <Card card={null} width={cardW} height={cardH} margin={margin} />
        <Text style={styles.label}>Deck</Text>
        <Text style={styles.count}>{pileCount}</Text>
      </Pressable>
      <Pressable
        onPress={handleTake}
        style={[styles.pile, disableTake && styles.disabled]}
      >
        <Card
          card={topDiscard}
          width={cardW}
          height={cardH}
          margin={margin}
        />
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
