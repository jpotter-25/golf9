import assert from 'node:assert/strict';
import test from 'node:test';
import { PostgresStore } from '../postgresStore.js';

test('postgres store loads and saves economy config metadata', async () => {
  const savedQueries = [];
  const client = {
    query: async (sql, params = []) => {
      savedQueries.push({ sql, params });
      return { rows: [] };
    },
    release() {},
  };
  const pool = {
    query: async sql => {
      if (/SELECT key, value FROM golf9_meta/.test(sql)) {
        return {
          rows: [
            { key: 'rankedSeason', value: { id: 'season-one' } },
            { key: 'competitiveConfig', value: { live: { placementMatchesRequired: 5 } } },
            { key: 'economyConfig', value: { wagerTables: [{ id: 'wager-50000', buyIn: 50000 }] } },
            { key: 'notificationConfig', value: { enabled: true, types: { turn: { title: 'Turn ready' } } } },
            { key: 'afkConfig', value: { takeoverMisses: 2, coinPenalty: 100 } },
            { key: 'forfeitConfig', value: { rankedRollingWindowHours: 48, rankedRollingLockMinutes: [30, 240] } },
            { key: 'releasePolicy', value: { revision: 3, entries: { 'playtest.android': { latestBuild: 43 } } } },
            { key: 'earlyAccessConfig', value: { enrollmentStatus: 'paused' } },
          ],
        };
      }
      if (/SELECT data FROM golf9_early_access_signups/.test(sql)) return { rows: [{ data: { signupId: 'signup-1', emailHash: 'hash-1' } }] };
      if (/SELECT data FROM golf9_early_access_campaigns/.test(sql)) return { rows: [{ data: { campaignId: 'campaign-1', status: 'draft' } }] };
      if (/SELECT data FROM golf9_early_access_deliveries/.test(sql)) return { rows: [{ data: { deliveryId: 'delivery-1', campaignId: 'campaign-1', signupId: 'signup-1' } }] };
      return { rows: [] };
    },
    connect: async () => client,
  };
  const store = new PostgresStore(pool);

  const loaded = await store.load();
  assert.equal(loaded.economyConfig.wagerTables[0].buyIn, 50000);
  assert.equal(loaded.notificationConfig.types.turn.title, 'Turn ready');
  assert.equal(loaded.afkConfig.takeoverMisses, 2);
  assert.deepEqual(loaded.forfeitConfig.rankedRollingLockMinutes, [30, 240]);
  assert.equal(loaded.releasePolicy.entries['playtest.android'].latestBuild, 43);
  assert.equal(loaded.earlyAccessConfig.enrollmentStatus, 'paused');
  assert.equal(loaded.earlyAccessSignups[0].signupId, 'signup-1');
  assert.equal(loaded.earlyAccessCampaigns[0].campaignId, 'campaign-1');
  assert.equal(loaded.earlyAccessDeliveries[0].deliveryId, 'delivery-1');

  await store.save({
    rankedSeason: { id: 'season-two' },
    competitiveConfig: { live: { placementMatchesRequired: 7 } },
    economyConfig: { wagerTables: [{ id: 'wager-25000', buyIn: 25000 }] },
    notificationConfig: { enabled: false },
    afkConfig: { takeoverMisses: 3, coinPenalty: 250 },
    forfeitConfig: { rankedRollingWindowHours: 12, rankedRollingLockMinutes: [10, 60] },
    releasePolicy: { revision: 4, entries: { 'playtest.android': { latestBuild: 44 } } },
    earlyAccessConfig: { enrollmentStatus: 'open' },
    earlyAccessSignups: [{ signupId: 'signup-2', emailHash: 'hash-2' }],
    earlyAccessCampaigns: [{ campaignId: 'campaign-2', status: 'draft' }],
    earlyAccessDeliveries: [{ deliveryId: 'delivery-2', campaignId: 'campaign-2', signupId: 'signup-2' }],
  });

  const economySave = savedQueries.find(query => query.params[0] === 'economyConfig');
  assert.ok(economySave);
  assert.equal(JSON.parse(economySave.params[1]).wagerTables[0].buyIn, 25000);
  const notificationSave = savedQueries.find(query => query.params[0] === 'notificationConfig');
  assert.ok(notificationSave);
  assert.equal(JSON.parse(notificationSave.params[1]).enabled, false);
  const afkSave = savedQueries.find(query => query.params[0] === 'afkConfig');
  assert.ok(afkSave);
  assert.equal(JSON.parse(afkSave.params[1]).coinPenalty, 250);
  const forfeitSave = savedQueries.find(query => query.params[0] === 'forfeitConfig');
  assert.ok(forfeitSave);
  assert.deepEqual(JSON.parse(forfeitSave.params[1]).rankedRollingLockMinutes, [10, 60]);
  const releasePolicySave = savedQueries.find(query => query.params[0] === 'releasePolicy');
  assert.ok(releasePolicySave);
  assert.equal(JSON.parse(releasePolicySave.params[1]).entries['playtest.android'].latestBuild, 44);
  const earlyAccessConfigSave = savedQueries.find(query => query.params[0] === 'earlyAccessConfig');
  assert.ok(earlyAccessConfigSave);
  assert.equal(JSON.parse(earlyAccessConfigSave.params[1]).enrollmentStatus, 'open');
  assert.ok(savedQueries.some(query => query.params[0] === 'hash-2'));
  assert.ok(savedQueries.some(query => query.params[0] === 'campaign-2'));
  assert.ok(savedQueries.some(query => query.params[0] === 'delivery-2'));
});

