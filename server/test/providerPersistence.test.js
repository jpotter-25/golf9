import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

// Execute the actual index.js adapter without starting a server or connecting
// to a live database. JSON integration tests cannot exercise this branch.
const source = await readFile(new URL('../index.js', import.meta.url), 'utf8');
const adapter = source.match(/async function persistProviderState\(\) \{[\s\S]*?^\}/m)?.[0];
assert.ok(adapter, 'The provider persistence adapter must be present.');

function loadAdapter(overrides = {}) {
  const calls = [];
  const snapshot = () => ({ providerTransactions: [] });
  const context = {
    persistenceWriterReady: true,
    postgresStore: {
      runtimeStatus: () => ({ lastSaveErrorCode: null }),
      saveCritical: async factory => { calls.push(factory); },
    },
    storeSnapshot: snapshot,
    saveStore: () => { calls.push('json'); },
    ...overrides,
  };
  return { save: vm.runInNewContext(`(${adapter})`, context), calls, snapshot };
}

test('provider persistence saves through the ready PostgreSQL writer', async () => {
  const { save, calls, snapshot } = loadAdapter();
  await save();
  assert.deepEqual(calls, [snapshot]);
});

test('provider persistence refuses writes before Railway handoff', async () => {
  const { save, calls } = loadAdapter({ persistenceWriterReady: false });
  await assert.rejects(save(), /Sign-in storage is temporarily unavailable/);
  assert.deepEqual(calls, []);
});

test('provider persistence checks the actual PostgreSQL stale-writer status', async () => {
  let wrote = false;
  const { save } = loadAdapter({
    postgresStore: {
      runtimeStatus: () => ({ lastSaveErrorCode: 'STALE_STATE_WRITE' }),
      saveCritical: async () => { wrote = true; },
    },
  });
  await assert.rejects(save(), /Sign-in storage is temporarily unavailable/);
  assert.equal(wrote, false);
});

test('provider persistence propagates database failures without falling back to JSON', async () => {
  const failure = new Error('database write failed');
  const { save, calls } = loadAdapter({
    postgresStore: {
      runtimeStatus: () => ({ lastSaveErrorCode: null }),
      saveCritical: async () => { throw failure; },
    },
  });
  await assert.rejects(save(), error => error === failure);
  assert.deepEqual(calls, []);
});

test('provider persistence preserves the non-production JSON path', async () => {
  const { save, calls } = loadAdapter({ postgresStore: null });
  await save();
  assert.deepEqual(calls, ['json']);
});
