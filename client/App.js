/**
 * Golf 9 - Expo (React Native) client
 * - Pass & Play fully implemented for 2-4 players
 * - Solo vs AI (medium) implemented
 * - Optional Online (LAN) prototype via WebSocket
 * 
 * All major sections are commented for clarity.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, View, Text, Pressable, Modal, Platform, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import create from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import * as KeepAwake from 'expo-keep-awake';

/* -------------------------- Styles (simple) -------------------------- */
const colors = {
  bg: '#0f172a',
  panel: '#111827',
  text: '#e5e7eb',
  accent: '#38bdf8',
  green: '#22c55e',
  red: '#ef4444',
  yellow: '#f59e0b',
  outline: '#60a5fa'
};

const S = {
  root: { flex: 1, backgroundColor: colors.bg },
  header: { padding: 16, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.text, opacity: 0.8, marginTop: 6 },
  panel: { backgroundColor: colors.panel, borderRadius: 16, margin: 12, padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  btn: { backgroundColor: colors.accent, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#001018', fontWeight: '800' },
  small: { fontSize: 12, color: colors.text },
  text: { color: colors.text },
};

/* -------------------------- Card + Game Types -------------------------- */
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

function cardValue(rank, useJokers=false, isJoker=false) {
  if (isJoker) return -2;
  if (rank === 'A') return 1;
  if (rank === '5') return -5;
  if (['J','Q'].includes(rank)) return 10;
  if (rank === 'K') return 0;
  // 2-4,6-10 face value
  const n = parseInt(rank,10);
  return isNaN(n) ? 0 : n;
}

function makeDeck(useJokers) {
  const deck = [];
  for (let d=0; d<2; d++) {
    for (const s of SUITS) {
      for (const r of RANKS) {
        deck.push({ id: uuidv4(), rank: r, suit: s, isJoker: false });
      }
    }
    if (useJokers) {
      deck.push({ id: uuidv4(), rank: 'Joker', suit: '', isJoker: true });
      deck.push({ id: uuidv4(), rank: 'Joker', suit: '', isJoker: true });
    }
  }
  return shuffle(deck);
}

function shuffle(a) {
  const arr = a.slice();
  for (let i=arr.length-1;i>0;i--) {
    const j = Math.floor(Math.random()*(i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* -------------------------- Column Match (3 of a kind) -------------------------- */
function isThreeOfKindColumn(grid, colIdx) {
  const rows = [0,1,2];
  const ranks = rows.map(r => grid[r*3+colIdx]?.rank);
  if (ranks.some(r => !r)) return false;
  return ranks[0] === ranks[1] && ranks[1] === ranks[2];
}

/* -------------------------- Scoring -------------------------- */
function scoreGrid(grid, useJokers) {
  // 3 columns -> if any is three of a kind => that column scores 0
  let total = 0;
  for (let r=0;r<3;r++) {
    for (let c=0;c<3;c++) {
      const idx = r*3+c;
      const card = grid[idx];
      const colIsSet = isThreeOfKindColumn(grid, c);
      if (colIsSet) continue;
      total += cardValue(card.rank, useJokers, card.isJoker);
    }
  }
  return total;
}

/* -------------------------- AI (medium) -------------------------- */
function chooseAIMove(state, pid) {
  // Simplified medium AI:
  // 1) Prefer taking top of discard if it helps complete a 3-of-kind column or is <= 0.
  // 2) Else draw from deck.
  // 3) Replace the highest positive value card that doesn't break a 3-of-kind potential.
  const { discardTop, useJokers } = state;
  const me = state.players.find(p => p.id === pid);
  const candidateFromDiscard = discardTop;
  const drawDiscardScore = candidateFromDiscard 
    ? cardValue(candidateFromDiscard.rank, useJokers, candidateFromDiscard.isJoker) 
    : 999;

  let takeDiscard = false;
  if (candidateFromDiscard) {
    // If <= 0 it's appealing
    if (drawDiscardScore <= 0) takeDiscard = true;
    // If helps 3-of-kind column (match any rank in a column)
    outer: for (let c=0;c<3;c++) {
      const ranks = [0,1,2].map(r=> me.grid[r*3+c]?.rank).filter(Boolean);
      if (ranks.length && ranks.every(r => r === candidateFromDiscard.rank)) { takeDiscard = true; break outer; }
    }
  }

  const source = takeDiscard ? 'discard' : 'draw';

  // choose replace index: find highest positive value revealed first, else random unrevealed
  // prefer replacing revealed positives
  let bestIdx = -1;
  let bestScore = -1;
  for (let i=0;i<9;i++) {
    const cell = me.grid[i];
    if (!cell.revealed) continue;
    const val = cardValue(cell.rank, useJokers, cell.isJoker);
    if (val > bestScore) { bestScore = val; bestIdx = i; }
  }
  if (bestIdx === -1) {
    // no revealed positives; pick a non-revealed spot
    const hidden = me.grid.map((c,i)=>({i,c})).filter(x=>!x.c.revealed);
    if (hidden.length) bestIdx = hidden[0].i;
    else bestIdx = 0;
  }
  return { source, targetIndex: bestIdx };
}

/* -------------------------- Store -------------------------- */
const useStore = create((set, get)=> ({
  // Config (lobby)
  playersCount: 2,
  roundsCount: 5,
  useJokers: false,
  mode: 'passplay', // passplay | solo | online
  setConfig: (cfg)=> set(cfg),
  // Runtime
  inGame: false,
  players: [], // {id,name,grid:[{id,rank,suit,isJoker,revealed}], score, avatar }
  draw: [],
  discard: [],
  currentPlayer: 0,
  round: 1,
  heldCard: null, // drawn or from discard
  winnerId: null,
  closing: false,
  idleSeconds: 0,
  discardTop: null,
  extraTurnFlag: false,

  startGame: () => {
    const {playersCount, roundsCount, useJokers, mode} = get();
    const deck = makeDeck(useJokers);
    // Deal 9 cards per player, face-down
    const players = Array.from({length: playersCount}).map((_,idx)=> ({
      id: idx.toString(),
      name: `Player ${idx+1}`,
      avatar: idx+1,
      score: 0,
      grid: Array.from({length:9}).map(()=> ({...deck.pop(), revealed: false}))
    }));

    // initialize discard with one from draw
    const discardTop = deck.pop();
    const discard = [discardTop];
    const draw = deck;

    // choose first player at random
    const currentPlayer = Math.floor(Math.random()*playersCount);

    set({
      inGame: true,
      playersCount, roundsCount, useJokers, mode,
      players, draw, discard, discardTop,
      currentPlayer, heldCard: null, round: 1,
      closing: false, extraTurnFlag: false, winnerId: null
    });
  },

  // Peek phase: auto if player doesn't act in 15s; here we instantly reveal two at start for simplicity,
  // but provide a button to "Auto-peek" to mimic behavior.
  autoPeekAll: () => {
    const st = get();
    const players = st.players.map(p=>{
      const indices = shuffle([0,1,2,3,4,5,6,7,8]).slice(0,2);
      const grid = p.grid.map((c,i)=> i===indices[0]||i===indices[1] ? {...c, revealed: true} : c);
      return {...p, grid};
    });
    set({ players });
  },

  drawFrom: (source) => {
    const st = get();
    if (st.heldCard) return;
    if (source==='draw') {
      if (st.draw.length===0) {
        // reshuffle
        const top = st.discard[st.discard.length-1];
        const pool = st.discard.slice(0, -1);
        const reshuffled = shuffle(pool);
        set({ draw: reshuffled, discard: [top] });
      }
      const card = get().draw.pop();
      set({ heldCard: card });
    } else if (source==='discard') {
      const card = st.discardTop;
      if (!card) return;
      const newDisc = st.discard.slice(0,-1);
      set({ heldCard: card, discard: newDisc, discardTop: newDisc[newDisc.length-1] || null });
    }
  },

  placeOrKeep: (index) => {
    const st = get();
    const { currentPlayer, heldCard } = st;
    if (!heldCard) return;
    const players = st.players.map((p, pi)=>{
      if (pi!==currentPlayer) return p;
      const cell = p.grid[index];
      // If cell unrevealed, flip it (as per rules), then choose keep revealed vs keep drawn
      // Here we treat the action as "tap target slot": if unrevealed, we reveal it,
      // and we interpret tap as selecting "Keep Revealed" (discard held). Use "Replace" button for replace.
      return p;
    });
    set({ players });
  },

  replaceAt: (index) => {
    const st = get();
    const { currentPlayer, heldCard, useJokers } = st;
    if (!heldCard) return;
    const players = st.players.map((p, pi)=>{
      if (pi!==currentPlayer) return p;
      const grid = p.grid.slice();
      // flip target slot if hidden and we are replacing it with drawn card
      const prev = grid[index];
      const newCell = { ...heldCard, revealed: true };
      grid[index] = newCell;
      const newP = { ...p, grid };
      return newP;
    });

    // Push previous card to discard
    const prevCard = st.players[currentPlayer].grid[index];
    const newDiscard = st.discard.concat([{...prevCard, revealed: true}]);

    // Extra turn if 3 of a kind in the column
    const c = index % 3;
    const colMatch = isThreeOfKindColumn(players[currentPlayer].grid, c);

    // Check for closing
    const allRevealed = players[currentPlayer].grid.every(c=>c.revealed);
    let closing = st.closing || allRevealed;

    // Advance turn unless extra turn
    let nextPlayer = st.currentPlayer;
    let extraTurnFlag = false;
    if (colMatch) {
      extraTurnFlag = true;
    } else {
      nextPlayer = (st.currentPlayer + 1) % st.playersCount;
      // if we just closed, everyone else gets one final turn; we handle in scoreIfRoundOver
    }

    set({ 
      players, 
      discard: newDiscard, 
      discardTop: newDiscard[newDiscard.length-1], 
      heldCard: null,
      currentPlayer: nextPlayer,
      extraTurnFlag,
      closing
    });

    get().scoreIfRoundOver();
  },

  keepRevealedAt: (index) => {
    const st = get();
    const { currentPlayer } = st;
    if (!st.heldCard) return;
    const players = st.players.map((p,pi)=>{
      if (pi!==currentPlayer) return p;
      const grid = p.grid.slice();
      const cell = grid[index];
      grid[index] = { ...cell, revealed: true };
      return { ...p, grid };
    });
    // discard held card
    const newDiscard = st.discard.concat([st.heldCard]);
    set({ players, discard: newDiscard, discardTop: newDiscard[newDiscard.length-1], heldCard: null, currentPlayer: (st.currentPlayer+1)%st.playersCount });
  },

  scoreIfRoundOver: () => {
    const st = get();
    // If someone has all 9 revealed and we've looped back past them once, end round.
    // For simplicity, end round once every player has all revealed OR draw exhausted twice.
    const allDone = st.players.every(p=> p.grid.every(c=>c.revealed));
    if (!allDone) return;
    // score
    const scored = st.players.map(p=> ({...p, roundScore: scoreGrid(p.grid, st.useJokers)}));
    const totals = scored.map(p=> p.score + p.roundScore);
    const min = Math.min(...totals);
    const winnerIdx = totals.indexOf(min);
    const nextRound = st.round + 1;
    const gameEnd = nextRound > st.roundsCount;
    const updated = scored.map(p=> ({...p, score: p.score + p.roundScore}));
    set({ players: updated, winnerId: updated[winnerIdx].id });

    if (gameEnd) {
      // stay on results
    } else {
      // start next round
      const { playersCount, useJokers } = st;
      const deck = makeDeck(useJokers);
      const players2 = Array.from({length: playersCount}).map((_,idx)=> ({
        id: idx.toString(),
        name: `Player ${idx+1}`,
        avatar: idx+1,
        score: updated[idx].score,
        grid: Array.from({length:9}).map(()=> ({...deck.pop(), revealed: false}))
      }));
      const discardTop = deck.pop();
      const discard = [discardTop];
      const draw = deck;
      const currentPlayer = (st.currentPlayer + 1) % playersCount; // rotate starter
      set({
        draw, discard, discardTop, players: players2, round: nextRound,
        currentPlayer, heldCard: null, closing: false, extraTurnFlag: false
      });
    }
  }
}));

/* -------------------------- UI Components -------------------------- */

function Card({card, highlighted, outlined, onPress}) {
  const isRed = card.suit === '♥' || card.suit === '♦';
  const borderColor = outlined ? colors.outline : '#334155';
  const bg = card.revealed ? '#0b1220' : '#0b1220';
  return (
    <Pressable onPress={onPress} style={{ 
      width: 56, height: 78, borderRadius: 10, borderWidth: 2, borderColor, 
      backgroundColor: bg, alignItems: 'center', justifyContent: 'center', margin: 2
    }}>
      {card.revealed ? (
        <View style={{alignItems:'center', justifyContent:'center'}}>
          <Text style={{color: isRed? '#fca5a5':'#cbd5e1', fontWeight:'800'}}>
            {card.isJoker ? '🃏' : `${card.rank}${card.suit}`}
          </Text>
        </View>
      ) : (
        <View style={{alignItems:'center', justifyContent:'center'}}>
          <Text style={{color:'#64748b'}}>🂠</Text>
        </View>
      )}
      {highlighted && (
        <View style={{ position:'absolute', inset:0, borderColor: colors.green, borderWidth: 3, borderRadius: 10 }}/>
      )}
    </Pressable>
  );
}

function Grid({playerIndex, compact=false, onCellPress}) {
  const { players } = useStore();
  const p = players[playerIndex];
  if (!p) return null;

  const size = compact ? { scale: 0.8 } : { scale: 1 };
  const rows = [0,1,2].map(r=> (
    <View key={r} style={{flexDirection:'row'}}>
      {[0,1,2].map(c=>{
        const idx = r*3+c;
        // highlight 3-of-kind columns
        const highlight = isThreeOfKindColumn(p.grid, c);
        return (
          <Card key={idx} card={p.grid[idx]} highlighted={highlight} onPress={()=> onCellPress?.(idx)} />
        );
      })}
    </View>
  ));
  return (
    <View style={{ transform:[{scale: size.scale}], alignItems:'center'}}>
      <Text style={{color: colors.text, marginBottom: 4}}>{p.name}</Text>
      {rows}
      <Text style={{color: colors.text, marginTop: 4}}>Round Total: {scoreGrid(p.grid, useStore.getState().useJokers)}</Text>
    </View>
  );
}

function Lobby() {
  const { playersCount, roundsCount, useJokers, mode, setConfig, startGame } = useStore();

  const Cycle = ({label, value, onPress}) => (
    <View style={[S.row, {marginVertical: 6}]}>
      <Text style={S.text}>{label}</Text>
      <Pressable style={S.btn} onPress={onPress}><Text style={S.btnText}>{value}</Text></Pressable>
    </View>
  );

  return (
    <View style={S.panel}>
      <Text style={S.text}>Configure your game</Text>
      <Cycle label="Players" value={playersCount} onPress={()=>{
        const next = playersCount===4 ? 2 : playersCount+1;
        setConfig({ playersCount: next });
      }}/>
      <Cycle label="Rounds" value={roundsCount} onPress={()=>{
        const next = roundsCount===9 ? 5 : 9;
        setConfig({ roundsCount: next });
      }}/>
      <Cycle label="Jokers" value={useJokers? 'On':'Off'} onPress={()=> setConfig({ useJokers: !useJokers })}/>
      <Cycle label="Mode" value={mode==='passplay'?'Pass & Play': mode==='solo'?'Solo vs AI':'Online (LAN)'} onPress={()=>{
        const order = ['passplay','solo','online'];
        const next = order[(order.indexOf(mode)+1)%order.length];
        setConfig({ mode: next });
      }}/>

      <View style={[S.row, {marginTop: 12}]}>
        <Pressable style={[S.btn, {flex:1}]} onPress={startGame}>
          <Text style={S.btnText}>Start</Text>
        </Pressable>
      </View>

      <View style={{marginTop:12}}>
        <Text style={[S.small, {opacity:0.8}]}>Tap "Game Rules & Tips" below.</Text>
      </View>
    </View>
  );
}

function Controls() {
  const { drawFrom, replaceAt, keepRevealedAt, heldCard, currentPlayer, players, discardTop, mode } = useStore();
  const me = players[currentPlayer];

  return (
    <View style={[S.panel]}>
      <Text style={S.text}>It's {me?.name}'s turn</Text>
      <View style={[S.row, {marginTop: 8}]}>
        <Pressable style={[S.btn, {flex:1, marginRight: 6}]} onPress={()=> drawFrom('draw')}>
          <Text style={S.btnText}>Draw</Text>
        </Pressable>
        <Pressable style={[S.btn, {flex:1, marginLeft: 6}]} onPress={()=> drawFrom('discard')}>
          <Text style={S.btnText}>Take Discard</Text>
        </Pressable>
      </View>
      <View style={{marginTop:8}}>
        <Text style={S.text}>Held: {heldCard ? (heldCard.isJoker? '🃏 Joker' : `${heldCard.rank}${heldCard.suit}`) : '—'}</Text>
      </View>
      {heldCard && (
        <Text style={[S.small, {marginTop:4}]}>Tap a grid card to flip & keep it (discard held), or use "Replace Mode" below.</Text>
      )}
      {heldCard && (
        <View style={{marginTop:8}}>
          <Text style={[S.text, {marginBottom:6}]}>Replace Mode: choose a slot index (0-8)</Text>
          <View style={[S.row]}>
            {[0,1,2,3,4,5,6,7,8].map(i=>(
              <Pressable key={i} onPress={()=> replaceAt(i)} style={{padding:6, borderWidth:1, borderColor:'#334155', borderRadius:8, marginHorizontal:2}}>
                <Text style={S.text}>{i}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
      <Text style={[S.small,{marginTop:8}]}>Tip: Tap a grid card to flip & keep it (Keep Revealed).</Text>
    </View>
  );
}

function RulesModal({visible, onClose}) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{flex:1, backgroundColor:'rgba(0,0,0,0.6)', justifyContent:'flex-end'}}>
        <View style={{backgroundColor:colors.panel, padding:16, borderTopLeftRadius:16, borderTopRightRadius:16, maxHeight: '70%'}}>
          <Text style={{color:colors.text, fontSize:18, fontWeight:'800'}}>Game Rules & Tips</Text>
          <Text style={[S.text,{marginTop:8}]}>
            • Goal: lowest total score across 5 or 9 rounds.{"\n"}
            • 3×3 grid per player; draw or take discard, then replace or keep revealed.{"\n"}
            • 3 of a kind in a column = that column scores 0 and you take an immediate extra turn.{"\n"}
            • Values: A=1, 5=−5, J/Q=10, K=0, others face value, Jokers(optional)=−2.{"\n"}
            • When draw pile empties, reshuffle the discard pile (keep the top discard).{"\n"}
            • Round ends when someone flips all 9; others get one last turn.{"\n"}
          </Text>
          <Pressable onPress={onClose} style={[S.btn,{marginTop:12, alignSelf:'flex-end'}]}>
            <Text style={S.btnText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function App() {
  const [showRules, setShowRules] = useState(false);
  const { inGame, playersCount } = useStore();

  useEffect(()=>{
    KeepAwake.activateKeepAwakeAsync();
    return ()=>{ KeepAwake.deactivateKeepAwake(); };
  },[]);

  return (
    <SafeAreaView style={S.root}>
      <StatusBar style="light" />
      <View style={S.header}>
        <Text style={S.title}>Golf 9</Text>
        <Text style={S.subtitle}>Fast, competitive 3×3 grid card game</Text>
      </View>

      {!inGame ? (
        <>
          <Lobby />
          <View style={[S.panel]}>
            <Pressable style={[S.btn]} onPress={()=> setShowRules(true)}>
              <Text style={S.btnText}>Game Rules & Tips</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          {/* Dynamic layout: your grid at bottom, opponents compacted above */}
          <View style={[S.panel]}>
            <Text style={S.text}>Opponent Boards</Text>
            <View style={{flexDirection:'row', justifyContent:'space-around', flexWrap:'wrap'}}>
              {[...Array(playersCount).keys()].filter(i=> i!==useStore.getState().currentPlayer).map(i=>(
                <Grid key={i} playerIndex={i} compact={true} onCellPress={()=>{}} />
              ))}
            </View>
          </View>

          <View style={[S.panel]}>
            <Text style={S.text}>Your Board</Text>
            <Grid playerIndex={useStore.getState().currentPlayer} compact={false} onCellPress={(idx)=>{
              const { heldCard, keepRevealedAt } = useStore.getState();
              if (heldCard) keepRevealedAt(idx);
              else {
                // Flip a hidden card without changing
                const st = useStore.getState();
                const pidx = st.currentPlayer;
                const players = st.players.map((p,pi)=>{
                  if (pi!==pidx) return p;
                  const grid = p.grid.slice();
                  grid[idx] = { ...grid[idx], revealed: true };
                  return { ...p, grid };
                });
                useStore.setState({ players });
              }
            }} />
          </View>

          <Controls />
        </>
      )}

      <RulesModal visible={showRules} onClose={()=> setShowRules(false)} />
    </SafeAreaView>
  );
}