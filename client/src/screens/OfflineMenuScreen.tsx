// src/screens/OfflineMenuScreen.tsx
// Purpose: Local Solo AI and Pass & Play setup that remains usable without a connection.

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Bot, ChevronLeft, Gamepad2, Play, Users, Wifi, WifiOff } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { ActionButton, PremiumPanel, ScreenHeader, ScreenShell, StatusBadge, ui } from '../ui';
import { useAuth } from '../context/AuthContext';
import { useConnectivity } from '../context/ConnectivityContext';
import { useOfflineSync } from '../context/OfflineSyncContext';
import { useAvailability } from '../context/AvailabilityContext';
import type { FeatureKey } from '../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'OfflineMenu'>;
type LocalMode = 'passplay' | 'solo';

const MODE_META: Record<LocalMode, { title: string; subtitle: string; Icon: LucideIcon; color: string }> = {
  solo: {
    title: 'Solo vs AI',
    subtitle: 'Play a complete match against Easy or Hard opponents.',
    Icon: Bot,
    color: ui.palette.sky,
  },
  passplay: {
    title: 'Pass & Play',
    subtitle: 'Share one device around the table with up to four players.',
    Icon: Users,
    color: ui.palette.emerald,
  },
};

export default function OfflineMenuScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { isOnline } = useConnectivity();
  const { pendingResults, syncing } = useOfflineSync();
  const { entry, isAvailable, isVisible, showUnavailable } = useAvailability();
  const [selectedMode, setSelectedMode] = useState<LocalMode | null>(null);
  const [players, setPlayers] = useState<2 | 3 | 4>(2);
  const [rounds, setRounds] = useState<5 | 9>(5);
  const [aiDifficulty, setAiDifficulty] = useState<'easy' | 'hard'>('easy');
  const [passPlayerNames, setPassPlayerNames] = useState<string[]>(['', '', '', '']);

  useEffect(() => {
    if (selectedMode && !isAvailable(localFeature(selectedMode))) setSelectedMode(null);
  }, [isAvailable, selectedMode]);

  const startSelectedMode = () => {
    if (selectedMode && !isAvailable(localFeature(selectedMode))) {
      showUnavailable(localFeature(selectedMode));
      return;
    }
    if (selectedMode === 'passplay') {
      const localPlayerNames = Array.from({ length: players }, (_, index) => (
        index === 0
          ? user?.displayName ?? 'Player 1'
          : cleanSeatName(passPlayerNames[index], `Player ${index + 1}`)
      ));
      navigation.replace('Game', { players, mode: 'passplay', rounds, localPlayerNames });
      return;
    }
    if (selectedMode === 'solo') navigation.replace('Game', { players, mode: 'solo', rounds, aiDifficulty });
  };

  if (!selectedMode) {
    return (
      <ScreenShell scroll centered>
        <ScreenHeader
          eyebrow="Local Play"
          title="Play Offline"
          subtitle="No room, queue, or connection required. Choose a local table and deal."
          right={isOnline
            ? <Wifi size={28} color={ui.palette.emerald} strokeWidth={2.6} />
            : <WifiOff size={28} color={ui.palette.gold} strokeWidth={2.6} />}
        />

        <View style={styles.connectionStrip}>
          <StatusBadge label={isOnline ? 'ONLINE' : 'OFFLINE READY'} tone={isOnline ? 'emerald' : 'gold'} />
          <Text style={styles.connectionText}>
            {pendingResults > 0
              ? `${pendingResults} finished match${pendingResults === 1 ? '' : 'es'} ${syncing ? 'syncing now' : 'waiting to sync'}.`
              : isOnline
                ? 'Progress is recorded immediately.'
                : 'Completed matches save safely and sync later.'}
          </Text>
        </View>

        {(Object.keys(MODE_META) as LocalMode[]).filter(mode => isVisible(localFeature(mode))).map(mode => (
          <LocalModeCard
            key={mode}
            {...MODE_META[mode]}
            locked={!isAvailable(localFeature(mode))}
            status={entry(localFeature(mode)).testerPreview ? 'Tester Preview' : entry(localFeature(mode)).state === 'live' ? '' : entry(localFeature(mode)).title}
            onPress={() => isAvailable(localFeature(mode)) ? setSelectedMode(mode) : showUnavailable(localFeature(mode))}
          />
        ))}

        <PremiumPanel style={styles.offlineNote}>
          <Gamepad2 size={20} color={ui.palette.gold} strokeWidth={2.6} />
          <Text style={styles.offlineNoteText}>
            Local games run entirely on this device. Earned progression is confirmed by Golf 9 once you reconnect.
          </Text>
        </PremiumPanel>
      </ScreenShell>
    );
  }

  const selected = MODE_META[selectedMode];
  const SelectedIcon = selected.Icon;

  return (
    <ScreenShell scroll centered>
      <ScreenHeader
        eyebrow="Table Setup"
        title={selected.title}
        subtitle={selected.subtitle}
        right={<SelectedIcon size={32} color={selected.color} strokeWidth={2.5} />}
      />

      <PremiumPanel>
        <PickerLabel label="Players" value={`${players}`} />
        <Segmented values={[2, 3, 4]} selected={players} onSelect={value => setPlayers(value as 2 | 3 | 4)} />
      </PremiumPanel>

      <PremiumPanel>
        <PickerLabel label="Rounds" value={`${rounds}`} />
        <Segmented values={[5, 9]} selected={rounds} onSelect={value => setRounds(value as 5 | 9)} />
      </PremiumPanel>

      {selectedMode === 'solo' ? (
        <PremiumPanel>
          <PickerLabel label="AI Difficulty" value={aiDifficulty === 'easy' ? 'Easy' : 'Hard'} />
          <Segmented
            values={['easy', 'hard']}
            selected={aiDifficulty}
            onSelect={value => setAiDifficulty(value as 'easy' | 'hard')}
            labels={{ easy: 'Easy', hard: 'Hard' }}
          />
        </PremiumPanel>
      ) : null}

      {selectedMode === 'passplay' ? (
        <PremiumPanel>
          <PickerLabel label="Seats" value={`${players}`} />
          <View style={styles.seatRow}>
            <View style={styles.seatNumber}><Text style={styles.seatNumberText}>1</Text></View>
            <View style={styles.seatCopy}>
              <Text style={styles.seatLabel}>Signed-in player</Text>
              <Text style={styles.seatName} numberOfLines={1}>{user?.displayName ?? 'Player 1'}</Text>
            </View>
          </View>
          {Array.from({ length: players - 1 }, (_, offset) => offset + 1).map(index => (
            <View key={index} style={styles.seatRow}>
              <View style={styles.seatNumber}><Text style={styles.seatNumberText}>{index + 1}</Text></View>
              <TextInput
                value={passPlayerNames[index] ?? ''}
                onChangeText={text => {
                  const next = [...passPlayerNames];
                  next[index] = text;
                  setPassPlayerNames(next);
                }}
                placeholder={`Player ${index + 1}`}
                placeholderTextColor={ui.text.muted}
                maxLength={12}
                autoCapitalize="words"
                autoCorrect={false}
                style={styles.seatInput}
              />
            </View>
          ))}
        </PremiumPanel>
      ) : null}

      <ActionButton label="Deal Cards" Icon={Play} tone="primary" onPress={startSelectedMode} style={styles.startButton} />
      <ActionButton label="Back" Icon={ChevronLeft} tone="ghost" onPress={() => setSelectedMode(null)} />
    </ScreenShell>
  );
}

