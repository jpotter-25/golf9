import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { io } = require('socket.io-client');
const DAY_MS = 24 * 60 * 60 * 1000;

async function freePort() {
  const server = createServer();
  server.unref();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const selected = address && typeof address === 'object' ? address.port : 0;
  await new Promise(resolve => server.close(resolve));
  return selected;
}

async function waitForHealth(baseUrl) {
  const deadline = Date.now() + 5000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw lastError || new Error('server did not become healthy');
}

async function json(res) {
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'X-Golf9-Build': '40',
  };
}

function adminHeaders(session) {
  return { 'Content-Type': 'application/json', Cookie: session.cookie };
}

let testNameCounter = 0;
function testDisplayName(prefix = 'Player') {
  const base = String(prefix).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 9) || 'Player';
  const suffix = (++testNameCounter).toString(36).padStart(3, '0').slice(-3);
  return `${base.slice(0, 12 - suffix.length)}${suffix}`;
}

function emitAck(socket, event, payload) {
  return new Promise(resolve => socket.emit(event, payload, resolve));
}

async function signup(baseUrl, displayName, inviteCode = '') {
  const playerName = testDisplayName(displayName);
  return json(await fetch(`${baseUrl}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName: playerName, password: 'password1', inviteCode }),
  }));
}

async function adminLogin(baseUrl) {
  const loginRes = await fetch(`${baseUrl}/admin/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName: 'admin', password: 'admin9' }),
  });
  const login = await json(loginRes);
  const cookie = loginRes.headers.get('set-cookie').split(';')[0];
  if (login.mfaRequired) {
    await json(await fetch(`${baseUrl}/admin/api/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ code: '000000' }),
    }));
  }
  return { token: login.token, cookie };
}

async function earnFreeCoins(baseUrl, token) {
  return json(await fetch(`${baseUrl}/results/local`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      mode: 'solo',
      totalRounds: 5,
      roundScores: [4, 5, 6, 7, 8],
      columnClears: 1,
      players: [
        { displayName: 'Player 1', total: 20 },
        { displayName: 'Player 2', total: 55 },
      ],
    }),
  }));
}

async function earnClubLevel(baseUrl, token) {
  return json(await fetch(`${baseUrl}/results/local`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      mode: 'solo',
      totalRounds: 5,
      roundScores: [0, 1, 2, 3, 4],
      columnClears: 150,
      players: [
        { displayName: 'Player 1', total: 0 },
        { displayName: 'Player 2', total: 55 },
      ],
    }),
  }));
}

async function adminAdjustCoins(baseUrl, admin, userId, amount) {
  return json(await fetch(`${baseUrl}/admin/api/users/${encodeURIComponent(userId)}/coins/adjust`, {
    method: 'POST',
    headers: {
      ...authHeaders(admin.token),
      Cookie: admin.cookie,
    },
    body: JSON.stringify({ amount, reason: 'Test club economy funding.' }),
  }));
}

async function withServer(fn, extraEnv = {}) {
  const serverPort = await freePort();
  const dataDir = await mkdtemp(path.join(tmpdir(), 'golf9-server-test-'));
  await fnWithServer(dataDir, serverPort, fn, extraEnv);
}

async function fnWithServer(dataDir, serverPort, fn, extraEnv = {}) {
  const child = spawn(process.execPath, ['index.js'], {
    cwd: path.resolve('..', 'server'),
    env: { ...process.env, ...extraEnv, PORT: String(serverPort), DATA_DIR: dataDir, CLIENT_ORIGINS: '*' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stderr = [];
  child.stderr.on('data', chunk => stderr.push(String(chunk)));
  const baseUrl = `http://127.0.0.1:${serverPort}`;
  try {
    await waitForHealth(baseUrl);
    await fn(baseUrl);
  } finally {
    child.kill('SIGTERM');
    await Promise.race([once(child, 'exit'), new Promise(resolve => setTimeout(resolve, 1000))]);
    await rm(dataDir, { recursive: true, force: true });
    if (stderr.length) console.error(stderr.join(''));
  }
}

async function withSeededServer(seed, fn) {
  const serverPort = await freePort();
  const dataDir = await mkdtemp(path.join(tmpdir(), 'golf9-server-test-'));
  await mkdir(dataDir, { recursive: true });
  await writeFile(path.join(dataDir, 'auth-store.json'), JSON.stringify(seed, null, 2));
  await fnWithServer(dataDir, serverPort, fn);
}

async function waitForExit(child, timeoutMs = 5000) {
  return Promise.race([
    once(child, 'exit'),
    new Promise((_, reject) => setTimeout(() => reject(new Error('server did not exit')), timeoutMs)),
  ]);
}

test('public policy pages are available for store and social auth review', async () => {
  await withServer(async (baseUrl) => {
    const pages = [
      ['/privacy', 'Privacy Policy'],
      ['/terms', 'Terms of Service'],
      ['/account/delete', 'Account Deletion'],
    ];

    for (const [route, title] of pages) {
      const res = await fetch(`${baseUrl}${route}`);
      const html = await res.text();
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type'), /text\/html/);
      assert.match(html, new RegExp(`<h1>${title}</h1>`));
      assert.match(html, /developer@joinup\.us/);
    }
  });
});

test('admin config is canonical and malformed nested admin URLs redirect', async () => {
  await withServer(async (baseUrl) => {
    const config = await json(await fetch(`${baseUrl}/auth/config`));
    assert.equal(config.apiUrl, 'https://games.joinup.us');
    assert.equal(config.adminUrl, 'https://games.joinup.us/admin');

    const nested = await fetch(`${baseUrl}/admin/https://games.joinup.us/admin/`, { redirect: 'manual' });
    assert.equal(nested.status, 302);
    assert.equal(nested.headers.get('location'), '/admin/');
  }, {
    PUBLIC_API_URL: 'https://games.joinup.us',
    ADMIN_PUBLIC_URL: 'https://games.joinup.us/admin/https://games.joinup.us/admin/',
  });
});

test('local JSON storage remains available outside production', async () => {
  await withServer(async (baseUrl) => {
    const health = await json(await fetch(`${baseUrl}/health/ready`));
    assert.equal(health.storage.provider, 'json');
    assert.equal(health.storage.durable, false);
    assert.equal(health.storage.databaseConfigured, false);
  }, { NODE_ENV: 'development', APP_ENV: 'development', DATABASE_URL: '' });
});

test('production refuses to start without durable database storage', async () => {
  const serverPort = await freePort();
  const dataDir = await mkdtemp(path.join(tmpdir(), 'golf9-server-test-'));
  const child = spawn(process.execPath, ['index.js'], {
    cwd: path.resolve('..', 'server'),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      APP_ENV: 'production',
      EXPO_PUBLIC_APP_ENV: 'production',
      DATABASE_URL: '',
      ALLOW_JSON_STORE_IN_PRODUCTION: '',
      ALLOW_JSON_FALLBACK_ON_DB_ERROR: '',
      PORT: String(serverPort),
      DATA_DIR: dataDir,
      CLIENT_ORIGINS: '*',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stderr = [];
  child.stderr.on('data', chunk => stderr.push(String(chunk)));
  try {
    const [code] = await waitForExit(child);
    assert.notEqual(code, 0);
    assert.match(stderr.join(''), /DATABASE_URL is required in production/);
  } finally {
    child.kill('SIGTERM');
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('push notification tokens can register, rotate, and unregister', async () => {
  await withServer(async (baseUrl) => {
    const player = await signup(baseUrl, `PushTester${Date.now()}`);
    const first = await json(await fetch(`${baseUrl}/push/register`, {
      method: 'POST',
      headers: authHeaders(player.token),
      body: JSON.stringify({
        expoPushToken: 'ExponentPushToken[test-token-one]',
        deviceId: 'test-device',
        platform: 'android',
      }),
    }));
    assert.equal(first.ok, true);
    assert.equal(first.pushTokenCount, 1);

    const rotated = await json(await fetch(`${baseUrl}/push/register`, {
      method: 'POST',
      headers: authHeaders(player.token),
      body: JSON.stringify({
        expoPushToken: 'ExponentPushToken[test-token-two]',
        deviceId: 'test-device',
        platform: 'android',
      }),
    }));
    assert.equal(rotated.pushTokenCount, 1);

    const removed = await json(await fetch(`${baseUrl}/push/unregister`, {
      method: 'POST',
      headers: authHeaders(player.token),
      body: JSON.stringify({ deviceId: 'test-device' }),
    }));
    assert.equal(removed.pushTokenCount, 0);
  }, { PUSH_TEST_MODE: '1' });
});

test('admin notifications can configure templates and send custom pushes', async () => {
  await withServer(async (baseUrl) => {
    const admin = await adminLogin(baseUrl);
    const player = await signup(baseUrl, `NotifyCustom${Date.now()}`);
    await json(await fetch(`${baseUrl}/push/register`, {
      method: 'POST',
      headers: authHeaders(player.token),
      body: JSON.stringify({
        expoPushToken: 'ExponentPushToken[custom-token-one]',
        deviceId: 'custom-device',
        platform: 'android',
      }),
    }));

    const overview = await json(await fetch(`${baseUrl}/admin/api/notifications`, { headers: adminHeaders(admin) }));
    assert.equal(overview.stats.registeredUsers, 1);
    assert.equal(overview.stats.registeredTokens, 1);
    assert.equal(overview.config.types.turn.enabled, true);

    const saved = await json(await fetch(`${baseUrl}/admin/api/notifications`, {
      method: 'PATCH',
      headers: adminHeaders(admin),
      body: JSON.stringify({
        reason: 'Integration test notification templates',
        config: {
          enabled: true,
          custom: { enabled: true },
          types: {
            ...overview.config.types,
            turn: { enabled: true, title: 'Golf 9 turn', body: 'Room {roomCode} needs you.' },
          },
        },
      }),
    }));
    assert.equal(saved.config.types.turn.title, 'Golf 9 turn');

    const sent = await json(await fetch(`${baseUrl}/admin/api/notifications/send`, {
      method: 'POST',
      headers: adminHeaders(admin),
      body: JSON.stringify({
        target: player.user.userId,
        title: 'Test broadcast',
        body: 'This is a custom admin notification.',
        reason: 'Integration test custom push',
      }),
    }));
    assert.equal(sent.queued, 1);
    assert.equal(sent.targetedUsers, 1);

    const outbox = await json(await fetch(`${baseUrl}/admin/api/notifications/test-outbox`, { headers: adminHeaders(admin) }));
    assert.ok(outbox.messages.some(message => message.title === 'Test broadcast' && message.to === 'ExponentPushToken[custom-token-one]'));
  }, { PUSH_TEST_MODE: '1', SEED_ADMIN_ACCOUNT: '1' });
});

test('turn push waits until the active player backgrounds or disconnects', async () => {
  await withServer(async (baseUrl) => {
    const admin = await adminLogin(baseUrl);
    const one = await signup(baseUrl, `TurnPushOne${Date.now()}`);
    const two = await signup(baseUrl, `TurnPushTwo${Date.now()}`);

    await json(await fetch(`${baseUrl}/push/register`, {
      method: 'POST',
      headers: authHeaders(one.token),
      body: JSON.stringify({ expoPushToken: 'ExponentPushToken[turn-token-one]', deviceId: 'turn-one', platform: 'android' }),
    }));
    await json(await fetch(`${baseUrl}/push/register`, {
      method: 'POST',
      headers: authHeaders(two.token),
      body: JSON.stringify({ expoPushToken: 'ExponentPushToken[turn-token-two]', deviceId: 'turn-two', platform: 'android' }),
    }));

    const created = await json(await fetch(`${baseUrl}/rooms`, {
      method: 'POST',
      headers: authHeaders(one.token),
      body: JSON.stringify({ maxPlayers: 2, rounds: 5 }),
    }));
    const code = created.room.code;
    await json(await fetch(`${baseUrl}/rooms/${code}/join`, { method: 'POST', headers: authHeaders(two.token) }));

    const socketOne = io(baseUrl, { transports: ['websocket'], auth: { token: one.token }, forceNew: true });
    const socketTwo = io(baseUrl, { transports: ['websocket'], auth: { token: two.token }, forceNew: true });
    await Promise.all([once(socketOne, 'connect'), once(socketTwo, 'connect')]);

    try {
      assert.equal((await emitAck(socketOne, 'room:join', { code })).room.code, code);
      assert.equal((await emitAck(socketTwo, 'room:join', { code })).room.code, code);
      assert.deepEqual(await emitAck(socketOne, 'room:start', { code }), { ok: true });

      assert.equal((await emitAck(socketOne, 'game:intent', { code, actionId: 'peek-one-a1', type: 'peek', payload: { r: 0, c: 0 } })).ok, true);
      assert.equal((await emitAck(socketTwo, 'game:intent', { code, actionId: 'peek-two-a1', type: 'peek', payload: { r: 0, c: 0 } })).ok, true);
      assert.equal((await emitAck(socketOne, 'game:intent', { code, actionId: 'peek-one-b1', type: 'peek', payload: { r: 0, c: 1 } })).ok, true);
      assert.equal((await emitAck(socketTwo, 'game:intent', { code, actionId: 'peek-two-b1', type: 'peek', payload: { r: 0, c: 1 } })).ok, true);

      await new Promise(resolve => setTimeout(resolve, 30));
      let outbox = await json(await fetch(`${baseUrl}/admin/api/notifications/test-outbox`, { headers: adminHeaders(admin) }));
      assert.equal(outbox.messages.some(message => message.data?.type === 'turn'), false);

      const game = (await emitAck(socketOne, 'room:join', { code })).game;
      const activeUserId = game.players[game.currentPlayerIndex].userId;
      const activeSocket = activeUserId === one.user.userId ? socketOne : socketTwo;
      assert.deepEqual(await emitAck(activeSocket, 'presence:state', { code, foreground: false }), { ok: true });

      await new Promise(resolve => setTimeout(resolve, 30));
      outbox = await json(await fetch(`${baseUrl}/admin/api/notifications/test-outbox`, { headers: adminHeaders(admin) }));
      const turnMessages = outbox.messages.filter(message => message.data?.type === 'turn');
      assert.equal(turnMessages.length, 1);
      assert.equal(turnMessages[0].data.roomCode, code);
      assert.equal(turnMessages[0].data.displayName, game.players[game.currentPlayerIndex].name);
    } finally {
      socketOne.disconnect();
      socketTwo.disconnect();
    }
  }, { PUSH_TEST_MODE: '1', SEED_ADMIN_ACCOUNT: '1' });
});

test('dev test accounts can be seeded for local playtesting', async () => {
  await withServer(async (baseUrl) => {
    const one = await json(await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 't1test', password: 't1test' }),
    }));
    const two = await json(await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 't2test', password: 't2test' }),
    }));
    const three = await json(await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 't3test', password: 't3test' }),
    }));
    const forgivingMobileEntry = await json(await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'T1TEST', password: ' T1TEST ' }),
    }));

    assert.equal(one.user.displayName, 't1test');
    assert.equal(two.user.displayName, 't2test');
    assert.equal(three.user.displayName, 't3test');
    assert.equal(forgivingMobileEntry.user.displayName, 't1test');
    assert.ok(one.user.currency.coins >= 5000);
    assert.ok(two.user.currency.coins >= 5000);
    assert.ok(three.user.currency.coins >= 5000);
  }, { SEED_TEST_ACCOUNTS: '1' });
});

