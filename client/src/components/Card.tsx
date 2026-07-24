// client/src/components/Card.tsx
// Purpose: Render a single card with dynamic sizing. Rank and suit now render
// as separate <Text> nodes to avoid clipping at small sizes (4-player layout).
// Also supports optional width/height/margin inputs from metrics.

import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, Pressable, StyleSheet } from 'react-native';
import type { Card as GameCard } from '../game/types';
import { getCardBackVisual } from '../theme/cosmetics';

export type CardProps = {
  card: GameCard | null;
  onPress?: () => void;
  width?: number;
  height?: number;
  margin?: number;
  selected?: boolean;
  disabled?: boolean;
  cardBackId?: string;
  animateReveal?: boolean;
};

const Card: React.FC<CardProps> = ({ card, onPress, width, height, margin, selected = false, disabled = false, cardBackId, animateReveal = false }) => {
  const cleared = !card;
  const faceUp = card?.faceUp ?? false;
  const zeroed = card?.zeroed ?? false;
  const cardBack = getCardBackVisual(cardBackId);
  const revealAnim = useRef(new Animated.Value(1)).current;
  const lastRevealKey = useRef<string | null>(null);

  // Fallback default size, overridden by props for scaled boards
  const W = typeof width === 'number' ? width : 60;
  const H = typeof height === 'number' ? height : 90;

  // Dynamic typography that scales with the card height
  const rankSize = Math.max(10, Math.round(H * 0.32));
  const suitSize = Math.max(10, Math.round(H * 0.28));
  const lineSp = Math.round(rankSize * 1.1);
  const revealKey = card && faceUp ? `${card.id}:${card.rank}:${card.suit}` : null;

  useEffect(() => {
    if (!animateReveal || !revealKey || lastRevealKey.current === revealKey) {
      if (revealKey) lastRevealKey.current = revealKey;
      return;
    }
    lastRevealKey.current = revealKey;
    revealAnim.setValue(0);
    Animated.spring(revealAnim, {
      toValue: 1,
      speed: 20,
      bounciness: 7,
      useNativeDriver: true,
    }).start();
  }, [animateReveal, revealAnim, revealKey]);

  const animatedStyle = animateReveal && faceUp
    ? {
        opacity: revealAnim.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }),
        transform: [
          { scaleX: revealAnim.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) },
          { scale: revealAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
        ],
      }
    : null;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress || cleared}
      style={[
        styles.card,
        cleared && styles.cleared,
        zeroed && styles.zeroed,
        !cleared && !faceUp && [
          styles.faceDown,
          { backgroundColor: cardBack.backgroundColor, borderColor: cardBack.borderColor },
        ],
        selected && styles.selected,
        disabled && styles.disabled,
        { width: W, height: H },
        typeof margin === 'number' ? { margin } : null,
      ]}
    >
      <Animated.View style={[styles.content, animatedStyle]}>
      {cleared ? (
        <View style={styles.clearedMark} />
      ) : faceUp && card ? (
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
                color: card.suit === '♥' || card.suit === '♦' ? '#FF6B6B' : '#F7FAFC',
              },
            ]}
          >
            {card.suit}
          </Text>
        </View>
      ) : (
        <Text
          allowFontScaling={false}
          style={[
            styles.rank,
            styles.faceDownText,
            { color: cardBack.textColor, fontSize: Math.max(10, Math.round(rankSize * 0.72)) },
          ]}
        >
          {cardBack.mark}
        </Text>
      )}
      </Animated.View>
    </Pressable>
  );
};

export default Card;

const styles = StyleSheet.create({
  card: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F7FAFC',
    backgroundColor: '#1D2547',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 4,
  },
  faceDown: {
    backgroundColor: '#435C7D',
  },
  faceDownText: {
    letterSpacing: 0,
  },
  cleared: {
    borderColor: '#435C7D',
    backgroundColor: 'transparent',
    opacity: 0.85,
  },
  clearedMark: {
    width: '42%',
    height: 3,
    borderRadius: 3,
    backgroundColor: '#435C7D',
  },
  zeroed: {
    backgroundColor: '#084D34',
  },
  selected: {
    borderColor: '#67B7FF',
    borderWidth: 3,
    shadowColor: '#67B7FF',
    shadowOpacity: 0.65,
    shadowRadius: 8,
    elevation: 8,
  },
  disabled: {
    opacity: 0.55,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rank: {
    color: '#F7FAFC',
    textAlign: 'center',
    fontWeight: '700',
  },
  suit: {
    textAlign: 'center',
  },
});
