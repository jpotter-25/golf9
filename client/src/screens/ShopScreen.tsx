// client/src/screens/ShopScreen.tsx
// Purpose: Dedicated storefront for coin, ranked, club, and event cosmetics.

import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Coins, Gift, Lock, ShoppingBag } from 'lucide-react-native';
import type { RootStackParamList } from '../App';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import { getAvatarAccessoryVisual, getAvatarFrameVisual, getCardBackVisual, getTableThemeVisual } from '../theme/cosmetics';
import { ActionButton, PremiumPanel, ScreenHeader, ScreenShell, StatusBadge, ui } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Shop'>;

export default function ShopScreen({ navigation }: Props) {
  return (
    <ScreenShell scroll>
      <ShopContent onBack={() => navigation.goBack()} />
    </ScreenShell>
  );
}

export function ShopContent({
  embedded = false,
  backLabel = 'Back to Lobby',
  onBack,
}: {
  embedded?: boolean;
  backLabel?: string;
  onBack: () => void;
}) {
  const { token, user, refreshProfile } = useAuth();
  const [cosmetics, setCosmetics] = useState<api.CosmeticItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openCategoryKeys, setOpenCategoryKeys] = useState<string[]>([]);

  const loadShop = useCallback(async () => {
    await refreshProfile().catch(() => {});
    if (!token) {
      setCosmetics([]);
      return;
    }
    const response = await api.cosmeticCatalog(token);
    setCosmetics(response.cosmetics);
  }, [refreshProfile, token]);

  useFocusEffect(useCallback(() => {
    loadShop().catch(() => setCosmetics([]));
  }, [loadShop]));

  const dailyBonus = user?.currency.dailyBonus ?? null;
  const claimableSeasonRewards = user?.competitive.season.rewards.filter(item => item.earned && !item.claimed) ?? [];
  const coinBalance = user?.currency.coins ?? 0;

  const onClaimDailyBonus = async () => {
    if (!token || busyId || !dailyBonus?.canClaim) return;
    setBusyId('daily-bonus');
    try {
      const response = await api.claimDailyBonus(token);
      await loadShop();
      Alert.alert('Daily Table Bonus', `+${response.reward} coins added to your stack.`);
    } catch (error) {
      Alert.alert('Bonus unavailable', error instanceof Error ? error.message : 'Try again later.');
    } finally {
      setBusyId(null);
    }
  };

  const onRefreshRankedUnlocks = async () => {
    if (!token || busyId || !claimableSeasonRewards.length) return;
    setBusyId('ranked-season-rewards');
    try {
      const response = await api.claimRankedSeasonRewards(token);
      setCosmetics(response.cosmetics);
      await refreshProfile().catch(() => {});
      Alert.alert(
        response.granted.length ? 'Ranked shop updated' : 'No ranked unlocks ready',
        response.granted.length
          ? response.granted.map(item => `${item.name} is now available to buy.`).join('\n')
          : 'Push your season best higher to unlock more ranked cosmetics.'
      );
    } catch (error) {
      Alert.alert('Unlock refresh failed', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusyId(null);
    }
  };

  const onPurchase = async (item: api.CosmeticItem) => {
    if (!token || busyId || item.owned) return;
    if (!item.eligible) {
      Alert.alert('Locked', item.lockedReason ?? 'This item is not available yet.');
      return;
    }
    if (!item.canAfford) {
      Alert.alert('Need more coins', 'Earn coins in Free Play, Daily Bonus, and Challenges.');
      return;
    }

    setBusyId(item.id);
    try {
      const response = await api.purchaseCosmetic(token, item.id);
      setCosmetics(response.cosmetics);
      await refreshProfile().catch(() => {});
      Alert.alert('Purchased', `${item.name} is now in your locker.`);
    } catch (error) {
      Alert.alert('Purchase failed', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusyId(null);
    }
  };

  const toggleCategory = (categoryKey: string) => {
    setOpenCategoryKeys(current => (
      current.includes(categoryKey)
        ? current.filter(key => key !== categoryKey)
        : [...current, categoryKey]
    ));
  };

  const grouped = groupCosmeticsByType(sortCosmetics(cosmetics));

  return (
    <View style={embedded ? styles.embeddedContent : undefined}>
      <ScreenHeader
        eyebrow="Storefront"
        title="Shop"
        subtitle="Buy cosmetics with coins. Equip owned items from your Profile locker."
        right={<StatusBadge label={`${coinBalance} coins`} tone="gold" />}
      />

      <PremiumPanel tone="felt" style={styles.earnPanel}>
        <View style={styles.earnHeader}>
          <View style={styles.earnIcon}>
            <Coins size={24} color={ui.palette.gold} strokeWidth={2.8} />
          </View>
          <View style={styles.earnCopy}>
            <Text style={styles.earnTitle}>Earn Coins</Text>
            <Text style={styles.earnText}>Free Play, Daily Bonus, and Challenges always let you rebuild your stack.</Text>
          </View>
        </View>
        <Pressable
          style={[styles.claimButton, (!dailyBonus?.canClaim || busyId === 'daily-bonus') && styles.disabled]}
          disabled={!dailyBonus?.canClaim || busyId === 'daily-bonus'}
          onPress={onClaimDailyBonus}
        >
          <Gift size={18} color={ui.text.inverse} strokeWidth={2.8} />
          <Text style={styles.claimButtonText}>
            {dailyBonus?.canClaim ? `Claim ${dailyBonus.reward} Coins` : 'Daily Bonus Claimed'}
          </Text>
        </Pressable>
      </PremiumPanel>

      {claimableSeasonRewards.length ? (
        <PremiumPanel tone="gold" style={styles.rankedUnlockPanel}>
          <Text style={styles.rankedUnlockTitle}>Ranked Prestige Ready</Text>
          <Text style={styles.rankedUnlockText}>
            {claimableSeasonRewards.length} ranked item{claimableSeasonRewards.length === 1 ? '' : 's'} can be unlocked in the shop from your season best.
          </Text>
          <ActionButton
            label={busyId === 'ranked-season-rewards' ? 'Updating...' : 'Update Ranked Shop'}
            Icon={ShoppingBag}
            tone="ghost"
            disabled={busyId === 'ranked-season-rewards'}
            onPress={onRefreshRankedUnlocks}
          />
        </PremiumPanel>
      ) : null}

      {grouped.map(group => (
        <View key={group.key} style={styles.categoryBlock}>
          <CatalogHeader
            title={group.title}
            summary={group.summary}
            count={group.items.length}
            expanded={openCategoryKeys.includes(group.key)}
            onPress={() => toggleCategory(group.key)}
          />
          {openCategoryKeys.includes(group.key) ? (
            <View style={styles.tileGrid}>
              {group.items.map(item => (
                <ShopItemTile
                  key={item.id}
                  item={item}
                  busy={busyId === item.id}
                  onPress={() => onPurchase(item)}
                />
              ))}
            </View>
          ) : null}
        </View>
      ))}

      {!cosmetics.length ? (
        <Text style={styles.emptyText}>Shop items will load once the server is reachable.</Text>
      ) : null}

      <ActionButton label={backLabel} Icon={ChevronLeft} tone="ghost" onPress={onBack} style={styles.backButton} />
    </View>
  );
}

function CatalogHeader({
  title,
  summary,
  count,
  expanded,
  onPress,
}: {
  title: string;
  summary: string;
  count: number;
  expanded: boolean;
  onPress: () => void;
}) {
  const Chevron = expanded ? ChevronDown : ChevronRight;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.categoryHeader, pressed && styles.categoryHeaderPressed]}>
      <View style={styles.categoryHeaderCopy}>
        <Text style={styles.categoryTitle}>{title}</Text>
        <Text style={styles.categorySubtitle} numberOfLines={1}>{summary}</Text>
      </View>
      <View style={styles.categoryMeta}>
        <StatusBadge label={`${count}`} tone="sky" />
        <Chevron size={20} color={ui.text.secondary} strokeWidth={2.8} />
      </View>
    </Pressable>
  );
}