test('postgres delivery claims use row locking and return campaign context', async () => {
  const queries = [];
  const client = {
    async query(sql, params = []) {
      queries.push({ sql, params });
      if (/SELECT delivery_id, data/.test(sql)) {
        return {
          rows: [{
            delivery_id: 'delivery-1',
            data: {
              deliveryId: 'delivery-1',
              campaignId: 'campaign-1',
              signupId: 'signup-1',
              status: 'queued',
              attempts: 1,
              nextAttemptAt: 100,
              updatedAt: 100,
            },
          }],
        };
      }
      if (/SELECT data FROM golf9_early_access_campaigns/.test(sql)) return { rows: [{ data: { campaignId: 'campaign-1', status: 'scheduled' } }] };
      if (/SELECT data FROM golf9_early_access_signups/.test(sql)) return { rows: [{ data: { signupId: 'signup-1', emailHash: 'hash-1', consentStatus: 'confirmed' } }] };
      return { rows: [] };
    },
    release() {},
  };
  const pool = {
    query: async () => ({ rows: [] }),
    connect: async () => client,
  };
  const store = new PostgresStore(pool);
  const claimed = await store.claimEarlyAccessDelivery({ now: 1_000, leaseMs: 5_000 });
  assert.equal(claimed.delivery.status, 'sending');
  assert.equal(claimed.delivery.attempts, 2);
  assert.equal(claimed.delivery.leaseExpiresAt, 6_000);
  assert.equal(claimed.campaign.campaignId, 'campaign-1');
  assert.equal(claimed.signup.signupId, 'signup-1');
  assert.ok(queries.some(query => /FOR UPDATE SKIP LOCKED/.test(query.sql)));
});

test('postgres queue completion updates only lifecycle fields on a still-consented signup', async () => {
  const queries = [];
  const client = {
    async query(sql, params = []) {
      queries.push({ sql, params });
      return { rows: [] };
    },
    release() {},
  };
  const store = new PostgresStore({ connect: async () => client });
  await store.saveEarlyAccessQueueContext({
    delivery: { deliveryId: 'delivery-1', updatedAt: 10 },
    campaign: { campaignId: 'campaign-1', updatedAt: 10 },
    signup: {
      emailHash: 'hash-1',
      testerStage: 'invited',
      invitedAt: 10,
      updatedAt: 10,
      consentStatus: 'confirmed',
      contactEncrypted: 'must-not-be-written-by-the-queue',
    },
  });

  const signupUpdate = queries.find(query => /UPDATE golf9_early_access_signups/.test(query.sql));
  assert.ok(signupUpdate);
  assert.match(signupUpdate.sql, /consentStatus/);
  assert.match(signupUpdate.sql, /erasedAt/);
  const written = JSON.parse(signupUpdate.params[1]);
  assert.equal(written.testerStage, 'invited');
  assert.equal('contactEncrypted' in written, false);
  assert.equal('consentStatus' in written, false);
});
