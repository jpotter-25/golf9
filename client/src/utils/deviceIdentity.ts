const KEY = 'golf9.installId';
let memoryInstallId: string | null = null;

function storage(): Storage | null {
  if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
    return globalThis.localStorage;
  }
  return null;
}

function makeInstallId() {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `install-${random}`;
}

export function getInstallIdSync(): string {
  const stored = storage()?.getItem(KEY);
  if (stored) {
    memoryInstallId = stored;
    return stored;
  }
  if (memoryInstallId) return memoryInstallId;
  memoryInstallId = makeInstallId();
  storage()?.setItem(KEY, memoryInstallId);
  return memoryInstallId;
}

export async function getInstallId(): Promise<string> {
  return getInstallIdSync();
}