function ShopItemTile({ item, busy, onPress }: { item: api.CosmeticItem; busy: boolean; onPress: () => void }) {
  const badge = cosmeticBadge(item);
  const owned = item.owned;
  const unlocked = item.eligible && !owned;
  const locked = !item.eligible && !owned;
  const label = owned
    ? 'Owned'
    : locked
      ? 'Locked'
      : item.canAfford
        ? `${item.price} coins`
        : 'Need Coins';
  const disabled = busy || owned || locked || !item.canAfford;
  return (
    <Pressable
      style={[
        styles.itemTile,
        owned && styles.itemTileOwned,
        locked && styles.itemTileLocked,
        busy && styles.disabled,
      ]}
      disabled={disabled}
      onPress={onPress}
    >
      <View style={styles.itemTileTop}>
        <View style={[styles.itemBadge, badge.style]}>
          {owned ? <Check size={20} color={ui.text.primary} strokeWidth={3} /> : locked ? <Lock size={18} color={ui.text.muted} strokeWidth={2.8} /> : <Text style={styles.itemBadgeText}>{badge.label}</Text>}
        </View>
        <View style={[styles.sourceChip, item.shopCategory === 'ranked' && styles.sourceChipGold, item.shopCategory === 'club' && styles.sourceChipSky]}>
          <Text style={styles.sourceChipText}>{categoryLabel(item.shopCategory)}</Text>
        </View>
      </View>
      <Text style={styles.itemTitle} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.itemDescription} numberOfLines={2}>{item.description}</Text>
      <Text style={[styles.itemMeta, unlocked && styles.itemMetaUnlocked]} numberOfLines={1}>
        {owned ? 'Owned' : item.eligible ? 'Unlocked' : item.lockedReason ?? 'Locked'}
      </Text>
      <View style={[styles.tileAction, owned && styles.tileActionOwned, locked && styles.tileActionLocked, !owned && item.eligible && !item.canAfford && styles.tileActionLocked]}>
        <Text style={[styles.tileActionText, (owned || locked || !item.canAfford) && styles.tileActionTextMuted]}>
          {busy ? '...' : label}
        </Text>
      </View>
    </Pressable>
  );
}

