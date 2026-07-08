// client/src/screens/ProfileScreen.tsx
// Purpose: Tabbed player profile hub for progression, results, cosmetics, and social.

import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CheckCircle2, Gift, Link, MessageCircle, Pencil, ShoppingBag, Trophy, Users } from 'lucide-react-native';
import type { RootStackParamList } from '../App';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import { isProviderConfigured } from '../services/socialAuth';
import { ActionButton, PremiumPanel, ProgressBar, ScreenHeader, ScreenShell, StatusBadge, ui } from '../ui';
import { CoinClaimBurst, type CoinClaimBurstState } from '../components/CoinClaimBurst';
import { PlayerAvatar } from '../components/PlayerAvatar';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;
type ProfileTab = 'stats' | 'matches' | 'avatar' | 'cosmetics' | 'social';
type MatchFilter = 'all' | 'online' | 'ranked' | 'wager' | 'solo' | 'passplay';

const TABS: Array<{ key: ProfileTab; label: string }> = [
  { key: 'stats', label: 'Stats' },
  { key: 'matches', label: 'Matches' },
  { key: 'avatar', label: 'Avatar' },
  { key: 'cosmetics', label: 'Cosmetics' },
  { key: 'social', label: 'Social' },
];

const MATCH_FILTERS: Array<{ key: MatchFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'online', label: 'Online' },
  { key: 'ranked', label: 'Ranked' },
  { key: 'wager', label: 'Wager' },
  { key: 'solo', label: 'Solo' },
  { key: 'passplay', label: 'Pass' },
];