function LocalModeCard({ title, subtitle, Icon, color, locked, status, onPress }: { title: string; subtitle: string; Icon: LucideIcon; color: string; locked: boolean; status: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
      <PremiumPanel tone="felt" style={[styles.modeCard, { borderColor: color }, locked && styles.modeLocked]}>
        <View style={[styles.modeAccent, { backgroundColor: color }]} />
        <View style={[styles.modeIcon, { borderColor: color }]}><Icon size={27} color={color} strokeWidth={2.6} /></View>
        <View style={styles.modeCopy}>
          <Text style={styles.modeTitle}>{title}</Text>
          <Text style={styles.modeSubtitle}>{subtitle}</Text>
          {status ? <Text style={styles.modeStatus}>{status}</Text> : null}
        </View>
        <Play size={20} color={ui.palette.gold} fill={ui.palette.gold} />
      </PremiumPanel>
    </Pressable>
  );
}

function localFeature(mode: LocalMode): FeatureKey {
  return mode === 'solo' ? 'offline.solo_ai' : 'offline.pass_play';
}

function PickerLabel({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.pickerLabel}>
      <Text style={styles.label}>{label}</Text>
      <StatusBadge label={value} tone="sky" />
    </View>
  );
}

function Segmented<T extends string | number>({ values, selected, labels, onSelect }: { values: T[]; selected: T; labels?: Partial<Record<string, string>>; onSelect: (value: T) => void }) {
  return (
    <View style={styles.segmented}>
      {values.map(value => {
        const active = selected === value;
        return (
          <Pressable key={String(value)} onPress={() => onSelect(value)} style={[styles.segment, active && styles.segmentActive]}>
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{labels?.[String(value)] ?? String(value)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function cleanSeatName(value: string | undefined, fallback: string) {
  const trimmed = String(value || '').trim().replace(/\s+/g, ' ');
  return trimmed ? trimmed.slice(0, 12) : fallback;
}

const styles = StyleSheet.create({
  connectionStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  connectionText: { flex: 1, color: ui.text.secondary, fontSize: 12, fontWeight: '800', lineHeight: 17 },
  modeCard: { minHeight: 104, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, overflow: 'hidden' },
  modeAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  modeIcon: { width: 54, height: 54, borderRadius: 8, borderWidth: 1, backgroundColor: 'rgba(7, 10, 24, 0.38)', alignItems: 'center', justifyContent: 'center' },
  modeCopy: { flex: 1, minWidth: 0 },
  modeLocked: { opacity: 0.58 },
  modeTitle: { color: ui.text.primary, fontSize: 19, fontWeight: '900' },
  modeSubtitle: { color: ui.text.secondary, fontSize: 13, fontWeight: '700', lineHeight: 18, marginTop: 4 },
  modeStatus: { color: ui.palette.gold, fontSize: 11, fontWeight: '900', marginTop: 5 },
  offlineNote: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  offlineNoteText: { flex: 1, color: ui.text.secondary, fontSize: 12, fontWeight: '800', lineHeight: 18 },
  pickerLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  label: { color: ui.text.secondary, fontSize: 14, fontWeight: '900' },
  segmented: { minHeight: 46, flexDirection: 'row', gap: 8 },
  segment: { flex: 1, borderRadius: 8, borderWidth: 1, borderColor: ui.border.soft, backgroundColor: ui.surface.base, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: ui.palette.emerald, borderColor: ui.palette.emerald },
  segmentText: { color: ui.text.secondary, fontSize: 15, fontWeight: '900' },
  segmentTextActive: { color: ui.text.inverse },
  seatRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  seatNumber: { width: 38, height: 38, borderRadius: 8, borderWidth: 1, borderColor: ui.border.soft, backgroundColor: ui.surface.base, alignItems: 'center', justifyContent: 'center' },
  seatNumberText: { color: ui.palette.emerald, fontSize: 15, fontWeight: '900' },
  seatCopy: { flex: 1, minWidth: 0 },
  seatLabel: { color: ui.text.muted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  seatName: { color: ui.text.primary, fontSize: 17, fontWeight: '900', marginTop: 2 },
  seatInput: { flex: 1, minHeight: 46, borderRadius: 8, borderWidth: 1, borderColor: ui.border.soft, backgroundColor: ui.surface.base, color: ui.text.primary, fontSize: 16, fontWeight: '900', paddingHorizontal: 12 },
  startButton: { marginBottom: 10 },
});
