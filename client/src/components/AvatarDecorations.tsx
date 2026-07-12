import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, Polygon, Stop } from 'react-native-svg';
import { Crown, Gem, Gift, Rocket, Watch, type LucideIcon } from 'lucide-react-native';
import { PlayerAvatar } from './PlayerAvatar';
import { getAvatarAccessoryVisual, type EquippedCosmetics } from '../theme/cosmetics';

export type RankEmblemVisual = {
  shortLabel: string;
  label: string;
  borderColor: string;
  backgroundColor: string;
  textColor: string;
  tier: 'iron' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master' | 'grandmaster' | 'legend';
  primary: string;
  secondary: string;
  shine: string;
  glow: string;
  pips: number;
};

type LeagueLike = { league?: string; division?: string | null; name?: string } | string | null | undefined;

const ACCESSORY_ICONS: Record<string, LucideIcon> = {
  watch: Watch,
  gem: Gem,
  rocket: Rocket,
  crown: Crown,
};

function divisionPips(rawName: string, division?: string | null) {
  const value = (division || rawName.match(/\b(III|II|I|3|2|1)\b/i)?.[1] || '').toUpperCase();
  if (value === 'III' || value === '3') return 3;
  if (value === 'II' || value === '2') return 2;
  return 1;
}

export function rankEmblemForLeague(league: LeagueLike): RankEmblemVisual {
  const rawName = typeof league === 'string' ? league : league?.name || league?.league || 'Iron III';
  const rawLeague = typeof league === 'string' ? league : league?.league || rawName;
  const division = typeof league === 'string' ? null : league?.division;
  const key = rawLeague.toLowerCase();
  const pips = divisionPips(rawName, division);
  if (key.includes('legend')) {
    return { shortLabel: 'LG', label: rawName, borderColor: '#F8D36A', backgroundColor: '#21162C', textColor: '#FFF0C2', tier: 'legend', primary: '#8B5CFF', secondary: '#FFCC66', shine: '#FFF0C2', glow: '#D9B8FF', pips };
  }
  if (key.includes('grandmaster')) {
    return { shortLabel: 'GM', label: rawName, borderColor: '#FFC9F3', backgroundColor: '#241434', textColor: '#FFE8FA', tier: 'grandmaster', primary: '#FF5ED7', secondary: '#5D6BFF', shine: '#FFF1FC', glow: '#FFC9F3', pips };
  }
  if (key.includes('master')) {
    return { shortLabel: 'M', label: rawName, borderColor: '#9BE7FF', backgroundColor: '#102838', textColor: '#D8F3FF', tier: 'master', primary: '#3BE7FF', secondary: '#A56BFF', shine: '#EAF8FF', glow: '#9BE7FF', pips };
  }
  if (key.includes('diamond')) {
    return { shortLabel: 'D', label: rawName, borderColor: '#BDEBFF', backgroundColor: '#102448', textColor: '#EAF8FF', tier: 'diamond', primary: '#6FE7FF', secondary: '#4DA3FF', shine: '#FFFFFF', glow: '#BDEBFF', pips };
  }
  if (key.includes('platinum')) {
    return { shortLabel: 'P', label: rawName, borderColor: '#BFD9FF', backgroundColor: '#182244', textColor: '#E8ECF1', tier: 'platinum', primary: '#DCEAFF', secondary: '#78B8FF', shine: '#FFFFFF', glow: '#BFD9FF', pips };
  }
  if (key.includes('gold')) {
    return { shortLabel: division ? `G${division}` : 'G', label: rawName, borderColor: '#FFCC66', backgroundColor: '#2B2515', textColor: '#FFE6A3', tier: 'gold', primary: '#FFCC66', secondary: '#B56A1D', shine: '#FFF0C2', glow: '#FFCC66', pips };
  }
  if (key.includes('silver')) {
    return { shortLabel: division ? `S${division}` : 'S', label: rawName, borderColor: '#BFD9FF', backgroundColor: '#202742', textColor: '#E8ECF1', tier: 'silver', primary: '#DDE8FF', secondary: '#6F84B8', shine: '#FFFFFF', glow: '#BFD9FF', pips };
  }
  if (key.includes('bronze')) {
    return { shortLabel: division ? `B${division}` : 'B', label: rawName, borderColor: '#C58B5A', backgroundColor: '#2B1D17', textColor: '#FFD6B0', tier: 'bronze', primary: '#C58B5A', secondary: '#6D3F26', shine: '#FFD6B0', glow: '#C58B5A', pips };
  }
  return { shortLabel: division ? `I${division}` : 'I', label: rawName || 'Iron III', borderColor: '#AAB3C2', backgroundColor: '#141A24', textColor: '#E3E8F0', tier: 'iron', primary: '#AAB3C2', secondary: '#39465A', shine: '#F2F5FA', glow: '#AAB3C2', pips };
}

