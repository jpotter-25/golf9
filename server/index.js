// index.js
// Purpose: Authoritative Golf 9 API + Socket.IO server for auth, rooms, and online game state.

import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import {
  createGameState,
  discardDrawn,
  drawFromDeck,
  flipForPeek,
  publicGameState,
  replaceGridCard,
  resolveExpiredTimers,
  sanitizePlayerIdentity,
  takeDiscard,
} from '../shared/rules.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'auth-store.json');
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const ROOM_TTL_MS = 1000 * 60 * 60 * 2;
const PORT = process.env.PORT || 3001;
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGINS || '*').split(',');

const app = express();
app.use(cors({ origin: CLIENT_ORIGINS.includes('*') ? '*' : CLIENT_ORIGINS, credentials: true }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: CLIENT_ORIGINS.includes('*') ? '*' : CLIENT_ORIGINS } });

/** @type {Map<string, { userId: string; displayName: string; passwordHash: string; salt: string; stats: { gamesPlayed: number; wins: number } }>} */
const users = new Map();
/** @type {Map<string, { token: string; userId: string; expiresAt: number }>} */
const sessions = new Map();
/** @type {Map<string, any>} */
const rooms = new Map();
/** @type {Map<string, { roomCode: string; userId: string }>} */
const sockets = new Map();

function loadStore() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    for (const user of parsed.users || []) users.set(user.userId, user);
    for (const session of parsed.sessions || []) {
      if (session.expiresAt > Date.now()) sessions.set(session.token, session);
    }
  } catch {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    saveStore();
  }
}

function saveStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify({ users: [...users.values()], sessions: [...sessions.values()] }, null, 2));
}

function makeCode() {
  let code = crypto.randomBytes(3).toString('hex').slice(0, 4).toUpperCase();
  while (rooms.has(code)) code = crypto.randomBytes(3).toString('hex').slice(0, 4).toUpperCase();
  return code;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const passwordHash = crypto.pbkdf2Sync(password, salt, 120_000, 32, 'sha256').toString('hex');
  return { salt, passwordHash };
}

function safeUser(user) {
  return {
    userId: user.userId,
    displayName: user.displayName,
    avatarInitial: user.displayName.trim().slice(0, 1).toUpperCase(),
    stats: user.stats || { gamesPlayed: 0, wins: 0 },
  };
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const session = { token, userId, expiresAt: Date.now() + SESSION_TTL_MS };
  sessions.set(token, session);
  saveStore();
  return session;
}

function authenticateToken(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (session) sessions.delete(token);
    return null;
  }
  const user = users.get(session.userId);
  return user ? { session, user } : null;
}

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const auth = authenticateToken(token);
  if (!auth) return res.status(401).json({ error: 'Authentication required.' });
  req.auth = auth;
  return next();
}

function roomSummary(room) {
  return {
    code: room.code,
    hostUserId: room.hostUserId,
    status: room.status,
    maxPlayers: room.maxPlayers,
    rounds: room.rounds,
    players: room.players.map(player => ({
      userId: player.userId,
      displayName: player.displayName,
      avatarInitial: player.avatarInitial,
      ready: room.ready.get(player.userId) || false,
      connected: room.connected.get(player.userId) || false,
      isHost: player.userId === room.hostUserId,
    })),
  };
}

function broadcastRoom(room) {
  io.to(room.code).emit('room:update', roomSummary(room));
  if (room.game) {
    for (const player of room.players) {
      io.to(`${room.code}:${player.userId}`).emit('game:state', publicGameState(room.game, player.userId, room.held.get(player.userId) || null));
    }
  }
}