test('signup enforces compact player names', async () => {
  await withServer(async (baseUrl) => {
    const tooShort = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'A', password: 'password1' }),
    });
    assert.equal(tooShort.status, 400);

    const tooLong = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: '1234567890123', password: 'password1' }),
    });
    assert.equal(tooLong.status, 400);

    const badCharacters = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Bad Name!', password: 'password1' }),
    });
    assert.equal(badCharacters.status, 400);

    const accepted = await json(await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Ace_12-Play', password: 'password1' }),
    }));
    assert.equal(accepted.user.displayName, 'Ace_12-Play');
  });
});

test('pre-alpha invite gate blocks open signup and consumes admin-created invites once', async () => {
  await withServer(async (baseUrl) => {
    const config = await json(await fetch(`${baseUrl}/auth/config`));
    assert.equal(config.inviteRequired, true);

    const blocked = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: testDisplayName('NoInvite'), password: 'password1' }),
    });
    assert.equal(blocked.status, 403);

    const admin = await adminLogin(baseUrl);
    const created = await json(await fetch(`${baseUrl}/admin/api/invites`, {
      method: 'POST',
      headers: adminHeaders(admin),
      body: JSON.stringify({
        code: 'ALPHA1',
        label: 'Alpha smoke',
        maxUses: 1,
        reason: 'integration test',
      }),
    }));
    assert.equal(created.invite.code, 'ALPHA1');
    assert.equal(created.invite.remainingUses, 1);

    const accepted = await json(await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: testDisplayName('Invited'), password: 'password1', inviteCode: 'ALPHA1' }),
    }));
    assert.ok(accepted.token);

    const invites = await json(await fetch(`${baseUrl}/admin/api/invites`, { headers: adminHeaders(admin) }));
    assert.equal(invites.invites[0].uses.length, 1);
    assert.equal(invites.invites[0].status, 'exhausted');

    const exhausted = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: testDisplayName('Late'), password: 'password1', inviteCode: 'ALPHA1' }),
    });
    assert.equal(exhausted.status, 403);
  }, { REQUIRE_INVITE_CODE: '1', SEED_ADMIN_ACCOUNT: '1' });
});

