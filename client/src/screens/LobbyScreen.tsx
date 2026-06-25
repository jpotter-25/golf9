// src/screens/LobbyScreen.tsx
// Purpose: Premium mode-first home hub for local, solo, and online play.

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bot, BookOpen, ChevronLeft, MessageCircle, Play, Settings, ShoppingBag, Trophy, UserRound, Users, Wifi } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { ActionButton, IconTile, PremiumPanel, ScreenHeader, ScreenShell, StatusBadge, ui } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Lobby'>;
type ModeChoice = 'passplay' | 'solo' | 'online';

const MODE_META: Record<ModeChoice, { title: string; subtitle: string; Icon: LucideIcon; tone: 'emerald' | 'sky' | 'gold' }> = {
  passplay: { title: 'Pass & Play', subtitle: 'Same room, one device, table-night energy.', Icon: Users, tone: 'emerald' },
  solo: { title: 'Solo vs AI', subtitle: 'Train your table instincts against tuned AI.', Icon: Bot, tone: 'sky' },
  online: { title: 'Online Multiplayer', subtitle: 'Create rooms, wager, ranked, clubs, and friends.', Icon: Wifi, tone: 'gold' },
};

export default function LobbyScreen({ navigation }: Props) {
  const [selectedMode, setSelectedMode] = useState<ModeChoice | null>(null);
  const [players, setPlayers] = useState<2 | 3 | 4>(4);
  const [rounds, setRounds] = useState<5 | 9>(9);
  const [aiDifficulty, setAiDifficulty] = useState<'easy' | 'hard'>('easy');

  const startSelectedMode = () => {
    if (selectedMode === 'passplay') navigation.replace('Game', { players, mode: 'passplay', rounds });
    else if (selectedMode === 'solo') navigation.replace('Game', { players, mode: 'solo', rounds, aiDifficulty });
    else if (selectedMode === 'online') navigation.navigate('OnlineMenu', { players, rounds });
  };

  if (!selectedMode) {
    return (
      <ScreenShell scroll centered>
        <ScreenHeader
          eyebrow="Golf 9"
          title="Choose Your Table"
          subtitle="Fast card strategy, social pressure, and casino-night polish."
          right={<StatusBadge label="LIVE" tone="gold" />}
        />

        {(Object.keys(MODE_META) as ModeChoice[]).map(mode => (
          <ModeCard key={mode} mode={mode} {...MODE_META[mode]} onPress={() => setSelectedMode(mode)} />
        ))}

        <View style={styles.utilityGrid}>
          <IconTile Icon={UserRound} label="Profile" onPress={() => navigation.navigate('Profile')} />
          <IconTile Icon={ShoppingBag} label="Shop" onPress={() => navigation.navigate('Shop')} />
          <IconTile Icon={MessageCircle} label="Social" onPress={() => navigation.navigate('Social')} />
          <IconTile Icon={Settings} label="Settings" onPress={() => navigation.navigate('Settings')} />
          <IconTile Icon={BookOpen} label="Rules" onPress={() => navigation.navigate('Rules')} />
        </View>
      </ScreenShell>
    );
  }

  const selected = MODE_META[selectedMode];
  const SelectedIcon = selected.Icon;
  const isSolo = selectedMode === 'solo';

  return (
    <ScreenShell scroll centered>
      <ScreenHeader
        eyebrow="Table Setup"
        title={selected.title}
        subtitle={selected.subtitle}
        right={<SelectedIcon size={34} color={toneColor(selected.tone)} strokeWidth={2.4} />}
      />

      <PremiumPanel>
        <PickerLabel label="Players" value={`${players}`} />
        <Segmented values={[2, 3, 4]} selected={players} onSelect={value => setPlayers(value as 2 | 3 | 4)} />
      </PremiumPanel>

      <PremiumPanel>
        <PickerLabel label="Rounds" value={`${rounds}`} />
        <Segmented values={[5, 9]} selected={rounds} onSelect={value => setRounds(value as 5 | 9)} />
      </PremiumPanel>

      {isSolo ? (
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

      <ActionButton
        label={selectedMode === 'online' ? 'Open Online Tables' : 'Deal Cards'}
        Icon={selectedMode === 'online' ? Trophy : Play}
        tone={selected.tone === 'gold' ? 'gold' : selected.tone === 'sky' ? 'secondary' : 'primary'}
        onPress={startSelectedMode}
        style={styles.startButton}
      />
      <ActionButton label="Back" Icon={ChevronLeft} tone="ghost" onPress={() => setSelectedMode(null)} />
    </ScreenShell>
  );
}

function ModeCard({
  title,
  subtitle,
  Icon,
  tone,
  onPress,
}: {
  mode: ModeChoice;
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  tone: 'emerald' | 'sky' | 'gold';
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <PremiumPanel tone="felt" style={[styles.modeCard, { borderColor: toneColor(tone) }]}>
        <View style={[styles.modeAccent, { backgroundColor: toneColor(tone) }]} />
        <View style={[styles.modeIcon, { borderColor: toneColor(tone) }]}>
          <Icon size={26} color={toneColor(tone)} strokeWidth={2.6} />
        </View>
        <View style={styles.modeCopy}>
          <Text style={styles.modeTitle}>{title}</Text>
          <Text style={styles.modeSubtitle}>{subtitle}</Text>
        </View>
        <Play size={20} color={ui.palette.gold} fill={ui.palette.gold} />
      </PremiumPanel>
    </Pressable>
  );
}

function PickerLabel({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.pickerLabel}>
      <Text style={styles.label}>{label}</Text>
      <StatusBadge label={value} tone="sky" />
    </View>
  );
}

function Segmented<T extends string | number>({
  values,
  selected,
  labels,
  onSelect,
}: {
  values: T[];
  selected: T;
  labels?: Partial<Record<string, string>>;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {values.map(value => {
        const active = selected === value;
        const text = labels?.[String(value)] ?? String(value);
        return (
          <Pressable key={String(value)} onPress={() => onSelect(value)} style={[styles.segment, active && styles.segmentActive]}>
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{text}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function toneColor(tone: 'emerald' | 'sky' | 'gold') {
  if (tone === 'sky') return ui.palette.sky;
  if (tone === 'gold') return ui.palette.gold;
  return ui.palette.emerald;
}

const styles = StyleSheet.create({
  modeCard: {
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modeAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    opacity: 0.9,
  },
  modeIcon: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(7, 10, 24, 0.34)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeCopy: { flex: 1, minWidth: 0 },
  modeTitle: { color: ui.text.primary, fontSize: 19, fontWeight: '900' },
  modeSubtitle: { color: ui.text.secondary, fontSize: 13, fontWeight: '700', lineHeight: 18, marginTop: 4 },
  utilityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  pickerLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  label: { color: ui.text.secondary, fontSize: 14, fontWeight: '900' },
  segmented: {
    minHeight: 46,
    flexDirection: 'row',
    gap: 8,
  },
  segment: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ui.border.soft,
    backgroundColor: ui.surface.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: ui.palette.emerald,
    borderColor: ui.palette.emerald,
  },
  segmentText: { color: ui.text.secondary, fontSize: 15, fontWeight: '900' },
  segmentTextActive: { color: ui.text.inverse },
  startButton: { marginBottom: 10 },
});
