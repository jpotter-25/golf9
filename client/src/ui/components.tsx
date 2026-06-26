import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, BookOpen, Coins, GraduationCap, Home, LogOut, Music2, Settings, Trophy, Volume2, X, Zap } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useNavigation, useRoute, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { getGameplayPreferences, setGameplayPreferences, subscribeGameplayPreferences } from '../services/preferences';
import { gradients, ui } from './theme';

type ShellProps = {
  children: React.ReactNode;
  scroll?: boolean;
  centered?: boolean;
  showTopBar?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
};

export function ScreenShell({ children, scroll = false, centered = false, showTopBar = true, contentStyle }: ShellProps) {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const topBarVisible = showTopBar && !!token;
  const content = [
    styles.shellContent,
    centered && styles.shellCentered,
    { paddingTop: topBarVisible ? 14 : Math.max(24, insets.top + 18), paddingBottom: Math.max(72, insets.bottom + 56) },
    contentStyle,
  ];

  return (
    <LinearGradient colors={gradients.app} style={styles.shell}>
      {topBarVisible ? <GlobalTopBar /> : null}
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
  showGlobalActions = false,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  showGlobalActions?: boolean;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title} adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {right || showGlobalActions ? (
        <View style={styles.headerRight}>
          {right}
        </View>
      ) : null}
    </View>
  );
}

