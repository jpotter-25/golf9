// client/src/screens/SocialScreen.tsx
// Purpose: Friends, requests, room invites, recent players, and player search.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import { connect, onSocialUpdate } from '../services/network';
import { ScreenHeader, ScreenShell, StatusBadge, ui } from '../ui';
import { PlayerAvatar } from '../components/PlayerAvatar';

type Props = NativeStackScreenProps<RootStackParamList, 'Social'>;

export default function SocialScreen({ navigation }: Props) {
  const { token, user } = useAuth();
  const [social, setSocial] = useState<api.SocialSummary | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<api.PublicPlayerSummary[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadSocial = useCallback(async () => {
    if (!token) return;
    const response = await api.socialMe(token);
    setSocial(response.social);
  }, [token]);

  useFocusEffect(useCallback(() => {
    loadSocial().catch(() => setSocial(null));
  }, [loadSocial]));

  useEffect(() => {
    if (!token) return undefined;
    connect(token);
    return onSocialUpdate(setSocial);
  }, [token]);

  useEffect(() => {
    if (!token || query.trim().length < 2) {
      setResults([]);
      return undefined;
    }
    let cancelled = false;
    const timeout = setTimeout(() => {
      api.searchPlayers(token, query.trim())
        .then(response => {
          if (!cancelled) setResults(response.players);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query, token]);

  const byUserId = useMemo(() => {
    const map = new Map<string, api.PublicPlayerSummary>();
    for (const player of [
      ...(social?.friends ?? []),
      ...(social?.recentPlayers ?? []),
      ...results,
    ]) map.set(player.userId, player);
    return map;
  }, [results, social?.friends, social?.recentPlayers]);

  const runAction = async (id: string, action: () => Promise<api.SocialSummary | void>) => {
    if (!token || busyId) return;
    setBusyId(id);
    try {
      const next = await action();
      if (next) setSocial(next);
      else await loadSocial();
    } catch (error) {
      Alert.alert('Social update failed', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusyId(null);
    }
  };

  const addFriend = (player: api.PublicPlayerSummary) => runAction(`add:${player.userId}`, async () => {
    const response = await api.sendFriendRequest(token!, player.userId);
    setResults(prev => prev.map(item => item.userId === player.userId ? { ...item, relationship: response.friend ? 'friend' : 'outgoing' } : item));
    return response.social;
  });

  const acceptInvite = (invite: api.RoomInvite) => runAction(`room:${invite.id}`, async () => {
    const response = await api.acceptRoomInvite(token!, invite.id);
    navigation.navigate('OnlineRoom', {
      players: response.room.maxPlayers as 2 | 3 | 4,
      rounds: response.room.rounds,
      joinCode: response.room.code,
    });
    return response.social;
  });

  return (
    <ScreenShell scroll>
      <ScreenHeader
        eyebrow="Social Layer"
        title="Friends"
        subtitle="Find players, handle invites, and jump into your clubhouse."
        right={
          <Pressable style={styles.headerIcon} onPress={() => navigation.goBack()}>
            <ChevronLeft size={22} color={ui.text.primary} strokeWidth={2.5} />
          </Pressable>
        }
      />

      <TextInput
        style={styles.searchInput}
        value={query}
        onChangeText={setQuery}
        placeholder="Search players"
        placeholderTextColor={ui.text.muted}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Pressable style={styles.clubhouseCard} onPress={() => navigation.navigate('Club')}>
        <View style={styles.clubhouseBadge}>
          <Text style={styles.clubhouseBadgeText}>{user?.club?.tag ?? 'CLUB'}</Text>
        </View>
        <View style={styles.rowCopy}>
          <Text style={styles.clubhouseTitle}>{user?.club ? user.club.name : 'Clubhouse'}</Text>
          <Text style={styles.rowMeta} numberOfLines={2}>
            {user?.club ? `Level ${user.club.level} - ${user.club.memberCount}/${user.club.memberCap} members` : 'Create a club, apply to clubs, chat, and work on shared goals.'}
          </Text>
        </View>
        <StatusBadge label="OPEN" tone={user?.club ? 'gold' : 'sky'} />
      </Pressable>

      {query.trim().length >= 2 ? (
        <Section title="Search Results">
          {results.length ? results.map(player => (
            <PlayerRow
              key={player.userId}
              player={player}
              busy={busyId === `add:${player.userId}`}
              onView={() => navigation.navigate('PlayerProfile', { userId: player.userId })}
              onPrimary={() => addFriend(player)}
            />
          )) : <Empty text="No matching players yet." />}
        </Section>
      ) : null}

      <Section title="Room Invites">
        {social?.roomInvites.length ? social.roomInvites.map(invite => (
          <View key={invite.id} style={styles.inviteCard}>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>{invite.from.displayName} invited you</Text>
              <Text style={styles.rowMeta}>Room {invite.roomCode} - {invite.room.maxPlayers} players - {invite.room.rounds} rounds</Text>
            </View>
            <View style={styles.actionRow}>
              <SmallButton label="Join" busy={busyId === `room:${invite.id}`} onPress={() => acceptInvite(invite)} />
              <SmallButton
                label="Dismiss"
                tone="ghost"
                busy={busyId === `dismiss:${invite.id}`}
                onPress={() => runAction(`dismiss:${invite.id}`, async () => (await api.dismissRoomInvite(token!, invite.id)).social)}
              />
            </View>
          </View>
        )) : <Empty text="Room invites will appear here." />}
      </Section>

      <Section title="Friend Requests">
        {social?.incomingRequests.length ? social.incomingRequests.map(request => (
          <View key={request.id} style={styles.inviteCard}>
            <PlayerSummary player={request.player} onView={() => navigation.navigate('PlayerProfile', { userId: request.player.userId })} />
            <View style={styles.actionRow}>
              <SmallButton label="Accept" busy={busyId === `accept:${request.id}`} onPress={() => runAction(`accept:${request.id}`, async () => (await api.acceptFriendRequest(token!, request.id)).social)} />
              <SmallButton label="Decline" tone="ghost" busy={busyId === `reject:${request.id}`} onPress={() => runAction(`reject:${request.id}`, async () => (await api.rejectFriendRequest(token!, request.id)).social)} />
            </View>
          </View>
        )) : <Empty text="No pending friend requests." />}
      </Section>

      <Section title="Friends">
        {social?.friends.length ? social.friends.map(player => (
          <PlayerRow
            key={player.userId}
            player={player}
            busy={busyId === `remove:${player.userId}`}
            onView={() => navigation.navigate('PlayerProfile', { userId: player.userId })}
            onPrimary={() => runAction(`remove:${player.userId}`, async () => (await api.removeFriend(token!, player.userId)).social)}
          />
        )) : <Empty text="Add friends from search or recent players." />}
      </Section>

      <Section title="Recently Played">
        {social?.recentPlayers.length ? social.recentPlayers.map(player => (
          <PlayerRow
            key={player.userId}
            player={byUserId.get(player.userId) ?? player}
            busy={busyId === `add:${player.userId}`}
            onView={() => navigation.navigate('PlayerProfile', { userId: player.userId })}
            onPrimary={() => addFriend(player)}
          />
        )) : <Empty text="People from completed online matches will show here." />}
      </Section>

      {social?.outgoingRequests.length ? (
        <Section title="Sent Requests">
          {social.outgoingRequests.map(request => (
            <PlayerRow
              key={request.id}
              player={request.player}
              busy={busyId === `cancel:${request.id}`}
              onView={() => navigation.navigate('PlayerProfile', { userId: request.player.userId })}
              onPrimary={() => runAction(`cancel:${request.id}`, async () => (await api.cancelFriendRequest(token!, request.id)).social)}
            />
          ))}
        </Section>
      ) : null}
    </ScreenShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function PlayerRow({ player, busy, onView, onPrimary }: { player: api.PublicPlayerSummary; busy: boolean; onView: () => void; onPrimary: () => void }) {
  const primaryLabel = player.relationship === 'friend'
    ? 'Remove'
    : player.relationship === 'outgoing'
      ? 'Pending'
      : player.relationship === 'incoming'
        ? 'Respond'
        : 'Add';
  return (
    <View style={styles.playerCard}>
      <PlayerSummary player={player} onView={onView} />
      <SmallButton
        label={primaryLabel}
        tone={player.relationship === 'friend' ? 'danger' : player.relationship === 'outgoing' ? 'ghost' : 'primary'}
        busy={busy}
        disabled={player.relationship === 'outgoing' || player.relationship === 'self' || player.relationship === 'incoming'}
        onPress={onPrimary}
      />
    </View>
  );
}

function PlayerSummary({ player, onView }: { player: api.PublicPlayerSummary; onView: () => void }) {
  return (
    <Pressable style={styles.playerSummary} onPress={onView}>
      <PlayerAvatar cosmetics={player.cosmetics} fallbackInitial={player.avatarInitial} size={42} />
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle} numberOfLines={1}>{player.displayName}</Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          Lv {player.level} - {player.competitive.league.name} - {player.status.online ? 'Online' : 'Offline'}
        </Text>
        {player.club ? (
          <Text style={styles.clubMeta} numberOfLines={1}>[{player.club.tag}] {player.club.name}</Text>
        ) : null}
        {player.recent ? (
          <Text style={styles.recentMeta} numberOfLines={1}>
            Last game: {player.recent.youWon ? 'Win' : 'Played'} {player.recent.yourTotal}-{player.recent.opponentTotal}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function SmallButton({ label, busy, tone = 'primary', disabled = false, onPress }: { label: string; busy?: boolean; tone?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.smallButton, tone === 'ghost' && styles.smallButtonGhost, tone === 'danger' && styles.smallButtonDanger, (busy || disabled) && styles.disabled]}
      disabled={busy || disabled}
      onPress={onPress}
    >
      <Text style={[styles.smallButtonText, tone !== 'primary' && styles.smallButtonGhostText]}>{busy ? '...' : label}</Text>
    </Pressable>
  );
}

function Empty({ text }: { text: string }) {
  return <Text style={styles.emptyText}>{text}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1023' },
  content: { padding: 16, paddingTop: 54, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ui.border.soft,
    backgroundColor: ui.surface.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#E8ECF1', fontSize: 34, fontWeight: '900' },
  backButton: { borderWidth: 1, borderColor: '#2A2F57', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  backText: { color: '#9BA3C7', fontWeight: '900' },
  searchInput: {
    backgroundColor: '#121737',
    borderColor: '#2A2F57',
    borderWidth: 1,
    borderRadius: 8,
    color: '#E8ECF1',
    fontSize: 16,
    fontWeight: '800',
    padding: 14,
    marginBottom: 14,
  },
  clubhouseCard: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#121737',
    borderColor: '#52E5A7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  clubhouseBadge: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#123B32',
    borderWidth: 2,
    borderColor: '#52E5A7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubhouseBadgeText: { color: '#E8ECF1', fontWeight: '900', fontSize: 12 },
  clubhouseTitle: { color: '#E8ECF1', fontSize: 18, fontWeight: '900' },
  clubhouseOpen: { color: '#52E5A7', fontWeight: '900', fontSize: 13 },
  section: { marginBottom: 16 },
  sectionTitle: { color: '#E8ECF1', fontSize: 18, fontWeight: '900', marginBottom: 8 },
  playerCard: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#121737',
    borderColor: '#2A2F57',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  inviteCard: {
    backgroundColor: '#121737',
    borderColor: '#2A2F57',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  playerSummary: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#102448',
    borderWidth: 2,
    borderColor: '#4DA3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOnline: { backgroundColor: '#123B32', borderColor: '#52E5A7' },
  avatarText: { color: '#E8ECF1', fontWeight: '900', fontSize: 18 },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { color: '#E8ECF1', fontSize: 15, fontWeight: '900' },
  rowMeta: { color: '#9BA3C7', fontSize: 12, fontWeight: '800', marginTop: 3 },
  clubMeta: { color: '#52E5A7', fontSize: 11, fontWeight: '900', marginTop: 3 },
  recentMeta: { color: '#FFCC66', fontSize: 11, fontWeight: '900', marginTop: 3 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  smallButton: {
    minWidth: 76,
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: '#52E5A7',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  smallButtonGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#4DA3FF' },
  smallButtonDanger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#FF6B6B' },
  smallButtonText: { color: '#0B1023', fontWeight: '900', fontSize: 12 },
  smallButtonGhostText: { color: '#E8ECF1' },
  disabled: { opacity: 0.45 },
  emptyText: {
    color: '#9BA3C7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2F57',
    backgroundColor: '#121737',
    padding: 14,
    fontWeight: '800',
  },
});
