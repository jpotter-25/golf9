import assert from 'node:assert/strict';
import test from 'node:test';
import {
  archiveDraftCatalogItem,
  draftCatalog,
  duplicateDraftCatalogItem,
  liveCatalog,
  normalizeCatalogStore,
  publishCatalog,
  rollbackCatalog,
  saveDraftCatalogItem,
  seedCatalogStore,
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
