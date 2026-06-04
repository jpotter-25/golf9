// src/services/api.ts
// Purpose: Typed REST helpers for authentication and room setup.

import { SERVER_URL } from '../config';

export type UserProfile = {
  userId: string;
  displayName: string;
  avatarInitial: string;
  stats: { gamesPlayed: number; wins: number };
};

export type AuthResponse = { token: string; user: UserProfile };
export type RoomPlayer = { userId: string; displayName: string; avatarInitial: string; ready: boolean; connected: boolean; isHost: boolean };
export type RoomSummary = { code: string; hostUserId: string; status: 'lobby' | 'playing'; maxPlayers: number; rounds: number; players: RoomPlayer[] };

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const res = await fetch(`${SERVER_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed: ${res.status}`);
  return body as T;
}

export function signup(displayName: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/signup', { method: 'POST', body: JSON.stringify({ displayName, password }) });
}

export function login(displayName: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ displayName, password }) });
}

export function logout(token: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/auth/logout', { method: 'POST' }, token);
}

export function me(token: string): Promise<{ user: UserProfile }> {
  return request<{ user: UserProfile }>('/auth/me', {}, token);
}

export function createOnlineRoom(token: string, maxPlayers: number, rounds: number): Promise<{ room: RoomSummary }> {
  return request<{ room: RoomSummary }>('/rooms', { method: 'POST', body: JSON.stringify({ maxPlayers, rounds }) }, token);
}

export function joinOnlineRoom(token: string, code: string): Promise<{ room: RoomSummary }> {
  return request<{ room: RoomSummary }>(`/rooms/${code}/join`, { method: 'POST' }, token);
}
