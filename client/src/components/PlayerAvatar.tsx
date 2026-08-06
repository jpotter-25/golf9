import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { getAvatarFrameVisual, getAvatarIconVisual, type EquippedCosmetics } from '../theme/cosmetics';
import { AvatarFrameArtwork, AvatarIconArtwork } from './CosmeticArt';

type Props = {
  cosmetics?: EquippedCosmetics | null;
  fallbackInitial?: string;
  size?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
};

export function PlayerAvatar({ cosmetics, fallbackInitial = '?', size = 54, onPress, style, disabled }: Props) {
  const frameId = cosmetics?.avatarFrame;
  const iconId = cosmetics?.avatarIcon;
  const frame = getAvatarFrameVisual(frameId);
  const icon = getAvatarIconVisual(iconId);
  const motion = useRef(new Animated.Value(0)).current;
  const inset = Math.max(4, Math.round(size * 0.075));
  const innerSize = size - (inset * 2);

  useEffect(() => {
    motion.stopAnimation();
    motion.setValue(0);
    if (frame.effect === 'none') return undefined;
    const animation = Animated.loop(Animated.timing(motion, {
      toValue: 1,
      duration: frame.effect === 'orbit' ? 9000 : frame.effect === 'pulse' ? 2800 : 4200,
      useNativeDriver: true,
    }));
    animation.start();
    return () => animation.stop();
  }, [frame.effect, motion]);

  const frameMotion = frame.effect === 'orbit'
    ? { transform: [{ rotate: motion.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }
    : frame.effect === 'pulse'
      ? {
          opacity: motion.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.72, 1, 0.72] }),
          transform: [{ scale: motion.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.98, 1.04, 0.98] }) }],
        }
      : frame.effect === 'shimmer'
        ? { opacity: motion.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.58, 1, 0.58] }) }
        : null;

  const content = (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: frame.borderColor,
          backgroundColor: frame.backgroundColor,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.iconWell,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
            backgroundColor: icon.backgroundColor || frame.backgroundColor,
          },
        ]}
      >
        {iconId ? (
          <AvatarIconArtwork iconId={iconId} />
        ) : (
          <Text style={[styles.fallback, { color: icon.color, fontSize: Math.max(15, innerSize * 0.46) }]}>
            {fallbackInitial.slice(0, 1).toUpperCase()}
          </Text>
        )}
      </View>
      <View pointerEvents="none" style={styles.frameLayer}>
        <AvatarFrameArtwork frameId={frameId} />
      </View>
      {frame.effect !== 'none' ? (
        <Animated.View pointerEvents="none" style={[styles.frameLayer, frameMotion]}>
          <AvatarFrameArtwork frameId={frameId} />
        </Animated.View>
      ) : null}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8} style={({ pressed }) => [pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    borderWidth: 1.5,
    justifyContent: 'center',
    overflow: 'visible',
  },
  iconWell: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  frameLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  fallback: {
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.82,
  },
});
