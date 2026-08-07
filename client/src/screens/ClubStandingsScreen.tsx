// Purpose: Clubs-only Ranked victory standings across weekly, seasonal, and all-time periods.

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Medal, RefreshCw, Shield, Trophy, Users, WifiOff } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { ClubEmblem } from '../components/ClubEmblem';
import { useAuth } from '../context/AuthContext';
import { useConnectivity } from '../context/ConnectivityContext';
import * as api from '../services/api';
import { ActionButton, PremiumPanel, ScreenHeader, ScreenShell, StatusBadge, ui } from '../ui';
import { logError } from '../utils/logger';

type Props = NativeStackScreenProps<RootStackParamList, 'ClubStandings'>;

const PERIOD_OPTIONS: Array<{ key: api.ClubStandingPeriodKey; label: string }> = [
  { key: 'weekly', label: 'Weekly' },
  { key: 'seasonal', label: 'Seasonal' },
  { key: 'all_time', label: 'All Time' },
];

export default function ClubStandingsScreen({ navigation }: Props) {
  const { token, user } = useAuth();
  const { isOnline } = useConnectivity();
  const [period, setPeriod] = useState<api.ClubStandingPeriodKey>('weekly');
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState<api.ClubStandingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!token || !isOnline) {
      setLoading(false);
      setData(null);
      setError('');
      return () => { active = false; };
    }
    setLoading(true);
    setError('');
    api.clubStandings(token, period)
      .then(response => {
        if (active) setData(response);
      })
      .catch(caught => {
        if (!active) return;
        logError(caught, { area: 'club-standings', period });
        setData(null);
        setError(caught instanceof Error ? caught.message : 'Could not load Club Standings.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [isOnline, period, refreshKey, token]);

  return (
    <ScreenShell scroll centered>
      <ScreenHeader
        eyebrow="Ranked Competition"
        title="Club Standings"
        subtitle="See which clubs are earning the most victories in Ranked play."
        right={<Trophy size={32} color={ui.palette.gold} strokeWidth={2.6} />}
      />

      <View style={styles.periodTabs} accessibilityRole="tablist">
        {PERIOD_OPTIONS.map(option => {
          const active = period === option.key;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setPeriod(option.key)}
              style={[styles.periodTab, active && styles.periodTabActive]}
            >
              <Text style={[styles.periodTabText, active && styles.periodTabTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.listHeader}>
        <View style={styles.listHeaderCopy}>
          <Text style={styles.listEyebrow}>{data?.period.label ?? periodLabel(period)}</Text>
          <Text style={styles.listTitle}>Ranked Victories</Text>
          <Text style={styles.listMeta}>{periodDescription(data?.period ?? null, period)}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh Club Standings"
          disabled={loading || !isOnline}
          onPress={() => setRefreshKey(value => value + 1)}
          style={[styles.refreshButton, (loading || !isOnline) && styles.refreshButtonDisabled]}
        >
          <RefreshCw size={18} color={ui.text.primary} strokeWidth={2.7} />
        </Pressable>
      </View>

      {!isOnline ? (
        <StateCard Icon={WifiOff} iconColor={ui.palette.gold} title="Club Standings need a connection" text="Reconnect to load the latest server-authoritative Ranked results." />
      ) : loading ? (
        <PremiumPanel style={styles.stateCard}>
          <ActivityIndicator color={ui.palette.emerald} />
          <Text style={styles.stateTitle}>Loading Club Standings...</Text>
        </PremiumPanel>
      ) : error ? (
        <PremiumPanel style={styles.stateCard}>
          <Text style={styles.errorTitle}>Could not load standings</Text>
          <Text style={styles.stateText}>{error}</Text>
          <ActionButton label="Try Again" Icon={RefreshCw} onPress={() => setRefreshKey(value => value + 1)} style={styles.stateAction} />
        </PremiumPanel>
      ) : (
        <>
          {data?.viewer ? (
            <PremiumPanel tone="gold" style={styles.viewerCard}>
              <View style={styles.viewerIcon}><Medal size={24} color={ui.text.inverse} strokeWidth={2.8} /></View>
              <View style={styles.viewerCopy}>
                <Text style={styles.viewerEyebrow}>{data.viewer.rank ? `YOUR CLUB  #${data.viewer.rank}` : 'YOUR CLUB  UNRANKED'}</Text>
                <Text style={styles.viewerName} numberOfLines={1}>{data.viewer.name} [{data.viewer.tag}]</Text>
                <Text style={styles.viewerMeta}>{recordText(data.viewer)}</Text>
              </View>
              <VictoryTotal value={data.viewer.victories} inverse />
            </PremiumPanel>
          ) : (
            <PremiumPanel style={styles.joinCard}>
              <Users size={28} color={ui.palette.violet} strokeWidth={2.6} />
              <View style={styles.joinCopy}>
                <Text style={styles.joinTitle}>Join a club to compete</Text>
                <Text style={styles.joinText}>You can browse every club now. Join one to begin contributing Ranked victories.</Text>
              </View>
              <ActionButton label="Find a Club" Icon={Users} tone="secondary" onPress={() => navigation.navigate('Club')} style={styles.joinAction} />
            </PremiumPanel>
          )}

          {data?.entries.length ? (
            <View style={styles.rankList}>
              {data.entries.map(entry => (
                <ClubStandingRow key={entry.clubId} entry={entry} highlighted={entry.clubId === user?.club?.clubId} />
              ))}
            </View>
          ) : (
            <StateCard Icon={Trophy} iconColor={ui.text.muted} title="No qualifying results yet" text="Completed Ranked matches will place clubs on this board as members earn victories." />
          )}
        </>
      )}

      <PremiumPanel style={styles.rulesCard}>
        <View style={styles.rulesHeader}>
          <View>
            <Text style={styles.rulesEyebrow}>HOW IT WORKS</Text>
            <Text style={styles.rulesTitle}>{data?.criteria.label ?? 'Ranked Victories'}</Text>
          </View>
          <StatusBadge label="RANKED ONLY" tone="emerald" />
        </View>
        {(data?.criteria.rules ?? fallbackRules()).map(rule => (
          <View key={rule} style={styles.ruleRow}>
            <View style={styles.ruleDot} />
            <Text style={styles.ruleText}>{rule}</Text>
          </View>
        ))}
      </PremiumPanel>
    </ScreenShell>
  );
}

function ClubStandingRow({ entry, highlighted }: { entry: api.ClubStandingEntry; highlighted: boolean }) {
  return (
    <PremiumPanel style={[styles.rankRow, highlighted && styles.rankRowHighlighted]}>
      <RankMark rank={entry.rank} />
      {entry.branding
        ? <ClubEmblem branding={entry.branding} tag={entry.tag} size={45} />
        : <View style={styles.clubFallback}><Shield size={21} color={ui.palette.violet} strokeWidth={2.6} /></View>}
      <View style={styles.rankCopy}>
        <View style={styles.rankNameRow}>
          <Text style={styles.rankName} numberOfLines={1}>{entry.name}</Text>
          <Text style={styles.clubTag}>[{entry.tag}]</Text>
        </View>
        <Text style={styles.rankMeta}>{recordText(entry)}</Text>
        <Text style={styles.clubMeta}>Club Lv {entry.level} · {entry.memberCount} members</Text>
      </View>
      <VictoryTotal value={entry.victories} />
    </PremiumPanel>
  );
}

function StateCard({ Icon, iconColor, title, text }: { Icon: typeof Trophy; iconColor: string; title: string; text: string }) {
  return (
    <PremiumPanel style={styles.stateCard}>
      <Icon size={30} color={iconColor} strokeWidth={2.5} />
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateText}>{text}</Text>
    </PremiumPanel>
  );
}

function RankMark({ rank }: { rank: number | null }) {
  const color = rank === 1 ? ui.palette.gold : rank === 2 ? ui.text.secondary : rank === 3 ? '#D99A6C' : ui.text.muted;
  return (
    <View style={[styles.rankMark, { borderColor: color }]}>
      <Text style={[styles.rankMarkText, { color }]}>{rank ?? '—'}</Text>
    </View>
  );
}

function VictoryTotal({ value, inverse = false }: { value: number; inverse?: boolean }) {
  return (
    <View style={styles.victoryTotal}>
      <Text style={[styles.victoryValue, inverse && styles.victoryValueInverse]}>{value.toLocaleString()}</Text>
      <Text style={[styles.victoryLabel, inverse && styles.victoryLabelInverse]}>{value === 1 ? 'VICTORY' : 'VICTORIES'}</Text>
    </View>
  );
}

function recordText(entry: api.ClubStandingEntry) {
  return `${entry.rankedResults} Ranked result${entry.rankedResults === 1 ? '' : 's'} · ${entry.winRate}% win rate`;
}

function periodLabel(period: api.ClubStandingPeriodKey) {
  if (period === 'seasonal') return 'Current Season';
  if (period === 'all_time') return 'All Time';
  return 'This Week';
}

function periodDescription(window: api.ClubStandingPeriod | null, period: api.ClubStandingPeriodKey) {
  if (period === 'all_time') return 'Every qualifying Ranked result on record.';
  if (!window?.endsAt) return period === 'seasonal' ? 'Current competitive season.' : 'Monday through Sunday, UTC.';
  const end = new Date(window.endsAt);
  return `Ends ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: period === 'seasonal' ? 'numeric' : undefined })}`;
}

function fallbackRules() {
  return [
    'Each winning member contributes one victory to their club.',
    'Tied winners each contribute one victory.',
    'Forfeited and AFK-penalized results cannot contribute victories.',
    'Club membership is recorded when the Ranked match begins.',
  ];
}

const styles = StyleSheet.create({
  periodTabs: { minHeight: 44, flexDirection: 'row', gap: 7, padding: 4, borderRadius: 9, backgroundColor: ui.surface.base, borderWidth: 1, borderColor: ui.border.soft },
  periodTab: { flex: 1, borderRadius: 7, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  periodTabActive: { backgroundColor: ui.surface.raised, borderWidth: 1, borderColor: ui.palette.sky },
  periodTabText: { color: ui.text.muted, fontSize: 11, fontWeight: '900' },
  periodTabTextActive: { color: ui.palette.sky },
  listHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  listHeaderCopy: { flex: 1, minWidth: 0 },
  listEyebrow: { color: ui.palette.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  listTitle: { color: ui.text.primary, fontSize: 22, fontWeight: '900', marginTop: 2 },
  listMeta: { color: ui.text.muted, fontSize: 11, fontWeight: '700', marginTop: 3 },
  refreshButton: { width: 42, height: 42, borderRadius: 9, borderWidth: 1, borderColor: ui.border.strong, backgroundColor: ui.surface.raised, alignItems: 'center', justifyContent: 'center' },
  refreshButtonDisabled: { opacity: 0.45 },
  stateCard: { minHeight: 174, alignItems: 'center', justifyContent: 'center', paddingVertical: 26 },
  stateTitle: { color: ui.text.primary, fontSize: 18, fontWeight: '900', textAlign: 'center', marginTop: 12 },
  errorTitle: { color: ui.feedback.danger, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  stateText: { color: ui.text.secondary, fontSize: 12, fontWeight: '700', lineHeight: 18, textAlign: 'center', maxWidth: 310, marginTop: 7 },
  stateAction: { alignSelf: 'stretch', marginTop: 17 },
  viewerCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  viewerIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(26, 41, 67, 0.16)', alignItems: 'center', justifyContent: 'center' },
  viewerCopy: { flex: 1, minWidth: 0 },
  viewerEyebrow: { color: '#594817', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  viewerName: { color: ui.text.inverse, fontSize: 16, fontWeight: '900', marginTop: 3 },
  viewerMeta: { color: '#594817', fontSize: 9, fontWeight: '800', marginTop: 3 },
  joinCard: { alignItems: 'center' },
  joinCopy: { alignItems: 'center', marginTop: 7 },
  joinTitle: { color: ui.text.primary, fontSize: 17, fontWeight: '900' },
  joinText: { color: ui.text.secondary, fontSize: 11, fontWeight: '700', lineHeight: 17, textAlign: 'center', marginTop: 5 },
  joinAction: { alignSelf: 'stretch', marginTop: 14 },
  rankList: { gap: 8 },
  rankRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  rankRowHighlighted: { borderColor: ui.palette.gold, backgroundColor: 'rgba(244, 201, 93, 0.08)' },
  rankMark: { width: 31, height: 31, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  rankMarkText: { fontSize: 12, fontWeight: '900' },
  clubFallback: { width: 45, height: 45, borderRadius: 23, borderWidth: 2, borderColor: ui.palette.violet, backgroundColor: ui.surface.raised, alignItems: 'center', justifyContent: 'center' },
  rankCopy: { flex: 1, minWidth: 0 },
  rankNameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  rankName: { flexShrink: 1, color: ui.text.primary, fontSize: 14, fontWeight: '900' },
  clubTag: { color: ui.palette.violet, fontSize: 10, fontWeight: '900' },
  rankMeta: { color: ui.text.secondary, fontSize: 10, fontWeight: '700', marginTop: 4 },
  clubMeta: { color: ui.palette.sky, fontSize: 9, fontWeight: '900', marginTop: 3, textTransform: 'uppercase' },
  victoryTotal: { minWidth: 60, alignItems: 'flex-end' },
  victoryValue: { color: ui.palette.gold, fontSize: 18, fontWeight: '900' },
  victoryLabel: { color: ui.text.muted, fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  victoryValueInverse: { color: ui.text.inverse },
  victoryLabelInverse: { color: '#594817' },
  rulesCard: { marginTop: 4 },
  rulesHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  rulesEyebrow: { color: ui.palette.emerald, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  rulesTitle: { color: ui.text.primary, fontSize: 17, fontWeight: '900', marginTop: 2 },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 7 },
  ruleDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: ui.palette.emerald, marginTop: 6 },
  ruleText: { flex: 1, color: ui.text.secondary, fontSize: 11, fontWeight: '700', lineHeight: 17 },
});
