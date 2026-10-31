import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

// Run the real bootstrap function and ingress middleware with deterministic
// timers and a fake store; never contact production or need PostgreSQL secrets.
const source = await readFile(new URL('../index.js', import.meta.url), 'utf8');
const handoff = source.match(/function scheduleRailwayWriterHandoff\(\) \{[\s\S]*?^\}/m)?.[0];
const http = source.match(/app.use\(\(req, res, next\) => \{\s*\/\/ Railway probes[\s\S]*?^\}\);/m)?.[0];
const socket = source.match(/io.use\(\(socket, next\) => \{[\s\S]*?^\}\);/m)?.[0];
assert.ok(handoff && http && socket);

function fixture({ loadStore = async () => {}, saveRequired = false } = {}) {
  const timers = [];
  const exits = [];
  let loads = 0;
  let saves = 0;
  const context = vm.createContext({
    RAILWAY_WRITER_HANDOFF_REQUIRED: true, WRITER_HANDOFF_DELAY_MS: 5000,
    persistenceWriterReady: false, storeReady: false, storeLoadError: null,
    writerHandoffTimer: null, writerHandoffInProgress: false,
    persistenceShuttingDown: false, fatalPersistenceExitScheduled: false,
    storeMigrationPending: false,
    postgresStore: { runtimeStatus: () => ({}) },
    loadStore: async () => { loads++; await loadStore(); },
    prepareLoadedPersistenceState: () => saveRequired,
    saveStore: () => { saves++; }, safeHealthErrorCode: code => code,
    console: { log() {}, error() {} },
    process: { exit: code => exits.push(code) },
    setTimeout(fn, ms) { const timer = { fn, ms, cleared: false, unref() {} }; timers.push(timer); return timer; },
    clearTimeout(timer) { if (timer) timer.cleared = true; },
    app: { use: fn => { context.http = fn; } },
    io: { use: fn => { context.socket = fn; } },
    socketAuth: () => ({ user: {} }), releaseClientFromSocket: () => ({}),
  });
  vm.runInContext(`${handoff}\n${http}\n${socket}`, context);
  return { context, timers, exits, loads: () => loads, saves: () => saves,
    request(method = 'GET', path = '/auth/config') {
      const response = { headers: {}, statusCode: 200, setHeader(k, v) { this.headers[k] = v; },
        status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
      context.http({ method, path }, response, () => { response.next = true; });
      return response;
    },
  };
}

test('ordinary HTTP traffic recovers a restarted writer without a health probe', async () => {
  const f = fixture();
  assert.equal(f.request().next, true);
  assert.equal(f.timers[0].ms, 5000);
  const blocked = f.request('POST', '/auth/social');
  assert.equal(blocked.statusCode, 503);
  assert.equal(blocked.headers['Retry-After'], '5');
  assert.equal(blocked.body.code, 'PERSISTENCE_HANDOFF_PENDING');
  assert.equal(blocked.next, undefined);
  await f.timers[0].fn();
  assert.equal(f.context.storeReady, true);
  assert.equal(f.request('POST', '/auth/social').next, true);
  assert.equal(f.loads(), 1);
});

test('Socket.IO reconnect alone initiates recovery and cannot authenticate early', async () => {
  const f = fixture();
  let error;
  f.context.socket({}, value => { error = value; });
  assert.match(error.message, /handoff/);
  await f.timers[0].fn();
  f.context.socket({}, value => { error = value; });
  assert.equal(error, undefined);
  assert.equal(f.loads(), 1);
});

test('repeated health and app traffic cannot overlap an in-flight reload', async () => {
  let finish;
  const f = fixture({ loadStore: () => new Promise(resolve => { finish = resolve; }), saveRequired: true });
  f.request();
  const pending = f.timers[0].fn();
  for (let i = 0; i < 10; i++) f.request('GET', '/health');
  assert.equal(f.timers.filter(t => t.ms === 5000).length, 1);
  finish(); await pending;
  assert.equal(f.saves(), 1);
  assert.equal(f.loads(), 1);
  assert.equal(f.timers.find(t => t.ms === 30000).cleared, true);
});

for (const flag of ['persistenceShuttingDown', 'fatalPersistenceExitScheduled']) {
  test(`${flag} blocks new recovery and prevents a pending reload reopening writes`, async () => {
    let finish;
    const f = fixture({ loadStore: () => new Promise(resolve => { finish = resolve; }), saveRequired: true });
    f.request();
    const pending = f.timers[0].fn();
    f.context[flag] = true;
    finish(); await pending;
    f.request();
    assert.equal(f.context.persistenceWriterReady, false);
    assert.equal(f.saves(), 0);
    assert.equal(f.timers.filter(t => t.ms === 5000).length, 1);
  });
}

test('reload failures fail closed and schedule replacement, not another reload', async () => {
  const f = fixture({ loadStore: async () => { throw Object.assign(new Error('unavailable'), { code: '08006' }); } });
  f.request(); await f.timers[0].fn(); f.request();
  assert.equal(f.context.persistenceWriterReady, false);
  assert.equal(f.context.fatalPersistenceExitScheduled, true);
  f.timers.find(t => t.ms === 100).fn();
  assert.deepEqual(f.exits, [1]);
  assert.equal(f.loads(), 1);
});

test('a hung reload times out and its late result cannot open the write gate', async () => {
  let finish;
  const f = fixture({ loadStore: () => new Promise(resolve => { finish = resolve; }), saveRequired: true });
  f.request(); const pending = f.timers[0].fn();
  f.timers.find(t => t.ms === 30000).fn(); await pending;
  finish(); await Promise.resolve();
  assert.equal(f.context.storeLoadError.code, 'WRITER_HANDOFF_TIMEOUT');
  assert.equal(f.context.persistenceWriterReady, false);
  assert.equal(f.saves(), 0);
});

test('non-Railway storage and already-ready writers never reload from traffic', () => {
  for (const overrides of [{ RAILWAY_WRITER_HANDOFF_REQUIRED: false }, { persistenceWriterReady: true }]) {
    const f = fixture(); Object.assign(f.context, overrides); f.request();
    assert.equal(f.timers.length, 0);
  }
});