export function RankEmblem({
  league,
  size = 28,
  style,
  showPips = true,
}: {
  league?: LeagueLike;
  size?: number;
  style?: StyleProp<ViewStyle>;
  showPips?: boolean;
}) {
  const emblem = rankEmblemForLeague(league);
  const gradientId = `rank-${emblem.tier}-${size}`;
  const shineId = `rank-shine-${emblem.tier}-${size}`;
  const pipStart = 32 - (emblem.pips - 1) * 4;
  const isElite = emblem.tier === 'diamond' || emblem.tier === 'master' || emblem.tier === 'grandmaster' || emblem.tier === 'legend';
  const isLegend = emblem.tier === 'legend';
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Defs>
          <SvgLinearGradient id={gradientId} x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={emblem.shine} />
            <Stop offset="0.42" stopColor={emblem.primary} />
            <Stop offset="1" stopColor={emblem.secondary} />
          </SvgLinearGradient>
          <SvgLinearGradient id={shineId} x1="16" y1="10" x2="42" y2="48" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </SvgLinearGradient>
        </Defs>
        <Circle cx="32" cy="32" r="30.5" fill={emblem.glow} opacity={isElite ? '0.24' : '0.14'} />
        <Circle cx="32" cy="32" r="29" fill={emblem.backgroundColor} opacity="0.94" stroke={emblem.borderColor} strokeWidth="1.2" />
        <Polygon points="32,2 39,10 50,9 53,20 62,27 58,38 61,49 49,53 42,62 32,58 22,62 15,53 3,49 6,38 2,27 11,20 14,9 25,10" fill={emblem.glow} opacity={isElite ? '0.24' : '0.1'} />
        <Path
          d="M32 4 L53 13 L50 35 C48 47 40 56 32 61 C24 56 16 47 14 35 L11 13 Z"
          fill={`url(#${gradientId})`}
          stroke={emblem.borderColor}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <Path
          d="M20 16 L32 10 L44 16 L41 35 C40 43 35 50 32 52 C29 50 24 43 23 35 Z"
          fill={`url(#${shineId})`}
          opacity="0.55"
        />
        {isLegend ? (
          <>
            <Polygon points="32,14 37,26 50,26 39,34 43,48 32,40 21,48 25,34 14,26 27,26" fill="#FFF0C2" opacity="0.96" />
            <Circle cx="32" cy="32" r="8" fill={emblem.primary} stroke={emblem.secondary} strokeWidth="3" />
          </>
        ) : isElite ? (
          <>
            <Polygon points="32,12 47,28 32,51 17,28" fill={emblem.shine} opacity="0.88" />
            <Polygon points="32,12 32,51 17,28" fill={emblem.primary} opacity="0.42" />
            <Path d="M18 23 C12 22 9 18 8 14 C15 15 19 18 22 24 Z" fill={emblem.glow} opacity="0.72" />
            <Path d="M46 24 C49 18 53 15 60 14 C59 18 56 22 50 23 Z" fill={emblem.glow} opacity="0.72" />
          </>
        ) : (
          <>
            <Path d="M19 28 L32 17 L45 28 L32 43 Z" fill={emblem.shine} opacity="0.78" />
            <Path d="M22 39 H42 L32 50 Z" fill={emblem.secondary} opacity="0.7" />
            <Path d="M22 26 H42" stroke={emblem.backgroundColor} strokeWidth="3" strokeLinecap="round" opacity="0.48" />
          </>
        )}
        {showPips ? Array.from({ length: emblem.pips }).map((_, index) => (
          <Circle
            key={`pip-${index}`}
            cx={pipStart + index * 8}
            cy="54"
            r="2.5"
            fill={emblem.shine}
            stroke={emblem.backgroundColor}
            strokeWidth="1"
          />
        )) : null}
      </Svg>
    </View>
  );
}

export function ProgressAvatar({
  cosmetics,
  fallbackInitial = '?',
  league,
  progress = 0,
  size = 46,
  onPress,
  style,
}: {
  cosmetics?: EquippedCosmetics | null;
  fallbackInitial?: string;
  league?: LeagueLike;
  progress?: number;
  size?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const ringWidth = Math.max(2.5, size * 0.075);
  const center = size / 2;
  const radius = center - ringWidth;
  const circumference = 2 * Math.PI * radius;
  const safeProgress = Math.max(0, Math.min(1, Number(progress) || 0));
  const avatarSize = size - Math.max(8, ringWidth * 2.5);
  const rankSize = Math.max(17, Math.round(size * 0.4));
  const content = (
    <>
      <Svg pointerEvents="none" width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(232,236,241,0.16)" strokeWidth={ringWidth} />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#52E5A7"
          strokeWidth={ringWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - safeProgress)}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <PlayerAvatar cosmetics={cosmetics} fallbackInitial={fallbackInitial} size={avatarSize} />
      <View pointerEvents="none" style={[styles.progressRank, { width: rankSize, height: rankSize, left: -2, bottom: -2 }]}>
        <RankEmblem league={league} size={rankSize} />
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={onPress} style={[styles.progressAvatar, { width: size, height: size }, style]}>
        {content}
      </Pressable>
    );
  }
  return <View style={[styles.progressAvatar, { width: size, height: size }, style]}>{content}</View>;
}