test('social auth gates new accounts and links existing profiles', async () => {
  await withServer(async (baseUrl) => {
    const config = await json(await fetch(`${baseUrl}/auth/config`));
    assert.equal(config.providers.google, true);
    assert.equal(config.providers.facebook, true);

    const googleToken = 'mock:google:g-1:golf@example.com:Golfy Google';
    const needsProfile = await json(await fetch(`${baseUrl}/auth/social/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'google', idToken: googleToken }),
    }));
    assert.equal(needsProfile.requiresProfile, true);
    assert.equal(needsProfile.provider, 'google');
    assert.equal(needsProfile.inviteRequired, true);
    assert.equal(needsProfile.suggestedDisplayName, 'GolfyGoogle');

    const blocked = await fetch(`${baseUrl}/auth/social/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'google', idToken: googleToken, displayName: testDisplayName('Social') }),
    });
    assert.equal(blocked.status, 403);

    const admin = await adminLogin(baseUrl);
    await json(await fetch(`${baseUrl}/admin/api/invites`, {
      method: 'POST',
      headers: adminHeaders(admin),
      body: JSON.stringify({
        code: 'SOCIAL1',
        label: 'Social smoke',
        maxUses: 1,
        reason: 'integration test',
      }),
    }));
    await json(await fetch(`${baseUrl}/admin/api/invites`, {
      method: 'POST',
      headers: adminHeaders(admin),
      body: JSON.stringify({
        code: 'PASS1',
        label: 'Password smoke',
        maxUses: 1,
        reason: 'integration test',
      }),
    }));

    const displayName = testDisplayName('Google');
    const accepted = await json(await fetch(`${baseUrl}/auth/social/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'google', idToken: googleToken, displayName, inviteCode: 'SOCIAL1' }),
    }));
    assert.ok(accepted.token);
    assert.equal(accepted.user.displayName, displayName);
    assert.equal(accepted.user.authProviders.google, true);
    assert.equal(accepted.user.authProviders.facebook, false);

    const repeat = await json(await fetch(`${baseUrl}/auth/social/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'google', idToken: googleToken }),
    }));
    assert.equal(repeat.user.userId, accepted.user.userId);

    const passwordUser = await signup(baseUrl, `Pass${Date.now()}`, 'PASS1');
    const facebookToken = 'mock:facebook:fb-1:face@example.com:Face Friend';
    const linked = await json(await fetch(`${baseUrl}/auth/social/link`, {
      method: 'POST',
      headers: authHeaders(passwordUser.token),
      body: JSON.stringify({ provider: 'facebook', accessToken: facebookToken }),
    }));
    assert.equal(linked.user.userId, passwordUser.user.userId);
    assert.equal(linked.user.authProviders.facebook, true);

    const facebookLogin = await json(await fetch(`${baseUrl}/auth/social/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'facebook', accessToken: facebookToken }),
    }));
    assert.equal(facebookLogin.user.userId, passwordUser.user.userId);

    const conflict = await fetch(`${baseUrl}/auth/social/link`, {
      method: 'POST',
      headers: authHeaders(accepted.token),
      body: JSON.stringify({ provider: 'facebook', accessToken: facebookToken }),
    });
    assert.equal(conflict.status, 409);
  }, { REQUIRE_INVITE_CODE: '1', SEED_ADMIN_ACCOUNT: '1', SOCIAL_AUTH_TEST_MODE: '1' });
});

test('admin console supports MFA login, audited player ops, support tickets, and bans', async () => {
  await withServer(async (baseUrl) => {
    const player = await signup(baseUrl, `Ops${Date.now()}`);

    const denied = await fetch(`${baseUrl}/admin/api/users`, {
      headers: authHeaders(player.token),
    });
    assert.equal(denied.status, 401);

    const ticket = await json(await fetch(`${baseUrl}/support/tickets`, {
      method: 'POST',
      headers: { ...authHeaders(player.token), 'X-Golf9-Device-Id': 'ops-device' },
      body: JSON.stringify({ subject: 'Coin issue', message: 'I need help with my test balance.' }),
    }));
    assert.equal(ticket.ticket.status, 'open');

    const loginRes = await fetch(`${baseUrl}/admin/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'admin', password: 'admin9' }),
    });
    const login = await json(loginRes);
    const cookie = loginRes.headers.get('set-cookie').split(';')[0];
    assert.equal(login.mfaRequired, true);

    await json(await fetch(`${baseUrl}/admin/api/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ code: '000000' }),
    }));

    const usersList = await json(await fetch(`${baseUrl}/admin/api/users?q=Ops`, { headers: { Cookie: cookie } }));
    assert.ok(usersList.users.some(user => user.userId === player.user.userId));

    const adjustment = await json(await fetch(`${baseUrl}/admin/api/users/${player.user.userId}/coins/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ amount: 250, reason: 'Support test credit' }),
    }));
    assert.equal(adjustment.after, adjustment.before + 250);

    const xpAdjustment = await json(await fetch(`${baseUrl}/admin/api/users/${player.user.userId}/progression/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ xpDelta: 1200, reason: 'Support test XP credit' }),
    }));
    assert.equal(xpAdjustment.before.level, 1);
    assert.equal(xpAdjustment.after.level, 2);

    const levelAdjustment = await json(await fetch(`${baseUrl}/admin/api/users/${player.user.userId}/progression/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ level: 10, reason: 'Support test level correction' }),
    }));
    assert.equal(levelAdjustment.after.level, 10);
    assert.equal(levelAdjustment.user.progression.level, 10);

    const tickets = await json(await fetch(`${baseUrl}/admin/api/support/tickets`, { headers: { Cookie: cookie } }));
    assert.ok(tickets.tickets.some(item => item.ticketId === ticket.ticket.ticketId));

    const archived = await json(await fetch(`${baseUrl}/admin/api/users/${player.user.userId}/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ reason: 'Automated archive test' }),
    }));
    assert.equal(archived.user.archived, true);
    assert.equal(archived.revokedSessions, 1);

    const hiddenAfterArchive = await json(await fetch(`${baseUrl}/admin/api/users?q=Ops`, { headers: { Cookie: cookie } }));
    assert.equal(hiddenAfterArchive.users.some(user => user.userId === player.user.userId), false);
    const archivedList = await json(await fetch(`${baseUrl}/admin/api/users?q=Ops&archived=1`, { headers: { Cookie: cookie } }));
    assert.ok(archivedList.users.some(user => user.userId === player.user.userId));
    const archivedBlocked = await fetch(`${baseUrl}/auth/me`, { headers: authHeaders(player.token) });
    assert.equal(archivedBlocked.status, 401);

    const restored = await json(await fetch(`${baseUrl}/admin/api/users/${player.user.userId}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ reason: 'Automated restore test' }),
    }));
    assert.equal(restored.user.archived, false);

    const bulkCoins = await json(await fetch(`${baseUrl}/admin/api/users/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        action: 'grantCoins',
        userIds: [player.user.userId],
        amount: 75,
        reason: 'Automated bulk coin test',
      }),
    }));
    assert.equal(bulkCoins.results[0].ok, true);
    assert.equal(bulkCoins.results[0].after, bulkCoins.results[0].before + 75);

    const bulkMute = await json(await fetch(`${baseUrl}/admin/api/users/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        action: 'chat_mute',
        userIds: [player.user.userId],
        durationMs: 60 * 60 * 1000,
        reason: 'Automated bulk mute test',
      }),
    }));
    assert.equal(bulkMute.results[0].ok, true);

    const relogin = await json(await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: player.user.displayName, password: 'password1' }),
    }));
    assert.equal(relogin.user.userId, player.user.userId);

    await json(await fetch(`${baseUrl}/admin/api/users/${player.user.userId}/moderation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ action: 'account_ban', reason: 'Automated admin test' }),
    }));

    const blocked = await fetch(`${baseUrl}/auth/me`, { headers: authHeaders(relogin.token) });
    assert.equal(blocked.status, 403);

    const audit = await json(await fetch(`${baseUrl}/admin/api/audit`, { headers: { Cookie: cookie } }));
    assert.ok(audit.audit.some(entry => entry.action === 'admin.users.coins.adjust'));
    assert.ok(audit.audit.some(entry => entry.action === 'admin.users.progression.adjust'));
    assert.ok(audit.audit.some(entry => entry.action === 'admin.users.archive'));
    assert.ok(audit.audit.some(entry => entry.action === 'admin.users.restore'));
    assert.ok(audit.audit.some(entry => entry.action === 'admin.users.moderation'));
    assert.ok(audit.audit.some(entry => entry.action === 'admin.users.bulk.grantCoins'));
    assert.ok(audit.audit.some(entry => entry.action === 'admin.users.bulk.chat_mute'));
  }, { SEED_ADMIN_ACCOUNT: '1' });
});

test('owner admins can manage admin accounts and email recovery unlocks password reset', async () => {
  await withServer(async (baseUrl) => {
    const owner = await adminLogin(baseUrl);

    const created = await json(await fetch(`${baseUrl}/admin/api/admins`, {
      method: 'POST',
      headers: adminHeaders(owner),
      body: JSON.stringify({
        displayName: 'Ops Admin',
        email: 'ops-admin@example.com',
        role: 'support',
        temporaryPassword: 'StrongPass9!',
        mfaCode: '123456',
        reason: 'Automated admin management test.',
      }),
    }));
    assert.equal(created.admin.role, 'support');
    assert.equal(created.admin.email, 'ops-admin@example.com');
    assert.equal(created.temporaryPassword, null);

    const supportLoginRes = await fetch(`${baseUrl}/admin/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Ops Admin', password: 'StrongPass9!' }),
    });
    const supportLogin = await json(supportLoginRes);
    const supportCookie = supportLoginRes.headers.get('set-cookie').split(';')[0];
    assert.equal(supportLogin.mfaRequired, true);
    await json(await fetch(`${baseUrl}/admin/api/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: supportCookie },
      body: JSON.stringify({ code: '123456' }),
    }));

    const forbidden = await fetch(`${baseUrl}/admin/api/admins`, { headers: { Cookie: supportCookie } });
    assert.equal(forbidden.status, 403);

    const reset = await json(await fetch(`${baseUrl}/admin/api/admins/${created.admin.adminId}/password-reset`, {
      method: 'POST',
      headers: adminHeaders(owner),
      body: JSON.stringify({ temporaryPassword: 'ResetPass9!ok', reason: 'Force a reset before lockout test.' }),
    }));
    assert.equal(reset.temporaryPassword, null);

    for (let index = 0; index < 5; index += 1) {
      const failed = await fetch(`${baseUrl}/admin/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'Ops Admin', password: 'wrong-password' }),
      });
      assert.ok(failed.status === 401 || failed.status === 429);
    }
    const locked = await fetch(`${baseUrl}/admin/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Ops Admin', password: 'ResetPass9!ok' }),
    });
    assert.equal(locked.status, 429);

    const requestRecovery = await json(await fetch(`${baseUrl}/admin/api/auth/recovery/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'ops-admin@example.com' }),
    }));
    assert.equal(requestRecovery.ok, true);

    const outbox = await json(await fetch(`${baseUrl}/admin/api/auth/recovery/test-outbox`, { headers: adminHeaders(owner) }));
    const message = outbox.messages.find(item => item.to === 'ops-admin@example.com');
    assert.ok(message?.code);

    await json(await fetch(`${baseUrl}/admin/api/auth/recovery/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'ops-admin@example.com',
        code: message.code,
        newPassword: 'RecoveredPass9!',
      }),
    }));

    const recoveredLoginRes = await fetch(`${baseUrl}/admin/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Ops Admin', password: 'RecoveredPass9!' }),
    });
    const recoveredLogin = await json(recoveredLoginRes);
    const recoveredCookie = recoveredLoginRes.headers.get('set-cookie').split(';')[0];
    await json(await fetch(`${baseUrl}/admin/api/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: recoveredCookie },
      body: JSON.stringify({ code: '123456' }),
    }));
    assert.equal(recoveredLogin.admin.displayName, 'Ops Admin');

    const audit = await json(await fetch(`${baseUrl}/admin/api/audit`, { headers: adminHeaders(owner) }));
    assert.ok(audit.audit.some(entry => entry.action === 'admin.admins.create'));
    assert.ok(audit.audit.some(entry => entry.action === 'admin.password_recovery.completed'));
  }, { SEED_ADMIN_ACCOUNT: '1', ADMIN_EMAIL_TEST_MODE: '1' });
});

test('admin competitive operations manage config, players, and ranked queues', async () => {
  await withServer(async (baseUrl) => {
    const player = await signup(baseUrl, `RankOps${Date.now()}`);

    const loginRes = await fetch(`${baseUrl}/admin/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'admin', password: 'admin9' }),
    });
    const login = await json(loginRes);
    const cookie = loginRes.headers.get('set-cookie').split(';')[0];
    assert.equal(login.mfaRequired, true);

    await json(await fetch(`${baseUrl}/admin/api/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ code: '000000' }),
    }));

    const overview = await json(await fetch(`${baseUrl}/admin/api/competitive/overview`, { headers: { Cookie: cookie } }));
    assert.ok(overview.overview.season.id);
    assert.ok(overview.overview.config.leagueBands.some(band => band.league === 'Legend'));
    assert.deepEqual(Object.keys(overview.overview.ladders), ['2', '3', '4']);

    const config = await json(await fetch(`${baseUrl}/admin/api/competitive/config`, { headers: { Cookie: cookie } }));
    assert.equal(config.live.placementMatchesRequired, 5);
    assert.equal(config.preflight.valid, true);

    const simulation = await json(await fetch(`${baseUrl}/admin/api/competitive/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ playerCount: 4, placement: 1, stage: 'established', mmr: 1000, opponentMmr: 1000 }),
    }));
    assert.equal(simulation.simulation.delta, 36);

    const draft = await json(await fetch(`${baseUrl}/admin/api/competitive/config/draft`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ reason: 'Integration test draft', config: { placementMatchesRequired: 6 } }),
    }));
    assert.equal(draft.draft.placementMatchesRequired, 6);

    const stillLive = await json(await fetch(`${baseUrl}/admin/api/competitive/config`, { headers: { Cookie: cookie } }));
    assert.equal(stillLive.live.placementMatchesRequired, 5);

    const published = await json(await fetch(`${baseUrl}/admin/api/competitive/config/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ reason: 'Integration test publish' }),
    }));
    assert.equal(published.live.placementMatchesRequired, 6);

    const adjusted = await json(await fetch(`${baseUrl}/admin/api/users/${player.user.userId}/competitive/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ reason: 'Integration test MMR correction', playerCount: 4, mmr: 2500, placementsPlayed: 6 }),
    }));
    assert.equal(adjusted.competitive.playerCount, 4);
    assert.equal(adjusted.competitive.mmr, 2500);
    assert.equal(adjusted.competitive.league.league, 'Gold');
    assert.equal(adjusted.competitive.placementComplete, true);

    const emblem = await json(await fetch(`${baseUrl}/ranked/display-emblem`, {
      method: 'PATCH',
      headers: authHeaders(player.token),
      body: JSON.stringify({ playerCount: 4, source: 'current' }),
    }));
    assert.equal(emblem.displayRankEmblem.playerCount, 4);
    assert.equal(emblem.displayRankEmblem.league.league, 'Gold');

    const rollback = await json(await fetch(`${baseUrl}/admin/api/competitive/config/rollback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ reason: 'Integration test rollback', versionId: published.version.versionId }),
    }));
    assert.equal(rollback.live.placementMatchesRequired, 5);

    await json(await fetch(`${baseUrl}/ranked/queue`, {
      method: 'POST',
      headers: authHeaders(player.token),
      body: JSON.stringify({ maxPlayers: 2, rounds: 5 }),
    }));
    const queues = await json(await fetch(`${baseUrl}/admin/api/competitive/queues`, { headers: { Cookie: cookie } }));
    assert.ok(queues.queues.some(entry => entry.userId === player.user.userId));

    const cancelled = await json(await fetch(`${baseUrl}/admin/api/competitive/queues/${player.user.userId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ reason: 'Integration test stuck queue' }),
    }));
    assert.equal(cancelled.existed, true);

    const audit = await json(await fetch(`${baseUrl}/admin/api/audit`, { headers: { Cookie: cookie } }));
    assert.ok(audit.audit.some(entry => entry.action === 'admin.competitive.config.publish'));
    assert.ok(audit.audit.some(entry => entry.action === 'admin.users.competitive.adjust'));
    assert.ok(audit.audit.some(entry => entry.action === 'admin.competitive.queue.cancel'));
  }, { SEED_ADMIN_ACCOUNT: '1' });
});

