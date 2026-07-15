// src/screens/RankedMenuScreen.tsx
// Purpose: Focused ranked entry with per-table ladders, season context, and matchmaking.

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarDays, ChevronRight, Medal, ShieldCheck, Trophy, Users, WifiOff } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { ActionButton, PremiumPanel, ProgressBar, ScreenHeader, ScreenShell, StatusBadge, ui } from '../ui';
import { RankEmblem } from '../components/AvatarDecorations';
import { useAuth } from '../context/AuthContext';
import { useConnectivity } from '../context/ConnectivityContext';
import { useAvailability } from '../context/AvailabilityContext';
import type { FeatureKey } from '../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'RankedMenu'>;
type PlayerCount = 2 | 3 | 4;

const PLAYER_OPTIONS: PlayerCount[] = [2, 3, 4];

export default function RankedMenuScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { isOnline } = useConnectivity();
  const { entry, isAvailable, isVisible, showUnavailable } = useAvailability();
  const [players, setPlayers] = useState<PlayerCount>(2);
  const visiblePlayerOptions = PLAYER_OPTIONS.filter(option => isVisible(rankedFeature(option)));
  const ladder = user?.competitiveByPlayers?.[String(players) as '2' | '3' | '4'] ?? user?.competitive;
  const seasonDaysLeft = ladder?.season?.endsAt
    ? Math.max(0, Math.ceil((ladder.season.endsAt - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;
  const placementsRequired = ladder?.placementMatchesRequired ?? 5;
  const placementsPlayed = ladder?.placementsPlayed ?? 0;
  const placementProgress = Math.min(1, placementsPlayed / Math.max(1, placementsRequired));
  const visibleRank = ladder?.placementComplete ? ladder.league.name : 'Unranked';

  useEffect(() => {
    if (!isVisible(rankedFeature(players)) && visiblePlayerOptions.length > 0) setPlayers(visiblePlayerOptions[0]);
  }, [isVisible, players, visiblePlayerOptions]);

  return (
    <ScreenShell scroll centered>
      <ScreenHeader
        eyebrow="Competitive Play"
        title="Ranked"
        subtitle="Nine rounds every match. Separate ladders for two, three, and four players."
        right={isOnline
          ? <Trophy size={31} color={ui.palette.gold} strokeWidth={2.6} />
          : <WifiOff size={30} color={ui.feedback.danger} strokeWidth={2.5} />}
      />

      <View style={styles.ladderTabs}>
        {visiblePlayerOptions.map(option => {
          const active = option === players;
          const optionLadder = user?.competitiveByPlayers?.[String(option) as '2' | '3' | '4'];
          const feature = entry(rankedFeature(option));
          return (
            <Pressable key={option} onPress={() => isAvailable(rankedFeature(option)) ? setPlayers(option) : showUnavailable(rankedFeature(option))} style={[styles.ladderTab, active && styles.ladderTabActive, !isAvailable(rankedFeature(option)) && styles.ladderTabLocked]}>
              <Text style={[styles.ladderTabCount, active && styles.ladderTabCountActive]}>{option}P</Text>
              <Text style={[styles.ladderTabLeague, active && styles.ladderTabLeagueActive]} numberOfLines={1}>
                {feature.testerPreview ? 'Tester Preview' : feature.state !== 'live' ? feature.title : optionLadder?.placementComplete ? optionLadder.league.name : 'Unranked'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <PremiumPanel tone="gold" style={styles.rankHero}>
        {ladder?.placementComplete
          ? <RankEmblem league={ladder.league} size={66} />
          : <View style={styles.unrankedEmblem}><ShieldCheck size={31} color={ui.text.inverse} strokeWidth={2.5} /></View>}
        <View style={styles.rankHeroCopy}>
          <Text style={styles.rankLeague}>{visibleRank}</Text>
          <Text style={styles.rankFormat}>{players}-player ladder</Text>
          <ProgressBar value={ladder?.placementComplete ? 1 : placementProgress} color={ui.text.inverse} />
          <Text style={styles.rankProgressText}>
            {ladder?.placementComplete
              ? 'Rank updates after each completed match'
              : `${placementsPlayed}/${placementsRequired} placement matches complete`}
          </Text>
        </View>
      </PremiumPanel>

      <PremiumPanel>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Your {players}P Season</Text>
            <Text style={styles.sectionMeta}>This ladder changes only through {players}-player ranked matches.</Text>
          </View>
          <StatusBadge label="9 ROUNDS" tone="gold" />
        </View>
        <View style={styles.statGrid}>
          <RankStat Icon={Trophy} label="Wins" value={String(ladder?.wins ?? 0)} />
          <RankStat Icon={Users} label="Matches" value={String(ladder?.rankedGames ?? 0)} />
          <RankStat Icon={ShieldCheck} label="Record" value={`${ladder?.wins ?? 0}W / ${ladder?.losses ?? 0}L`} />
          <RankStat Icon={Medal} label="Season Best" value={ladder?.placementComplete ? ladder.seasonBestLeague.name : 'Unranked'} />
        </View>
      </PremiumPanel>

      <View style={styles.seasonRow}>
        <CalendarDays size={18} color={ui.palette.sky} strokeWidth={2.5} />
        <Text style={styles.seasonText}>{ladder?.season.name ?? 'Ranked Season'} · {seasonDaysLeft} days remaining</Text>
        <ChevronRight size={17} color={ui.text.muted} strokeWidth={2.5} />
      </View>

      {!isOnline ? (
        <PremiumPanel>
          <Text style={styles.offlineTitle}>Ranked requires a connection</Text>
          <Text style={styles.offlineText}>Your ladder is still here. Reconnect to enter matchmaking, or continue with Offline Play.</Text>
          <ActionButton label="Open Offline Play" onPress={() => navigation.replace('OfflineMenu')} style={styles.offlineAction} />
        </PremiumPanel>
      ) : (
        <ActionButton
          label={entry(rankedFeature(players)).testerPreview ? `Preview ${players}-Player Ranked` : isAvailable(rankedFeature(players)) ? `Find ${players}-Player Ranked Match` : entry(rankedFeature(players)).title}
          Icon={Trophy}
          tone={isAvailable(rankedFeature(players)) ? 'gold' : 'ghost'}
          onPress={() => isAvailable(rankedFeature(players)) ? navigation.navigate('RankedQueue', { players }) : showUnavailable(rankedFeature(players))}
        />
      )}
    </ScreenShell>
  );
}

function rankedFeature(players: PlayerCount): FeatureKey {
  return `ranked.${players}p` as FeatureKey;
}

function RankStat({ Icon, label, value }: { Icon: typeof Trophy; label: string; value: string }) {
  return (
    <View style={styles.statItem}>
      <Icon size={18} color={ui.palette.sky} strokeWidth={2.5} />
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ladderTabs: { flexDirection: 'row', gap: 8 },
  ladderTab: { flex: 1, minHeight: 62, borderRadius: 8, borderWidth: 1, borderColor: ui.border.soft, backgroundColor: ui.surface.base, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  ladderTabActive: { borderColor: ui.palette.gold, backgroundColor: 'rgba(255, 204, 102, 0.13)' },
  ladderTabLocked: { opacity: 0.55 },
  ladderTabCount: { color: ui.text.secondary, fontSize: 16, fontWeight: '900' },
  ladderTabCountActive: { color: ui.palette.gold },
  ladderTabLeague: { color: ui.text.muted, fontSize: 10, fontWeight: '800', marginTop: 3, width: '100%', textAlign: 'center' },
  ladderTabLeagueActive: { color: ui.text.primary },
  rankHero: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  unrankedEmblem: { width: 66, height: 66, borderRadius: 8, borderWidth: 2, borderColor: ui.text.inverse, alignItems: 'center', justifyContent: 'center' },
  rankHeroCopy: { flex: 1, minWidth: 0 },
  rankLeague: { color: ui.text.inverse, fontSize: 26, fontWeight: '900' },
  rankFormat: { color: '#4D3D17', fontSize: 12, fontWeight: '900', marginTop: 2, marginBottom: 10 },
  rankProgressText: { color: '#4D3D17', fontSize: 11, fontWeight: '900', marginTop: 7 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  sectionTitle: { color: ui.text.primary, fontSize: 18, fontWeight: '900' },
  sectionMeta: { color: ui.text.secondary, fontSize: 11, fontWeight: '700', lineHeight: 16, marginTop: 4, maxWidth: 230 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statItem: { width: '48.5%', minHeight: 82, borderRadius: 8, borderWidth: 1, borderColor: ui.border.soft, backgroundColor: ui.surface.base, alignItems: 'center', justifyContent: 'center', padding: 8 },
  statValue: { color: ui.text.primary, fontSize: 17, fontWeight: '900', marginTop: 5, maxWidth: '100%' },
  statLabel: { color: ui.text.muted, fontSize: 10, fontWeight: '900', marginTop: 2, textTransform: 'uppercase' },
  seasonRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, borderTopWidth: 1, borderBottomWidth: 1, borderColor: ui.border.soft },
  seasonText: { flex: 1, color: ui.text.secondary, fontSize: 12, fontWeight: '800' },
  offlineTitle: { color: ui.palette.gold, fontSize: 18, fontWeight: '900' },
  offlineText: { color: ui.text.secondary, fontSize: 13, fontWeight: '700', lineHeight: 19, marginTop: 7 },
  offlineAction: { marginTop: 14 },
});
