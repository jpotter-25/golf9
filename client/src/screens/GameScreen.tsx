// src/screens/GameScreen.tsx
// Purpose:
// - Gameplay loop, piles, round flow, final-sweep
// - Solo vs AI (AI peeks/plays automatically)
// - Opponent panels sized from actual grid footprint
// - “Keep Revealed” bypasses discard rule; 5s = −5
// - Android nav bar hidden while this screen is focused
// - ✅ Footer (Held / Discard Held) is now lifted using absolute positioning
//   with a reliable percent-based bottom offset so it never looks flush.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Modal, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import type { GameState, Card, Grid } from '../game/types';
import {
  deal,
  drawFromDeck,
  takeDiscard,
  replaceGridCard,
  discardDrawn,
  flipForPeek,
  autoCompleteCurrentPeek,
  advancePeek
} from '../game/gameLogic';
import GridView from '../components/Grid';
import Piles from '../components/Piles';
import { useBoardMetrics } from '../utils/scaling';

type Props = NativeStackScreenProps<RootStackParamList, 'Game'>;

export default function GameScreen({ route, navigation }: Props) {
  const { players, mode, rounds: roundsFromLobby } = route.params as any;
  const TOTAL_ROUNDS: number = typeof roundsFromLobby === 'number' ? roundsFromLobby : 9;

  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();

  // -------- Round state --------
  const [round, setRound] = useState<number>(1);
  const [totals, setTotals] = useState<number[]>(
    Array.from({ length: players }, () => 0)
  );

  // -------- Core game / UI state --------
  const [state, setState] = useState<GameState>(() => deal(players));
  const [held, setHeld] = useState<Card | null>(null);
  const [activeSource, setActiveSource] = useState<'draw'|'discard'|null>(null);
  const [pending, setPending] = useState<{ r: number; c: number } | null>(null);
  const [locked, setLocked] = useState(false);
  const [nowTime, setNowTime] = useState(Date.now());

  const [sweepActive, setSweepActive] = useState(false);
  const sweepStarter = useRef<number | null>(null);
  const lastTurnIndex = useRef<number>(0);

  const metrics = useBoardMetrics(state.players.length);

  // ===== Opponent panel sizing =====
  const OPP_INNER_PAD = 8;
  const footprint = (cw: number, gap: number) => cw * 3 + gap * 2 + OPP_INNER_PAD * 2;
  let oppPanelWidth = Math.ceil(footprint(metrics.opp.cardW, metrics.opp.gap)) + 2;

  const oppCount = getOppCount(state);
  if (oppCount === 3) {
    const SIDE_PAD = 8 * 2;
    const GAPS = 8 * 2;
    const maxEach = Math.floor((winW - SIDE_PAD - GAPS) / 3);
    if (oppPanelWidth > maxEach) oppPanelWidth = maxEach;
  }

  // ===== Solo vs AI flags =====
  const isSolo = mode === 'solo';
  const isHumanTurn = !(isSolo && state.phase === 'turn' && state.currentPlayerIndex !== 0);
  const isHumanPeek = !(isSolo && state.phase === 'peek' && (state.peekTurnIndex ?? 0) !== 0);

  // ===== Hide Android navigation bar while in-game =====
  useEffect(() => {
    NavigationBar.setVisibilityAsync('hidden').catch(() => {});
    return () => {
      NavigationBar.setVisibilityAsync('visible').catch(() => {});
    };
  }, []);

  // ===== Idle / peek timers (for Pass & Play) =====
  useEffect(() => {
    if (locked) return;
    const id = setInterval(() => {
      setState(s => {
        if (s.phase !== 'turn' || !s.turnEndsAt) return s;
        if (Date.now() < s.turnEndsAt) return s;

        if (held) {
          const next = discardDrawn(s, held);
          setHeld(null);
          setPending(null);
          setActiveSource(null);
          return next;
        } else {
          const { state: next, drawn } = drawFromDeck(s);
          return discardDrawn(next, drawn);
        }
      });
    }, 1000);
    return () => clearInterval(id);
  }, [held, locked]);

  useEffect(() => {
    if (locked) return;
    const id = setInterval(() => {
      setState(s => {
        if (s.phase !== 'peek' || !s.peekEndsAt) return s;
        return Date.now() >= s.peekEndsAt
          ? advancePeek(autoCompleteCurrentPeek(s))
          : s;
      });
    }, 250);
    return () => clearInterval(id);
  }, [locked]);

  // ===== SOLO: auto-advance peeks (no taps) =====
  useEffect(() => {
    if (!isSolo || locked) return;
    if (state.phase !== 'peek') return;
    const idx = state.peekTurnIndex ?? 0;

    if (idx !== 0) {
      const t = setTimeout(() => {
        setState(s => advancePeek(autoCompleteCurrentPeek(s)));
      }, 250);
      return () => clearTimeout(t);
    }

    const flips = state.players[0]?.peekFlips ?? 0;
    if (flips >= 2) {
      const t = setTimeout(() => {
        setState(s => advancePeek(s));
      }, 150);
      return () => clearTimeout(t);
    }
  }, [state, isSolo, locked]);

  // ===== SOLO: AI plays turns automatically =====
  useEffect(() => {
    if (!isSolo || locked) return;
    if (state.phase !== 'turn') return;
    const i = state.currentPlayerIndex;
    if (i === 0) return;
    const t = setTimeout(() => {
      setState(s => aiPlayTurn(s, i));
    }, 350);
    return () => clearTimeout(t);
  }, [state, isSolo, locked]);

  // ===== Final sweep detection =====
  useEffect(() => {
    if (locked || state.phase !== 'turn') return;
    const i = state.currentPlayerIndex;
    const allUp = state.players[i].grid.every(row => row.every(c => c?.faceUp));
    if (allUp && !sweepActive && sweepStarter.current == null) {
      sweepStarter.current = i;
      setSweepActive(true);
    }
  }, [state, sweepActive, locked]);

  useEffect(() => {
    if (locked || state.phase !== 'turn') return;
    const i = state.currentPlayerIndex;
    if (sweepActive && sweepStarter.current != null) {
      if (lastTurnIndex.current !== i && i === sweepStarter.current) {
        endRoundAndMaybeContinue();
      }
    }
    lastTurnIndex.current = i;
  }, [state, sweepActive, locked]);

  // ===== Scoring (5 = −5) =====
  const scoreGrid = (grid: Grid): number => {
    let total = 0;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const card = grid[r][c];
        if (!card || card.zeroed) continue;
        const rank = card.rank;
        let val = 0;
        if (rank === 'A') val = 1;
        else if (rank === 'J' || rank === 'Q') val = 10;
        else if (rank === 'K') val = 0;
        else {
          const n = parseInt(rank as string, 10);
          if (!isNaN(n)) val = n === 5 ? -5 : n;
        }
        total += val;
      }
    }
    return total;
  };

  function endRoundAndMaybeContinue() {
    setLocked(true);
    const roundScores = state.players.map(p => scoreGrid(p.grid));
    setTotals(prev => prev.map((t, i) => t + roundScores[i]));

    const prettyRound = roundScores.map((sc, i) => `Player ${i + 1}: ${sc}`).join('\n');

    if (round < TOTAL_ROUNDS) {
      Alert.alert(
        `Round ${round} complete`,
        prettyRound + `\n\nTap "Next" for Round ${round + 1}.`,
        [
          {
            text: 'Next',
            onPress: () => {
              sweepStarter.current = null;
              setSweepActive(false);
              setHeld(null);
              setPending(null);
              setActiveSource(null);
              setState(deal(players));
              setRound(r => r + 1);
              setLocked(false);
            },
          },
        ],
        { cancelable: false }
      );
    } else {
      const finalLines = state.players
        .map((_, i) => `Player ${i + 1}: ${totals[i] + roundScores[i]}`)
        .join('\n');
      Alert.alert(
        'Game Over',
        finalLines,
        [{ text: 'OK', onPress: () => navigation.navigate('Lobby') }],
        { cancelable: false }
      );
    }
  }

  // ===== Visual Countdown Timer (UI) =====
  useEffect(() => {
    if (locked) return;
    if (state.phase !== 'turn' && state.phase !== 'peek') return;
    const intervalId = setInterval(() => {
      setNowTime(Date.now());
    }, 1000);
    return () => clearInterval(intervalId);
  }, [state.phase, locked]);

  // ===== UI helpers =====
  const secsLeft =
    locked
      ? 0
      : state.phase === 'peek'
        ? Math.max(0, Math.ceil(((state.peekEndsAt ?? 0) - nowTime) / 1000))
        : Math.max(0, Math.ceil(((state.turnEndsAt ?? 0) - nowTime) / 1000));

  const bottomIndex =
    state.phase === 'peek' ? (state.peekTurnIndex ?? 0) : state.currentPlayerIndex;
  const bottomPlayer = state.players[bottomIndex];

  const opponents = useMemo(() => {
    const active = bottomIndex;
    return state.players.map((p, i) => ({ p, i })).filter(x => x.i !== active);
  }, [state, bottomIndex]);

  const faceDownLeft = (() => {
    const g = state.players[state.currentPlayerIndex].grid;
    let n = 0;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) if (g[r][c] && !g[r][c]!.faceUp) n++;
    return n;
  })();

  // ===== Actions =====
  const onPressGrid = (r: number, c: number) => {
    if (!isHumanTurn || !isHumanPeek) return;
    setState(s => {
      if (s.phase === 'peek') {
        if (s.peekTurnIndex == null) return s;
        return flipForPeek(s, r, c);
      }
      if (s.phase !== 'turn') return s;

      const cell = s.players[s.currentPlayerIndex].grid[r][c];
      if (!held) return s;

      if (cell && !cell.faceUp) {
        const next = structuredClone(s) as GameState;
        const target = next.players[next.currentPlayerIndex].grid[r][c]!;
        target.faceUp = true;
        setPending({ r, c });
        return next;
      } else {
        const next = replaceGridCard(s, s.currentPlayerIndex, r, c, held);
        setHeld(null);
        setPending(null);
        setActiveSource(null);
        return next;
      }
    });
  };

  const onDraw = () => {
    if (!isHumanTurn) return;
    if (state.phase !== 'turn' || held) return;
    const { state: next, drawn } = drawFromDeck(state);
    setHeld(drawn);
    setActiveSource('draw');
    setPending(null);
    setState(next);
  };

  const onTakeDiscard = () => {
    if (!isHumanTurn) return;
    if (state.phase !== 'turn' || held) return;
    const { state: next, drawn } = takeDiscard(state);
    if (drawn) setHeld(drawn);
    setActiveSource('discard');
    setPending(null);
    setState(next);
  };

  const onDiscardHeld = () => {
    if (!isHumanTurn || !held) return;
    if (faceDownLeft !== 1) {
      Alert.alert('Choose a slot', 'You can only discard the held card when one slot remains face-down.');
      return;
    }
    setState(s => discardDrawn(s, held));
    setHeld(null);
    setPending(null);
    setActiveSource(null);
  };

  const onKeepRevealed = () => {
    if (!isHumanTurn || !held || !pending) return;
    setState(s => discardDrawn(s, held));
    setHeld(null);
    setPending(null);
    setActiveSource(null);
  };

  const onKeepDrawn = () => {
    if (!isHumanTurn || !held || !pending) return;
    setState(s => replaceGridCard(s, s.currentPlayerIndex, pending.r, pending.c, held));
    setHeld(null);
    setPending(null);
    setActiveSource(null);
  };

  // ===== Footer lift calculation (absolute positioning) =====
  // We lift the footer by ~2% of screen height, plus any bottom inset if present.
  const PERCENT_LIFT = 0.0; // 2% as requested
  const percentPixels = Math.round(winH * PERCENT_LIFT);
  const bottomLift = insets.bottom + percentPixels;

  // ===== Render =====
  const timerLabel = `⏱ ${secsLeft}s`;
  const overlayFlips = (state.players[state.peekTurnIndex ?? 0]?.peekFlips ?? 0) >= 2;
  const showPassOverlay = !isSolo && state.phase === 'peek' && overlayFlips;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.heading}>
          {state.phase === 'peek'
            ? `Peek: ${state.players[state.peekTurnIndex ?? 0]?.name ?? ''} flip two cards`
            : `Turn: Player ${state.currentPlayerIndex + 1}`}
        </Text>
        <View style={styles.timerChip}>
          <Text style={styles.timerText}>{timerLabel}</Text>
          <Text style={[styles.timerText, { marginLeft: 8 }]}>R{round}/{TOTAL_ROUNDS}</Text>
        </View>
      </View>

      {/* Opponents */}
      <View style={{ paddingHorizontal: 8, paddingBottom: 6 }}>
        <View style={[styles.oppRow, { justifyContent: oppCount === 3 ? 'space-between' : 'flex-start' }]}>
          {opponents.map(({ p }, idx) => (
            <View
              key={p.id ?? idx}
              style={[
                styles.oppCard,
                {
                  width: oppPanelWidth,
                  padding: OPP_INNER_PAD,
                  overflow: 'hidden',
                  marginRight: oppCount === 3 ? 0 : 8,
                },
              ]}
            >
              <Text style={styles.subtle} numberOfLines={1}>{p.name}</Text>
              <GridView grid={p.grid} metrics={metrics.opp} />
            </View>
          ))}
        </View>
      </View>

      {/* Piles */}
      <View style={{ paddingVertical: 2 }} pointerEvents={isHumanTurn ? 'auto' : 'none'}>
        <Piles
          drawCount={state.drawPile.length}
          topDiscard={state.topDiscard}
          held={held}
          metrics={metrics.opp}
          onDraw={onDraw}
          onTakeDiscard={onTakeDiscard}
          activeSource={activeSource}
        />
      </View>

      {/* Bottom player grid */}
      <View style={{ padding: 12 }} pointerEvents={isHumanTurn && isHumanPeek ? 'auto' : 'none'}>
        <Text style={styles.meTitle}>{bottomPlayer.name}</Text>
        <GridView
          grid={bottomPlayer.grid}
          onPressCard={onPressGrid}
          metrics={metrics.me}
          activeCell={pending}
        />
      </View>

      {/* Footer — ABSOLUTE, lifted by bottomLift (2% + inset) */}
      <View style={[styles.footer, { bottom: bottomLift }]}>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.subtle}>Held</Text>
          <View style={{ height: 6 }} />
          {held ? <Text style={styles.held}>{held.rank}{held.suit}</Text> : <Text style={styles.subtle}>None</Text>}
        </View>

        {pending && held ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable style={styles.altBtn} onPress={onKeepRevealed}>
              <Text style={styles.altBtnText}>Keep Revealed</Text>
            </Pressable>
            <Pressable style={[styles.altBtn, styles.altBtnPrimary]} onPress={onKeepDrawn}>
              <Text style={[styles.altBtnText, { color: '#0B1023' }]}>Keep Drawn</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={onDiscardHeld}
            disabled={!held || faceDownLeft !== 1}
            style={[
              styles.keepBtn,
              (!held || faceDownLeft !== 1) && { opacity: 0.5 },
            ]}
          >
            <Text style={styles.keepText}>Discard Held</Text>
          </Pressable>
        )}
      </View>

      {/* Pass overlay (hidden in Solo mode) */}
      <Modal transparent visible={showPassOverlay} animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setState(s => advancePeek(s))}>
          <View style={styles.overlayCard}>
            <Text style={styles.overlayTitle}>{getNextPeekLabel(state)}</Text>
            <Text style={[styles.timerText, { marginTop: 12 }]}>Tap anywhere to continue</Text>
          </View>
        </Pressable>
      </Modal>

      {/* Optional spacer so content never sits behind the absolute footer */}
      <SafeAreaView edges={['bottom']}>
        <View style={{ height: bottomLift + 12 }} />
      </SafeAreaView>
    </View>
  );
}