const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { token, user, signOut, refreshProfile, linkSocialProvider } = useAuth();
  const [tab, setTab] = useState<ProfileTab>('stats');
  const [matchFilter, setMatchFilter] = useState<MatchFilter>('all');
  const [results, setResults] = useState<api.GameResult[]>([]);
  const [cosmetics, setCosmetics] = useState<api.CosmeticItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [coinBurst, setCoinBurst] = useState<CoinClaimBurstState>(null);

  useFocusEffect(useCallback(() => {
    refreshProfile().catch(() => {});
    if (token) {
      api.myResults(token).then(response => setResults(response.results)).catch(() => setResults([]));
      api.cosmeticCatalog(token).then(response => setCosmetics(response.cosmetics)).catch(() => setCosmetics([]));
    }
  }, [refreshProfile, token]));

  const progression = user?.progression;
  const winRate = user?.statistics.gamesPlayed
    ? Math.round((user.statistics.wins / user.statistics.gamesPlayed) * 100)
    : 0;
  const filteredResults = useMemo(() => results.filter(result => {
    if (matchFilter === 'all') return true;
    if (matchFilter === 'online') return result.mode === 'online' && result.matchType !== 'ranked' && result.matchType !== 'wager';
    if (matchFilter === 'passplay') return result.mode === 'passplay';
    return result.matchType === matchFilter || result.mode === matchFilter;
  }), [matchFilter, results]);
  const ownedCosmetics = useMemo(() => sortCosmetics(cosmetics.filter(item => item.owned)), [cosmetics]);
  const groupedCosmetics = useMemo(() => groupCosmeticsByType(ownedCosmetics), [ownedCosmetics]);
  const dailyBonus = user?.currency.dailyBonus ?? null;
  const dailyChallenges = user?.challenges?.daily?.items ?? [];
  const weeklyChallenges = user?.challenges?.weekly?.items ?? [];

  const reloadBits = async () => {
    await refreshProfile().catch(() => {});
    if (token) api.cosmeticCatalog(token).then(response => setCosmetics(response.cosmetics)).catch(() => {});
  };

  const onClaimDailyBonus = async () => {
    if (!token || busyId || !dailyBonus?.canClaim) return;
    setBusyId('daily-bonus');
    try {
      const response = await api.claimDailyBonus(token);
      setCoinBurst({ id: Date.now(), reward: response.reward });
      await reloadBits();
    } catch (error) {
      Alert.alert('Bonus unavailable', error instanceof Error ? error.message : 'Try again later.');
    } finally {
      setBusyId(null);
    }
  };

  const onClaimChallenge = async (challengeId: string) => {
    if (!token || busyId) return;
    setBusyId(challengeId);
    try {
      const response = await api.claimChallenge(token, challengeId);
      await reloadBits();
      Alert.alert('Reward claimed', `+${response.progression.xpGained} XP\n+${response.progression.coinsGained} coins`);
    } catch (error) {
      Alert.alert('Claim failed', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusyId(null);
    }
  };

  const onCosmeticPress = async (item: api.CosmeticItem) => {
    if (!token || busyId || item.equipped || !item.owned) return;
    setBusyId(item.id);
    try {
      const response = await api.equipCosmetic(token, item.id);
      setCosmetics(response.cosmetics);
      await refreshProfile().catch(() => {});
    } catch (error) {
      Alert.alert('Cosmetic update failed', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusyId(null);
    }
  };

  const onLinkSocialProvider = async (provider: api.AuthProviderKey) => {
    if (busyId) return;
    setBusyId(`link-${provider}`);
    try {
      await linkSocialProvider(provider);
      await refreshProfile().catch(() => {});
      Alert.alert('Account linked', `${provider === 'google' ? 'Google' : 'Facebook'} can now sign in to this Golf 9 profile.`);
    } catch (error) {
      Alert.alert('Link failed', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ScreenShell scroll>
      <CoinClaimBurst burst={coinBurst} top={104} right={18} />
      <ScreenHeader
        eyebrow="Player Profile"
        title={user?.displayName ?? 'Player'}
        subtitle="Stats, match history, avatar style, cosmetics, and social."
        right={<StatusBadge label={`Lv ${progression?.level ?? 1}`} tone="gold" />}
      />

      <PremiumPanel tone="felt" style={styles.hero}>
        <PlayerAvatar cosmetics={user?.inventory.equipped} fallbackInitial={user?.avatarInitial ?? '?'} size={82} />
        <View style={styles.heroCopy}>
          <Text style={styles.name} numberOfLines={1}>{user?.displayName ?? 'Player'}</Text>
          <Text style={styles.meta}>Level {progression?.level ?? 1} - {user?.competitive.league.name ?? 'Silver III'}</Text>
          <ProgressBar value={progression?.levelProgress ?? 0} />
          <Text style={styles.progressText}>{progression?.currentLevelXp ?? 0} / {progression?.nextLevelXp ?? 1000} XP</Text>
        </View>
      </PremiumPanel>

      <View style={styles.tabRow}>
        {TABS.map(item => (
          <Pressable key={item.key} style={[styles.tab, tab === item.key && styles.tabActive]} onPress={() => setTab(item.key)}>
            <Text style={[styles.tabText, tab === item.key && styles.tabTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'stats' ? (
        <>
          <View style={styles.statGrid}>
            <Stat label="Coins" value={String(user?.currency.coins ?? 0)} tone="gold" />
            <Stat label="Games" value={String(user?.statistics.gamesPlayed ?? 0)} />
            <Stat label="Wins" value={String(user?.statistics.wins ?? 0)} />
            <Stat label="Win Rate" value={`${winRate}%`} />
            <Stat label="Best Total" value={formatNullable(user?.statistics.bestTotal)} />
            <Stat label="Best Round" value={formatNullable(user?.statistics.bestRound)} />
            <Stat label="Clears" value={String(user?.statistics.columnClears ?? 0)} />
            <Stat label="Lifetime Coins" value={String(user?.currency.lifetimeCoins ?? 0)} tone="gold" />
          </View>

          <PremiumPanel>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.sectionTitle}>Ranked Ladders</Text>
                <Text style={styles.sectionMeta}>Separate ratings for 2, 3, and 4 player ranked.</Text>
              </View>
              <Trophy size={24} color={ui.palette.gold} strokeWidth={2.6} />
            </View>
            <View style={styles.ladderRow}>
              {[2, 3, 4].map(count => {
                const ladder = user?.competitiveByPlayers?.[String(count) as '2' | '3' | '4'];
                return (
                  <View key={count} style={styles.ladderCard}>
                    <Text style={styles.ladderCount}>{count}P</Text>
                    <Text style={styles.ladderMmr} numberOfLines={1}>{ladder?.league.name ?? 'Silver III'}</Text>
                    <Text style={styles.ladderLeague} numberOfLines={1}>{ladder?.rankedGames ?? 0} ranked games</Text>
                  </View>
                );
              })}
            </View>
          </PremiumPanel>

          <PremiumPanel>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.sectionTitle}>Daily Bonus</Text>
                <Text style={styles.sectionMeta}>Claim every 24 hours to rebuild your stack.</Text>
              </View>
              <Gift size={24} color={ui.palette.gold} strokeWidth={2.6} />
            </View>
            <ActionButton
              label={dailyBonus?.canClaim ? `Claim ${dailyBonus.reward} Coins` : 'Daily Bonus Claimed'}
              Icon={Gift}
              tone="gold"
              disabled={!dailyBonus?.canClaim || busyId === 'daily-bonus'}
              onPress={onClaimDailyBonus}
            />
          </PremiumPanel>

          <ChallengeBlock title="Daily Challenges" items={dailyChallenges} busyId={busyId} onClaim={onClaimChallenge} />
          <ChallengeBlock title="Weekly Challenges" items={weeklyChallenges} busyId={busyId} onClaim={onClaimChallenge} />
        </>
      ) : null}

      {tab === 'matches' ? (
        <>
          <View style={styles.filterRow}>
            {MATCH_FILTERS.map(item => (
              <Pressable key={item.key} style={[styles.filterChip, matchFilter === item.key && styles.filterChipActive]} onPress={() => setMatchFilter(item.key)}>
                <Text style={[styles.filterText, matchFilter === item.key && styles.filterTextActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
          {filteredResults.length ? (
            filteredResults.map(result => <ResultRow key={result.resultId} result={result} userId={user?.userId} />)
          ) : (
            <Text style={styles.emptyText}>No matches in this filter yet.</Text>
          )}
        </>
      ) : null}

      {tab === 'avatar' ? (
        <PremiumPanel>
          <View style={styles.avatarLarge}>
            <PlayerAvatar cosmetics={user?.inventory.equipped} fallbackInitial={user?.avatarInitial ?? '?'} size={92} />
          </View>
          <Text style={styles.avatarName}>{user?.displayName ?? 'Player'}</Text>
          <View style={styles.collectionRow}>
            <CollectionItem label="Title" value={user?.inventory.equipped.title ?? 'rookie-title'} />
            <CollectionItem label="Avatar Icon" value={user?.inventory.equipped.avatarIcon ?? 'classic-avatar-icon'} />
            <CollectionItem label="Avatar Frame" value={user?.inventory.equipped.avatarFrame ?? 'rookie-avatar-frame'} />
            <CollectionItem label="Accessory" value={user?.inventory.equipped.avatarAccessory ?? 'no-avatar-accessory'} />
            <CollectionItem label="Table" value={user?.inventory.equipped.tableTheme ?? 'classic-table-theme'} />
          </View>
          <Text style={styles.emptyText}>Seasonal accessories show beside your avatar at online tables.</Text>
          <ActionButton label="Edit Cosmetics" Icon={Pencil} onPress={() => setTab('cosmetics')} />
        </PremiumPanel>
      ) : null}

      {tab === 'cosmetics' ? (
        <>
          <ActionButton label="Open Shop" Icon={ShoppingBag} tone="gold" onPress={() => navigation.navigate('Shop')} style={styles.shopButton} />
          {groupedCosmetics.length ? (
            groupedCosmetics.map(group => (
              <PremiumPanel key={group.key}>
                <Text style={styles.sectionTitle}>{group.title}</Text>
                <Text style={styles.sectionMeta}>Equipped: {group.equipped}</Text>
                <View style={styles.lockerGrid}>
                  {group.items.map(item => (
                    <CosmeticTile key={item.id} item={item} busy={busyId === item.id} onPress={() => onCosmeticPress(item)} />
                  ))}
                </View>
              </PremiumPanel>
            ))
          ) : (
            <Text style={styles.emptyText}>Owned cosmetics will appear here. Visit the Shop to buy new looks.</Text>
          )}
        </>
      ) : null}

      {tab === 'social' ? (
        <PremiumPanel>
          <View style={styles.socialRow}>
            <View style={styles.socialIcon}><MessageCircle size={24} color={ui.palette.emerald} strokeWidth={2.7} /></View>
            <View style={styles.socialCopy}>
              <Text style={styles.sectionTitle}>Friends & Invites</Text>
              <Text style={styles.sectionMeta}>Find players, accept invites, and jump into social rooms.</Text>
            </View>
          </View>
          <ActionButton label="Open Social" Icon={Users} onPress={() => navigation.navigate('Social')} />
          <ActionButton label={user?.club ? 'Open Club' : 'Find A Club'} Icon={Trophy} tone="secondary" onPress={() => navigation.navigate('Club')} style={styles.socialButton} />
          <View style={styles.linkedAccounts}>
            <Text style={styles.sectionTitle}>Linked Accounts</Text>
            <Text style={styles.sectionMeta}>Attach Google or Facebook so this same profile can use social login.</Text>
            <LinkedAccountRow
              provider="google"
              linked={!!user?.authProviders?.google}
              enabled={isProviderConfigured('google')}
              busy={busyId === 'link-google'}
              onPress={() => onLinkSocialProvider('google')}
            />
            <LinkedAccountRow
              provider="facebook"
              linked={!!user?.authProviders?.facebook}
              enabled={isProviderConfigured('facebook')}
              busy={busyId === 'link-facebook'}
              onPress={() => onLinkSocialProvider('facebook')}
            />
          </View>
          <ActionButton label="Log Out" tone="danger" onPress={signOut} style={styles.socialButton} />
        </PremiumPanel>
      ) : null}
    </ScreenShell>
  );
};

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'gold' }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, tone === 'gold' && styles.goldText]} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function LinkedAccountRow({
  provider,
  linked,
  enabled,
  busy,
  onPress,
}: {
  provider: api.AuthProviderKey;
  linked: boolean;
  enabled: boolean;
  busy: boolean;
  onPress: () => void;
}) {
  const label = provider === 'google' ? 'Google' : 'Facebook';
  return (
    <View style={styles.linkRow}>
      <View style={[styles.providerMark, provider === 'google' ? styles.googleMark : styles.facebookMark]}>
        <Text style={[styles.providerMarkText, provider === 'facebook' && styles.facebookMarkText]}>{provider === 'google' ? 'G' : 'f'}</Text>
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{label}</Text>
        <Text style={styles.rowMeta}>{linked ? 'Linked to this profile.' : enabled ? 'Available to link.' : 'Unavailable in this build.'}</Text>
      </View>
      <Pressable style={[styles.linkButton, (!enabled || linked || busy) && styles.disabled]} disabled={!enabled || linked || busy} onPress={onPress}>
        {linked ? <CheckCircle2 size={18} color={ui.palette.emerald} strokeWidth={2.8} /> : <Link size={18} color={ui.text.inverse} strokeWidth={2.8} />}
        <Text style={styles.linkButtonText}>{linked ? 'Linked' : busy ? '...' : 'Link'}</Text>
      </Pressable>
    </View>
  );
}

function ChallengeBlock({ title, items, busyId, onClaim }: { title: string; items: api.Challenge[]; busyId: string | null; onClaim: (id: string) => void }) {
  if (!items.length) return null;
  return (
    <PremiumPanel>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map(item => <ChallengeRow key={item.id} challenge={item} busy={busyId === item.id} onClaim={() => onClaim(item.id)} />)}
    </PremiumPanel>
  );
}

function ChallengeRow({ challenge, busy, onClaim }: { challenge: api.Challenge; busy: boolean; onClaim: () => void }) {
  const ratio = challenge.target > 0 ? Math.min(1, challenge.progress / challenge.target) : 0;
  const complete = !!challenge.completedAt;
  const claimed = !!challenge.claimedAt;
  return (
    <View style={styles.challengeItem}>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{challenge.title}</Text>
        <Text style={styles.rowMeta}>{challenge.description}</Text>
        <ProgressBar value={ratio} color={complete ? ui.palette.emerald : ui.palette.sky} />
        <Text style={styles.challengeMeta}>{challenge.progress}/{challenge.target}  +{challenge.reward.xp} XP  +{challenge.reward.coins} coins</Text>
      </View>
      <Pressable style={[styles.smallButton, (!challenge.canClaim || busy) && styles.disabled]} disabled={!challenge.canClaim || busy} onPress={onClaim}>
        <Text style={styles.smallButtonText}>{claimed ? 'Done' : busy ? '...' : challenge.canClaim ? 'Claim' : 'Open'}</Text>
      </Pressable>
    </View>
  );
}

function ResultRow({ result, userId }: { result: api.GameResult; userId?: string }) {
  const mine = result.players.find(player => player.userId === userId) ?? result.players[0];
  const mode = result.matchType === 'ranked' ? 'Ranked' : result.matchType === 'wager' ? 'Wager' : result.mode === 'solo' ? 'Solo' : result.mode === 'passplay' ? 'Pass & Play' : 'Online';
  const reward = mine?.economy
    ? `${mine.economy.net >= 0 ? '+' : ''}${mine.economy.net} coins`
    : mine?.ranked
      ? 'Ranked'
      : `+${mine?.progression?.xpGained ?? 0} XP`;
  return (
    <View style={styles.resultRow}>
      <View style={[styles.resultIcon, mine?.won && styles.winIcon]}>
        <Text style={styles.resultIconText}>{mine?.won ? 'W' : 'G'}</Text>
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{mode} - {mine?.won ? 'Win' : 'Played'}</Text>
        <Text style={styles.rowMeta}>{formatDate(result.completedAt)} - Total {mine?.total ?? 0} - {result.players.length} players</Text>
      </View>
      <Text style={styles.rowReward}>{reward}</Text>
    </View>
  );
}

function CosmeticTile({ item, busy, onPress }: { item: api.CosmeticItem; busy: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.cosmeticTile, item.equipped && styles.cosmeticTileEquipped, busy && styles.disabled]} disabled={item.equipped || busy} onPress={onPress}>
      <View style={styles.cosmeticTileTop}>
        <Text style={styles.cosmeticType}>{cosmeticTypeLabel(item.type)}</Text>
        <StatusBadge label={item.equipped ? 'ON' : 'OWNED'} tone={item.equipped ? 'emerald' : 'muted'} />
      </View>
      <Text style={styles.cosmeticName} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.cosmeticMeta} numberOfLines={2}>{item.description}</Text>
      <Text style={styles.cosmeticAction}>{item.equipped ? 'Equipped' : busy ? '...' : 'Equip'}</Text>
    </Pressable>
  );
}

function CollectionItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.collectionItem}>
      <Text style={styles.collectionLabel}>{label}</Text>
      <Text style={styles.collectionValue} numberOfLines={1}>{value.replace(/-/g, ' ')}</Text>
    </View>
  );
}

