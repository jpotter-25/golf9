import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  credentialVerifierMatches,
  normalizeCredentialVerifier,
  persistentCredentialVerifier,
} from '../securityTokens.js';

const env = {
  SERVER_TOKEN_SECRET: 'test-server-token-secret-that-is-at-least-thirty-two-characters',
};

test('persistent bearer verifiers are keyed and purpose separated', () => {
  const token = 'raw-bearer-token';
  const verifier = persistentCredentialVerifier(token, 'player-session', env);
  assert.match(verifier, /^v1:/);
  assert.equal(verifier.includes(token), false);
  assert.equal(credentialVerifierMatches(verifier, token, 'player-session', env), true);
  assert.equal(credentialVerifierMatches(verifier, token, 'admin-session', env), false);
  assert.equal(credentialVerifierMatches(crypto.createHash('sha256').update(token).digest('hex'), token, 'player-session', env), false);
});

test('legacy raw credentials normalize without preserving plaintext', () => {
  const normalized = normalizeCredentialVerifier('legacy-token', 'admin-session', env);
  assert.match(normalized, /^v1:/);
  assert.equal(normalized.includes('legacy-token'), false);
  assert.equal(credentialVerifierMatches(normalized, 'legacy-token', 'admin-session', env), true);
});

test('production persistent verifiers fail closed without a strong server token key', () => {
  assert.throws(
    () => persistentCredentialVerifier('token', 'player-session', { NODE_ENV: 'production' }),
    /at least 32 characters in production/i,
  );
  assert.throws(
    () => persistentCredentialVerifier('token', 'player-session', { RAILWAY_ENVIRONMENT_ID: 'hosted-preview' }),
    /at least 32 characters/i,
  );
});
