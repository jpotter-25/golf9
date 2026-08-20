import assert from 'node:assert/strict';
import test from 'node:test';
import { createDatabaseSslConfig, PostgresStore } from '../postgresStore.js';

const TEST_CA = `-----BEGIN CERTIFICATE-----
MIIDHTCCAgWgAwIBAgIUMh2M6Z9G+ops/2s25awW2uIe9zUwDQYJKoZIhvcNAQEL
BQAwHjEcMBoGA1UEAwwTbmluZWJlbG93LXRlc3Qtcm9vdDAeFw0yNjA4MjAwMDM2
MThaFw0zNjA4MTcwMDM2MThaMB4xHDAaBgNVBAMME25pbmViZWxvdy10ZXN0LXJv
b3QwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCwj4uor3HO4v5mqwPn
k1q4OgAc49c/Ueb3+qx01Lzz7oAAhHKpb7FP/IFpGRIHPuo/yyEkAOtyYOns/25S
AbLO1YBCskgwRhnZBrF2f2Y7tyhVMkKXWfGyiDbuBrhczZ1KIQUgAVqXl8zSvPCo
FkxQwipxv3QVU4FCaFYDqFHibBPHmlJuF54ZWvispCTaeHZ8bo1PQdYyg1YxccJG
lo5FwD5um8bMU0/vx+Ju8b1IodzIomj8d0Un3MY2wg59W0Olnld41MXD/ksEDvIv
UPPSZaX4sy9XxqfIxtzY4FMie8FdvQ0rwRctX3gQrJkQVcNNdp1BFk8mlG/QM8fV
WcQrAgMBAAGjUzBRMB0GA1UdDgQWBBQxiiYF5P5ZVrqIAzQ6EgaZlKh5IzAfBgNV
HSMEGDAWgBQxiiYF5P5ZVrqIAzQ6EgaZlKh5IzAPBgNVHRMBAf8EBTADAQH/MA0G
CSqGSIb3DQEBCwUAA4IBAQBCGEDyE/imQG214/u2lOup7m+4k9yqTr8L8OkJ+0Xs
JvBtu/E7ZbkMa0ux8Z5xlOYSeR30xrvRk106Z0k0b9wCexXrHhtL0jQ1rFqhqs4U
xD9q19OH/f+SU9hl9cAIUpKc8ts2Y3UUQrZMiM5ts6qY7ig50vJodB7E2nlD/uYn
OOrvGVCnbzRPvRHJFxtZxmyOtyTlVleT7DeW6cHKVthmooiFFY31uDMS4oU/i+en
mHSMLRiPHBozNGQn+LKfLspHCv5g3kW6WZBmFJ7ITmQQ6pqXPzdmna7hnPAdnp4p
+Bm5PzSru9D2yjLyL6E85G3p9DmMsXnPBSF2GecbgiFh
-----END CERTIFICATE-----`;
const TEST_CA_SHA256 = '21:45:BF:C1:3E:BC:A9:C0:38:3E:C1:8D:A6:4C:1B:C8:9F:29:83:CE:A8:3D:5C:C1:F4:05:71:2A:1C:27:7B:F0';

test('database TLS pins the Railway CA while accepting only its documented localhost certificate name', () => {
  const ssl = createDatabaseSslConfig('postgresql://user:password@postgres.railway.internal:5432/ninebelow', {
    NODE_ENV: 'production',
    DATABASE_SSL: '1',
    DATABASE_SSL_REJECT_UNAUTHORIZED: '1',
    DATABASE_SSL_CA: TEST_CA,
    DATABASE_SSL_CA_SHA256: TEST_CA_SHA256,
    DATABASE_SSL_RAILWAY_PRIVATE_HOSTNAME_COMPAT: '1',
  });

  assert.equal(ssl.rejectUnauthorized, true);
  assert.equal(ssl.ca, TEST_CA);
  assert.equal(typeof ssl.checkServerIdentity, 'function');
  assert.equal(ssl.checkServerIdentity('postgres.railway.internal', {
    subject: { CN: 'localhost' },
    subjectaltname: 'DNS:localhost',
  }), undefined);

  const unrelatedCertificate = ssl.checkServerIdentity('postgres.railway.internal', {
    subject: { CN: 'attacker.invalid' },
    subjectaltname: 'DNS:attacker.invalid',
  });
  assert.equal(unrelatedCertificate.code, 'ERR_TLS_CERT_ALTNAME_INVALID');

  const unrelatedHost = ssl.checkServerIdentity('other.railway.internal', {
    subject: { CN: 'localhost' },
    subjectaltname: 'DNS:localhost',
  });
  assert.equal(unrelatedHost.code, 'ERR_TLS_CERT_ALTNAME_INVALID');
});