test('auth, room readiness, authoritative intents, duplicate rejection, and held-card reconnect', async () => {
  await withServer(async (baseUrl) => {
    const one = await signup(baseUrl, `One${Date.now()}`);
    const two = await signup(baseUrl, `Two${Date.now()}`);

    const created = await json(await fetch(`${baseUrl}/rooms`, {
      method: 'POST',
      headers: authHeaders(one.token),
      body: JSON.stringify({ maxPlayers: 2, rounds: 5 }),
    }));
    const code = created.room.code;

    await json(await fetch(`${baseUrl}/rooms/${code}/join`, { method: 'POST', headers: authHeaders(two.token) }));

    const socketOne = io(baseUrl, { transports: ['websocket'], auth: { token: one.token }, forceNew: true });
    const socketTwo = io(baseUrl, { transports: ['websocket'], auth: { token: two.token }, forceNew: true });
    await Promise.all([once(socketOne, 'connect'), once(socketTwo, 'connect')]);

    try {
      assert.equal((await emitAck(socketOne, 'room:join', { code })).room.code, code);
      assert.equal((await emitAck(socketTwo, 'room:join', { code })).room.code, code);
      assert.equal((await emitAck(socketOne, 'room:ready', { code, ready: true })).room.players[0].ready, true);
      assert.equal((await emitAck(socketTwo, 'room:ready', { code, ready: true })).room.players[1].ready, true);
      assert.deepEqual(await emitAck(socketOne, 'room:start', { code }), { ok: true });

      let joinOne = await emitAck(socketOne, 'room:join', { code });
      assert.equal(joinOne.game.phase, 'peek');
      assert.equal(joinOne.game.simultaneousPeek, true);
      assert.equal(joinOne.game.viewerHeldCard, null);

      const malformed = await emitAck(socketOne, 'game:intent', { code, actionId: 'bad', type: 'peek', payload: { r: 99, c: 0 } });
      assert.equal(malformed.error, 'Invalid action id.');

      assert.equal((await emitAck(socketOne, 'game:intent', { code, actionId: 'peek-one-a', type: 'peek', payload: { r: 0, c: 0 } })).ok, true);
      assert.equal((await emitAck(socketTwo, 'game:intent', { code, actionId: 'peek-two-a', type: 'peek', payload: { r: 0, c: 0 } })).ok, true);
      assert.equal((await emitAck(socketOne, 'game:intent', { code, actionId: 'peek-one-b', type: 'peek', payload: { r: 0, c: 1 } })).ok, true);
      assert.equal((await emitAck(socketTwo, 'game:intent', { code, actionId: 'peek-two-b', type: 'peek', payload: { r: 0, c: 1 } })).ok, true);

      joinOne = await emitAck(socketOne, 'room:join', { code });
      const currentUserId = joinOne.game.players[joinOne.game.currentPlayerIndex].userId;
      const currentSocket = currentUserId === one.user.userId ? socketOne : socketTwo;
      const currentToken = currentUserId === one.user.userId ? one.token : two.token;
      const otherSocket = currentUserId === one.user.userId ? socketTwo : socketOne;

      const outOfTurn = await emitAck(otherSocket, 'game:intent', { code, actionId: 'out-of-turn-draw', type: 'draw', payload: {} });
      assert.equal(outOfTurn.error, 'Not your turn.');

      const draw = await emitAck(currentSocket, 'game:intent', { code, actionId: 'current-draw', type: 'draw', payload: {} });
      assert.equal(draw.ok, true);
      assert.equal(typeof draw.drawn.rank, 'string');

      const duplicate = await emitAck(currentSocket, 'game:intent', { code, actionId: 'current-draw', type: 'draw', payload: {} });
      assert.equal(duplicate.duplicate, true);

      const secondDraw = await emitAck(currentSocket, 'game:intent', { code, actionId: 'second-draw', type: 'draw', payload: {} });
      assert.equal(secondDraw.error, 'You already have a held card.');

      const earlyDiscardDrawn = await emitAck(currentSocket, 'game:intent', {
        code,
        actionId: 'reject-early-discard-drawn',
        type: 'discard',
        payload: {},
      });
      assert.equal(earlyDiscardDrawn.error, 'Drawn cards can only be discarded when you have one face-down card left.');

      currentSocket.disconnect();
      const reconnected = io(baseUrl, { transports: ['websocket'], auth: { token: currentToken }, forceNew: true });
      await once(reconnected, 'connect');
      try {
        const rejoin = await emitAck(reconnected, 'room:join', { code });
        assert.equal(rejoin.game.viewerHeldCard.rank, draw.drawn.rank);
        assert.equal(rejoin.game.viewerHeldSource, 'draw');
        assert.equal(rejoin.game.viewerHeldCanDiscard, false);

        const prematureReplace = await emitAck(reconnected, 'game:intent', {
          code,
          actionId: 'premature-hidden-replace',
          type: 'replace',
          payload: { r: 0, c: 2 },
        });
        assert.equal(prematureReplace.error, 'Reveal that card before choosing whether to replace it.');

        const reveal = await emitAck(reconnected, 'game:intent', {
          code,
          actionId: 'reveal-hidden-card',
          type: 'reveal',
          payload: { r: 0, c: 2 },
        });
        assert.equal(reveal.ok, true);

        const revealedState = await emitAck(reconnected, 'room:join', { code });
        assert.equal(revealedState.game.pendingDecision.r, 0);
        assert.equal(revealedState.game.pendingDecision.c, 2);
        assert.equal(revealedState.game.players[revealedState.game.currentPlayerIndex].grid[0][2].faceUp, true);
        assert.equal(revealedState.game.viewerHeldCard.rank, draw.drawn.rank);
        assert.equal(revealedState.game.viewerHeldSource, 'draw');

        const keepRevealed = await emitAck(reconnected, 'game:intent', {
          code,
          actionId: 'keep-revealed-card',
          type: 'discard',
          payload: {},
        });
        assert.equal(keepRevealed.ok, true);

        const afterDecision = await emitAck(reconnected, 'room:join', { code });
        assert.equal(afterDecision.game.pendingDecision, null);
        assert.equal(afterDecision.game.viewerHeldCard, null);

        const activeUserId = afterDecision.game.players[afterDecision.game.currentPlayerIndex].userId;
        const activeSocket = activeUserId === currentUserId
          ? reconnected
          : activeUserId === one.user.userId
            ? socketOne
            : socketTwo;
        const takeDiscard = await emitAck(activeSocket, 'game:intent', {
          code,
          actionId: 'take-discard-source-lock',
          type: 'takeDiscard',
          payload: {},
        });
        assert.equal(takeDiscard.ok, true);

        const afterTakeDiscard = await emitAck(activeSocket, 'room:join', { code });
        assert.equal(afterTakeDiscard.game.viewerHeldSource, 'discard');
        assert.equal(afterTakeDiscard.game.viewerHeldMustReplace, false);

        const rejectDiscardingTakenCard = await emitAck(activeSocket, 'game:intent', {
          code,
          actionId: 'reject-discard-source-card',
          type: 'discard',
          payload: {},
        });
        assert.equal(rejectDiscardingTakenCard.error, 'Cards taken from the discard pile must be played to your grid.');

        const activePlayer = afterTakeDiscard.game.players[afterTakeDiscard.game.currentPlayerIndex];
        const hidden = activePlayer.grid.flatMap((row, r) => row.map((card, c) => ({ card, r, c }))).find(cell => cell.card && !cell.card.faceUp);
        assert.ok(hidden);

        const revealDiscardTarget = await emitAck(activeSocket, 'game:intent', {
          code,
          actionId: 'reveal-discard-source-card',
          type: 'reveal',
          payload: { r: hidden.r, c: hidden.c },
        });
        assert.equal(revealDiscardTarget.ok, true);

        const revealedDiscardState = await emitAck(activeSocket, 'room:join', { code });
        assert.equal(revealedDiscardState.game.pendingDecision.r, hidden.r);
        assert.equal(revealedDiscardState.game.pendingDecision.c, hidden.c);
        assert.equal(revealedDiscardState.game.viewerHeldSource, 'discard');

        const keepRevealedAfterDiscardTake = await emitAck(activeSocket, 'game:intent', {
          code,
          actionId: 'keep-revealed-after-discard-take',
          type: 'discard',
          payload: {},
        });
        assert.equal(keepRevealedAfterDiscardTake.ok, true);

        const afterDiscardDecision = await emitAck(activeSocket, 'room:join', { code });
        const switchUserId = afterDiscardDecision.game.players[afterDiscardDecision.game.currentPlayerIndex].userId;
        const switchSocket = switchUserId === currentUserId
          ? reconnected
          : switchUserId === one.user.userId
            ? socketOne
            : socketTwo;
        const takeForSwitch = await emitAck(switchSocket, 'game:intent', {
          code,
          actionId: 'take-discard-before-switch',
          type: 'takeDiscard',
          payload: {},
        });
        assert.equal(takeForSwitch.ok, true);
        assert.ok(takeForSwitch.drawn);

        const switchToDeck = await emitAck(switchSocket, 'game:intent', {
          code,
          actionId: 'switch-discard-to-deck',
          type: 'switchDiscardToDraw',
          payload: {},
        });
        assert.equal(switchToDeck.ok, true);
        assert.ok(switchToDeck.drawn);

        const afterSwitch = await emitAck(switchSocket, 'room:join', { code });
        assert.equal(afterSwitch.game.viewerHeldSource, 'draw');
        assert.equal(afterSwitch.game.topDiscard.id, takeForSwitch.drawn.id);
        assert.notEqual(afterSwitch.game.viewerHeldCard.id, takeForSwitch.drawn.id);
      } finally {
        reconnected.disconnect();
      }
    } finally {
      socketOne.disconnect();
      socketTwo.disconnect();
    }
  });
});

test('active playing matches force rejoin and block new tables', async () => {
  await withServer(async (baseUrl) => {
    const one = await signup(baseUrl, `ActiveOne${Date.now()}`);
    const two = await signup(baseUrl, `ActiveTwo${Date.now()}`);
    const three = await signup(baseUrl, `ActiveThree${Date.now()}`);

    const created = await json(await fetch(`${baseUrl}/rooms`, {
      method: 'POST',
      headers: authHeaders(one.token),
      body: JSON.stringify({ maxPlayers: 2, rounds: 5 }),
    }));
    const code = created.room.code;
    await json(await fetch(`${baseUrl}/rooms/${code}/join`, { method: 'POST', headers: authHeaders(two.token) }));

    const socketOne = io(baseUrl, { transports: ['websocket'], auth: { token: one.token }, forceNew: true });
    const socketTwo = io(baseUrl, { transports: ['websocket'], auth: { token: two.token }, forceNew: true });
    await Promise.all([once(socketOne, 'connect'), once(socketTwo, 'connect')]);

    try {
      assert.equal((await emitAck(socketOne, 'room:join', { code })).room.code, code);
      assert.equal((await emitAck(socketTwo, 'room:join', { code })).room.code, code);
      assert.deepEqual(await emitAck(socketOne, 'room:start', { code }), { ok: true });

      const active = await json(await fetch(`${baseUrl}/rooms/active`, { headers: authHeaders(one.token) }));
      assert.equal(active.active, true);
      assert.equal(active.mustRejoin, true);
      assert.equal(active.room.code, code);
      assert.equal(active.game.players.length, 2);

      const leave = await emitAck(socketOne, 'room:leave', { code });
      assert.equal(leave.error, 'Finish your active match before leaving the table.');
      assert.equal(leave.activeRoom.code, code);

      socketOne.disconnect();
      const activeAfterDisconnect = await json(await fetch(`${baseUrl}/rooms/active`, { headers: authHeaders(one.token) }));
      assert.equal(activeAfterDisconnect.active, true);
      assert.equal(activeAfterDisconnect.room.players.some(player => player.userId === one.user.userId), true);

      const otherRoom = await json(await fetch(`${baseUrl}/rooms`, {
        method: 'POST',
        headers: authHeaders(three.token),
        body: JSON.stringify({ maxPlayers: 2, rounds: 5 }),
      }));

      const conflictRequests = [
        fetch(`${baseUrl}/rooms`, {
          method: 'POST',
          headers: authHeaders(one.token),
          body: JSON.stringify({ maxPlayers: 2, rounds: 5 }),
        }),
        fetch(`${baseUrl}/rooms/${otherRoom.room.code}/join`, { method: 'POST', headers: authHeaders(one.token) }),
        fetch(`${baseUrl}/rooms/quick-play`, {
          method: 'POST',
          headers: authHeaders(one.token),
          body: JSON.stringify({ maxPlayers: 2, rounds: 5 }),
        }),
        fetch(`${baseUrl}/rooms/wager-play`, {
          method: 'POST',
          headers: authHeaders(one.token),
          body: JSON.stringify({ maxPlayers: 2, rounds: 5, buyIn: 50 }),
        }),
        fetch(`${baseUrl}/ranked/queue`, {
          method: 'POST',
          headers: authHeaders(one.token),
          body: JSON.stringify({ maxPlayers: 2, rounds: 9 }),
        }),
      ];

      for (const request of conflictRequests) {
        const res = await request;
        const body = await res.json();
        assert.equal(res.status, 409);
        assert.equal(body.activeRoom.code, code);
      }

      await json(await fetch(`${baseUrl}/friends/requests`, {
        method: 'POST',
        headers: authHeaders(three.token),
        body: JSON.stringify({ userId: one.user.userId }),
      }));
      const oneSocial = await json(await fetch(`${baseUrl}/social/me`, { headers: authHeaders(one.token) }));
      const requestId = oneSocial.social.incomingRequests[0].id;
      await json(await fetch(`${baseUrl}/friends/requests/${requestId}/accept`, {
        method: 'POST',
        headers: authHeaders(one.token),
      }));
      const invite = await json(await fetch(`${baseUrl}/rooms/${otherRoom.room.code}/invites`, {
        method: 'POST',
        headers: authHeaders(three.token),
        body: JSON.stringify({ userId: one.user.userId }),
      }));
      const acceptInvite = await fetch(`${baseUrl}/rooms/invites/${invite.invite.id}/accept`, {
        method: 'POST',
        headers: authHeaders(one.token),
      });
      const acceptInviteBody = await acceptInvite.json();
      assert.equal(acceptInvite.status, 409);
      assert.equal(acceptInviteBody.activeRoom.code, code);
    } finally {
      socketOne.disconnect();
      socketTwo.disconnect();
    }
  });
});

