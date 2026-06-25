// client/src/screens/ProfileScreen.tsx
// Purpose: Player profile hub for progression, stats, achievements, and rewards.

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import type { RootStackParamList } from '../App';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import { getAvatarFrameVisual, getCardBackVisual, getTableThemeVisual } from '../theme/cosmetics';
import { ScreenHeader, ScreenShell, StatusBadge } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { token, user, signOut, refreshProfile } = useAuth();
  const [results, setResults] = useState<api.GameResult[]>([]);
  const [cosmetics, setCosmetics] = useState<api.CosmeticItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openLockerKeys, setOpenLockerKeys] = useState<string[]>([]);

  useFocusEffect(useCallback(() => {
    refreshProfile().catch(() => {});
    if (token) {
      api.myResults(token)
        .then(response => setResults(response.results.slice(0, 5)))
        .catch(() => setResults([]));
      api.cosmeticCatalog(token)
        .then(response => setCosmetics(response.cosmetics))
        .catch(() => setCosmetics([]));
    }
  }, [refreshProfile, token]));

  const progression = user?.progression;
  const progressPercent = Math.max(4, Math.min(100, Math.round((progression?.levelProgress ?? 0) * 100)));
  const unlockedAchievements = user?.achievements.filter(item => item.unlockedAt).slice(0, 4) ?? [];
  const lockedAchievements = user?.achievements.filter(item => !item.unlockedAt).slice(0, 3) ?? [];
  const dailyChallenges = user?.challenges?.daily?.items ?? [];
  const weeklyChallenges = user?.challenges?.weekly?.items ?? [];
  const avatarFrame = getAvatarFrameVisual(user?.inventory.equipped.avatarFrame);
  const competitive = user?.competitive;
  const dailyBonus = user?.currency.dailyBonus ?? null;
  const ownedCosmetics = sortCosmetics(cosmetics.filter(item => item.owned));
  const lockerGroups = groupCosmeticsByType(ownedCosmetics);

  const reloadProfileBits = async () => {
    await refreshProfile().catch(() => {});
    if (token) {
      api.cosmeticCatalog(token)
        .then(response => setCosmetics(response.cosmetics))
        .catch(() => {});
    }
  };

  const onClaimChallenge = async (challengeId: string) => {
    if (!token || busyId) return;
    setBusyId(challengeId);
    try {
      const response = await api.claimChallenge(token, challengeId);
      await reloadProfileBits();
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

  const onClaimDailyBonus = async () => {
    if (!token || busyId || !dailyBonus?.canClaim) return;
    setBusyId('daily-bonus');
    try {
      const response = await api.claimDailyBonus(token);
      await reloadProfileBits();
      Alert.alert('Daily Table Bonus', `+${response.reward} coins added to your stack.`);
    } catch (error) {
      Alert.alert('Bonus unavailable', error instanceof Error ? error.message : 'Try again later.');
    } finally {
      setBusyId(null);
    }
  };

  const toggleLockerCategory = (categoryKey: string) => {
    setOpenLockerKeys(current => (
      current.includes(categoryKey)
        ? current.filter(key => key !== categoryKey)
        : [...current, categoryKey]
    ));
  };

  return (
    <ScreenShell scroll>
      <ScreenHeader
        eyebrow="Player Hub"
        title={user?.displayName ?? 'Player'}
        subtitle="Progression, ranked status, achievements, owned gear, and recent matches."
        right={<StatusBadge label={`Lv ${progression?.level ?? 1}`} tone="gold" />}
      />

      <View style={styles.hero}>
        <View style={[styles.avatar, { borderColor: avatarFrame.borderColor, backgroundColor: avatarFrame.backgroundColor }]}>
          <Text style={styles.avatarText}>{user?.avatarInitial ?? '?'}</Text>
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.name} numberOfLines={1}>{user?.displayName ?? 'Player'}</Text>
          <Text style={styles.level}>Level {progression?.level ?? 1}</Text>
          {user?.club ? (
            <Text style={styles.clubLine} numberOfLines={1}>[{user.club.tag}] {user.club.name}</Text>
          ) : null}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {progression?.currentLevelXp ?? 0} / {progression?.nextLevelXp ?? 1000} XP
          </Text>
        </View>
      </View>

      <View style={styles.statGrid}>
        <Stat label="Coins" value={String(user?.currency.coins ?? 0)} tone="gold" />
        <Stat label="Games" value={String(user?.statistics.gamesPlayed ?? 0)} />
        <Stat label="Wins" value={String(user?.statistics.wins ?? 0)} />
        <Stat label="Best Total" value={formatNullable(user?.statistics.bestTotal)} />
        <Stat label="Best Round" value={formatNullable(user?.statistics.bestRound)} />
        <Stat label="Clears" value={String(user?.statistics.columnClears ?? 0)} />
      </View>

      <SectionTitle title="Economy" />
      <View style={styles.economyCard}>
        <View style={styles.economyHeader}>
          <View>
            <Text style={styles.economyTitle}>Build Your Stack</Text>
            <Text style={styles.economyText}>Claim the daily bonus, play Free Play, and finish challenges to earn coins for wagers and cosmetics.</Text>
          </View>
          <Text style={styles.economyCoins}>{user?.currency.coins ?? 0}</Text>
        </View>
        <View style={styles.economyRows}>
          <Stat label="Lifetime" value={String(user?.currency.lifetimeCoins ?? 0)} tone="gold" />
          <Stat label="Daily Bonus" value={dailyBonus?.canClaim ? `+${dailyBonus.reward}` : 'Claimed'} />
          <Stat label="Streak" value={`${dailyBonus?.streak ?? 0}d`} />
        </View>
        <Pressable
          style={[styles.claimButton, (!dailyBonus?.canClaim || busyId === 'daily-bonus') && styles.smallButtonDisabled]}
          disabled={!dailyBonus?.canClaim || busyId === 'daily-bonus'}
          onPress={onClaimDailyBonus}
        >
          <Text style={styles.claimButtonText}>
            {dailyBonus?.canClaim ? `Claim ${dailyBonus.reward} Coins` : 'Daily Bonus Claimed'}
          </Text>
        </Pressable>
      </View>

      <SectionTitle title="Ranked" />
      <View style={styles.rankedCard}>
        <View style={styles.rankedHeader}>
          <View>
            <Text style={styles.rankedLeague}>{competitive?.league.name ?? 'Silver III'}</Text>
            <Text style={styles.rankedMeta}>{competitive?.mmr ?? 1000} MMR</Text>
          </View>
          <View style={styles.rankedBadge}>
            <Text style={styles.rankedBadgeText}>{competitive?.placementComplete ? 'RANKED' : 'PLACEMENT'}</Text>
          </View>
        </View>
        <View style={styles.rankedStats}>
          <Stat label="Ranked Games" value={String(competitive?.rankedGames ?? 0)} />
          <Stat label="Ranked Wins" value={String(competitive?.wins ?? 0)} />
          <Stat label="Season Best" value={competitive?.seasonBestLeague.name ?? 'Silver III'} />
        </View>
        <Text style={styles.rankedMeta}>
          {competitive?.placementComplete
            ? `${competitive?.season.name ?? 'Season 1'} shop unlocks use your season best. Buy ranked cosmetics in the Shop.`
            : `${competitive?.placementsRemaining ?? 5} placement match${(competitive?.placementsRemaining ?? 5) === 1 ? '' : 'es'} remaining.`}
        </Text>
      </View>

      <SectionTitle title="Achievements" />
      {unlockedAchievements.length ? (
        unlockedAchievements.map(item => <AchievementRow key={item.id} achievement={item} />)
      ) : (
        <Text style={styles.emptyText}>Play a match to unlock your first achievement.</Text>
      )}
      {lockedAchievements.length ? (
        <View style={styles.lockedBlock}>
          {lockedAchievements.map(item => (
            <Text key={item.id} style={styles.lockedText}>{item.name} - Locked</Text>
          ))}
        </View>
      ) : null}

      <SectionTitle title="Daily Challenges" />
      {dailyChallenges.map(item => (
        <ChallengeRow
          key={item.id}
          challenge={item}
          busy={busyId === item.id}
          onClaim={() => onClaimChallenge(item.id)}
        />
      ))}

      <SectionTitle title="Weekly Challenges" />
      {weeklyChallenges.map(item => (
        <ChallengeRow
          key={item.id}
          challenge={item}
          busy={busyId === item.id}
          onClaim={() => onClaimChallenge(item.id)}
        />
      ))}

      <SectionTitle title="Recent Matches" />
      {results.length ? (
        results.map(result => <ResultRow key={result.resultId} result={result} userId={user?.userId} />)
      ) : (
        <Text style={styles.emptyText}>Completed matches will appear here.</Text>
      )}

      <SectionTitle title="Collection" />
      <View style={styles.collectionRow}>
        <CollectionItem label="Card Back" value={user?.inventory.equipped.cardBack ?? 'classic-card-back'} />
        <CollectionItem label="Avatar Frame" value={user?.inventory.equipped.avatarFrame ?? 'rookie-avatar-frame'} />
        <CollectionItem label="Table" value={user?.inventory.equipped.tableTheme ?? 'classic-table-theme'} />
        <CollectionItem label="Title" value={user?.inventory.equipped.title ?? 'rookie-title'} />
      </View>

      <SectionTitle title="Locker" />
      {lockerGroups.length ? (
        lockerGroups.map(group => (
          <View key={group.key} style={styles.lockerCategory}>
            <LockerHeader
              title={group.title}
              count={group.items.length}
              equipped={group.equipped}
              expanded={openLockerKeys.includes(group.key)}
              onPress={() => toggleLockerCategory(group.key)}
            />
            {openLockerKeys.includes(group.key) ? (
              <View style={styles.lockerTileGrid}>
                {group.items.map(item => (
                  <CosmeticTile
                    key={item.id}
                    item={item}
                    busy={busyId === item.id}
                    onPress={() => onCosmeticPress(item)}
                  />
                ))}
              </View>
            ) : null}
          </View>
        ))
      ) : (
        <Text style={styles.emptyText}>Owned cosmetics will appear here. Visit the Shop to buy new looks.</Text>
      )}

      <Pressable style={styles.primaryButton} onPress={() => navigation.goBack()}>
        <Text style={styles.primaryButtonText}>Back to Lobby</Text>
      </Pressable>
      <Pressable style={styles.dangerButton} onPress={signOut}>
        <Text style={styles.dangerButtonText}>Log Out</Text>
      </Pressable>
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

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function LockerHeader({
  title,
  count,
  equipped,
  expanded,
  onPress,
}: {
  title: string;
  count: number;
  equipped: string;
  expanded: boolean;
  onPress: () => void;
}) {
  const Chevron = expanded ? ChevronDown : ChevronRight;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.lockerHeader, pressed && styles.lockerHeaderPressed]}>
      <View style={styles.lockerHeaderCopy}>
        <Text style={styles.lockerTitle}>{title}</Text>
        <Text style={styles.lockerSubtitle} numberOfLines={1}>Equipped: {equipped}</Text>
      </View>
      <View style={styles.lockerHeaderMeta}>
        <StatusBadge label={`${count}`} tone="sky" />
        <Chevron size={20} color="#9BA3C7" strokeWidth={2.8} />
      </View>
    </Pressable>
  );
}

