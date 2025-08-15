// src/screens/RulesScreen.tsx
// Purpose: In-app rules summary.

import React from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';

export default function RulesScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>Golf 9 — Quick Rules</Text>
      <View style={styles.card}>
        <Text style={styles.h2}>Objective</Text>
        <Text style={styles.p}>Have the lowest total points when the round ends. Kings count 0. Three-of-a-kind in a column clears to 0.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.h2}>Setup</Text>
        <Text style={styles.p}>Each player gets a 3×3 grid (9 cards) face-down. Flip one card for a quick peek.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.h2}>On Your Turn</Text>
        <Text style={styles.li}>• Draw from the draw pile or take the top discard.</Text>
        <Text style={styles.li}>• Either replace one grid card (revealing it) or discard the drawn card.</Text>
        <Text style={styles.li}>• If you complete three-of-a-kind in a column, that column becomes 0.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.h2}>Round End</Text>
        <Text style={styles.p}>When all cards are face-up, sum values. Lowest score wins.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1023' },
  title: { fontSize: 24, color: '#E8ECF1', fontWeight: '800', marginBottom: 12 },
  card: { backgroundColor: '#121737', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#2A2F57' },
  h2: { color: '#E8ECF1', fontSize: 18, marginBottom: 8, fontWeight: '700' },
  p: { color: '#C4CAE3', lineHeight: 20 },
  li: { color: '#C4CAE3', lineHeight: 20, marginBottom: 2 }
});
