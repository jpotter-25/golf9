// client/src/screens/OnlineMenuScreen.tsx
// Purpose: Online table browser for private rooms, free play, wagers, and ranked.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Coins, DoorOpen, Gift, Search, Sparkles, Trophy, Users, X } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import { ActionButton, PremiumPanel, ScreenHeader, ScreenShell, StatusBadge, ui } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'OnlineMenu'>;
type PlayerCount = 2 | 3 | 4;
type RoundCount = 5 | 9;

const PLAYER_OPTIONS: PlayerCount[] = [2, 3, 4];
const ROUND_OPTIONS: RoundCount[] = [5, 9];

export default function OnlineMenuScreen({ navigation }: Props) {
  const { token, user, refreshProfile } = useAuth();
  const [joinCode, setJoinCode] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [earnOpen, setEarnOpen] = useState(false);
  const [createPlayers, setCreatePlayers] = useState<PlayerCount>(4);
  const [createRounds, setCreateRounds] = useState<RoundCount>(9);
  const [freePlayers, setFreePlayers] = useState<PlayerCount | null>(null);
  const [freeRounds, setFreeRounds] = useState<RoundCount | null>(null);
  const [rankedPlayers, setRankedPlayers] = useState<PlayerCount>(2);
  const [economy, setEconomy] = useState<api.EconomyCatalog | null>(null);
  const [freeRooms, setFreeRooms] = useState<api.RoomSummary[]>([]);
  const [wagerRooms, setWagerRooms] = useState<api.RoomSummary[]>([]);
  const [bonusBusy, setBonusBusy] = useState(false);
  const [busyRoomCode, setBusyRoomCode] = useState<string | null>(null);
  const [wagerTables, setWagerTables] = useState<api.WagerTable[]>([
    { id: 'casual-50', label: 'Casual', buyIn: 50, description: 'Light coin table.' },
    { id: 'competitive-100', label: 'Standard', buyIn: 100, description: 'Standard wager table.' },
    { id: 'high-250', label: 'High', buyIn: 250, description: 'High stakes table.' },
    { id: 'elite-500', label: 'Elite', buyIn: 500, description: 'Elite stakes table.' },
  ]);

  const balance = user?.currency.coins ?? 0;
  const dailyBonus = economy?.dailyBonus ?? user?.currency.dailyBonus ?? null;
  const normalizedCode = joinCode.trim().toUpperCase();
  const canJoin = normalizedCode.length === 4;
  const rankedLadder = user?.competitiveByPlayers?.[String(rankedPlayers) as '2' | '3' | '4'] ?? user?.competitive;

  const loadTables = useCallback(async () => {
    if (!token) return;
    const [free, wager] = await Promise.all([
      api.openRooms(token, {
        matchType: 'casual',
        maxPlayers: freePlayers || undefined,
        rounds: freeRounds || undefined,
      }),
      api.openRooms(token, { matchType: 'wager' }),
    ]);
    setFreeRooms(free.rooms);
    setWagerRooms(wager.rooms);
  }, [freePlayers, freeRounds, token]);

  useEffect(() => {
    if (!token) return;
    api.economyCatalog(token)
      .then(response => {
        setEconomy(response);
        setWagerTables(response.wagerTables.filter(table => table.buyIn > 0));
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    loadTables().catch(() => {});
  }, [loadTables]);

  const openWagerByTier = useMemo(() => {
    const grouped = new Map<number, api.RoomSummary[]>();
    for (const room of wagerRooms) {
      const buyIn = room.economy?.buyIn || 0;
      if (!grouped.has(buyIn)) grouped.set(buyIn, []);
      grouped.get(buyIn)?.push(room);
    }
    return grouped;
  }, [wagerRooms]);

  const claimDailyBonus = async () => {
    if (!token || bonusBusy || !dailyBonus?.canClaim) return;
    setBonusBusy(true);
    try {
      const response = await api.claimDailyBonus(token);
      setEconomy(response.economy);
      await refreshProfile();
      Alert.alert('Daily Table Bonus', `+${response.reward} coins added to your stack.`);
    } catch (error) {
      Alert.alert('Bonus unavailable', error instanceof Error ? error.message : 'Try again later.');
    } finally {
      setBonusBusy(false);
    }
  };

  const joinCodeRoom = () => {
    if (!canJoin) {
      Alert.alert('Room code needed', 'Enter the 4-character room code from the host device.');
      return;
    }
    navigation.navigate('OnlineRoom', { players: 4, rounds: 9, joinCode: normalizedCode });
  };

  const joinOpenRoom = (room: api.RoomSummary) => {
    setBusyRoomCode(room.code);
    navigation.navigate('OnlineRoom', {
      players: room.maxPlayers as PlayerCount,
      rounds: room.rounds,
      joinCode: room.code,
    });
    setTimeout(() => setBusyRoomCode(null), 500);
  };

  return (
    <ScreenShell scroll>
      <ScreenHeader
        eyebrow="Online Multiplayer"
        title="Open Online Tables"
        subtitle="Create a room, browse public tables, or queue for ranked."
      />

      <PremiumPanel tone="felt">
        <View style={styles.cardHeader}>
          <View style={styles.cardCopy}>
            <Text style={styles.cardTitle}>Create Room</Text>
            <Text style={styles.cardMeta}>Private room with a code for friends.</Text>
          </View>
          <Users size={26} color={ui.palette.emerald} strokeWidth={2.6} />
        </View>
        <ActionButton label="Set Up Private Room" Icon={DoorOpen} onPress={() => setCreateOpen(true)} />
      </PremiumPanel>

      <PremiumPanel>
        <View style={styles.cardHeader}>
          <View style={styles.cardCopy}>
            <Text style={styles.cardTitle}>Free Play</Text>
            <Text style={styles.cardMeta}>No buy-in. Earn coins without risking your stack.</Text>
          </View>
          <Sparkles size={26} color={ui.palette.gold} strokeWidth={2.6} />
        </View>
        <FilterRow
          players={freePlayers}
          rounds={freeRounds}
          onPlayers={setFreePlayers}
          onRounds={setFreeRounds}
          onClear={() => { setFreePlayers(null); setFreeRounds(null); }}
        />
        <ActionButton
          label="Find Free Match"
          Icon={Search}
          tone="ghost"
          onPress={() => navigation.navigate('OnlineRoom', { players: freePlayers ?? 4, rounds: freeRounds ?? 9, quickPlay: true })}
        />
        <RoomList rooms={freeRooms} emptyText="No public free tables are waiting right now." busyRoomCode={busyRoomCode} onJoin={joinOpenRoom} />
      </PremiumPanel>

      <PremiumPanel>
        <View style={styles.cardHeader}>
          <View style={styles.cardCopy}>
            <Text style={styles.cardTitle}>Wager Tables</Text>
            <Text style={styles.cardMeta}>Buy in, win the pot, keep the pressure on.</Text>
          </View>
          <Coins size={26} color={ui.palette.gold} strokeWidth={2.6} />
        </View>
        <View style={styles.wagerGrid}>
          {wagerTables.map(table => {
            const canAfford = balance >= table.buyIn;
            const waiting = openWagerByTier.get(table.buyIn)?.length ?? 0;
            return (
              <Pressable
                key={table.id}
                style={[styles.wagerButton, !canAfford && styles.disabled]}
                disabled={!canAfford}
                onPress={() => navigation.navigate('OnlineRoom', { players: 4, rounds: 9, wagerBuyIn: table.buyIn })}
              >
                <Text style={styles.wagerText}>{table.buyIn}</Text>
                <Text style={styles.wagerLabel}>{table.label}</Text>
                <Text style={styles.wagerMeta}>{waiting ? `${waiting} waiting` : canAfford ? 'Find table' : 'Need coins'}</Text>
              </Pressable>
            );
          })}
        </View>
        <RoomList rooms={wagerRooms.slice(0, 4)} emptyText="No public wager tables are waiting right now." busyRoomCode={busyRoomCode} onJoin={joinOpenRoom} />
      </PremiumPanel>

      <PremiumPanel tone="gold">
        <View style={styles.rankedHeader}>
          <View style={styles.rankedCopy}>
            <Text style={styles.rankedTitle}>Ranked Match</Text>
            <Text style={styles.rankedMeta}>Always 9 rounds. Each player count has its own ladder.</Text>
          </View>
          <Trophy size={30} color={ui.text.inverse} strokeWidth={2.7} />
        </View>
        <Segmented values={PLAYER_OPTIONS} selected={rankedPlayers} onSelect={setRankedPlayers} suffix="P" />
        <View style={styles.rankedStats}>
          <StatMini label="Rounds" value="9" dark />
          <StatMini label="MMR" value={String(rankedLadder?.mmr ?? 1000)} dark />
          <StatMini label="League" value={rankedLadder?.league.name ?? 'Silver III'} dark />
        </View>
        <ActionButton
          label={`Find ${rankedPlayers}-Player Ranked Match`}
          Icon={Trophy}
          tone="gold"
          onPress={() => navigation.navigate('RankedQueue', { players: rankedPlayers })}
        />
      </PremiumPanel>

      <PremiumPanel>
        <View style={styles.cardHeader}>
          <View style={styles.cardCopy}>
            <Text style={styles.cardTitle}>Join By Code</Text>
            <Text style={styles.cardMeta}>Enter the host room code.</Text>
          </View>
          <Search size={26} color={ui.palette.sky} strokeWidth={2.6} />
        </View>
        <TextInput
          style={styles.input}
          placeholder="ROOM CODE"
          placeholderTextColor={ui.text.muted}
          value={joinCode}
          onChangeText={text => setJoinCode(text.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={4}
        />
        <ActionButton label="Join Room" Icon={DoorOpen} tone="secondary" disabled={!canJoin} onPress={joinCodeRoom} />
      </PremiumPanel>

      <ActionButton label="Earn Coins & Challenges" Icon={Gift} tone="ghost" onPress={() => setEarnOpen(true)} />

      <CreateRoomModal
        visible={createOpen}
        players={createPlayers}
        rounds={createRounds}
        onPlayers={setCreatePlayers}
        onRounds={setCreateRounds}
        onClose={() => setCreateOpen(false)}
        onCreate={() => {
          setCreateOpen(false);
          navigation.navigate('OnlineRoom', { players: createPlayers, rounds: createRounds, create: true });
        }}
      />

      <EarnCoinsModal
        visible={earnOpen}
        economy={economy}
        dailyBonus={dailyBonus}
        bonusBusy={bonusBusy}
        onClose={() => setEarnOpen(false)}
        onClaim={claimDailyBonus}
        onChallenges={() => {
          setEarnOpen(false);
          navigation.navigate('Profile');
        }}
      />
    </ScreenShell>
  );
}

function FilterRow({
  players,
  rounds,
  onPlayers,
  onRounds,
  onClear,
}: {
  players: PlayerCount | null;
  rounds: RoundCount | null;
  onPlayers: (value: PlayerCount | null) => void;
  onRounds: (value: RoundCount | null) => void;
  onClear: () => void;
}) {
  return (
    <View style={styles.filterBlock}>
      <Text style={styles.filterLabel}>Filters</Text>
      <View style={styles.filterRow}>
        <Segmented values={PLAYER_OPTIONS} selected={players} onSelect={value => onPlayers(value === players ? null : value)} suffix="P" />
        <Segmented values={ROUND_OPTIONS} selected={rounds} onSelect={value => onRounds(value === rounds ? null : value)} suffix="R" />
      </View>
      <Pressable style={styles.clearFilter} onPress={onClear}>
        <Text style={styles.clearFilterText}>Show all waiting tables</Text>
      </Pressable>
    </View>
  );
}

function Segmented<T extends string | number>({
  values,
  selected,
  suffix = '',
  onSelect,
}: {
  values: T[];
  selected: T | null;
  suffix?: string;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {values.map(value => {
        const active = selected === value;
        return (
          <Pressable key={String(value)} style={[styles.segment, active && styles.segmentActive]} onPress={() => onSelect(value)}>
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{value}{suffix}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function RoomList({ rooms, emptyText, busyRoomCode, onJoin }: { rooms: api.RoomSummary[]; emptyText: string; busyRoomCode: string | null; onJoin: (room: api.RoomSummary) => void }) {
  if (!rooms.length) return <Text style={styles.emptyText}>{emptyText}</Text>;
  return (
    <View style={styles.roomList}>
      {rooms.map(room => (
        <Pressable key={room.code} style={styles.roomRow} disabled={busyRoomCode === room.code} onPress={() => onJoin(room)}>
          <View style={styles.roomCodeBadge}>
            <Text style={styles.roomCode}>{room.code}</Text>
          </View>
          <View style={styles.roomCopy}>
            <Text style={styles.roomTitle}>{room.maxPlayers} players - {room.rounds} rounds</Text>
            <Text style={styles.roomMeta}>{room.players.length}/{room.maxPlayers} seated{room.matchType === 'wager' ? ` - ${room.economy.buyIn} coins` : ''}</Text>
          </View>
          <StatusBadge label="Join" tone="sky" />
        </Pressable>
      ))}
    </View>
  );
}

function CreateRoomModal({
  visible,
  players,
  rounds,
  onPlayers,
  onRounds,
  onClose,
  onCreate,
}: {
  visible: boolean;
  players: PlayerCount;
  rounds: RoundCount;
  onPlayers: (value: PlayerCount) => void;
  onRounds: (value: RoundCount) => void;
  onClose: () => void;
  onCreate: () => void;
}) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Pressable style={styles.modalClose} onPress={onClose}><X size={24} color={ui.text.primary} strokeWidth={3} /></Pressable>
          <Text style={styles.modalTitle}>Create Room</Text>
          <Text style={styles.modalText}>Choose the private table setup before sharing the room code.</Text>
          <Text style={styles.modalLabel}>Players</Text>
          <Segmented values={PLAYER_OPTIONS} selected={players} onSelect={onPlayers} suffix="P" />
          <Text style={styles.modalLabel}>Rounds</Text>
          <Segmented values={ROUND_OPTIONS} selected={rounds} onSelect={onRounds} suffix="R" />
          <ActionButton label="Create Private Room" Icon={DoorOpen} onPress={onCreate} style={styles.modalAction} />
        </View>
      </View>
    </Modal>
  );
}

function EarnCoinsModal({
  visible,
  economy,
  dailyBonus,
  bonusBusy,
  onClose,
  onClaim,
  onChallenges,
}: {
  visible: boolean;
  economy: api.EconomyCatalog | null;
  dailyBonus: api.DailyBonus | null;
  bonusBusy: boolean;
  onClose: () => void;
  onClaim: () => void;
  onChallenges: () => void;
}) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Pressable style={styles.modalClose} onPress={onClose}><X size={24} color={ui.text.primary} strokeWidth={3} /></Pressable>
          <Text style={styles.modalTitle}>Earn Coins</Text>
          <Text style={styles.modalText}>Build your stack through daily bonuses, Free Play, and challenges.</Text>
          {(economy?.coinSources ?? []).slice(0, 4).map(source => (
            <View key={source.id} style={styles.sourceRow}>
              <Text style={styles.sourceTitle}>{source.title}</Text>
              <Text style={styles.sourceText}>{source.description}</Text>
            </View>
          ))}
          <View style={styles.earnActions}>
            <ActionButton
              label={dailyBonus?.canClaim ? `Claim ${dailyBonus.reward} Coins` : 'Daily Bonus Claimed'}
              Icon={Gift}
              tone="gold"
              disabled={!dailyBonus?.canClaim || bonusBusy}
              onPress={onClaim}
              style={styles.earnButton}
            />
            <ActionButton label="Open Challenges" Icon={Trophy} tone="secondary" onPress={onChallenges} style={styles.earnButton} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function StatMini({ label, value, dark = false }: { label: string; value: string; dark?: boolean }) {
  return (
    <View style={[styles.statMini, dark && styles.statMiniDark]}>
      <Text style={[styles.statValue, dark && styles.statValueDark]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.statLabel, dark && styles.statLabelDark]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  cardCopy: { flex: 1, minWidth: 0 },
  cardTitle: { color: ui.text.primary, fontSize: 20, fontWeight: '900' },
  cardMeta: { color: ui.text.secondary, fontSize: 13, fontWeight: '800', lineHeight: 18, marginTop: 4 },
  filterBlock: { gap: 8, marginBottom: 12 },
  filterLabel: { color: ui.text.muted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  filterRow: { gap: 8 },
  segmented: { flex: 1, minHeight: 44, flexDirection: 'row', gap: 7 },
  segment: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ui.border.soft,
    backgroundColor: ui.surface.base,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  segmentActive: { backgroundColor: ui.palette.emerald, borderColor: ui.palette.emerald },
  segmentText: { color: ui.text.secondary, fontSize: 13, fontWeight: '900' },
  segmentTextActive: { color: ui.text.inverse },
  clearFilter: { alignSelf: 'flex-start', paddingVertical: 4 },
  clearFilterText: { color: ui.palette.sky, fontSize: 12, fontWeight: '900' },
  roomList: { gap: 8, marginTop: 12 },
  roomRow: {
    minHeight: 62,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ui.border.soft,
    backgroundColor: ui.surface.glass,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
  },
  roomCodeBadge: {
    minWidth: 54,
    borderRadius: 8,
    backgroundColor: ui.palette.ink,
    borderWidth: 1,
    borderColor: ui.border.strong,
    alignItems: 'center',
    paddingVertical: 8,
  },
  roomCode: { color: ui.palette.gold, fontSize: 13, fontWeight: '900' },
  roomCopy: { flex: 1, minWidth: 0 },
  roomTitle: { color: ui.text.primary, fontSize: 14, fontWeight: '900' },
  roomMeta: { color: ui.text.secondary, fontSize: 12, fontWeight: '800', marginTop: 3 },
  emptyText: { color: ui.text.muted, fontSize: 12, fontWeight: '800', marginTop: 12, textAlign: 'center' },
  wagerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  wagerButton: {
    width: '48%',
    minHeight: 86,
    borderWidth: 1,
    borderColor: ui.border.gold,
    backgroundColor: '#1A1830',
    borderRadius: 8,
    padding: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wagerText: { color: ui.palette.gold, fontSize: 23, fontWeight: '900' },
  wagerLabel: { color: ui.text.primary, fontSize: 12, fontWeight: '900', marginTop: 3 },
  wagerMeta: { color: ui.text.muted, fontSize: 10, fontWeight: '800', marginTop: 3 },
  disabled: { opacity: 0.45 },
  rankedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  rankedCopy: { flex: 1, minWidth: 0 },
  rankedTitle: { color: ui.text.inverse, fontSize: 22, fontWeight: '900' },
  rankedMeta: { color: '#4D3D17', fontSize: 12, fontWeight: '900', lineHeight: 17, marginTop: 4 },
  rankedStats: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  statMini: { flex: 1, borderRadius: 8, backgroundColor: ui.surface.glass, padding: 9, alignItems: 'center' },
  statMiniDark: { backgroundColor: 'rgba(7, 10, 24, 0.18)' },
  statValue: { color: ui.text.primary, fontSize: 14, fontWeight: '900' },
  statValueDark: { color: ui.text.inverse },
  statLabel: { color: ui.text.muted, fontSize: 10, fontWeight: '900', marginTop: 3 },
  statLabelDark: { color: '#4D3D17' },
  input: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: ui.border.strong,
    borderRadius: 8,
    color: ui.text.primary,
    padding: 14,
    backgroundColor: ui.surface.base,
    marginBottom: 10,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 430,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ui.border.strong,
    backgroundColor: ui.surface.raised,
    padding: 18,
  },
  modalClose: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ui.border.soft,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  modalTitle: { color: ui.text.primary, fontSize: 25, fontWeight: '900', marginRight: 42 },
  modalText: { color: ui.text.secondary, fontSize: 13, fontWeight: '800', lineHeight: 19, marginTop: 6, marginBottom: 14 },
  modalLabel: { color: ui.text.muted, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', marginTop: 12, marginBottom: 8 },
  modalAction: { marginTop: 16 },
  sourceRow: { borderTopWidth: 1, borderTopColor: ui.border.soft, paddingVertical: 10 },
  sourceTitle: { color: ui.text.primary, fontSize: 14, fontWeight: '900' },
  sourceText: { color: ui.text.secondary, fontSize: 12, fontWeight: '800', lineHeight: 17, marginTop: 3 },
  earnActions: { gap: 10, marginTop: 12 },
  earnButton: { flex: 1 },
});