test('loads durable profile stats and completed results', async () => {
  const token = 'seed-token';
  const userId = 'seed-user';
  await withSeededServer({
    users: [{
      userId,
      displayName: 'Seed',
      passwordHash: 'unused',
      salt: 'unused',
      stats: { gamesPlayed: 3, wins: 2 },
    }],
    sessions: [{ token, userId, expiresAt: Date.now() + 60_000 }],
    results: [{
      resultId: 'result-one',
      completedAt: Date.now(),
      roomCode: 'ABCD',
      round: 5,
      totalRounds: 5,
      players: [{ userId, displayName: 'Seed', total: 12, won: true }],
    }],
  }, async (baseUrl) => {
    const profile = await json(await fetch(`${baseUrl}/auth/me`, { headers: authHeaders(token) }));
    assert.deepEqual(profile.user.stats, { gamesPlayed: 3, wins: 2 });
    assert.equal(profile.user.statistics.gamesPlayed, 3);
    assert.equal(profile.user.progression.level, 1);
    assert.equal(Object.hasOwn(profile.user.competitive, 'mmr'), false);
    assert.equal(Object.hasOwn(profile.user.competitive, 'calibrationMatchesPlayed'), false);
    assert.equal(profile.user.competitive.placementComplete, false);
    assert.equal(profile.user.competitive.league.name, 'Unranked');
    assert.ok(profile.user.achievements.some(item => item.id === 'first_match'));

    const completed = await json(await fetch(`${baseUrl}/results/me`, { headers: authHeaders(token) }));
    assert.equal(completed.results.length, 1);
    assert.equal(completed.results[0].resultId, 'result-one');
  });
});

test('records local match progression and reward summary', async () => {
  await withServer(async (baseUrl) => {
    const account = await signup(baseUrl, `Local${Date.now()}`);
    const recorded = await json(await fetch(`${baseUrl}/results/local`, {
      method: 'POST',
      headers: authHeaders(account.token),
      body: JSON.stringify({
        mode: 'solo',
        totalRounds: 5,
        roundScores: [8, 12, 6, 10, 4],
        columnClears: 1,
        players: [
          { displayName: 'Player 1', total: 40 },
          { displayName: 'Player 2', total: 55 },
        ],
      }),
    }));

    assert.equal(recorded.result.mode, 'solo');
    assert.equal(recorded.result.players[0].won, true);
    assert.ok(recorded.progression.xpGained > 0);
    assert.ok(recorded.progression.coinsGained > 0);
    assert.equal(recorded.user.statistics.gamesPlayed, 1);
    assert.equal(recorded.user.statistics.soloGames, 1);
    assert.equal(recorded.user.statistics.columnClears, 1);
    assert.ok(recorded.user.achievements.some(item => item.id === 'first_match' && item.unlockedAt));
    assert.ok(recorded.user.achievements.some(item => item.id === 'column_cleaner' && item.unlockedAt));

    const completed = await json(await fetch(`${baseUrl}/results/me`, { headers: authHeaders(account.token) }));
    assert.equal(completed.results.length, 1);
    assert.equal(completed.results[0].players[0].progression.xpGained, recorded.progression.xpGained);
  });
});

test('retries an offline local result without duplicating rewards or history', async () => {
  await withServer(async (baseUrl) => {
    const account = await signup(baseUrl, `Offline${Date.now()}`);
    const payload = {
      clientResultId: `local-test-${Date.now()}`,
      completedAt: Date.now() - 5000,
      mode: 'solo',
      totalRounds: 5,
      roundScores: [5, 7, 9, 4, 6],
      columnClears: 2,
      players: [
        { displayName: 'Player 1', total: 31 },
        { displayName: 'Player 2', total: 52 },
      ],
    };

    const first = await json(await fetch(`${baseUrl}/results/local`, {
      method: 'POST',
      headers: authHeaders(account.token),
      body: JSON.stringify(payload),
    }));
    const retried = await json(await fetch(`${baseUrl}/results/local`, {
      method: 'POST',
      headers: authHeaders(account.token),
      body: JSON.stringify(payload),
    }));

    assert.equal(retried.duplicate, true);
    assert.equal(retried.result.resultId, first.result.resultId);
    assert.equal(retried.user.statistics.gamesPlayed, 1);
    assert.equal(retried.user.currency.coins, first.user.currency.coins);
    assert.equal(retried.user.progression.totalXp, first.user.progression.totalXp);

    const completed = await json(await fetch(`${baseUrl}/results/me`, { headers: authHeaders(account.token) }));
    assert.equal(completed.results.length, 1);
    assert.equal(completed.results[0].clientResultId, payload.clientResultId);
  });
});

test('daily table bonus endpoint lets broke players rebuild on a rolling 24-hour clock', async () => {
  await withServer(async (baseUrl) => {
    const account = await signup(baseUrl, `Bonus${Date.now()}`);
    const claimed = await json(await fetch(`${baseUrl}/economy/daily-bonus/claim`, {
      method: 'POST',
      headers: authHeaders(account.token),
    }));
    assert.equal(claimed.reward, 150);
    assert.equal(claimed.user.currency.coins, 150);
    assert.equal(claimed.economy.dailyBonus.canClaim, false);
    assert.equal(
      claimed.economy.dailyBonus.nextAvailableAt - claimed.economy.dailyBonus.lastClaimedAt,
      DAY_MS
    );

    const duplicate = await fetch(`${baseUrl}/economy/daily-bonus/claim`, {
      method: 'POST',
      headers: authHeaders(account.token),
    });
    assert.equal(duplicate.status, 400);
  });
});

test('claims challenges and manages cosmetic inventory', async () => {
  await withServer(async (baseUrl) => {
    const account = await signup(baseUrl, `Shop${Date.now()}`);
    const recorded = await json(await fetch(`${baseUrl}/results/local`, {
      method: 'POST',
      headers: authHeaders(account.token),
      body: JSON.stringify({
        mode: 'solo',
        totalRounds: 5,
        roundScores: [8, 12, 6, 10, 4],
        columnClears: 1,
        players: [
          { displayName: 'Player 1', total: 40 },
          { displayName: 'Player 2', total: 55 },
        ],
      }),
    }));

    const completed = recorded.user.challenges.daily.items.find(item => item.canClaim);
    assert.ok(completed);
    const claimed = await json(await fetch(`${baseUrl}/challenges/claim`, {
      method: 'POST',
      headers: authHeaders(account.token),
      body: JSON.stringify({ challengeId: completed.id }),
    }));
    assert.ok(claimed.progression.xpGained > 0);
    assert.equal(claimed.challenge.claimedAt > 0, true);

    const catalog = await json(await fetch(`${baseUrl}/cosmetics/catalog`, { headers: authHeaders(account.token) }));
    assert.ok(catalog.cosmetics.some(item => item.id === 'gold-trim-card-back' && !item.owned));

    const purchased = await json(await fetch(`${baseUrl}/cosmetics/purchase`, {
      method: 'POST',
      headers: authHeaders(account.token),
      body: JSON.stringify({ cosmeticId: 'gold-trim-card-back' }),
    }));
    assert.equal(purchased.cosmetic.owned, true);

    const equipped = await json(await fetch(`${baseUrl}/cosmetics/equip`, {
      method: 'POST',
      headers: authHeaders(account.token),
      body: JSON.stringify({ cosmeticId: 'gold-trim-card-back' }),
    }));
    assert.equal(equipped.user.inventory.equipped.cardBack, 'gold-trim-card-back');
  });
});

test('room chat supports presets, stickers, and blocks filtered custom messages', async () => {
  await withServer(async (baseUrl) => {
    const one = await signup(baseUrl, `ChatOne${Date.now()}`);
    const two = await signup(baseUrl, `ChatTwo${Date.now()}`);
    await json(await fetch(`${baseUrl}/economy/daily-bonus/claim`, { method: 'POST', headers: authHeaders(one.token) }));

    const created = await json(await fetch(`${baseUrl}/rooms`, {
      method: 'POST',
      headers: authHeaders(one.token),
      body: JSON.stringify({ maxPlayers: 2, rounds: 5 }),
    }));
    const code = created.room.code;
    await json(await fetch(`${baseUrl}/rooms/${code}/join`, { method: 'POST', headers: authHeaders(two.token) }));

    const socketOne = io(baseUrl, { transports: ['websocket'], auth: { token: one.token }, forceNew: true });
    const socketTwo = io(baseUrl, { transports: ['websocket'], auth: { token: two.token }, forceNew: true });
    await Promise.all([once(socketOne, 'connect'), once(socketTwo, 'connect')]);

    try {
      const join = await emitAck(socketOne, 'room:join', { code });
      assert.deepEqual(join.chat, []);
      assert.equal((await emitAck(socketTwo, 'room:join', { code })).room.code, code);

      const blocked = await emitAck(socketOne, 'chat:send', { code, type: 'text', text: 'f u c k this' });
      assert.equal(blocked.error, 'Message blocked by chat filter.');

      const unknownGift = await emitAck(socketOne, 'chat:send', { code, type: 'gift', text: 'gift-missing', targetUserId: two.user.userId });
      assert.equal(unknownGift.error, 'Unknown gift.');
      const missingGiftTarget = await emitAck(socketOne, 'chat:send', { code, type: 'gift', text: 'gift-good-luck', targetUserId: 'missing-user' });
      assert.equal(missingGiftTarget.error, 'Gift target not found.');

      const received = once(socketTwo, 'chat:message');
      const sent = await emitAck(socketOne, 'chat:send', { code, type: 'preset', text: 'Nice play!' });
      assert.equal(sent.ok, true);
      assert.equal(sent.message.text, 'Nice play!');
      assert.equal(sent.message.type, 'preset');
      assert.equal(sent.message.displayName, one.user.displayName);
      assert.deepEqual((await received)[0], sent.message);

      const stickerReceived = once(socketOne, 'chat:message');
      const sticker = await emitAck(socketTwo, 'chat:send', { code, type: 'sticker', text: '\u{1F3CC}\uFE0F Nice shot' });
      assert.equal(sticker.ok, true);
      assert.equal(sticker.message.text, '\u{1F3CC}\uFE0F Nice shot');
      assert.equal(sticker.message.type, 'sticker');
      assert.deepEqual((await stickerReceived)[0], sticker.message);

      await new Promise(resolve => setTimeout(resolve, 850));
      const beforeGiftProfile = await json(await fetch(`${baseUrl}/profile/me`, { headers: authHeaders(one.token) }));
      const giftReceived = once(socketTwo, 'chat:message');
      const gift = await emitAck(socketOne, 'chat:send', { code, type: 'gift', text: 'gift-good-luck', targetUserId: two.user.userId });
      assert.equal(gift.ok, true);
      assert.equal(gift.message.type, 'gift');
      assert.equal(gift.message.text, 'Good Luck');
      assert.equal(gift.message.giftId, 'gift-good-luck');
      assert.equal(gift.message.giftIcon, '\u{1F340}');
      assert.equal(gift.message.giftPrice, 5);
      assert.equal(gift.message.targetUserId, two.user.userId);
      assert.equal(gift.message.targetDisplayName, two.user.displayName);
      assert.deepEqual((await giftReceived)[0], gift.message);
      const afterGiftProfile = await json(await fetch(`${baseUrl}/profile/me`, { headers: authHeaders(one.token) }));
      assert.equal(afterGiftProfile.user.currency.coins, beforeGiftProfile.user.currency.coins - 5);

      const rejoin = await emitAck(socketTwo, 'room:join', { code });
      assert.equal(rejoin.chat.length, 3);
      assert.equal(rejoin.chat[0].text, 'Nice play!');
      assert.equal(rejoin.chat[1].type, 'sticker');
      assert.equal(rejoin.chat[2].type, 'gift');
    } finally {
      socketOne.disconnect();
      socketTwo.disconnect();
    }
  });
});

