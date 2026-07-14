import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Modal, useWindowDimensions, TextInput, ScrollView, KeyboardAvoidingView, Platform, Vibration, Switch, AppState, BackHandler } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as NavigationBar from 'expo-navigation-bar';
import { Audio } from 'expo-av';
import { Bell, Gem, MessageCircle, Settings, ShoppingBag, Trophy, UserPlus, Users, X } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import type { GameState, Card, Grid, PlayerIdentity } from '../game/types';
import { aiPlayTurn, chooseAiMove } from '../game/ai';
import {
  deal,
  drawFromDeck,
  takeDiscard,
  replaceGridCard,
  discardDrawn,
  flipForPeek,
  advancePeek
} from '../game/gameLogic';
import GridView from '../components/Grid';
import Piles from '../components/Piles';
import CardView from '../components/Card';
import { AvatarCluster, rankEmblemForLeague } from '../components/AvatarDecorations';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { useBoardMetrics } from '../utils/scaling';
import { useAuth } from '../context/AuthContext';
import { useClubRealtime } from '../context/ClubRealtimeContext';
import { useOfflineSync, type LocalResultSyncOutcome } from '../context/OfflineSyncContext';
import * as api from '../services/api';
import {
  connect,
  joinRoomSocket,
  onChatHistory,
  onChatMessage,
  onGameCelebration,
  onGameUpdate,
  onRoomUpdate,
  onSocketConnect,
  sendChatMessage,
  sendGameIntent,
  updateRoomPresence,
  type ChatMessage,
  type ChatMessageType,
} from '../services/network';
import { getGameplayPreferences, setGameplayPreferences, subscribeGameplayPreferences, type GameplayPreferences } from '../services/preferences';
import { getTableThemeVisual, type EquippedCosmetics } from '../theme/cosmetics';
import { actionCopy, layerZ, ui, type GameActionModel, type GameLayerState, type GameNotice } from '../ui';
import { ShopContent } from './ShopScreen';
import { cacheActiveMatch, clearCachedActiveMatch } from '../services/activeMatchCache';
import { makeClientResultId } from '../services/localResults';
import {
  cardValue,
  continueAfterRoundSummary,
  revealGridCardForDecision,
  ROUND_REVEAL_DURATION,
  resolvePendingGridDecision,
  resolveExpiredTimers,
  scoreGrid
} from '../../../shared/rules';

type Props = NativeStackScreenProps<RootStackParamList, 'Game'>;
type GridSelection = { playerIndex: number; r: number; c: number };
type DiscardFlash = { key: string; count: number };
type SocialBurst = { id: string; text: string; type: ChatMessageType; giftId?: string; giftIcon?: string; giftPrice?: number };
type TurnNotice = GameNotice;
type GiftOption = { id: string; label: string; accent: string; icon: string; price: number };

const QUICK_CHAT_PRESETS = [
  'Nice play!',
  'Good luck!',
  'That was close!',
  'Huge clear!',
  'Your turn!',
  'One more card!',
  'Good game!',
  'Well played!',
  'Ouch.',
  'No way!',
];
const QUICK_CHAT_EMOJIS = ['\u{1F44D}', '\u{1F44F}', '\u{1F525}', '\u{1F62E}', '\u{1F602}', '\u{1F62C}', '\u{1F91D}', '\u{1F3AF}', '\u{1F3CC}\uFE0F', '\u{1F480}'];
const QUICK_CHAT_STICKERS = [
  '\u{1F3CC}\uFE0F Nice shot',
  '\u{1F525} Hot streak',
  '\u{1F9E0} Big brain',
  '\u{1F92F} No way',
  '\u{1F44F} Golf clap',
  '\u{1F3AF} Bullseye',
];
const TABLE_GIFTS: GiftOption[] = [
  { id: 'gift-good-luck', label: 'Good Luck', accent: '#52E5A7', icon: '\u{1F340}', price: 5 },
  { id: 'gift-cheer', label: 'Cheer', accent: '#4DA3FF', icon: '\u{1F389}', price: 10 },
  { id: 'gift-tissues', label: 'Tissues', accent: '#BFD9FF', icon: '\u{1F9FB}', price: 15 },
  { id: 'gift-coffee', label: 'Coffee', accent: '#C58B5A', icon: '\u{2615}', price: 25 },
  { id: 'gift-wine', label: 'Wine', accent: '#D9B8FF', icon: '\u{1F377}', price: 40 },
  { id: 'gift-golf', label: 'Golf Flag', accent: '#65D48A', icon: '\u{26F3}', price: 75 },
  { id: 'gift-gem', label: 'Gem', accent: '#BDEBFF', icon: '\u{1F48E}', price: 250 },
  { id: 'gift-crown', label: 'Crown', accent: '#FFCC66', icon: '\u{1F451}', price: 500 },
];
const TABLE_GIFTS_BY_ID = new Map(TABLE_GIFTS.map(gift => [gift.id, gift]));
const QUIET_ONLINE_ACTION_ERRORS = new Set([
  'Timer expired. Board updated.',
  'Card cannot be peeked.',
]);
const SOLO_AI_SOURCE_PAUSE_MS = 1300;
const SOLO_AI_TARGET_PAUSE_MS = 1900;
const TURN_CHIME_URI = 'data:audio/wav;base64,UklGRsQFAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YaAFAAAAAEkA4QAtAakAT/+7/eT8jP2//6ICxgTdBHsCcf6Q+tn4c/r9/pAEhQi/CL8EEv639830Bve8/QsGFAzIDHEHNP459czwUfP9+w8HZw/sEIgK2f4f8+PsW+/F+ZYHcxIfFf4NAABw8R7pMusY950HLxVVGckRqQEz8Ijl3ub88yEHjxeCHeEV0QNw7y3ibeJ28CEGixmZITwadwYr7xjf6t3M7H4EIBrFI/8c6gi+8JLfSd3v6kACiRiOI0MeEwvP8pjgzNwo6QAA2BY0I2gfMQ3t9L3hctx358D9ERW3Im4gQg8W9wHjO9zg5YL7NBMWIlIhRBFJ+WPkKdxj5En5RBFSIRYiNBOC++DlO9wB4xb3Qg9uILciERXA/Xfncty94e30MQ1oHzQj2BYAACjpzNyY4M/yEwtDHo4jiRhAAu/qSd2S377w6gj/HMUjIBp+BMzs6t2u3rzutwadG9cjnRu3Brzurt7q3czsfgQgGsUj/xzqCL7wkt9J3e/qQAKJGI4jQx4TC8/ymODM3CjpAADYFjQjaB8xDe30veFy3HfnwP0RFbcibiBCDxb3AeM73ODlgvs0ExYiUiFEEUn5Y+Qp3GPkSflEEVIhFiI0E4L74OU73AHjFvdCD24gtyIRFcD9d+dy3L3h7fQxDWgfNCPYFgAAKOnM3Jjgz/ITC0MejiOJGEAC7+pJ3ZLfvvDqCP8cxSMgGn4EzOzq3a7evO63Bp0b1yOdG7cGvO6u3urdzOx+BCAaxSP/HOoIvvCS30nd7+pAAokYjiNDHhMLz/KY4MzcKOkAANgWNCNoHzEN7fS94XLcd+fA/REVtyJuIEIPFvcB4zvc4OWC+zQTFiJSIUQRSflj5CncY+RJ+UQRUiEWIjQTgvvg5TvcAeMW90IPbiC3IhEVwP1353LcveHt9DENaB80I9gWAAAo6czcmODP8hMLQx6OI4kYQALv6kndkt++8OoI/xzFIyAafgTM7Ordrt687rcGnRvXI50btwa87q7e6t3M7H4EIBrFI/8c6gi+8JLfSd3v6kACiRiOI0MeEwvP8pjgzNwo6QAA2BY0I2gfMQ3t9L3hctx358D9ERW3Im4gQg8W9wHjO9zg5YL7NBMWIlIhRBFJ+WPkKdxj5En5RBFSIRYiNBOC++DlO9wB4xb3Qg9uILciERXA/Xfncty94e30MQ1oHzQj2BYAACjpzNyY4M/yEwtDHo4jiRhAAu/qSd2S377w6gj/HMUjIBp+BMzs6t2u3rzutwadG9cjnRu3Brzurt7q3czsfgQgGsUj/xzqCL7wkt9J3e/qQAKJGI4jQx4TC8/ymODM3CjpAADYFjQjaB8xDe30veFy3HfnwP0RFbcibiBCDxb3AeM73ODlgvs0ExYiKCEYEWP58OQP3TflhfmTENMfYSAmEsf7k+e83i7lzff2DYIdah/2Evz9KuqI4F/lT/Z6CysbRx6IEwAAsuxu4sflDfUjCdAY+hzfE9ABJu9n5GLmBfT0BngWixv8E2oDgPFw5i3nOfPwBCkU/BniE80EvvOC6CTop/IZA+URUxiSE/kF2vWZ6kPpT/J0AbQPlBYQE+wG0vev7IfqLvIAAJgNxRRfEqcHovnA7unrQ/LA/pYL6xKDESoIR/vH8GftjPK2/bMJCxF/EHYIvvy/8vruBfPh/PEHKQ9XD4wIBv6j9J/wrfNC/FUGTA0PDm0IHP9v9lDygPTZ++IEdwusDBwIAAAe+Aj0e/Wl+5kDrwkzC5sHsACu+cL1mfan+38C+QeoCewGKwEa+3v31vfb+5QBWgYQCBMGcgFg/Cv5L/lB/NoA1QRwBhMFhAF7/dD6n/rX/FQAbwPNBO8DYgFr/mP8Ifya/QAALAIrA6sCDgEr/+L9sP2H/uD/DgGQAUwBiQC8/0b/Sf+c//X/GQA=';
let turnChimeSound: Audio.Sound | null = null;
let turnChimeLoading: Promise<Audio.Sound | null> | null = null;
let turnChimeAudioModeReady = false;

async function ensureTurnChimeSound() {
  if (turnChimeSound) return turnChimeSound;
  if (turnChimeLoading) return turnChimeLoading;
  turnChimeLoading = (async () => {
    if (!turnChimeAudioModeReady) {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        staysActiveInBackground: false,
        playThroughEarpieceAndroid: false,
      });
      turnChimeAudioModeReady = true;
    }
    const created = await Audio.Sound.createAsync(
      { uri: TURN_CHIME_URI },
      { shouldPlay: false, volume: 0.55 }
    );
    turnChimeSound = created.sound;
    return turnChimeSound;
  })().catch(() => null).finally(() => {
    turnChimeLoading = null;
  });
  return turnChimeLoading;
}

