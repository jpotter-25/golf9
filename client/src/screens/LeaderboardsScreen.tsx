// src/screens/LeaderboardsScreen.tsx
// Purpose: Server-authoritative individual, club, and in-club standings across weekly, seasonal, and all-time periods.

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarDays, Medal, RefreshCw, Shield, Trophy, UserRound, Users, WifiOff } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { ClubEmblem } from '../components/ClubEmblem';
import { useAuth } from '../context/AuthContext';
import { useConnectivity } from '../context/ConnectivityContext';
import * as api from '../services/api';
import { ActionButton, PremiumPanel, ScreenHeader, ScreenShell, StatusBadge, ui } from '../ui';
import { logError } from '../utils/logger';

type Props = NativeStackScreenProps<RootStackParamList, 'Leaderboards'>;

const SCOPE_OPTIONS: Array<{ key: api.LeaderboardScope; label: string; Icon: typeof Trophy }> = [
  { key: 'individual', label: 'Individual', Icon: UserRound },
  { key: 'clubs', label: 'Clubs', Icon: Shield },
  { key: 'club_members', label: 'My Club', Icon: Users },
];

const PERIOD_OPTIONS: Array<{ key: api.LeaderboardPeriodKey; label: string }> = [
  { key: 'weekly', label: 'Weekly' },
  { key: 'seasonal', label: 'Seasonal' },
  { key: 'all_time', label: 'All Time' },
];

