import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';
import { Crown, Flag, Gem, Shield, Star, Target, Trophy, Zap, type LucideIcon } from 'lucide-react-native';
import type { ClubBranding } from '../services/api';

const EMBLEM_ICONS: Record<string, LucideIcon> = {
  shield: Shield,
  flag: Flag,
  trophy: Trophy,
  crown: Crown,
  star: Star,
  target: Target,
  bolt: Zap,
  gem: Gem,
};

const FALLBACK_BRANDING: ClubBranding = {
  colorPair: 'emerald',
  badgeShape: 'shield',
  bannerStyle: 'classic',
  badgeIcon: 'shield',
  primaryColor: '#52E5A7',
  backgroundColor: '#123B32',
  accentColor: '#2DD4BF',
};

export function ClubEmblem({
  branding,
  tag,
  size = 44,
  showTag = false,
  style,
}: {
  branding?: Partial<ClubBranding> | null;
  tag?: string | null;
  size?: number;
  showTag?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const resolved = { ...FALLBACK_BRANDING, ...branding };
  const Icon = EMBLEM_ICONS[resolved.badgeIcon] || Shield;
  const safeTag = String(tag || '').replace(/[^A-Z]/g, '').slice(0, 4);
  const strokeWidth = Math.max(2, size * 0.055);
  const iconSize = Math.max(14, size * 0.42);

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 64 64">
        {resolved.badgeShape === 'circle' ? (
          <Circle cx="32" cy="32" r="28" fill={resolved.backgroundColor} stroke={resolved.primaryColor} strokeWidth={strokeWidth} />
        ) : resolved.badgeShape === 'diamond' ? (
          <Polygon points="32,3 61,32 32,61 3,32" fill={resolved.backgroundColor} stroke={resolved.primaryColor} strokeWidth={strokeWidth} strokeLinejoin="round" />
        ) : resolved.badgeShape === 'crest' ? (
          <Path d="M9 9 H55 V35 C55 49 43 58 32 62 C21 58 9 49 9 35 Z" fill={resolved.backgroundColor} stroke={resolved.primaryColor} strokeWidth={strokeWidth} strokeLinejoin="round" />
        ) : (
          <Path d="M32 3 L57 13 V31 C57 46 47 57 32 62 C17 57 7 46 7 31 V13 Z" fill={resolved.backgroundColor} stroke={resolved.primaryColor} strokeWidth={strokeWidth} strokeLinejoin="round" />
        )}
        <Path d="M15 17 C26 10 39 10 50 17" fill="none" stroke={resolved.accentColor} strokeWidth="4" strokeLinecap="round" opacity="0.9" />
        <Circle cx="50" cy="48" r="5" fill={resolved.accentColor} opacity="0.92" />
      </Svg>
      <View pointerEvents="none" style={styles.iconLayer}>
        <Icon size={iconSize} color={resolved.primaryColor} strokeWidth={2.8} />
      </View>
      {showTag && safeTag ? (
        <View pointerEvents="none" style={[styles.tagPill, { borderColor: resolved.primaryColor, backgroundColor: resolved.backgroundColor }]}>
          <Text style={[styles.tagText, { color: resolved.primaryColor }]} numberOfLines={1}>{safeTag}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  iconLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagPill: {
    position: 'absolute',
    left: '12%',
    right: '12%',
    bottom: -3,
    minHeight: 13,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  tagText: {
    fontSize: 7,
    lineHeight: 9,
    fontWeight: '900',
  },
});
