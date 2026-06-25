// client/src/screens/RulesScreen.tsx
// Purpose: In-app rules summary.

import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { BookOpen, ChevronLeft } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { ActionButton, PremiumPanel, ScreenHeader, ScreenShell, ui } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Rules'>;

export default function RulesScreen({ navigation }: Props) {
  return (
    <ScreenShell scroll>
      <ScreenHeader
        eyebrow="Golf 9"
        title="Quick Rules"
        subtitle="Lowest total wins. Clear columns, manage risk, and know when to push."
        right={<BookOpen size={28} color={ui.palette.gold} strokeWidth={2.5} />}
      />

      <RuleCard title="Objective">
        Have the lowest total points when the round ends. 5's count -5. Kings count 0. Three-of-a-kind in a column clears to 0.
      </RuleCard>

      <RuleCard title="Setup">
        Each player gets a 3x3 grid with 9 cards face-down. Flip two cards during the peek phase.
      </RuleCard>

      <PremiumPanel>
        <Text style={styles.h2}>On Your Turn</Text>
        <Text style={styles.li}>- Draw from the deck or take the top discard.</Text>
        <Text style={styles.li}>- Replace one grid card, reveal a hidden card, or discard a drawn card when allowed.</Text>
        <Text style={styles.li}>- Completing three-of-a-kind in a column clears that column to 0.</Text>
      </PremiumPanel>

      <RuleCard title="Round End">
        When all cards are face-up, values are totaled. Lowest score wins the round.
      </RuleCard>

      <ActionButton label="Back To Lobby" Icon={ChevronLeft} tone="ghost" onPress={() => navigation.goBack()} />
    </ScreenShell>
  );
}

function RuleCard({ title, children }: { title: string; children: string }) {
  return (
    <PremiumPanel>
      <Text style={styles.h2}>{title}</Text>
      <Text style={styles.p}>{children}</Text>
    </PremiumPanel>
  );
}

const styles = StyleSheet.create({
  h2: { color: ui.text.primary, fontSize: 18, marginBottom: 8, fontWeight: '900' },
  p: { color: ui.text.secondary, lineHeight: 22, fontSize: 15, fontWeight: '700' },
  li: { color: ui.text.secondary, lineHeight: 22, marginBottom: 4, fontSize: 15, fontWeight: '700' },
});