async function playTurnChime() {
  try {
    const sound = await ensureTurnChimeSound();
    if (!sound) return;
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch {
    if (turnChimeSound) {
      turnChimeSound.unloadAsync().catch(() => {});
      turnChimeSound = null;
    }
    // Audio is a bonus cue; vibration and visual alerts still carry the turn.
  }
}

function buildLocalPlayerIdentities({
  players,
  mode,
  user,
  localPlayerNames,
  aiDifficulty,
}: {
  players: number;
  mode: RootStackParamList['Game']['mode'];
  user: api.UserProfile | null;
  localPlayerNames?: string[];
  aiDifficulty: 'easy' | 'hard';
}): PlayerIdentity[] {
  if (mode === 'online') return [];
  return Array.from({ length: players }, (_, index) => {
    if (index === 0) {
      const displayName = user?.displayName ?? localPlayerNames?.[0] ?? 'Player 1';
      return {
        userId: user?.userId ?? 'local-1',
        displayName,
        avatarInitial: user?.avatarInitial ?? displayName.slice(0, 1).toUpperCase(),
        cosmetics: user?.inventory.equipped,
      };
    }
    const fallback = mode === 'solo'
      ? `${aiDifficulty === 'hard' ? 'Hard' : 'Easy'} AI ${index}`
      : `Player ${index + 1}`;
    const displayName = String(localPlayerNames?.[index] || '').trim() || fallback;
    return {
      userId: `local-${index + 1}`,
      displayName: displayName.slice(0, 12),
      avatarInitial: displayName.slice(0, 1).toUpperCase(),
    };
  });
}

export default function GameScreen({ route, navigation }: Props) {
  const { players, mode, rounds, roomCode, aiDifficulty = 'easy', localPlayerNames } = route.params;
  const TOTAL_ROUNDS: number = rounds;
  const { token, user, refreshProfile } = useAuth();
  const { submitLocalResult } = useOfflineSync();
  const {
    club: clubProfile,
    chatMessages: clubChatMessages,
    clubChatUnread,
    setClubChatVisible,
    sendClubMessage,
  } = useClubRealtime();
  const isOnline = mode === 'online' && !!roomCode && !!token;
  const isFocused = useIsFocused();

  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const localPlayerIdentities = useMemo(
    () => buildLocalPlayerIdentities({ players, mode, user, localPlayerNames, aiDifficulty }),
    [aiDifficulty, localPlayerNames, mode, players, user]
  );

  // -------- Round state --------
  const [round, setRound] = useState<number>(1);
  const [totals, setTotals] = useState<number[]>(
    Array.from({ length: players }, () => 0)
  );

  // -------- Core game / UI state --------
  const [state, setState] = useState<GameState>(() => deal(players, localPlayerIdentities, {
    round: 1,
    totalRounds: TOTAL_ROUNDS,
    totals,
  }));
  const [held, setHeld] = useState<Card | null>(null);
  const [activeSource, setActiveSource] = useState<'draw'|'discard'|null>(null);
  const [heldMustReplace, setHeldMustReplace] = useState(false);
  const [heldCanDiscard, setHeldCanDiscard] = useState(false);
  const [pending, setPending] = useState<GridSelection | null>(null);
  const [selectedCell, setSelectedCell] = useState<GridSelection | null>(null);
  const [locked, setLocked] = useState(false);
  const [nowTime, setNowTime] = useState(Date.now());
  const [dismissedSummaryKey, setDismissedSummaryKey] = useState<string | null>(null);
  const [discardFlash, setDiscardFlash] = useState<DiscardFlash | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [clubChatOpen, setClubChatOpen] = useState(false);
  const [clubChatText, setClubChatText] = useState('');
  const [clubChatSending, setClubChatSending] = useState(false);
  const [alertSettingsOpen, setAlertSettingsOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [roomPlayers, setRoomPlayers] = useState<api.RoomPlayer[]>([]);
  const [socialBursts, setSocialBursts] = useState<Record<string, SocialBurst>>({});
  const [avatarGifts, setAvatarGifts] = useState<Record<string, SocialBurst>>({});
  const [avatarHubUserId, setAvatarHubUserId] = useState<string | null>(null);
  const [avatarHubProfile, setAvatarHubProfile] = useState<api.PublicPlayerProfile | null>(null);
  const [avatarHubLoading, setAvatarHubLoading] = useState(false);
  const [avatarHubBusy, setAvatarHubBusy] = useState<string | null>(null);
  const [avatarHubCosmeticCatalog, setAvatarHubCosmeticCatalog] = useState<api.CosmeticItem[]>([]);
  const [avatarHubCosmeticsLoading, setAvatarHubCosmeticsLoading] = useState(false);
  const [turnNotice, setTurnNotice] = useState<TurnNotice | null>(null);
  const [dismissedPeekPromptKey, setDismissedPeekPromptKey] = useState<string | null>(null);
  const [gameplayPrefs, setGameplayPrefs] = useState<GameplayPreferences>(getGameplayPreferences());
  const [matchProgression, setMatchProgression] = useState<api.MatchProgressionSummary | null>(null);

  const [sweepActive, setSweepActive] = useState(false);
  const sweepStarter = useRef<number | null>(null);
  const lastTurnIndex = useRef<number>(0);
  const previousStateRef = useRef<GameState | null>(null);
  const discardFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soloAiTurnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soloAiTurnKey = useRef<string | null>(null);
  const soloAiPeekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soloAiPeekKey = useRef<string | null>(null);
  const localRoundRevealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localEndingRound = useRef<number | null>(null);
  const recordedLocalRoundKey = useRef<string | null>(null);
  const localMatchResultId = useRef(makeClientResultId());
  const chatOpenRef = useRef(false);
  const chatScrollRef = useRef<ScrollView | null>(null);
  const clubChatScrollRef = useRef<ScrollView | null>(null);
  const socialBurstTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const turnNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTurnAlertKey = useRef<string | null>(null);
  const lastSweepAlertKey = useRef<string | null>(null);
  const matchProgressionKey = useRef<string | null>(null);
  const localRoundScores = useRef<number[]>([]);
  const localColumnClears = useRef<number[]>(Array.from({ length: players }, () => 0));

  const metrics = useBoardMetrics(state.players.length);
  const isSolo = mode === 'solo';
  const onlineViewerIndex = state.players.findIndex(player => player.userId === user?.userId);
  const isSimultaneousPeek = state.phase === 'peek' && !!state.simultaneousPeek;
  const isRoundReveal = state.phase === 'roundReveal';
  const isRoundSummary = state.phase === 'roundSummary';
  const activeIndex = state.phase === 'peek'
    ? isSimultaneousPeek
      ? Math.max(0, onlineViewerIndex)
      : (state.peekTurnIndex ?? 0)
    : state.currentPlayerIndex;
  const bottomIndex = isOnline
    ? Math.max(0, onlineViewerIndex)
    : isSolo
      ? 0
      : activeIndex;
  const activePlayer = state.players[activeIndex];
  const bottomPlayer = state.players[bottomIndex] ?? state.players[0];
  const bottomIsActive = isSimultaneousPeek ? bottomIndex === Math.max(0, onlineViewerIndex) : bottomIndex === activeIndex;
  const currentTurnPlayer = state.players[state.currentPlayerIndex];
  const currentTurnUserId = currentTurnPlayer?.userId;
  const currentTurnName = currentTurnPlayer?.name ?? 'Player';
  const sweepStarterName = state.sweepStarterIndex == null ? 'A player' : state.players[state.sweepStarterIndex]?.name ?? 'A player';
  const viewerCosmetics = user?.inventory?.equipped;
  const tableTheme = getTableThemeVisual(viewerCosmetics?.tableTheme);
  const playerCosmetics = useCallback((player: GameState['players'][number] | undefined, index: number): EquippedCosmetics | undefined => {
    if (player?.userId && player.userId === user?.userId && viewerCosmetics) return viewerCosmetics;
    if (!isOnline && index === 0 && viewerCosmetics) return viewerCosmetics;
    return player?.cosmetics ?? (index === bottomIndex ? viewerCosmetics : undefined);
  }, [bottomIndex, isOnline, user?.userId, viewerCosmetics]);
  const bottomCardBackId = playerCosmetics(bottomPlayer, bottomIndex)?.cardBack;

  useEffect(() => subscribeGameplayPreferences(setGameplayPrefs), []);

  useEffect(() => {
    if (!isOnline || !roomCode || !user?.userId) return;
    if (state.completed) {
      void clearCachedActiveMatch(user.userId);
      return;
    }
    void cacheActiveMatch({
      userId: user.userId,
      roomCode,
      maxPlayers: players,
      rounds,
    });
  }, [isOnline, players, roomCode, rounds, state.completed, user?.userId]);

  const showSocialBurst = useCallback((message: ChatMessage) => {
    if (message.type === 'text') return;
    const key = message.type === 'gift' && message.targetUserId ? message.targetUserId : message.userId;
    const giftPrefix = message.type === 'gift' ? `${message.displayName} sent ` : '';
    const burst = {
      id: message.id,
      text: `${giftPrefix}${message.text}`,
      type: message.type,
      giftId: message.giftId,
      giftIcon: message.giftIcon,
      giftPrice: message.giftPrice,
    };
    if (message.type === 'gift') {
      setAvatarGifts(prev => ({ ...prev, [key]: burst }));
      return;
    }
    setSocialBursts(prev => ({ ...prev, [key]: burst }));
    if (socialBurstTimers.current[key]) clearTimeout(socialBurstTimers.current[key]);
    socialBurstTimers.current[key] = setTimeout(() => {
      setSocialBursts(prev => {
        if (prev[key]?.id !== burst.id) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      delete socialBurstTimers.current[key];
    }, 2400);
  }, []);

  const openAvatarHub = useCallback((userId?: string) => {
    if (!userId) return;
    const isSelf = userId === user?.userId;
    if (!isOnline && !isSelf) return;
    setAvatarHubUserId(userId);
    setAvatarHubProfile(null);
    setAvatarHubLoading(false);
    if (isSelf) {
      return;
    }
    if (!token) return;
    setAvatarHubLoading(true);
    api.publicProfile(token, userId)
      .then(response => setAvatarHubProfile(response.profile))
      .catch(() => setAvatarHubProfile(null))
      .finally(() => setAvatarHubLoading(false));
  }, [isOnline, token, user?.userId]);

  useEffect(() => {
    if (!token || !avatarHubUserId || avatarHubUserId !== user?.userId) return;
    let cancelled = false;
    setAvatarHubCosmeticsLoading(true);
    api.cosmeticCatalog(token)
      .then(response => {
        if (!cancelled) setAvatarHubCosmeticCatalog(response.cosmetics);
      })
      .catch(() => {
        if (!cancelled) setAvatarHubCosmeticCatalog([]);
      })
      .finally(() => {
        if (!cancelled) setAvatarHubCosmeticsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [avatarHubUserId, token, user?.userId]);

  const showGameplayNotice = useCallback((
    notice: TurnNotice,
    options: { vibration?: number | number[]; notifyDevice?: boolean; duration?: number } = {}
  ) => {
    if (!isFocused || !gameplayPrefs.turnAlerts) return;
    const { vibration = 80, notifyDevice = true, duration } = options;
    setTurnNotice(notice);
    if (turnNoticeTimer.current) clearTimeout(turnNoticeTimer.current);
    turnNoticeTimer.current = null;
    if (duration) {
      turnNoticeTimer.current = setTimeout(() => {
        setTurnNotice(current => current?.id === notice.id ? null : current);
      }, duration);
    }
    if (notifyDevice && gameplayPrefs.vibrate) Vibration.vibrate(vibration);
    if (notifyDevice && gameplayPrefs.sound) playTurnChime();
  }, [gameplayPrefs, isFocused]);

  useEffect(() => {
    if (isFocused) return;
    setTurnNotice(null);
    if (turnNoticeTimer.current) clearTimeout(turnNoticeTimer.current);
    turnNoticeTimer.current = null;
  }, [isFocused]);

  useEffect(() => {
    chatOpenRef.current = chatOpen;
    if (chatOpen) setChatUnread(0);
  }, [chatOpen]);

  useEffect(() => {
    setClubChatVisible(clubChatOpen && isFocused);
    return () => setClubChatVisible(false);
  }, [clubChatOpen, isFocused, setClubChatVisible]);

  const applyOnlineGameState = useCallback((next: GameState) => {
    setState(next);
    setRound(next.round ?? 1);
    setTotals(next.totals ?? Array.from({ length: players }, () => 0));
    setNowTime(Date.now());

    const nextHeld = next.viewerHeldCard ?? null;
    setHeld(nextHeld);
    setActiveSource(nextHeld ? (next.viewerHeldSource ?? null) : null);
    setHeldMustReplace(nextHeld ? !!next.viewerHeldMustReplace : false);
    setHeldCanDiscard(nextHeld ? !!next.viewerHeldCanDiscard : false);

    const nextPending = next.pendingDecision
      ? { playerIndex: next.pendingDecision.playerIndex, r: next.pendingDecision.r, c: next.pendingDecision.c }
      : null;
    setPending(nextPending);

    const viewerIndex = next.players.findIndex(player => player.userId === user?.userId);
    setSelectedCell(prev => {
      if (!nextHeld || nextPending || viewerIndex < 0) return null;
      if (next.phase !== 'turn' || next.currentPlayerIndex !== viewerIndex) return null;
      return prev?.playerIndex === viewerIndex ? prev : null;
    });
  }, [players, user?.userId]);

  const applyOnlineRoomSnapshot = useCallback((snapshot: { room?: api.RoomSummary | null; game?: GameState | null; chat?: ChatMessage[] | null }) => {
    if (snapshot.room) setRoomPlayers(snapshot.room.players);
    if (snapshot.game) applyOnlineGameState(snapshot.game);
    if (snapshot.chat) setChatMessages(snapshot.chat);
  }, [applyOnlineGameState]);

  const resyncOnlineRoom = useCallback(async (options: { quiet?: boolean } = {}) => {
    if (!isOnline || !token || !roomCode) return;
    setNowTime(Date.now());
    try {
      const snapshot = await joinRoomSocket(token, roomCode);
      applyOnlineRoomSnapshot(snapshot);
    } catch (error) {
      if (!options.quiet) {
        Alert.alert('Connection error', error instanceof Error ? error.message : 'Unable to sync this game.');
      }
    }
  }, [applyOnlineRoomSnapshot, isOnline, roomCode, token]);

  const handleOnlineActionError = useCallback((title: string, error: unknown) => {
    const message = error instanceof Error ? error.message : 'Try again.';
    if (QUIET_ONLINE_ACTION_ERRORS.has(message)) {
      resyncOnlineRoom({ quiet: true });
      return;
    }
    Alert.alert(title, message);
    resyncOnlineRoom({ quiet: true });
  }, [resyncOnlineRoom]);

  useEffect(() => {
    if (!isOnline || !token || !roomCode) return;
    let cancelled = false;
    connect(token);
    const cleanupRoom = onRoomUpdate(room => {
      if (!cancelled) setRoomPlayers(room.players);
    });
    const cleanupConnect = onSocketConnect(() => {
      if (!cancelled) resyncOnlineRoom({ quiet: true });
    });
    const cleanupGame = onGameUpdate(next => {
      if (!cancelled) applyOnlineGameState(next);
    });
    const cleanupHistory = onChatHistory(messages => {
      if (!cancelled) setChatMessages(messages);
    });
    const cleanupMessage = onChatMessage(message => {
      if (cancelled) return;
      setChatMessages(prev => prev.some(item => item.id === message.id) ? prev : [...prev, message].slice(-80));
      showSocialBurst(message);
      if (!chatOpenRef.current && message.userId !== user?.userId) {
        setChatUnread(prev => Math.min(99, prev + 1));
      }
    });
    const cleanupCelebration = onGameCelebration(message => {
      if (!cancelled) showSocialBurst(message);
    });

    resyncOnlineRoom();

    return () => {
      cancelled = true;
      cleanupRoom();
      cleanupConnect();
      cleanupGame();
      cleanupHistory();
      cleanupMessage();
      cleanupCelebration();
    };
  }, [applyOnlineGameState, isOnline, resyncOnlineRoom, roomCode, showSocialBurst, token, user?.userId]);

  useEffect(() => {
    if (!isOnline || state.completed) return;
    const message = 'Finish this match before leaving the table.';
    const unsubscribe = navigation.addListener('beforeRemove', event => {
      const action = event.data.action as { type?: string; payload?: { name?: string } };
      if ((action.type === 'NAVIGATE' || action.type === 'PUSH') && action.payload?.name === 'PlayerProfile') return;
      event.preventDefault();
      Alert.alert('Match in progress', message);
    });
    const backSubscription = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert('Match in progress', message);
      return true;
    });
    return () => {
      unsubscribe();
      backSubscription.remove();
    };
  }, [isOnline, navigation, state.completed]);

  useEffect(() => {
    if (!isOnline) return;
    let previousState = AppState.currentState;
    updateRoomPresence(token, roomCode, previousState === 'active').catch(() => {});
    const sub = AppState.addEventListener('change', nextState => {
      const becameActive = nextState === 'active' && previousState !== 'active';
      previousState = nextState;
      updateRoomPresence(token, roomCode, nextState === 'active').catch(() => {});
      if (becameActive) {
        setNowTime(Date.now());
        resyncOnlineRoom({ quiet: true });
      }
    });
    return () => {
      updateRoomPresence(token, roomCode, false).catch(() => {});
      sub.remove();
    };
  }, [isOnline, resyncOnlineRoom, roomCode, token]);

  useEffect(() => {
    if (!isOnline || !isFocused) return;
    updateRoomPresence(token, roomCode, true).catch(() => {});
    setNowTime(Date.now());
    resyncOnlineRoom({ quiet: true });
  }, [isFocused, isOnline, resyncOnlineRoom, roomCode, token]);

  useEffect(() => {
    if (isOnline) return;
    setRound(state.round ?? 1);
    setTotals(state.totals ?? Array.from({ length: players }, () => 0));
  }, [isOnline, players, state.round, state.totals]);

  useEffect(() => {
    const previous = previousStateRef.current;
    if (previous && previous.id === state.id) {
      let clearedCount = 0;
      const clearedCells: string[] = [];
      const clearedColumnsByPlayer = state.players.map(() => 0);
      state.players.forEach((player, playerIndex) => {
        for (let c = 0; c < 3; c += 1) {
          const beforeColumn = [
            previous.players[playerIndex]?.grid?.[0]?.[c],
            previous.players[playerIndex]?.grid?.[1]?.[c],
            previous.players[playerIndex]?.grid?.[2]?.[c],
          ];
          const afterColumn = [player.grid[0]?.[c], player.grid[1]?.[c], player.grid[2]?.[c]];
          if (beforeColumn.some(Boolean) && afterColumn.every(card => !card)) {
            clearedColumnsByPlayer[playerIndex] += 1;
          }
        }
        player.grid.forEach((row, r) => {
          row.forEach((card, c) => {
            const previousCard = previous.players[playerIndex]?.grid?.[r]?.[c] ?? null;
            if (previousCard && !card) {
              clearedCount += 1;
              clearedCells.push(`${playerIndex}-${r}-${c}`);
            }
          });
        });
      });
      if (!isOnline) {
        clearedColumnsByPlayer.forEach((count, index) => {
          localColumnClears.current[index] = (localColumnClears.current[index] ?? 0) + count;
        });
      }

      if (clearedCount > 0) {
        const discardGain = Math.max(0, state.discardPile.length - previous.discardPile.length);
        const movedCount = Math.max(clearedCount + 1, discardGain);
        const key = `${state.revision ?? Date.now()}:${clearedCells.join('|')}`;
        setDiscardFlash({ key, count: movedCount });
        if (discardFlashTimer.current) clearTimeout(discardFlashTimer.current);
        discardFlashTimer.current = setTimeout(() => {
          setDiscardFlash(current => current?.key === key ? null : current);
        }, 1200);
      }
    }

    previousStateRef.current = state;
  }, [isOnline, state]);

  useEffect(() => {
    return () => {
      if (discardFlashTimer.current) clearTimeout(discardFlashTimer.current);
      if (soloAiTurnTimer.current) clearTimeout(soloAiTurnTimer.current);
      if (soloAiPeekTimer.current) clearTimeout(soloAiPeekTimer.current);
      if (localRoundRevealTimer.current) clearTimeout(localRoundRevealTimer.current);
      if (turnNoticeTimer.current) clearTimeout(turnNoticeTimer.current);
      Object.values(socialBurstTimers.current).forEach(timer => clearTimeout(timer));
    };
  }, []);

  const oppCount = Math.max(0, state.players.length - 1);
  const tableLayout = useMemo(() => {
    const sidePad = 8;
    const gap = Math.max(6, metrics.opp.gap);
    const oppPadding = 6;
    const oppGridWidth = metrics.opp.cardW * 3 + metrics.opp.gap * 2;
    const baseOppPanelWidth = Math.ceil(oppGridWidth + oppPadding * 2 + 2);
    const opponentSlots = Math.max(1, oppCount);
    const availableOppPanelWidth = Math.floor((winW - sidePad * 2 - gap * Math.max(0, opponentSlots - 1)) / opponentSlots);
    const pileMetrics = {
      cardW: Math.max(metrics.opp.cardW + 2, Math.round(metrics.opp.cardW * 1.12)),
      cardH: Math.max(metrics.opp.cardH + 3, Math.round(metrics.opp.cardH * 1.12)),
      gap: Math.max(5, Math.round(metrics.opp.gap * 0.75)),
    };
    const pileClusterWidth = pileMetrics.cardW * 2 + pileMetrics.gap * 3 + 22;
    return {
      gap,
      sidePad,
      oppPadding,
      pileMetrics,
      oppPanelWidth: oppCount > 0 ? Math.min(baseOppPanelWidth, availableOppPanelWidth) : baseOppPanelWidth,
      centerSlotWidth: Math.min(winW - sidePad * 2, Math.max(128, pileClusterWidth)),
    };
  }, [metrics.opp.cardH, metrics.opp.cardW, metrics.opp.gap, oppCount, winW]);

  // ===== Solo vs AI flags =====
  const isOnlineTurn = isOnline ? state.players[state.currentPlayerIndex]?.userId === user?.userId : true;
  const isOnlinePeek = isOnline
    ? isSimultaneousPeek
      ? onlineViewerIndex >= 0 && (state.players[onlineViewerIndex]?.peekFlips ?? 2) < 2
      : state.players[state.peekTurnIndex ?? 0]?.userId === user?.userId
    : true;
  const isHumanTurn = isOnlineTurn && !(isSolo && state.phase === 'turn' && state.currentPlayerIndex !== 0);
  const isHumanPeek = state.phase === 'peek'
    ? isOnlinePeek && !(isSolo && (state.peekTurnIndex ?? 0) !== 0)
    : true;

  // ===== Hide Android navigation bar while in-game =====
  useEffect(() => {
    NavigationBar.setVisibilityAsync('hidden').catch(() => {});
    return () => {
      NavigationBar.setVisibilityAsync('visible').catch(() => {});
    };
  }, []);

  // ===== SOLO: auto-advance peeks (no taps) =====
  useEffect(() => {
    if (isOnline || !isSolo || state.phase !== 'peek') {
      soloAiPeekKey.current = null;
      return;
    }
    const idx = state.peekTurnIndex ?? 0;

    if (idx !== 0) {
      const peekKey = `${state.id}:${state.round ?? 1}:${idx}`;
      if (soloAiPeekKey.current === peekKey) return;
      if (soloAiPeekTimer.current) clearTimeout(soloAiPeekTimer.current);
      soloAiPeekKey.current = peekKey;

      const needed = Math.max(0, 2 - (state.players[idx]?.peekFlips ?? 0));
      const targets = firstFaceDownCells(state.players[idx]?.grid).slice(0, needed);
      if (!targets.length) {
        soloAiPeekKey.current = null;
        setState(s => advancePeek(s));
        return;
      }

      setLocked(true);
      setPending({ playerIndex: idx, ...targets[0] });
      soloAiPeekTimer.current = setTimeout(() => {
        setState(s => flipForPeek(s, targets[0].r, targets[0].c));
        if (!targets[1]) {
          soloAiPeekTimer.current = setTimeout(() => {
            soloAiPeekTimer.current = null;
            soloAiPeekKey.current = null;
            setPending(null);
            setLocked(false);
            setState(s => advancePeek(s));
          }, SOLO_AI_TARGET_PAUSE_MS);
          return;
        }

        setPending({ playerIndex: idx, ...targets[1] });
        soloAiPeekTimer.current = setTimeout(() => {
          soloAiPeekTimer.current = null;
          soloAiPeekKey.current = null;
          setState(s => advancePeek(flipForPeek(s, targets[1].r, targets[1].c)));
          setPending(null);
          setLocked(false);
        }, SOLO_AI_TARGET_PAUSE_MS);
      }, SOLO_AI_SOURCE_PAUSE_MS);
      return;
    }

    const flips = state.players[0]?.peekFlips ?? 0;
    if (flips >= 2) {
      const t = setTimeout(() => {
        setState(s => advancePeek(s));
      }, 150);
      return () => clearTimeout(t);
    }
  }, [state, isOnline, isSolo]);

  // ===== SOLO: AI plays turns automatically =====
  useEffect(() => {
    if (isOnline || !isSolo || state.phase !== 'turn') {
      soloAiTurnKey.current = null;
      return;
    }
    const i = state.currentPlayerIndex;
    if (i === 0) {
      soloAiTurnKey.current = null;
      return;
    }
    const turnKey = `${state.id}:${state.revision ?? 0}:${i}:${state.turnEndsAt ?? 0}`;
    if (soloAiTurnKey.current === turnKey) return;
    if (soloAiTurnTimer.current) clearTimeout(soloAiTurnTimer.current);
    soloAiTurnKey.current = turnKey;

    const move = chooseAiMove(state, i, aiDifficulty);
    setLocked(true);
    setActiveSource(move.source);
    setHeld(null);
    setHeldMustReplace(false);
    setHeldCanDiscard(false);
    setPending(null);
    setSelectedCell(null);
    soloAiTurnTimer.current = setTimeout(() => {
      if (move.card) {
        const previewCard = { ...move.card, faceUp: true };
        setHeld(previewCard);
      }
      if (move.target) setPending(move.target);
      soloAiTurnTimer.current = setTimeout(() => {
        soloAiTurnTimer.current = null;
        soloAiTurnKey.current = null;
        setState(s => aiPlayTurn(s, i, aiDifficulty));
        setHeld(null);
        setActiveSource(null);
        setPending(null);
        setSelectedCell(null);
        setLocked(false);
      }, SOLO_AI_TARGET_PAUSE_MS);
    }, SOLO_AI_SOURCE_PAUSE_MS);
  }, [state, isOnline, isSolo, aiDifficulty]);

  useEffect(() => {
    if (isOnline || state.phase !== 'roundReveal') return;
    if (localRoundRevealTimer.current) clearTimeout(localRoundRevealTimer.current);
    const delay = Math.max(0, (state.roundRevealEndsAt ?? Date.now()) - Date.now());
    localRoundRevealTimer.current = setTimeout(() => {
      localRoundRevealTimer.current = null;
      setState(s => resolveExpiredTimers(s) as GameState);
    }, delay);
    return () => {
      if (localRoundRevealTimer.current) {
        clearTimeout(localRoundRevealTimer.current);
        localRoundRevealTimer.current = null;
      }
    };
  }, [isOnline, state.phase, state.roundRevealEndsAt]);

  // ===== Final sweep detection =====
  useEffect(() => {
    if (isOnline || locked || state.phase !== 'turn') return;
    const i = state.currentPlayerIndex;
    const allUp = state.players[i].grid.every(row => row.every(c => !c || c.faceUp));
    if (allUp && !state.sweepActive && !sweepActive && sweepStarter.current == null) {
      sweepStarter.current = i;
      setSweepActive(true);
    }
  }, [state, sweepActive, isOnline, locked]);

  useEffect(() => {
    if (isOnline || locked || state.phase !== 'turn') return;
    const i = state.currentPlayerIndex;
    if (sweepActive && sweepStarter.current != null) {
      if (lastTurnIndex.current !== i && i === sweepStarter.current) {
        endRoundAndMaybeContinue();
      }
    }
    lastTurnIndex.current = i;
  }, [state, sweepActive, isOnline, locked]);

  // ===== Scoring & round transition =====
  const recordLocalMatchCompletion = useCallback(async (
    revealedState: GameState,
    finalTotals: number[],
    finalRoundScores: number[]
  ): Promise<LocalResultSyncOutcome> => {
    if (!token) return { progression: null, queued: false };
    const winningTotal = Math.min(...finalTotals);
    const accountRoundScores = [...localRoundScores.current, finalRoundScores[0] ?? 0];
    try {
      const outcome = await submitLocalResult({
        clientResultId: localMatchResultId.current,
        completedAt: Date.now(),
        mode: isSolo ? 'solo' : 'passplay',
        totalRounds: TOTAL_ROUNDS === 5 ? 5 : 9,
        roundScores: accountRoundScores,
        columnClears: localColumnClears.current[0] ?? 0,
        players: revealedState.players.map((player, index) => ({
          displayName: index === 0 ? (user?.displayName ?? player.name) : player.name,
          total: finalTotals[index] ?? 0,
          won: (finalTotals[index] ?? 0) === winningTotal,
        })),
      });
      if (outcome.progression) setMatchProgression(outcome.progression);
      return outcome;
    } catch {
      return { progression: null, queued: true };
    }
  }, [TOTAL_ROUNDS, isSolo, submitLocalResult, token, user?.displayName]);

  function endRoundAndMaybeContinue() {
    const roundNumber = Math.min(round, TOTAL_ROUNDS);
    if (localEndingRound.current === roundNumber) return;
    localEndingRound.current = roundNumber;
    setLocked(true);
    const revealedState = revealHiddenForDisplay({
      ...state,
      round: roundNumber,
      totalRounds: TOTAL_ROUNDS,
      totals,
    });
    setState(revealedState);
    const roundScores = revealedState.players.map(p => scoreGrid(p.grid));
    const nextTotals = totals.map((t, i) => t + (roundScores[i] ?? 0));
    setTotals(nextTotals);
    const prettyRound = roundScores.map((sc, i) => `Player ${i + 1}: ${sc}`).join('\n');
    setTimeout(async () => {
      if (roundNumber < TOTAL_ROUNDS) {
        localRoundScores.current.push(roundScores[0] ?? 0);
        const nextRound = roundNumber + 1;
        Alert.alert(
          `Round ${roundNumber} complete`,
          prettyRound + `\n\nTap "Next" for Round ${nextRound}.`,
          [
            {
              text: 'Next',
              onPress: () => {
                sweepStarter.current = null;
                setSweepActive(false);
                setHeld(null);
                setPending(null);
                setSelectedCell(null);
                setActiveSource(null);
                setHeldMustReplace(false);
                setHeldCanDiscard(false);
                setDismissedPeekPromptKey(null);
                setState(deal(players, localPlayerIdentities, {
                  round: nextRound,
                  totalRounds: TOTAL_ROUNDS,
                  totals: nextTotals,
                }));
                setRound(nextRound);
                localEndingRound.current = null;
                setLocked(false);
              },
            },
          ],
          { cancelable: false }
        );
      } else {
        const finalTotals = nextTotals;
        const outcome = await recordLocalMatchCompletion(revealedState, finalTotals, roundScores);
        const finalLines = revealedState.players
          .map((_, i) => `Player ${i + 1}: ${finalTotals[i]}`)
          .join('\n');
        const rewardLines = formatProgressionSummary(outcome.progression);
        const syncLine = outcome.queued ? 'Match saved. Rewards and progression will sync when you reconnect.' : '';
        const completionCopy = [finalLines, rewardLines, syncLine].filter(Boolean).join('\n\n');
        Alert.alert(
          'Game Over',
          completionCopy,
          [{ text: 'OK', onPress: () => navigation.replace('Lobby') }],
          { cancelable: false }
        );
      }
    }, ROUND_REVEAL_DURATION);
  }

  useEffect(() => {
    if (isOnline || !state.lastRoundNumber || !state.lastRoundScores?.length) return;
    if (state.phase !== 'roundSummary' && state.phase !== 'roundEnd') return;
    const key = `${state.id}:${state.lastRoundNumber}:${state.lastRoundScores.join(',')}:${state.lastRoundTotals?.join(',') ?? ''}`;
    if (recordedLocalRoundKey.current === key) return;
    recordedLocalRoundKey.current = key;
    if (state.completed || state.phase === 'roundEnd') {
      const finalTotals = state.lastRoundTotals ?? state.totals ?? totals;
      recordLocalMatchCompletion(state, finalTotals, state.lastRoundScores).catch(() => {});
    } else {
      localRoundScores.current.push(state.lastRoundScores[0] ?? 0);
    }
  }, [
    isOnline,
    state,
    state.completed,
    state.id,
    state.lastRoundNumber,
    state.lastRoundScores,
    state.lastRoundTotals,
    state.phase,
    state.totals,
    totals,
    recordLocalMatchCompletion,
  ]);

  // ===== Visual Countdown Timer (UI) =====
  useEffect(() => {
    if (!isOnline || locked) return;
    if (state.phase !== 'turn' && state.phase !== 'peek' && state.phase !== 'roundReveal' && state.phase !== 'roundSummary') return;
    const intervalId = setInterval(() => {
      setNowTime(Date.now());
    }, 1000);
    return () => clearInterval(intervalId);
  }, [isOnline, state.phase, locked]);

  // ===== UI helpers =====
  const showTimer = isOnline;
  const showRoundChip = !showTimer;
  const secsLeft =
    locked
      ? 0
      : state.phase === 'peek'
        ? Math.max(0, Math.floor(((state.peekEndsAt ?? 0) - nowTime) / 1000))
        : state.phase === 'roundReveal'
          ? Math.max(0, Math.floor(((state.roundRevealEndsAt ?? 0) - nowTime) / 1000))
          : state.phase === 'roundSummary'
            ? Math.max(0, Math.floor(((state.roundSummaryEndsAt ?? 0) - nowTime) / 1000))
            : Math.max(0, Math.floor(((state.turnEndsAt ?? 0) - nowTime) / 1000));

  const opponents = useMemo(() => {
    return state.players.map((p, i) => ({ p, i })).filter(x => x.i !== bottomIndex);
  }, [state, bottomIndex]);
  const roomPlayersById = useMemo(() => {
    return new Map(roomPlayers.map(player => [player.userId, player]));
  }, [roomPlayers]);
  const visibleRoundScores = useMemo(
    () => state.players.map(player => visibleGridScore(player.grid)),
    [state.players]
  );

  const isDrawOnlyTurn = state.mustDrawOnlyForPlayerIndex === state.currentPlayerIndex;
  const isBonusDrawTurn = isDrawOnlyTurn;
  const isActiveGridVisible = bottomIndex === activeIndex;
  const canUsePiles = isHumanTurn && state.phase === 'turn' && !held && !state.pendingDecision && !activeSource && !selectedCell;
  const canSwitchDiscardToDraw = isHumanTurn
    && state.phase === 'turn'
    && !!held
    && activeSource === 'discard'
    && !pending
    && !state.pendingDecision;
  const canUseGrid = (state.phase === 'peek' && isHumanPeek && isActiveGridVisible)
    || (state.phase === 'turn' && isHumanTurn && !!held && isActiveGridVisible);
  const roundSummaryKey = state.lastRoundNumber && state.lastRoundScores
    ? `${state.lastRoundNumber}:${state.lastRoundTotals?.join(',') ?? state.lastRoundScores.join(',')}`
    : null;
  const showRoundSummary = !!roundSummaryKey
    && dismissedSummaryKey !== roundSummaryKey
    && (state.phase === 'roundSummary' || state.phase === 'roundEnd');
  const passPeekPlayerIndex = !isOnline && !isSolo && !isSimultaneousPeek && state.phase === 'peek'
    ? (state.peekTurnIndex ?? 0)
    : null;
  const passPeekPromptKey = passPeekPlayerIndex == null
    ? null
    : `${state.id}:${state.round ?? round}:peek:${passPeekPlayerIndex}`;
  const showPassOverlay = !!passPeekPromptKey && dismissedPeekPromptKey !== passPeekPromptKey;
  const passPeekPlayer = passPeekPlayerIndex == null ? null : state.players[passPeekPlayerIndex] ?? null;
  const pendingForBottom = pending?.playerIndex === bottomIndex ? pending : null;
  const selectedForBottom = selectedCell?.playerIndex === bottomIndex ? selectedCell : null;
  const bottomActiveCell = selectedForBottom ?? pendingForBottom;
  const selectedGridCard = selectedCell
    ? state.players[selectedCell.playerIndex]?.grid?.[selectedCell.r]?.[selectedCell.c] ?? null
    : null;
  const pendingRevealedCard = pendingForBottom
    ? state.players[pendingForBottom.playerIndex]?.grid?.[pendingForBottom.r]?.[pendingForBottom.c] ?? null
    : null;
  const selectedActionText = selectedGridCard?.faceUp
    ? activeSource === 'discard'
      ? 'Place Card'
      : 'Keep Drawn'
    : 'Reveal Card';
  const hudTitle = state.phase === 'peek'
    ? bottomIsActive
      ? 'Peek Phase'
      : 'Waiting'
    : isRoundReveal
      ? 'Final Reveal'
      : isRoundSummary
        ? 'Round Complete'
        : bottomIsActive
          ? state.sweepActive
            ? 'Final Turn'
            : 'Your Turn'
          : 'Opponent Turn';
  const hudInstruction = state.phase === 'peek'
    ? bottomIsActive
      ? 'Flip two cards'
      : 'Table is peeking'
    : isRoundReveal
      ? 'Cards are revealing'
      : isRoundSummary
        ? 'Review scores'
        : bottomIsActive
          ? held
            ? pendingForBottom
              ? 'Choose which card stays'
              : 'Choose a grid card'
            : isDrawOnlyTurn
              ? 'Draw from deck'
              : 'Draw or take discard'
          : 'Watch the table';
  const actionModel = useMemo<GameActionModel>(() => {
    if (state.phase === 'peek') {
      return {
        phase: 'peek',
        primaryLabel: 'Flip two cards to start',
        selectedSource: null,
        selectedCard: null,
        canUsePiles: false,
        canUseGrid: isHumanPeek,
        canCancelSelection: false,
      };
    }
    if (isRoundReveal) {
      return {
        phase: 'reveal',
        primaryLabel: 'Final hidden cards are revealing',
        selectedSource: null,
        selectedCard: null,
        canUsePiles: false,
        canUseGrid: false,
        canCancelSelection: false,
      };
    }
    if (isRoundSummary || state.phase === 'roundEnd') {
      return {
        phase: 'summary',
        primaryLabel: 'Review round results',
        selectedSource: null,
        selectedCard: null,
        canUsePiles: false,
        canUseGrid: false,
        canCancelSelection: false,
      };
    }
    if (!isHumanTurn) {
      return {
        phase: 'waiting',
        primaryLabel: 'Waiting for the table',
        selectedSource: activeSource,
        selectedCard: held,
        canUsePiles: false,
        canUseGrid: false,
        canCancelSelection: false,
        disabledReason: `Waiting for ${activePlayer?.name ?? 'Player'}.`,
      };
    }
    if (pendingForBottom && held) {
      return {
        phase: 'decision',
        primaryLabel: 'Choose which card stays',
        secondaryLabel: 'Keep revealed',
        selectedSource: activeSource,
        selectedCard: held,
        canUsePiles: false,
        canUseGrid: false,
        canCancelSelection: false,
      };
    }
    if (selectedForBottom && held) {
      return {
        phase: 'selectGrid',
        primaryLabel: selectedActionText,
        selectedSource: activeSource,
        selectedCard: held,
        canUsePiles: false,
        canUseGrid: true,
        canCancelSelection: true,
      };
    }
    if (held) {
      return {
        phase: 'selectGrid',
        primaryLabel: activeSource === 'discard' ? 'Choose grid card' : 'Choose grid card',
        secondaryLabel: heldCanDiscard ? 'Discard drawn' : undefined,
        selectedSource: activeSource,
        selectedCard: held,
        canUsePiles: canSwitchDiscardToDraw,
        canUseGrid: true,
        canCancelSelection: false,
      };
    }
    return {
      phase: 'draw',
      primaryLabel: 'Draw from a pile',
      selectedSource: activeSource,
      selectedCard: null,
      canUsePiles,
      canUseGrid: false,
      canCancelSelection: false,
      disabledReason: canUsePiles ? undefined : 'Waiting for your turn.',
    };
  }, [
    activePlayer?.name,
    activeSource,
    canSwitchDiscardToDraw,
    canUsePiles,
    held,
    heldCanDiscard,
    heldMustReplace,
    isHumanPeek,
    isHumanTurn,
    isRoundReveal,
    isRoundSummary,
    pendingForBottom,
    selectedActionText,
    selectedForBottom,
    state.phase,
  ]);
  const gameLayerState = useMemo<GameLayerState>(() => ({
    table: { visible: true },
    hud: { visible: true, showTimer, showScores: true },
    action: actionModel,
    social: { visible: isOnline, unreadCount: chatUnread },
    feedback: { notice: turnNotice, showCelebrations: true },
    modal: {
      active: chatOpen
        ? 'chat'
        : alertSettingsOpen
          ? 'settings'
          : showRoundSummary
            ? 'roundSummary'
            : showPassOverlay
              ? 'passDevice'
              : turnNotice
                ? 'notice'
                : 'none',
    },
  }), [actionModel, alertSettingsOpen, chatOpen, chatUnread, isOnline, showPassOverlay, showRoundSummary, showTimer, turnNotice]);

  useEffect(() => {
    if (!isOnline || !token || !roomCode || !user?.userId || !state.completed) return;
    const key = `${roomCode}:${state.lastRoundNumber ?? state.round ?? 0}:${state.totals?.join(',') ?? ''}`;
    if (matchProgressionKey.current === key) return;
    matchProgressionKey.current = key;
    let cancelled = false;
    api.myResults(token)
      .then(response => {
        if (cancelled) return;
        const result = response.results.find(item => item.roomCode === roomCode);
        const mine = result?.players.find(player => player.userId === user.userId);
        setMatchProgression(mine?.progression ?? null);
        refreshProfile().catch(() => {});
      })
      .catch(() => {
        if (!cancelled) setMatchProgression(null);
      });
    return () => {
      cancelled = true;
    };
  }, [
    isOnline,
    refreshProfile,
    roomCode,
    state.completed,
    state.lastRoundNumber,
    state.round,
    state.totals,
    token,
    user?.userId,
  ]);

  useEffect(() => {
    if (state.phase !== 'turn') return;
    if (!currentTurnUserId) return;
    const shouldAlert = isOnline
      ? currentTurnUserId === user?.userId
      : isSolo
        ? state.currentPlayerIndex === 0
        : true;
    if (!shouldAlert) {
      lastTurnAlertKey.current = null;
      return;
    }
    const key = `${state.id}:${state.round ?? round}:${state.turnSerial ?? `player:${state.currentPlayerIndex}`}:${state.currentPlayerIndex}:${state.sweepActive ? 'sweep' : 'main'}`;
    if (lastTurnAlertKey.current === key) return;
    lastTurnAlertKey.current = key;
    showGameplayNotice({
      id: `turn:${key}`,
      title: state.sweepActive ? 'Final Turn' : (isOnline || isSolo ? 'Your Turn' : `${currentTurnName}'s Turn`),
      body: state.sweepActive ? 'Final go-around. Make this one count.' : 'Choose the deck or discard pile.',
      tone: state.sweepActive ? 'warning' : 'turn',
    }, { vibration: state.sweepActive ? [90, 70, 90] : 80 });
  }, [
    currentTurnName,
    currentTurnUserId,
    isOnline,
    isSolo,
    round,
    showGameplayNotice,
    state.currentPlayerIndex,
    state.id,
    state.phase,
    state.round,
    state.sweepActive,
    state.turnSerial,
    user?.userId,
  ]);

  useEffect(() => {
    if (state.phase !== 'turn' || !state.sweepActive || state.sweepStarterIndex == null) return;
    const viewerIsCurrent = isOnline
      ? currentTurnUserId === user?.userId
      : isSolo
        ? state.currentPlayerIndex === 0
        : true;
    if (viewerIsCurrent) return;
    const viewerKey = isOnline && !viewerIsCurrent ? 'announcement' : `turn:${state.currentPlayerIndex}`;
    const key = `${state.id}:${state.round ?? round}:${state.sweepStarterIndex}:${viewerKey}`;
    if (lastSweepAlertKey.current === key) return;
    lastSweepAlertKey.current = key;
    showGameplayNotice({
      id: `sweep:${key}`,
      title: 'Final Go-Around',
      body: `${sweepStarterName} flipped their last card. Watch for your final turn.`,
      tone: 'warning',
    }, { notifyDevice: false, vibration: [90, 70, 90] });
  }, [
    currentTurnUserId,
    isOnline,
    isSolo,
    round,
    showGameplayNotice,
    state.currentPlayerIndex,
    state.id,
    state.phase,
    state.round,
    state.sweepActive,
    state.sweepStarterIndex,
    sweepStarterName,
    user?.userId,
  ]);

  // ===== Actions =====
  const onPressGrid = (r: number, c: number) => {
    if (state.phase === 'peek') {
      if (!isHumanPeek || !isActiveGridVisible) return;
      const peekPlayerIndex = isOnline && onlineViewerIndex >= 0
        ? onlineViewerIndex
        : (state.peekTurnIndex ?? bottomIndex);
      const peekCard = state.players[peekPlayerIndex]?.grid?.[r]?.[c];
      if (!peekCard || peekCard.faceUp) return;
      if (isOnline && token && roomCode) {
        sendGameIntent(token, roomCode, 'peek', { r, c }).catch(error => handleOnlineActionError('Move rejected', error));
        return;
      }
      setState(s => {
        if (s.peekTurnIndex == null) return s;
        return flipForPeek(s, r, c);
      });
      return;
    }

    if (!isHumanTurn || state.phase !== 'turn') return;
    if (!held) {
      Alert.alert('Draw first', 'Pick up a card from the deck or discard pile before choosing a grid card.');
      return;
    }
    if (state.pendingDecision) {
      Alert.alert('Choose a card', 'Finish the revealed-card decision first.');
      return;
    }
    setSelectedCell({ playerIndex: state.currentPlayerIndex, r, c });
  };

  const onCancelSelection = () => setSelectedCell(null);

  const onConfirmSelection = () => {
    if (!isHumanTurn || !held || !selectedCell || state.phase !== 'turn') return;
    if (selectedCell.playerIndex !== state.currentPlayerIndex) return;
    if (state.pendingDecision) {
      Alert.alert('Choose a card', 'Finish the revealed-card decision first.');
      return;
    }
    const { r, c } = selectedCell;
    const cell = state.players[state.currentPlayerIndex]?.grid?.[r]?.[c];
    if (!cell) return;

    if (cell.faceUp) {
      if (isOnline && token && roomCode) {
        sendGameIntent(token, roomCode, 'replace', { r, c, card: held })
          .then(() => {
            setHeld(null);
            setSelectedCell(null);
            setActiveSource(null);
            setHeldMustReplace(false);
            setHeldCanDiscard(false);
          })
          .catch(error => handleOnlineActionError('Move rejected', error));
      } else {
        setState(s => replaceGridCard(s, s.currentPlayerIndex, r, c, held));
        setHeld(null);
        setSelectedCell(null);
        setActiveSource(null);
        setHeldMustReplace(false);
        setHeldCanDiscard(false);
      }
      return;
    }

    if (isOnline && token && roomCode) {
      sendGameIntent(token, roomCode, 'reveal', { r, c })
        .then(() => setSelectedCell(null))
        .catch(error => handleOnlineActionError('Move rejected', error));
      return;
    }

    setState(s => {
      if (s.phase !== 'turn') return s;
      const result = revealGridCardForDecision(s, s.currentPlayerIndex, r, c);
      if (result.error) return s;
      setPending({ playerIndex: s.currentPlayerIndex, r, c });
      setSelectedCell(null);
      return result.state as GameState;
    });
  };

  const onDraw = () => {
    if (!isHumanTurn) return;
    if (canSwitchDiscardToDraw && held) {
      const previousHeld = held;
      if (isOnline && token && roomCode) {
        setHeld(null);
        setActiveSource('draw');
        setHeldMustReplace(false);
        setHeldCanDiscard(false);
        setPending(null);
        setSelectedCell(null);
        sendGameIntent(token, roomCode, 'switchDiscardToDraw')
          .then(res => {
            if (res.drawn) setHeld(res.drawn as Card);
          })
          .catch(error => {
            setHeld(previousHeld);
            setActiveSource('discard');
            setHeldMustReplace(countFaceDownCards(state.players[state.currentPlayerIndex]?.grid) === 1 && !state.sweepActive);
            setHeldCanDiscard(false);
            handleOnlineActionError('Draw rejected', error);
          });
        return;
      }

      const restored = structuredClone(state) as GameState;
      const restoredCard = { ...previousHeld, faceUp: true };
      restored.discardPile.push(restoredCard);
      restored.topDiscard = restoredCard;
      const result = drawFromDeck(restored);
      if (!result.drawn) {
        Alert.alert('Draw rejected', 'No card available.');
        return;
      }
      const faceDownCount = countFaceDownCards(result.state.players[result.state.currentPlayerIndex]?.grid);
      const isBonusDraw = result.state.mustDrawOnlyForPlayerIndex === result.state.currentPlayerIndex;
      setHeld(result.drawn);
      setActiveSource('draw');
      setHeldMustReplace(false);
      setHeldCanDiscard(isBonusDraw || (faceDownCount === 1 && !result.state.sweepActive));
      setPending(null);
      setSelectedCell(null);
      setState(result.state);
      return;
    }
    if (state.phase !== 'turn' || held || !canUsePiles) return;
    if (state.pendingDecision) {
      Alert.alert('Choose a card', 'Finish the revealed-card decision first.');
      return;
    }
    if (isOnline && token && roomCode) {
      setActiveSource('draw');
      setHeldMustReplace(false);
      setHeldCanDiscard(isBonusDrawTurn || (countFaceDownCards(state.players[state.currentPlayerIndex]?.grid) === 1 && !state.sweepActive));
      sendGameIntent(token, roomCode, 'draw')
        .then(res => setHeld(res.drawn as Card))
        .catch(error => {
          setActiveSource(null);
          setHeldCanDiscard(false);
          handleOnlineActionError('Draw rejected', error);
        });
      setPending(null);
      setSelectedCell(null);
      return;
    }
    const { state: next, drawn } = drawFromDeck(state);
    setHeld(drawn);
    setActiveSource('draw');
    setHeldMustReplace(false);
    setHeldCanDiscard(isBonusDrawTurn || (countFaceDownCards(state.players[state.currentPlayerIndex]?.grid) === 1 && !state.sweepActive));
    setPending(null);
    setSelectedCell(null);
    setState(next);
  };

  const takeDiscardNow = () => {
    const mustReplace = countFaceDownCards(state.players[state.currentPlayerIndex]?.grid) === 1 && !state.sweepActive;
    if (isOnline && token && roomCode) {
      setActiveSource('discard');
      setHeldMustReplace(mustReplace);
      setHeldCanDiscard(false);
      sendGameIntent(token, roomCode, 'takeDiscard')
        .then(res => { if (res.drawn) setHeld(res.drawn as Card); })
        .catch(error => {
          setActiveSource(null);
          setHeldMustReplace(false);
          setHeldCanDiscard(false);
          handleOnlineActionError('Take rejected', error);
        });
      setPending(null);
      setSelectedCell(null);
      return;
    }
    const { state: next, drawn } = takeDiscard(state);
    if (drawn) setHeld(drawn);
    setActiveSource('discard');
    setHeldMustReplace(mustReplace);
    setHeldCanDiscard(false);
    setPending(null);
    setSelectedCell(null);
    setState(next);
  };

  const onTakeDiscard = () => {
    if (!isHumanTurn) return;
    if (state.phase !== 'turn' || held || !canUsePiles) return;
    if (state.pendingDecision) {
      Alert.alert('Choose a card', 'Finish the revealed-card decision first.');
      return;
    }
    if (isDrawOnlyTurn) {
      Alert.alert('Deck only', 'Extra turns must draw from the deck.');
      return;
    }
    takeDiscardNow();
  };

  const onDiscardHeld = () => {
    if (!isHumanTurn || !held || pending || state.pendingDecision || state.phase !== 'turn') return;
    if (activeSource === 'discard') {
      Alert.alert('Play this card', 'Cards taken from the discard pile must be played to your grid.');
      return;
    }
    if (!heldCanDiscard) {
      Alert.alert('Play this card', 'Drawn cards can only be discarded when you have one face-down card left.');
      return;
    }
    if (isOnline && token && roomCode) {
      sendGameIntent(token, roomCode, 'discard').catch(error => handleOnlineActionError('Discard rejected', error));
    } else {
      setState(s => discardDrawn(s, held));
    }
    setHeld(null);
    setPending(null);
    setSelectedCell(null);
    setActiveSource(null);
    setHeldMustReplace(false);
    setHeldCanDiscard(false);
  };

  const onKeepRevealed = () => {
    if (!isHumanTurn || !held || !pending) return;
    if (pending.playerIndex !== bottomIndex) return;
    if (isOnline && token && roomCode) {
      sendGameIntent(token, roomCode, 'discard', { card: held }).catch(error => handleOnlineActionError('Discard rejected', error));
    } else {
      setState(s => resolvePendingGridDecision(s, pending.playerIndex, held, 'revealed').state as GameState);
    }
    setHeld(null);
    setPending(null);
    setSelectedCell(null);
    setActiveSource(null);
    setHeldMustReplace(false);
    setHeldCanDiscard(false);
  };

  const onKeepDrawn = () => {
    if (!isHumanTurn || !held || !pending) return;
    if (pending.playerIndex !== bottomIndex) return;
    if (isOnline && token && roomCode) {
      sendGameIntent(token, roomCode, 'replace', { r: pending.r, c: pending.c, card: held }).catch(error => handleOnlineActionError('Move rejected', error));
    } else {
      setState(s => resolvePendingGridDecision(s, pending.playerIndex, held, 'drawn').state as GameState);
    }
    setHeld(null);
    setPending(null);
    setSelectedCell(null);
    setActiveSource(null);
    setHeldMustReplace(false);
    setHeldCanDiscard(false);
  };

  const onSendChat = async (type: ChatMessageType, text: string) => {
    if (!isOnline || !token || !roomCode || chatSending) return;
    const clean = text.trim();
    if (!clean) return;
    setChatSending(true);
    try {
      await sendChatMessage(token, roomCode, type, clean);
      if (type === 'text') setChatText('');
    } catch (error) {
      Alert.alert('Chat not sent', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setChatSending(false);
    }
  };

  const onSendClubChat = async (text: string) => {
    if (!token || !user?.club?.clubId || clubChatSending) return;
    const clean = text.trim();
    if (!clean) return;
    setClubChatSending(true);
    try {
      await sendClubMessage(clean);
      setClubChatText('');
    } catch (error) {
      Alert.alert('Club chat not sent', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setClubChatSending(false);
    }
  };

  const reloadAvatarHubProfile = useCallback(async (userId: string) => {
    if (!token || userId === user?.userId) return;
    setAvatarHubLoading(true);
    try {
      const response = await api.publicProfile(token, userId);
      setAvatarHubProfile(response.profile);
    } catch {
      setAvatarHubProfile(null);
    } finally {
      setAvatarHubLoading(false);
    }
  }, [token, user?.userId]);

  const sendGiftToPlayer = useCallback(async (targetUserId: string, giftId: string) => {
    if (!isOnline || !token || !roomCode || avatarHubBusy) return;
    setAvatarHubBusy(giftId);
    try {
      await sendChatMessage(token, roomCode, 'gift', giftId, targetUserId);
      refreshProfile().catch(() => {});
    } catch (error) {
      Alert.alert('Gift not sent', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setAvatarHubBusy(null);
    }
  }, [avatarHubBusy, isOnline, refreshProfile, roomCode, token]);

  const equipAvatarHubCosmetic = useCallback(async (item: api.CosmeticItem) => {
    if (!token || avatarHubBusy || !item.owned || item.equipped) return;
    setAvatarHubBusy(`cosmetic:${item.id}`);
    try {
      const response = await api.equipCosmetic(token, item.id);
      setAvatarHubCosmeticCatalog(response.cosmetics);
      await refreshProfile().catch(() => {});
    } catch (error) {
      Alert.alert('Cosmetic update failed', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setAvatarHubBusy(null);
    }
  }, [avatarHubBusy, refreshProfile, token]);

  const runAvatarHubFriendAction = useCallback(async () => {
    if (!token || !avatarHubProfile || avatarHubBusy) return;
    setAvatarHubBusy('friend');
    try {
      if (avatarHubProfile.relationship === 'none') {
        await api.sendFriendRequest(token, avatarHubProfile.userId);
      } else if (avatarHubProfile.relationship === 'friend') {
        await api.removeFriend(token, avatarHubProfile.userId);
      } else if (avatarHubProfile.relationship === 'incoming') {
        const social = await api.socialMe(token);
        const request = social.social.incomingRequests.find(item => item.player.userId === avatarHubProfile.userId);
        if (!request) throw new Error('Friend request not found.');
        await api.acceptFriendRequest(token, request.id);
      }
      await reloadAvatarHubProfile(avatarHubProfile.userId);
    } catch (error) {
      Alert.alert('Social action failed', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setAvatarHubBusy(null);
    }
  }, [avatarHubBusy, avatarHubProfile, reloadAvatarHubProfile, token]);

  const inviteAvatarHubPlayer = useCallback(async () => {
    if (!token || !roomCode || !avatarHubProfile || avatarHubBusy) return;
    setAvatarHubBusy('invite');
    try {
      await api.inviteFriendToRoom(token, roomCode, avatarHubProfile.userId);
      Alert.alert('Invite sent', `${avatarHubProfile.displayName} can join from Social.`);
    } catch (error) {
      Alert.alert('Invite failed', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setAvatarHubBusy(null);
    }
  }, [avatarHubBusy, avatarHubProfile, roomCode, token]);

  // ===== Render =====
  const bottomRoomPlayer = roomPlayersById.get(bottomPlayer.userId);
  const bottomConnected = !isOnline || (bottomRoomPlayer?.connected ?? bottomPlayer.connected ?? true);
  const bottomClubTag = bottomRoomPlayer?.club?.tag ?? (bottomPlayer.userId === user?.userId ? user?.club?.tag : null);
  const selfClaimableCount =
    (user?.currency.dailyBonus.canClaim ? 1 : 0)
    + (user?.challenges.daily.items.filter(item => item.canClaim).length ?? 0)
    + (user?.challenges.weekly.items.filter(item => item.canClaim).length ?? 0)
    + (user?.competitive.season.rewards.filter(item => item.earned && !item.claimed).length ?? 0);
  const avatarHubPlayer = avatarHubUserId
    ? state.players.find(player => player.userId === avatarHubUserId)
    : undefined;
  const avatarHubRoomPlayer = avatarHubUserId ? roomPlayersById.get(avatarHubUserId) : undefined;
  const avatarHubIsSelf = !!avatarHubUserId && avatarHubUserId === user?.userId;
  const avatarHubCosmetics = avatarHubIsSelf
    ? user?.inventory.equipped
    : avatarHubProfile?.cosmetics ?? avatarHubRoomPlayer?.cosmetics ?? avatarHubPlayer?.cosmetics ?? null;
  const avatarHubName = avatarHubIsSelf
    ? user?.displayName ?? 'You'
    : avatarHubProfile?.displayName ?? avatarHubRoomPlayer?.displayName ?? avatarHubPlayer?.name ?? 'Player';
  const avatarHubInitial = avatarHubIsSelf
    ? user?.avatarInitial ?? avatarHubName
    : avatarHubProfile?.avatarInitial ?? avatarHubRoomPlayer?.avatarInitial ?? avatarHubPlayer?.avatarInitial ?? avatarHubName;
  const avatarHubLeague = avatarHubIsSelf
    ? user?.displayRankEmblem?.league
    : avatarHubProfile?.displayRankEmblem?.league ?? avatarHubRoomPlayer?.displayRankEmblem?.league ?? avatarHubPlayer?.displayRankEmblem?.league;
  const avatarHubProgress = avatarHubIsSelf
    ? user?.progression
    : avatarHubProfile?.progression ?? avatarHubRoomPlayer?.progression ?? null;
  const avatarHubLockerGroups = useMemo(() => {
    const owned = avatarHubCosmeticCatalog.filter(item => item.owned);
    return [
      { key: 'avatarIcon', title: 'Avatar Icons', empty: 'No owned avatar icons yet.', items: owned.filter(item => item.type === 'avatarIcon') },
      { key: 'cardBack', title: 'Card Backs', empty: 'No owned card backs yet.', items: owned.filter(item => item.type === 'cardBack') },
      { key: 'avatarFrame', title: 'Avatar Frames', empty: 'No owned avatar frames yet.', items: owned.filter(item => item.type === 'avatarFrame') },
      { key: 'avatarAccessory', title: 'Accessories', empty: 'No owned accessories yet.', items: owned.filter(item => item.type === 'avatarAccessory') },
      { key: 'title', title: 'Titles', empty: 'No owned titles yet.', items: owned.filter(item => item.type === 'title') },
      { key: 'tableTheme', title: 'Table Themes', empty: 'No owned table themes yet.', items: owned.filter(item => item.type === 'tableTheme') },
    ];
  }, [avatarHubCosmeticCatalog]);
  const bottomActiveGift = avatarGifts[bottomPlayer.userId]?.type === 'gift' ? avatarGifts[bottomPlayer.userId] : null;
  const bottomActiveGiftOption = bottomActiveGift?.giftId ? TABLE_GIFTS_BY_ID.get(bottomActiveGift.giftId) : null;
  const timerLabel = `${secsLeft}s`;
  const renderOpponentCard = (opponent: (typeof opponents)[number], slot: 'top' | 'side') => {
    const { p, i } = opponent;
    const roomPlayer = roomPlayersById.get(p.userId);
    const connected = !isOnline || (roomPlayer?.connected ?? p.connected ?? true);
    const active = i === activeIndex && !isRoundReveal && !isRoundSummary;
    const activeGift = avatarGifts[p.userId]?.type === 'gift' ? avatarGifts[p.userId] : null;
    const activeGiftOption = activeGift?.giftId ? TABLE_GIFTS_BY_ID.get(activeGift.giftId) : null;
    const opponentName = roomPlayer?.displayName ?? p.name ?? 'Player';
    const opponentClubTag = roomPlayer?.club?.tag;
    return (
      <View
        key={`${slot}:${p.id ?? p.userId ?? i}`}
        style={[
          styles.oppCard,
          slot === 'top' ? styles.oppCardTop : styles.oppCardSide,
          { backgroundColor: tableTheme.panelColor, borderColor: tableTheme.borderColor },
          active && [styles.oppCardActive, { borderColor: tableTheme.accentColor, backgroundColor: tableTheme.activePanelColor }],
          {
            width: tableLayout.oppPanelWidth,
            padding: tableLayout.oppPadding,
            overflow: 'visible',
          },
        ]}
      >
        <SocialBurstBubble burst={socialBursts[p.userId]} compact />
        <View style={styles.playerGridHeader}>
          <AvatarCluster
            cosmetics={playerCosmetics(p, i)}
            fallbackInitial={p.avatarInitial ?? p.name}
            size={34}
            mode="opponent"
            league={roomPlayer?.displayRankEmblem?.league ?? p.displayRankEmblem?.league}
            showGift={isOnline && p.userId !== user?.userId}
            giftIcon={activeGift?.giftIcon ?? activeGiftOption?.icon ?? null}
            giftAccent={activeGiftOption?.accent ?? null}
            connectionState={connected ? 'online' : 'offline'}
            onPress={() => openAvatarHub(p.userId)}
            onGiftPress={() => openAvatarHub(p.userId)}
            disabled={!isOnline && p.userId !== user?.userId}
          />
          <View style={styles.inlineScores}>
            <Text style={styles.scoreNow}>Now {visibleRoundScores[i] ?? 0}</Text>
            <Text style={styles.scoreValue}>Tot {totals[i] ?? 0}</Text>
          </View>
        </View>
        <Text
          style={styles.oppGridName}
          numberOfLines={1}
        >
          {opponentClubTag ? <Text style={styles.clubTagText}>[{opponentClubTag}] </Text> : null}{opponentName}
        </Text>
        <GridView
          grid={p.grid}
          metrics={metrics.opp}
          activeCell={pending?.playerIndex === i ? pending : null}
          cardBackId={playerCosmetics(p, i)?.cardBack}
        />
      </View>
    );
  };
  return (
    <LinearGradient colors={[tableTheme.backgroundColor, ui.palette.ink, ui.surface.base]} style={styles.container}>
      {/* HUD Layer */}
      <View style={[styles.header, {
        paddingTop: Math.max(14, insets.top + 8),
        backgroundColor: tableTheme.headerColor,
        borderBottomColor: tableTheme.borderColor,
        zIndex: layerZ.hud,
      }]}>
        <View style={[styles.turnStatusChip, { backgroundColor: tableTheme.panelColor, borderColor: bottomIsActive ? tableTheme.accentColor : tableTheme.borderColor }]}>
          <Text style={styles.heading}>{hudTitle}</Text>
          <Text style={styles.turnInstruction}>{hudInstruction}</Text>
        </View>
        {isOnline ? (
          <Pressable
            style={[styles.chatButton, { backgroundColor: tableTheme.panelColor, borderColor: tableTheme.borderColor }]}
            onPress={() => {
              setChatOpen(true);
              setChatUnread(0);
            }}
          >
            <MessageCircle size={22} color={ui.text.primary} strokeWidth={2.5} />
            {gameLayerState.social.unreadCount > 0 ? (
              <View style={styles.chatBadge}>
                <Text style={styles.chatBadgeText}>{gameLayerState.social.unreadCount > 9 ? '9+' : gameLayerState.social.unreadCount}</Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}
        {user?.club?.clubId ? (
          <Pressable
            style={[styles.chatButton, { backgroundColor: tableTheme.panelColor, borderColor: tableTheme.borderColor }]}
            onPress={() => setClubChatOpen(true)}
          >
            <Users size={22} color={ui.palette.emerald} strokeWidth={2.5} />
            {clubChatUnread > 0 ? (
              <View style={styles.chatBadge}>
                <Text style={styles.chatBadgeText}>{clubChatUnread > 9 ? '9+' : clubChatUnread}</Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}
        <Pressable
          style={[styles.chatButton, { backgroundColor: tableTheme.panelColor, borderColor: tableTheme.borderColor }]}
          onPress={() => setShopOpen(true)}
        >
          <ShoppingBag size={22} color={ui.palette.gold} strokeWidth={2.5} />
        </Pressable>
        <Pressable
          style={[styles.chatButton, { backgroundColor: tableTheme.panelColor, borderColor: tableTheme.borderColor }]}
          onPress={() => setAlertSettingsOpen(true)}
        >
          <Settings size={22} color={ui.text.primary} strokeWidth={2.7} />
        </Pressable>
        {gameLayerState.hud.showTimer ? (
          <View style={[styles.timerChip, secsLeft <= 5 && !isRoundReveal && !isRoundSummary && styles.timerDanger]}>
            <Text style={styles.timerText}>{timerLabel}</Text>
            <Text style={styles.roundText}>R{round}/{TOTAL_ROUNDS}</Text>
          </View>
        ) : null}
        {showRoundChip ? (
          <View style={styles.roundChip}>
            <Text style={styles.roundChipLabel}>Round</Text>
            <Text style={styles.roundChipText}>{round}/{TOTAL_ROUNDS}</Text>
          </View>
        ) : null}
      </View>

      {/* Table/Base Layer */}
      <View style={[styles.tableZone, { paddingHorizontal: tableLayout.sidePad, gap: tableLayout.gap }]}>
        {opponents.length ? (
          <View style={[styles.tableOpponentRow, { gap: tableLayout.gap }]}>
            {opponents.map(opponent => (
              <View key={opponent.p.userId ?? opponent.i} style={[styles.tableOpponentSlot, { width: tableLayout.oppPanelWidth }]}>
                {renderOpponentCard(opponent, 'top')}
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.tablePilesOnlyRow}>
          <View style={[styles.tableCenterSlot, { width: tableLayout.centerSlotWidth }]}>
            <Piles
              drawCount={state.drawPile.length}
              topDiscard={state.topDiscard}
              held={held}
              metrics={tableLayout.pileMetrics}
              compact
              onDraw={onDraw}
              onTakeDiscard={onTakeDiscard}
              activeSource={activeSource}
              cardBackId={bottomCardBackId}
              disableDraw={!canUsePiles && !canSwitchDiscardToDraw}
              disableTake={!canUsePiles || isDrawOnlyTurn || !!state.pendingDecision || !state.topDiscard}
              discardFlashKey={discardFlash?.key ?? null}
              discardFlashCount={discardFlash?.count ?? 0}
            />
          </View>
        </View>
      </View>

      {/* Action Layer: local grid */}
      <View
        style={[
          styles.localPanel,
          bottomIsActive && [
            styles.localPanelActive,
            { borderTopColor: tableTheme.accentColor, backgroundColor: tableTheme.activePanelColor },
          ],
        ]}
        pointerEvents={canUseGrid ? 'auto' : 'none'}
      >
        <SocialBurstBubble burst={socialBursts[bottomPlayer.userId]} />
        <View style={styles.localTitleRow}>
          <View style={styles.localIdentity}>
            <AvatarCluster
              cosmetics={playerCosmetics(bottomPlayer, bottomIndex)}
              fallbackInitial={bottomPlayer.avatarInitial ?? bottomPlayer.name}
              size={48}
              mode="self"
              league={user?.displayRankEmblem?.league ?? bottomRoomPlayer?.displayRankEmblem?.league ?? bottomPlayer.displayRankEmblem?.league}
              showGift={!!bottomActiveGift}
              giftIcon={bottomActiveGift?.giftIcon ?? bottomActiveGiftOption?.icon ?? null}
              giftAccent={bottomActiveGiftOption?.accent ?? null}
              connectionState={bottomConnected ? 'online' : 'offline'}
              onPress={() => openAvatarHub(bottomPlayer.userId ?? user?.userId)}
              disabled={!(bottomPlayer.userId ?? user?.userId) || (!isOnline && (bottomPlayer.userId ?? user?.userId) !== user?.userId)}
            />
            <View style={styles.localTitlePressable}>
              <Text
                style={[styles.meTitle, bottomIsActive && styles.activeName]}
                numberOfLines={1}
              >
                {bottomClubTag ? <Text style={styles.clubTagText}>[{bottomClubTag}] </Text> : null}
                {isOnline ? (bottomRoomPlayer?.displayName ?? bottomPlayer.name ?? 'Your Grid') : isSolo ? bottomPlayer.name : bottomPlayer.name}
              </Text>
              <Text style={styles.playerGridMeta}>
                {bottomIsActive && !isRoundReveal && !isRoundSummary ? (state.phase === 'peek' ? 'PEEK' : 'TURN') : bottomConnected ? 'ONLINE' : 'OFFLINE'}
              </Text>
              {user?.progression ? (
                <View style={styles.selfXpTrack}>
                  <View style={[styles.selfXpFill, { width: `${Math.round((user.progression.levelProgress || 0) * 100)}%` }]} />
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.localScoreBox}>
            <Text style={styles.scoreNow}>Now {visibleRoundScores[bottomIndex] ?? 0}</Text>
            <Text style={styles.scoreValue}>Tot {totals[bottomIndex] ?? 0}</Text>
          </View>
        </View>
        <GridView
          grid={bottomPlayer.grid}
          onPressCard={onPressGrid}
          metrics={metrics.me}
          activeCell={bottomActiveCell}
          cardBackId={bottomCardBackId}
        />
      </View>

      {/* Action Layer: decision dock */}
      <View style={[styles.footer, {
        paddingBottom: Math.max(8, insets.bottom + 6),
        backgroundColor: tableTheme.headerColor,
        borderTopColor: tableTheme.borderColor,
      }]}>
        {pendingForBottom && held ? (
          <View style={styles.decisionButtons}>
            <Pressable style={styles.altBtn} onPress={onKeepRevealed}>
              <DecisionButtonContent label="Keep Revealed" card={pendingRevealedCard} />
            </Pressable>
            <Pressable style={[styles.altBtn, styles.altBtnPrimary]} onPress={onKeepDrawn}>
              <DecisionButtonContent label="Keep Drawn" card={held} primary />
            </Pressable>
          </View>
        ) : selectedForBottom && held ? (
          <View style={styles.decisionButtons}>
            <Pressable style={styles.cancelBtn} onPress={onCancelSelection}>
              <Text style={styles.cancelBtnText}>X</Text>
            </Pressable>
            <Pressable style={[styles.altBtn, styles.altBtnPrimary]} onPress={onConfirmSelection}>
              <Text style={[styles.altBtnText, { color: '#0B1023' }]}>{selectedActionText}</Text>
            </Pressable>
          </View>
        ) : held && activeSource === 'draw' && heldCanDiscard ? (
          <View style={styles.decisionButtons}>
            <Pressable style={styles.altBtn} onPress={onDiscardHeld}>
              <Text style={styles.altBtnText}>Discard Drawn</Text>
            </Pressable>
            <View style={styles.nextStepPanelCompact}>
              <Text style={styles.nextStepText}>Tap grid to keep</Text>
            </View>
          </View>
        ) : isRoundReveal ? (
          <View style={styles.nextStepPanel}>
            <Text style={styles.nextStepText}>Final hidden cards are revealing</Text>
          </View>
        ) : (
          <View style={styles.nextStepPanel}>
            <Text style={styles.nextStepText}>
              {actionCopy(gameLayerState.action)}
            </Text>
          </View>
        )}
      </View>

      {/* Feedback Layer */}
      <Modal
        transparent
        visible={isFocused && shopOpen}
        animationType="slide"
        onRequestClose={() => setShopOpen(false)}
      >
        <View style={styles.shopOverlay}>
          <Pressable style={styles.shopDismissArea} onPress={() => setShopOpen(false)} accessibilityRole="button" accessibilityLabel="Return to match" />
          <View style={[styles.shopSheet, { backgroundColor: tableTheme.panelColor, borderColor: tableTheme.borderColor }]}>
            <View style={styles.shopSheetHeader}>
              <View>
                <Text style={styles.shopSheetEyebrow}>In Match</Text>
                <Text style={styles.shopSheetTitle}>Storefront</Text>
              </View>
              <Pressable style={styles.shopCloseButton} onPress={() => setShopOpen(false)} accessibilityRole="button" accessibilityLabel="Close shop and return to match">
                <X size={24} color={ui.text.primary} strokeWidth={3} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.shopScrollContent} keyboardShouldPersistTaps="handled">
              {shopOpen ? <ShopContent embedded backLabel="Back to Match" onBack={() => setShopOpen(false)} /> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={isFocused && !!avatarHubUserId}
        animationType="fade"
        onRequestClose={() => setAvatarHubUserId(null)}
      >
        <View style={styles.avatarHubScrim}>
          <Pressable style={styles.avatarHubDismissArea} onPress={() => setAvatarHubUserId(null)} />
          <View style={[styles.avatarHubSheet, { backgroundColor: tableTheme.panelColor, borderColor: tableTheme.borderColor }]}>
            <View style={styles.avatarHubHeader}>
              <View style={styles.avatarHubHero}>
                {avatarHubIsSelf ? (
                  <AvatarCluster
                    cosmetics={avatarHubCosmetics}
                    fallbackInitial={avatarHubInitial}
                    size={74}
                    mode="self"
                    league={avatarHubLeague}
                  />
                ) : (
                  <PlayerAvatar
                    cosmetics={avatarHubCosmetics}
                    fallbackInitial={avatarHubInitial}
                    size={68}
                  />
                )}
                <View style={styles.avatarHubCopy}>
                  <Text style={styles.avatarHubName} numberOfLines={1}>
                    {avatarHubIsSelf ? 'Your Avatar' : avatarHubName}
                  </Text>
                  <Text style={styles.avatarHubMeta} numberOfLines={1}>
                    {avatarHubLoading
                      ? 'Loading...'
                      : avatarHubIsSelf
                        ? `Level ${user?.progression.level ?? 1}${user?.displayRankEmblem ? ` - ${user.displayRankEmblem.league.name}` : ''}`
                        : `${avatarHubProfile?.competitive.league.name ?? avatarHubRoomPlayer?.competitive?.league.name ?? 'Unranked'} - ${(avatarHubRoomPlayer?.connected ?? avatarHubProfile?.status.online) ? 'Online' : 'Offline'}`}
                  </Text>
                </View>
                <Pressable style={styles.avatarHubCloseButton} onPress={() => setAvatarHubUserId(null)}>
                  <X size={22} color={ui.text.primary} strokeWidth={3} />
                </Pressable>
              </View>
              {avatarHubProgress ? (
                <View style={styles.avatarHubXpTrack}>
                  <View style={[styles.avatarHubXpFill, { width: `${Math.round((avatarHubProgress.levelProgress || 0) * 100)}%` }]} />
                </View>
              ) : null}
            </View>

            <ScrollView style={styles.avatarHubScroll} contentContainerStyle={styles.avatarHubScrollContent} showsVerticalScrollIndicator={false}>
            {avatarHubIsSelf ? (
              <View style={styles.avatarHubBody}>
                <View style={styles.avatarHubStatRow}>
                  <HubStat label="Level" value={String(user?.progression.level ?? 1)} />
                  <HubStat label="Emblem" value={user?.displayRankEmblem ? rankEmblemForLeague(user.displayRankEmblem.league).label : 'Hidden'} />
                  <HubStat label="Ready" value={String(selfClaimableCount)} />
                </View>
                <View style={styles.avatarHubActionGrid}>
                  <Pressable
                    style={styles.avatarHubAction}
                    onPress={() => {
                      refreshProfile().catch(() => {});
                    }}
                  >
                    <Trophy size={20} color="#52E5A7" strokeWidth={2.8} />
                    <Text style={styles.avatarHubActionText}>Profile</Text>
                  </Pressable>
                  <Pressable
                    style={styles.avatarHubAction}
                    onPress={() => {
                      if (!token) return;
                      setAvatarHubCosmeticsLoading(true);
                      api.cosmeticCatalog(token)
                        .then(response => setAvatarHubCosmeticCatalog(response.cosmetics))
                        .catch(() => setAvatarHubCosmeticCatalog([]))
                        .finally(() => setAvatarHubCosmeticsLoading(false));
                    }}
                  >
                    <Gem size={20} color="#BDEBFF" strokeWidth={2.8} />
                    <Text style={styles.avatarHubActionText}>Cosmetics</Text>
                  </Pressable>
                  <Pressable
                    style={styles.avatarHubAction}
                    onPress={() => {
                      setAvatarHubUserId(null);
                      setShopOpen(true);
                    }}
                  >
                    <ShoppingBag size={20} color="#FFCC66" strokeWidth={2.8} />
                    <Text style={styles.avatarHubActionText}>Shop</Text>
                  </Pressable>
                  <Pressable
                    style={styles.avatarHubAction}
                    onPress={() => {
                      refreshProfile().catch(() => {});
                    }}
                  >
                    <Bell size={20} color="#FF6B6B" strokeWidth={2.8} />
                    <Text style={styles.avatarHubActionText}>Rewards</Text>
                  </Pressable>
                </View>
                <Text style={styles.avatarHubSectionTitle}>Quick Locker</Text>
                {avatarHubCosmeticsLoading ? (
                  <Text style={styles.avatarHubEmptyText}>Loading owned cosmetics...</Text>
                ) : (
                  avatarHubLockerGroups.map(group => (
                    <View key={group.key} style={styles.lockerSection}>
                      <Text style={styles.lockerTitle}>{group.title}</Text>
                      {group.items.length ? (
                        <View style={styles.lockerGrid}>
                          {group.items.map(item => {
                            const busy = avatarHubBusy === `cosmetic:${item.id}`;
                            return (
                              <Pressable
                                key={item.id}
                                style={[styles.lockerChip, item.equipped && styles.lockerChipEquipped, busy && styles.avatarHubActionDisabled]}
                                disabled={item.equipped || busy || !!avatarHubBusy}
                                onPress={() => equipAvatarHubCosmetic(item)}
                              >
                                <Text style={styles.lockerName} numberOfLines={1}>{item.name}</Text>
                                <Text style={[styles.lockerState, item.equipped && styles.lockerStateEquipped]} numberOfLines={1}>
                                  {item.equipped ? 'Equipped' : busy ? 'Equipping...' : 'Equip'}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      ) : (
                        <Text style={styles.avatarHubEmptyText}>{group.empty}</Text>
                      )}
                    </View>
                  ))
                )}
              </View>
            ) : (
              <View style={styles.avatarHubBody}>
                <View style={styles.avatarHubStatRow}>
                  <HubStat label="Games" value={String(avatarHubProfile?.statistics.gamesPlayed ?? avatarHubProfile?.stats.gamesPlayed ?? '--')} />
                  <HubStat label="Wins" value={String(avatarHubProfile?.statistics.wins ?? avatarHubProfile?.stats.wins ?? '--')} />
                  <HubStat label="Emblem" value={avatarHubLeague ? rankEmblemForLeague(avatarHubLeague).label : 'Hidden'} />
                </View>
                <View style={styles.avatarHubActionGrid}>
                  <Pressable
                    style={styles.avatarHubAction}
                    onPress={() => {
                      if (!avatarHubUserId) return;
                      setAvatarHubUserId(null);
                      navigation.navigate('PlayerProfile', { userId: avatarHubUserId, fromActiveMatchRoomCode: roomCode });
                    }}
                  >
                    <Trophy size={20} color="#52E5A7" strokeWidth={2.8} />
                    <Text style={styles.avatarHubActionText}>Full Profile</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.avatarHubAction, (!avatarHubProfile || avatarHubProfile.relationship === 'outgoing') && styles.avatarHubActionDisabled]}
                    disabled={!avatarHubProfile || avatarHubProfile.relationship === 'outgoing' || avatarHubBusy === 'friend'}
                    onPress={runAvatarHubFriendAction}
                  >
                    <UserPlus size={20} color="#BDEBFF" strokeWidth={2.8} />
                    <Text style={styles.avatarHubActionText}>{friendActionLabel(avatarHubProfile?.relationship)}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.avatarHubAction, avatarHubProfile?.relationship !== 'friend' && styles.avatarHubActionDisabled]}
                    disabled={avatarHubProfile?.relationship !== 'friend' || avatarHubBusy === 'invite'}
                    onPress={inviteAvatarHubPlayer}
                  >
                    <MessageCircle size={20} color="#FFCC66" strokeWidth={2.8} />
                    <Text style={styles.avatarHubActionText}>Invite</Text>
                  </Pressable>
                </View>
                <Text style={styles.avatarHubSectionTitle}>Send Gift</Text>
                <View style={styles.giftGrid}>
                  {TABLE_GIFTS.map(gift => (
                    <Pressable
                      key={gift.id}
                      style={[
                        styles.giftChip,
                        { borderColor: gift.accent },
                        (avatarHubBusy === gift.id || (user?.currency.coins ?? 0) < gift.price) && styles.avatarHubActionDisabled,
                      ]}
                      disabled={!avatarHubUserId || !!avatarHubBusy || (user?.currency.coins ?? 0) < gift.price}
                      onPress={() => avatarHubUserId ? sendGiftToPlayer(avatarHubUserId, gift.id) : undefined}
                    >
                      <Text style={styles.giftIcon}>{gift.icon}</Text>
                      <View style={styles.giftCopy}>
                        <Text style={styles.giftChipText} numberOfLines={1}>{gift.label}</Text>
                        <Text style={[styles.giftPrice, { color: gift.accent }]} numberOfLines={1}>{gift.price} coins</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={isFocused && !!turnNotice}
        animationType="fade"
        onRequestClose={() => setTurnNotice(null)}
      >
        <View style={styles.noticeScrim}>
          <View style={[styles.noticeCard, turnNotice?.tone === 'warning' && styles.noticeCardWarning]}>
            <Text style={[styles.noticeTitle, turnNotice?.tone === 'warning' && styles.noticeTitleWarning]}>
              {turnNotice?.title}
            </Text>
            <Text style={styles.noticeBody}>{turnNotice?.body}</Text>
            <Pressable
              style={[styles.noticeButton, turnNotice?.tone === 'warning' && styles.noticeButtonWarning]}
              onPress={() => setTurnNotice(null)}
            >
              <Text style={styles.noticeButtonText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal Layer */}
      <Modal
        transparent
        visible={isFocused && alertSettingsOpen}
        animationType="fade"
        onRequestClose={() => setAlertSettingsOpen(false)}
      >
        <View style={styles.settingsScrim}>
          <View style={styles.settingsCard}>
            <View style={styles.settingsHeader}>
              <Text style={styles.settingsTitle}>Settings</Text>
              <Pressable style={styles.settingsCloseButton} onPress={() => setAlertSettingsOpen(false)}>
                <Text style={styles.chatCloseText}>X</Text>
              </Pressable>
            </View>
            <View style={styles.settingsSectionHeader}>
              <Bell size={18} color={ui.palette.gold} strokeWidth={2.5} />
              <Text style={styles.settingsSectionTitle}>Turn Alerts</Text>
            </View>
            <View style={styles.settingsRow}>
              <Text style={styles.settingsLabel}>Popups</Text>
              <Switch
                value={gameplayPrefs.turnAlerts}
                onValueChange={value => setGameplayPreferences({ turnAlerts: value })}
                thumbColor={gameplayPrefs.turnAlerts ? '#52E5A7' : '#444'}
                trackColor={{ false: '#555', true: '#52E5A7' }}
              />
            </View>
            <View style={styles.settingsRow}>
              <Text style={styles.settingsLabel}>Sound</Text>
              <Switch
                value={gameplayPrefs.sound}
                onValueChange={value => setGameplayPreferences({ sound: value })}
                thumbColor={gameplayPrefs.sound ? '#52E5A7' : '#444'}
                trackColor={{ false: '#555', true: '#52E5A7' }}
              />
            </View>
            <View style={styles.settingsRow}>
              <Text style={styles.settingsLabel}>Vibrate</Text>
              <Switch
                value={gameplayPrefs.vibrate}
                onValueChange={value => setGameplayPreferences({ vibrate: value })}
                thumbColor={gameplayPrefs.vibrate ? '#52E5A7' : '#444'}
                trackColor={{ false: '#555', true: '#52E5A7' }}
              />
            </View>
            <Pressable style={styles.settingsDoneButton} onPress={() => setAlertSettingsOpen(false)}>
              <Text style={styles.settingsDoneText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Pass-and-play peek handoff */}
      <Modal transparent visible={isFocused && showPassOverlay} animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <Text style={styles.overlayTitle}>{passPeekPlayer?.name ?? 'Player'}'s Peek</Text>
            <Text style={styles.overlayBody}>Pass the device. Flip two cards, then hand it to the next player.</Text>
            <Pressable
              style={styles.overlayButton}
              onPress={() => {
                if (passPeekPromptKey) setDismissedPeekPromptKey(passPeekPromptKey);
              }}
            >
              <Text style={styles.overlayButtonText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={isFocused && showRoundSummary} animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <Text style={styles.overlayTitle}>
              {state.completed ? 'Game Complete' : `Round ${state.lastRoundNumber} Complete`}
            </Text>
            {state.lastRoundScores?.map((score, index) => (
              <Text key={state.players[index]?.id ?? index} style={styles.summaryLine}>
                {state.players[index]?.name ?? `Player ${index + 1}`}: {score}
                {state.lastRoundTotals ? `  Total ${state.lastRoundTotals[index] ?? score}` : ''}
              </Text>
            ))}
            {state.completed && matchProgression ? <RewardSummary progression={matchProgression} /> : null}
            <Pressable
              style={styles.summaryButton}
              onPress={() => {
                if (state.completed) navigation.replace('Lobby');
                else {
                  if (roundSummaryKey) setDismissedSummaryKey(roundSummaryKey);
                  if (isOnline && token && roomCode && state.phase === 'roundSummary') {
                    sendGameIntent(token, roomCode, 'continueRound').catch(error => {
                      if (roundSummaryKey) setDismissedSummaryKey(null);
                      handleOnlineActionError('Continue rejected', error);
                    });
                  } else if (!isOnline && state.phase === 'roundSummary') {
                    const result = continueAfterRoundSummary(state);
                    if (result.error) {
                      if (roundSummaryKey) setDismissedSummaryKey(null);
                      Alert.alert('Continue rejected', result.error);
                      return;
                    }
                    sweepStarter.current = null;
                    setSweepActive(false);
                    setHeld(null);
                    setPending(null);
                    setSelectedCell(null);
                    setActiveSource(null);
                    setHeldMustReplace(false);
                    setHeldCanDiscard(false);
                    setLocked(false);
                    setState(result.state as GameState);
                  }
                }
              }}
            >
              <Text style={styles.summaryButtonText}>
                {state.completed ? 'Back to Lobby' : 'Next Round'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={isFocused && isOnline && chatOpen} animationType="slide" onRequestClose={() => setChatOpen(false)}>
        <KeyboardAvoidingView
          style={styles.chatOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.chatDismissArea} onPress={() => setChatOpen(false)} />
          <View style={[styles.chatSheet, { paddingBottom: Math.max(12, insets.bottom + 8) }]}>
            <View style={styles.chatHeader}>
              <Text style={styles.chatTitle}>Game Chat</Text>
              <Pressable style={styles.chatCloseButton} onPress={() => setChatOpen(false)}>
                <Text style={styles.chatCloseText}>X</Text>
              </Pressable>
            </View>

            <ScrollView
              ref={chatScrollRef}
              style={styles.chatMessages}
              contentContainerStyle={styles.chatMessagesContent}
              onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
              keyboardShouldPersistTaps="handled"
            >
              {chatMessages.length ? chatMessages.map(message => {
                const mine = message.userId === user?.userId;
                return (
                  <View key={message.id} style={[styles.chatBubble, mine && styles.chatBubbleMine]}>
                    <Text style={[styles.chatName, mine && styles.chatNameMine]} numberOfLines={1}>
                      {mine ? 'You' : message.displayName}
                    </Text>
                    <Text style={[
                      styles.chatMessageText,
                      message.type === 'emoji' && styles.chatEmojiText,
                      message.type === 'sticker' && styles.chatStickerText,
                      message.type === 'gift' && styles.chatGiftText,
                    ]}>
                      {message.type === 'gift' && message.targetDisplayName
                        ? `${message.giftIcon || '\u{1F381}'} ${message.text} to ${message.targetDisplayName}`
                        : message.text}
                    </Text>
                  </View>
                );
              }) : (
                <Text style={styles.chatEmpty}>No messages yet.</Text>
              )}
            </ScrollView>

            <Text style={styles.chatSectionLabel}>Quick Chat</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickChatRow} keyboardShouldPersistTaps="handled">
              {QUICK_CHAT_PRESETS.map(preset => (
                <Pressable
                  key={preset}
                  style={[styles.quickChatChip, chatSending && styles.chatDisabled]}
                  disabled={chatSending}
                  onPress={() => onSendChat('preset', preset)}
                >
                  <Text style={styles.quickChatText}>{preset}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiRow} keyboardShouldPersistTaps="handled">
              {QUICK_CHAT_EMOJIS.map(emoji => (
                <Pressable
                  key={emoji}
                  style={[styles.emojiChip, chatSending && styles.chatDisabled]}
                  disabled={chatSending}
                  onPress={() => onSendChat('emoji', emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.chatSectionLabel}>Stickers</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stickerRow} keyboardShouldPersistTaps="handled">
              {QUICK_CHAT_STICKERS.map(sticker => (
                <Pressable
                  key={sticker}
                  style={[styles.stickerChip, chatSending && styles.chatDisabled]}
                  disabled={chatSending}
                  onPress={() => onSendChat('sticker', sticker)}
                >
                  <Text style={styles.stickerText}>{sticker}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.chatInputRow}>
              <TextInput
                value={chatText}
                onChangeText={setChatText}
                placeholder="Type a message"
                placeholderTextColor="#6F789E"
                style={styles.chatInput}
                maxLength={160}
                multiline
              />
              <Pressable
                style={[styles.chatSendButton, (!chatText.trim() || chatSending) && styles.chatSendButtonDisabled]}
                disabled={!chatText.trim() || chatSending}
                onPress={() => onSendChat('text', chatText)}
              >
                <Text style={styles.chatSendText}>Send</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal transparent visible={isFocused && !!user?.club?.clubId && clubChatOpen} animationType="slide" onRequestClose={() => setClubChatOpen(false)}>
        <KeyboardAvoidingView
          style={styles.chatOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.chatDismissArea} onPress={() => setClubChatOpen(false)} />
          <View style={[styles.chatSheet, { paddingBottom: Math.max(12, insets.bottom + 8) }]}>
            <View style={styles.chatHeader}>
              <View>
                <Text style={styles.chatTitle}>Club Chat</Text>
                <Text style={styles.clubChatSubtitle} numberOfLines={1}>{clubProfile?.name ?? user?.club?.name ?? 'Your club'}</Text>
              </View>
              <Pressable style={styles.chatCloseButton} onPress={() => setClubChatOpen(false)}>
                <Text style={styles.chatCloseText}>X</Text>
              </Pressable>
            </View>

            <ScrollView
              ref={clubChatScrollRef}
              style={styles.chatMessages}
              contentContainerStyle={styles.chatMessagesContent}
              onContentSizeChange={() => clubChatScrollRef.current?.scrollToEnd({ animated: true })}
              keyboardShouldPersistTaps="handled"
            >
              {clubChatMessages.length ? clubChatMessages.map(message => {
                const mine = message.userId === user?.userId;
                return (
                  <View key={message.id} style={[styles.chatBubble, mine && styles.chatBubbleMine]}>
                    <Text style={[styles.chatName, mine && styles.chatNameMine]} numberOfLines={1}>
                      {mine ? 'You' : message.displayName}
                    </Text>
                    <Text style={[
                      styles.chatMessageText,
                      message.type === 'emoji' && styles.chatEmojiText,
                      message.type === 'sticker' && styles.chatStickerText,
                    ]}>
                      {message.text}
                    </Text>
                  </View>
                );
              }) : (
                <Text style={styles.chatEmpty}>No club messages yet.</Text>
              )}
            </ScrollView>

            <View style={styles.chatInputRow}>
              <TextInput
                value={clubChatText}
                onChangeText={setClubChatText}
                placeholder="Message your club"
                placeholderTextColor="#6F789E"
                style={styles.chatInput}
                maxLength={160}
                multiline
              />
              <Pressable
                style={[styles.chatSendButton, (!clubChatText.trim() || clubChatSending) && styles.chatSendButtonDisabled]}
                disabled={!clubChatText.trim() || clubChatSending}
                onPress={() => onSendClubChat(clubChatText)}
              >
                <Text style={styles.chatSendText}>Send</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </LinearGradient>
  );
}

function DecisionButtonContent({ label, card, primary = false }: { label: string; card: Card | null; primary?: boolean }) {
  return (
    <View style={styles.decisionContent}>
      <CardView card={card} width={26} height={38} margin={0} />
      <Text style={[styles.altBtnText, primary && styles.altBtnTextPrimary]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function RewardSummary({ progression }: { progression: api.MatchProgressionSummary }) {
  return (
    <View style={styles.rewardBlock}>
      <Text style={styles.rewardTitle}>Rewards Earned</Text>
      <Text style={styles.rewardLine}>+{progression.xpGained} XP  +{progression.coinsGained} coins</Text>
      {progression.economy ? (
        <Text style={styles.rewardPrize}>
          Prize: {progression.economy.payout} coins  Net {progression.economy.net >= 0 ? '+' : ''}{progression.economy.net}
        </Text>
      ) : null}
      {progression.ranked ? (
        <>
          <Text style={styles.rewardRanked}>
            Ranked ladder updated
          </Text>
          <Text style={styles.rewardRankedMeta}>
            {progression.ranked.placementComplete
              ? progression.ranked.leagueAfter.name
              : `Placement ${progression.ranked.placementsPlayed}/${progression.ranked.placementMatchesRequired}`}
          </Text>
          {progression.ranked.promoted ? <Text style={styles.rewardLevel}>Promoted to {progression.ranked.leagueAfter.name}</Text> : null}
          {progression.ranked.demoted ? <Text style={styles.rewardAchievement}>Moved to {progression.ranked.leagueAfter.name}</Text> : null}
        </>
      ) : null}
      {progression.levelAfter > progression.levelBefore ? (
        <Text style={styles.rewardLevel}>{`Level up: ${progression.levelBefore} -> ${progression.levelAfter}`}</Text>
      ) : null}
      {progression.achievementsUnlocked.slice(0, 3).map(item => (
        <Text key={item.id} style={styles.rewardAchievement}>Unlocked: {item.name}</Text>
      ))}
      {progression.challengesCompleted.slice(0, 3).map(item => (
        <Text key={item.id} style={styles.rewardAchievement}>Challenge complete: {item.title}</Text>
      ))}
    </View>
  );
}

function HubStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.avatarHubStat}>
      <Text style={styles.avatarHubStatValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.avatarHubStatLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function friendActionLabel(relationship?: api.SocialRelationship) {
  if (relationship === 'friend') return 'Remove';
  if (relationship === 'incoming') return 'Accept';
  if (relationship === 'outgoing') return 'Sent';
  return 'Add Friend';
}

function SocialBurstBubble({ burst, compact = false }: { burst?: SocialBurst; compact?: boolean }) {
  if (!burst) return null;
  if (burst.type === 'gift') return null;
  return (
    <View pointerEvents="none" style={[styles.socialBurst, compact && styles.socialBurstCompact, burst.type === 'sticker' && styles.socialBurstSticker]}>
      <Text
        style={[
          styles.socialBurstText,
          burst.type === 'emoji' && styles.socialBurstEmoji,
          compact && styles.socialBurstTextCompact,
        ]}
        numberOfLines={compact ? 2 : 1}
      >
        {burst.text}
      </Text>
    </View>
  );
}

function formatProgressionSummary(progression: api.MatchProgressionSummary | null) {
  if (!progression) return '';
  const lines = [`Rewards: +${progression.xpGained} XP, +${progression.coinsGained} coins`];
  if (progression.ranked) {
    lines.push('Ranked ladder updated');
    lines.push(progression.ranked.placementComplete
      ? `League: ${progression.ranked.leagueAfter.name}`
      : `Placement ${progression.ranked.placementsPlayed}/${progression.ranked.placementMatchesRequired}`);
  }
  if (progression.economy) {
    lines.push(`Prize: ${progression.economy.payout} coins (${progression.economy.net >= 0 ? '+' : ''}${progression.economy.net} net)`);
  }
  if (progression.levelAfter > progression.levelBefore) {
    lines.push(`Level up: ${progression.levelBefore} -> ${progression.levelAfter}`);
  }
  for (const achievement of progression.achievementsUnlocked.slice(0, 3)) {
    lines.push(`Unlocked: ${achievement.name}`);
  }
  for (const challenge of progression.challengesCompleted.slice(0, 3)) {
    lines.push(`Challenge complete: ${challenge.title}`);
  }
  return lines.join('\n');
}

function value(card: Card): number {
  return cardValue(card);
}

function countFaceDownCards(grid: Grid | undefined): number {
  if (!grid) return 0;
  return grid.reduce((total, row) => total + row.filter(card => card && !card.faceUp).length, 0);
}

function visibleGridScore(grid: Grid | undefined): number {
  if (!grid) return 0;
  return grid.reduce((total, row) => (
    total + row.reduce((rowTotal, card) => rowTotal + (card?.faceUp ? value(card) : 0), 0)
  ), 0);
}

function firstFaceDownCells(grid: Grid | undefined): Array<{ r: number; c: number }> {
  if (!grid) return [];
  const cells: Array<{ r: number; c: number }> = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const card = grid[r][c];
    if (card && !card.faceUp) cells.push({ r, c });
  }
  return cells;
}

function revealHiddenForDisplay(state: GameState): GameState {
  const next = structuredClone(state) as GameState;
  for (const player of next.players) {
    for (const row of player.grid) {
      for (const card of row) {
        if (card) card.faceUp = true;
      }
    }
  }
  return next;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1023' },

  header: {
    paddingTop: 8,
    paddingHorizontal: 12,
    paddingBottom: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#101633',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2F57',
  },
  turnStatusChip: {
    flex: 1,
    minHeight: 42,
    minWidth: 0,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  activeAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: '#4DA3FF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#121737',
  },
  activeAvatarMine: {
    borderColor: '#52E5A7',
    backgroundColor: '#123B32',
  },
  activeAvatarText: { color: '#E8ECF1', fontSize: 18, fontWeight: '900' },
  turnCopy: { flex: 1, minWidth: 0 },
  heading: { color: '#E8ECF1', fontSize: 15, fontWeight: '900' },
  turnInstruction: { color: '#9BA3C7', fontSize: 11, marginTop: 1, fontWeight: '800' },
  profileHudButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: '#52E5A7',
    backgroundColor: '#121737',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHudText: { color: '#E8ECF1', fontSize: 17, fontWeight: '900' },
  timerChip: {
    minWidth: 58,
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#121737',
    borderWidth: 1,
    borderColor: '#2A2F57',
  },
  timerDanger: {
    borderColor: '#FF6B6B',
    backgroundColor: '#3A1723',
  },
  timerText: { color: '#E8ECF1', fontSize: 17, fontWeight: '900', fontVariant: ['tabular-nums'] },
  roundText: { color: '#9BA3C7', fontSize: 11, fontWeight: '800', marginTop: 1 },
  roundChip: {
    minWidth: 58,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#121737',
    borderWidth: 1,
    borderColor: '#2A2F57',
  },
  roundChipLabel: { color: '#9BA3C7', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  roundChipText: { color: '#E8ECF1', fontSize: 15, fontWeight: '900', marginTop: 1, fontVariant: ['tabular-nums'] },
  chatButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2F57',
    backgroundColor: '#121737',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatButtonText: { fontSize: 18 },
  chatBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#FF6B6B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBadgeText: { color: '#0B1023', fontSize: 10, fontWeight: '900' },
  shopOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  shopDismissArea: { flex: 1 },
  shopSheet: {
    maxHeight: '88%',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderWidth: 1,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOpacity: 0.36,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -5 },
    elevation: 12,
  },
  shopSheetHeader: {
    minHeight: 50,
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2F57',
  },
  shopSheetEyebrow: { color: '#FFCC66', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  shopSheetTitle: { color: '#E8ECF1', fontSize: 21, fontWeight: '900', marginTop: 1 },
  shopCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#2A2F57',
    backgroundColor: '#121737',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopScrollContent: {
    padding: 14,
    paddingBottom: 24,
  },
  avatarHubScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.58)',
    justifyContent: 'flex-end',
  },
  avatarHubDismissArea: { flex: 1 },
  avatarHubSheet: {
    maxHeight: '88%',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.36,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -5 },
    elevation: 12,
  },
  avatarHubHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#2A2F57',
    paddingBottom: 12,
  },
  avatarHubScroll: { flexGrow: 0 },
  avatarHubScrollContent: { paddingBottom: 2 },
  avatarHubHero: {
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarHubCopy: { flex: 1, minWidth: 0 },
  avatarHubName: { color: '#E8ECF1', fontSize: 22, fontWeight: '900' },
  avatarHubMeta: { color: '#9BA3C7', fontSize: 13, fontWeight: '800', marginTop: 3 },
  avatarHubCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#2A2F57',
    backgroundColor: '#121737',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHubXpTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: '#0B1023',
    borderWidth: 1,
    borderColor: '#2A2F57',
    overflow: 'hidden',
    marginTop: 8,
  },
  avatarHubXpFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#52E5A7',
  },
  avatarHubBody: { paddingTop: 14 },
  avatarHubStatRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  avatarHubStat: {
    flex: 1,
    minHeight: 54,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2F57',
    backgroundColor: '#121737',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  avatarHubStatValue: { color: '#E8ECF1', fontSize: 14, fontWeight: '900' },
  avatarHubStatLabel: { color: '#9BA3C7', fontSize: 10, fontWeight: '900', marginTop: 2, textTransform: 'uppercase' },
  avatarHubActionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  avatarHubAction: {
    flexGrow: 1,
    flexBasis: '31%',
    minHeight: 54,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2F57',
    backgroundColor: '#121737',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  avatarHubActionDisabled: { opacity: 0.48 },
  avatarHubActionText: { color: '#E8ECF1', fontSize: 11, fontWeight: '900', textAlign: 'center' },
  avatarHubSectionTitle: { color: '#9BA3C7', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginTop: 14, marginBottom: 8 },
  avatarHubEmptyText: { color: '#9BA3C7', fontSize: 11, fontWeight: '800', lineHeight: 16 },
  lockerSection: { marginTop: 8 },
  lockerTitle: { color: '#E8ECF1', fontSize: 12, fontWeight: '900', marginBottom: 7 },
  lockerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  lockerChip: {
    flexGrow: 1,
    flexBasis: '47%',
    minHeight: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2F57',
    backgroundColor: '#121737',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  lockerChipEquipped: { borderColor: '#52E5A7', backgroundColor: '#123B32' },
  lockerName: { color: '#E8ECF1', fontSize: 12, fontWeight: '900' },
  lockerState: { color: '#BDEBFF', fontSize: 10, fontWeight: '900', marginTop: 3 },
  lockerStateEquipped: { color: '#52E5A7' },
  giftGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  giftChip: {
    flexGrow: 1,
    flexBasis: '47%',
    minHeight: 54,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#121737',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    paddingHorizontal: 10,
  },
  giftIcon: { fontSize: 21, lineHeight: 24 },
  giftCopy: { flex: 1, minWidth: 0 },
  giftChipText: { color: '#E8ECF1', fontSize: 11, fontWeight: '900' },
  giftPrice: { fontSize: 9, fontWeight: '900', marginTop: 2 },
  noticeScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.68)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  noticeCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#52E5A7',
    backgroundColor: '#102E2A',
    paddingHorizontal: 18,
    paddingVertical: 20,
    alignItems: 'center',
  },
  noticeCardWarning: {
    borderColor: '#FFB020',
    backgroundColor: '#3A2414',
  },
  noticeTitle: { color: '#52E5A7', fontSize: 24, fontWeight: '900', textAlign: 'center' },
  noticeTitleWarning: { color: '#FFB020' },
  noticeBody: { color: '#E8ECF1', fontSize: 15, fontWeight: '800', textAlign: 'center', marginTop: 8, lineHeight: 21 },
  noticeButton: {
    minWidth: 140,
    minHeight: 46,
    marginTop: 18,
    borderRadius: 8,
    backgroundColor: '#52E5A7',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  noticeButtonWarning: {
    backgroundColor: '#FFB020',
  },
  noticeButtonText: { color: '#0B1023', fontSize: 16, fontWeight: '900' },
  settingsScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  settingsCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2F57',
    backgroundColor: '#101633',
    padding: 18,
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  settingsTitle: { color: '#E8ECF1', fontSize: 19, fontWeight: '900' },
  settingsCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2F57',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuAction: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2F57',
    backgroundColor: '#121737',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  menuActionText: { color: '#E8ECF1', fontSize: 15, fontWeight: '900' },
  settingsDivider: {
    height: 1,
    backgroundColor: '#20264A',
    marginVertical: 6,
  },
  settingsSectionHeader: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingsSectionTitle: { color: '#E8ECF1', fontSize: 14, fontWeight: '900' },
  settingsRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#20264A',
  },
  settingsLabel: { color: '#E8ECF1', fontSize: 15, fontWeight: '800' },
  settingsDoneButton: {
    minHeight: 44,
    marginTop: 16,
    borderRadius: 8,
    backgroundColor: '#4DA3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsDoneText: { color: '#0B1023', fontSize: 15, fontWeight: '900' },
  turnNotice: {
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#52E5A7',
    backgroundColor: '#102E2A',
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  turnNoticeWarning: {
    borderColor: '#FFB020',
    backgroundColor: '#3A2414',
  },
  turnNoticeTitle: { color: '#52E5A7', fontSize: 15, fontWeight: '900', textAlign: 'center' },
  turnNoticeTitleWarning: { color: '#FFB020' },
  turnNoticeBody: { color: '#E8ECF1', fontSize: 12, fontWeight: '800', textAlign: 'center', marginTop: 2 },
  scoreStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  scorePill: {
    flexGrow: 1,
    flexBasis: '48%',
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2F57',
    backgroundColor: '#121737',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  scorePillActive: { borderColor: '#4DA3FF' },
  scoreAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreAvatarText: { color: '#E8ECF1', fontSize: 13, fontWeight: '900' },
  connectionDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#0B1023',
  },
  connectionDotOnline: { backgroundColor: '#52E5A7' },
  connectionDotOffline: { backgroundColor: '#FF6B6B' },
  scoreCopy: { flex: 1, minWidth: 0 },
  scoreName: { color: '#9BA3C7', fontSize: 11, fontWeight: '900', flexShrink: 1 },
  scoreMeta: { color: '#9BA3C7', fontSize: 9, fontWeight: '900', marginTop: 1 },
  scoreValues: { alignItems: 'flex-end', flexShrink: 0 },
  scoreNow: { color: '#52E5A7', fontSize: 10, fontWeight: '900' },
  scoreValue: { color: '#E8ECF1', fontSize: 10, fontWeight: '900', marginTop: 1 },
  tableZone: {
    flexGrow: 1,
    flexShrink: 1,
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 6,
  },
  tableOpponentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  tableOpponentSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
  },
  tablePilesOnlyRow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableCenterSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  oppCard: { position: 'relative', borderWidth: 1, borderColor: '#2A2F57', backgroundColor: '#121737', borderRadius: 8 },
  oppCardTop: { alignSelf: 'center' },
  oppCardSide: { alignSelf: 'center' },
  oppCardActive: { borderColor: '#4DA3FF', backgroundColor: '#17204A' },
  oppHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 2 },
  oppName: { flex: 1, minWidth: 0 },
  playerGridHeader: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    marginBottom: 2,
  },
  oppGridName: {
    color: '#E8ECF1',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 4,
    minWidth: 0,
  },
  clubTagText: { color: '#B99CFF', fontWeight: '900' },
  playerGridMeta: { color: '#9BA3C7', fontSize: 8, fontWeight: '900', marginTop: 1 },
  inlineScores: { alignItems: 'flex-end', flexShrink: 0, minWidth: 42, paddingRight: 1 },

  localPanel: { position: 'relative', flexShrink: 0, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 6, borderTopWidth: 1, borderTopColor: 'transparent' },
  localPanelActive: { borderTopColor: '#4DA3FF', backgroundColor: '#0F1530' },
  localTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  localIdentity: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  localTitlePressable: { flex: 1, minWidth: 0 },
  localScoreBox: { alignItems: 'flex-end', marginLeft: 8 },
  meTitle: { color: '#E8ECF1', fontSize: 15, fontWeight: '900' },
  activeName: { color: '#E8ECF1' },
  selfXpTrack: {
    width: 82,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#0B1023',
    overflow: 'hidden',
    marginTop: 4,
  },
  selfXpFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#52E5A7',
  },
  turnBadge: {
    color: '#0B1023',
    backgroundColor: '#52E5A7',
    borderRadius: 6,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 10,
    fontWeight: '900',
  },
  turnBadgeSmall: {
    color: '#0B1023',
    backgroundColor: '#52E5A7',
    borderRadius: 5,
    overflow: 'hidden',
    paddingHorizontal: 5,
    paddingVertical: 2,
    fontSize: 8,
    fontWeight: '900',
    flexShrink: 0,
  },
  subtle: { color: '#9BA3C7' },
  socialBurst: {
    position: 'absolute',
    top: 5,
    right: 12,
    zIndex: 25,
    maxWidth: '72%',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#52E5A7',
    backgroundColor: '#123B32',
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  socialBurstCompact: {
    top: -14,
    right: -5,
    maxWidth: 110,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  socialBurstSticker: {
    borderColor: '#4DA3FF',
    backgroundColor: '#102448',
  },
  socialBurstText: { color: '#E8ECF1', fontSize: 13, fontWeight: '900', textAlign: 'center' },
  socialBurstTextCompact: { fontSize: 10 },
  socialBurstEmoji: { fontSize: 22, lineHeight: 26 },

  footer: {
    minHeight: 58,
    paddingTop: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#2A2F57',
    backgroundColor: '#101633',
  },

  decisionButtons: { flexDirection: 'row', gap: 8, flex: 1, justifyContent: 'flex-end' },
  nextStepPanel: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2F57',
    backgroundColor: '#121737',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  nextStepPanelCompact: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2F57',
    backgroundColor: '#121737',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  nextStepText: { color: '#E8ECF1', fontWeight: '800', textAlign: 'center' },

  altBtn: { flex: 1, minWidth: 0, minHeight: 48, paddingVertical: 7, paddingHorizontal: 6, borderRadius: 8, borderWidth: 2, borderColor: '#4DA3FF', alignItems: 'center', justifyContent: 'center' },
  altBtnPrimary: { backgroundColor: '#4DA3FF', borderColor: '#4DA3FF' },
  altBtnText: { color: '#4DA3FF', fontWeight: '800', fontSize: 13, textAlign: 'center' },
  altBtnTextPrimary: { color: '#0B1023' },
  decisionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minWidth: 0,
  },
  cancelBtn: {
    width: 46,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FF6B6B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { color: '#FF6B6B', fontWeight: '900', fontSize: 14 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  overlayCard: { padding: 20, borderRadius: 16, backgroundColor: '#121737', borderWidth: 1, borderColor: '#2A2F57', width: '78%', alignItems: 'center' },
  overlayTitle: { color: '#E8ECF1', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  overlayBody: { color: '#C8CEE8', fontSize: 14, fontWeight: '800', lineHeight: 20, textAlign: 'center', marginTop: 10 },
  overlayButton: {
    minWidth: 136,
    minHeight: 44,
    marginTop: 18,
    borderRadius: 10,
    backgroundColor: '#52E5A7',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  overlayButtonText: { color: '#0B1023', fontSize: 15, fontWeight: '900' },
  summaryLine: { color: '#E8ECF1', fontSize: 15, marginTop: 10, textAlign: 'center' },
  rewardBlock: {
    alignSelf: 'stretch',
    marginTop: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFCC66',
    backgroundColor: '#2B2515',
    padding: 10,
  },
  rewardTitle: { color: '#FFCC66', fontSize: 14, fontWeight: '900', textAlign: 'center', marginBottom: 5 },
  rewardLine: { color: '#E8ECF1', fontSize: 13, fontWeight: '900', textAlign: 'center' },
  rewardPrize: { color: '#FFCC66', fontSize: 13, fontWeight: '900', textAlign: 'center', marginTop: 4 },
  rewardRanked: { color: '#FFCC66', fontSize: 13, fontWeight: '900', textAlign: 'center', marginTop: 4 },
  rewardRankedMeta: { color: '#9BA3C7', fontSize: 12, fontWeight: '900', textAlign: 'center', marginTop: 2 },
  rewardLevel: { color: '#52E5A7', fontSize: 12, fontWeight: '900', textAlign: 'center', marginTop: 4 },
  rewardAchievement: { color: '#E8ECF1', fontSize: 12, fontWeight: '800', textAlign: 'center', marginTop: 3 },
  summaryButton: {
    minWidth: 150,
    minHeight: 44,
    marginTop: 16,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#4DA3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryButtonText: {
    color: '#0B1023',
    fontWeight: '900',
    fontSize: 15,
    textAlign: 'center',
  },
  chatOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  chatDismissArea: { flex: 1 },
  chatSheet: {
    maxHeight: '82%',
    paddingTop: 14,
    paddingHorizontal: 12,
    backgroundColor: '#101633',
    borderTopWidth: 1,
    borderTopColor: '#2A2F57',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  chatTitle: { color: '#E8ECF1', fontSize: 18, fontWeight: '900' },
  clubChatSubtitle: { color: '#52E5A7', fontSize: 11, fontWeight: '900', marginTop: 2, maxWidth: 230 },
  chatCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF6B6B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatCloseText: { color: '#FF6B6B', fontSize: 14, fontWeight: '900' },
  chatMessages: {
    maxHeight: 220,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2F57',
    backgroundColor: '#0B1023',
  },
  chatMessagesContent: {
    padding: 10,
    gap: 8,
  },
  chatBubble: {
    maxWidth: '82%',
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2F57',
    backgroundColor: '#121737',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chatBubbleMine: {
    alignSelf: 'flex-end',
    borderColor: '#52E5A7',
    backgroundColor: '#123B32',
  },
  chatName: { color: '#9BA3C7', fontSize: 10, fontWeight: '900', marginBottom: 2 },
  chatNameMine: { color: '#52E5A7' },
  chatMessageText: { color: '#E8ECF1', fontSize: 14, fontWeight: '700' },
  chatEmojiText: { fontSize: 24, lineHeight: 30 },
  chatStickerText: { color: '#BFD9FF', fontWeight: '900' },
  chatGiftText: { color: '#FFE6A3', fontWeight: '900' },
  chatEmpty: { color: '#9BA3C7', textAlign: 'center', paddingVertical: 22, fontWeight: '800' },
  chatSectionLabel: {
    color: '#9BA3C7',
    fontSize: 11,
    fontWeight: '900',
    marginTop: 12,
    marginBottom: 6,
  },
  quickChatRow: { gap: 8, paddingRight: 12 },
  quickChatChip: {
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2F57',
    backgroundColor: '#121737',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickChatText: { color: '#E8ECF1', fontSize: 12, fontWeight: '800' },
  emojiRow: { gap: 8, paddingRight: 12, marginTop: 8 },
  emojiChip: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2F57',
    backgroundColor: '#121737',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: { fontSize: 22 },
  stickerRow: { gap: 8, paddingRight: 12 },
  stickerChip: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4DA3FF',
    backgroundColor: '#102448',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerText: { color: '#E8ECF1', fontSize: 12, fontWeight: '900' },
  chatDisabled: { opacity: 0.55 },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  chatInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 92,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2F57',
    backgroundColor: '#0B1023',
    color: '#E8ECF1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '700',
  },
  chatSendButton: {
    minWidth: 72,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: '#4DA3FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  chatSendButtonDisabled: { opacity: 0.45 },
  chatSendText: { color: '#0B1023', fontSize: 13, fontWeight: '900' },
});
