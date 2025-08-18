// client/src/components/Card.tsx
// Purpose: Render a single card with dynamic sizing. Rank and suit now render
// as separate <Text> nodes to avoid clipping at small sizes (4-player layout).
// Also supports optional width/height/margin inputs from metrics.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { Card as GameCard } from '../game/types';

export type CardProps = {
  card: GameCard | null;
  onPress?: () => void;
  width?: number;
  height?: number;
  margin?: number;
};

const Card: React.FC<CardProps> = ({ card, onPress, width, height, margin }) => {
  const faceUp = card?.faceUp ?? false;
  const zeroed = card?.zeroed ?? false;

  // Fallback default size, overridden by props for scaled boards
  const W = typeof width === 'number' ? width : 60;
  const H = typeof height === 'number' ? height : 90;

  // Dynamic typography that scales with the card height
  const rankSize = Math.max(10, Math.round(H * 0.32));
  const suitSize = Math.max(10, Math.round(H * 0.28));
  const lineSp = Math.round(rankSize * 1.1);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        zeroed && styles.zeroed,
        !faceUp && styles.faceDown,
        { width: W, height: H },
        typeof margin === 'number' ? { margin } : null,
      ]}
    >
      {faceUp && card ? (
        <View style={styles.faceContainer}>
          <Text
            allowFontScaling={false}
            style={[
              styles.rank,
              { fontSize: rankSize, lineHeight: lineSp },
            ]}
          >
            {card.rank}
          </Text>
          <Text
            allowFontScaling={false}
            style={[
              styles.suit,
              {
                fontSize: suitSize,
                // Extra bottom padding to ensure no clipping on tiny cards
                paddingBottom: Math.ceil(H * 0.04),
                // Color red for hearts/diamonds
                color: card.suit === '♥' || card.suit === '♦' ? '#FF6B6B' : '#E8ECF1',
              },
            ]}
          >
            {card.suit}
          </Text>
        </View>
      ) : (
        <Text allowFontScaling={false} style={[styles.rank, { fontSize: rankSize }]}>?</Text>
      )}
    </Pressable>
  );
};

export default Card;

const styles = StyleSheet.create({
  card: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E8ECF1',
    backgroundColor: '#1D2547',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 4,
  },
  faceDown: {
    backgroundColor: '#2A2F57',
  },
  zeroed: {
    backgroundColor: '#084D34',
  },
  faceContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rank: {
    color: '#E8ECF1',
    textAlign: 'center',
    fontWeight: '700',
  },
  suit: {
    textAlign: 'center',
  },
});