export default function LeaderboardsScreen({ navigation }: Props) {
  const { token, user } = useAuth();
  const { isOnline } = useConnectivity();
  const [scope, setScope] = useState<api.LeaderboardScope>('individual');
  const [period, setPeriod] = useState<api.LeaderboardPeriodKey>('weekly');
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState<api.LeaderboardResponse | null>(null);
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
    api.leaderboard(token, scope, period)
      .then(response => {
        if (!active) return;
        setData(response);
      })
      .catch(caught => {
        if (!active) return;
        logError(caught, { area: 'leaderboards', scope, period });
        setData(null);
        setError(caught instanceof Error ? caught.message : 'Could not load the leaderboard.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [isOnline, period, refreshKey, scope, token]);

  const viewerId = data?.scope === 'clubs' ? user?.club?.clubId : user?.userId;
  const scopeLabel = SCOPE_OPTIONS.find(option => option.key === scope)?.label ?? 'Individual';

  return (
    <ScreenShell scroll centered>
      <ScreenHeader
        eyebrow="Competition"
        title="Leaderboards"
        subtitle="Track online performance across players, clubs, and the members of your club."
        right={<Trophy size={32} color={ui.palette.gold} strokeWidth={2.6} />}
      />

      <View style={styles.scopeTabs} accessibilityRole="tablist">
        {SCOPE_OPTIONS.map(option => {
          const active = scope === option.key;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setScope(option.key)}
              style={[styles.scopeTab, active && styles.scopeTabActive]}
            >
              <option.Icon size={18} color={active ? ui.palette.gold : ui.text.muted} strokeWidth={2.6} />
              <Text style={[styles.scopeTabText, active && styles.scopeTabTextActive]} numberOfLines={1}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

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
          <Text style={styles.listTitle}>{scopeLabel} Standings</Text>
          <Text style={styles.listMeta}>{periodDescription(data?.period ?? null, period)}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh leaderboard"
          disabled={loading || !isOnline}
          onPress={() => setRefreshKey(value => value + 1)}
          style={[styles.refreshButton, (loading || !isOnline) && styles.refreshButtonDisabled]}
        >
          <RefreshCw size={18} color={ui.text.primary} strokeWidth={2.7} />
        </Pressable>
      </View>

      {!isOnline ? (
        <PremiumPanel style={styles.stateCard}>
          <WifiOff size={30} color={ui.palette.gold} strokeWidth={2.5} />
          <Text style={styles.stateTitle}>Leaderboards need a connection</Text>
          <Text style={styles.stateText}>Reconnect to load the latest server-authoritative standings.</Text>
        </PremiumPanel>
      ) : loading ? (
        <PremiumPanel style={styles.stateCard}>
          <ActivityIndicator color={ui.palette.emerald} />
          <Text style={styles.stateTitle}>Loading standings...</Text>
        </PremiumPanel>
      ) : error ? (
        <PremiumPanel style={styles.stateCard}>
          <Text style={styles.errorTitle}>Could not load standings</Text>
          <Text style={styles.stateText}>{error}</Text>
          <ActionButton label="Try Again" Icon={RefreshCw} onPress={() => setRefreshKey(value => value + 1)} style={styles.stateAction} />
        </PremiumPanel>
      ) : scope === 'club_members' && !data?.subject ? (
        <PremiumPanel style={styles.stateCard}>
          <Users size={31} color={ui.palette.violet} strokeWidth={2.5} />
          <Text style={styles.stateTitle}>Join a club to unlock this board</Text>
          <Text style={styles.stateText}>Once you join, this view ranks only the current members of your club.</Text>
          <ActionButton label="Find a Club" Icon={Users} tone="secondary" onPress={() => navigation.navigate('Club')} style={styles.stateAction} />
        </PremiumPanel>
      ) : (
        <>
          {data?.viewer ? (
            <PremiumPanel tone="gold" style={styles.viewerCard}>
              <View style={styles.viewerIcon}><Medal size={24} color={ui.text.inverse} strokeWidth={2.8} /></View>
              <View style={styles.viewerCopy}>
                <Text style={styles.viewerEyebrow}>{data.viewer.rank ? `YOUR POSITION  #${data.viewer.rank}` : 'YOUR POSITION  UNRANKED'}</Text>
                <Text style={styles.viewerName} numberOfLines={1}>{entryName(data.viewer)}</Text>
              </View>
              <View style={styles.viewerScore}>
                <Text style={styles.viewerScoreValue}>{data.viewer.score.toLocaleString()}</Text>
                <Text style={styles.viewerScoreLabel}>LP</Text>
              </View>
            </PremiumPanel>
          ) : null}

          {data?.entries.length ? (
            <View style={styles.rankList}>
              {data.scope === 'clubs'
                ? data.entries.map(entry => (
                  <ClubRankRow key={entry.clubId} entry={entry} highlighted={entry.clubId === viewerId} />
                ))
                : data.entries.map(entry => (
                  <PlayerRankRow
                    key={entry.userId}
                    entry={entry}
                    highlighted={entry.userId === viewerId}
                    onPress={() => navigation.navigate('PlayerProfile', { userId: entry.userId })}
                  />
                ))}
            </View>
          ) : (
            <PremiumPanel style={styles.stateCard}>
              <Trophy size={31} color={ui.text.muted} strokeWidth={2.4} />
              <Text style={styles.stateTitle}>No qualifying matches yet</Text>
              <Text style={styles.stateText}>Completed online matches will appear here. Offline play and forfeits never add leaderboard points.</Text>
            </PremiumPanel>
          )}
        </>
      )}

      <PremiumPanel style={styles.scoringCard}>
        <View style={styles.scoringHeader}>
          <View>
            <Text style={styles.scoringEyebrow}>SCORING</Text>
            <Text style={styles.scoringTitle}>{data?.scoring.label ?? 'Leaderboard Points'}</Text>
          </View>
          <StatusBadge label="ONLINE ONLY" tone="emerald" />
        </View>
        {(data?.scoring.rules ?? fallbackRules()).map(rule => (
          <View key={rule} style={styles.ruleRow}>
            <View style={styles.ruleDot} />
            <Text style={styles.ruleText}>{rule}</Text>
          </View>
        ))}
      </PremiumPanel>
    </ScreenShell>
  );
}

function PlayerRankRow({ entry, highlighted, onPress }: { entry: api.LeaderboardUserEntry; highlighted: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`View ${entry.displayName}`}>
      <PremiumPanel style={[styles.rankRow, highlighted && styles.rankRowHighlighted]}>
        <RankMark rank={entry.rank} />
        <View style={styles.avatar}><Text style={styles.avatarText}>{entry.avatarInitial}</Text></View>
        <View style={styles.rankCopy}>
          <View style={styles.rankNameRow}>
            <Text style={styles.rankName} numberOfLines={1}>{entry.displayName}</Text>
            {entry.club?.tag ? <Text style={styles.clubTag}>[{entry.club.tag}]</Text> : null}
          </View>
          <Text style={styles.rankMeta}>{entry.wins} wins · {entry.matches} matches · {entry.winRate}% win rate</Text>
          {entry.role ? <Text style={styles.memberRole}>{capitalize(entry.role)}</Text> : null}
        </View>
        <Score value={entry.score} />
      </PremiumPanel>
    </Pressable>
  );
}

function ClubRankRow({ entry, highlighted }: { entry: api.LeaderboardClubEntry; highlighted: boolean }) {
  return (
    <PremiumPanel style={[styles.rankRow, highlighted && styles.rankRowHighlighted]}>
      <RankMark rank={entry.rank} />
      {entry.branding
        ? <ClubEmblem branding={entry.branding} tag={entry.tag} size={45} />
        : <View style={styles.avatar}><Shield size={21} color={ui.palette.violet} strokeWidth={2.6} /></View>}
      <View style={styles.rankCopy}>
        <View style={styles.rankNameRow}>
          <Text style={styles.rankName} numberOfLines={1}>{entry.name}</Text>
          <Text style={styles.clubTag}>[{entry.tag}]</Text>
        </View>
        <Text style={styles.rankMeta}>{entry.wins} wins · {entry.matches} member matches</Text>
        <Text style={styles.memberRole}>Club Lv {entry.level} · {entry.memberCount} members</Text>
      </View>
      <Score value={entry.score} />
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

function Score({ value }: { value: number }) {
  return (
    <View style={styles.score}>
      <Text style={styles.scoreValue}>{value.toLocaleString()}</Text>
      <Text style={styles.scoreLabel}>LP</Text>
    </View>
  );
}

function entryName(entry: api.LeaderboardUserEntry | api.LeaderboardClubEntry) {
  return 'displayName' in entry ? entry.displayName : entry.name;
}

function periodLabel(period: api.LeaderboardPeriodKey) {
  if (period === 'seasonal') return 'Current Season';
  if (period === 'all_time') return 'All Time';
  return 'This Week';
}

function periodDescription(window: api.LeaderboardPeriod | null, period: api.LeaderboardPeriodKey) {
  if (period === 'all_time') return 'Every qualifying online match on record.';
  if (!window?.endsAt) return period === 'seasonal' ? 'Current competitive season.' : 'Monday through Sunday, UTC.';
  const end = new Date(window.endsAt);
  return `Ends ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: period === 'seasonal' ? 'numeric' : undefined })}`;
}

function fallbackRules() {
  return [
    '100 LP for completing an online match.',
    '100 bonus LP for a win.',
    'Up to 60 bonus LP for a low final total.',
    '50 bonus LP for Ranked or 25 bonus LP for a Wager table.',
    'Forfeits and offline matches award no LP.',
  ];
}

function capitalize(value: string) {
  return value ? value.slice(0, 1).toUpperCase() + value.slice(1) : '';
}

const styles = StyleSheet.create({
  scopeTabs: { flexDirection: 'row', gap: 8 },
  scopeTab: { flex: 1, minHeight: 61, borderRadius: 9, borderWidth: 1, borderColor: ui.border.soft, backgroundColor: ui.surface.base, alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 5 },
  scopeTabActive: { borderColor: ui.palette.gold, backgroundColor: 'rgba(244, 201, 93, 0.12)' },
  scopeTabText: { color: ui.text.muted, fontSize: 11, fontWeight: '900' },
  scopeTabTextActive: { color: ui.text.primary },
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
  viewerName: { color: ui.text.inverse, fontSize: 17, fontWeight: '900', marginTop: 3 },
  viewerScore: { alignItems: 'flex-end' },
  viewerScoreValue: { color: ui.text.inverse, fontSize: 22, fontWeight: '900' },
  viewerScoreLabel: { color: '#594817', fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  rankList: { gap: 8 },
  rankRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  rankRowHighlighted: { borderColor: ui.palette.gold, backgroundColor: 'rgba(244, 201, 93, 0.08)' },
  rankMark: { width: 31, height: 31, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  rankMarkText: { fontSize: 12, fontWeight: '900' },
  avatar: { width: 45, height: 45, borderRadius: 23, borderWidth: 2, borderColor: ui.palette.emerald, backgroundColor: ui.surface.raised, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: ui.palette.emerald, fontSize: 18, fontWeight: '900' },
  rankCopy: { flex: 1, minWidth: 0 },
  rankNameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  rankName: { flexShrink: 1, color: ui.text.primary, fontSize: 14, fontWeight: '900' },
  clubTag: { color: ui.palette.violet, fontSize: 10, fontWeight: '900' },
  rankMeta: { color: ui.text.secondary, fontSize: 10, fontWeight: '700', marginTop: 4 },
  memberRole: { color: ui.palette.sky, fontSize: 9, fontWeight: '900', marginTop: 3, textTransform: 'uppercase' },
  score: { minWidth: 52, alignItems: 'flex-end' },
  scoreValue: { color: ui.palette.gold, fontSize: 17, fontWeight: '900' },
  scoreLabel: { color: ui.text.muted, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  scoringCard: { marginTop: 4 },
  scoringHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  scoringEyebrow: { color: ui.palette.emerald, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  scoringTitle: { color: ui.text.primary, fontSize: 17, fontWeight: '900', marginTop: 2 },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 7 },
  ruleDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: ui.palette.emerald, marginTop: 6 },
  ruleText: { flex: 1, color: ui.text.secondary, fontSize: 11, fontWeight: '700', lineHeight: 17 },
});