test('friends, public profiles, and room invites work end to end', async () => {
  await withServer(async (baseUrl) => {
    const one = await signup(baseUrl, `SocialOne${Date.now()}`);
    const two = await signup(baseUrl, `SocialTwo${Date.now()}`);

    const search = await json(await fetch(`${baseUrl}/players/search?q=${encodeURIComponent(two.user.displayName.slice(0, 8))}`, {
      headers: authHeaders(one.token),
    }));
    assert.equal(search.players.some(player => player.userId === two.user.userId), true);

    const requested = await json(await fetch(`${baseUrl}/friends/requests`, {
      method: 'POST',
      headers: authHeaders(one.token),
      body: JSON.stringify({ userId: two.user.userId }),
    }));
    assert.equal(requested.social.outgoingRequests.length, 1);

    const twoSocial = await json(await fetch(`${baseUrl}/social/me`, { headers: authHeaders(two.token) }));
    assert.equal(twoSocial.social.incomingRequests.length, 1);
    assert.equal(twoSocial.social.incomingRequests[0].player.userId, one.user.userId);

    const accepted = await json(await fetch(`${baseUrl}/friends/requests/${twoSocial.social.incomingRequests[0].id}/accept`, {
      method: 'POST',
      headers: authHeaders(two.token),
    }));
    assert.equal(accepted.social.friends.some(player => player.userId === one.user.userId), true);

    const viewed = await json(await fetch(`${baseUrl}/profiles/${two.user.userId}`, { headers: authHeaders(one.token) }));
    assert.equal(viewed.profile.displayName, two.user.displayName);
    assert.equal(viewed.profile.relationship, 'friend');
    assert.equal(typeof viewed.profile.statistics.gamesPlayed, 'number');

    const created = await json(await fetch(`${baseUrl}/rooms`, {
      method: 'POST',
      headers: authHeaders(one.token),
      body: JSON.stringify({ maxPlayers: 2, rounds: 5 }),
    }));
    const invited = await json(await fetch(`${baseUrl}/rooms/${created.room.code}/invites`, {
      method: 'POST',
      headers: authHeaders(one.token),
      body: JSON.stringify({ userId: two.user.userId }),
    }));
    assert.equal(invited.invite.roomCode, created.room.code);

    const inviteInbox = await json(await fetch(`${baseUrl}/social/me`, { headers: authHeaders(two.token) }));
    assert.equal(inviteInbox.social.roomInvites.length, 1);

    const joined = await json(await fetch(`${baseUrl}/rooms/invites/${inviteInbox.social.roomInvites[0].id}/accept`, {
      method: 'POST',
      headers: authHeaders(two.token),
    }));
    assert.equal(joined.room.players.length, 2);
    assert.equal(joined.room.players.some(player => player.userId === two.user.userId), true);
  });
});

test('social summary derives recently played users from completed matches', async () => {
  const completedAt = Date.now() - 5000;
  await withSeededServer({
    users: [
      { userId: 'recent-one', displayName: 'Recent One', salt: 'unused', passwordHash: 'unused', stats: { gamesPlayed: 1, wins: 1 } },
      { userId: 'recent-two', displayName: 'Recent Two', salt: 'unused', passwordHash: 'unused', stats: { gamesPlayed: 1, wins: 0 } },
    ],
    sessions: [{ token: 'recent-token', userId: 'recent-one', expiresAt: Date.now() + 60_000 }],
    results: [{
      resultId: 'recent-result',
      completedAt,
      roomCode: 'ABCD',
      matchType: 'casual',
      mode: 'online',
      round: 5,
      totalRounds: 5,
      players: [
        { userId: 'recent-one', displayName: 'Recent One', total: 11, won: true },
        { userId: 'recent-two', displayName: 'Recent Two', total: 22, won: false },
      ],
    }],
  }, async (baseUrl) => {
    const social = await json(await fetch(`${baseUrl}/social/me`, { headers: authHeaders('recent-token') }));
    assert.equal(social.social.recentPlayers.length, 1);
    assert.equal(social.social.recentPlayers[0].userId, 'recent-two');
    assert.equal(social.social.recentPlayers[0].recent.yourTotal, 11);
    assert.equal(social.social.recentPlayers[0].recent.opponentTotal, 22);

    const profile = await json(await fetch(`${baseUrl}/profiles/recent-two`, { headers: authHeaders('recent-token') }));
    assert.equal(profile.profile.recentMatches.length, 1);
    assert.equal(profile.profile.recentMatches[0].resultId, 'recent-result');
  });
});

test('quick play joins compatible rooms and starts a full-room countdown', async () => {
  await withServer(async (baseUrl) => {
    const one = await signup(baseUrl, `QuickOne${Date.now()}`);
    const two = await signup(baseUrl, `QuickTwo${Date.now()}`);
    const createdRoom = await json(await fetch(`${baseUrl}/rooms`, {
      method: 'POST',
      headers: authHeaders(one.token),
      body: JSON.stringify({ maxPlayers: 2, rounds: 5 }),
    }));
    assert.equal(createdRoom.room.isPublic, true);

    const first = await json(await fetch(`${baseUrl}/rooms/quick-play`, {
      method: 'POST',
      headers: authHeaders(one.token),
      body: JSON.stringify({ maxPlayers: 2, rounds: 5 }),
    }));
    assert.equal(first.room.players.length, 1);
    assert.equal(first.room.countdownEndsAt, null);
    assert.equal(first.room.isPublic, true);

    const openBeforeJoin = await json(await fetch(`${baseUrl}/rooms/open?matchType=casual&maxPlayers=2&rounds=5`, {
      headers: authHeaders(two.token),
    }));
    assert.equal(openBeforeJoin.rooms.some(room => room.code === first.room.code), true);
    assert.equal(openBeforeJoin.rooms.some(room => room.code === createdRoom.room.code), true);

    const second = await json(await fetch(`${baseUrl}/rooms/quick-play`, {
      method: 'POST',
      headers: authHeaders(two.token),
      body: JSON.stringify({ maxPlayers: 2, rounds: 5 }),
    }));
    assert.equal(second.room.code, first.room.code);
    assert.equal(second.room.players.length, 2);
    assert.equal(typeof second.room.countdownEndsAt, 'number');

    const socketOne = io(baseUrl, { transports: ['websocket'], auth: { token: one.token }, forceNew: true });
    const socketTwo = io(baseUrl, { transports: ['websocket'], auth: { token: two.token }, forceNew: true });
    await Promise.all([once(socketOne, 'connect'), once(socketTwo, 'connect')]);

    try {
      assert.equal((await emitAck(socketOne, 'room:join', { code: first.room.code })).room.code, first.room.code);
      assert.equal((await emitAck(socketTwo, 'room:join', { code: first.room.code })).room.code, first.room.code);

      await new Promise(resolve => setTimeout(resolve, 150));

      const joined = await emitAck(socketOne, 'room:join', { code: first.room.code });
      assert.equal(joined.room.status, 'playing');
      assert.equal(joined.game.phase, 'peek');
      assert.equal(joined.game.totalRounds, 5);
    } finally {
      socketOne.disconnect();
      socketTwo.disconnect();
    }
  }, { ROOM_COUNTDOWN_MS: '50' });
});

test('Live Ops drains waiting lobbies, blocks old clients, and preserves active match rejoin', async () => {
  await withServer(async (baseUrl) => {
    const playingOne = await signup(baseUrl, 'LivePlayOne');
    const playingTwo = await signup(baseUrl, 'LivePlayTwo');
    const waitingHost = await signup(baseUrl, 'LiveWaiter');
    const admin = await adminLogin(baseUrl);

    const playingRoom = await json(await fetch(`${baseUrl}/rooms`, {
      method: 'POST',
      headers: authHeaders(playingOne.token),
      body: JSON.stringify({ maxPlayers: 2, rounds: 5 }),
    }));
    await json(await fetch(`${baseUrl}/rooms/${playingRoom.room.code}/join`, {
      method: 'POST',
      headers: authHeaders(playingTwo.token),
      body: '{}',
    }));
    await new Promise(resolve => setTimeout(resolve, 150));

    const activeBeforeMaintenance = await json(await fetch(`${baseUrl}/rooms/active`, {
      headers: authHeaders(playingOne.token),
    }));
    assert.equal(activeBeforeMaintenance.active, true);
    assert.equal(activeBeforeMaintenance.mustRejoin, true);
    assert.equal(activeBeforeMaintenance.room.status, 'playing');

    const waitingRoom = await json(await fetch(`${baseUrl}/rooms`, {
      method: 'POST',
      headers: authHeaders(waitingHost.token),
      body: JSON.stringify({ maxPlayers: 4, rounds: 9 }),
    }));
    const waitingSocket = io(baseUrl, { transports: ['websocket'], auth: { token: waitingHost.token }, forceNew: true });
    await once(waitingSocket, 'connect');

    try {
      assert.equal((await emitAck(waitingSocket, 'room:join', { code: waitingRoom.room.code })).room.status, 'lobby');
      const cancelledEvent = once(waitingSocket, 'room:cancelled');
      const published = await json(await fetch(`${baseUrl}/admin/api/live-ops/publish`, {
        method: 'POST',
        headers: adminHeaders(admin),
        body: JSON.stringify({
          featureKey: 'casual.create_room',
          entry: {
            state: 'maintenance',
            title: 'Custom tables are under maintenance',
            message: 'Please use Auto-Match while table tools are updated.',
          },
          reason: 'Integration test maintenance window.',
        }),
      }));
      assert.equal(published.liveOps.entries['casual.create_room'].state, 'maintenance');

      const cancellation = (await cancelledEvent)[0];
      assert.equal(cancellation.code, 'FEATURE_UNAVAILABLE');
      assert.equal(cancellation.feature, 'casual.create_room');
      assert.equal(cancellation.state, 'maintenance');

      const blocked = await fetch(`${baseUrl}/rooms`, {
        method: 'POST',
        headers: authHeaders(waitingHost.token),
        body: JSON.stringify({ maxPlayers: 2, rounds: 5 }),
      });
      const blockedBody = await blocked.json();
      assert.equal(blocked.status, 503);
      assert.equal(blockedBody.code, 'FEATURE_UNAVAILABLE');
      assert.equal(blockedBody.feature, 'casual.create_room');
      assert.equal(blockedBody.title, 'Custom tables are under maintenance');
      assert.equal(blockedBody.message, 'Please use Auto-Match while table tools are updated.');

      const openRooms = await json(await fetch(`${baseUrl}/rooms/open?matchType=casual`, {
        headers: authHeaders(waitingHost.token),
      }));
      assert.equal(openRooms.rooms.some(room => room.code === waitingRoom.room.code), false);

      const activeAfterMaintenance = await json(await fetch(`${baseUrl}/rooms/active`, {
        headers: authHeaders(playingOne.token),
      }));
      assert.equal(activeAfterMaintenance.active, true);
      assert.equal(activeAfterMaintenance.room.code, playingRoom.room.code);
      assert.equal(activeAfterMaintenance.room.status, 'playing');

      const activeSocket = io(baseUrl, { transports: ['websocket'], auth: { token: playingOne.token }, forceNew: true });
      await once(activeSocket, 'connect');
      try {
        const rejoined = await emitAck(activeSocket, 'room:join', { code: playingRoom.room.code });
        assert.equal(rejoined.room.status, 'playing');
        assert.equal(rejoined.game.phase, 'peek');
      } finally {
        activeSocket.disconnect();
      }

      await json(await fetch(`${baseUrl}/admin/api/live-ops/testers`, {
        method: 'POST',
        headers: adminHeaders(admin),
        body: JSON.stringify({
          testerUserIds: [waitingHost.user.userId],
          reason: 'Allow the internal tester through maintenance.',
        }),
      }));
      const testerPolicy = await json(await fetch(`${baseUrl}/app/availability`, {
        headers: authHeaders(waitingHost.token),
      }));
      assert.equal(testerPolicy.testerPreview, true);
      assert.equal(testerPolicy.features['casual.create_room'].state, 'live');
      assert.equal(testerPolicy.features['casual.create_room'].previewState, 'maintenance');

      const testerRoom = await json(await fetch(`${baseUrl}/rooms`, {
        method: 'POST',
        headers: authHeaders(waitingHost.token),
        body: JSON.stringify({ maxPlayers: 2, rounds: 5 }),
      }));
      assert.equal(testerRoom.room.status, 'lobby');

      await json(await fetch(`${baseUrl}/admin/api/live-ops/publish`, {
        method: 'POST',
        headers: adminHeaders(admin),
        body: JSON.stringify({
          featureKey: 'global',
          entry: {
            state: 'maintenance',
            title: 'Golf 9 maintenance',
            message: 'Online services will return soon.',
          },
          reason: 'Verify essential global-maintenance routes.',
        }),
      }));

      const profileBlocked = await fetch(`${baseUrl}/profile/me`, {
        headers: authHeaders(playingTwo.token),
      });
      assert.equal(profileBlocked.status, 503);
      assert.equal((await profileBlocked.json()).feature, 'profile');

      const inbox = await fetch(`${baseUrl}/mail`, { headers: authHeaders(playingTwo.token) });
      assert.equal(inbox.status, 200);
      const activeStillAvailable = await json(await fetch(`${baseUrl}/rooms/active`, {
        headers: authHeaders(playingTwo.token),
      }));
      assert.equal(activeStillAvailable.active, true);
      assert.equal(activeStillAvailable.room.code, playingRoom.room.code);
    } finally {
      waitingSocket.disconnect();
    }
  }, { ROOM_COUNTDOWN_MS: '50' });
});

