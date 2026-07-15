// Purpose: Surface server update-required responses to the root release gate.

import type { ReleasePolicyResponse } from './api';

type Listener = (policy: ReleasePolicyResponse) => void;
const listeners = new Set<Listener>();

export function emitReleaseRequired(policy: ReleasePolicyResponse) {
  for (const listener of listeners) listener(policy);
}

export function subscribeReleaseRequired(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