function sortCosmetics(items: api.CosmeticItem[]) {
  const order = ['starter', 'coin', 'ranked', 'club', 'event'];
  return [...items].sort((a, b) => {
    const group = order.indexOf(a.shopCategory) - order.indexOf(b.shopCategory);
    if (group !== 0) return group;
    return a.price - b.price || a.name.localeCompare(b.name);
  });
}

function groupCosmeticsByType(items: api.CosmeticItem[]) {
  const groups = [
    { key: 'cardBack', title: 'Card Backs', items: items.filter(item => item.type === 'cardBack') },
    { key: 'avatarIcon', title: 'Avatar Icons', items: items.filter(item => item.type === 'avatarIcon') },
    { key: 'avatarFrame', title: 'Avatar Frames', items: items.filter(item => item.type === 'avatarFrame') },
    { key: 'avatarAccessory', title: 'Avatar Accessories', items: items.filter(item => item.type === 'avatarAccessory') },
    { key: 'title', title: 'Titles', items: items.filter(item => item.type === 'title') },
    { key: 'tableTheme', title: 'Table Themes', items: items.filter(item => item.type === 'tableTheme') },
  ];
  return groups
    .map(group => ({ ...group, equipped: group.items.find(item => item.equipped)?.name ?? 'None selected' }))
    .filter(group => group.items.length);
}

