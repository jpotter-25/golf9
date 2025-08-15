// src/screens/GameScreen.tsx
// Purpose: Main gameplay screen. Supports Pass & Play and Solo (basic AI).
// Note: Online mode scaffolding is included; full authoritative server logic can be iterated later.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import type { GameState, Card } from '../game/types';
import { deal, drawFromDeck, takeDiscard, replaceGridCard, discardDrawn, startTurns, flipForPeek, isRoundOver, computeScore } from '../game/gameLogic';
import Grid from '../components/Grid';
import Piles from '../components/Piles';
import { useScale } from '../utils/scaling';
import { aiChoose } from '../game/ai';

type Props = NativeStackScreenProps<RootStackParamList, 'Game'>;

export default function GameScreen({ route, navigation }: Props) {
  const { players, mode } = route.params;
  const [state, setState] = useState<GameState>(() => deal(players));
  const [held, setHeld] = useState<Card | null>(null);
  const { gap } = useScale();

  // Start turns after quick peek phase (each player can flip one card once)
  useEffect(() => {
    const t = setTimeout(() => setState(s => startTurns(s)), 3000);
    return () => clearTimeout(t);
  }, []);

  // Idle-time autoplayer: ends turn if time elapsed
  useEffect(() => {
    const timer = setInterval(() => {
      setState(s => {
        if (s.phase !== 'turn' || !s.turnEndsAt) return s;
        if (Date.now() >= s.turnEndsAt) {
          // auto-discard if holding, else pass to next player by drawing & discarding
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
  }, [held]);

  // Solo AI if needed (AI takes turns for players > 1 in solo mode)
  useEffect(() => {
    if (mode !== 'solo') return;
    const current = state.currentPlayerIndex;
    if (current === 0 || state.phase !== 'turn') return; // human is player 0
    const t = setTimeout(() => {
      setState(s => {
        const choice = aiChoose(s, current);
        if (choice.action === 'discard') {
          const { state: next, drawn } = takeDiscard(s);
          if (drawn) return discardDrawn(next, drawn);
          return next;
        } else {
          // prefer discard if beneficial, otherwise draw
          const top = s.discardPile[s.discardPile.length - 1] ?? null;
          if (top) {
            const { state: n0, drawn } = takeDiscard(s);
            if (drawn && choice.replaceAt) {
              return replaceGridCard(n0, current, choice.replaceAt.r, choice.replaceAt.c, drawn);
            }
            return n0;
          } else {
            const { state: n1, drawn } = drawFromDeck(s);
            if (choice.replaceAt) return replaceGridCard(n1, current, choice.replaceAt.r, choice.replaceAt.c, drawn);
            return discardDrawn(n1, drawn);
          }
        }
      });
    }, 1200);
    return () => clearTimeout(t);
  }, [state, mode]);

  // Helpers
  const me = state.players[ state.currentPlayerIndex ];

  const onPressGrid = (r: number, c: number) => {
    setState(s => {
      if (s.phase === 'peek') {
        return flipForPeek(s, s.currentPlayerIndex, r, c);
      }
      if (s.phase !== 'turn') return s;
      if (held) {
        const next = replaceGridCard(s, s.currentPlayerIndex, r, c, held);
        setHeld(null);
        return next;
      }
      return s;
    });
  };

  const onDraw = () => {
    if (state.phase !== 'turn' || held) return;
    const { state: next, drawn } = drawFromDeck(state);
    setHeld(drawn);
    setState(next);
  };

  const onTakeDiscard = () => {
    if (state.phase !== 'turn' || held) return;
    const { state: next, drawn } = takeDiscard(state);
    if (drawn) setHeld(drawn);
    setState(next);
  };

  const onDiscardHeld = () => {
    if (!held) return;
    setState(s => discardDrawn(s, held));
    setHeld(null);
  };

  useEffect(() => {
    if (isRoundOver(state)) {
      const scores = state.players.map((p) => computeScore(p.grid));
      const lines = scores.map((sc, i) => `P${i+1}: ${sc}`).join('\n');
      Alert.alert('Round Over', lines, [
        { text: 'OK', onPress: () => navigation.navigate('Lobby') }
      ]);
    }
  }, [state]);

  // Layout: your board bottom; opponents arranged per 2/3/4 layouts
  const opponents = useMemo(() => state.players.map((p,i)=>({p,i})).filter(x => x.i !== state.currentPlayerIndex), [state]);

  return (
    <View style={styles.container}>
      <View style={{ padding: 12 }}>
        <Text style={styles.heading}>Turn: Player {state.currentPlayerIndex + 1}</Text>
      </View>

      {/* Opponents area */}
      <View style={[styles.opponents, { gap }]}>
        {opponents.map(({p,i}) => (
          <View key={p.id} style={styles.oppCard}>
            <Text style={styles.subtle}>{p.name}</Text>
            <Grid grid={p.grid} />
          </View>
        ))}
      </View>

      {/* Center piles */}
      <View style={{ paddingVertical: 10 }}>
        <Piles
          drawCount={state.drawPile.length}
          topDiscard={state.topDiscard}
          onDraw={onDraw}
          onTakeDiscard={onTakeDiscard}
        />
      </View>

      {/* Me */}
      <View style={{ padding: 12 }}>
        <Text style={styles.meTitle}>Your Grid</Text>
        <Grid grid={me.grid} onPressCard={onPressGrid} />
      </View>

      {/* Held card controls */}
      <View style={styles.footer}>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.subtle}>Held</Text>
          <View style={{ height: 6 }} />
          {held ? <Text style={styles.held}>{held.rank}{held.suit}</Text> : <Text style={styles.subtle}>None</Text>}
        </View>
        <Pressable onPress={onDiscardHeld} disabled={!held} style={[styles.keepBtn, !held && { opacity: 0.5 }]}>
          <Text style={styles.keepText}>Discard Held</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1023' },
  heading: { color: '#E8ECF1', fontSize: 18, textAlign: 'center' },
  opponents: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-evenly', paddingHorizontal: 8 },
  oppCard: { borderWidth: 1, borderColor: '#2A2F57', backgroundColor: '#121737', padding: 8, borderRadius: 12, marginBottom: 8 },
  meTitle: { color: '#E8ECF1', fontSize: 16, marginBottom: 8 },
  subtle: { color: '#9BA3C7' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#2A2F57' },
  held: { color: '#FFCC66', fontSize: 22, fontWeight: '700' },
  keepBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: '#52E5A7' },
  keepText: { color: '#52E5A7', fontWeight: '700' }
});
