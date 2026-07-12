// client/src/screens/TutorialScreen.tsx
// Purpose: A scripted, reward-free practice table that teaches the Golf 9 core loop.

import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Check,
  ChevronLeft,
  RotateCcw,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import Card from '../components/Card';
import type { Card as GameCard, Grid as GameGrid } from '../game/types';
import { ActionButton, PremiumPanel, ProgressBar, ScreenShell, ui } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Tutorial'>;

type TutorialLesson = {
  title: string;
  body: string;
  prompt?: string;
};

const LAST_LESSON_STEP = 10;

const LESSONS: TutorialLesson[] = [
  {
    title: 'Learn Golf 9 by playing',
    body: 'Practice one scripted round at your own pace. Nothing here changes your coins, XP, statistics, or match history.',
    prompt: 'Start when you are ready.',
  },
  {
    title: 'Peek at your first card',
    body: 'Every round begins with nine face-down cards. You may inspect two of your own cards before turns begin.',
    prompt: 'Tap the highlighted card.',
  },
  {
    title: 'Peek at one more',
    body: 'Remember these two cards. The rest of your grid stays hidden until you reveal or replace it.',
    prompt: 'Tap the second highlighted card.',
  },
  {
    title: 'Start your turn',
    body: 'On each turn, draw from the deck or take the top discard. A deck draw gives you a new unknown card.',
    prompt: 'Tap the highlighted deck.',
  },
  {
    title: 'Compare a hidden card',
    body: 'You drew a 3. Selecting a face-down grid card reveals it before you decide which card stays.',
    prompt: 'Tap the highlighted grid card.',
  },
  {
    title: 'Choose which card stays',
    body: 'The hidden card was a 9. Both choices are legal, but lower points are better, so keep the drawn 3.',
    prompt: 'Choose Keep Drawn.',
  },
  {
    title: 'Read the discard pile',
    body: 'Your practice partner finished a turn and left an 8. Taking a visible discard is useful when it improves your grid or builds a matching column.',
    prompt: 'Tap the highlighted discard.',
  },
  {
    title: 'Build a matching column',
    body: 'You already peeked at two 8s in the first column. Use the 8 you took to replace its last hidden card.',
    prompt: 'Tap the highlighted card in that column.',
  },
  {
    title: 'Finish the column',
    body: 'The hidden card was a 9. Keep the drawn 8 to make three matching ranks in one column.',
    prompt: 'Choose Keep Drawn.',
  },
  {
    title: 'Column cleared',
    body: 'Three 8s would cost 24 points. Clearing their column removes all 24 points, scores 0, and earns another turn.',
    prompt: 'See how the remaining cards score.',
  },
  {
    title: 'Count the round',
    body: 'Your cleared 8 column is worth 0. The remaining 5 scores -5, the King scores 0, and the other cards use their shown values. Lowest total wins.',
    prompt: 'You scored 4. Your practice partner scored 20.',
  },
  {
    title: 'Ready for a real table',
    body: 'You completed the full core loop: peek, draw, compare, replace, use the discard pile, clear a column, and score the round.',
    prompt: 'Replay anytime from Settings.',
  },
];

const DRAW_PILE_BACK = tutorialCard('tutorial-draw', 'A', '\u2660', false);