function AchievementRow({ achievement }: { achievement: api.Achievement }) {
  return (
    <View style={styles.rowItem}>
      <View style={styles.rowIcon}><Text style={styles.rowIconText}>XP</Text></View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{achievement.name}</Text>
        <Text style={styles.rowMeta}>{achievement.description}</Text>
      </View>
      <Text style={styles.rowReward}>+{achievement.reward.coins}</Text>
    </View>
  );
}

function ChallengeRow({ challenge, busy, onClaim }: { challenge: api.Challenge; busy: boolean; onClaim: () => void }) {
  const ratio = challenge.target > 0 ? Math.min(1, challenge.progress / challenge.target) : 0;
  const percent = Math.max(4, Math.round(ratio * 100));
  const complete = !!challenge.completedAt;
  const claimed = !!challenge.claimedAt;
  return (
    <View style={styles.challengeItem}>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{challenge.title}</Text>
        <Text style={styles.rowMeta}>{challenge.description}</Text>
        <View style={styles.challengeProgressTrack}>
          <View style={[styles.challengeProgressFill, complete && styles.challengeProgressComplete, { width: `${percent}%` }]} />
        </View>
        <Text style={styles.challengeMeta}>
          {challenge.progress}/{challenge.target}  +{challenge.reward.xp} XP  +{challenge.reward.coins} coins
        </Text>
      </View>
      <Pressable
        style={[styles.smallButton, (!challenge.canClaim || busy) && styles.smallButtonDisabled]}
        disabled={!challenge.canClaim || busy}
        onPress={onClaim}
      >
        <Text style={styles.smallButtonText}>{claimed ? 'Done' : busy ? '...' : challenge.canClaim ? 'Claim' : 'Open'}</Text>
      </Pressable>
    </View>
  );
}

