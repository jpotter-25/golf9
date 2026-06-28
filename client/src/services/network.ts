// src/services/network.ts
// Purpose: Socket.IO wrapper for authoritative online play.

import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../config';
import { getInstallIdSync } from '../utils/deviceIdentity';
import type { GameState } from '../game/types';
import type { ClubAnnouncement, ClubChatMessage, ClubProfile, RoomSummary, SocialSummary } from './api';

export type ChatMessage = {
  id: string;
  userId: string;
  displayName: string;
  avatarInitial?: string;
  type: 'text' | 'preset' | 'emoji' | 'sticker' | 'gift';
  text: string;
  giftId?: string;
  giftIcon?: string;
  giftPrice?: number;
  targetUserId?: string;
  targetDisplayName?: string;
  createdAt: number;
};

export type ChatMessageType = ChatMessage['type'];
export type GameCelebration = ChatMessage;

let socket: Socket | null = null;
let activeToken: string | null = null;

export function connect(token: string): Socket {
  if (socket && activeToken === token) return socket;
  if (socket) socket.disconnect();
  activeToken = token;
  socket = io(SOCKET_URL, {
    transports: ['websocket'],
    auth: { token, deviceId: getInstallIdSync(), platform: 'mobile' },
    reconnection: true,
  });
  return socket;
}

export function disconnect() {
  socket?.disconnect();
  socket = null;
  activeToken = null;
}

export function joinRoomSocket(token: string, code: string): Promise<{ room: RoomSummary; game: GameState | null; chat: ChatMessage[] }> {
  const s = connect(token);
  return new Promise((resolve, reject) => {
    s.emit('room:join', { code }, (res: { room?: RoomSummary; game?: GameState | null; chat?: ChatMessage[]; error?: string }) => {
      if (res.error) reject(new Error(res.error));
      else resolve({ room: res.room!, game: res.game ?? null, chat: res.chat ?? [] });
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
  return new Promise((resolve, reject) => {
    s.emit('room:leave', { code }, (res: { error?: string }) => {
      if (res.error) reject(new Error(res.error));
      else resolve();
    });
  });
}

export function onRoomUpdate(cb: (room: RoomSummary) => void) {
  socket?.on('room:update', cb);
  return () => { socket?.off('room:update', cb); };
}

export function onSocketConnect(cb: () => void) {
  socket?.on('connect', cb);
  return () => { socket?.off('connect', cb); };
}

export function onGameUpdate(cb: (state: GameState) => void) {
  socket?.on('game:state', cb);
  return () => { socket?.off('game:state', cb); };
}

export function onChatHistory(cb: (messages: ChatMessage[]) => void) {
  socket?.on('chat:history', cb);
  return () => { socket?.off('chat:history', cb); };
}

export function onChatMessage(cb: (message: ChatMessage) => void) {
  socket?.on('chat:message', cb);
  return () => { socket?.off('chat:message', cb); };
}

export function onGameCelebration(cb: (message: GameCelebration) => void) {
  socket?.on('game:celebration', cb);
  return () => { socket?.off('game:celebration', cb); };
}

export function onSocialUpdate(cb: (social: SocialSummary) => void) {
  socket?.on('social:update', cb);
  return () => { socket?.off('social:update', cb); };
}

export function joinClubSocket(token: string, clubId: string): Promise<{ club: ClubProfile; chat: ClubChatMessage[] }> {
  const s = connect(token);
  return new Promise((resolve, reject) => {
    s.emit('club:join', { clubId }, (res: { club?: ClubProfile; chat?: ClubChatMessage[]; error?: string }) => {
      if (res.error) reject(new Error(res.error));
      else resolve({ club: res.club!, chat: res.chat ?? [] });
    });
  });
}

export function onClubUpdate(cb: (update: { clubId: string; club?: ClubProfile }) => void) {
  socket?.on('club:update', cb);
  return () => { socket?.off('club:update', cb); };
}

export function onClubChatHistory(cb: (messages: ClubChatMessage[]) => void) {
  socket?.on('club:chat:history', cb);
  return () => { socket?.off('club:chat:history', cb); };
}

export function onClubChatMessage(cb: (message: ClubChatMessage) => void) {
  socket?.on('club:chat:message', cb);
  return () => { socket?.off('club:chat:message', cb); };
}

export function onClubAnnouncement(cb: (announcement: ClubAnnouncement) => void) {
  socket?.on('club:announcement', cb);
  return () => { socket?.off('club:announcement', cb); };
}

export function sendClubChatMessage(token: string, clubId: string, type: ChatMessageType, text: string): Promise<{ message: ClubChatMessage }> {
  const s = connect(token);
  return new Promise((resolve, reject) => {
    s.emit('club:chat:send', { clubId, type, text }, (res: { error?: string; message?: ClubChatMessage }) => {
      if (res.error) reject(new Error(res.error));
      else resolve({ message: res.message! });
    });
  });
}

export function sendChatMessage(token: string, code: string, type: ChatMessageType, text: string, targetUserId?: string): Promise<{ message: ChatMessage }> {
  const s = connect(token);
  return new Promise((resolve, reject) => {
    s.emit('chat:send', { code, type, text, targetUserId }, (res: { error?: string; message?: ChatMessage }) => {
      if (res.error) reject(new Error(res.error));
      else resolve({ message: res.message! });
    });
  });
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