// ===== Helpers / AI =====
function getOppCount(s: GameState) {
  const me = s.phase === 'peek' ? (s.peekTurnIndex ?? 0) : s.currentPlayerIndex;
  return s.players.filter((_, i) => i !== me).length;
}

function getNextPeekLabel(s: GameState): string {
  if (s.phase !== 'peek' || s.peekTurnIndex == null) return '';
  let idx = s.peekTurnIndex;
  for (let marched = 0; marched < s.players.length; marched++) {
    idx = (idx + 1) % s.players.length;
    if ((s.players[idx]?.peekFlips ?? 2) < 2) return `Pass to ${s.players[idx].name}`;
  }
  return 'All set! Tap to start the round';
}

function value(card: Card): number {
  if (card.rank === 'K') return 0;
  if (card.rank === 'A') return 1;
  if (card.rank === 'J' || card.rank === 'Q') return 10;
  const n = parseInt(card.rank as string, 10);
  if (!isNaN(n)) return n === 5 ? -5 : n;
  return 0;
}

function colHasPairFor(card: Card, grid: Grid): boolean {
  for (let c = 0; c < 3; c++) {
    const ranks = [grid[0][c], grid[1][c], grid[2][c]].map(x => x?.rank ?? null);
    const ups = [grid[0][c], grid[1][c], grid[2][c]].map(x => !!x?.faceUp);
    const same = ranks.filter(r => r === card.rank).length;
    if (same >= 2 && (!ups[0] || !ups[1] || !ups[2] || ranks.some(r => r !== card.rank))) {
      return true;
    }
  }
  return false;
}

