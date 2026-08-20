import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  archiveDraftCatalogItem,
  catalogAssetRequirements,
  draftCatalog,
  duplicateDraftCatalogItem,
  liveCatalog,
  normalizeCatalogStore,
  publishCatalog,
  rollbackCatalog,
  saveDraftCatalogItem,
  seedCatalogStore,
  uploadCatalogAsset,
} from '../catalog.js';
import { normalizeUserProgression, publicCosmeticCatalog, purchaseCosmetic } from '../progression.js';

function user(overrides = {}) {
  return {
    userId: 'catalog-user',
    displayName: 'CatalogUser',
    salt: 'unused',
    passwordHash: 'unused',
    progression: { totalXp: 3000 },
    ...overrides,
  };
}

function fakePngBase64(width, height, bytes = 64) {
  const png = Buffer.alloc(Math.max(24, bytes));
  png[0] = 0x89;
  png.write('PNG', 1, 'ascii');
  png[4] = 0x0d;
  png[5] = 0x0a;
  png[6] = 0x1a;
  png[7] = 0x0a;
  png.writeUInt32BE(width, 16);
  png.writeUInt32BE(height, 20);
  return png.toString('base64');
}

test('catalog store seeds legacy cosmetics into live and draft records', () => {
  const store = normalizeCatalogStore({});
  const changed = seedCatalogStore(store);

  assert.equal(changed, true);
  assert.ok(liveCatalog(store).find(item => item.id === 'classic-card-back'));
  assert.ok(draftCatalog(store).find(item => item.id === 'gold-trim-card-back'));
});

test('draft catalog edits do not affect purchases until published', () => {
  const store = normalizeCatalogStore({});
  seedCatalogStore(store);
  const account = user({ currency: { coins: 1000, lifetimeCoins: 1000 } });
  normalizeUserProgression(account);

  saveDraftCatalogItem(store, { id: 'gold-trim-card-back', price: 900, sale: true, salePrice: 300 });
  const draftItem = draftCatalog(store).find(item => item.id === 'gold-trim-card-back');
  const liveItem = liveCatalog(store).find(item => item.id === 'gold-trim-card-back');
  assert.equal(draftItem.price, 900);
  assert.equal(liveItem.price, 650);

  const purchasedBeforePublish = purchaseCosmetic(account, 'gold-trim-card-back', null, liveCatalog(store));
  assert.equal(purchasedBeforePublish.error, undefined);
  assert.equal(account.currency.coins, 350);
});

test('published sale price changes public catalog and purchase cost', () => {
  const store = normalizeCatalogStore({});
  seedCatalogStore(store);
  saveDraftCatalogItem(store, { id: 'gold-trim-card-back', price: 900, sale: true, salePrice: 300 });
  publishCatalog(store, 'tester');

  const account = user({ currency: { coins: 1000, lifetimeCoins: 1000 } });
  normalizeUserProgression(account);
  const catalogItem = publicCosmeticCatalog(account, null, liveCatalog(store)).find(item => item.id === 'gold-trim-card-back');
  assert.equal(catalogItem.onSale, true);
  assert.equal(catalogItem.effectivePrice, 300);

  const purchased = purchaseCosmetic(account, 'gold-trim-card-back', null, liveCatalog(store));
  assert.equal(purchased.error, undefined);
  assert.equal(account.currency.coins, 700);
});

