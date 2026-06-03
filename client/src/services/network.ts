// src/services/network.ts
// Purpose: Socket.IO wrapper for authoritative online play.

import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../config';
import type { GameState } from '../game/types';
import type { RoomSummary } from './api';

let socket: Socket | null = null;
let activeToken: string | null = null;

export function connect(token: string): Socket {
  if (socket && activeToken === token) return socket;
  if (socket) socket.disconnect();
  activeToken = token;
  socket = io(SOCKET_URL, { transports: ['websocket'], auth: { token }, reconnection: true });
  return socket;
}

export function disconnect() {
  socket?.disconnect();
  socket = null;
  activeToken = null;
}

export function joinRoomSocket(token: string, code: string): Promise<{ room: RoomSummary; game: GameState | null }> {
  const s = connect(token);
  return new Promise((resolve, reject) => {
    s.emit('room:join', { code }, (res: { room?: RoomSummary; game?: GameState | null; error?: string }) => {
      if (res.error) reject(new Error(res.error));
      else resolve({ room: res.room!, game: res.game ?? null });
    });
  });
}

export function setReady(token: string, code: string, ready: boolean): Promise<void> {
  const s = connect(token);
  return new Promise((resolve, reject) => {
    s.emit('room:ready', { code, ready }, (res: { error?: string }) => res.error ? reject(new Error(res.error)) : resolve());
  });
}

export function startOnlineGame(token: string, code: string): Promise<void> {
  const s = connect(token);
  return new Promise((resolve, reject) => {
    s.emit('room:start', { code }, (res: { error?: string }) => res.error ? reject(new Error(res.error)) : resolve());
  });
}

export function leaveOnlineRoom(token: string, code: string): Promise<void> {
  const s = connect(token);
  return new Promise((resolve) => {
    s.emit('room:leave', { code }, () => resolve());
  });
}

export function onRoomUpdate(cb: (room: RoomSummary) => void) {
  socket?.on('room:update', cb);
  return () => { socket?.off('room:update', cb); };
}

export function onGameUpdate(cb: (state: GameState) => void) {
  socket?.on('game:state', cb);
  return () => { socket?.off('game:state', cb); };
}

export function sendGameIntent(token: string, code: string, type: string, payload: Record<string, unknown> = {}): Promise<{ drawn?: unknown }> {
  const s = connect(token);
  const actionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve, reject) => {
    s.emit('game:intent', { code, actionId, type, payload }, (res: { error?: string; drawn?: unknown }) => {
      if (res.error) reject(new Error(res.error));
      else resolve({ drawn: res.drawn });
    });
  });
}
