import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Polygon, Text as SvgText } from 'react-native-svg';
import {
  Club,
  Compass,
  Crown,
  Flag,
  Flame,
  Gem,
  Mountain,
  Rocket,
  Shield,
  Spade,
  Star,
  Swords,
  Target,
  Trees,
  Trophy,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
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
  spade: Spade,
  club: Club,
  flame: Flame,
  swords: Swords,
  mountain: Mountain,
  trees: Trees,
  compass: Compass,
  rocket: Rocket,
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

function EmblemBase({ shape, fill, stroke, strokeWidth }: { shape: string; fill: string; stroke: string; strokeWidth: number }) {
  if (shape === 'circle') return <Circle cx="32" cy="32" r="28" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
  if (shape === 'diamond') return <Polygon points="32,3 61,32 32,61 3,32" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />;
  if (shape === 'crest') return <Path d="M9 9 H55 V35 C55 49 43 58 32 62 C21 58 9 49 9 35 Z" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />;
  if (shape === 'hexagon') return <Polygon points="32,3 56,16 56,48 32,61 8,48 8,16" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />;
  if (shape === 'octagon') return <Polygon points="20,4 44,4 60,20 60,44 44,60 20,60 4,44 4,20" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />;
  if (shape === 'pennant') return <Path d="M10 5 H54 V58 L32 48 L10 58 Z" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />;
  return <Path d="M32 3 L57 13 V31 C57 46 47 57 32 62 C17 57 7 46 7 31 V13 Z" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />;
}

function EmblemTrim({ shape, color }: { shape: string; color: string }) {
  const common = { fill: 'none', stroke: color, strokeWidth: 1.7, opacity: 0.92 } as const;
  if (shape === 'circle') return <Circle cx="32" cy="32" r="23.5" {...common} />;
  if (shape === 'diamond') return <Polygon points="32,9 55,32 32,55 9,32" {...common} strokeLinejoin="round" />;
  if (shape === 'crest') return <Path d="M14 14 H50 V34 C50 44 41 52 32 56 C23 52 14 44 14 34 Z" {...common} strokeLinejoin="round" />;
  if (shape === 'hexagon') return <Polygon points="32,9 51,19 51,45 32,55 13,45 13,19" {...common} strokeLinejoin="round" />;
  if (shape === 'octagon') return <Polygon points="22,9 42,9 55,22 55,42 42,55 22,55 9,42 9,22" {...common} strokeLinejoin="round" />;
  if (shape === 'pennant') return <Path d="M15 11 H49 V50 L32 42 L15 50 Z" {...common} strokeLinejoin="round" />;
  return <Path d="M32 9 L51 17 V31 C51 41 44 50 32 55 C20 50 13 41 13 31 V17 Z" {...common} strokeLinejoin="round" />;
}

function TagBanner({ variant, tag, fill, stroke, textColor }: { variant: string; tag: string; fill: string; stroke: string; textColor: string }) {
  const banner = variant === 'night' ? (
    <Path d="M8 44 H56 L51 50 L56 58 H39 L32 54 L25 58 H8 L13 50 Z" fill={fill} stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" />
  ) : variant === 'fairway' ? (
    <Path d="M8 46 Q32 39 56 46 L52 57 Q32 51 12 57 Z" fill={fill} stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" />
  ) : variant === 'champion' ? (
    <>
      <Path d="M4 46 L14 42 H50 L60 46 L55 57 L47 53 H17 L9 57 Z" fill={fill} stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" />
      <Path d="M14 42 H50 V55 H14 Z" fill={fill} stroke={stroke} strokeWidth="1.4" />
    </>
  ) : (
    <Path d="M8 45 L12 42 H52 L56 45 L53 56 H11 Z" fill={fill} stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" />
  );

  return (
    <>
      {banner}
      <SvgText x="32" y="52.5" textAnchor="middle" fill={textColor} fontSize="7.2" fontWeight="900" letterSpacing="0">{tag}</SvgText>
    </>
  );
}

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
  const strokeWidth = 3.6;
  const iconSize = Math.max(10, size * 0.42);

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <EmblemBase shape={resolved.badgeShape} fill={resolved.backgroundColor} stroke={resolved.primaryColor} strokeWidth={strokeWidth} />
        <EmblemTrim shape={resolved.badgeShape} color={resolved.accentColor} />
        {showTag && safeTag ? <TagBanner variant={resolved.bannerStyle} tag={safeTag} fill={resolved.accentColor} stroke={resolved.primaryColor} textColor={resolved.backgroundColor} /> : null}
      </Svg>
      <View pointerEvents="none" style={[styles.iconLayer, showTag && { transform: [{ translateY: -size * 0.08 }] }]}>
        <Icon size={iconSize} color={resolved.primaryColor} strokeWidth={2.8} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  iconLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