test('database TLS rejects invalid pins and connection-string TLS overrides', () => {
  const env = {
    NODE_ENV: 'production',
    DATABASE_SSL: '1',
    DATABASE_SSL_REJECT_UNAUTHORIZED: '1',
    DATABASE_SSL_CA: TEST_CA,
    DATABASE_SSL_CA_SHA256: `00${TEST_CA_SHA256.replace(/:/g, '').slice(2)}`,
  };
  assert.throws(
    () => createDatabaseSslConfig('postgresql://postgres.railway.internal/ninebelow', env),
    /does not match DATABASE_SSL_CA_SHA256/,
  );
  assert.throws(
    () => createDatabaseSslConfig('postgresql://postgres.railway.internal/ninebelow?sslmode=require', {}),
    /cannot contain TLS parameters/,
  );
  assert.throws(
    () => createDatabaseSslConfig('postgresql://postgres.railway.internal/ninebelow', {
      DATABASE_SSL: '1',
      DATABASE_SSL_REJECT_UNAUTHORIZED: '1',
      DATABASE_SSL_CA: TEST_CA,
      DATABASE_SSL_RAILWAY_PRIVATE_HOSTNAME_COMPAT: '1',
    }),
    /requires verified TLS, a CA certificate, and its SHA-256 fingerprint/,
  );
  assert.throws(
    () => createDatabaseSslConfig('postgresql://db.example.com/ninebelow', {
      DATABASE_SSL: '1',
      DATABASE_SSL_REJECT_UNAUTHORIZED: '1',
      DATABASE_SSL_CA: TEST_CA,
      DATABASE_SSL_CA_SHA256: TEST_CA_SHA256,
      DATABASE_SSL_RAILWAY_PRIVATE_HOSTNAME_COMPAT: '1',
    }),
    /limited to \*\.railway\.internal/,
  );
});

test('database TLS preserves ordinary verified TLS without Railway compatibility', () => {
  const ssl = createDatabaseSslConfig('postgresql://db.example.com/ninebelow', {
    DATABASE_SSL: '1',
    DATABASE_SSL_REJECT_UNAUTHORIZED: '1',
    DATABASE_SSL_CA: TEST_CA,
  });
  assert.equal(ssl.rejectUnauthorized, true);
  assert.equal(ssl.ca, TEST_CA);
  assert.equal('checkServerIdentity' in ssl, false);
});

test('hosted database connections cannot disable certificate verification', () => {
  assert.throws(
    () => createDatabaseSslConfig('postgresql://postgres.railway.internal/ninebelow', {
      RAILWAY_ENVIRONMENT_ID: 'preview-environment',
      DATABASE_SSL: '0',
    }),
    /cannot be disabled/i,
  );
  assert.throws(
    () => createDatabaseSslConfig('postgresql://postgres.railway.internal/ninebelow', {
      RAILWAY_ENVIRONMENT_ID: 'preview-environment',
      DATABASE_SSL: '1',
      DATABASE_SSL_REJECT_UNAUTHORIZED: '0',
    }),
    /cannot be disabled in hosted environments/i,
  );
});

test('postgres health checks report live query latency without exposing database errors', async () => {
  const successful = new PostgresStore({
    query: async sql => {
      assert.match(sql, /SELECT 1 AS ok/);
      return { rows: [{ ok: 1 }] };
    },
  });
  const healthy = await successful.healthCheck();
  assert.equal(healthy.ok, true);
  assert.equal(typeof healthy.latencyMs, 'number');
  assert.equal(successful.runtimeStatus().lastHealthSuccessAt, healthy.checkedAt);

  const failed = new PostgresStore({
    query: async () => {
      const error = new Error('postgresql://user:password@secret-host/database');
      error.code = 'ECONNREFUSED';
      throw error;
    },
  });
  const unhealthy = await failed.healthCheck();
  assert.deepEqual(Object.keys(unhealthy).sort(), ['checkedAt', 'errorCode', 'latencyMs', 'ok']);
  assert.equal(unhealthy.ok, false);
  assert.equal(unhealthy.errorCode, 'ECONNREFUSED');
  assert.doesNotMatch(JSON.stringify(unhealthy), /password|secret-host/);
});

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

test('postgres snapshot writes are fenced when another process advanced state', async () => {
  const queries = [];
  const client = {
    async query(sql) {
      queries.push(sql);
      if (/SELECT value FROM golf9_meta/.test(sql)) return { rows: [{ value: 2 }] };
      return { rows: [] };
    },
    release() {},
  };
  const store = new PostgresStore({
    query: async () => ({ rows: [] }),
    connect: async () => client,
  });
  store.stateRevision = 1;

  await assert.rejects(
    () => store.save({}),
    error => error?.code === 'STALE_STATE_WRITE',
  );
  assert.ok(queries.some(sql => /FOR UPDATE/.test(sql)));
  assert.ok(queries.includes('ROLLBACK'));
  assert.equal(queries.includes('COMMIT'), false);
});

test('mail reward claim locks and updates the user and mail entry in one transaction', async () => {
  const queries = [];
  const client = {
    async query(sql, params = []) {
      queries.push({ sql, params });
      if (/SELECT value FROM golf9_meta/.test(sql)) return { rows: [{ value: 0 }] };
      if (/SELECT data FROM golf9_users/.test(sql)) return { rows: [{ data: { userId: 'user-1', currency: { coins: 10 } } }] };
      if (/SELECT data FROM golf9_mail_entries/.test(sql)) return { rows: [{ data: { mailId: 'mail-1', claimedAt: null } }] };
      return { rows: [] };
    },
    release() {},
  };
  const store = new PostgresStore({
    query: async () => ({ rows: [] }),
    connect: async () => client,
  });

  const claimed = await store.mutateMailClaim({ userId: 'user-1', mailId: 'mail-1' }, (user, mail) => {
    user.currency.coins += 25;
    mail.claimedAt = 123;
    return { ok: true };
  });

  assert.equal(claimed.user.currency.coins, 35);
  assert.equal(claimed.mail.claimedAt, 123);
  assert.ok(queries.some(query => /golf9_users.+FOR UPDATE/s.test(query.sql)));
  assert.ok(queries.some(query => /golf9_mail_entries.+FOR UPDATE/s.test(query.sql)));
  assert.ok(queries.some(query => /UPDATE golf9_users/.test(query.sql)));
  assert.ok(queries.some(query => /UPDATE golf9_mail_entries/.test(query.sql)));
  assert.ok(queries.some(query => query.sql === 'COMMIT'));
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
