// client/src/components/CoinClaimBurst.tsx
// Purpose: Lightweight reward feedback for coin claims without interrupting play.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';
import { Coins } from 'lucide-react-native';
import { ui } from '../ui';

export type CoinClaimBurstState = { id: number; reward: number } | null;

export function CoinClaimBurst({
  burst,
  top = 112,
  right = 18,
}: {
  burst: CoinClaimBurstState;
  top?: number;
  right?: number;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const [visibleBurst, setVisibleBurst] = useState<CoinClaimBurstState>(null);

  useEffect(() => {
    if (!burst) return;
    setVisibleBurst(burst);
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 950,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setVisibleBurst(current => current?.id === burst.id ? null : current);
    });
  }, [burst, progress]);

  if (!visibleBurst) return null;

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-84, 0] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -88] });
  const opacity = progress.interpolate({ inputRange: [0, 0.78, 1], outputRange: [1, 1, 0] });
  const scale = progress.interpolate({ inputRange: [0, 0.24, 1], outputRange: [0.92, 1.08, 0.96] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.burst,
        {
          top,
          right,
          opacity,
          transform: [{ translateX }, { translateY }, { scale }],
        },
      ]}
    >
      <Coins size={18} color={ui.palette.gold} strokeWidth={2.9} />
      <Text style={styles.text}>+{visibleBurst.reward}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  burst: {
    position: 'absolute',
    zIndex: 50,
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: ui.border.gold,
    backgroundColor: '#241A0A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  text: {
    color: ui.palette.gold,
    fontSize: 15,
    fontWeight: '900',
  },
});