export default function TutorialScreen({ navigation }: Props) {
  const [step, setStep] = useState(0);
  const [nudge, setNudge] = useState<string | null>(null);
  const lesson = LESSONS[step] ?? LESSONS[0];
  const playerGrid = useMemo(() => buildPlayerGrid(step), [step]);
  const opponentGrid = useMemo(() => buildOpponentGrid(step), [step]);
  const heldCard = heldCardForStep(step);
  const topDiscard = discardForStep(step);
  const lessonProgress = step === 0 ? 0 : step >= LESSONS.length - 1 ? 1 : Math.min(1, step / LAST_LESSON_STEP);
  const lessonLabel = step === 0
    ? 'Guided practice'
    : step >= LESSONS.length - 1
      ? 'Tutorial complete'
      : `Lesson ${Math.min(step, LAST_LESSON_STEP)} of ${LAST_LESSON_STEP}`;

  useEffect(() => setNudge(null), [step]);

  const goBack = () => {
    if (step <= 0) {
      navigation.goBack();
      return;
    }
    setStep(value => Math.max(0, value - 1));
  };

  const handleGridPress = (row: number, col: number) => {
    if (step === 1 && row === 0 && col === 0) setStep(2);
    else if (step === 2 && row === 1 && col === 0) setStep(3);
    else if (step === 4 && row === 2 && col === 1) setStep(5);
    else if (step === 7 && row === 2 && col === 0) setStep(8);
  };

  const chooseDrawn = () => {
    if (step === 5) setStep(6);
    else if (step === 8) setStep(9);
  };

  const chooseRevealed = () => {
    setNudge(step === 8
      ? 'Keeping the 9 is legal, but it misses clearing 24 points. Try the 8 for this lesson.'
      : 'Keeping the 9 is legal, but it adds more points. Try the lower 3 for this lesson.');
  };

  const targetCell = targetCellForStep(step);
  const revealDecisionCard = step === 5
    ? tutorialCard('revealed-nine-one', '9', '\u2666', true)
    : step === 8
      ? tutorialCard('revealed-nine-two', '9', '\u2663', true)
      : null;

  return (
    <ScreenShell scroll showTopBar={false} contentStyle={styles.screenContent}>
      <View style={styles.topControls}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back one tutorial step" style={styles.iconButton} onPress={goBack}>
          <ChevronLeft size={23} color={ui.text.primary} strokeWidth={2.8} />
        </Pressable>
        <View style={styles.progressCopy}>
          <Text style={styles.eyebrow}>{lessonLabel}</Text>
          <ProgressBar value={lessonProgress} color={step >= LESSONS.length - 1 ? ui.palette.gold : ui.palette.emerald} />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Restart tutorial" style={styles.iconButton} onPress={() => setStep(0)}>
          <RotateCcw size={20} color={ui.palette.sky} strokeWidth={2.8} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Exit tutorial" style={styles.iconButton} onPress={() => navigation.goBack()}>
          <X size={22} color={ui.text.primary} strokeWidth={2.8} />
        </Pressable>
      </View>

      <PremiumPanel tone="felt" style={[styles.coachPanel, step >= LESSONS.length - 1 && styles.completionPanel]}>
        <View style={styles.coachTitleRow}>
          <View style={styles.coachIcon}>
            {step >= LESSONS.length - 1
              ? <Trophy size={22} color={ui.palette.gold} strokeWidth={2.8} />
              : <Sparkles size={22} color={ui.palette.emerald} strokeWidth={2.8} />}
          </View>
          <Text style={styles.coachTitle}>{lesson.title}</Text>
        </View>
        <Text style={styles.coachBody}>{lesson.body}</Text>
        {lesson.prompt ? <Text style={styles.coachPrompt}>{lesson.prompt}</Text> : null}
        {nudge ? <Text style={styles.nudge}>{nudge}</Text> : null}

        {step === 0 ? (
          <ActionButton label="Start Practice" onPress={() => setStep(1)} />
        ) : step === 5 || step === 8 ? (
          <View style={styles.decisionArea}>
            <View style={styles.decisionCards}>
              <DecisionCard label="Drawn" card={heldCard} selected />
              <DecisionCard label="Revealed" card={revealDecisionCard} />
            </View>
            <View style={styles.decisionButtons}>
              <ActionButton label={`Keep Drawn ${heldCard?.rank ?? ''}`} onPress={chooseDrawn} style={styles.decisionButton} />
              <ActionButton label="Keep Revealed 9" tone="ghost" onPress={chooseRevealed} style={styles.decisionButton} />
            </View>
          </View>
        ) : step === 9 ? (
          <ActionButton label="Show Round Scoring" onPress={() => setStep(10)} />
        ) : step === 10 ? (
          <ActionButton label="Complete Tutorial" Icon={Check} onPress={() => setStep(11)} />
        ) : step >= LESSONS.length - 1 ? (
          <View style={styles.completionActions}>
            <ActionButton label="Practice Again" Icon={RotateCcw} tone="ghost" onPress={() => setStep(0)} style={styles.completionButton} />
            <ActionButton label="Done" Icon={Check} tone="gold" onPress={() => navigation.goBack()} style={styles.completionButton} />
          </View>
        ) : null}
      </PremiumPanel>

      <View style={styles.table}>
        <View style={styles.opponentArea}>
          <View style={styles.playerLabelRow}>
            <View>
              <Text style={styles.playerName}>Practice Partner</Text>
              <Text style={styles.playerState}>{step >= 10 ? 'ROUND COMPLETE' : 'WATCHING'}</Text>
            </View>
            <ScoreLabel value={step >= 10 ? 20 : null} />
          </View>
          <TutorialGrid grid={opponentGrid} compact />
        </View>

        <View style={styles.pilesRow}>
          <TutorialPile
            label="Deck"
            card={step === 4 || step === 5 ? heldCard : DRAW_PILE_BACK}
            detail={`${step >= 4 ? 43 : 44}`}
            enabled={step === 3}
            selected={step === 3 || step === 4 || step === 5}
            onPress={() => step === 3 && setStep(4)}
          />
          <TutorialPile
            label="Discard"
            card={step === 7 || step === 8 ? heldCard : topDiscard}
            detail=""
            enabled={step === 6}
            selected={step === 6 || step === 7 || step === 8}
            onPress={() => step === 6 && setStep(7)}
          />
        </View>

        <View style={styles.playerArea}>
          <View style={styles.playerLabelRow}>
            <View>
              <Text style={styles.playerName}>Your Grid</Text>
              <Text style={[styles.playerState, styles.playerStateActive]}>{step >= 10 ? 'ROUND COMPLETE' : 'PRACTICE'}</Text>
            </View>
            <ScoreLabel value={step >= 10 ? 4 : null} />
          </View>
          <TutorialGrid grid={playerGrid} target={targetCell} onPress={handleGridPress} />
        </View>
      </View>

      <Text style={styles.footerNote}>Practice mode has no timer and never affects your account.</Text>
    </ScreenShell>
  );
}