function cosmeticBadge(item: api.CosmeticItem) {
  const label = item.type === 'cardBack' ? 'CB' : item.type === 'avatarIcon' ? 'AI' : item.type === 'avatarFrame' ? 'AF' : item.type === 'avatarAccessory' ? 'AX' : item.type === 'tableTheme' ? 'TB' : 'T';
  if (item.type === 'cardBack') {
    const visual = getCardBackVisual(item.id);
    return { label, style: { backgroundColor: visual.backgroundColor, borderColor: visual.borderColor } };
  }
  if (item.type === 'avatarFrame') {
    const visual = getAvatarFrameVisual(item.id);
    return { label, style: { backgroundColor: visual.backgroundColor, borderColor: visual.borderColor } };
  }
  if (item.type === 'avatarIcon') {
    return { label, style: { backgroundColor: '#123B32', borderColor: '#52E5A7' } };
  }
  if (item.type === 'avatarAccessory') {
    const visual = getAvatarAccessoryVisual(item.id);
    return { label: visual.label || label, style: { backgroundColor: visual.backgroundColor, borderColor: visual.borderColor } };
  }
  if (item.type === 'tableTheme') {
    const visual = getTableThemeVisual(item.id);
    return { label, style: { backgroundColor: visual.panelColor, borderColor: visual.accentColor } };
  }
  return { label, style: null };
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
      subtitle: 'The back design shown on your cards.',
      items: items.filter(item => item.type === 'cardBack'),
    },
    {
      key: 'avatarIcon',
      title: 'Avatar Icons',
      subtitle: 'The icon shown inside your player avatar.',
      items: items.filter(item => item.type === 'avatarIcon'),
    },
    {
      key: 'avatarFrame',
      title: 'Avatar Frames',
      subtitle: 'The border around your player avatar.',
      items: items.filter(item => item.type === 'avatarFrame'),
    },
    {
      key: 'avatarAccessory',
      title: 'Avatar Accessories',
      subtitle: 'Jewelry, watches, and seasonal flex items beside your avatar.',
      items: items.filter(item => item.type === 'avatarAccessory'),
    },
    {
      key: 'title',
      title: 'Titles',
      subtitle: 'Prestige labels shown with your profile.',
      items: items.filter(item => item.type === 'title'),
    },
    {
      key: 'tableTheme',
      title: 'Table Themes',
      subtitle: 'The felt, table, and match surface treatment.',
      items: items.filter(item => item.type === 'tableTheme'),
    },
  ];
  return groups
    .map(group => ({ ...group, summary: shopSummary(group.items) }))
    .filter(group => group.items.length);
}

function shopSummary(items: api.CosmeticItem[]) {
  const owned = items.filter(item => item.owned).length;
  const buyable = items.filter(item => !item.owned && item.eligible && item.canAfford).length;
  const needCoins = items.filter(item => !item.owned && item.eligible && !item.canAfford).length;
  const locked = items.filter(item => !item.owned && !item.eligible).length;
  const parts = [
    buyable ? `${buyable} buyable` : null,
    needCoins ? `${needCoins} need coins` : null,
    owned ? `${owned} owned` : null,
    locked ? `${locked} locked` : null,
  ].filter(Boolean);
  return parts.join(' • ') || 'No items';
}

