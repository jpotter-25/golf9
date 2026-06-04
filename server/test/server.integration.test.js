import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { io } = require('../../client/node_modules/socket.io-client');

function port() {
  return 4300 + Math.floor(Math.random() * 1000);
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
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function emitAck(socket, event, payload) {
  return new Promise(resolve => socket.emit(event, payload, resolve));
}

async function signup(baseUrl, displayName) {
  return json(await fetch(`${baseUrl}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName, password: 'password1' }),
  }));
}

async function withServer(fn) {
  const serverPort = port();
  const dataDir = await mkdtemp(path.join(tmpdir(), 'golf9-server-test-'));
  const child = spawn(process.execPath, ['index.js'], {
    cwd: path.resolve('..', 'server'),
    env: { ...process.env, PORT: String(serverPort), DATA_DIR: dataDir, CLIENT_ORIGINS: '*' },
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
      assert.equal(joinOne.game.viewerHeldCard, null);

      const malformed = await emitAck(socketOne, 'game:intent', { code, actionId: 'bad', type: 'peek', payload: { r: 99, c: 0 } });
      assert.equal(malformed.error, 'Invalid action id.');

      assert.equal((await emitAck(socketOne, 'game:intent', { code, actionId: 'peek-one-a', type: 'peek', payload: { r: 0, c: 0 } })).ok, true);
      assert.equal((await emitAck(socketOne, 'game:intent', { code, actionId: 'peek-one-b', type: 'peek', payload: { r: 0, c: 1 } })).ok, true);
      assert.equal((await emitAck(socketTwo, 'game:intent', { code, actionId: 'peek-two-a', type: 'peek', payload: { r: 0, c: 0 } })).ok, true);
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

      currentSocket.disconnect();
      const reconnected = io(baseUrl, { transports: ['websocket'], auth: { token: currentToken }, forceNew: true });
      await once(reconnected, 'connect');
      try {
        const rejoin = await emitAck(reconnected, 'room:join', { code });
        assert.equal(rejoin.game.viewerHeldCard.rank, draw.drawn.rank);
      } finally {
        reconnected.disconnect();
      }
    } finally {
      socketOne.disconnect();
      socketTwo.disconnect();
    }
  });
});
