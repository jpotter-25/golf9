// client/src/components/Piles.tsx
// Purpose: Render the draw and discard piles.  Accepts optional metrics to
// scale card sizes.  Also supports both 'drawPileCount' and 'drawCount' as
// aliases, and both 'onTake' and 'onTakeDiscard' callbacks for compatibility
// with GameScreen.

import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet, Pressable } from 'react-native';
import Card from './Card';
import type { Card as GameCard } from '../game/types';
import type { Metrics } from '../utils/scaling';

const DRAW_PILE_BACK = {
  id: 'draw-pile-back',
  suit: '♠',
  rank: 'A',
  faceUp: false,
} as GameCard;

export type PilesProps = {
  topDiscard: GameCard | null;
  drawPileCount?: number;
  drawCount?: number; // alias used in GameScreen
  onDraw: () => void;
  onTake?: () => void;
  onTakeDiscard?: () => void; // alias used in GameScreen
  held?: GameCard | null;
  /** Optional metrics to size the pile cards. */
  metrics?: Metrics;
  activeSource?: 'draw' | 'discard' | null;
  disableDraw?: boolean;
  disableTake?: boolean;
  discardFlashKey?: string | null;
  discardFlashCount?: number;
  cardBackId?: string;
  compact?: boolean;
  [key: string]: unknown;
};

const Piles: React.FC<PilesProps> = ({
  topDiscard,
  drawPileCount,
  drawCount,
  onDraw,
  onTake,
  onTakeDiscard,
  held = null,
  metrics,
  activeSource = null,
  disableDraw = false,
  disableTake = false,
  discardFlashKey = null,
  discardFlashCount = 0,
  cardBackId,
  compact = false,
}) => {
  const discardFlash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!discardFlashKey) return;
    discardFlash.setValue(0);
    Animated.sequence([
      Animated.timing(discardFlash, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(650),
      Animated.timing(discardFlash, { toValue: 0, duration: 240, useNativeDriver: true }),
    ]).start();
  }, [discardFlash, discardFlashKey]);

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
  const drawCard = activeSource === 'draw' ? (held ?? DRAW_PILE_BACK) : pileCount > 0 ? DRAW_PILE_BACK : null;
  const discardCard = activeSource === 'discard' && held ? held : topDiscard;
  const discardIsActive = activeSource === 'discard' || !!discardFlashKey;
  const flashScale = discardFlash.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] });

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <Pressable onPress={onDraw} disabled={disableDraw} style={[styles.pile, disableDraw && activeSource !== 'draw' && styles.disabled]}>
        <Text style={styles.label}>Deck</Text>
        <Card
          card={drawCard}
          width={cardW}
          height={cardH}
          margin={margin}
          selected={activeSource === 'draw'}
          disabled={disableDraw && activeSource !== 'draw'}
          cardBackId={cardBackId}
          animateReveal={activeSource === 'draw'}
        />
        <Text style={styles.count}>{pileCount}</Text>
      </Pressable>
      <Pressable
        onPress={handleTake}
        style={[styles.pile, disableTake && activeSource !== 'discard' && styles.disabled]}
      >
        <Text style={styles.label}>Discard</Text>
        <View style={styles.discardStage}>
          <Card
            card={discardCard}
            width={cardW}
            height={cardH}
            margin={margin}
            selected={discardIsActive}
            disabled={disableTake && activeSource !== 'discard'}
            animateReveal={activeSource === 'discard'}
          />
          {discardFlashKey && discardFlashCount > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.clearBadge,
                {
                  opacity: discardFlash,
                  transform: [{ scale: flashScale }],
                },
              ]}
            >
              <Text style={styles.clearBadgeText}>+{discardFlashCount}</Text>
            </Animated.View>
          ) : null}
        </View>
        <Text style={styles.count}>{discardCard ? '' : 'Empty'}</Text>
      </Pressable>
    </View>
  );
};

export default Piles;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 7,
  },
  containerCompact: {
    alignSelf: 'center',
    justifyContent: 'center',
    gap: 10,
    marginVertical: 2,
  },
  pile: {
    alignItems: 'center',
  },
  discardStage: {
    position: 'relative',
  },
  clearBadge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 26,
    height: 24,
    paddingHorizontal: 5,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4DE0A0',
    backgroundColor: '#102E2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBadgeText: {
    color: '#4DE0A0',
    fontWeight: '900',
    fontSize: 12,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    color: '#E8ECF1',
    marginBottom: 3,
    fontSize: 13,
    fontWeight: '800',
  },
  count: {
    color: '#E8ECF1',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
    minHeight: 16,
  },
});
