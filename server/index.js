/**
 * Simple WebSocket server for Golf 9 (prototype)
 * - Rooms: create/join by code
 * - Broadcasts game messages (not authoritative logic)
 */
const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

const rooms = new Map(); // code -> Set of client ids
const clients = new Map(); // id -> ws

function broadcast(roomCode, msg) {
  const ids = rooms.get(roomCode);
  if (!ids) return;
  for (const id of ids) {
    const ws = clients.get(id);
    if (ws && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }
}

wss.on('connection', (ws) => {
  const id = uuidv4();
  clients.set(id, ws);
  ws.send(JSON.stringify({ type:'hello', id }));

  let currentRoom = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'join') {
        const code = (msg.code || '').toUpperCase();
        if (!rooms.has(code)) rooms.set(code, new Set());
        rooms.get(code).add(id);
        currentRoom = code;
        broadcast(code, { type:'system', text:`Client ${id.slice(0,8)} joined ${code}` });
      } else if (msg.type === 'leave') {
        if (currentRoom && rooms.has(currentRoom)) {
          rooms.get(currentRoom).delete(id);
          broadcast(currentRoom, { type:'system', text:`Client ${id.slice(0,8)} left` });
        }
        currentRoom = null;
      } else if (msg.type === 'game') {
        if (currentRoom) {
          broadcast(currentRoom, { type:'game', payload: msg.payload, from: id });
        }
      }
    } catch (e) {
      console.error('Bad message', e);
    }
  });

  ws.on('close', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      rooms.get(currentRoom).delete(id);
      broadcast(currentRoom, { type:'system', text:`Client ${id.slice(0,8)} disconnected` });
    }
    clients.delete(id);
  });
});

console.log(`Golf9 WS server listening on :${PORT}`);