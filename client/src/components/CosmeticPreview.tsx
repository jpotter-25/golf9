import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Coins, Eye, Lock, ShoppingBag, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type * as api from '../services/api';
import {
  getTableThemeVisual,
  type EquippedCosmetics,
} from '../theme/cosmetics';
import { gradients, ui } from '../ui/theme';
import { AvatarCluster } from './AvatarDecorations';
import { CardBackArtwork, TableSurfaceDecoration } from './CosmeticArt';

type Equipped = api.PlayerInventory['equipped'];

type PreviewIdentity = {
  name: string;
  initial: string;
};

type PreviewProps = {
  item: api.CosmeticItem | null;
  equipped?: Equipped | null;
  identity: PreviewIdentity;
  coinBalance?: number;
  busy?: boolean;
  onClose: () => void;
  onEquip?: (item: api.CosmeticItem) => void;
  onPurchase?: (item: api.CosmeticItem) => void;
};

export function previewCosmetics(equipped: EquippedCosmetics | null | undefined, item: api.CosmeticItem): EquippedCosmetics {
  return { ...(equipped ?? {}), [item.type]: item.id };
}

export function CosmeticThumbnail({
  item,
  equipped,
  identity,
}: {
  item: api.CosmeticItem;
  equipped?: Equipped | null;
  identity: PreviewIdentity;
}) {
  return (
    <View pointerEvents="none" style={styles.thumbnail}>
      <CosmeticArtwork item={item} equipped={equipped} identity={identity} compact />
    </View>
  );
}

export function CosmeticPreviewModal({
  item,
  equipped,
  identity,
  coinBalance = 0,
  busy = false,
  onClose,
  onEquip,
  onPurchase,
}: PreviewProps) {
  const insets = useSafeAreaInsets();
  if (!item) return null;

  const owned = item.owned;
  const locked = !owned && !item.eligible;
  const shortfall = Math.max(0, item.price - coinBalance);
  const actionLabel = owned
    ? item.equipped
      ? 'Equipped'
      : 'Equip now'
    : locked
      ? 'Locked'
      : item.canAfford
        ? `Buy for ${item.price} coins`
        : `${shortfall} more coins needed`;
  const actionDisabled = busy
    || item.equipped
    || locked
    || (!owned && !item.canAfford)
    || (owned ? !onEquip : !onPurchase);
  const ActionIcon = owned ? Check : locked ? Lock : item.canAfford ? ShoppingBag : Coins;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismissLayer} onPress={onClose} accessibilityLabel="Close cosmetic preview" />
        <LinearGradient
          colors={gradients.panel}
          style={[styles.sheet, { paddingBottom: Math.max(16, insets.bottom + 10) }]}
        >
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderCopy}>
              <View style={styles.previewEyebrowRow}>
                <Eye size={14} color={ui.palette.emerald} strokeWidth={2.8} />
                <Text style={styles.previewEyebrow}>Live preview</Text>
              </View>
              <Text style={styles.sheetTitle} numberOfLines={1}>{item.name}</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close preview"
            >
              <X size={22} color={ui.text.primary} strokeWidth={3} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetBody}
            showsVerticalScrollIndicator={false}
          >
            <CosmeticArtwork item={item} equipped={equipped} identity={identity} />

            <View style={styles.detailRow}>
              <View style={[styles.detailChip, rarityStyle(item.rarity)]}>
                <Text style={styles.detailChipText}>{item.rarity.toUpperCase()}</Text>
              </View>
              <View style={styles.detailChip}>
                <Text style={styles.detailChipText}>{sourceLabel(item.shopCategory)}</Text>
              </View>
              {item.requiredLevel ? (
                <View style={styles.detailChip}>
                  <Text style={styles.detailChipText}>LEVEL {item.requiredLevel}</Text>
                </View>
              ) : null}
              {item.owned ? (
                <View style={[styles.detailChip, styles.ownedChip]}>
                  <Text style={styles.ownedChipText}>{item.equipped ? 'IN USE' : 'OWNED'}</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.description}>{item.description}</Text>
            {locked ? (
              <View style={styles.lockNotice}>
                <Lock size={17} color={ui.text.muted} strokeWidth={2.7} />
                <Text style={styles.lockNoticeText}>{item.lockedReason ?? 'This cosmetic is not available yet.'}</Text>
              </View>
            ) : null}

            <Text style={styles.previewNote}>Previewing does not change your current loadout.</Text>
            <Pressable
              style={({ pressed }) => [
                styles.primaryAction,
                owned && styles.primaryActionOwned,
                (locked || (!owned && !item.canAfford)) && styles.primaryActionMuted,
                actionDisabled && styles.actionDisabled,
                pressed && !actionDisabled && styles.primaryActionPressed,
              ]}
              disabled={actionDisabled}
              onPress={() => (owned ? onEquip?.(item) : onPurchase?.(item))}
              accessibilityRole="button"
              accessibilityLabel={actionLabel}
            >
              <ActionIcon size={19} color={ui.text.inverse} strokeWidth={2.9} />
              <Text style={styles.primaryActionText}>{busy ? 'Working...' : actionLabel}</Text>
            </Pressable>
          </ScrollView>
        </LinearGradient>
      </View>
    </Modal>
  );
}

