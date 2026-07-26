import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, Polygon, Stop, Text as SvgText } from 'react-native-svg';
import { Bot, Crown, Gem, Gift, Rocket, Watch, type LucideIcon } from 'lucide-react-native';
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

function divisionLabel(pips: number) {
  if (pips === 3) return 'III';
  if (pips === 2) return 'II';
  return 'I';
}

export function rankEmblemForLeague(league: LeagueLike): RankEmblemVisual {
  const rawName = typeof league === 'string' ? league : league?.name || league?.league || 'Iron III';
  const rawLeague = typeof league === 'string' ? league : league?.league || rawName;
  const division = typeof league === 'string' ? null : league?.division;
  const key = rawLeague.toLowerCase();
  const pips = divisionPips(rawName, division);
  if (key.includes('legend')) {
    return { shortLabel: 'LG', label: rawName, borderColor: '#F8D36A', backgroundColor: '#21162C', textColor: '#FFF0C2', tier: 'legend', primary: '#8B5CFF', secondary: '#F4C95D', shine: '#FFF0C2', glow: '#D9B8FF', pips };
  }
  if (key.includes('grandmaster')) {
    return { shortLabel: 'GM', label: rawName, borderColor: '#FFC9F3', backgroundColor: '#241434', textColor: '#FFE8FA', tier: 'grandmaster', primary: '#FF5ED7', secondary: '#5D6BFF', shine: '#FFF1FC', glow: '#FFC9F3', pips };
  }
  if (key.includes('master')) {
    return { shortLabel: 'M', label: rawName, borderColor: '#9BE7FF', backgroundColor: '#214D57', textColor: '#D8F3FF', tier: 'master', primary: '#3BE7FF', secondary: '#A56BFF', shine: '#EAF8FF', glow: '#9BE7FF', pips };
  }
  if (key.includes('diamond')) {
    return { shortLabel: 'D', label: rawName, borderColor: '#BDEBFF', backgroundColor: '#294A68', textColor: '#EAF8FF', tier: 'diamond', primary: '#6FE7FF', secondary: '#67B7FF', shine: '#FFFFFF', glow: '#BDEBFF', pips };
  }
  if (key.includes('platinum')) {
    return { shortLabel: 'P', label: rawName, borderColor: '#BFD9FF', backgroundColor: '#182244', textColor: '#F7FAFC', tier: 'platinum', primary: '#DCEAFF', secondary: '#78B8FF', shine: '#FFFFFF', glow: '#BFD9FF', pips };
  }
  if (key.includes('gold')) {
    return { shortLabel: division ? `G${division}` : 'G', label: rawName, borderColor: '#F4C95D', backgroundColor: '#2B2515', textColor: '#FFE6A3', tier: 'gold', primary: '#F4C95D', secondary: '#B56A1D', shine: '#FFF0C2', glow: '#F4C95D', pips };
  }
  if (key.includes('silver')) {
    return { shortLabel: division ? `S${division}` : 'S', label: rawName, borderColor: '#BFD9FF', backgroundColor: '#202742', textColor: '#F7FAFC', tier: 'silver', primary: '#DDE8FF', secondary: '#6F84B8', shine: '#FFFFFF', glow: '#BFD9FF', pips };
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
  if (!league) return null;
  const emblem = rankEmblemForLeague(league);
  const gradientId = `rank-${emblem.tier}-${size}`;
  const shineId = `rank-shine-${emblem.tier}-${size}`;
  const isElite = emblem.tier === 'diamond' || emblem.tier === 'master' || emblem.tier === 'grandmaster' || emblem.tier === 'legend';
  const isHighElite = emblem.tier === 'master' || emblem.tier === 'grandmaster' || emblem.tier === 'legend';
  const hasDivision = ['iron', 'bronze', 'silver', 'gold', 'platinum', 'diamond'].includes(emblem.tier);
  const division = divisionLabel(emblem.pips);
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 72 72">
        <Defs>
          <SvgLinearGradient id={gradientId} x1="12" y1="7" x2="60" y2="65" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={emblem.shine} />
            <Stop offset="0.38" stopColor={emblem.primary} />
            <Stop offset="1" stopColor={emblem.secondary} />
          </SvgLinearGradient>
          <SvgLinearGradient id={shineId} x1="20" y1="12" x2="49" y2="52" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.88" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </SvgLinearGradient>
        </Defs>

        <Circle cx="36" cy="36" r="33" fill={emblem.glow} opacity={isElite ? '0.18' : '0.09'} />
        {isHighElite ? (
          <Polygon
            points="36,3 42,10 51,7 54,16 64,17 62,27 69,34 62,41 65,51 55,53 52,63 43,60 36,69 29,60 20,63 17,53 7,51 10,41 3,34 10,27 8,17 18,16 21,7 30,10"
            fill={emblem.glow}
            opacity="0.22"
          />
        ) : null}
        {isElite ? (
          <>
            <Path d="M17 26 C11 25 7 21 5 15 C14 16 21 20 25 28 Z" fill={emblem.primary} opacity="0.62" />
            <Path d="M55 28 C59 20 66 16 67 15 C65 22 61 26 55 27 Z" fill={emblem.primary} opacity="0.62" />
            <Path d="M18 32 C12 33 8 37 6 43 C14 42 20 38 24 32 Z" fill={emblem.secondary} opacity="0.62" />
            <Path d="M54 32 C60 38 66 42 66 43 C64 37 60 33 54 32 Z" fill={emblem.secondary} opacity="0.62" />
          </>
        ) : null}

        <Path
          d="M36 7 L58 16 L55 39 C53 51 45 60 36 66 C27 60 19 51 17 39 L14 16 Z"
          fill={emblem.backgroundColor}
          stroke={emblem.glow}
          strokeWidth="4.5"
          strokeLinejoin="round"
        />
        <Path
          d="M36 9 L56 17 L53 38 C51 49 44 57 36 62 C28 57 21 49 19 38 L16 17 Z"
          fill={`url(#${gradientId})`}
          stroke={emblem.borderColor}
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <Path
          d="M24 19 L36 14 L48 19 L46 38 C45 45 40 52 36 55 C32 52 27 45 26 38 Z"
          fill={`url(#${shineId})`}
          opacity="0.5"
        />

        {emblem.tier === 'iron' ? (
          <>
            <Path d="M24 27 H48 L44 33 H40 V44 H32 V33 H28 Z" fill={emblem.shine} opacity="0.92" />
            <Path d="M28 45 H44 L47 50 H25 Z" fill={emblem.secondary} stroke={emblem.shine} strokeWidth="1.2" />
          </>
        ) : emblem.tier === 'bronze' ? (
          <>
            <Path d="M25 46 L45 24 M47 46 L27 24" stroke={emblem.shine} strokeWidth="4" strokeLinecap="round" />
            <Polygon points="25,20 31,27 23,29" fill={emblem.shine} />
            <Polygon points="47,20 49,29 41,27" fill={emblem.shine} />
            <Circle cx="36" cy="35" r="7" fill={emblem.secondary} stroke={emblem.shine} strokeWidth="2" />
          </>
        ) : emblem.tier === 'silver' ? (
          <>
            <Polygon points="36,19 40,29 51,29 42,36 45,47 36,41 27,47 30,36 21,29 32,29" fill={emblem.shine} />
            <Circle cx="36" cy="34" r="6" fill={emblem.secondary} stroke={emblem.backgroundColor} strokeWidth="2" />
          </>
        ) : emblem.tier === 'gold' ? (
          <>
            <Path d="M23 27 L29 34 L36 23 L43 34 L49 27 L46 45 H26 Z" fill={emblem.shine} stroke={emblem.secondary} strokeWidth="1.8" strokeLinejoin="round" />
            <Path d="M27 46 H45" stroke={emblem.backgroundColor} strokeWidth="3" strokeLinecap="round" opacity="0.72" />
            <Circle cx="36" cy="36" r="4" fill={emblem.secondary} />
          </>
        ) : emblem.tier === 'platinum' ? (
          <>
            <Path d="M20 29 L31 33 L36 45 L25 40 Z" fill={emblem.shine} opacity="0.92" />
            <Path d="M52 29 L41 33 L36 45 L47 40 Z" fill={emblem.shine} opacity="0.92" />
            <Polygon points="36,20 45,32 36,47 27,32" fill={emblem.primary} stroke={emblem.shine} strokeWidth="2" />
          </>
        ) : emblem.tier === 'diamond' ? (
          <>
            <Polygon points="36,18 49,31 36,50 23,31" fill={emblem.shine} stroke={emblem.backgroundColor} strokeWidth="1.8" />
            <Polygon points="36,18 42,31 36,50 30,31" fill={emblem.primary} opacity="0.66" />
            <Path d="M23 31 H49 M30 31 L36 18 L42 31" stroke={emblem.secondary} strokeWidth="1.5" opacity="0.82" />
          </>
        ) : emblem.tier === 'master' ? (
          <>
            <Circle cx="36" cy="34" r="15" fill="none" stroke={emblem.shine} strokeWidth="2.4" />
            <Polygon points="36,17 40,29 52,29 42,36 46,49 36,41 26,49 30,36 20,29 32,29" fill={emblem.primary} stroke={emblem.shine} strokeWidth="1.6" />
            <Circle cx="36" cy="34" r="5" fill={emblem.secondary} />
          </>
        ) : emblem.tier === 'grandmaster' ? (
          <>
            <Path d="M22 27 L29 33 L36 20 L43 33 L50 27 L47 46 H25 Z" fill={emblem.shine} stroke={emblem.secondary} strokeWidth="2" strokeLinejoin="round" />
            <Polygon points="36,29 42,36 36,45 30,36" fill={emblem.primary} />
            <Circle cx="36" cy="36" r="3" fill={emblem.secondary} />
          </>
        ) : (
          <>
            <Polygon points="36,16 41,28 54,28 44,36 48,50 36,42 24,50 28,36 18,28 31,28" fill={emblem.shine} stroke={emblem.secondary} strokeWidth="2" />
            <Circle cx="36" cy="35" r="8" fill={emblem.primary} stroke={emblem.secondary} strokeWidth="3" />
            <Polygon points="36,27 39,33 46,34 41,39 42,46 36,42 30,46 31,39 26,34 33,33" fill={emblem.shine} />
          </>
        )}

        {showPips && hasDivision ? (
          <>
            <Path
              d="M20 51 L25 48 H47 L52 51 L49 62 H23 Z"
              fill={emblem.backgroundColor}
              stroke={emblem.borderColor}
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <SvgText
              x="36"
              y="59"
              fill={emblem.shine}
              fontSize="10"
              fontWeight="900"
              textAnchor="middle"
              letterSpacing="0.6"
            >
              {division}
            </SvgText>
          </>
        ) : null}
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
          stroke="#67E0B0"
          strokeWidth={ringWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - safeProgress)}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <PlayerAvatar cosmetics={cosmetics} fallbackInitial={fallbackInitial} size={avatarSize} />
      {league ? (
        <View pointerEvents="none" style={[styles.progressRank, { width: rankSize, height: rankSize, left: -2, bottom: -2 }]}>
          <RankEmblem league={league} size={rankSize} />
        </View>
      ) : null}
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
  autoplayActive?: boolean;
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
  autoplayActive = false,
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
    borderColor: hasGiftItem ? giftAccent || '#F4C95D' : 'rgba(232,236,241,0.26)',
    backgroundColor: hasGiftItem ? 'rgba(36,54,85,0.96)' : 'rgba(247,250,252,0.08)',
  };
  const giftContent = hasGiftItem ? (
    <Text style={[styles.giftItem, { fontSize: Math.max(12, giftSize * 0.6), lineHeight: giftSize }]}>{giftIcon}</Text>
  ) : (
    <Gift color="rgba(232,236,241,0.46)" size={Math.max(10, giftSize * 0.52)} strokeWidth={2.4} />
  );
  const connectionBorderColor =
    connectionState === 'offline' ? '#FF6B6B' : connectionState === 'online' ? '#67E0B0' : null;
  const autoplayWidth = Math.max(34, Math.round(size * 0.78));
  const autoplayHeight = Math.max(18, Math.round(size * 0.36));

  return (
    <View style={[styles.cluster, { width: size + 12, height: size + 12 }]}>
      <PlayerAvatar
        cosmetics={cosmetics}
        fallbackInitial={fallbackInitial}
        size={size}
        onPress={onPress}
        style={{
          ...(connectionBorderColor ? { borderColor: connectionBorderColor } : {}),
          opacity: autoplayActive ? 0.42 : 1,
        }}
        disabled={disabled}
      />
      {autoplayActive ? (
        <View
          pointerEvents="none"
          style={[
            styles.autoplayBadge,
            {
              width: autoplayWidth,
              height: autoplayHeight,
              borderRadius: autoplayHeight / 2,
              left: ((size + 12) - autoplayWidth) / 2,
              top: ((size + 12) - autoplayHeight) / 2,
            },
          ]}
        >
          <Bot color="#F7FAFC" size={Math.max(10, Math.round(autoplayHeight * 0.58))} strokeWidth={2.8} />
          <Text style={[styles.autoplayText, { fontSize: Math.max(7, Math.round(autoplayHeight * 0.36)) }]}>AUTO</Text>
        </View>
      ) : null}
      {league ? (
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
      ) : null}
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
  autoplayBadge: {
    position: 'absolute',
    zIndex: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: 'rgba(232,236,241,0.72)',
    backgroundColor: 'rgba(36,54,85,0.94)',
  },
  autoplayText: {
    color: '#F7FAFC',
    fontWeight: '900',
    letterSpacing: 0,
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
    borderColor: '#243655',
    backgroundColor: '#FF6B6B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimText: {
    color: '#1A2943',
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 12,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
});
