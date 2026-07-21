// client/src/screens/OnlineMenuScreen.tsx
// Purpose: Casual online table browser for auto-match, coded rooms, and wagers.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Coins, DoorOpen, Gift, Search, Sparkles, Trophy, Users, WifiOff, X } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { useAuth } from '../context/AuthContext';
import { useConnectivity } from '../context/ConnectivityContext';
import { useAvailability } from '../context/AvailabilityContext';
import * as api from '../services/api';
import { CoinClaimBurst, type CoinClaimBurstState } from '../components/CoinClaimBurst';
import { ActionButton, PremiumPanel, ScreenHeader, ScreenShell, StatusBadge, ui } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'CasualMenu'>;
type PlayerCount = 2 | 3 | 4;
type RoundCount = 5 | 9;

const PLAYER_OPTIONS: PlayerCount[] = [2, 3, 4];
const ROUND_OPTIONS: RoundCount[] = [5, 9];
const WAGER_STEP_WIDTH = 78;
const WAGER_STEP_GAP = 8;
const WAGER_TRACK_SIDE_PADDING = 10;
const WAGER_SNAP_INTERVAL = WAGER_STEP_WIDTH + WAGER_STEP_GAP;

export default function OnlineMenuScreen({ navigation }: Props) {
  const { token, user, refreshProfile } = useAuth();
  const { isOnline } = useConnectivity();
  const { entry, isAvailable, isVisible, showUnavailable } = useAvailability();
  const [joinCode, setJoinCode] = useState('');
  const [autoOpen, setAutoOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [earnOpen, setEarnOpen] = useState(false);
  const [autoPlayers, setAutoPlayers] = useState<PlayerCount>(4);
  const [autoRounds, setAutoRounds] = useState<RoundCount>(9);
  const [createPlayers, setCreatePlayers] = useState<PlayerCount>(4);
  const [createRounds, setCreateRounds] = useState<RoundCount>(9);
  const [wagerPlayers, setWagerPlayers] = useState<PlayerCount>(4);
  const [wagerRounds, setWagerRounds] = useState<RoundCount>(9);
  const [wagerIndex, setWagerIndex] = useState(0);
  const [economy, setEconomy] = useState<api.EconomyCatalog | null>(null);
  const [freeRooms, setFreeRooms] = useState<api.RoomSummary[]>([]);
  const [wagerRooms, setWagerRooms] = useState<api.RoomSummary[]>([]);
  const [bonusBusy, setBonusBusy] = useState(false);
  const [busyRoomCode, setBusyRoomCode] = useState<string | null>(null);
  const [coinBurst, setCoinBurst] = useState<CoinClaimBurstState>(null);
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
  const selectedWager = wagerTables[Math.min(wagerIndex, Math.max(0, wagerTables.length - 1))];

  const loadTables = useCallback(async () => {
    if (!token || !isOnline) return;
    const [free, wager] = await Promise.all([
      isAvailable('casual.auto_match') || isAvailable('casual.join_room') || isAvailable('casual.create_room')
        ? api.openRooms(token, { matchType: 'casual' })
        : Promise.resolve({ rooms: [] }),
      isAvailable('casual.wagers')
        ? api.openRooms(token, { matchType: 'wager' })
        : Promise.resolve({ rooms: [] }),
    ]);
    setFreeRooms(free.rooms);
    setWagerRooms(wager.rooms);
  }, [isAvailable, isOnline, token]);

  useEffect(() => {
    if (!isAvailable('casual.auto_match')) setAutoOpen(false);
    if (!isAvailable('casual.join_room')) setJoinOpen(false);
    if (!isAvailable('casual.create_room')) setCreateOpen(false);
  }, [isAvailable]);

  useEffect(() => {
    if (!token || !isOnline) return;
    api.economyCatalog(token)
      .then(response => {
        setEconomy(response);
        const tables = response.wagerTables.filter(table => table.buyIn > 0);
        setWagerTables(tables);
        setWagerIndex(current => Math.min(current, Math.max(0, tables.length - 1)));
      })
      .catch(() => {});
  }, [isOnline, token]);

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
      setCoinBurst({ id: Date.now(), reward: response.reward });
      setEconomy(response.economy);
      await refreshProfile();
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

  if (!isOnline) {
    return (
      <ScreenShell scroll centered>
        <ScreenHeader
          eyebrow="Casual Play"
          title="Connection Needed"
          subtitle="Casual rooms and wagers reconnect to Nine Below services. Offline play remains available."
          right={<WifiOff size={30} color={ui.feedback.danger} strokeWidth={2.5} />}
        />
        <PremiumPanel>
          <Text style={styles.cardTitle}>You are offline</Text>
          <Text style={styles.cardMeta}>Return to Offline Play for Solo AI or Pass & Play without waiting for a connection.</Text>
        </PremiumPanel>
        <ActionButton label="Open Offline Play" tone="primary" onPress={() => navigation.replace('OfflineMenu')} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell scroll>
      <CoinClaimBurst burst={coinBurst} top={104} right={18} />
      <ScreenHeader
        eyebrow="Online Play"
        title="Casual Tables"
        subtitle="Auto-match, join a code, create a room, or put coins on the line."
      />

      <PremiumPanel tone="felt">
        <View style={styles.cardHeader}>
          <View style={styles.cardCopy}>
            <Text style={styles.cardTitle}>Casual Tables</Text>
            <Text style={styles.cardMeta}>No buy-in. Match automatically, join a code, or host a public room.</Text>
          </View>
          <Users size={26} color={ui.palette.emerald} strokeWidth={2.6} />
        </View>
        <View style={styles.casualActions}>
          {isVisible('casual.auto_match') ? <ActionButton label={featureLabel('casual.auto_match', 'Auto-Match')} Icon={Sparkles} tone={isAvailable('casual.auto_match') ? 'primary' : 'ghost'} onPress={() => openFeature('casual.auto_match', () => setAutoOpen(true))} /> : null}
          {isVisible('casual.join_room') ? <ActionButton label={featureLabel('casual.join_room', 'Join Room')} Icon={Search} tone={isAvailable('casual.join_room') ? 'secondary' : 'ghost'} onPress={() => openFeature('casual.join_room', () => setJoinOpen(true))} /> : null}
          {isVisible('casual.create_room') ? <ActionButton label={featureLabel('casual.create_room', 'Create Room')} Icon={DoorOpen} tone="ghost" onPress={() => openFeature('casual.create_room', () => setCreateOpen(true))} /> : null}
        </View>
        {isAvailable('casual.join_room') ? <RoomList rooms={freeRooms} emptyText="No public free tables are waiting right now." busyRoomCode={busyRoomCode} onJoin={joinOpenRoom} /> : null}
      </PremiumPanel>

      {isVisible('casual.wagers') ? <PremiumPanel style={!isAvailable('casual.wagers') ? styles.policyLockedPanel : undefined}>
        <View style={styles.cardHeader}>
          <View style={styles.cardCopy}>
            <Text style={styles.cardTitle}>Wager Tables</Text>
            <Text style={styles.cardMeta}>Buy in, win the pot, keep the pressure on.</Text>
          </View>
          <Coins size={26} color={ui.palette.gold} strokeWidth={2.6} />
        </View>
        {isAvailable('casual.wagers') ? <WagerSlider tables={wagerTables} selectedIndex={wagerIndex} onSelect={setWagerIndex} balance={balance} waitingByBuyIn={openWagerByTier} /> : (
          <View style={styles.policyMessage}>
            <Text style={styles.policyTitle}>{entry('casual.wagers').title}</Text>
            <Text style={styles.policyCopy}>{entry('casual.wagers').message}</Text>
          </View>
        )}
        {isAvailable('casual.wagers') ? <>
        <Text style={styles.modalLabel}>Players</Text>
        <Segmented values={PLAYER_OPTIONS} selected={wagerPlayers} onSelect={setWagerPlayers} suffix="P" />
        <Text style={styles.modalLabel}>Rounds</Text>
        <Segmented values={ROUND_OPTIONS} selected={wagerRounds} onSelect={setWagerRounds} suffix="R" />
        <ActionButton
          label={selectedWager ? `Find ${selectedWager.buyIn.toLocaleString()} Coin Wager` : 'Wagers Unavailable'}
          Icon={Coins}
          tone="gold"
          disabled={!selectedWager || balance < selectedWager.buyIn}
          onPress={() => selectedWager && navigation.navigate('OnlineRoom', { players: wagerPlayers, rounds: wagerRounds, wagerBuyIn: selectedWager.buyIn })}
          style={styles.wagerAction}
        />
        <RoomList
          rooms={selectedWager ? wagerRooms.filter(room => room.economy.buyIn === selectedWager.buyIn).slice(0, 4) : []}
          emptyText="No public wager tables are waiting at this buy-in."
          busyRoomCode={busyRoomCode}
          onJoin={joinOpenRoom}
        />
        </> : <ActionButton label="View Details" tone="ghost" onPress={() => showUnavailable('casual.wagers')} />}
      </PremiumPanel> : null}

      <ActionButton label="Earn Coins & Challenges" Icon={Gift} tone="ghost" onPress={() => setEarnOpen(true)} />

      <MatchPreferenceModal
        visible={autoOpen}
        title="Auto-Match"
        text="Choose your casual table preferences. If no match is waiting, Nine Below creates one for you."
        players={autoPlayers}
        rounds={autoRounds}
        actionLabel="Find Match"
        onPlayers={setAutoPlayers}
        onRounds={setAutoRounds}
        onClose={() => setAutoOpen(false)}
        onAction={() => {
          setAutoOpen(false);
          navigation.navigate('OnlineRoom', { players: autoPlayers, rounds: autoRounds, quickPlay: true });
        }}
      />

      <JoinRoomModal
        visible={joinOpen}
        joinCode={joinCode}
        canJoin={canJoin}
        onChange={setJoinCode}
        onClose={() => setJoinOpen(false)}
        onJoin={() => {
          setJoinOpen(false);
          joinCodeRoom();
        }}
      />

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

  function openFeature(featureKey: api.FeatureKey, action: () => void) {
    if (isAvailable(featureKey)) action();
    else showUnavailable(featureKey);
  }

  function featureLabel(featureKey: api.FeatureKey, liveLabel: string) {
    const feature = entry(featureKey);
    if (feature.testerPreview) return `${liveLabel} - Preview`;
    return feature.state === 'live' ? liveLabel : feature.title || liveLabel;
  }
}

function WagerSlider({
  tables,
  selectedIndex,
  onSelect,
  balance,
  waitingByBuyIn,
}: {
  tables: api.WagerTable[];
  selectedIndex: number;
  onSelect: (value: number) => void;
  balance: number;
  waitingByBuyIn: Map<number, api.RoomSummary[]>;
}) {
  const scrollRef = useRef<ScrollView | null>(null);
  const tablesKey = tables.map(table => `${table.id}:${table.buyIn}`).join('|');
  const lastTablesKey = useRef('');
  const clampedSelectedIndex = Math.max(0, Math.min(tables.length - 1, selectedIndex));
  const selected = tables[clampedSelectedIndex];

  useEffect(() => {
    if (lastTablesKey.current === tablesKey) return;
    lastTablesKey.current = tablesKey;
    scrollRef.current?.scrollTo({ x: Math.max(0, clampedSelectedIndex * WAGER_SNAP_INTERVAL), animated: false });
  }, [clampedSelectedIndex, tablesKey]);

  if (!selected) return <Text style={styles.emptyText}>Wager tables are not configured yet.</Text>;
  const waiting = waitingByBuyIn.get(selected.buyIn)?.length ?? 0;
  const canAfford = balance >= selected.buyIn;

  const selectIndex = (index: number, animated = true) => {
    const next = Math.max(0, Math.min(tables.length - 1, index));
    onSelect(next);
    scrollRef.current?.scrollTo({ x: next * WAGER_SNAP_INTERVAL, animated });
  };

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.max(0, Math.min(tables.length - 1, Math.round(event.nativeEvent.contentOffset.x / WAGER_SNAP_INTERVAL)));
    if (index !== clampedSelectedIndex) onSelect(index);
  };

  return (
    <View style={styles.wagerSliderBlock}>
      <View style={styles.wagerSelectedRow}>
        <View>
          <Text style={styles.wagerSelectedLabel}>Buy-in</Text>
          <Text style={styles.wagerSelectedValue}>{selected.buyIn.toLocaleString()} coins</Text>
        </View>
        <StatusBadge label={waiting ? `${waiting} waiting` : canAfford ? 'Ready' : 'Need coins'} tone={canAfford ? 'gold' : 'danger'} />
      </View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={WAGER_SNAP_INTERVAL}
        decelerationRate="fast"
        onMomentumScrollEnd={onScrollEnd}
        onScrollEndDrag={onScrollEnd}
        style={styles.wagerTrack}
        contentContainerStyle={styles.wagerTrackContent}
        keyboardShouldPersistTaps="handled"
      >
        {tables.map((table, index) => {
          const active = index === clampedSelectedIndex;
          const affordable = balance >= table.buyIn;
          return (
            <Pressable
              key={table.id}
              style={[styles.wagerStepTouch, { width: WAGER_STEP_WIDTH }, active && styles.wagerStepTouchActive, !affordable && styles.wagerStepLocked]}
              onPress={() => selectIndex(index)}
            >
              <Text style={[styles.wagerStepText, active && styles.wagerStepTextActive]} numberOfLines={1}>
                {table.buyIn >= 1000 ? `${table.buyIn / 1000}k` : table.buyIn}
              </Text>
              <Text style={[styles.wagerStepLabel, active && styles.wagerStepTextActive]} numberOfLines={1}>coins</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Text style={styles.wagerSwipeHint}>Swipe to choose a buy-in.</Text>
    </View>
  );
}

function MatchPreferenceModal({
  visible,
  title,
  text,
  players,
  rounds,
  actionLabel,
  onPlayers,
  onRounds,
  onClose,
  onAction,
}: {
  visible: boolean;
  title: string;
  text: string;
  players: PlayerCount;
  rounds: RoundCount;
  actionLabel: string;
  onPlayers: (value: PlayerCount) => void;
  onRounds: (value: RoundCount) => void;
  onClose: () => void;
  onAction: () => void;
}) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, styles.modalCardContained]}>
          <Pressable style={styles.modalClose} onPress={onClose}><X size={24} color={ui.text.primary} strokeWidth={3} /></Pressable>
          <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>{title}</Text>
            <Text style={styles.modalText}>{text}</Text>
            <Text style={styles.modalLabel}>Players</Text>
            <Segmented values={PLAYER_OPTIONS} selected={players} onSelect={onPlayers} suffix="P" />
            <Text style={styles.modalLabel}>Rounds</Text>
            <Segmented values={ROUND_OPTIONS} selected={rounds} onSelect={onRounds} suffix="R" />
            <ActionButton label={actionLabel} Icon={Search} onPress={onAction} style={styles.modalAction} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function JoinRoomModal({
  visible,
  joinCode,
  canJoin,
  onChange,
  onClose,
  onJoin,
}: {
  visible: boolean;
  joinCode: string;
  canJoin: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onJoin: () => void;
}) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Pressable style={styles.modalClose} onPress={onClose}><X size={24} color={ui.text.primary} strokeWidth={3} /></Pressable>
          <Text style={styles.modalTitle}>Join Room</Text>
          <Text style={styles.modalText}>Enter the 4-character room code.</Text>
          <TextInput
            style={styles.input}
            placeholder="ROOM CODE"
            placeholderTextColor={ui.text.muted}
            value={joinCode}
            onChangeText={text => onChange(text.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={4}
          />
          <ActionButton label="Join Room" Icon={DoorOpen} tone="secondary" disabled={!canJoin} onPress={onJoin} />
        </View>
      </View>
    </Modal>
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
        <View style={[styles.modalCard, styles.modalCardContained]}>
          <Pressable style={styles.modalClose} onPress={onClose}><X size={24} color={ui.text.primary} strokeWidth={3} /></Pressable>
          <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>Create Room</Text>
            <Text style={styles.modalText}>Choose the table setup. The room gets a code and also appears in the open casual pool.</Text>
            <Text style={styles.modalLabel}>Players</Text>
            <Segmented values={PLAYER_OPTIONS} selected={players} onSelect={onPlayers} suffix="P" />
            <Text style={styles.modalLabel}>Rounds</Text>
            <Segmented values={ROUND_OPTIONS} selected={rounds} onSelect={onRounds} suffix="R" />
            <ActionButton label="Create Room" Icon={DoorOpen} onPress={onCreate} style={styles.modalAction} />
          </ScrollView>
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

const styles = StyleSheet.create({
  policyLockedPanel: { opacity: 0.78 },
  policyMessage: { borderRadius: 8, borderWidth: 1, borderColor: ui.border.soft, backgroundColor: ui.surface.base, padding: 14, marginTop: 12, marginBottom: 10 },
  policyTitle: { color: ui.palette.gold, fontSize: 17, fontWeight: '900' },
  policyCopy: { color: ui.text.secondary, fontSize: 13, fontWeight: '700', lineHeight: 18, marginTop: 5 },
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
  casualActions: { gap: 10 },
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
  wagerSliderBlock: { gap: 12, marginBottom: 14 },
  wagerSelectedRow: {
    minHeight: 62,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ui.border.gold,
    backgroundColor: '#1A1830',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  wagerSelectedLabel: { color: ui.text.muted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  wagerSelectedValue: { color: ui.palette.gold, fontSize: 24, fontWeight: '900', marginTop: 2 },
  wagerTrack: {
    maxHeight: 74,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ui.border.soft,
    backgroundColor: ui.surface.glass,
  },
  wagerTrackContent: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: WAGER_STEP_GAP,
    paddingHorizontal: WAGER_TRACK_SIDE_PADDING,
  },
  wagerStepTouch: {
    minHeight: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ui.border.soft,
    backgroundColor: ui.surface.base,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  wagerStepTouchActive: { borderColor: ui.palette.gold, backgroundColor: 'rgba(255, 204, 102, 0.16)' },
  wagerStepLocked: { opacity: 0.35 },
  wagerStepText: { color: ui.text.muted, fontSize: 13, fontWeight: '900' },
  wagerStepLabel: { color: ui.text.muted, fontSize: 9, fontWeight: '900', marginTop: 2 },
  wagerStepTextActive: { color: ui.palette.gold },
  wagerSwipeHint: { color: ui.text.muted, fontSize: 11, fontWeight: '800', textAlign: 'center', marginTop: -4 },
  wagerAction: { marginTop: 12 },
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
  modalCardContained: {
    maxHeight: '86%',
    overflow: 'hidden',
    padding: 0,
  },
  modalScrollContent: {
    padding: 18,
    paddingBottom: 20,
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
