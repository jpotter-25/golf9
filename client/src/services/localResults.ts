// src/services/localResults.ts
// Purpose: Durable outbox for local matches completed while the server is unavailable.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as api from './api';

const QUEUE_KEY = 'golf9.local-results.outbox.v1';
const MAX_QUEUED_RESULTS = 50;

export type QueuedLocalResult = api.LocalResultPayload & {
  ownerUserId: string;
  clientResultId: string;
  completedAt: number;
};

let queueOperation: Promise<unknown> = Promise.resolve();
let flushPromise: Promise<number> | null = null;
let flushOwnerUserId: string | null = null;

function serializeQueueOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = queueOperation.then(operation, operation);
  queueOperation = result.then(() => undefined, () => undefined);
  return result;
}

async function readQueue(): Promise<QueuedLocalResult[]> {
  const value = await AsyncStorage.getItem(QUEUE_KEY);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter(item => (
        item
        && typeof item.ownerUserId === 'string'
        && typeof item.clientResultId === 'string'
      )).slice(-MAX_QUEUED_RESULTS)
      : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedLocalResult[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUED_RESULTS)));
}

export function makeClientResultId() {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function queuedLocalResultCount(ownerUserId?: string): Promise<number> {
  return serializeQueueOperation(async () => {
    const queue = await readQueue();
    return ownerUserId ? queue.filter(item => item.ownerUserId === ownerUserId).length : queue.length;
  });
}

export function enqueueLocalResult(ownerUserId: string, payload: api.LocalResultPayload): Promise<QueuedLocalResult> {
  return serializeQueueOperation(async () => {
    const queue = await readQueue();
    const entry: QueuedLocalResult = {
      ...payload,
      ownerUserId,
      clientResultId: payload.clientResultId || makeClientResultId(),
      completedAt: payload.completedAt || Date.now(),
    };
    if (!queue.some(item => item.clientResultId === entry.clientResultId)) queue.push(entry);
    await writeQueue(queue);
    return entry;
  });
}

export function removeQueuedLocalResult(clientResultId: string): Promise<void> {
  return serializeQueueOperation(async () => {
    const queue = await readQueue();
    await writeQueue(queue.filter(item => item.clientResultId !== clientResultId));
  });
}

export function flushQueuedLocalResults(token: string, ownerUserId: string): Promise<number> {
  if (flushPromise) {
    if (flushOwnerUserId === ownerUserId) return flushPromise;
    return flushPromise.then(() => flushQueuedLocalResults(token, ownerUserId));
  }
  flushOwnerUserId = ownerUserId;
  flushPromise = (async () => {
    const queue = (await serializeQueueOperation(readQueue)).filter(item => item.ownerUserId === ownerUserId);
    let synced = 0;
    for (const entry of queue) {
      try {
        await api.recordLocalResult(token, entry);
        await removeQueuedLocalResult(entry.clientResultId);
        synced += 1;
      } catch {
        break;
      }
    }
    return synced;
  })().finally(() => {
    flushPromise = null;
    flushOwnerUserId = null;
  });
  return flushPromise;
}