test('release policy blocks obsolete builds while preserving update and recovery routes', async () => {
  await withServer(async (baseUrl) => {
    const player = await signup(baseUrl, 'ReleaseGate');
    const admin = await adminLogin(baseUrl);
    const oldBuildHeaders = {
      ...authHeaders(player.token),
      'X-Golf9-Platform': 'android',
      'X-Golf9-Channel': 'playtest',
      'X-Golf9-Build': '42',
      'X-Golf9-Version': '0.1.0',
    };

    const published = await json(await fetch(`${baseUrl}/admin/api/live-ops/releases/publish`, {
      method: 'POST',
      headers: adminHeaders(admin),
      body: JSON.stringify({
        platform: 'android',
        channel: 'playtest',
        entry: {
          latestBuild: 43,
          latestVersion: '0.1.0',
          minimumBuild: 43,
          storeUrl: 'https://play.google.com/store/apps/details?id=us.joinup.golf_9',
          storeReady: true,
          enforcement: 'after_match',
          requiredTitle: 'Testing update required',
          requiredMessage: 'Install Build 43 to continue online testing.',
        },
        reason: 'Verify mandatory update enforcement in integration tests.',
      }),
    }));
    assert.equal(published.releasePolicy.entries['playtest.android'].minimumBuild, 43);

    const policy = await json(await fetch(`${baseUrl}/app/release-policy`, {
      headers: oldBuildHeaders,
    }));
    assert.equal(policy.status, 'required');
    assert.equal(policy.minimumBuild, 43);

    const blockedProfile = await fetch(`${baseUrl}/profile/me`, {
      headers: oldBuildHeaders,
    });
    const blockedBody = await blockedProfile.json();
    assert.equal(blockedProfile.status, 426);
    assert.equal(blockedBody.code, 'APP_UPDATE_REQUIRED');
    assert.equal(blockedBody.release.minimumBuild, 43);
    assert.equal(blockedBody.release.title, 'Testing update required');

    const inbox = await fetch(`${baseUrl}/mail`, { headers: oldBuildHeaders });
    assert.equal(inbox.status, 200);
    const activeRoom = await fetch(`${baseUrl}/rooms/active`, { headers: oldBuildHeaders });
    assert.equal(activeRoom.status, 200);

    const currentBuildProfile = await fetch(`${baseUrl}/profile/me`, {
      headers: { ...oldBuildHeaders, 'X-Golf9-Build': '43' },
    });
    assert.equal(currentBuildProfile.status, 200);
  });
});

test('full lobby countdown stops when a player leaves and restarts when filled again', async () => {
  await withServer(async (baseUrl) => {
    const one = await signup(baseUrl, `CountdownOne${Date.now()}`);
    const two = await signup(baseUrl, `CountdownTwo${Date.now()}`);
    const three = await signup(baseUrl, `CountdownThree${Date.now()}`);

    const created = await json(await fetch(`${baseUrl}/rooms`, {
      method: 'POST',
      headers: authHeaders(one.token),
      body: JSON.stringify({ maxPlayers: 2, rounds: 5 }),
    }));
    const code = created.room.code;

    const joined = await json(await fetch(`${baseUrl}/rooms/${code}/join`, {
      method: 'POST',
      headers: authHeaders(two.token),
    }));
    assert.equal(joined.room.players.length, 2);
    assert.equal(typeof joined.room.countdownEndsAt, 'number');

    const socketOne = io(baseUrl, { transports: ['websocket'], auth: { token: one.token }, forceNew: true });
    const socketTwo = io(baseUrl, { transports: ['websocket'], auth: { token: two.token }, forceNew: true });
    await Promise.all([once(socketOne, 'connect'), once(socketTwo, 'connect')]);

    try {
      assert.equal((await emitAck(socketOne, 'room:join', { code })).room.countdownEndsAt != null, true);
      assert.equal((await emitAck(socketTwo, 'room:join', { code })).room.countdownEndsAt != null, true);
      assert.deepEqual(await emitAck(socketTwo, 'room:leave', { code }), { ok: true });

      const afterLeave = await emitAck(socketOne, 'room:join', { code });
      assert.equal(afterLeave.room.players.length, 1);
      assert.equal(afterLeave.room.countdownEndsAt, null);

      const refilled = await json(await fetch(`${baseUrl}/rooms/${code}/join`, {
        method: 'POST',
        headers: authHeaders(three.token),
      }));
      assert.equal(refilled.room.players.length, 2);
      assert.equal(typeof refilled.room.countdownEndsAt, 'number');
    } finally {
      socketOne.disconnect();
      socketTwo.disconnect();
    }
  }, { ROOM_COUNTDOWN_MS: '5000' });
});

test('ranked queue creates a human-only ranked room and starts automatically', async () => {
  await withServer(async (baseUrl) => {
    const one = await signup(baseUrl, `RankOne${Date.now()}`);
    const two = await signup(baseUrl, `RankTwo${Date.now()}`);
    await earnFreeCoins(baseUrl, one.token);
    await earnFreeCoins(baseUrl, two.token);

    const catalog = await json(await fetch(`${baseUrl}/ranked/catalog`, { headers: authHeaders(one.token) }));
    assert.equal(Object.hasOwn(catalog.catalog, 'baseMmr'), false);
    assert.equal(Object.hasOwn(catalog.catalog, 'leagueBands'), false);
    assert.equal(catalog.catalog.rankPath[0].name, 'Iron III');
    assert.equal(catalog.catalog.rankPath.at(-1).name, 'Legend');

    const first = await json(await fetch(`${baseUrl}/ranked/queue`, {
      method: 'POST',
      headers: authHeaders(one.token),
      body: JSON.stringify({ maxPlayers: 2, rounds: 5 }),
    }));
    assert.equal(first.queue.queued, true);
    assert.equal(first.queue.matchedRoomCode, null);
    assert.equal(first.queue.rounds, 9);
    assert.equal(Object.hasOwn(first.competitive, 'mmr'), false);
    assert.equal(Object.hasOwn(first.competitive, 'confidenceStage'), false);
    assert.equal(first.competitive.league.name, 'Unranked');
    assert.equal(first.competitive.playerCount, 2);

    const second = await json(await fetch(`${baseUrl}/ranked/queue`, {
      method: 'POST',
      headers: authHeaders(two.token),
      body: JSON.stringify({ maxPlayers: 2, rounds: 5 }),
    }));
    assert.equal(second.queue.queued, false);
    assert.equal(typeof second.queue.matchedRoomCode, 'string');
    assert.equal(second.queue.room.matchType, 'ranked');
    assert.equal(second.queue.room.rounds, 9);

    const firstStatus = await json(await fetch(`${baseUrl}/ranked/queue`, { headers: authHeaders(one.token) }));
    assert.equal(firstStatus.queue.matchedRoomCode, second.queue.matchedRoomCode);

    const socketOne = io(baseUrl, { transports: ['websocket'], auth: { token: one.token }, forceNew: true });
    const socketTwo = io(baseUrl, { transports: ['websocket'], auth: { token: two.token }, forceNew: true });
    await Promise.all([once(socketOne, 'connect'), once(socketTwo, 'connect')]);

    try {
      const code = second.queue.matchedRoomCode;
      assert.equal((await emitAck(socketOne, 'room:join', { code })).room.matchType, 'ranked');
      assert.equal((await emitAck(socketTwo, 'room:join', { code })).room.matchType, 'ranked');

      await new Promise(resolve => setTimeout(resolve, 150));

      const joined = await emitAck(socketOne, 'room:join', { code });
      assert.equal(joined.room.status, 'playing');
      assert.equal(joined.room.matchType, 'ranked');
      assert.equal(joined.game.totalRounds, 9);
      assert.equal(joined.game.phase, 'peek');
    } finally {
      socketOne.disconnect();
      socketTwo.disconnect();
    }
  }, { ROOM_COUNTDOWN_MS: '50' });
});

test('ranked endpoints do not retain the obsolete ranked-only build lock', async () => {
  await withServer(async (baseUrl) => {
    const account = await signup(baseUrl, `OldRank${Date.now()}`);
    const response = await fetch(`${baseUrl}/ranked/me`, {
      headers: {
        Authorization: `Bearer ${account.token}`,
        'X-Golf9-Build': '38',
        'X-Golf9-Platform': 'android',
        'X-Golf9-Channel': 'playtest',
      },
    });
    await response.json();
    assert.equal(response.status, 200);
  });
});

test('ranked is free while wager tables charge buy-ins on start', async () => {
  await withServer(async (baseUrl) => {
    const broke = await signup(baseUrl, `Broke${Date.now()}`);
    const ranked = await json(await fetch(`${baseUrl}/ranked/queue`, {
      method: 'POST',
      headers: authHeaders(broke.token),
      body: JSON.stringify({ maxPlayers: 2, rounds: 5 }),
    }));
    assert.equal(ranked.queue.queued, true);
    assert.equal(ranked.queue.buyIn, 0);
    assert.equal(ranked.queue.pot, 0);
    await json(await fetch(`${baseUrl}/ranked/queue`, { method: 'DELETE', headers: authHeaders(broke.token) }));

    const one = await signup(baseUrl, `StakeOne${Date.now()}`);
    const two = await signup(baseUrl, `StakeTwo${Date.now()}`);
    await earnFreeCoins(baseUrl, one.token);
    await earnFreeCoins(baseUrl, two.token);
    const oneBefore = await json(await fetch(`${baseUrl}/auth/me`, { headers: authHeaders(one.token) }));
    const twoBefore = await json(await fetch(`${baseUrl}/auth/me`, { headers: authHeaders(two.token) }));
    assert.ok(oneBefore.user.currency.coins >= 50);
    assert.ok(twoBefore.user.currency.coins >= 50);

    const first = await json(await fetch(`${baseUrl}/rooms/wager-play`, {
      method: 'POST',
      headers: authHeaders(one.token),
      body: JSON.stringify({ maxPlayers: 2, rounds: 5, buyIn: 50 }),
    }));
    assert.equal(first.room.matchType, 'wager');
    assert.equal(first.room.economy.buyIn, 50);

    const second = await json(await fetch(`${baseUrl}/rooms/wager-play`, {
      method: 'POST',
      headers: authHeaders(two.token),
      body: JSON.stringify({ maxPlayers: 2, rounds: 5, buyIn: 50 }),
    }));
    assert.equal(second.room.code, first.room.code);
    assert.equal(second.room.economy.pot, 100);

    await new Promise(resolve => setTimeout(resolve, 150));

    const oneAfter = await json(await fetch(`${baseUrl}/auth/me`, { headers: authHeaders(one.token) }));
    const twoAfter = await json(await fetch(`${baseUrl}/auth/me`, { headers: authHeaders(two.token) }));
    assert.equal(oneAfter.user.currency.coins, oneBefore.user.currency.coins - 50);
    assert.equal(twoAfter.user.currency.coins, twoBefore.user.currency.coins - 50);
  }, { ROOM_COUNTDOWN_MS: '50' });
});