function CosmeticArtwork({
  item,
  equipped,
  identity,
  compact = false,
}: {
  item: api.CosmeticItem;
  equipped?: Equipped | null;
  identity: PreviewIdentity;
  compact?: boolean;
}) {
  const preview = previewCosmetics(equipped, item);
  const table = getTableThemeVisual(preview.tableTheme);
  const isTablePreview = item.type === 'tableTheme' || item.type === 'cardBack';

  if (isTablePreview) {
    return (
      <View
        style={[
          styles.tablePreview,
          compact && styles.tablePreviewCompact,
          { backgroundColor: table.backgroundColor, borderColor: table.borderColor },
        ]}
      >
        <TableSurfaceDecoration visual={table} />
        <View style={[styles.tableHeader, compact && styles.tableHeaderCompact, { backgroundColor: table.headerColor }]}>
          <View style={[styles.tableHeaderDot, { backgroundColor: table.accentColor }]} />
          {!compact ? <Text style={[styles.tableHeaderText, { color: table.accentColor }]}>MATCH TABLE</Text> : null}
        </View>
        <View style={styles.tableCenter}>
          <View style={[styles.previewCardRow, compact && styles.previewCardRowCompact]}>
            {[0, 1, 2].map(index => (
              <View
                key={index}
                style={[
                  styles.previewCard,
                  compact && styles.previewCardCompact,
                ]}
              >
                <CardBackArtwork cardBackId={preview.cardBack} />
              </View>
            ))}
          </View>
          {!compact ? (
            <View style={[styles.tablePlayerPlate, { backgroundColor: table.panelColor, borderColor: table.accentColor }]}>
              <AvatarCluster cosmetics={preview} fallbackInitial={identity.initial} size={46} mode="self" showAccessory />
              <View style={styles.tablePlayerCopy}>
                <Text style={styles.tablePlayerName} numberOfLines={1}>{identity.name}</Text>
                <Text style={[styles.tablePlayerTitle, { color: table.accentColor }]} numberOfLines={1}>
                  {item.type === 'title' ? item.name : formatCosmeticName(preview.title)}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.identityPreview,
        compact && styles.identityPreviewCompact,
        { backgroundColor: table.panelColor, borderColor: table.borderColor },
      ]}
    >
      <View style={[styles.identityGlow, { backgroundColor: table.accentColor }]} />
      <AvatarCluster
        cosmetics={preview}
        fallbackInitial={identity.initial}
        size={compact ? 50 : 92}
        mode="self"
        showAccessory
      />
      {!compact ? (
        <>
          <Text style={styles.identityName} numberOfLines={1}>{identity.name}</Text>
          <View style={[styles.titlePlate, { borderColor: table.accentColor }]}>
            <Text style={[styles.identityTitle, { color: table.accentColor }]} numberOfLines={1}>
              {item.type === 'title' ? item.name : formatCosmeticName(preview.title)}
            </Text>
          </View>
          <Text style={styles.identityContext}>
            {item.type === 'title' ? 'Shown beneath your player name' : 'Shown on your profile and at the table'}
          </Text>
        </>
      ) : item.type === 'title' ? (
        <Text style={[styles.thumbnailTitle, { color: table.accentColor }]} numberOfLines={1}>{item.name}</Text>
      ) : null}
    </View>
  );
}

function rarityStyle(rarity: api.CosmeticItem['rarity']) {
  if (rarity === 'legendary') return { borderColor: ui.palette.gold, backgroundColor: 'rgba(244, 201, 93, 0.18)' };
  if (rarity === 'epic') return { borderColor: ui.palette.violet, backgroundColor: 'rgba(183, 154, 247, 0.15)' };
  if (rarity === 'rare') return { borderColor: ui.palette.sky, backgroundColor: 'rgba(103, 183, 255, 0.15)' };
  return { borderColor: ui.border.strong, backgroundColor: 'rgba(169, 185, 205, 0.12)' };
}

function sourceLabel(source: string) {
  if (source === 'starter') return 'STARTER';
  if (source === 'ranked') return 'RANKED';
  if (source === 'club') return 'CLUB';
  if (source === 'event') return 'EVENT';
  return 'COIN SHOP';
}

function formatCosmeticName(value?: string | null) {
  if (!value) return 'Rookie';
  return value
    .replace(/-(title|avatar-icon|avatar-frame|accessory|table-theme|card-back)$/i, '')
    .split('-')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const styles = StyleSheet.create({
  thumbnail: { width: '100%' },
  backdrop: { flex: 1, backgroundColor: 'rgba(3, 7, 17, 0.78)', justifyContent: 'flex-end' },
  dismissLayer: { flex: 1 },
  sheet: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '91%',
    alignSelf: 'center',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: ui.border.strong,
    overflow: 'hidden',
  },
  sheetHeader: {
    minHeight: 78,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: ui.border.soft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sheetHeaderCopy: { flex: 1, minWidth: 0 },
  previewEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  previewEyebrow: { color: ui.palette.emerald, fontSize: 11, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' },
  sheetTitle: { color: ui.text.primary, fontSize: 24, fontWeight: '900', marginTop: 4 },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ui.border.soft,
    backgroundColor: 'rgba(247, 250, 252, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.76 },
  sheetScroll: { flexGrow: 0 },
  sheetBody: { padding: 18, gap: 14 },
  tablePreview: {
    height: 270,
    borderRadius: 18,
    borderWidth: 2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  tablePreviewCompact: { height: 82, borderRadius: 12, borderWidth: 1.5 },
  tableHeader: { height: 42, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  tableHeaderCompact: { height: 16, paddingHorizontal: 7 },
  tableHeaderDot: { width: 7, height: 7, borderRadius: 4 },
  tableHeaderText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  tableCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 12, gap: 18 },
  previewCardRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  previewCardRowCompact: { gap: 4 },
  previewCard: { width: 48, height: 68, borderRadius: 7, overflow: 'hidden', transform: [{ rotate: '-2deg' }] },
  previewCardCompact: { width: 25, height: 36, borderRadius: 4 },
  tablePlayerPlate: { minWidth: 190, maxWidth: '86%', minHeight: 62, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  tablePlayerCopy: { flex: 1, minWidth: 0 },
  tablePlayerName: { color: ui.text.primary, fontSize: 14, fontWeight: '900' },
  tablePlayerTitle: { fontSize: 11, fontWeight: '900', marginTop: 3 },
  identityPreview: {
    height: 270,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 18,
  },
  identityPreviewCompact: { height: 82, borderRadius: 12, borderWidth: 1.5, padding: 4 },
  identityGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, opacity: 0.1 },
  identityName: { color: ui.text.primary, fontSize: 20, fontWeight: '900', marginTop: 12 },
  titlePlate: { minHeight: 31, maxWidth: '88%', borderRadius: 16, borderWidth: 1, backgroundColor: 'rgba(20, 32, 54, 0.62)', justifyContent: 'center', paddingHorizontal: 14, marginTop: 6 },
  identityTitle: { fontSize: 12, fontWeight: '900', textAlign: 'center' },
  identityContext: { color: ui.text.secondary, fontSize: 11, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  thumbnailTitle: { maxWidth: '92%', fontSize: 9, fontWeight: '900', marginTop: 4, textAlign: 'center' },
  detailRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  detailChip: { minHeight: 27, borderRadius: 14, borderWidth: 1, borderColor: ui.border.strong, backgroundColor: 'rgba(169, 185, 205, 0.12)', justifyContent: 'center', paddingHorizontal: 10 },
  detailChipText: { color: ui.text.primary, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  ownedChip: { borderColor: ui.palette.emerald, backgroundColor: 'rgba(103, 224, 176, 0.15)' },
  ownedChipText: { color: ui.palette.emerald, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  description: { color: ui.text.secondary, fontSize: 14, fontWeight: '700', lineHeight: 21 },
  lockNotice: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: ui.border.soft, backgroundColor: 'rgba(169, 185, 205, 0.08)', padding: 11, flexDirection: 'row', alignItems: 'center', gap: 9 },
  lockNoticeText: { flex: 1, color: ui.text.muted, fontSize: 12, fontWeight: '800', lineHeight: 17 },
  previewNote: { color: ui.text.muted, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  primaryAction: { minHeight: 52, borderRadius: 14, backgroundColor: ui.palette.gold, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 14 },
  primaryActionOwned: { backgroundColor: ui.palette.emerald },
  primaryActionMuted: { backgroundColor: ui.border.strong },
  primaryActionPressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
  primaryActionText: { color: ui.text.inverse, fontSize: 15, fontWeight: '900', textAlign: 'center' },
  actionDisabled: { opacity: 0.58 },
});
