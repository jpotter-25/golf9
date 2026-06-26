import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { io } = require('socket.io-client');

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

function adminHeaders(session) {
  return { 'Content-Type': 'application/json', Cookie: session.cookie };
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

async function withServer(fn, extraEnv = {}) {
  const serverPort = port();
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
  const serverPort = port();
  const dataDir = await mkdtemp(path.join(tmpdir(), 'golf9-server-test-'));
  await mkdir(dataDir, { recursive: true });
  await writeFile(path.join(dataDir, 'auth-store.json'), JSON.stringify(seed, null, 2));
  await fnWithServer(dataDir, serverPort, fn);
}

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

test('pre-alpha invite gate blocks open signup and consumes admin-created invites once', async () => {
  await withServer(async (baseUrl) => {
    const config = await json(await fetch(`${baseUrl}/auth/config`));
    assert.equal(config.inviteRequired, true);

    const blocked = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: `NoInvite${Date.now()}`, password: 'password1' }),
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
      body: JSON.stringify({ displayName: `Invited${Date.now()}`, password: 'password1', inviteCode: 'ALPHA1' }),
    }));
    assert.ok(accepted.token);

    const invites = await json(await fetch(`${baseUrl}/admin/api/invites`, { headers: adminHeaders(admin) }));
    assert.equal(invites.invites[0].uses.length, 1);
    assert.equal(invites.invites[0].status, 'exhausted');

    const exhausted = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: `Late${Date.now()}`, password: 'password1', inviteCode: 'ALPHA1' }),
    });
    assert.equal(exhausted.status, 403);
  }, { REQUIRE_INVITE_CODE: '1', SEED_ADMIN_ACCOUNT: '1' });
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

    const tickets = await json(await fetch(`${baseUrl}/admin/api/support/tickets`, { headers: { Cookie: cookie } }));
    assert.ok(tickets.tickets.some(item => item.ticketId === ticket.ticket.ticketId));

    await json(await fetch(`${baseUrl}/admin/api/users/${player.user.userId}/moderation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ action: 'account_ban', reason: 'Automated admin test' }),
    }));

    const blocked = await fetch(`${baseUrl}/auth/me`, { headers: authHeaders(player.token) });
    assert.equal(blocked.status, 403);

    const audit = await json(await fetch(`${baseUrl}/admin/api/audit`, { headers: { Cookie: cookie } }));
    assert.ok(audit.audit.some(entry => entry.action === 'admin.users.coins.adjust'));
    assert.ok(audit.audit.some(entry => entry.action === 'admin.users.moderation'));
  }, { SEED_ADMIN_ACCOUNT: '1' });
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

    const config = await json(await fetch(`${baseUrl}/admin/api/competitive/config`, { headers: { Cookie: cookie } }));
    assert.equal(config.live.placementMatchesRequired, 5);

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
      body: JSON.stringify({ reason: 'Integration test MMR correction', mmr: 2050, placementsPlayed: 6 }),
    }));
    assert.equal(adjusted.competitive.mmr, 2050);
    assert.equal(adjusted.competitive.league.league, 'Gold');
    assert.equal(adjusted.competitive.placementComplete, true);

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
    assert.equal(profile.user.competitive.mmr, 1000);
    assert.equal(profile.user.competitive.league.name, 'Silver III');
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

test('daily table bonus endpoint lets broke players rebuild once per day', async () => {
  await withServer(async (baseUrl) => {
    const account = await signup(baseUrl, `Bonus${Date.now()}`);
    const claimed = await json(await fetch(`${baseUrl}/economy/daily-bonus/claim`, {
      method: 'POST',
      headers: authHeaders(account.token),
    }));
    assert.equal(claimed.reward, 150);
    assert.equal(claimed.user.currency.coins, 150);
    assert.equal(claimed.economy.dailyBonus.canClaim, false);

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

      const rejoin = await emitAck(socketTwo, 'room:join', { code });
      assert.equal(rejoin.chat.length, 2);
      assert.equal(rejoin.chat[0].text, 'Nice play!');
      assert.equal(rejoin.chat[1].type, 'sticker');
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
    const privateRoom = await json(await fetch(`${baseUrl}/rooms`, {
      method: 'POST',
      headers: authHeaders(one.token),
      body: JSON.stringify({ maxPlayers: 2, rounds: 5 }),
    }));

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
    assert.equal(openBeforeJoin.rooms.some(room => room.code === privateRoom.room.code), false);

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

test('ranked queue creates a human-only ranked room and starts automatically', async () => {
  await withServer(async (baseUrl) => {
    const one = await signup(baseUrl, `RankOne${Date.now()}`);
    const two = await signup(baseUrl, `RankTwo${Date.now()}`);
    await earnFreeCoins(baseUrl, one.token);
    await earnFreeCoins(baseUrl, two.token);

    const first = await json(await fetch(`${baseUrl}/ranked/queue`, {
      method: 'POST',
      headers: authHeaders(one.token),
      body: JSON.stringify({ maxPlayers: 2, rounds: 5 }),
    }));
    assert.equal(first.queue.queued, true);
    assert.equal(first.queue.matchedRoomCode, null);
    assert.equal(first.queue.rounds, 9);
    assert.equal(first.competitive.mmr, 1000);
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

    const legacyDefault = await json(await fetch(`${baseUrl}/auth/me`, { headers: authHeaders(owner.token) }));
    assert.equal(legacyDefault.user.club, null);

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

    const socketOwner = io(baseUrl, { transports: ['websocket'], auth: { token: owner.token }, forceNew: true });
    const socketMember = io(baseUrl, { transports: ['websocket'], auth: { token: member.token }, forceNew: true });
    await Promise.all([once(socketOwner, 'connect'), once(socketMember, 'connect')]);
    try {
      const ownerJoin = await emitAck(socketOwner, 'club:join', { clubId: created.club.clubId });
      const memberJoin = await emitAck(socketMember, 'club:join', { clubId: created.club.clubId });
      assert.equal(ownerJoin.club.clubId, created.club.clubId);
      assert.equal(memberJoin.chat.length, 0);

      const blocked = await emitAck(socketMember, 'club:chat:send', { clubId: created.club.clubId, type: 'text', text: 'f u c k this' });
      assert.equal(blocked.error, 'Message blocked by chat filter.');

      const received = once(socketOwner, 'club:chat:message');
      const sent = await emitAck(socketMember, 'club:chat:send', { clubId: created.club.clubId, type: 'preset', text: 'Nice play!' });
      assert.equal(sent.ok, true);
      assert.equal(sent.message.text, 'Nice play!');
      assert.deepEqual((await received)[0], sent.message);
    } finally {
      socketOwner.disconnect();
      socketMember.disconnect();
    }
  });
});