test('clubs create, search, request, approve, chat, and ignore local matches', async () => {
  await withServer(async (baseUrl) => {
    const owner = await signup(baseUrl, `ClubOwner${Date.now()}`);
    const member = await signup(baseUrl, `ClubMember${Date.now()}`);
    const outsider = await signup(baseUrl, `ClubNope${Date.now()}`);
    const lowLevelInvitee = await signup(baseUrl, `ClubLow${Date.now()}`);
    const admin = await adminLogin(baseUrl);

    const legacyDefault = await json(await fetch(`${baseUrl}/auth/me`, { headers: authHeaders(owner.token) }));
    assert.equal(legacyDefault.user.club, null);

    const lockedCreate = await fetch(`${baseUrl}/clubs`, {
      method: 'POST',
      headers: authHeaders(owner.token),
      body: JSON.stringify({ name: 'Too Soon Crew', tag: 'SOON' }),
    });
    assert.equal(lockedCreate.status, 403);

    await earnClubLevel(baseUrl, owner.token);
    await adminAdjustCoins(baseUrl, admin, owner.user.userId, 5000);

    const created = await json(await fetch(`${baseUrl}/clubs`, {
      method: 'POST',
      headers: authHeaders(owner.token),
      body: JSON.stringify({
        name: 'Fairway Crew',
        tag: 'FWC',
        motto: 'Low totals together',
        branding: { colorPair: 'gold', badgeShape: 'crest', bannerStyle: 'champion' },
      }),
    }));
    assert.equal(created.club.name, 'Fairway Crew');
    assert.equal(created.club.role, 'owner');
    assert.equal(created.club.memberCount, 1);
    assert.equal(created.club.prestige.tier, 1);
    assert.equal(created.club.progression.memberCap, 15);
    assert.equal(created.user.currency.coins >= 0, true);

    const openInvite = await json(await fetch(`${baseUrl}/clubs/${created.club.clubId}/invites`, {
      method: 'POST',
      headers: authHeaders(owner.token),
      body: JSON.stringify({ userId: lowLevelInvitee.user.userId }),
    }));
    assert.equal(openInvite.invite.userId, lowLevelInvitee.user.userId);
    const lowLevelInbox = await json(await fetch(`${baseUrl}/clubs/me`, { headers: authHeaders(lowLevelInvitee.token) }));
    assert.equal(lowLevelInbox.invitations.length, 1);
    await json(await fetch(`${baseUrl}/clubs/${created.club.clubId}/invites/${openInvite.invite.id}`, {
      method: 'DELETE',
      headers: authHeaders(lowLevelInvitee.token),
    }));

    const bulkClubFreeze = await json(await fetch(`${baseUrl}/admin/api/clubs/bulk`, {
      method: 'POST',
      headers: adminHeaders(admin),
      body: JSON.stringify({
        action: 'freeze',
        clubIds: [created.club.clubId],
        reason: 'Automated bulk freeze test',
      }),
    }));
    assert.equal(bulkClubFreeze.results[0].ok, true);
    const adminClubFrozen = await json(await fetch(`${baseUrl}/admin/api/clubs/${created.club.clubId}`, { headers: adminHeaders(admin) }));
    assert.ok(adminClubFrozen.club.adminStatus.frozenAt);

    const bulkClubAnnounce = await json(await fetch(`${baseUrl}/admin/api/clubs/bulk`, {
      method: 'POST',
      headers: adminHeaders(admin),
      body: JSON.stringify({
        action: 'announce',
        clubIds: [created.club.clubId],
        text: 'Bulk announcement test.',
        reason: 'Automated bulk announcement test',
      }),
    }));
    assert.equal(bulkClubAnnounce.results[0].ok, true);

    await json(await fetch(`${baseUrl}/admin/api/clubs/bulk`, {
      method: 'POST',
      headers: adminHeaders(admin),
      body: JSON.stringify({
        action: 'unfreeze',
        clubIds: [created.club.clubId],
        reason: 'Automated bulk unfreeze test',
      }),
    }));

    const searched = await json(await fetch(`${baseUrl}/clubs/search?q=Fairway`, { headers: authHeaders(member.token) }));
    assert.equal(searched.clubs.some(club => club.clubId === created.club.clubId), true);

    const requested = await json(await fetch(`${baseUrl}/clubs/${created.club.clubId}/requests`, {
      method: 'POST',
      headers: authHeaders(member.token),
      body: JSON.stringify({ message: 'I play daily.' }),
    }));
    assert.equal(requested.club.clubId, created.club.clubId);

    const rejectedRequest = await json(await fetch(`${baseUrl}/clubs/${created.club.clubId}/requests`, {
      method: 'POST',
      headers: authHeaders(outsider.token),
      body: JSON.stringify({ message: 'Let me in.' }),
    }));
    const inbox = await json(await fetch(`${baseUrl}/clubs/me`, { headers: authHeaders(owner.token) }));
    assert.equal(inbox.club.joinRequests.length, 2);

    const reject = await json(await fetch(`${baseUrl}/clubs/${created.club.clubId}/requests/${rejectedRequest.request.id}/reject`, {
      method: 'POST',
      headers: authHeaders(owner.token),
    }));
    assert.equal(reject.club.joinRequests.length, 1);

    const accept = await json(await fetch(`${baseUrl}/clubs/${created.club.clubId}/requests/${requested.request.id}/accept`, {
      method: 'POST',
      headers: authHeaders(owner.token),
    }));
    assert.equal(accept.club.memberCount, 2);
    assert.equal(accept.club.members.some(item => item.userId === member.user.userId && item.role === 'rookie'), true);

    const memberGoal = await fetch(`${baseUrl}/clubs/${created.club.clubId}/treasury-goal`, {
      method: 'PUT',
      headers: authHeaders(member.token),
      body: JSON.stringify({ title: 'Not allowed', targetAmount: 1000 }),
    });
    assert.equal(memberGoal.status, 403);
    const goal = await json(await fetch(`${baseUrl}/clubs/${created.club.clubId}/treasury-goal`, {
      method: 'PUT',
      headers: authHeaders(owner.token),
      body: JSON.stringify({ title: 'Club tournament', description: 'Fund the next event.', targetAmount: 12500 }),
    }));
    assert.equal(goal.club.treasuryGoal.title, 'Club tournament');
    const clearedGoal = await json(await fetch(`${baseUrl}/clubs/${created.club.clubId}/treasury-goal`, {
      method: 'DELETE',
      headers: authHeaders(owner.token),
    }));
    assert.equal(clearedGoal.club.treasuryGoal, null);

    const invitation = await json(await fetch(`${baseUrl}/clubs/${created.club.clubId}/invites`, {
      method: 'POST',
      headers: authHeaders(owner.token),
      body: JSON.stringify({ userId: outsider.user.userId }),
    }));
    const outsiderInbox = await json(await fetch(`${baseUrl}/clubs/me`, { headers: authHeaders(outsider.token) }));
    assert.equal(outsiderInbox.club, null);
    assert.equal(outsiderInbox.invitations.some(item => item.id === invitation.invite.id), true);
    const declined = await json(await fetch(`${baseUrl}/clubs/${created.club.clubId}/invites/${invitation.invite.id}`, {
      method: 'DELETE',
      headers: authHeaders(outsider.token),
    }));
    assert.equal(declined.invitations.length, 0);

    const secondInvitation = await json(await fetch(`${baseUrl}/clubs/${created.club.clubId}/invites`, {
      method: 'POST',
      headers: authHeaders(owner.token),
      body: JSON.stringify({ userId: outsider.user.userId }),
    }));
    const duplicateInvitation = await json(await fetch(`${baseUrl}/clubs/${created.club.clubId}/invites`, {
      method: 'POST',
      headers: authHeaders(owner.token),
      body: JSON.stringify({ userId: outsider.user.userId }),
    }));
    assert.equal(duplicateInvitation.invite.id, secondInvitation.invite.id);
    const duplicateInbox = await json(await fetch(`${baseUrl}/clubs/me`, { headers: authHeaders(outsider.token) }));
    assert.equal(duplicateInbox.invitations.length, 1);
    const invitationAccepted = await json(await fetch(`${baseUrl}/clubs/${created.club.clubId}/invites/${secondInvitation.invite.id}/accept`, {
      method: 'POST',
      headers: authHeaders(outsider.token),
    }));
    assert.equal(invitationAccepted.club.memberCount, 3);
    assert.equal(invitationAccepted.invitations.length, 0);

    const forbiddenEdit = await fetch(`${baseUrl}/clubs/${created.club.clubId}`, {
      method: 'PATCH',
      headers: authHeaders(member.token),
      body: JSON.stringify({ motto: 'Taking over.' }),
    });
    assert.equal(forbiddenEdit.status, 403);

    await json(await fetch(`${baseUrl}/results/local`, {
      method: 'POST',
      headers: authHeaders(owner.token),
      body: JSON.stringify({
        mode: 'solo',
        totalRounds: 5,
        roundScores: [2, 3, 4, 5, 6],
        columnClears: 3,
        players: [
          { displayName: 'Player 1', total: 10 },
          { displayName: 'Player 2', total: 44 },
        ],
      }),
    }));
    const afterLocal = await json(await fetch(`${baseUrl}/clubs/me`, { headers: authHeaders(owner.token) }));
    assert.equal(afterLocal.club.progression.totalXp, 0);
    assert.equal(afterLocal.club.goals.weekly.every(goal => goal.progress === 0), true);

    const bulkClubXp = await json(await fetch(`${baseUrl}/admin/api/clubs/bulk`, {
      method: 'POST',
      headers: adminHeaders(admin),
      body: JSON.stringify({
        action: 'adjustXp',
        clubIds: [created.club.clubId],
        amount: 250,
        reason: 'Automated bulk club XP test',
      }),
    }));
    assert.equal(bulkClubXp.results[0].ok, true);
    assert.equal(bulkClubXp.results[0].after, bulkClubXp.results[0].before + 250);

    const socketOwner = io(baseUrl, { transports: ['websocket'], auth: { token: owner.token }, forceNew: true });
    const socketMember = io(baseUrl, { transports: ['websocket'], auth: { token: member.token }, forceNew: true });
    await Promise.all([once(socketOwner, 'connect'), once(socketMember, 'connect')]);
    try {
      const ownerJoin = await emitAck(socketOwner, 'club:join', { clubId: created.club.clubId });
      const memberJoin = await emitAck(socketMember, 'club:join', { clubId: created.club.clubId });
      assert.equal(ownerJoin.club.clubId, created.club.clubId);
      assert.equal(memberJoin.chat.length, 0);
      assert.equal(ownerJoin.club.onlineMemberCount >= 2, true);
      assert.equal(ownerJoin.club.members.find(item => item.userId === owner.user.userId).isOnline, true);

      const presenceUpdate = once(socketOwner, 'club:presence');
      const backgrounded = await emitAck(socketMember, 'club:presence:state', { foreground: false });
      assert.equal(backgrounded.ok, true);
      const presence = (await presenceUpdate)[0];
      assert.equal(presence.onlineUserIds.includes(member.user.userId), false);
      await emitAck(socketMember, 'club:presence:state', { foreground: true });

      const blocked = await emitAck(socketMember, 'club:chat:send', { clubId: created.club.clubId, type: 'text', text: 'f u c k this' });
      assert.equal(blocked.error, 'Message blocked by chat filter.');

      const received = once(socketOwner, 'club:chat:message');
      const sent = await emitAck(socketMember, 'club:chat:send', { clubId: created.club.clubId, type: 'preset', text: 'Nice play!' });
      assert.equal(sent.ok, true);
      assert.equal(sent.message.text, 'Nice play!');
      assert.deepEqual((await received)[0], sent.message);

      const socketLate = io(baseUrl, { transports: ['websocket'], auth: { token: owner.token }, forceNew: true });
      await once(socketLate, 'connect');
      try {
        const lateJoin = await emitAck(socketLate, 'club:join', { clubId: created.club.clubId });
        assert.equal(lateJoin.club.clubId, created.club.clubId);
        assert.equal(lateJoin.chat.length, 0);
        assert.equal(lateJoin.club.chat.length, 0);
      } finally {
        socketLate.disconnect();
      }
    } finally {
      socketOwner.disconnect();
      socketMember.disconnect();
    }
  });
});