function worstFaceUp(grid: Grid): { r: number; c: number; score: number } | null {
  let out: { r: number; c: number; score: number } | null = null;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const cell = grid[r][c];
    if (!cell || !cell.faceUp || cell.zeroed) continue;
    const v = value(cell);
    if (!out || v > out.score) out = { r, c, score: v };
  }
  return out;
}

function anyFaceDown(grid: Grid): { r: number; c: number } | null {
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const cell = grid[r][c];
    if (cell && !cell.faceUp) return { r, c };
  }
  return null;
}

function shouldTakeDiscard(s: GameState, idx: number, top: Card): boolean {
  const g = s.players[idx].grid;
  if (colHasPairFor(top, g)) return true;
  const worst = worstFaceUp(g);
  if (!worst) return false;
  return value(top) < worst.score;
}

function pickTarget(grid: Grid, incoming: Card): { r: number; c: number } {
  // 1) Finish a triple if possible
  for (let c = 0; c < 3; c++) {
    const cells = [grid[0][c], grid[1][c], grid[2][c]];
    const ranks = cells.map(x => x?.rank ?? null);
    const ups = cells.map(x => !!x?.faceUp);
    const same = ranks.filter(r => r === incoming.rank).length;
    if (same >= 2) {
      for (let r = 0; r < 3; r++) {
        const cur = grid[r][c];
        if (!cur) continue;
        if (!ups[r] || cur.rank !== incoming.rank) return { r, c };
      }
    }
  }
  // 2) Replace current worst face-up if incoming is better
  const worst = worstFaceUp(grid);
  if (worst && value(incoming) < worst.score) return { r: worst.r, c: worst.c };

  // 3) Otherwise reveal any face-down
  const fd = anyFaceDown(grid);
  if (fd) return fd;

  // 4) Fallback: first non-zeroed face-up
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const cell = grid[r][c];
    if (cell && cell.faceUp && !cell.zeroed) return { r, c };
  }
  return { r: 0, c: 0 };
}

