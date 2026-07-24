// client/src/screens/PlayerProfileScreen.tsx
// Purpose: Public player profile view for friends, recent players, and in-game taps.

import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ShoppingBag } from 'lucide-react-native';
import type { RootStackParamList } from '../App';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import { PlayerAvatar } from '../components/PlayerAvatar';

type Props = NativeStackScreenProps<RootStackParamList, 'PlayerProfile'>;

export default function PlayerProfileScreen({ route, navigation }: Props) {
  const { token, user } = useAuth();
  const [profile, setProfile] = useState<api.PublicPlayerProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const openedFromActiveMatch = !!route.params.fromActiveMatchRoomCode;

  const load = useCallback(async () => {
    if (!token) return;
    const response = await api.publicProfile(token, route.params.userId);
    setProfile(response.profile);
  }, [route.params.userId, token]);

  useFocusEffect(useCallback(() => {
    load().catch(() => setProfile(null));
  }, [load]));

  const runAction = async (action: () => Promise<void>) => {
    if (!token || busy) return;
    setBusy(true);
    try {
      await action();
      await load();
    } catch (error) {
      Alert.alert('Profile update failed', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const onPrimaryAction = () => {
    if (!token || !profile) return;
    if (profile.relationship === 'none') {
      runAction(async () => { await api.sendFriendRequest(token, profile.userId); });
    } else if (profile.relationship === 'friend') {
      runAction(async () => { await api.removeFriend(token, profile.userId); });
    } else if (profile.relationship === 'incoming') {
      runAction(async () => {
        const social = await api.socialMe(token);
        const request = social.social.incomingRequests.find(item => item.player.userId === profile.userId);
        if (!request) throw new Error('Friend request not found.');
        await api.acceptFriendRequest(token, request.id);
      });
    }
  };

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading profile...</Text>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const primaryLabel = profile.relationship === 'self'
    ? 'Your Profile'
    : profile.relationship === 'friend'
      ? 'Remove Friend'
      : profile.relationship === 'incoming'
        ? 'Accept Friend'
        : profile.relationship === 'outgoing'
          ? 'Request Sent'
          : 'Add Friend';
  const canPressPrimary = profile.relationship !== 'self' && profile.relationship !== 'outgoing';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        {openedFromActiveMatch ? null : (
          <View style={styles.topActions}>
            <PlayerAvatar cosmetics={user?.inventory.equipped} fallbackInitial={user?.avatarInitial ?? '?'} size={40} onPress={() => navigation.navigate('Profile')} />
            <Pressable style={styles.topShopButton} onPress={() => navigation.navigate('Shop')}>
              <ShoppingBag size={18} color="#F4C95D" strokeWidth={2.8} />
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.hero}>
        <PlayerAvatar cosmetics={profile.cosmetics} fallbackInitial={profile.avatarInitial} size={78} />
        <View style={styles.heroCopy}>
          <Text style={styles.name} numberOfLines={1}>{profile.displayName}</Text>
          <Text style={styles.meta}>Level {profile.progression.level} - {profile.competitive.league.name}</Text>
          {profile.club ? (
            <Text style={styles.clubLine} numberOfLines={1}>[{profile.club.tag}] {profile.club.name}</Text>
          ) : null}
          <Text style={styles.status}>{profile.status.online ? 'Online' : 'Offline'}{profile.status.inRoom ? ' - In a room' : ''}</Text>
        </View>
      </View>

      <Pressable
        style={[styles.primaryButton, !canPressPrimary && styles.disabled, profile.relationship === 'friend' && styles.dangerButton]}
        disabled={!canPressPrimary || busy}
        onPress={onPrimaryAction}
      >
        <Text style={[styles.primaryButtonText, profile.relationship === 'friend' && styles.dangerButtonText]}>
          {busy ? 'Working...' : primaryLabel}
        </Text>
      </Pressable>

      <View style={styles.statGrid}>
        <Stat label="Games" value={String(profile.statistics.gamesPlayed)} />
        <Stat label="Wins" value={String(profile.statistics.wins)} />
        <Stat label="Best Total" value={formatNullable(profile.statistics.bestTotal)} />
        <Stat label="Best Round" value={formatNullable(profile.statistics.bestRound)} />
        <Stat label="Clears" value={String(profile.statistics.columnClears)} />
        <Stat label="Ranked" value={String(profile.competitive.rankedGames)} />
      </View>

      <SectionTitle title="Ranked" />
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>{profile.competitive.league.name}</Text>
        <Text style={styles.infoMeta}>{profile.competitive.wins}W / {profile.competitive.losses}L</Text>
        <Text style={styles.infoMeta}>Season best: {profile.competitive.seasonBestLeague.name}</Text>
      </View>

      <SectionTitle title="Recent Achievements" />
      {profile.achievements.length ? profile.achievements.slice(0, 5).map(item => (
        <View key={item.id} style={styles.rowItem}>
          <Text style={styles.rowTitle}>{item.name}</Text>
          <Text style={styles.rowMeta}>{item.description}</Text>
        </View>
      )) : <Empty text="No achievements unlocked yet." />}

      <SectionTitle title="Recent Matches" />
      {profile.recentMatches.length ? profile.recentMatches.map(match => (
        <View key={match.resultId} style={styles.rowItem}>
          <Text style={styles.rowTitle}>{match.won ? 'Win' : 'Played'} - {formatMatchType(match.matchType)}</Text>
          <Text style={styles.rowMeta}>{formatDate(match.completedAt)} - Total {match.total} - {match.playerCount} players</Text>
        </View>
      )) : <Empty text="No completed matches yet." />}

      {user?.userId === profile.userId ? (
        <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('Profile')}>
          <Text style={styles.secondaryButtonText}>Open Full Profile</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function Empty({ text }: { text: string }) {
  return <Text style={styles.emptyText}>{text}</Text>;
}

function formatNullable(value: number | null | undefined) {
  return typeof value === 'number' ? String(value) : '--';
}

function formatDate(value: number) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatMatchType(value: string) {
  if (value === 'ranked') return 'Ranked';
  if (value === 'wager') return 'Wager';
  if (value === 'solo') return 'Solo';
  if (value === 'passplay') return 'Pass & Play';
  return 'Casual';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A2943' },
  content: { padding: 16, paddingTop: 54, paddingBottom: 34 },
  center: { flex: 1, backgroundColor: '#1A2943', alignItems: 'center', justifyContent: 'center', padding: 18 },
  loadingText: { color: '#F7FAFC', fontWeight: '900', fontSize: 18, marginBottom: 14 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  backButton: { borderWidth: 1, borderColor: '#435C7D', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  backText: { color: '#A9B9CD', fontWeight: '900' },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: '#67E0B0',
    backgroundColor: '#205E56',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topAvatarText: { color: '#F7FAFC', fontWeight: '900', fontSize: 15 },
  topShopButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#9F7A2C',
    backgroundColor: 'rgba(255, 204, 102, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#F7FAFC', fontSize: 38, fontWeight: '900' },
  heroCopy: { flex: 1, minWidth: 0 },
  name: { color: '#F7FAFC', fontSize: 30, fontWeight: '900' },
  meta: { color: '#67E0B0', fontSize: 14, fontWeight: '900', marginTop: 4 },
  clubLine: { color: '#F4C95D', fontSize: 13, fontWeight: '900', marginTop: 4 },
  status: { color: '#A9B9CD', fontSize: 13, fontWeight: '800', marginTop: 4 },
  primaryButton: { backgroundColor: '#67E0B0', borderRadius: 8, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  primaryButtonText: { color: '#1A2943', fontSize: 15, fontWeight: '900' },
  dangerButton: { backgroundColor: 'transparent', borderWidth: 2, borderColor: '#FF6B6B' },
  dangerButtonText: { color: '#FF6B6B' },
  secondaryButton: {
    borderWidth: 2,
    borderColor: '#67B7FF',
    borderRadius: 8,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  secondaryButtonText: { color: '#67B7FF', fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  stat: {
    width: '31.5%',
    minHeight: 74,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#435C7D',
    backgroundColor: '#243655',
    justifyContent: 'center',
    padding: 10,
  },
  statValue: { color: '#F7FAFC', fontSize: 22, fontWeight: '900' },
  statLabel: { color: '#A9B9CD', fontSize: 11, fontWeight: '800', marginTop: 4 },
  sectionTitle: { color: '#F7FAFC', fontSize: 18, fontWeight: '900', marginTop: 10, marginBottom: 8 },
  infoCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F4C95D',
    backgroundColor: '#1A1830',
    padding: 14,
    marginBottom: 10,
  },
  infoTitle: { color: '#F4C95D', fontSize: 22, fontWeight: '900' },
  infoMeta: { color: '#F7FAFC', fontSize: 13, fontWeight: '800', marginTop: 5 },
  rowItem: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#435C7D',
    backgroundColor: '#243655',
    padding: 12,
    marginBottom: 8,
  },
  rowTitle: { color: '#F7FAFC', fontSize: 15, fontWeight: '900' },
  rowMeta: { color: '#A9B9CD', fontSize: 12, fontWeight: '800', marginTop: 4 },
  emptyText: {
    color: '#A9B9CD',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#435C7D',
    backgroundColor: '#243655',
    padding: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
});
