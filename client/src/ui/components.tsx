import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ShoppingBag } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { gradients, ui } from './theme';

type ShellProps = {
  children: React.ReactNode;
  scroll?: boolean;
  centered?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
};

export function ScreenShell({ children, scroll = false, centered = false, contentStyle }: ShellProps) {
  const insets = useSafeAreaInsets();
  const content = [
    styles.shellContent,
    centered && styles.shellCentered,
    { paddingTop: Math.max(24, insets.top + 18), paddingBottom: Math.max(72, insets.bottom + 56) },
    contentStyle,
  ];

  return (
    <LinearGradient colors={gradients.app} style={styles.shell}>
      {scroll ? (
        <ScrollView style={styles.fill} contentContainerStyle={content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={content}>{children}</View>
      )}
    </LinearGradient>
  );
}

export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  right,
  showGlobalActions = true,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  showGlobalActions?: boolean;
}) {
  const { token, user } = useAuth();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const showActions = showGlobalActions && !!token;

  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {right || showActions ? (
        <View style={styles.headerRight}>
          {right}
          {showActions ? (
            <View style={styles.quickActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open profile"
                style={styles.quickAvatar}
                onPress={() => navigation.navigate('Profile')}
              >
                <Text style={styles.quickAvatarText}>{user?.avatarInitial ?? '?'}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open shop"
                style={styles.quickShop}
                onPress={() => navigation.navigate('Shop')}
              >
                <ShoppingBag size={18} color={ui.palette.gold} strokeWidth={2.7} />
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function PremiumPanel({
  children,
  tone = 'panel',
  style,
}: {
  children: React.ReactNode;
  tone?: 'panel' | 'felt' | 'gold' | 'sky' | 'warning';
  style?: StyleProp<ViewStyle>;
}) {
  const colors = tone === 'felt'
    ? gradients.felt
    : tone === 'gold'
      ? gradients.gold
      : tone === 'sky'
        ? gradients.sky
        : tone === 'warning'
          ? gradients.warning
          : gradients.panel;
  return (
    <LinearGradient colors={colors} style={[styles.panel, tone === 'gold' && styles.panelGold, style]}>
      {children}
    </LinearGradient>
  );
}

export function ActionButton({
  label,
  onPress,
  disabled = false,
  tone = 'primary',
  Icon,
  style,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'secondary' | 'gold' | 'ghost' | 'danger';
  Icon?: LucideIcon;
  style?: StyleProp<ViewStyle>;
}) {
  const buttonStyle = [
    styles.actionButton,
    tone === 'secondary' && styles.actionButtonSecondary,
    tone === 'gold' && styles.actionButtonGold,
    tone === 'ghost' && styles.actionButtonGhost,
    tone === 'danger' && styles.actionButtonDanger,
    disabled && styles.disabled,
    style,
  ];
  const textStyle = [
    styles.actionButtonText,
    tone === 'ghost' && styles.actionButtonGhostText,
    tone === 'danger' && styles.actionButtonDangerText,
  ];

  return (
    <Pressable style={buttonStyle} disabled={disabled} onPress={onPress}>
      {Icon ? <Icon size={18} color={tone === 'ghost' || tone === 'danger' ? ui.text.primary : ui.text.inverse} strokeWidth={2.8} /> : null}
      <Text style={textStyle} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export function IconTile({
  label,
  onPress,
  Icon,
  badge,
}: {
  label: string;
  onPress: () => void;
  Icon: LucideIcon;
  badge?: string | number | null;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.iconTile, pressed && styles.iconTilePressed]}>
      <View style={styles.iconBadge}>
        <Icon size={21} color={ui.palette.emerald} strokeWidth={2.6} />
        {badge ? (
          <View style={styles.badgeDot}>
            <Text style={styles.badgeDotText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.iconTileLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export function StatusBadge({
  label,
  tone = 'emerald',
  style,
  textStyle,
}: {
  label: string;
  tone?: 'emerald' | 'gold' | 'sky' | 'danger' | 'muted';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <View style={[
      styles.statusBadge,
      tone === 'gold' && styles.statusBadgeGold,
      tone === 'sky' && styles.statusBadgeSky,
      tone === 'danger' && styles.statusBadgeDanger,
      tone === 'muted' && styles.statusBadgeMuted,
      style,
    ]}>
      <Text style={[styles.statusBadgeText, textStyle]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export function ProgressBar({ value, color = ui.palette.emerald }: { value: number; color?: string }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(1, value)) * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  shell: { flex: 1 },
  shellContent: { flexGrow: 1, paddingHorizontal: 18 },
  shellCentered: { justifyContent: 'center' },
  header: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quickActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quickAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: ui.palette.emerald,
    backgroundColor: ui.palette.feltLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAvatarText: { color: ui.text.primary, fontSize: 15, fontWeight: '900' },
  quickShop: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ui.border.gold,
    backgroundColor: 'rgba(255, 204, 102, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: { color: ui.palette.gold, fontSize: 11, fontWeight: '900', letterSpacing: 0, textTransform: 'uppercase', marginBottom: 4 },
  title: { color: ui.text.primary, fontSize: 32, fontWeight: '900' },
  subtitle: { color: ui.text.secondary, fontSize: 14, fontWeight: '700', marginTop: 4, lineHeight: 19 },
  panel: {
    borderRadius: ui.radius.lg,
    borderWidth: 1,
    borderColor: ui.border.soft,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  panelGold: { borderColor: ui.border.gold },
  actionButton: {
    minHeight: 52,
    borderRadius: ui.radius.md,
    backgroundColor: ui.palette.emerald,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  actionButtonSecondary: { backgroundColor: ui.palette.sky },
  actionButtonGold: { backgroundColor: ui.palette.gold },
  actionButtonGhost: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: ui.border.strong,
  },
  actionButtonDanger: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: ui.feedback.danger,
  },
  actionButtonText: { color: ui.text.inverse, fontSize: 15, fontWeight: '900' },
  actionButtonGhostText: { color: ui.text.primary },
  actionButtonDangerText: { color: ui.feedback.danger },
  disabled: { opacity: 0.45 },
  iconTile: {
    flex: 1,
    minWidth: '46%',
    minHeight: 72,
    borderRadius: ui.radius.md,
    borderWidth: 1,
    borderColor: ui.border.soft,
    backgroundColor: ui.surface.glass,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconTilePressed: { backgroundColor: ui.surface.raised, borderColor: ui.border.glow },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: ui.palette.feltLight,
    borderWidth: 1,
    borderColor: ui.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTileLabel: { color: ui.text.primary, fontSize: 14, fontWeight: '900' },
  badgeDot: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: ui.feedback.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeDotText: { color: ui.text.inverse, fontSize: 10, fontWeight: '900' },
  statusBadge: {
    minHeight: 24,
    borderRadius: 6,
    backgroundColor: ui.palette.emerald,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadgeGold: { backgroundColor: ui.palette.gold },
  statusBadgeSky: { backgroundColor: ui.palette.sky },
  statusBadgeDanger: { backgroundColor: ui.feedback.danger },
  statusBadgeMuted: { backgroundColor: ui.border.strong },
  statusBadgeText: { color: ui.text.inverse, fontSize: 11, fontWeight: '900' },
  progressTrack: {
    height: 9,
    borderRadius: 8,
    backgroundColor: ui.palette.ink,
    borderWidth: 1,
    borderColor: ui.border.soft,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 8 },
  sectionTitleRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: { color: ui.text.primary, fontSize: 18, fontWeight: '900' },
});

export const uiStyles = styles;