function getRoomPlayerIndex(room, userId) {
  return room.game?.players.findIndex(player => player.userId === userId) ?? -1;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isGridCoord(value) {
  return Number.isInteger(value) && value >= 0 && value < 3;
}

function validateIntent({ actionId, type, payload }) {
  if (typeof actionId !== 'string' || actionId.length < 8 || actionId.length > 80) return 'Invalid action id.';
  if (!['peek', 'draw', 'takeDiscard', 'replace', 'discard'].includes(type)) return 'Unknown action.';
  if (payload !== undefined && !isObject(payload)) return 'Invalid action payload.';
  if (type === 'peek' || type === 'replace') {
    if (!isGridCoord(payload?.r) || !isGridCoord(payload?.c)) return 'Invalid grid coordinates.';
  }
  return null;
}

function rememberActionId(room, actionId) {
  room.processedActionIds.add(actionId);
  if (room.processedActionIds.size > 250) {
    const oldest = room.processedActionIds.values().next().value;
    room.processedActionIds.delete(oldest);
  }
}

function makeRoom(hostUser, { maxPlayers = 4, rounds = 9 } = {}) {
  const code = makeCode();
  const host = safeUser(hostUser);
  const room = {
    code,
    hostUserId: host.userId,
    maxPlayers: Math.max(2, Math.min(4, Number(maxPlayers) || 4)),
    rounds: Number(rounds) === 5 ? 5 : 9,
    status: 'lobby',
    players: [host],
    ready: new Map([[host.userId, false]]),
    connected: new Map([[host.userId, false]]),
    game: null,
    processedActionIds: new Set(),
    held: new Map(),
    updatedAt: Date.now(),
  };
  rooms.set(code, room);
  return room;
}

function startRoomGame(room) {
  if (room.players.length < 2) throw new Error('At least two players are required.');
  if (!room.players.every(player => room.ready.get(player.userId))) throw new Error('All players must be ready.');
  room.status = 'playing';
  room.held = new Map();
  room.game = createGameState(room.players.map(sanitizePlayerIdentity), { totalRounds: room.rounds });
  room.updatedAt = Date.now();
}

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/auth/signup', (req, res) => {
  const displayName = String(req.body.displayName || '').trim();
  const password = String(req.body.password || '');
  if (displayName.length < 2) return res.status(400).json({ error: 'Display name must be at least 2 characters.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  const duplicate = [...users.values()].find(user => user.displayName.toLowerCase() === displayName.toLowerCase());
  if (duplicate) return res.status(409).json({ error: 'Display name is already taken.' });
  const userId = crypto.randomUUID();
  const { salt, passwordHash } = hashPassword(password);
  const user = { userId, displayName, salt, passwordHash, stats: { gamesPlayed: 0, wins: 0 } };
  users.set(userId, user);
  const session = createSession(userId);
  saveStore();
  return res.json({ token: session.token, user: safeUser(user) });
});

app.post('/auth/login', (req, res) => {
  const displayName = String(req.body.displayName || '').trim();
  const password = String(req.body.password || '');
  const user = [...users.values()].find(item => item.displayName.toLowerCase() === displayName.toLowerCase());
  if (!user) return res.status(401).json({ error: 'Invalid credentials.' });
  const { passwordHash } = hashPassword(password, user.salt);
  if (passwordHash !== user.passwordHash) return res.status(401).json({ error: 'Invalid credentials.' });
  const session = createSession(user.userId);
  return res.json({ token: session.token, user: safeUser(user) });
});

app.post('/auth/logout', requireAuth, (req, res) => {
  sessions.delete(req.auth.session.token);
  saveStore();
  return res.json({ ok: true });
});

app.get('/auth/me', requireAuth, (req, res) => res.json({ user: safeUser(req.auth.user) }));

app.post('/rooms', requireAuth, (req, res) => {
  const room = makeRoom(req.auth.user, req.body || {});
  return res.json({ room: roomSummary(room) });
});

app.post('/rooms/:code/join', requireAuth, (req, res) => {
  const room = rooms.get(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found.' });
  if (room.status !== 'lobby') return res.status(409).json({ error: 'Game already started.' });
  if (!room.players.some(player => player.userId === req.auth.user.userId)) {
    if (room.players.length >= room.maxPlayers) return res.status(409).json({ error: 'Room is full.' });
    const user = safeUser(req.auth.user);
    room.players.push(user);
    room.ready.set(user.userId, false);
    room.connected.set(user.userId, false);
  }
  room.updatedAt = Date.now();
  broadcastRoom(room);
  return res.json({ room: roomSummary(room) });
});

function socketAuth(socket) {
  const token = socket.handshake.auth?.token;
  return authenticateToken(token);
}

io.use((socket, next) => {
  const auth = socketAuth(socket);
  if (!auth) return next(new Error('Authentication required.'));
  socket.auth = auth;
  return next();
});

io.on('connection', (socket) => {
  socket.on('room:join', ({ code }, cb = () => {}) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room) return cb({ error: 'Room not found.' });
    const userId = socket.auth.user.userId;
    if (!room.players.some(player => player.userId === userId)) return cb({ error: 'You are not a member of this room.' });
    socket.join(room.code);
    socket.join(`${room.code}:${userId}`);
    sockets.set(socket.id, { roomCode: room.code, userId });
    room.connected.set(userId, true);
    room.updatedAt = Date.now();
    broadcastRoom(room);
    return cb({ room: roomSummary(room), game: room.game ? publicGameState(room.game, userId, room.held.get(userId) || null) : null });
  });

  socket.on('room:ready', ({ code, ready }, cb = () => {}) => {
    const room = rooms.get(String(code || '').toUpperCase());
    const userId = socket.auth.user.userId;
    if (!room || !room.players.some(player => player.userId === userId)) return cb({ error: 'Room not found.' });
    if (room.status !== 'lobby') return cb({ error: 'Game already started.' });
    room.ready.set(userId, Boolean(ready));
    room.updatedAt = Date.now();
    broadcastRoom(room);
    return cb({ room: roomSummary(room) });
  });

  socket.on('room:start', ({ code }, cb = () => {}) => {
    const room = rooms.get(String(code || '').toUpperCase());
    const userId = socket.auth.user.userId;
    if (!room) return cb({ error: 'Room not found.' });
    if (room.hostUserId !== userId) return cb({ error: 'Only the host can start.' });
    try {
      startRoomGame(room);
      broadcastRoom(room);
      return cb({ ok: true });
    } catch (error) {
      return cb({ error: error.message });
    }
  });

  socket.on('room:leave', ({ code }, cb = () => {}) => {
    const room = rooms.get(String(code || '').toUpperCase());
    const userId = socket.auth.user.userId;
    if (!room) return cb({ ok: true });
    room.players = room.players.filter(player => player.userId !== userId);
    room.ready.delete(userId);
    room.connected.delete(userId);
    if (room.hostUserId === userId && room.players.length) room.hostUserId = room.players[0].userId;
    if (!room.players.length) rooms.delete(room.code);
    else broadcastRoom(room);
    socket.leave(room.code);
    socket.leave(`${room.code}:${userId}`);
    return cb({ ok: true });
  });

  socket.on('game:intent', ({ code, actionId, type, payload = {} }, cb = () => {}) => {
    const validationError = validateIntent({ actionId, type, payload });
    if (validationError) return cb({ error: validationError });
    const room = rooms.get(String(code || '').toUpperCase());
    const userId = socket.auth.user.userId;
    if (!room || !room.game) return cb({ error: 'Game not found.' });
    if (room.processedActionIds.has(actionId)) return cb({ ok: true, duplicate: true });
    room.game = resolveExpiredTimers(room.game);
    const idx = getRoomPlayerIndex(room, userId);
    if (idx < 0) return cb({ error: 'You are not seated in this game.' });
    let result = { state: room.game, error: 'Unknown action.' };
    let drawn = null;
    if (type === 'peek') result = flipForPeek(room.game, idx, payload.r, payload.c);
    if (type === 'draw' || type === 'takeDiscard') {
      if (room.game.currentPlayerIndex !== idx) return cb({ error: 'Not your turn.' });
      if (room.held.get(userId)) return cb({ error: 'You already have a held card.' });
      result = type === 'draw' ? drawFromDeck(room.game) : takeDiscard(room.game);
      drawn = result.drawn || null;
      if (drawn) room.held.set(userId, drawn);
    }
    if (type === 'replace' || type === 'discard') {
      const heldCard = room.held.get(userId);
      if (!heldCard) return cb({ error: 'Draw or take a card first.' });
      result = type === 'replace'
        ? replaceGridCard(room.game, idx, payload.r, payload.c, heldCard)
        : discardDrawn(room.game, idx, heldCard);
      if (!result.error) room.held.delete(userId);
    }
    if (result.error) return cb({ error: result.error });
    room.game = result.state;
    rememberActionId(room, actionId);
    room.updatedAt = Date.now();
    broadcastRoom(room);
    return cb({ ok: true, drawn });
  });

  socket.on('disconnect', () => {
    const link = sockets.get(socket.id);
    if (!link) return;
    const room = rooms.get(link.roomCode);
    sockets.delete(socket.id);
    if (!room) return;
    const stillConnected = [...sockets.values()].some(item => item.roomCode === link.roomCode && item.userId === link.userId);
    room.connected.set(link.userId, stillConnected);
    room.updatedAt = Date.now();
    broadcastRoom(room);
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions) if (session.expiresAt <= now) sessions.delete(token);
  for (const [code, room] of rooms) {
    if (room.game) room.game = resolveExpiredTimers(room.game);
    if (now - room.updatedAt > ROOM_TTL_MS) rooms.delete(code);
    else broadcastRoom(room);
  }
  saveStore();
}, 5000);

loadStore();
server.listen(PORT, () => {
  console.log(`Golf9 authoritative server listening on port ${PORT}`);
});
