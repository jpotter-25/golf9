// src/services/network.ts
// Purpose: Socket.IO wrapper for online play (LAN).

import { io, Socket } from 'socket.io-client';
import { SERVER_URL } from '../config';
import type { GameState } from '../game/types';

let socket: Socket | null = null;

/** Connect or return existing socket */
export function connect(): Socket {
  if (socket) return socket;
  socket = io(SERVER_URL, { transports: ['websocket'] });
  return socket;
}

/** Create a room; server replies with a short code */
export function createRoom(): Promise<string> {
  const s = connect();
  return new Promise((resolve) => {
    s.emit('create', {}, (code: string) => resolve(code));
  });
}

/** Join a room by code with a display name */
export function joinRoom(room: string, name: string) {
  const s = connect();
  s.emit('join', { room, name });
}

/** Subscribe to authoritative game state (future use) */
export function onGameUpdate(cb: (state: GameState) => void) {
  const s = connect();
  s.on('state', cb);
  return () => s.off('state', cb);
}

/** Send a generic action (future use) */
export function sendAction(action: unknown) {
  const s = connect();
  s.emit('action', action);
}
