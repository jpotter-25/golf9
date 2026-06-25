// client/src/screens/OnlineMenuScreen.tsx
// Purpose: Premium online matchmaking hub for create, join, free play, wagers, and ranked.

import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronLeft, Coins, Crown, DoorOpen, Search, Shield, Sparkles, Trophy, Users } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import { ActionButton, PremiumPanel, ScreenHeader, ScreenShell, ui } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'OnlineMenu'>;

export default function OnlineMenuScreen({ route, navigation }: Props) {
  const { players, rounds } = route.params;
  const { token, user, refreshProfile } = useAuth();
  const [joinCode, setJoinCode] = useState('');
  const [economy, setEconomy] = useState<api.EconomyCatalog | null>(null);
  const [bonusBusy, setBonusBusy] = useState(false);
  const [wagerTables, setWagerTables] = useState<api.WagerTable[]>([
    { id: 'casual-50', label: 'Casual', buyIn: 50, description: 'Light coin table.' },
    { id: 'competitive-100', label: 'Standard', buyIn: 100, description: 'Standard wager table.' },
    { id: 'high-250', label: 'High', buyIn: 250, description: 'High stakes table.' },
    { id: 'elite-500', label: 'Elite', buyIn: 500, description: 'Elite stakes table.' },
  ]);

  useEffect(() => {
    if (!token) return;
    api.economyCatalog(token)
      .then(response => {
        setEconomy(response);
        setWagerTables(response.wagerTables.filter(table => table.buyIn > 0));
      })
      .catch(() => {});
  }, [token]);

  const balance = user?.currency.coins ?? 0;
  const normalizedCode = joinCode.trim().toUpperCase();
  const canJoin = normalizedCode.length === 4;
  const dailyBonus = economy?.dailyBonus ?? user?.currency.dailyBonus ?? null;
  const lowestWager = wagerTables.reduce((min, table) => Math.min(min, table.buyIn), Infinity);
  const lowBalance = balance < (Number.isFinite(lowestWager) ? lowestWager : 50);

  const claimDailyBonus = async () => {
    if (!token || bonusBusy || !dailyBonus?.canClaim) return;
    setBonusBusy(true);
    try {
      const response = await api.claimDailyBonus(token);
      setEconomy(response.economy);
      await refreshProfile();
      Alert.alert('Daily Table Bonus', `+${response.reward} coins added to your stack.`);
    } catch (error) {
      Alert.alert('Bonus unavailable', error instanceof Error ? error.message : 'Try again later.');
    } finally {
      setBonusBusy(false);
    }
  };

  const join = () => {
    if (!canJoin) {
      Alert.alert('Room code needed', 'Enter the 4-character room code from the host device.');
      return;
    }
    navigation.navigate('OnlineRoom', { players, rounds, joinCode: normalizedCode });
  };

  return (
    <ScreenShell scroll>
      <ScreenHeader
        eyebrow="Online Multiplayer"
        title="Choose A Table"
        subtitle={`${players} players - ${rounds} rounds`}
        right={<CoinPill coins={balance} />}
      />

      <PremiumPanel tone="felt">
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>Host Table</Text>
            <Text style={styles.cardMeta}>Create a room and invite friends.</Text>
          </View>
          <Users size={24} color={ui.palette.emerald} strokeWidth={2.6} />
        </View>
        <ActionButton
          label="Create Room"
          Icon={DoorOpen}
          onPress={() => navigation.navigate('OnlineRoom', { players, rounds, create: true })}
        />
      </PremiumPanel>

      <PremiumPanel>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>Join By Code</Text>
            <Text style={styles.cardMeta}>Enter the host room code.</Text>
          </View>
          <Search size={24} color={ui.palette.sky} strokeWidth={2.6} />
        </View>
        <TextInput
          style={styles.input}
          placeholder="ROOM CODE"
          placeholderTextColor={ui.text.muted}
          value={joinCode}
          onChangeText={text => setJoinCode(text.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={4}
        />
        <ActionButton label="Join Room" Icon={DoorOpen} tone="secondary" disabled={!canJoin} onPress={join} />
      </PremiumPanel>

      <PremiumPanel tone="felt">
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>Free Play</Text>
            <Text style={styles.cardMeta}>No buy-in. Earn coins without risking your stack.</Text>
          </View>
          <Sparkles size={24} color={ui.palette.gold} strokeWidth={2.6} />
        </View>
        <ActionButton
          label="Find Free Match"
          Icon={Search}
          tone="ghost"
          onPress={() => navigation.navigate('OnlineRoom', { players, rounds, quickPlay: true })}
        />
      </PremiumPanel>

      <PremiumPanel>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>Earn Coins</Text>
            <Text style={styles.cardMeta}>
              {lowBalance ? 'Low balance route: claim daily, play Free Play, finish challenges.' : 'Build your stack through daily bonuses, Free Play, and challenges.'}
            </Text>
          </View>
          <Coins size={24} color={ui.palette.gold} strokeWidth={2.6} />
        </View>
        {economy?.coinSources.slice(0, 3).map(source => (
          <View key={source.id} style={styles.sourceRow}>
            <Text style={styles.sourceTitle}>{source.title}</Text>
            <Text style={styles.sourceText}>{source.description}</Text>
          </View>
        ))}
        <View style={styles.earnActions}>
          <Pressable
            style={[styles.miniAction, (!dailyBonus?.canClaim || bonusBusy) && styles.disabled]}
            disabled={!dailyBonus?.canClaim || bonusBusy}
            onPress={claimDailyBonus}
          >
            <Text style={styles.miniActionText}>
              {dailyBonus?.canClaim ? `Claim ${dailyBonus.reward}` : 'Bonus Claimed'}
            </Text>
          </Pressable>
          <Pressable style={styles.miniAction} onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.miniActionText}>Challenges</Text>
          </Pressable>
        </View>
      </PremiumPanel>

      <PremiumPanel>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>Wager Tables</Text>
            <Text style={styles.cardMeta}>Buy in, win the pot, keep the pressure on.</Text>
          </View>
          <Coins size={24} color={ui.palette.gold} strokeWidth={2.6} />
        </View>
        <View style={styles.wagerGrid}>
          {wagerTables.map(table => {
            const canAfford = balance >= table.buyIn;
            return (
              <Pressable
                key={table.id}
                style={[styles.wagerButton, !canAfford && styles.disabled]}
                disabled={!canAfford}
                onPress={() => navigation.navigate('OnlineRoom', { players, rounds, wagerBuyIn: table.buyIn })}
              >
                <Text style={styles.wagerText}>{table.buyIn}</Text>
                <Text style={styles.wagerLabel}>{table.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.helpText}>No coins? Claim your Daily Table Bonus and play Free Play to rebuild.</Text>
      </PremiumPanel>

      <PremiumPanel tone="gold">
        <View style={styles.rankedHeader}>
          <View style={styles.rankedCopy}>
            <Text style={styles.rankedTitle}>Ranked Match</Text>
            <Text style={styles.rankedMeta}>Free competitive ladder - MMR tracked</Text>
          </View>
          <Crown size={28} color={ui.text.inverse} strokeWidth={2.6} />
        </View>
        <ActionButton
          label="Find Ranked Match"
          Icon={Trophy}
          tone="gold"
          onPress={() => navigation.navigate('RankedQueue', { players, rounds })}
        />
        <Text style={styles.rankedHint}>Ranked costs no coins. Reach higher leagues to unlock prestige cosmetics in the shop.</Text>
      </PremiumPanel>

      <ActionButton label="Back" Icon={ChevronLeft} tone="ghost" onPress={() => navigation.goBack()} />
    </ScreenShell>
  );
}

function CoinPill({ coins }: { coins: number }) {
  return (
    <View style={styles.coinPill}>
      <Shield size={15} color={ui.palette.gold} strokeWidth={2.8} />
      <View>
        <Text style={styles.coinLabel}>Coins</Text>
        <Text style={styles.coinValue}>{coins}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  cardTitle: { color: ui.text.primary, fontSize: 18, fontWeight: '900' },
  cardMeta: { color: ui.text.secondary, fontSize: 12, fontWeight: '700', marginTop: 3 },
  coinPill: {
    minWidth: 94,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ui.border.gold,
    backgroundColor: 'rgba(26, 24, 48, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coinLabel: { color: ui.text.muted, fontSize: 10, fontWeight: '900' },
  coinValue: { color: ui.palette.gold, fontSize: 17, fontWeight: '900', marginTop: 1 },
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
  wagerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  wagerButton: {
    width: '48%',
    minHeight: 82,
    borderWidth: 1,
    borderColor: ui.border.gold,
    backgroundColor: '#1A1830',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wagerText: { color: ui.palette.gold, fontSize: 23, fontWeight: '900' },
  wagerLabel: { color: ui.text.secondary, fontSize: 12, fontWeight: '900', marginTop: 3 },
  helpText: { color: ui.text.muted, fontSize: 12, fontWeight: '800', marginTop: 10 },
  sourceRow: {
    borderTopWidth: 1,
    borderTopColor: ui.border.soft,
    paddingVertical: 8,
  },
  sourceTitle: { color: ui.text.primary, fontSize: 13, fontWeight: '900' },
  sourceText: { color: ui.text.muted, fontSize: 11, fontWeight: '700', lineHeight: 16, marginTop: 2 },
  earnActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  miniAction: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: ui.palette.sky,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  miniActionText: { color: ui.text.inverse, fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  rankedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  rankedCopy: { flex: 1, minWidth: 0 },
  rankedTitle: { color: ui.text.inverse, fontSize: 21, fontWeight: '900' },
  rankedMeta: { color: '#4D3D17', fontSize: 13, fontWeight: '900', marginTop: 3 },
  rankedHint: { color: '#4D3D17', fontSize: 12, fontWeight: '900', textAlign: 'center', marginTop: 10 },
});
