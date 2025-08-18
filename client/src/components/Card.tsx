// client/src/components/Card.tsx
// Purpose: Render an individual card. Shows rank/suit if face up,
// otherwise displays a back. Zeroed cards are indicated by a different
// background color.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { Card as GameCard } from '../game/types';

export type CardProps = {
  card: GameCard | null;
  onPress?: () => void;
};

const Card: React.FC<CardProps> = ({ card, onPress }) => {
  // Determine display text and styles based on card state.
  const faceUp = card?.faceUp ?? false;
  const zeroed = card?.zeroed ?? false;
  let content = '?';
  if (faceUp && card) {
    content = `${card.rank}\n${card.suit}`;
  }

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        zeroed && styles.zeroed,
        !faceUp && styles.faceDown,
      ]}
    >
      <Text style={styles.text}>{content}</Text>
    </Pressable>
  );
};

export default Card;

const styles = StyleSheet.create({
  card: {
    width: 60,
    height: 90,
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
  text: {
    color: '#E8ECF1',
    textAlign: 'center',
    fontSize: 16,
  },
});
