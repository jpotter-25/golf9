import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { COSMETIC_CATALOG } from './progression.js';

const MAX_ASSET_BYTES = 2 * 1024 * 1024;
const VALID_TYPES = new Set(['cardBack', 'avatarFrame', 'avatarIcon', 'avatarAccessory', 'title', 'tableTheme']);
const VALID_CATEGORIES = new Set(['starter', 'coin', 'ranked', 'club', 'event']);
const VALID_RARITIES = new Set(['starter', 'common', 'rare', 'epic', 'legendary']);
const VALID_UNLOCKS = new Set(['none', 'level', 'achievement', 'rank', 'club', 'event', 'season']);
const IMAGE_MIME_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

function now() {
  return Date.now();
}

function cleanText(value, max = 120) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanId(value) {
  return cleanText(value, 80).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeVisual(input = {}, type = 'cardBack') {
  const visual = input && typeof input === 'object' ? input : {};
  const result = {};
  for (const key of ['backgroundColor', 'borderColor', 'accentColor', 'textColor', 'mark', 'icon', 'pattern', 'feltColor', 'railColor']) {
    if (visual[key] !== undefined) result[key] = cleanText(visual[key], key === 'mark' ? 8 : 32);
  }
  result.kind = cleanText(visual.kind || 'preset', 24);
  result.type = type;
  return result;
}

export function normalizeCatalogItem(input = {}, fallback = null, createdAt = now()) {
  const id = cleanId(input.id || fallback?.id || crypto.randomUUID());
  const type = VALID_TYPES.has(input.type) ? input.type : VALID_TYPES.has(fallback?.type) ? fallback.type : 'cardBack';
  const unlockRequirement = cleanText(input.unlockRequirement ?? fallback?.unlockRequirement ?? 'none', 24);
  const saleStartsAt = numberOrNull(input.saleStartsAt ?? fallback?.saleStartsAt);
  const saleEndsAt = numberOrNull(input.saleEndsAt ?? fallback?.saleEndsAt);
  return {
    id,
    type,
    name: cleanText(input.name ?? fallback?.name ?? id, 48) || id,
    description: cleanText(input.description ?? fallback?.description ?? '', 220),
    rarity: VALID_RARITIES.has(input.rarity) ? input.rarity : VALID_RARITIES.has(fallback?.rarity) ? fallback.rarity : 'common',
    price: Math.max(0, Math.floor(Number(input.price ?? fallback?.price ?? 0) || 0)),
    shopCategory: VALID_CATEGORIES.has(input.shopCategory) ? input.shopCategory : VALID_CATEGORIES.has(fallback?.shopCategory) ? fallback.shopCategory : 'coin',
    unlockRequirement: VALID_UNLOCKS.has(unlockRequirement) && unlockRequirement !== 'none' ? unlockRequirement : null,
    requiredMmr: numberOrNull(input.requiredMmr ?? fallback?.requiredMmr),
    requiredLeague: cleanText(input.requiredLeague ?? fallback?.requiredLeague ?? '', 32) || null,
    seasonId: cleanText(input.seasonId ?? fallback?.seasonId ?? '', 48) || null,
    sale: Boolean(input.sale ?? fallback?.sale ?? false),
    salePrice: Math.max(0, Math.floor(Number(input.salePrice ?? fallback?.salePrice ?? input.price ?? fallback?.price ?? 0) || 0)),
    saleStartsAt,
    saleEndsAt,
    enabled: input.enabled !== undefined ? Boolean(input.enabled) : fallback?.enabled !== undefined ? Boolean(fallback.enabled) : true,
    featured: Boolean(input.featured ?? fallback?.featured ?? false),
    sortOrder: Math.floor(Number(input.sortOrder ?? fallback?.sortOrder ?? 0) || 0),
    visual: normalizeVisual(input.visual ?? fallback?.visual, type),
    asset: input.asset && typeof input.asset === 'object' ? {
      url: cleanText(input.asset.url, 240),
      mimeType: cleanText(input.asset.mimeType, 80),
      originalName: cleanText(input.asset.originalName, 120),
      uploadedAt: Number(input.asset.uploadedAt) || createdAt,
    } : fallback?.asset || null,
    createdAt: Number(input.createdAt ?? fallback?.createdAt ?? createdAt) || createdAt,
    updatedAt: Number(input.updatedAt ?? fallback?.updatedAt ?? createdAt) || createdAt,
    archivedAt: Number(input.archivedAt ?? fallback?.archivedAt ?? 0) || null,
  };
}

export function normalizeCatalogStore(store = {}) {
  store.live = Array.isArray(store.live) ? store.live : [];
  store.draft = Array.isArray(store.draft) ? store.draft : [];
  store.versions = Array.isArray(store.versions) ? store.versions.slice(-30) : [];
  store.live = store.live.map(item => normalizeCatalogItem(item)).filter(item => item.id);
  store.draft = store.draft.map(item => normalizeCatalogItem(item)).filter(item => item.id);
  return store;
}

export function seedCatalogStore(store) {
  normalizeCatalogStore(store);
  let changed = false;
  const seed = COSMETIC_CATALOG.map((item, index) => normalizeCatalogItem({ ...item, sortOrder: index }));
  for (const seedItem of seed) {
    if (!store.live.some(item => item.id === seedItem.id)) {
      store.live.push(seedItem);
      changed = true;
    }
    if (!store.draft.some(item => item.id === seedItem.id)) {
      store.draft.push({ ...seedItem });
      changed = true;
    }
  }
  store.live.sort(compareCatalogItems);
  store.draft.sort(compareCatalogItems);
  return changed;
}

export function liveCatalog(store) {
  normalizeCatalogStore(store);
  return store.live.slice().sort(compareCatalogItems);
}

export function draftCatalog(store) {
  normalizeCatalogStore(store);
  return store.draft.slice().sort(compareCatalogItems);
}

export function compareCatalogItems(a, b) {
  return (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0) || a.name.localeCompare(b.name);
}

export function effectiveCatalogPrice(item, timestamp = now()) {
  const basePrice = Math.max(0, Math.floor(Number(item?.price) || 0));
  const salePrice = Math.max(0, Math.floor(Number(item?.salePrice) || 0));
  const startsOk = !item?.saleStartsAt || timestamp >= Number(item.saleStartsAt);
  const endsOk = !item?.saleEndsAt || timestamp <= Number(item.saleEndsAt);
  const onSale = Boolean(item?.sale) && salePrice < basePrice && startsOk && endsOk;
  return {
    basePrice,
    salePrice: onSale ? salePrice : null,
    effectivePrice: onSale ? salePrice : basePrice,
    onSale,
  };
}

export function saveDraftCatalogItem(store, patch) {
  normalizeCatalogStore(store);
  const timestamp = now();
  const id = cleanId(patch.id);
  if (!id) return { error: 'Catalog item id is required.' };
  const existing = store.draft.find(item => item.id === id) || store.live.find(item => item.id === id) || null;
  const item = normalizeCatalogItem({ ...existing, ...patch, id, updatedAt: timestamp }, existing, timestamp);
  const index = store.draft.findIndex(entry => entry.id === id);
  if (index >= 0) store.draft[index] = item;
  else store.draft.push(item);
  store.draft.sort(compareCatalogItems);
  return { item };
}

export function duplicateDraftCatalogItem(store, id) {
  normalizeCatalogStore(store);
  const source = store.draft.find(item => item.id === id) || store.live.find(item => item.id === id);
  if (!source) return { error: 'Catalog item not found.' };
  let nextId = `${source.id}-copy`;
  let suffix = 2;
  while (store.draft.some(item => item.id === nextId) || store.live.some(item => item.id === nextId)) {
    nextId = `${source.id}-copy-${suffix}`;
    suffix += 1;
  }
  return saveDraftCatalogItem(store, {
    ...source,
    id: nextId,
    name: `${source.name} Copy`,
    enabled: false,
    archivedAt: null,
  });
}

export function archiveDraftCatalogItem(store, id) {
  normalizeCatalogStore(store);
  const index = store.draft.findIndex(item => item.id === id);
  if (index < 0) return { error: 'Catalog item not found.' };
  store.draft[index].archivedAt = now();
  store.draft[index].enabled = false;
  store.draft[index].updatedAt = now();
  return { item: store.draft[index] };
}

export function publishCatalog(store, adminName = 'admin') {
  normalizeCatalogStore(store);
  const timestamp = now();
  const previous = store.live.map(item => ({ ...item }));
  store.versions.push({
    versionId: crypto.randomUUID(),
    createdAt: timestamp,
    createdBy: adminName,
    items: previous,
  });
  if (store.versions.length > 30) store.versions.splice(0, store.versions.length - 30);
  store.live = store.draft.map(item => normalizeCatalogItem({ ...item, updatedAt: timestamp }, item, timestamp)).sort(compareCatalogItems);
  return { cosmetics: liveCatalog(store), version: store.versions.at(-1) };
}

export function rollbackCatalog(store, versionId) {
  normalizeCatalogStore(store);
  const version = store.versions.find(item => item.versionId === versionId);
  if (!version) return { error: 'Catalog version not found.' };
  store.draft = version.items.map(item => normalizeCatalogItem({ ...item, updatedAt: now() }, item));
  return { cosmetics: draftCatalog(store), version };
}

export function uploadCatalogAsset(store, uploadRoot, publicBaseUrl, cosmeticId, payload = {}) {
  normalizeCatalogStore(store);
  const item = store.draft.find(entry => entry.id === cosmeticId);
  if (!item) return { error: 'Catalog item not found.' };
  const mimeType = cleanText(payload.mimeType, 80);
  const ext = IMAGE_MIME_EXT[mimeType];
  if (!ext) return { error: 'Asset must be a PNG, JPEG, or WebP image.' };
  const base64 = String(payload.data || '').replace(/^data:[^;]+;base64,/, '');
  let bytes;
  try {
    bytes = Buffer.from(base64, 'base64');
  } catch {
    return { error: 'Asset data is not valid base64.' };
  }
  if (!bytes.length || bytes.length > MAX_ASSET_BYTES) return { error: 'Asset must be between 1 byte and 2 MB.' };
  const safeId = cleanId(cosmeticId);
  const dir = path.join(uploadRoot, safeId);
  fs.mkdirSync(dir, { recursive: true });
  const fileName = `preview-${Date.now()}.${ext}`;
  const absolutePath = path.join(dir, fileName);
  fs.writeFileSync(absolutePath, bytes);
  item.asset = {
    url: `${publicBaseUrl}/${safeId}/${fileName}`,
    mimeType,
    originalName: cleanText(payload.originalName || fileName, 120),
    uploadedAt: now(),
  };
  item.updatedAt = now();
  return { item, asset: item.asset };
}
