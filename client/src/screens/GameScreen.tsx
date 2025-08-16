// src/screens/GameScreen.tsx
// Purpose: Gameplay with scaling, piles, final-sweep, multi-round flow,
// proper "keep revealed" behavior, and opponent panels sized/clipped
// so their grids never overhang the titled rectangle (2P/3P/4P).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Modal, useWindowDimensions } from 'react-native';
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

  // Round manager
  const [round, setRound] = useState<number>(1);
  const [totals, setTotals] = useState<number[]>(
    Array.from({ length: players }, () => 0)
  );

  const [state, setState] = useState<GameState>(() => deal(players));
  const [held, setHeld] = useState<Card | null>(null);
  const [tick, setTick] = useState(0);
  const [activeSource, setActiveSource] = useState<'draw' | 'discard' | null>(null);
  const [pending, setPending] = useState<{ r: number; c: number } | null>(null);

  // Freeze timers while showing round summary
  const [locked, setLocked] = useState(false);

  // Final-sweep state (UI-managed)
  const [sweepActive, setSweepActive] = useState(false);
  const sweepStarter = useRef<number | null>(null);
  const lastTurnIndex = useRef<number>(0);

  const playerCount = state.players.length;
  const metrics = useBoardMetrics(playerCount);
  const { width: winW } = useWindowDimensions();

  // === Opponent panel width (prevents right/left bleed) ===
  // Row has horizontal padding of 8 on each side + 8px gaps between items.
  const OPP_ROW_SIDE_PAD = 8 * 2;
  const OPP_ROW_GAPS = 8 * 2; // two gaps between three panels
  // Use CEIL (not floor) so rounding never makes the panel narrower than its content.
  const oppPanelWidth = Math.ceil((winW - OPP_ROW_SIDE_PAD - OPP_ROW_GAPS) / 3);

  // Ticker for countdown chip
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Peek deadlines
  useEffect(() => {
    const id = setInterval(() => {
      setState((s) => {
        if (locked) return s;
        if (s.phase !== 'peek' || !s.peekEndsAt) return s;
        if (Date.now() >= s.peekEndsAt) {
          const filled = autoCompleteCurrentPeek(s);
          setPending(null);
          setActiveSource(null);
          return advancePeek(filled);
        }
        return s;
      });
    }, 250);
    return () => clearInterval(id);
  }, [locked]);

  // Idle-time autoplayer
  useEffect(() => {
    const timer = setInterval(() => {
      setState((s) => {
        if (locked) return s;
        if (s.phase !== 'turn' || !s.turnEndsAt) return s;
        if (Date.now() >= s.turnEndsAt) {
          setPending(null);
          setActiveSource(null);
          if (held) {
            const next = discardDrawn(s, held);
            setHeld(null);
            return next;
          } else {
            const { state: next, drawn } = drawFromDeck(s);
            return discardDrawn(next, drawn);
          }
        }
        return s;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [held, locked]);

  // Final sweep detection
  useEffect(() => {
    if (state.phase !== 'turn' || locked) return;
    const i = state.currentPlayerIndex;
    const allUp = state.players[i].grid.every((row) => row.every((c) => c?.faceUp));
    if (allUp && !sweepActive && sweepStarter.current == null) {
      sweepStarter.current = i;     // who triggered the sweep
      setSweepActive(true);
    }
  }, [state, sweepActive, locked]);

  // When a new turn begins during a sweep, see if we looped back to the starter
  useEffect(() => {
    if (state.phase !== 'turn' || locked) return;
    const i = state.currentPlayerIndex;
    if (sweepActive && sweepStarter.current != null) {
      if (lastTurnIndex.current !== i && i === sweepStarter.current) {
        endRoundAndMaybeContinue(); // everyone else had their last turns
      }
    }
    lastTurnIndex.current = i;
  }, [state, sweepActive, locked]);

  // Local scoring so we can enforce "5 = -5"
  const scoreGrid = (grid: Grid): number => {
    let total = 0;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const card = grid[r][c];
        if (!card) continue;
        if (card.zeroed) continue; // matched column -> 0
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
    setLocked(true); // freeze timers/UI progression during summary
    const roundScores = state.players.map((p) => scoreGrid(p.grid));
    setTotals((prev) => prev.map((t, i) => t + roundScores[i]));

    const prettyRound = roundScores.map((sc, i) => `Player ${i + 1}: ${sc}`).join('\n');

    if (round < TOTAL_ROUNDS) {
      Alert.alert(
        `Round ${round} complete`,
        prettyRound + `\n\nTap "Next" for Round ${round + 1}.`,
        [
          {
            text: 'Next',
            onPress: () => {
              // reset for next round
              sweepStarter.current = null;
              setSweepActive(false);
              setHeld(null);
              setPending(null);
              setActiveSource(null);
              setState(deal(players));
              setRound((r) => r + 1);
              setLocked(false); // resume
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

  // Helpers
  const secsLeft =
    locked
      ? 0
      : state.phase === 'peek'
        ? Math.max(0, Math.ceil(((state.peekEndsAt ?? 0) - Date.now()) / 1000))
        : Math.max(0, Math.ceil(((state.turnEndsAt ?? 0) - Date.now()) / 1000));

  const bottomIndex =
    state.phase === 'peek' ? (state.peekTurnIndex ?? 0) : state.currentPlayerIndex;
  const bottomPlayer = state.players[bottomIndex];

  const opponents = useMemo(() => {
    const active = bottomIndex;
    return state.players.map((p, i) => ({ p, i })).filter((x) => x.i !== active);
  }, [state, bottomIndex]);

  // Convenience: how many face-down remain for current player?
  const faceDownLeft = (() => {
    const g = state.players[state.currentPlayerIndex].grid;
    let n = 0;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) if (g[r][c] && !g[r][c]!.faceUp) n++;
    return n;
  })();

  // ——— Actions ———
  const onPressGrid = (r: number, c: number) => {
    setState((s) => {
      if (locked) return s;
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
        target.faceUp = true; // reveal first
        setPending({ r, c }); // await decision
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
    if (locked) return;
    if (state.phase !== 'turn' || held) return;
    const { state: next, drawn } = drawFromDeck(state);
    setHeld(drawn);
    setActiveSource('draw');
    setPending(null);
    setState(next);
  };

  const onTakeDiscard = () => {
    if (locked) return;
    if (state.phase !== 'turn' || held) return;
    const { state: next, drawn } = takeDiscard(state);
    if (drawn) setHeld(drawn);
    setActiveSource('discard');
    setPending(null);
    setState(next);
  };

  const onDiscardHeld = () => {
    if (locked) return;
    if (!held) return;

    // Rule: Only allowed when exactly 1 face-down remains.
    if (faceDownLeft !== 1) {
      Alert.alert('Choose a slot', 'You can only discard the held card when one slot remains face-down.');
      return;
    }

    setState((s) => discardDrawn(s, held));
    setHeld(null);
    setPending(null);
    setActiveSource(null);
  };

  // Keep revealed should not be gated by the discard rule.
  const onKeepRevealed = () => {
    if (!held || !pending || locked) return;
    setState((s) => discardDrawn(s, held)); // discard as part of replace flow
    setHeld(null);
    setPending(null);
    setActiveSource(null);
  };

  const onKeepDrawn = () => {
    if (!held || !pending || locked) return;
    setState((s) => replaceGridCard(s, s.currentPlayerIndex, pending.r, pending.c, held));
    setHeld(null);
    setPending(null);
    setActiveSource(null);
  };

  // Pass overlay (peek)
  const showPassOverlay =
    state.phase === 'peek' &&
    (state.players[state.peekTurnIndex ?? 0]?.peekFlips ?? 0) >= 2;

  const nextPeekLabel = (() => {
    if (state.phase !== 'peek' || state.peekTurnIndex == null) return '';
    let idx = state.peekTurnIndex;
    for (let marched = 0; marched < state.players.length; marched++) {
      idx = (idx + 1) % state.players.length;
      if ((state.players[idx]?.peekFlips ?? 2) < 2) return `Pass to ${state.players[idx].name}`;
    }
    return 'All set! Tap to start the round';
  })();

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
          <Text style={styles.timerText}>⏱ {secsLeft}s</Text>
          <Text style={[styles.timerText, { marginLeft: 8 }]}>R{round}/{TOTAL_ROUNDS}</Text>
        </View>
      </View>

      {/* Opponents – fixed-width panels + overflow hidden so nothing bleeds */}
      <View style={{ paddingHorizontal: 8, paddingBottom: 6 }}>
        <View style={[styles.oppRow, { justifyContent: 'space-between' }]}>
          {opponents.map(({ p }, idx) => (
            <View
              key={p.id ?? idx}
              style={[styles.oppCard, { width: oppPanelWidth, overflow: 'hidden' }]}
            >
              <Text style={styles.subtle} numberOfLines={1}>{p.name}</Text>
              <GridView grid={p.grid} metrics={metrics.opp} />
            </View>
          ))}
        </View>
      </View>

      {/* Piles */}
      <View style={{ paddingVertical: 2 }}>
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

      {/* Bottom player */}
      <View style={{ padding: 12 }}>
        <Text style={styles.meTitle}>{bottomPlayer.name}</Text>
        <GridView
          grid={bottomPlayer.grid}
          onPressCard={onPressGrid}
          metrics={metrics.me}
          activeCell={pending}
        />
      </View>

      {/* Footer */}
      <View style={styles.footer}>
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

      {/* Pass overlay */}
      <Modal transparent visible={showPassOverlay} animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setState((s) => advancePeek(s))}>
          <View style={styles.overlayCard}>
            <Text style={styles.overlayTitle}>{nextPeekLabel}</Text>
            <Text style={[styles.timerText, { marginTop: 12 }]}>Tap anywhere to continue</Text>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1023' },
  header: { paddingTop: 12, paddingHorizontal: 12, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { color: '#E8ECF1', fontSize: 18, flexShrink: 1, marginRight: 8 },
  timerChip: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#121737', borderWidth: 1, borderColor: '#2A2F57' },
  timerText: { color: '#9BA3C7', fontVariant: ['tabular-nums'] },

  oppRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  oppCard: { borderWidth: 1, borderColor: '#2A2F57', backgroundColor: '#121737', padding: 8, borderRadius: 12 },

  meTitle: { color: '#E8ECF1', fontSize: 16, marginBottom: 8 },
  subtle: { color: '#9BA3C7' },

  footer: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#2A2F57',
  },
  held: { color: '#FFCC66', fontSize: 22, fontWeight: '700' },

  keepBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 2, borderColor: '#4DA3FF' },
  keepText: { color: '#4DA3FF', fontWeight: '800' },

  altBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 2, borderColor: '#4DA3FF' },
  altBtnPrimary: { backgroundColor: '#4DA3FF', borderColor: '#4DA3FF' },
  altBtnText: { color: '#4DA3FF', fontWeight: '800' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  overlayCard: { padding: 20, borderRadius: 16, backgroundColor: '#121737', borderWidth: 1, borderColor: '#2A2F57', width: '75%', alignItems: 'center' },
  overlayTitle: { color: '#E8ECF1', fontSize: 20, fontWeight: '800', textAlign: 'center' },
});