function TutorialGrid({ grid, compact = false, target, onPress }: { grid: GameGrid; compact?: boolean; target?: { row: number; col: number } | null; onPress?: (row: number, col: number) => void }) {
  const width = compact ? 30 : 50;
  const height = compact ? 43 : 70;
  const margin = compact ? 1.5 : 2.5;
  return (
    <View style={styles.grid}>
      {grid.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.gridRow}>
          {row.map((card, colIndex) => {
            const selected = target?.row === rowIndex && target.col === colIndex;
            return (
              <Card
                key={`${rowIndex}-${colIndex}`}
                card={card}
                width={width}
                height={height}
                margin={margin}
                selected={selected}
                animateReveal
                onPress={selected && onPress ? () => onPress(rowIndex, colIndex) : undefined}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

function TutorialPile({ label, card, detail, enabled, selected, onPress }: { label: string; card: GameCard | null; detail: string; enabled: boolean; selected: boolean; onPress: () => void }) {
  return (
    <View style={styles.pile}>
      <Text style={styles.pileLabel}>{label}</Text>
      <Card card={card} width={50} height={70} margin={2} selected={selected} animateReveal onPress={enabled ? onPress : undefined} />
      <Text style={styles.pileDetail}>{detail}</Text>
    </View>
  );
}

function DecisionCard({ label, card, selected = false }: { label: string; card: GameCard | null; selected?: boolean }) {
  return (
    <View style={[styles.decisionCard, selected && styles.decisionCardSelected]}>
      <Text style={styles.decisionLabel}>{label}</Text>
      <Card card={card} width={40} height={56} margin={0} />
    </View>
  );
}

function ScoreLabel({ value }: { value: number | null }) {
  return (
    <View style={styles.scoreLabel}>
      <Text style={styles.scoreValue}>{value == null ? '--' : value}</Text>
      <Text style={styles.scoreCaption}>NOW</Text>
    </View>
  );
}

function tutorialCard(id: string, rank: string, suit: string, faceUp: boolean): GameCard {
  return { id, rank: rank as GameCard['rank'], suit: suit as GameCard['suit'], faceUp };
}

function cloneCard(card: GameCard, faceUp = card.faceUp): GameCard {
  return { ...card, faceUp };
}

function buildPlayerGrid(step: number): GameGrid {
  const grid: GameGrid = [
    [tutorialCard('player-00', '8', '\u2665', false), tutorialCard('player-01', '2', '\u2663', false), tutorialCard('player-02', 'K', '\u2660', false)],
    [tutorialCard('player-10', '8', '\u2666', false), tutorialCard('player-11', '5', '\u2663', false), tutorialCard('player-12', '3', '\u2665', false)],
    [tutorialCard('player-20', '9', '\u2663', false), tutorialCard('player-21', '9', '\u2666', false), tutorialCard('player-22', 'A', '\u2660', false)],
  ];

  if (step >= 2) grid[0][0] = cloneCard(grid[0][0]!, true);
  if (step >= 3) grid[1][0] = cloneCard(grid[1][0]!, true);
  if (step === 5) grid[2][1] = cloneCard(grid[2][1]!, true);
  if (step >= 6) grid[2][1] = tutorialCard('player-drawn-three', '3', '\u2663', true);
  if (step === 8) grid[2][0] = cloneCard(grid[2][0]!, true);
  if (step >= 9) {
    grid[0][0] = null;
    grid[1][0] = null;
    grid[2][0] = null;
  }
  if (step >= 10) {
    for (let row = 0; row < grid.length; row += 1) {
      for (let col = 0; col < grid[row].length; col += 1) {
        if (grid[row][col]) grid[row][col] = cloneCard(grid[row][col]!, true);
      }
    }
  }
  return grid;
}

function buildOpponentGrid(step: number): GameGrid {
  const grid: GameGrid = [
    [tutorialCard('opponent-00', 'K', '\u2660', false), tutorialCard('opponent-01', '4', '\u2665', false), tutorialCard('opponent-02', '3', '\u2663', false)],
    [tutorialCard('opponent-10', '5', '\u2666', false), tutorialCard('opponent-11', '8', '\u2663', false), tutorialCard('opponent-12', '4', '\u2660', false)],
    [tutorialCard('opponent-20', 'A', '\u2665', false), tutorialCard('opponent-21', '5', '\u2663', false), tutorialCard('opponent-22', 'Q', '\u2666', false)],
  ];
  if (step < 10) {
    grid[0][0] = cloneCard(grid[0][0]!, true);
    grid[1][1] = cloneCard(grid[1][1]!, true);
    return grid;
  }
  return grid.map(row => row.map(card => card ? cloneCard(card, true) : null));
}

function heldCardForStep(step: number): GameCard | null {
  if (step === 4 || step === 5) return tutorialCard('held-three', '3', '\u2663', true);
  if (step === 7 || step === 8) return tutorialCard('held-eight', '8', '\u2665', true);
  return null;
}

function discardForStep(step: number): GameCard {
  if (step === 6) return tutorialCard('discard-eight', '8', '\u2665', true);
  if (step >= 9) return tutorialCard('discard-nine', '9', '\u2663', true);
  return tutorialCard('discard-king', 'K', '\u2666', true);
}

function targetCellForStep(step: number) {
  if (step === 1) return { row: 0, col: 0 };
  if (step === 2) return { row: 1, col: 0 };
  if (step === 4) return { row: 2, col: 1 };
  if (step === 7) return { row: 2, col: 0 };
  return null;
}

const styles = StyleSheet.create({
  screenContent: { paddingHorizontal: 14, paddingBottom: 36 },
  topControls: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  iconButton: { width: 42, height: 42, borderRadius: 8, borderWidth: 1, borderColor: ui.border.soft, backgroundColor: ui.surface.glass, alignItems: 'center', justifyContent: 'center' },
  progressCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: ui.palette.gold, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginBottom: 5 },
  coachPanel: { marginBottom: 12 },
  completionPanel: { borderColor: ui.border.gold, borderWidth: 2, backgroundColor: ui.surface.panel },
  coachTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  coachIcon: { width: 38, height: 38, borderRadius: 8, borderWidth: 1, borderColor: ui.border.soft, backgroundColor: ui.surface.base, alignItems: 'center', justifyContent: 'center' },
  coachTitle: { flex: 1, color: ui.text.primary, fontSize: 20, fontWeight: '900' },
  coachBody: { color: ui.text.secondary, fontSize: 14, fontWeight: '700', lineHeight: 20, marginTop: 12 },
  coachPrompt: { color: ui.palette.emerald, fontSize: 13, fontWeight: '900', lineHeight: 18, marginVertical: 10 },
  nudge: { color: ui.palette.gold, fontSize: 12, fontWeight: '900', lineHeight: 17, marginBottom: 10 },
  table: { borderRadius: 8, borderWidth: 1, borderColor: ui.border.soft, backgroundColor: 'rgba(7, 11, 29, 0.82)', padding: 12, gap: 12 },
  opponentArea: { alignSelf: 'center', minWidth: 190, borderRadius: 8, borderWidth: 1, borderColor: ui.border.soft, backgroundColor: ui.surface.panel, padding: 10 },
  playerArea: { borderTopWidth: 2, borderTopColor: ui.palette.sky, paddingTop: 12 },
  playerLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 6 },
  playerName: { color: ui.text.primary, fontSize: 14, fontWeight: '900' },
  playerState: { color: ui.text.muted, fontSize: 9, fontWeight: '900', marginTop: 2 },
  playerStateActive: { color: ui.palette.emerald },
  scoreLabel: { alignItems: 'flex-end' },
  scoreValue: { color: ui.palette.emerald, fontSize: 18, fontWeight: '900' },
  scoreCaption: { color: ui.text.muted, fontSize: 8, fontWeight: '900' },
  grid: { alignItems: 'center', justifyContent: 'center' },
  gridRow: { flexDirection: 'row' },
  pilesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 },
  pile: { width: 72, alignItems: 'center' },
  pileLabel: { color: ui.text.primary, fontSize: 12, fontWeight: '900', marginBottom: 2 },
  pileDetail: { color: ui.text.secondary, fontSize: 11, fontWeight: '900', minHeight: 15, marginTop: 1 },
  decisionArea: { marginTop: 2, gap: 10 },
  decisionCards: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  decisionCard: { width: 82, minHeight: 86, borderRadius: 8, borderWidth: 1, borderColor: ui.border.soft, backgroundColor: ui.surface.base, alignItems: 'center', justifyContent: 'center', gap: 5, padding: 7 },
  decisionCardSelected: { borderColor: ui.palette.emerald },
  decisionLabel: { color: ui.text.secondary, fontSize: 10, fontWeight: '900' },
  decisionButtons: { gap: 8 },
  decisionButton: { minHeight: 46 },
  completionActions: { flexDirection: 'row', gap: 8 },
  completionButton: { flex: 1, minWidth: 0 },
  footerNote: { color: ui.text.muted, fontSize: 11, fontWeight: '700', textAlign: 'center', lineHeight: 16, marginTop: 12 },
});
