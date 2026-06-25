// client/src/screens/SettingsScreen.tsx
// Purpose: Session-level alert, sound, and vibration controls.

import React, { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { Bell, ChevronLeft, Eye, Gauge, Volume2, Zap, type LucideIcon } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { getGameplayPreferences, setGameplayPreferences, subscribeGameplayPreferences } from '../services/preferences';
import { ActionButton, PremiumPanel, ScreenHeader, ScreenShell, ui } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const [prefs, setPrefs] = useState(getGameplayPreferences());

  useEffect(() => subscribeGameplayPreferences(setPrefs), []);

  const update = (next: Partial<typeof prefs>) => {
    setGameplayPreferences(next);
  };

  return (
    <ScreenShell scroll>
      <ScreenHeader
        eyebrow="Player Settings"
        title="Alerts"
        subtitle="Tune the cues that tell you when the table needs you."
      />

      <PremiumPanel tone="felt">
        <SettingRow
          Icon={Bell}
          title="Turn Popups"
          detail="Show the big turn and final-go-around notices."
          value={prefs.turnAlerts}
          onValueChange={value => update({ turnAlerts: value })}
        />
        <SettingRow
          Icon={Volume2}
          title="Turn Sound"
          detail="Play a short table chime at the start of your turn."
          value={prefs.sound}
          onValueChange={value => update({ sound: value })}
        />
        <SettingRow
          Icon={Zap}
          title="Vibration"
          detail="Buzz once when a new turn starts."
          value={prefs.vibrate}
          onValueChange={value => update({ vibrate: value })}
        />
        <SettingRow
          Icon={Gauge}
          title="Reduced Motion"
          detail="Use calmer motion for table notices and reward moments."
          value={prefs.reducedMotion}
          onValueChange={value => update({ reducedMotion: value })}
        />
        <SettingRow
          Icon={Eye}
          title="High Contrast"
          detail="Reserve stronger contrast for future table and card treatments."
          value={prefs.highContrast}
          onValueChange={value => update({ highContrast: value })}
        />
      </PremiumPanel>

      <ActionButton label="Back To Lobby" Icon={ChevronLeft} tone="ghost" onPress={() => navigation.goBack()} />
    </ScreenShell>
  );
};

export default SettingsScreen;

function SettingRow({
  Icon,
  title,
  detail,
  value,
  onValueChange,
}: {
  Icon: LucideIcon;
  title: string;
  detail: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.iconWrap}>
        <Icon size={20} color={ui.palette.emerald} strokeWidth={2.6} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.detail}>{detail}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        thumbColor={value ? ui.palette.emerald : ui.border.strong}
        trackColor={{ false: ui.surface.raised, true: ui.palette.feltLight }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: ui.border.soft,
    paddingVertical: 10,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: ui.radius.md,
    backgroundColor: ui.palette.feltLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0 },
  title: { color: ui.text.primary, fontSize: 16, fontWeight: '900' },
  detail: { color: ui.text.secondary, fontSize: 12, fontWeight: '700', lineHeight: 17, marginTop: 3 },
});
