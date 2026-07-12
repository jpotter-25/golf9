// client/src/screens/RulesScreen.tsx
// Purpose: In-app rules summary.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BookOpen, ChevronLeft, GraduationCap } from 'lucide-react-native';
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
        Have the lowest total points when the round ends. Three matching ranks in a column clear and score 0.
      </RuleCard>

      <PremiumPanel>
        <Text style={styles.h2}>Card Values</Text>
        <View style={styles.valueTable}>
          <ValueRow label="5" value="-5 points" accent={ui.palette.emerald} />
          <ValueRow label="King" value="0 points" accent={ui.palette.gold} />
          <ValueRow label="Ace" value="1 point" />
          <ValueRow label="2-4, 6-10" value="Face value" />
          <ValueRow label="Jack / Queen" value="10 points" />
          <ValueRow label="Matched column" value="0 points" accent={ui.palette.sky} />
        </View>
        <Text style={styles.valueHint}>A pair of 5s is worth -10, so do not clear a 5 column unless the broader board makes it worthwhile.</Text>
      </PremiumPanel>

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

      <ActionButton label="Play Guided Tutorial" Icon={GraduationCap} onPress={() => navigation.navigate('Tutorial')} />
      <ActionButton label="Back" Icon={ChevronLeft} tone="ghost" style={styles.backButton} onPress={() => navigation.goBack()} />
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

function ValueRow({ label, value, accent = ui.text.primary }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.valueRow}>
      <Text style={[styles.valueLabel, { color: accent }]}>{label}</Text>
      <Text style={styles.valueScore}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  h2: { color: ui.text.primary, fontSize: 18, marginBottom: 8, fontWeight: '900' },
  p: { color: ui.text.secondary, lineHeight: 22, fontSize: 15, fontWeight: '700' },
  li: { color: ui.text.secondary, lineHeight: 22, marginBottom: 4, fontSize: 15, fontWeight: '700' },
  valueTable: { borderTopWidth: 1, borderTopColor: ui.border.soft },
  valueRow: { minHeight: 38, borderBottomWidth: 1, borderBottomColor: ui.border.soft, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  valueLabel: { flex: 1, color: ui.text.primary, fontSize: 14, fontWeight: '900' },
  valueScore: { color: ui.text.secondary, fontSize: 14, fontWeight: '800', textAlign: 'right' },
  valueHint: { color: ui.text.muted, fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 10 },
  backButton: { marginTop: 10 },
});