test('disabled archived cosmetics cannot be purchased but existing ownership remains visible', () => {
  const store = normalizeCatalogStore({});
  seedCatalogStore(store);
  saveDraftCatalogItem(store, { id: 'gold-trim-card-back', enabled: false });
  archiveDraftCatalogItem(store, 'gold-trim-card-back');
  publishCatalog(store, 'tester');

  const locked = user({ currency: { coins: 1000, lifetimeCoins: 1000 } });
  normalizeUserProgression(locked);
  const rejected = purchaseCosmetic(locked, 'gold-trim-card-back', null, liveCatalog(store));
  assert.equal(rejected.error, 'This cosmetic is not currently available.');

  const owner = user({
    inventory: { cosmetics: ['classic-card-back', 'gold-trim-card-back'], equipped: { cardBack: 'gold-trim-card-back' } },
  });
  normalizeUserProgression(owner);
  const ownedItem = publicCosmeticCatalog(owner, null, liveCatalog(store)).find(item => item.id === 'gold-trim-card-back');
  assert.equal(ownedItem.owned, true);
});

test('catalog versions can roll a draft back to a previous live snapshot', () => {
  const store = normalizeCatalogStore({});
  seedCatalogStore(store);
  publishCatalog(store, 'tester');
  const versionId = store.versions[0].versionId;
  saveDraftCatalogItem(store, { id: 'gold-trim-card-back', name: 'Changed Name' });

  const rollback = rollbackCatalog(store, versionId);
  assert.equal(rollback.error, undefined);
  assert.equal(draftCatalog(store).find(item => item.id === 'gold-trim-card-back').name, 'Gilded Flourish');
});

test('catalog items can be duplicated safely as disabled draft copies', () => {
  const store = normalizeCatalogStore({});
  seedCatalogStore(store);
  const result = duplicateDraftCatalogItem(store, 'gold-trim-card-back');

  assert.equal(result.error, undefined);
  assert.match(result.item.id, /^gold-trim-card-back-copy/);
  assert.equal(result.item.enabled, false);
});

test('catalog seed migrates untouched coin cosmetics into the paced level curve', () => {
  const legacyItem = {
    id: 'gold-trim-card-back',
    type: 'cardBack',
    name: 'Gold Trim',
    description: 'A clean gold-edged card back.',
    rarity: 'rare',
    price: 350,
    shopCategory: 'coin',
  };
  const store = normalizeCatalogStore({ live: [legacyItem], draft: [legacyItem] });
  seedCatalogStore(store);

  const migrated = liveCatalog(store).find(item => item.id === 'gold-trim-card-back');
  assert.equal(migrated.name, 'Gilded Flourish');
  assert.equal(migrated.price, 650);
  assert.equal(migrated.unlockRequirement, 'level');
  assert.equal(migrated.requiredLevel, 4);
});

test('catalog asset requirements expose exact upload constraints', () => {
  const requirements = catalogAssetRequirements();

  assert.equal(requirements.avatarIcon.width, 512);
  assert.equal(requirements.avatarIcon.height, 512);
  assert.equal(requirements.avatarIcon.maxBytes, 2 * 1024 * 1024);
  assert.deepEqual(requirements.cardBack.mimeTypes, ['image/png', 'image/webp']);
  assert.equal(requirements.tableTheme.width, 1024);
});

test('catalog asset uploads validate dimensions and metadata before saving', () => {
  const store = normalizeCatalogStore({});
  seedCatalogStore(store);
  const uploadRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'golf9-catalog-assets-'));

  const uploaded = uploadCatalogAsset(store, uploadRoot, '/uploads/catalog', 'classic-card-back', {
    mimeType: 'image/png',
    originalName: 'card-back.png',
    data: fakePngBase64(512, 768),
  });
  assert.equal(uploaded.error, undefined);
  assert.equal(uploaded.asset.width, 512);
  assert.equal(uploaded.asset.height, 768);
  assert.equal(uploaded.asset.mimeType, 'image/png');
  assert.match(uploaded.asset.url, /\/uploads\/catalog\/classic-card-back\/asset-[0-9a-f-]+\.png$/);

  const rejected = uploadCatalogAsset(store, uploadRoot, '/uploads/catalog', 'classic-card-back', {
    mimeType: 'image/png',
    originalName: 'too-small.png',
    data: fakePngBase64(512, 512),
  });
  assert.match(rejected.error, /exactly 512x768px/);
});
