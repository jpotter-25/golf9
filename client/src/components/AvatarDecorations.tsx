import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Crown, Gem, Gift, Rocket, Trophy, Watch, type LucideIcon } from 'lucide-react-native';
import { PlayerAvatar } from './PlayerAvatar';
import { getAvatarAccessoryVisual, type EquippedCosmetics } from '../theme/cosmetics';

export type RankEmblemVisual = {
  shortLabel: string;
  label: string;
  borderColor: string;
  backgroundColor: string;
  textColor: string;
};

type LeagueLike = { league?: string; division?: string | null; name?: string } | string | null | undefined;

const ACCESSORY_ICONS: Record<string, LucideIcon> = {
  watch: Watch,
  gem: Gem,
  rocket: Rocket,
  crown: Crown,
};

export function rankEmblemForLeague(league: LeagueLike): RankEmblemVisual {
  const rawName = typeof league === 'string' ? league : league?.name || league?.league || 'Rookie';
  const rawLeague = typeof league === 'string' ? league : league?.league || rawName;
  const division = typeof league === 'string' ? null : league?.division;
  const key = rawLeague.toLowerCase();
  if (key.includes('legend')) {
    return { shortLabel: 'LG', label: rawName, borderColor: '#D9B8FF', backgroundColor: '#21162C', textColor: '#F0E3FF' };
  }
  if (key.includes('master')) {
    return { shortLabel: 'M', label: rawName, borderColor: '#9BE7FF', backgroundColor: '#102838', textColor: '#D8F3FF' };
  }
  if (key.includes('diamond')) {
    return { shortLabel: 'D', label: rawName, borderColor: '#BDEBFF', backgroundColor: '#102448', textColor: '#EAF8FF' };
  }
  if (key.includes('platinum')) {
    return { shortLabel: 'P', label: rawName, borderColor: '#BFD9FF', backgroundColor: '#182244', textColor: '#E8ECF1' };
  }
  if (key.includes('gold')) {
    return { shortLabel: division ? `G${division}` : 'G', label: rawName, borderColor: '#FFCC66', backgroundColor: '#2B2515', textColor: '#FFE6A3' };
  }
  if (key.includes('silver')) {
    return { shortLabel: division ? `S${division}` : 'S', label: rawName, borderColor: '#BFD9FF', backgroundColor: '#202742', textColor: '#E8ECF1' };
  }
  if (key.includes('bronze')) {
    return { shortLabel: division ? `B${division}` : 'B', label: rawName, borderColor: '#C58B5A', backgroundColor: '#2B1D17', textColor: '#FFD6B0' };
  }
  return { shortLabel: 'R', label: rawName || 'Rookie', borderColor: '#52E5A7', backgroundColor: '#123B32', textColor: '#CFFBE8' };
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
  const emblem = rankEmblemForLeague(league);
  const accessory = getAvatarAccessoryVisual(cosmetics?.avatarAccessory);
  const hasAccessory = showAccessory && accessory.icon !== 'none';
  const accessoryIconSize = Math.max(9, Math.round(size * 0.26));
  const AccessoryIcon = ACCESSORY_ICONS[accessory.icon];
  const badgeSize = Math.max(14, Math.round(size * 0.3));
  const giftSize = Math.max(15, Math.round(size * 0.32));
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
    <Text style={[styles.giftItem, { fontSize: Math.max(12, giftSize * 0.7) }]}>{giftIcon}</Text>
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
            borderColor: emblem.borderColor,
            backgroundColor: emblem.backgroundColor,
          },
        ]}
      >
        <Trophy color={emblem.textColor} size={Math.max(9, badgeSize * 0.44)} strokeWidth={3} />
        <Text style={[styles.rankText, { color: emblem.textColor }]} numberOfLines={1}>{emblem.shortLabel}</Text>
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
  cluster: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  rankBadge: {
    position: 'absolute',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  rankText: {
    fontSize: 6,
    fontWeight: '900',
    lineHeight: 7,
    marginTop: -1,
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
    lineHeight: 22,
    textAlign: 'center',
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
