// index.js
// Purpose: Minimal Socket.IO relay for online play (LAN).
// This keeps state in-memory per room. Suitable for local testing.

import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const rooms = new Map(); // roomCode -> { clients: Set<socketId> }

function makeCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

io.on('connection', (socket) => {
  socket.on('create', (_data, cb) => {
    let code = makeCode();
    while (rooms.has(code)) code = makeCode();
    rooms.set(code, { clients: new Set([socket.id]) });
    socket.join(code);
    cb(code);
  });

  socket.on('join', ({ room }) => {
    if (!rooms.has(room)) rooms.set(room, { clients: new Set() });
    rooms.get(room).clients.add(socket.id);
    socket.join(room);
    io.to(room).emit('sys', { type: 'join', who: socket.id, size: rooms.get(room).clients.size });
  });

  socket.on('action', (action) => {
    // blindly relay actions to room members
    const room = [...socket.rooms].find((r) => r !== socket.id);
    if (room) socket.to(room).emit('action', action);
  });

  socket.on('disconnecting', () => {
    for (const room of socket.rooms) {
      if (rooms.has(room)) {
        rooms.get(room).clients.delete(socket.id);
        io.to(room).emit('sys', { type: 'leave', who: socket.id, size: rooms.get(room).clients.size });
        if (rooms.get(room).clients.size === 0) rooms.delete(room);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log('Golf9 server listening on port ' + PORT);
});