function cosmeticTypeLabel(type: string) {
  if (type === 'cardBack') return 'Card';
  if (type === 'avatarIcon') return 'Icon';
  if (type === 'avatarFrame') return 'Frame';
  if (type === 'avatarAccessory') return 'Accessory';
  if (type === 'tableTheme') return 'Table';
  return 'Title';
}

function formatNullable(value: number | null | undefined) {
  return typeof value === 'number' ? String(value) : '--';
}

function formatDate(value: number) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default ProfileScreen;

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 3,
    borderColor: ui.palette.emerald,
    backgroundColor: ui.palette.feltLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: ui.text.primary, fontSize: 38, fontWeight: '900' },
  heroCopy: { flex: 1, minWidth: 0 },
  name: { color: ui.text.primary, fontSize: 25, fontWeight: '900' },
  meta: { color: ui.palette.gold, fontSize: 13, fontWeight: '900', marginTop: 4, marginBottom: 9 },
  progressText: { color: ui.text.muted, fontSize: 11, fontWeight: '800', marginTop: 5 },
  tabRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  tab: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ui.border.soft,
    backgroundColor: ui.surface.glass,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabActive: { backgroundColor: ui.palette.emerald, borderColor: ui.palette.emerald },
  tabText: { color: ui.text.secondary, fontSize: 11, fontWeight: '900' },
  tabTextActive: { color: ui.text.inverse },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  stat: {
    width: '48%',
    minHeight: 68,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ui.border.soft,
    backgroundColor: ui.surface.glass,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  statValue: { color: ui.text.primary, fontSize: 20, fontWeight: '900' },
  goldText: { color: ui.palette.gold },
  statLabel: { color: ui.text.muted, fontSize: 11, fontWeight: '900', marginTop: 4 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  sectionTitle: { color: ui.text.primary, fontSize: 18, fontWeight: '900' },
  sectionMeta: { color: ui.text.secondary, fontSize: 12, fontWeight: '800', lineHeight: 17, marginTop: 4 },
  ladderRow: { flexDirection: 'row', gap: 8 },
  ladderCard: { flex: 1, minHeight: 86, borderRadius: 8, backgroundColor: ui.surface.glass, alignItems: 'center', justifyContent: 'center', padding: 8 },
  ladderCount: { color: ui.palette.gold, fontSize: 13, fontWeight: '900' },
  ladderMmr: { color: ui.text.primary, fontSize: 20, fontWeight: '900', marginTop: 5 },
  ladderLeague: { color: ui.text.muted, fontSize: 10, fontWeight: '900', marginTop: 4 },
  challengeItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: ui.border.soft },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { color: ui.text.primary, fontSize: 14, fontWeight: '900' },
  rowMeta: { color: ui.text.secondary, fontSize: 12, fontWeight: '800', lineHeight: 17, marginTop: 3, marginBottom: 7 },
  challengeMeta: { color: ui.palette.gold, fontSize: 11, fontWeight: '900', marginTop: 5 },
  smallButton: { minWidth: 62, minHeight: 38, borderRadius: 8, backgroundColor: ui.palette.sky, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  smallButtonText: { color: ui.text.inverse, fontSize: 12, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  filterChip: { minHeight: 36, borderRadius: 8, borderWidth: 1, borderColor: ui.border.soft, backgroundColor: ui.surface.glass, justifyContent: 'center', paddingHorizontal: 12 },
  filterChipActive: { backgroundColor: ui.palette.emerald, borderColor: ui.palette.emerald },
  filterText: { color: ui.text.secondary, fontSize: 12, fontWeight: '900' },
  filterTextActive: { color: ui.text.inverse },
  resultRow: {
    minHeight: 68,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ui.border.soft,
    backgroundColor: ui.surface.glass,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    marginBottom: 8,
  },
  resultIcon: { width: 38, height: 38, borderRadius: 8, backgroundColor: ui.border.strong, alignItems: 'center', justifyContent: 'center' },
  winIcon: { backgroundColor: ui.palette.emerald },
  resultIconText: { color: ui.text.inverse, fontSize: 14, fontWeight: '900' },
  rowReward: { color: ui.palette.gold, fontSize: 12, fontWeight: '900', maxWidth: 86, textAlign: 'right' },
  emptyText: { color: ui.text.muted, fontSize: 13, fontWeight: '800', lineHeight: 19, textAlign: 'center', marginVertical: 12 },
  avatarLarge: { alignSelf: 'center', width: 118, height: 118, alignItems: 'center', justifyContent: 'center' },
  avatarLargeText: { color: ui.text.primary, fontSize: 54, fontWeight: '900' },
  avatarName: { color: ui.text.primary, fontSize: 22, fontWeight: '900', textAlign: 'center', marginTop: 12 },
  collectionRow: { gap: 8, marginVertical: 14 },
  collectionItem: { minHeight: 48, borderRadius: 8, backgroundColor: ui.surface.glass, padding: 10 },
  collectionLabel: { color: ui.text.muted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  collectionValue: { color: ui.text.primary, fontSize: 14, fontWeight: '900', marginTop: 4, textTransform: 'capitalize' },
  shopButton: { marginBottom: 12 },
  lockerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  cosmeticTile: { width: '48%', minHeight: 150, borderRadius: 8, borderWidth: 1, borderColor: ui.border.soft, backgroundColor: ui.surface.glass, padding: 10 },
  cosmeticTileEquipped: { borderColor: ui.palette.emerald },
  cosmeticTileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  cosmeticType: { color: ui.palette.gold, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  cosmeticName: { color: ui.text.primary, fontSize: 14, fontWeight: '900', marginTop: 10 },
  cosmeticMeta: { color: ui.text.secondary, fontSize: 11, fontWeight: '800', lineHeight: 16, marginTop: 4 },
  cosmeticAction: { color: ui.palette.emerald, fontSize: 12, fontWeight: '900', marginTop: 'auto' },
  socialRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  socialIcon: { width: 52, height: 52, borderRadius: 8, backgroundColor: ui.palette.feltLight, alignItems: 'center', justifyContent: 'center' },
  socialCopy: { flex: 1, minWidth: 0 },
  socialButton: { marginTop: 10 },
  linkedAccounts: { marginTop: 16, borderTopWidth: 1, borderTopColor: ui.border.soft, paddingTop: 14 },
  linkRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: ui.border.soft, paddingVertical: 10 },
  providerMark: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  googleMark: { backgroundColor: '#F4F7FF' },
  facebookMark: { backgroundColor: '#1877F2' },
  providerMarkText: { color: ui.text.inverse, fontSize: 21, fontWeight: '900' },
  facebookMarkText: { color: ui.text.primary },
  linkButton: { minWidth: 78, minHeight: 38, borderRadius: 8, backgroundColor: ui.palette.emerald, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 10 },
  linkButtonText: { color: ui.text.inverse, fontSize: 12, fontWeight: '900' },
});
