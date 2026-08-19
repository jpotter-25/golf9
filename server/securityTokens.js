import crypto from 'crypto';

export function isProductionEnvironment(env = process.env) {
  return [env?.NODE_ENV, env?.APP_ENV, env?.EXPO_PUBLIC_APP_ENV]
    .some(value => ['production', 'prod'].includes(String(value || '').trim().toLowerCase()));
}

function verifierKey(env = process.env) {
  const configured = String(env.SERVER_TOKEN_SECRET || env.EARLY_ACCESS_TOKEN_SECRET || '').trim();
  if (isProductionEnvironment(env) && configured.length < 32) {
    throw new Error('SERVER_TOKEN_SECRET or EARLY_ACCESS_TOKEN_SECRET must be at least 32 characters in production.');
  }
  return crypto.createHash('sha256')
    .update(configured || 'nine-below-local:persistent-credentials')
    .digest();
}

export function persistentCredentialVerifier(value, purpose, env = process.env) {
  const digest = crypto.createHmac('sha256', verifierKey(env))
    .update(`nine-below:${String(purpose || 'credential')}:v1\0${String(value || '')}`)
    .digest('base64url');
  return `v1:${digest}`;
}

export function normalizeCredentialVerifier(value, purpose, env = process.env) {
  const stored = String(value || '');
  return stored.startsWith('v1:') ? stored : persistentCredentialVerifier(stored, purpose, env);
}

export function credentialVerifierMatches(stored, presented, purpose, env = process.env) {
  const expected = persistentCredentialVerifier(presented, purpose, env);
  const left = Buffer.from(String(stored || ''));
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
