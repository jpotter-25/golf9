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
  assert.equal(liveItem.price, 350);

  const purchasedBeforePublish = purchaseCosmetic(account, 'gold-trim-card-back', null, liveCatalog(store));
  assert.equal(purchasedBeforePublish.error, undefined);
  assert.equal(account.currency.coins, 650);
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
  assert.equal(draftCatalog(store).find(item => item.id === 'gold-trim-card-back').name, 'Gold Trim');
});

test('catalog items can be duplicated safely as disabled draft copies', () => {
  const store = normalizeCatalogStore({});
  seedCatalogStore(store);
  const result = duplicateDraftCatalogItem(store, 'gold-trim-card-back');

  assert.equal(result.error, undefined);
  assert.match(result.item.id, /^gold-trim-card-back-copy/);
  assert.equal(result.item.enabled, false);
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
  assert.match(uploaded.asset.url, /\/uploads\/catalog\/classic-card-back\/preview-/);

  const rejected = uploadCatalogAsset(store, uploadRoot, '/uploads/catalog', 'classic-card-back', {
    mimeType: 'image/png',
    originalName: 'too-small.png',
    data: fakePngBase64(512, 512),
  });
  assert.match(rejected.error, /exactly 512x768px/);
});