function GlobalTopBar() {
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { user, signOut } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prefs, setPrefs] = useState(getGameplayPreferences());
  const isLobby = route.name === 'Lobby';
  const progress = Math.max(0.06, Math.min(1, user?.progression.levelProgress ?? 0));
  const ranked = user?.competitive;

  useEffect(() => subscribeGameplayPreferences(setPrefs), []);

  const updatePrefs = (next: Partial<typeof prefs>) => setGameplayPreferences(next);

  return (
    <View style={[styles.topBarWrap, { paddingTop: Math.max(10, insets.top + 8) }]}>
      <View style={styles.topBar}>
        {!isLobby ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Go home" style={styles.topIconButton} onPress={() => navigation.navigate('Lobby')}>
            <Home size={20} color={ui.text.primary} strokeWidth={2.8} />
          </Pressable>
        ) : null}

        <Pressable accessibilityRole="button" accessibilityLabel="Open profile" style={styles.playerChip} onPress={() => navigation.navigate('Profile')}>
          <View style={styles.topAvatar}>
            <Text style={styles.topAvatarText}>{user?.avatarInitial ?? '?'}</Text>
          </View>
          <View style={styles.playerMeta}>
            <Text style={styles.playerName} numberOfLines={1}>{user?.displayName ?? 'Player'}</Text>
            <View style={styles.xpTrack}>
              <View style={[styles.xpFill, { width: `${progress * 100}%` }]} />
            </View>
            <Text style={styles.playerLevel} numberOfLines={1}>Lv {user?.progression.level ?? 1}</Text>
          </View>
        </Pressable>

        <Pressable accessibilityRole="button" accessibilityLabel="Open shop" style={styles.currencyChip} onPress={() => navigation.navigate('Shop')}>
          <Coins size={16} color={ui.palette.gold} strokeWidth={2.8} />
          <Text style={styles.currencyValue} numberOfLines={1}>{user?.currency.coins ?? 0}</Text>
        </Pressable>

        <Pressable accessibilityRole="button" accessibilityLabel="Open ranked profile" style={styles.rankChip} onPress={() => navigation.navigate('Profile')}>
          <Trophy size={15} color={ui.palette.sky} strokeWidth={2.8} />
          <Text style={styles.rankValue} numberOfLines={1}>{ranked?.mmr ?? 1000}</Text>
        </Pressable>

        <Pressable accessibilityRole="button" accessibilityLabel="Open settings" style={styles.topIconButton} onPress={() => setSettingsOpen(true)}>
          <Settings size={20} color={ui.text.primary} strokeWidth={2.8} />
        </Pressable>
      </View>

      <Modal animationType="fade" transparent visible={settingsOpen} onRequestClose={() => setSettingsOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.settingsCard}>
            <Pressable style={styles.modalClose} onPress={() => setSettingsOpen(false)} accessibilityRole="button" accessibilityLabel="Close settings">
              <X size={24} color={ui.text.primary} strokeWidth={3} />
            </Pressable>
            <View style={styles.settingsTitleBar}>
              <Text style={styles.settingsTitle}>Settings</Text>
            </View>
            <View style={styles.settingsBody}>
              <SettingsToggle Icon={Volume2} label="Sound" value={prefs.sound} onValueChange={value => updatePrefs({ sound: value })} />
              <SettingsToggle Icon={Music2} label="Music" value={prefs.music} onValueChange={value => updatePrefs({ music: value })} />
              <SettingsToggle Icon={Bell} label="Pop-up Notifications" value={prefs.turnAlerts} onValueChange={value => updatePrefs({ turnAlerts: value })} />
              <SettingsToggle Icon={Zap} label="Vibration" value={prefs.vibrate} onValueChange={value => updatePrefs({ vibrate: value })} />
              <SettingsAction Icon={BookOpen} label="Rules" onPress={() => { setSettingsOpen(false); navigation.navigate('Rules'); }} />
              <SettingsAction Icon={GraduationCap} label="Play Tutorial" onPress={() => { setSettingsOpen(false); navigation.navigate('Rules'); }} />
              <SettingsAction Icon={LogOut} label="Log Out" danger onPress={() => { setSettingsOpen(false); signOut(); }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SettingsToggle({ Icon, label, value, onValueChange }: { Icon: LucideIcon; label: string; value: boolean; onValueChange: (value: boolean) => void }) {
  return (
    <View style={styles.settingsRow}>
      <View style={styles.settingsRowIcon}><Icon size={22} color={ui.palette.sky} strokeWidth={2.8} /></View>
      <Text style={styles.settingsRowText}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        thumbColor={value ? ui.palette.gold : ui.text.muted}
        trackColor={{ false: '#88A9D2', true: ui.palette.feltLight }}
      />
    </View>
  );
}

function SettingsAction({ Icon, label, onPress, danger = false }: { Icon: LucideIcon; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable style={styles.settingsRow} onPress={onPress}>
      <View style={styles.settingsRowIcon}><Icon size={22} color={danger ? ui.feedback.danger : ui.palette.sky} strokeWidth={2.8} /></View>
      <Text style={[styles.settingsRowText, danger && styles.settingsDanger]}>{label}</Text>
      <Text style={styles.settingsChevron}>›</Text>
    </Pressable>
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
  topBarWrap: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  topBar: {
    minHeight: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ui.border.soft,
    backgroundColor: 'rgba(10, 15, 37, 0.88)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  playerChip: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: ui.palette.emerald,
    backgroundColor: ui.palette.feltLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topAvatarText: { color: ui.text.primary, fontSize: 18, fontWeight: '900' },
  playerMeta: { flex: 1, minWidth: 0 },
  playerName: { color: ui.text.primary, fontSize: 12, fontWeight: '900' },
  playerLevel: { color: ui.palette.gold, fontSize: 10, fontWeight: '900', marginTop: 2 },
  xpTrack: {
    height: 6,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: ui.surface.base,
    marginTop: 4,
    borderWidth: 1,
    borderColor: ui.border.soft,
  },
  xpFill: { height: '100%', backgroundColor: ui.palette.emerald },
  currencyChip: {
    minWidth: 62,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ui.border.gold,
    backgroundColor: 'rgba(255, 204, 102, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 7,
  },
  currencyValue: { color: ui.palette.gold, fontSize: 13, fontWeight: '900', maxWidth: 42 },
  rankChip: {
    minWidth: 58,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ui.border.strong,
    backgroundColor: ui.surface.glass,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
  },
  rankValue: { color: ui.text.primary, fontSize: 12, fontWeight: '900', maxWidth: 38 },
  topIconButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ui.border.soft,
    backgroundColor: ui.surface.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.54)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  settingsCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 8,
    backgroundColor: '#ECF5FF',
    borderWidth: 5,
    borderColor: '#FFFFFF',
    overflow: 'visible',
  },
  modalClose: {
    position: 'absolute',
    zIndex: 2,
    top: -23,
    right: -12,
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: '#6EA0D7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsTitleBar: {
    minHeight: 64,
    backgroundColor: '#2F63C7',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 4,
    borderBottomColor: '#1B4189',
  },
  settingsTitle: { color: '#FFFFFF', fontSize: 27, fontWeight: '900', textTransform: 'uppercase' },
  settingsBody: { padding: 14, gap: 10 },
  settingsRow: {
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: '#FFC247',
    borderWidth: 2,
    borderColor: '#EF8F1E',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
  },
  settingsRowIcon: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsRowText: { flex: 1, color: '#9A4F13', fontSize: 15, fontWeight: '900', textTransform: 'uppercase' },
  settingsDanger: { color: ui.feedback.danger },
  settingsChevron: { color: '#416789', fontSize: 28, fontWeight: '900' },
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
  title: { color: ui.text.primary, fontSize: 30, fontWeight: '900', lineHeight: 36 },
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