function categoryLabel(category: string) {
  if (category === 'starter') return 'STARTER';
  if (category === 'ranked') return 'RANKED';
  if (category === 'club') return 'CLUB';
  if (category === 'event') return 'EVENT';
  return 'COIN';
}

const styles = StyleSheet.create({
  embeddedContent: { paddingBottom: 8 },
  earnPanel: { gap: 14 },
  earnHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  earnIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ui.border.gold,
    backgroundColor: 'rgba(255, 204, 102, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  earnCopy: { flex: 1, minWidth: 0 },
  earnTitle: { color: ui.text.primary, fontSize: 20, fontWeight: '900' },
  earnText: { color: ui.text.secondary, fontSize: 13, fontWeight: '700', lineHeight: 18, marginTop: 4 },
  claimButton: {
    minHeight: 48,
    borderRadius: ui.radius.md,
    backgroundColor: ui.palette.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  claimButtonText: { color: ui.text.inverse, fontSize: 15, fontWeight: '900' },
  rankedUnlockPanel: { gap: 10 },
  rankedUnlockTitle: { color: ui.text.inverse, fontSize: 18, fontWeight: '900' },
  rankedUnlockText: { color: ui.text.inverse, opacity: 0.76, fontSize: 13, fontWeight: '800', lineHeight: 18 },
  categoryBlock: { marginTop: 4, marginBottom: 8 },
  categoryHeader: {
    minHeight: 52,
    borderRadius: ui.radius.md,
    borderWidth: 1,
    borderColor: ui.border.strong,
    backgroundColor: 'rgba(18, 23, 55, 0.78)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  categoryHeaderPressed: { borderColor: ui.border.glow, backgroundColor: ui.surface.raised },
  categoryHeaderCopy: { flex: 1, minWidth: 0 },
  categoryTitle: { color: ui.text.primary, fontSize: 16, fontWeight: '900' },
  categorySubtitle: { color: ui.text.secondary, fontSize: 11, fontWeight: '800', marginTop: 2 },
  categoryMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 6,
  },
  itemTile: {
    width: '48.5%',
    minHeight: 168,
    borderRadius: ui.radius.lg,
    borderWidth: 1,
    borderColor: ui.border.soft,
    backgroundColor: ui.surface.glass,
    padding: 10,
  },
  itemTileOwned: { borderColor: ui.palette.emerald },
  itemTileLocked: { opacity: 0.72 },
  itemTileTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  itemBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: ui.border.gold,
    backgroundColor: 'rgba(255, 204, 102, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBadgeText: { color: ui.palette.gold, fontSize: 12, fontWeight: '900' },
  sourceChip: {
    minHeight: 22,
    borderRadius: 6,
    backgroundColor: ui.border.strong,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceChipGold: { backgroundColor: ui.palette.gold },
  sourceChipSky: { backgroundColor: ui.palette.sky },
  sourceChipText: { color: ui.text.inverse, fontSize: 9, fontWeight: '900' },
  itemTitle: { color: ui.text.primary, fontSize: 13, fontWeight: '900', marginTop: 9 },
  itemDescription: { color: ui.text.secondary, fontSize: 11, fontWeight: '700', lineHeight: 15, marginTop: 4 },
  itemMeta: { color: ui.text.muted, fontSize: 10, fontWeight: '900', marginTop: 6 },
  itemMetaUnlocked: { color: ui.palette.emerald },
  tileAction: {
    minHeight: 34,
    borderRadius: ui.radius.md,
    backgroundColor: ui.palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
    paddingHorizontal: 8,
  },
  tileActionOwned: { backgroundColor: ui.palette.emerald },
  tileActionLocked: { backgroundColor: ui.border.strong },
  tileActionText: { color: ui.text.inverse, fontSize: 11, fontWeight: '900' },
  tileActionTextMuted: { color: ui.text.primary },
  emptyText: {
    color: ui.text.secondary,
    borderRadius: ui.radius.md,
    borderWidth: 1,
    borderColor: ui.border.soft,
    backgroundColor: ui.surface.glass,
    padding: 14,
    fontWeight: '800',
    marginBottom: 12,
  },
  disabled: { opacity: 0.45 },
  backButton: { marginTop: 6 },
});