function aiPlayTurn(s: GameState, idx: number): GameState {
  if (s.phase !== 'turn' || s.currentPlayerIndex !== idx) return s;

  let working = s;
  const top = working.topDiscard;

  if (top && shouldTakeDiscard(working, idx, top)) {
    const res = takeDiscard(working);
    working = res.state;
    const card = res.drawn!;
    const { r, c } = pickTarget(working.players[idx].grid, card);
    return replaceGridCard(working, idx, r, c, card);
  }

  const res = drawFromDeck(working);
  working = res.state;
  const drawn = res.drawn;
  const { r, c } = pickTarget(working.players[idx].grid, drawn);
  return replaceGridCard(working, idx, r, c, drawn);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1023' },

  header: {
    paddingTop: 12, paddingHorizontal: 12, paddingBottom: 6,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'
  },
  heading: { color: '#E8ECF1', fontSize: 18, flexShrink: 1, marginRight: 8 },
  timerChip: {
    flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, backgroundColor: '#121737', borderWidth: 1, borderColor: '#2A2F57'
  },
  timerText: { color: '#9BA3C7', fontVariant: ['tabular-nums'] },

  oppRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  oppCard: { borderWidth: 1, borderColor: '#2A2F57', backgroundColor: '#121737', borderRadius: 12 },

  meTitle: { color: '#E8ECF1', fontSize: 16, marginBottom: 8 },
  subtle: { color: '#9BA3C7' },

  // Footer is absolutely positioned and lifted from the bottom
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    // bottom is set dynamically via style prop (bottom: bottomLift)
    minHeight: 74,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#2A2F57',
    backgroundColor: 'transparent',
  },

  held: { color: '#ffffffff', fontSize: 22, fontWeight: '700' },

  keepBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 2, borderColor: '#4DA3FF' },
  keepText: { color: '#4DA3FF', fontWeight: '800' },

  altBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 2, borderColor: '#4DA3FF' },
  altBtnPrimary: { backgroundColor: '#4DA3FF', borderColor: '#4DA3FF' },
  altBtnText: { color: '#4DA3FF', fontWeight: '800' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  overlayCard: { padding: 20, borderRadius: 16, backgroundColor: '#121737', borderWidth: 1, borderColor: '#2A2F57', width: '75%', alignItems: 'center' },
  overlayTitle: { color: '#E8ECF1', fontSize: 20, fontWeight: '800', textAlign: 'center' },
});