type AvatarClusterProps = {
  cosmetics?: EquippedCosmetics | null;
  fallbackInitial?: string;
  size?: number;
  mode?: 'self' | 'opponent';
  league?: LeagueLike;
  showAccessory?: boolean;
  showGift?: boolean;
  giftIcon?: string | null;
  giftAccent?: string | null;
  connectionState?: 'online' | 'offline';
  showClaim?: boolean;
  onPress?: () => void;
  onGiftPress?: () => void;
  disabled?: boolean;
};

export function AvatarCluster({
  cosmetics,
  fallbackInitial = '?',
  size = 54,
  mode = 'opponent',
  league,
  showAccessory = true,
  showGift = false,
  giftIcon = null,
  giftAccent = null,
  connectionState,
  showClaim = false,
  onPress,
  onGiftPress,
  disabled,
}: AvatarClusterProps) {
  const accessory = getAvatarAccessoryVisual(cosmetics?.avatarAccessory);
  const hasAccessory = showAccessory && accessory.icon !== 'none';
  const accessoryIconSize = Math.max(9, Math.round(size * 0.26));
  const AccessoryIcon = ACCESSORY_ICONS[accessory.icon];
  const badgeSize = Math.max(20, Math.round(size * 0.42));
  const giftSize = Math.max(20, Math.round(size * 0.42));
  const hasGiftItem = !!giftIcon;
  const giftStyle = {
    width: giftSize,
    height: giftSize,
    borderRadius: giftSize / 2,
    right: -1,
    top: -1,
    borderColor: hasGiftItem ? giftAccent || '#FFCC66' : 'rgba(232,236,241,0.26)',
    backgroundColor: hasGiftItem ? 'rgba(18,23,55,0.96)' : 'rgba(232,236,241,0.06)',
  };
  const giftContent = hasGiftItem ? (
    <Text style={[styles.giftItem, { fontSize: Math.max(12, giftSize * 0.6), lineHeight: giftSize }]}>{giftIcon}</Text>
  ) : (
    <Gift color="rgba(232,236,241,0.46)" size={Math.max(10, giftSize * 0.52)} strokeWidth={2.4} />
  );
  const connectionBorderColor =
    connectionState === 'offline' ? '#FF6B6B' : connectionState === 'online' ? '#52E5A7' : null;

  return (
    <View style={[styles.cluster, { width: size + 12, height: size + 12 }]}>
      <PlayerAvatar
        cosmetics={cosmetics}
        fallbackInitial={fallbackInitial}
        size={size}
        onPress={onPress}
        style={connectionBorderColor ? { borderColor: connectionBorderColor } : undefined}
        disabled={disabled}
      />
      <View
        pointerEvents="none"
        style={[
          styles.rankBadge,
          {
            width: badgeSize,
            height: badgeSize,
            borderRadius: badgeSize / 2,
            left: -1,
            bottom: mode === 'self' ? -2 : -3,
          },
        ]}
      >
        <RankEmblem league={league} size={badgeSize} />
      </View>
      {hasAccessory ? (
        <View
          pointerEvents="none"
          style={[
            styles.accessoryBadge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              right: -1,
              bottom: -3,
              borderColor: accessory.borderColor,
              backgroundColor: accessory.backgroundColor,
            },
          ]}
        >
          {AccessoryIcon ? <AccessoryIcon color={accessory.color} size={accessoryIconSize} strokeWidth={3} /> : null}
          {accessory.label ? <Text style={[styles.accessoryText, { color: accessory.color }]}>{accessory.label}</Text> : null}
        </View>
      ) : null}
      {showGift || hasGiftItem ? (
        onGiftPress ? (
          <Pressable
            onPress={onGiftPress}
            hitSlop={8}
            style={({ pressed }) => [
              styles.giftButton,
              hasGiftItem && styles.giftButtonFilled,
              giftStyle,
              pressed && styles.pressed,
            ]}
          >
            {giftContent}
          </Pressable>
        ) : (
          <View pointerEvents="none" style={[styles.giftButton, hasGiftItem && styles.giftButtonFilled, giftStyle]}>
            {giftContent}
          </View>
        )
      ) : null}
      {showClaim ? (
        <View style={[styles.claimBadge, { right: mode === 'self' ? -1 : 3, top: 0 }]}>
          <Text style={styles.claimText}>!</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  progressAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  progressRank: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cluster: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  rankBadge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  accessoryBadge: {
    position: 'absolute',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  accessoryText: {
    fontSize: 7,
    lineHeight: 8,
    fontWeight: '900',
    marginTop: -1,
  },
  giftButton: {
    position: 'absolute',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  giftButtonFilled: {
    shadowOpacity: 0.3,
    shadowRadius: 7,
    elevation: 7,
  },
  giftItem: {
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  claimBadge: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#121737',
    backgroundColor: '#FF6B6B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimText: {
    color: '#0B1023',
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 12,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
});