function CosmeticTile({ item, busy, onPress }: { item: api.CosmeticItem; busy: boolean; onPress: () => void }) {
  const label = item.equipped ? 'Equipped' : 'Equip';
  const badgeLabel = item.type === 'cardBack' ? 'CB' : item.type === 'avatarFrame' ? 'AF' : item.type === 'tableTheme' ? 'TB' : 'T';
  const cardBack = item.type === 'cardBack' ? getCardBackVisual(item.id) : null;
  const avatarFrame = item.type === 'avatarFrame' ? getAvatarFrameVisual(item.id) : null;
  const tableTheme = item.type === 'tableTheme' ? getTableThemeVisual(item.id) : null;
  const badgeStyle = cardBack
    ? { backgroundColor: cardBack.backgroundColor, borderColor: cardBack.borderColor }
    : avatarFrame
      ? { backgroundColor: avatarFrame.backgroundColor, borderColor: avatarFrame.borderColor }
      : tableTheme
        ? { backgroundColor: tableTheme.panelColor, borderColor: tableTheme.accentColor }
        : null;
  return (
    <Pressable
      style={[styles.lockerTile, item.equipped && styles.lockerTileEquipped, busy && styles.smallButtonDisabled]}
      disabled={item.equipped || busy}
      onPress={onPress}
    >
      <View style={styles.lockerTileTop}>
        <View style={[styles.cosmeticBadge, badgeStyle]}>
          <Text style={styles.cosmeticBadgeText}>{badgeLabel}</Text>
        </View>
        <StatusBadge label={item.equipped ? 'ON' : 'OWNED'} tone={item.equipped ? 'emerald' : 'muted'} />
      </View>
      <Text style={styles.lockerTileTitle} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.lockerTileText} numberOfLines={2}>{item.description}</Text>
      <View style={[styles.lockerTileAction, item.equipped && styles.lockerTileActionEquipped]}>
        <Text style={styles.lockerTileActionText}>{busy ? '...' : label}</Text>
      </View>
    </Pressable>
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
    {
      key: 'cardBack',
      title: 'Card Backs',
      subtitle: 'Choose the one card-back design shown in games.',
      items: items.filter(item => item.type === 'cardBack'),
    },
    {
      key: 'avatarFrame',
      title: 'Avatar Frames',
      subtitle: 'Choose the one frame around your player avatar.',
      items: items.filter(item => item.type === 'avatarFrame'),
    },
    {
      key: 'title',
      title: 'Titles',
      subtitle: 'Choose the one title shown with your profile.',
      items: items.filter(item => item.type === 'title'),
    },
    {
      key: 'tableTheme',
      title: 'Table Themes',
      subtitle: 'Choose the one table style used on your match screen.',
      items: items.filter(item => item.type === 'tableTheme'),
    },
  ];
  return groups
    .map(group => ({
      ...group,
      equipped: group.items.find(item => item.equipped)?.name ?? 'None selected',
    }))
    .filter(group => group.items.length);
}

