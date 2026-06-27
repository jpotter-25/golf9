import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Shield, Sparkles, Trophy, UserCircle, type LucideIcon } from 'lucide-react-native';
import { getAvatarFrameVisual, getAvatarIconVisual, type EquippedCosmetics } from '../theme/cosmetics';

type Props = {
  cosmetics?: EquippedCosmetics | null;
  fallbackInitial?: string;
  size?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
};

const ICONS: Record<string, LucideIcon> = {
  user: UserCircle,
  sparkles: Sparkles,
  shield: Shield,
  trophy: Trophy,
};

export function PlayerAvatar({ cosmetics, fallbackInitial = '?', size = 54, onPress, style, disabled }: Props) {
  const frame = getAvatarFrameVisual(cosmetics?.avatarFrame);
  const icon = getAvatarIconVisual(cosmetics?.avatarIcon);
  const Icon = ICONS[icon.icon] || UserCircle;
  const innerSize = Math.max(20, Math.round(size * 0.58));
  const content = (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: frame.borderColor,
          backgroundColor: icon.backgroundColor || frame.backgroundColor,
        },
        style,
      ]}
    >
      {cosmetics?.avatarIcon ? (
        <Icon color={icon.color} size={innerSize} strokeWidth={2.8} />
      ) : (
        <Text style={[styles.fallback, { color: icon.color, fontSize: Math.max(15, size * 0.42) }]}>
          {fallbackInitial.slice(0, 1).toUpperCase()}
        </Text>
      )}
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
    borderWidth: 3,
    justifyContent: 'center',
  },
  fallback: {
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.82,
  },
});
