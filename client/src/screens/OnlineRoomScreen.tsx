// client/src/screens/OnlineRoomScreen.tsx
// Purpose: Online multiplayer room lobby with create, join, auto-match, invites, and countdown.

import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronLeft, DoorOpen, Shield, Users } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { useAuth } from '../context/AuthContext';
import { createOnlineRoom, inviteFriendToRoom, joinOnlineRoom, quickPlayOnlineRoom, socialMe, wagerPlayOnlineRoom, PublicPlayerSummary, RoomPlayer, RoomSummary } from '../services/api';
import { joinRoomSocket, leaveOnlineRoom, onRoomUpdate } from '../services/network';
import { ActionButton, PremiumPanel, ScreenHeader, ScreenShell, StatusBadge, ui } from '../ui';
import { PlayerAvatar } from '../components/PlayerAvatar';

type Props = NativeStackScreenProps<RootStackParamList, 'OnlineRoom'>;

export default function OnlineRoomScreen({ route, navigation }: Props) {
  const { token, user } = useAuth();
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [joinCode, setJoinCode] = useState(route.params.joinCode ?? '');
  const [busy, setBusy] = useState(true);
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);
  const [friends, setFriends] = useState<PublicPlayerSummary[]>([]);
  const [now, setNow] = useState(Date.now());
  const setupStarted = useRef(false);
  const navigatedToGame = useRef(false);

  useEffect(() => {
    if (!token || setupStarted.current) return;
    setupStarted.current = true;

    const setup = async () => {
      setBusy(true);
      try {
        let res: { room: RoomSummary } | null = null;
        if (route.params.create) {
          res = await createOnlineRoom(token, route.params.players, route.params.rounds);
        } else if (route.params.quickPlay) {
          res = await quickPlayOnlineRoom(token, route.params.players, route.params.rounds);
        } else if (route.params.wagerBuyIn) {
          res = await wagerPlayOnlineRoom(token, route.params.players, route.params.rounds, route.params.wagerBuyIn);
        } else if (route.params.ranked && route.params.joinCode) {
          const joined = await joinRoomSocket(token, route.params.joinCode);
          setRoom(joined.room);
          return;
        } else if (route.params.joinCode) {
          res = await joinOnlineRoom(token, route.params.joinCode);
        }

        if (res) {
          setRoom(res.room);
          await joinRoomSocket(token, res.room.code);
        }
      } catch (error) {
        Alert.alert('Room error', error instanceof Error ? error.message : 'Unable to enter room.');
      } finally {
        setBusy(false);
      }
    };

    setup();
  }, [route.params.create, route.params.joinCode, route.params.players, route.params.quickPlay, route.params.ranked, route.params.rounds, route.params.wagerBuyIn, token]);

  useEffect(() => {
    if (!room) return;
    const offRoom = onRoomUpdate(setRoom);
    return () => offRoom();
  }, [room]);

  useEffect(() => {
    if (!token || !room || room.status !== 'lobby') {
      setFriends([]);
      return;
    }
    socialMe(token)
      .then(response => setFriends(response.social.friends))
      .catch(() => setFriends([]));
  }, [room?.code, room?.players.length, room?.status, token]);

  useEffect(() => {
    if (!room?.countdownEndsAt) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [room?.countdownEndsAt]);

  useEffect(() => {
    if (!room || room.status !== 'playing' || navigatedToGame.current) return;
    navigatedToGame.current = true;
    navigation.replace('Game', {
      players: room.players.length,
      rounds: room.rounds,
      mode: 'online',
      roomCode: room.code,
      online: true,
    });
  }, [navigation, room]);

  const join = async () => {
    if (!token) return;
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 4) {
      Alert.alert('Room code needed', 'Enter the 4-character room code from the host device.');
      return;
    }
    setBusy(true);
    try {
      const res = await joinOnlineRoom(token, code);
      setRoom(res.room);
      await joinRoomSocket(token, res.room.code);
    } catch (error) {
      Alert.alert('Join failed', error instanceof Error ? error.message : 'Unable to join room.');
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    try {
      if (token && room) await leaveOnlineRoom(token, room.code);
      navigation.goBack();
    } catch (error) {
      Alert.alert('Match in progress', error instanceof Error ? error.message : 'Finish this match before leaving the table.');
      if (room?.status === 'playing') {
        navigation.replace('Game', {
          players: room.maxPlayers,
          rounds: room.rounds,
          mode: 'online',
          roomCode: room.code,
          online: true,
        });
      }
    }
  };

  const inviteFriend = async (friend: PublicPlayerSummary) => {
    if (!token || !room || inviteBusyId) return;
    setInviteBusyId(friend.userId);
    try {
      await inviteFriendToRoom(token, room.code, friend.userId);
      Alert.alert('Invite sent', `${friend.displayName} can join from their Social menu.`);
    } catch (error) {
      Alert.alert('Invite failed', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setInviteBusyId(null);
    }
  };

  const openPlayer = (player: RoomPlayer) => {
    if (player.userId === user?.userId) {
      navigation.navigate('Profile');
      return;
    }
    navigation.navigate('PlayerProfile', { userId: player.userId });
  };

  if (!room) {
    const title = route.params.ranked ? 'Ranked Match Found' : route.params.wagerBuyIn ? 'Finding Wager Table' : route.params.create ? 'Creating Room' : route.params.quickPlay ? 'Finding Match' : 'Join Online Room';
    const autoConnecting = route.params.create || route.params.quickPlay || route.params.wagerBuyIn || (!!route.params.joinCode && busy);
    return (
      <ScreenShell scroll centered>
        <ScreenHeader
          eyebrow="Online Table"
          title={title}
          subtitle={autoConnecting ? 'Setting up your seat at the table.' : 'Enter the room code from the host.'}
          right={<DoorOpen size={26} color={ui.palette.emerald} strokeWidth={2.5} />}
        />
        {!autoConnecting ? (
          <PremiumPanel>
            <TextInput
              style={styles.input}
              placeholder="Room code"
              placeholderTextColor="#9BA3C7"
              value={joinCode}
              onChangeText={text => setJoinCode(text.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={4}
            />
            <ActionButton label="Join Room" Icon={DoorOpen} disabled={busy} onPress={join} />
          </PremiumPanel>
        ) : (
          <PremiumPanel tone="felt">
            <Text style={styles.connectingText}>Connecting...</Text>
          </PremiumPanel>
        )}
        <ActionButton label="Back" Icon={ChevronLeft} tone="ghost" onPress={() => navigation.goBack()} />
      </ScreenShell>
    );
  }

  const isRanked = room.matchType === 'ranked' || route.params.ranked;
  const isPaid = room.matchType === 'wager' || !!room.economy?.buyIn;
  const countdownLeft = room.countdownEndsAt
    ? Math.max(0, Math.ceil((room.countdownEndsAt - now) / 1000))
    : 0;
  const slots = Array.from({ length: room.maxPlayers }, (_, index) => room.players[index] ?? null);

  const inviteOptions = friends.filter(friend => !room.players.some(player => player.userId === friend.userId));
  const tableTitle = isRanked ? 'Ranked Match' : room.matchType === 'wager' ? 'Wager Table' : `Room ${room.code}`;

  return (
    <ScreenShell scroll>
      <ScreenHeader
        eyebrow={isRanked ? 'Competitive Table' : room.matchType === 'wager' ? 'Coin Table' : 'Online Table'}
        title={tableTitle}
        subtitle={`${room.players.length}/${room.maxPlayers} players - ${room.rounds} rounds`}
        right={<StatusBadge label={room.status.toUpperCase()} tone={isRanked ? 'gold' : 'sky'} />}
      />

      <PremiumPanel tone={isRanked ? 'gold' : 'felt'}>
        <View style={styles.summary}>
          <View style={styles.summaryIcon}>
            {isRanked ? <Shield size={22} color={ui.text.inverse} strokeWidth={2.5} /> : <Users size={22} color={ui.palette.emerald} strokeWidth={2.5} />}
          </View>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryLabel}>Table Settings</Text>
            <Text style={styles.summaryValue}>{room.maxPlayers} players - {room.rounds} rounds{isRanked ? ' - ranked ladder' : ''}</Text>
          </View>
        </View>
      </PremiumPanel>

      {isPaid ? (
        <View style={styles.potSummary}>
          <View style={styles.potCell}>
            <Text style={styles.potLabel}>Buy-in</Text>
            <Text style={styles.potValue}>{room.economy.buyIn} coins</Text>
          </View>
          <View style={styles.potDivider} />
          <View style={styles.potCell}>
            <Text style={styles.potLabel}>Pot</Text>
            <Text style={styles.potValue}>{room.economy.pot} coins</Text>
          </View>
        </View>
      ) : null}

      {room.countdownEndsAt ? (
        <PremiumPanel tone="felt" style={styles.countdown}>
          <Text style={styles.countdownLabel}>Starting in</Text>
          <Text style={styles.countdownNumber}>{countdownLeft}</Text>
        </PremiumPanel>
      ) : null}

      <PremiumPanel>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Players</Text>
          <StatusBadge label={`${room.players.length}/${room.maxPlayers}`} tone="sky" />
        </View>
        {slots.map((player, index) => (
          <Pressable
            key={player?.userId ?? `empty-${index}`}
            disabled={!player}
            onPress={() => player && openPlayer(player)}
            style={[styles.playerRow, !player && styles.emptyRow]}
          >
            {player ? (
              <PlayerAvatar
                cosmetics={player.cosmetics}
                fallbackInitial={player.avatarInitial}
                size={34}
                onPress={() => openPlayer(player)}
              />
            ) : (
              <Text style={styles.avatar}>{index + 1}</Text>
            )}
            <View style={styles.playerInfo}>
              <Text style={styles.playerName}>
                {player?.displayName ?? 'Open seat'}
                {player?.isHost ? '  HOST' : ''}
              </Text>
              <Text style={styles.status}>
                {player ? (player.connected ? 'Online' : 'Offline') : 'Waiting'}
              </Text>
            </View>
            <Text style={[styles.readyDot, player && styles.readyDotOn]}>{player ? 'SEATED' : ''}</Text>
          </Pressable>
        ))}
      </PremiumPanel>

      {room.status === 'lobby' && !isRanked ? (
        <PremiumPanel tone="felt">
          <View style={styles.inviteHeader}>
            <Text style={styles.inviteTitle}>Invite Friends</Text>
            <Pressable onPress={() => navigation.navigate('Social')}>
              <Text style={styles.inviteLink}>Social</Text>
            </Pressable>
          </View>
          {inviteOptions.length ? inviteOptions.slice(0, 4).map(friend => (
            <View key={friend.userId} style={styles.friendInviteRow}>
              <View style={styles.friendAvatar}>
                <Text style={styles.friendAvatarText}>{friend.avatarInitial}</Text>
              </View>
              <View style={styles.playerInfo}>
                <Text style={styles.playerName} numberOfLines={1}>{friend.displayName}</Text>
                <Text style={styles.status}>{friend.status.online ? 'Online' : 'Offline'} - Lv {friend.level}</Text>
              </View>
              <Pressable
                style={[styles.inviteButton, inviteBusyId === friend.userId && styles.disabled]}
                disabled={inviteBusyId === friend.userId}
                onPress={() => inviteFriend(friend)}
              >
                <Text style={styles.inviteButtonText}>{inviteBusyId === friend.userId ? '...' : 'Invite'}</Text>
              </Pressable>
            </View>
          )) : (
            <Text style={styles.inviteEmpty}>Add friends from Social to invite them here.</Text>
          )}
        </PremiumPanel>
      ) : null}

      <View style={styles.actionsStack}>
        <View style={styles.rankedNotice}>
          <Text style={styles.rankedNoticeText}>
            {room.countdownEndsAt ? 'The table is full. Starting automatically.' : 'The game starts automatically when every seat is filled.'}
          </Text>
        </View>

        <ActionButton label="Leave Room" Icon={ChevronLeft} tone="ghost" onPress={leave} />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1023', padding: 20, justifyContent: 'center' },
  scrollContainer: { flex: 1, backgroundColor: '#0B1023' },
  roomContent: { flexGrow: 1, padding: 20, justifyContent: 'center' },
  title: { color: '#52E5A7', fontSize: 34, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  rankedTitle: { color: '#FFCC66' },
  subtitle: { color: '#E8ECF1', textAlign: 'center', marginBottom: 18, fontSize: 16 },
  connectingText: { color: ui.text.primary, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  panelHeader: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  panelTitle: { color: ui.text.primary, fontSize: 18, fontWeight: '900' },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ui.border.soft,
    backgroundColor: ui.surface.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCopy: { flex: 1, minWidth: 0 },
  summaryLabel: { color: '#9BA3C7', fontWeight: '800' },
  summaryValue: { color: '#E8ECF1', fontWeight: '800' },
  rankedBadge: { color: '#FFCC66', fontWeight: '900' },
  potSummary: {
    borderWidth: 1,
    borderColor: ui.border.gold,
    backgroundColor: ui.surface.panel,
    borderRadius: ui.radius.lg,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  potCell: { flex: 1, minWidth: 0, alignItems: 'center' },
  potDivider: { width: 1, height: 36, backgroundColor: ui.border.gold, opacity: 0.65 },
  potLabel: { color: ui.text.secondary, fontWeight: '900', fontSize: 12, textTransform: 'uppercase' },
  potValue: { color: ui.text.primary, fontWeight: '900', fontSize: 15, marginTop: 4 },
  countdown: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#52E5A7',
    backgroundColor: '#123B32',
    padding: 12,
    marginBottom: 12,
  },
  countdownLabel: { color: '#D8FFF0', fontWeight: '800' },
  countdownNumber: { color: '#52E5A7', fontSize: 36, fontWeight: '900', marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: '#2A2F57',
    borderRadius: 8,
    color: '#E8ECF1',
    padding: 14,
    backgroundColor: '#121737',
    marginBottom: 12,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0,
  },
  playerList: { marginBottom: 2 },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121737',
    borderColor: '#2A2F57',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  emptyRow: { opacity: 0.55 },
  avatar: { color: '#52E5A7', fontWeight: '900', width: 34, fontSize: 18, textAlign: 'center' },
  playerInfo: { flex: 1, minWidth: 0 },
  playerName: { color: '#E8ECF1', fontWeight: '800', fontSize: 16 },
  status: { color: '#9BA3C7', fontSize: 12, marginTop: 2 },
  readyDot: { color: '#9BA3C7', fontSize: 11, fontWeight: '900', minWidth: 46, textAlign: 'right' },
  readyDotOn: { color: '#52E5A7' },
  invitePanel: {
    borderWidth: 1,
    borderColor: '#2A2F57',
    backgroundColor: '#0F1530',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    marginBottom: 2,
  },
  inviteHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  inviteTitle: { color: '#E8ECF1', fontWeight: '900', fontSize: 15 },
  inviteLink: { color: '#FFCC66', fontWeight: '900', textDecorationLine: 'underline' },
  friendInviteRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 7 },
  friendAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#52E5A7',
    backgroundColor: '#123B32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendAvatarText: { color: '#E8ECF1', fontWeight: '900' },
  inviteButton: {
    minWidth: 68,
    minHeight: 34,
    borderRadius: 8,
    backgroundColor: '#4DA3FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  inviteButtonText: { color: '#0B1023', fontWeight: '900', fontSize: 12 },
  inviteEmpty: { color: '#9BA3C7', fontWeight: '800', paddingVertical: 6 },
  button: { backgroundColor: '#52E5A7', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  actionsStack: {
    gap: 12,
    marginTop: 8,
  },
  rankedNotice: {
    borderWidth: 1,
    borderColor: '#FFCC66',
    backgroundColor: '#1C1A35',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  rankedNoticeText: { color: '#FFCC66', textAlign: 'center', fontWeight: '900' },
  disabled: { opacity: 0.45 },
  buttonText: { color: '#0B1023', fontWeight: '900', fontSize: 16 },
  linkButton: { alignItems: 'center', marginTop: 14, padding: 8 },
  link: { color: '#FFCC66', textDecorationLine: 'underline', fontSize: 16 },
});