function ResultRow({ result, userId }: { result: api.GameResult; userId?: string }) {
  const mine = result.players.find(player => player.userId === userId) ?? result.players[0];
  const mode = result.matchType === 'ranked' ? 'Ranked' : result.matchType === 'wager' ? 'Wager' : result.mode === 'solo' ? 'Solo' : result.mode === 'passplay' ? 'Pass & Play' : 'Online';
  const reward = mine?.economy
    ? `${mine.economy.net >= 0 ? '+' : ''}${mine.economy.net} coins`
    : mine?.ranked
      ? `${mine.ranked.mmrDelta > 0 ? '+' : ''}${mine.ranked.mmrDelta} MMR`
      : `+${mine?.progression?.xpGained ?? 0} XP`;
  return (
    <View style={styles.rowItem}>
      <View style={[styles.rowIcon, mine?.won && styles.winIcon]}><Text style={styles.rowIconText}>{mine?.won ? 'W' : 'G'}</Text></View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{mode} - {mine?.won ? 'Win' : 'Played'}</Text>
        <Text style={styles.rowMeta}>{formatDate(result.completedAt)} - Total {mine?.total ?? 0}</Text>
      </View>
      <Text style={styles.rowReward}>{reward}</Text>
    </View>
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

function formatNullable(value: number | null | undefined) {
  return typeof value === 'number' ? String(value) : '--';
}

function formatDate(value: number) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default ProfileScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1023' },
  content: { padding: 16, paddingTop: 54, paddingBottom: 34 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 18,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: '#52E5A7',
    backgroundColor: '#123B32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#E8ECF1', fontSize: 40, fontWeight: '900' },
  heroCopy: { flex: 1, minWidth: 0 },
  name: { color: '#E8ECF1', fontSize: 30, fontWeight: '900' },
  level: { color: '#52E5A7', fontSize: 15, fontWeight: '900', marginTop: 4 },
  clubLine: { color: '#FFCC66', fontSize: 13, fontWeight: '900', marginTop: 4 },
  progressTrack: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#121737',
    borderWidth: 1,
    borderColor: '#2A2F57',
    overflow: 'hidden',
    marginTop: 10,
  },
  progressFill: { height: '100%', backgroundColor: '#52E5A7' },
  progressText: { color: '#9BA3C7', fontSize: 12, fontWeight: '800', marginTop: 5 },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  rankedCard: {
    backgroundColor: '#121737',
    borderColor: '#FFCC66',
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  economyCard: {
    backgroundColor: '#121737',
    borderColor: '#2A2F57',
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  economyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  economyTitle: { color: '#E8ECF1', fontSize: 20, fontWeight: '900' },
  economyText: { color: '#9BA3C7', fontSize: 12, fontWeight: '800', lineHeight: 18, marginTop: 5 },
  economyCoins: { color: '#FFCC66', fontSize: 30, fontWeight: '900' },
  economyRows: { flexDirection: 'row', gap: 8, marginTop: 12 },
  rankedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rankedLeague: { color: '#FFCC66', fontSize: 24, fontWeight: '900' },
  rankedMeta: { color: '#9BA3C7', fontSize: 12, fontWeight: '800', marginTop: 5 },
  rankedBadge: { backgroundColor: '#FFCC66', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  rankedBadgeText: { color: '#0B1023', fontWeight: '900', fontSize: 11 },
  rankedStats: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 8 },
  claimButton: { backgroundColor: '#FFCC66', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 12 },
  claimButtonText: { color: '#0B1023', fontWeight: '900' },
  stat: {
    width: '31.5%',
    minHeight: 76,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2F57',
    backgroundColor: '#121737',
    justifyContent: 'center',
    padding: 10,
  },
  statValue: { color: '#E8ECF1', fontSize: 22, fontWeight: '900' },
  statLabel: { color: '#9BA3C7', fontSize: 11, fontWeight: '800', marginTop: 4 },
  goldText: { color: '#FFCC66' },
  sectionTitle: { color: '#E8ECF1', fontSize: 18, fontWeight: '900', marginTop: 10, marginBottom: 8 },
  rowItem: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2F57',
    backgroundColor: '#121737',
    padding: 10,
    marginBottom: 8,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#102448',
    borderWidth: 2,
    borderColor: '#4DA3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  winIcon: { backgroundColor: '#123B32', borderColor: '#52E5A7' },
  rowIconText: { color: '#E8ECF1', fontWeight: '900', fontSize: 13 },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { color: '#E8ECF1', fontSize: 14, fontWeight: '900' },
  rowMeta: { color: '#9BA3C7', fontSize: 12, fontWeight: '700', marginTop: 3 },
  rowReward: { color: '#FFCC66', fontSize: 12, fontWeight: '900' },
  challengeItem: {
    minHeight: 90,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2F57',
    backgroundColor: '#121737',
    padding: 10,
    marginBottom: 8,
  },
  challengeProgressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0B1023',
    overflow: 'hidden',
    marginTop: 8,
  },
  challengeProgressFill: { height: '100%', backgroundColor: '#4DA3FF' },
  challengeProgressComplete: { backgroundColor: '#52E5A7' },
  challengeMeta: { color: '#FFCC66', fontSize: 11, fontWeight: '900', marginTop: 5 },
  cosmeticItem: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2F57',
    backgroundColor: '#121737',
    padding: 10,
    marginBottom: 8,
  },
  cosmeticBadge: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFCC66',
    backgroundColor: '#2B2515',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cosmeticBadgeText: { color: '#FFCC66', fontSize: 12, fontWeight: '900' },
  cosmeticMeta: { color: '#52E5A7', fontSize: 11, fontWeight: '900', marginTop: 4 },
  lockerCategory: { marginBottom: 8 },
  lockerHeader: {
    minHeight: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3C4676',
    backgroundColor: '#0F1530',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  lockerHeaderPressed: { borderColor: '#4DA3FF', backgroundColor: '#171D43' },
  lockerHeaderCopy: { flex: 1, minWidth: 0 },
  lockerTitle: { color: '#E8ECF1', fontSize: 16, fontWeight: '900' },
  lockerSubtitle: { color: '#9BA3C7', fontSize: 11, fontWeight: '800', marginTop: 2, textTransform: 'capitalize' },
  lockerHeaderMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lockerTileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 6,
  },
  lockerTile: {
    width: '48.5%',
    minHeight: 148,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2F57',
    backgroundColor: 'rgba(18, 23, 55, 0.88)',
    padding: 10,
  },
  lockerTileEquipped: { borderColor: '#52E5A7', backgroundColor: 'rgba(18, 59, 50, 0.82)' },
  lockerTileTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  lockerTileTitle: { color: '#E8ECF1', fontSize: 13, fontWeight: '900', marginTop: 9 },
  lockerTileText: { color: '#9BA3C7', fontSize: 11, fontWeight: '700', lineHeight: 15, marginTop: 4 },
  lockerTileAction: {
    minHeight: 34,
    borderRadius: 8,
    backgroundColor: '#4DA3FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
    paddingHorizontal: 8,
  },
  lockerTileActionEquipped: { backgroundColor: '#52E5A7' },
  lockerTileActionText: { color: '#0B1023', fontSize: 11, fontWeight: '900' },
  equippedChip: {
    maxWidth: 132,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#52E5A7',
    backgroundColor: 'rgba(82, 229, 167, 0.12)',
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  equippedLabel: { color: '#52E5A7', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  equippedValue: { color: '#E8ECF1', fontSize: 11, fontWeight: '900', marginTop: 2, textTransform: 'capitalize' },
  smallButton: {
    minWidth: 72,
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: '#4DA3FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  smallButtonEquipped: { backgroundColor: '#52E5A7' },
  smallButtonDisabled: { opacity: 0.45 },
  smallButtonText: { color: '#0B1023', fontSize: 12, fontWeight: '900' },
  lockedBlock: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2F57',
    backgroundColor: '#0F1530',
    padding: 10,
    marginBottom: 8,
  },
  lockedText: { color: '#9BA3C7', fontSize: 12, fontWeight: '800', marginBottom: 4 },
  emptyText: {
    color: '#9BA3C7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2F57',
    backgroundColor: '#121737',
    padding: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  collectionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  collectionItem: {
    width: '48%',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2F57',
    backgroundColor: '#121737',
    padding: 12,
  },
  collectionLabel: { color: '#9BA3C7', fontSize: 11, fontWeight: '900' },
  collectionValue: { color: '#E8ECF1', fontSize: 13, fontWeight: '900', marginTop: 5, textTransform: 'capitalize' },
  primaryButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: '#52E5A7',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryButtonText: { color: '#0B1023', fontSize: 16, fontWeight: '900' },
  dangerButton: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FF6B6B',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  dangerButtonText: { color: '#FF6B6B', fontSize: 16, fontWeight: '900' },
});
