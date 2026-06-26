// client/src/screens/RankedQueueScreen.tsx
// Purpose: Premium ranked matchmaking queue with season/rank context.

import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, Radar, Shield, Sparkles, Trophy, Users, type LucideIcon } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import { ActionButton, PremiumPanel, ProgressBar, ScreenHeader, ScreenShell, StatusBadge, ui } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'RankedQueue'>;

export default function RankedQueueScreen({ route, navigation }: Props) {
  const { players } = route.params;
  const rounds = 9;
  const { token, user, refreshProfile } = useAuth();
  const [competitive, setCompetitive] = useState<api.CompetitiveState | null>(user?.competitive ?? null);
  const [queue, setQueue] = useState<api.RankedQueueStatus | null>(null);
  const [busy, setBusy] = useState(true);
  const [now, setNow] = useState(Date.now());
  const matchedRef = useRef(false);

  useEffect(() => {
    if (!token) return;
    let active = true;

    const handle = (response: { competitive: api.CompetitiveState; queue: api.RankedQueueStatus }) => {
      if (!active) return;
      setCompetitive(response.competitive);
      setQueue(response.queue);
      if (response.queue.matchedRoomCode && !matchedRef.current) {
        matchedRef.current = true;
        navigation.replace('OnlineRoom', {
          players,
          rounds,
          joinCode: response.queue.matchedRoomCode,
          ranked: true,
        });
      }
    };

    api.joinRankedQueue(token, players)
      .then(handle)
      .catch(error => {
        Alert.alert('Ranked queue failed', error instanceof Error ? error.message : 'Try again.');
        navigation.goBack();
      })
      .finally(() => active && setBusy(false));

    const interval = setInterval(() => {
      setNow(Date.now());
      api.rankedQueueStatus(token).then(handle).catch(() => {});
    }, 1000);

    return () => {
      active = false;
      clearInterval(interval);
      if (!matchedRef.current) api.cancelRankedQueue(token).catch(() => {});
    };
  }, [navigation, players, token]);

  const cancel = async () => {
    if (!token) return;
    try {
      await api.cancelRankedQueue(token);
    } finally {
      navigation.goBack();
    }
  };

  const claimRewards = async () => {
    if (!token) return;
    setBusy(true);
    try {
      const response = await api.claimRankedSeasonRewards(token);
      setCompetitive(response.competitive);
      await refreshProfile();
      Alert.alert(
        response.granted.length ? 'Ranked shop unlocked' : 'No unlocks waiting',
        response.granted.length
          ? response.granted.map(item => `${item.name} is now available in the shop.`).join('\n')
          : 'Reach a higher league to unlock more ranked cosmetics.'
      );
    } catch (error) {
      Alert.alert('Claim failed', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const league = competitive?.league.name ?? 'Silver III';
  const mmr = competitive?.mmr ?? 1000;
  const placementsRemaining = competitive?.placementsRemaining ?? 5;
  const waitedSeconds = queue?.joinedAt ? Math.floor((now - queue.joinedAt) / 1000) : 0;
  const seasonDaysLeft = competitive?.season?.endsAt
    ? Math.max(0, Math.ceil((competitive.season.endsAt - now) / (24 * 60 * 60 * 1000)))
    : 90;
  const claimableCount = competitive?.season.rewards.filter(item => item.earned && !item.claimed).length ?? 0;
  const placementProgress = Math.max(0, Math.min(1, 1 - placementsRemaining / (competitive?.placementMatchesRequired ?? 5)));

  return (
    <ScreenShell scroll centered>
      <ScreenHeader
        eyebrow="Ranked Match"
        title={`${players}-Player Ranked`}
        subtitle={`${league} - ${mmr} MMR - always 9 rounds`}
        right={<StatusBadge label={queue?.matchedRoomCode ? 'FOUND' : 'SEARCHING'} tone={queue?.matchedRoomCode ? 'gold' : 'sky'} />}
      />

      <PremiumPanel tone="gold">
        <View style={styles.rankHero}>
          <Shield size={34} color={ui.text.inverse} strokeWidth={2.6} />
          <View style={styles.rankCopy}>
            <Text style={styles.rankTitle}>{league}</Text>
            <Text style={styles.rankMeta}>{competitive?.placementComplete ? 'Ranked ladder' : `${placementsRemaining} placements remaining`}</Text>
          </View>
        </View>
        <ProgressBar value={competitive?.placementComplete ? 1 : placementProgress} color={ui.text.inverse} />
      </PremiumPanel>

      <PremiumPanel>
        <MetricRow Icon={Users} label="Queue" value={`${players} players - 9 rounds`} />
        <MetricRow Icon={Trophy} label="Entry" value="Free ladder match" />
        <MetricRow Icon={Radar} label="Search" value={`+/- ${queue?.searchRange ?? 100} MMR`} />
        <MetricRow Icon={Sparkles} label="Waiting" value={`${waitedSeconds}s`} />
        <MetricRow Icon={Users} label="Found" value={`${queue?.queuedPlayers ?? 1}/${players}`} />
      </PremiumPanel>

      <PremiumPanel tone="felt">
        <Text style={styles.statusTitle}>{queue?.matchedRoomCode ? 'Match found' : busy ? 'Entering queue...' : 'Finding opponents'}</Text>
        <Text style={styles.statusText}>
          {placementsRemaining > 0
            ? `${placementsRemaining} placement match${placementsRemaining === 1 ? '' : 'es'} remaining.`
            : `Season best: ${competitive?.seasonBestLeague.name ?? league}.`}
        </Text>
      </PremiumPanel>

      <PremiumPanel>
        <View style={styles.rewardHeader}>
          <View>
          <Text style={styles.rewardTitle}>Season 1</Text>
            <Text style={styles.rewardText}>{seasonDaysLeft} days left - unlock prestige shop access</Text>
          </View>
          <StatusBadge label={`${claimableCount} Ready`} tone={claimableCount ? 'gold' : 'muted'} />
        </View>
        <ActionButton
          label={claimableCount ? `Unlock ${claimableCount} Shop Item${claimableCount === 1 ? '' : 's'}` : 'No Shop Unlocks Ready'}
          tone="gold"
          Icon={Trophy}
          disabled={!claimableCount || busy}
          onPress={claimRewards}
        />
      </PremiumPanel>

      <ActionButton label="Cancel Search" Icon={ChevronLeft} tone="danger" onPress={cancel} />
    </ScreenShell>
  );
}

function MetricRow({ Icon, label, value }: { Icon: LucideIcon; label: string; value: string }) {
  return (
    <View style={styles.metricRow}>
      <View style={styles.metricLabelWrap}>
        <Icon size={17} color={ui.palette.sky} strokeWidth={2.5} />
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rankHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  rankCopy: { flex: 1, minWidth: 0 },
  rankTitle: { color: ui.text.inverse, fontSize: 25, fontWeight: '900' },
  rankMeta: { color: '#4D3D17', fontSize: 13, fontWeight: '900', marginTop: 3 },
  metricRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: ui.border.soft,
  },
  metricLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metricLabel: { color: ui.text.muted, fontWeight: '900' },
  metricValue: { color: ui.text.primary, fontWeight: '900' },
  statusTitle: { color: ui.palette.emerald, fontWeight: '900', fontSize: 20, textAlign: 'center' },
  statusText: { color: ui.text.secondary, fontWeight: '800', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  rewardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  rewardTitle: { color: ui.palette.gold, fontWeight: '900', fontSize: 18 },
  rewardText: { color: ui.text.secondary, fontWeight: '800', marginTop: 3 },
});
