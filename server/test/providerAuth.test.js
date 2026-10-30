import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createProviderAuth, providerReadiness, pruneProviderTransactions, APPLE_MOBILE_RETURN_URL } from '../providerAuth.js';
import { decryptEarlyAccessContact } from '../earlyAccess.js';

const signing = await generateKeyPair('RS256', { extractable: true });
const publicJwk = await exportJWK(signing.publicKey);
const keys = createLocalJWKSet({ keys: [{ ...publicJwk, kid: 'test-key', alg: 'RS256' }] });
const privateKey = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ type: 'pkcs8', format: 'pem' });
const env = {
  NODE_ENV: 'test', EARLY_ACCESS_PII_KEY: 'a-test-only-encryption-key-at-least-32-characters',
  APPLE_SIGN_IN_ENABLED: '1', APPLE_SIGN_IN_ANDROID_ENABLED: '1',
  APPLE_SIGN_IN_PRIVATE_KEY: privateKey, APPLE_SIGN_IN_TEAM_ID: 'TESTTEAM00', APPLE_SIGN_IN_KEY_ID: 'TESTKEY000',
  APPLE_SIGN_IN_IOS_CLIENT_ID: 'com.potterwell.ninebelow', APPLE_SIGN_IN_SERVICE_ID: 'com.potterwell.ninebelow.signin',
  APPLE_SIGN_IN_REDIRECT_URI: 'https://ninebelow.potterwell.com/auth/apple/callback',
  PUBLIC_API_URL: 'https://ninebelow.potterwell.com', FACEBOOK_APP_ID: 'facebook-test',
  FACEBOOK_IOS_LOGIN_ENABLED: '1',
};
const verifier = 'device-only-secret-'.padEnd(64, 'a');
const codeChallenge = crypto.createHash('sha256').update(verifier).digest('base64url');

function fixture(overrides = {}) {
  let clock = Date.now();
  const records = [];
  const requests = [];
  let persisted = [];
  const api = createProviderAuth({
    env, records, now: () => clock, appleKeys: keys, facebookKeys: keys,
    save: async () => { persisted = structuredClone(records); },
    fetchImpl: async (url, options) => {
      requests.push({ url, body: options.body });
      if (url.endsWith('/revoke')) return { ok: true };
      const record = records.find(item => item.status === 'verifying');
      return { ok: true, json: async () => ({ id_token: await token(record), refresh_token: 'private-refresh-token' }) };
    },
    ...overrides,
  });
  async function token(record, claims = {}, signingKey = signing.privateKey) {
    const apple = record.provider === 'apple';
    return new SignJWT({
      sub: 'stable-player-id', nonce: record.nonce,
      ...(apple ? { email: 'hidden@privaterelay.appleid.com', email_verified: 'true' } : { name: 'Facebook Person', email: 'not-verified@example.com' }),
      ...claims,
    }).setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(claims.iss || (apple ? 'https://appleid.apple.com' : 'https://www.facebook.com'))
      .setAudience(claims.aud || (apple ? record.platform === 'ios' ? env.APPLE_SIGN_IN_IOS_CLIENT_ID : env.APPLE_SIGN_IN_SERVICE_ID : env.FACEBOOK_APP_ID))
      .setIssuedAt(claims.iat ?? Math.floor(clock / 1000)).setExpirationTime(claims.exp ?? Math.floor(clock / 1000) + 600).sign(signingKey);
  }
  async function start(provider = 'apple', platform = 'ios', purpose = 'login', userId = null) {
    const result = await api.start({ provider, platform, purpose, codeChallenge }, userId);
    return { result, record: records.at(-1), body: { challengeId: result.challengeId, verifier } };
  }
  return { api, records, requests, start, token, snapshot: () => persisted, advance: ms => { clock += ms; } };
}

test('provider gates fail closed until the complete signing, encryption and redirect configuration is present', () => {
  assert.deepEqual(providerReadiness({}), { appleIos: false, appleAndroid: false, facebookIos: false });
  assert.deepEqual(providerReadiness(env), { appleIos: true, appleAndroid: true, facebookIos: true });
  for (const change of [
    { APPLE_SIGN_IN_PRIVATE_KEY: 'not-a-key' }, { APPLE_SIGN_IN_KEY_ID: '' },
    { APPLE_SIGN_IN_IOS_CLIENT_ID: 'wrong.app' },
    { NODE_ENV: 'production', EARLY_ACCESS_PII_KEY: '', EARLY_ACCESS_TOKEN_SECRET: '' },
  ]) assert.equal(providerReadiness({ ...env, ...change }).appleIos, false);
  for (const url of ['http://ninebelow.potterwell.com/auth/apple/callback', 'https://evil.example/auth/apple/callback',
    'https://ninebelow.potterwell.com/other', 'https://ninebelow.potterwell.com/auth/apple/callback?return=evil']) {
    assert.equal(providerReadiness({ ...env, APPLE_SIGN_IN_REDIRECT_URI: url }).appleAndroid, false);
  }
});

test('native Apple verifies both tokens, encrypts identity/grants, allows profile continuation, then consumes once', async () => {
  const f = fixture();
  const { record, body } = await f.start();
  const profile = await f.api.verify('apple', { ...body, idToken: await f.token(record), authorizationCode: 'one-use-code' });
  assert.equal(profile.providerUserId, 'stable-player-id');
  assert.equal(profile.emailVerified, true);
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].body.get('client_id'), env.APPLE_SIGN_IN_IOS_CLIENT_ID);
  assert.equal(f.requests[0].body.get('redirect_uri'), null);
  assert.ok(f.requests[0].body.get('client_secret'));
  assert.doesNotMatch(JSON.stringify(f.snapshot()), /private-refresh-token|privaterelay|one-use-code/);
  const continuation = await f.api.verify('apple', body);
  assert.equal(continuation.providerUserId, profile.providerUserId);
  assert.equal(f.requests.length, 1);
  const link = {};
  f.api.attachAppleGrant(link, profile);
  assert.doesNotMatch(JSON.stringify(link), /private-refresh-token/);
  assert.equal(decryptEarlyAccessContact(link.appleGrantsEncrypted, env)[env.APPLE_SIGN_IN_IOS_CLIENT_ID], 'private-refresh-token');
  assert.equal(f.api.consume(continuation), true);
  assert.equal(f.api.consume(continuation), false);
  await assert.rejects(f.api.verify('apple', body));
  assert.equal(record.profileEncrypted, undefined);
});

test('Limited Login validates OIDC nonce and never treats the token as a Graph token or an email recovery proof', async () => {
  const f = fixture();
  const { record, body } = await f.start('facebook');
  const profile = await f.api.verify('facebook', { ...body, idToken: await f.token(record) });
  assert.equal(profile.providerUserId, 'stable-player-id');
  assert.equal(profile.email, '');
  assert.equal(profile.emailVerified, false);
  assert.equal(f.requests.length, 0);
  assert.doesNotMatch(JSON.stringify(f.snapshot()), /Facebook Person/);
});

test('signed tokens with wrong nonce, audience, issuer, expiry, age, or missing nonce are rejected', async () => {
  for (const claims of [{ nonce: 'wrong' }, { aud: 'wrong-app' }, { iss: 'https://evil.example' },
    { exp: 1 }, { iat: 1 }, { nonce: undefined }, { sub: '' }]) {
    const f = fixture();
    const { record, body } = await f.start('facebook');
    await assert.rejects(f.api.verify('facebook', { ...body, idToken: await f.token(record, claims) }));
    assert.equal(record.status, 'failed');
  }
  const f = fixture();
  const { record, body } = await f.start('facebook');
  const attacker = await generateKeyPair('RS256');
  await assert.rejects(f.api.verify('facebook', { ...body, idToken: await f.token(record, {}, attacker.privateKey) }));
});

test('proof-of-possession, purpose, and account binding reject intercepted challenges and cross-account linking', async () => {
  const f = fixture();
  const { record, body } = await f.start('facebook', 'ios', 'link', 'player-one');
  const payload = { ...body, idToken: await f.token(record) };
  await assert.rejects(f.api.verify('facebook', { ...payload, verifier: 'b'.repeat(64) }, 'link', 'player-one'));
  await assert.rejects(f.api.verify('facebook', payload, 'login', null));
  await assert.rejects(f.api.verify('facebook', payload, 'link', 'player-two'));
  await assert.rejects(f.api.verify('apple', payload, 'link', 'player-one'));
  assert.equal(record.status, 'pending');
  const profile = await f.api.verify('facebook', payload, 'link', 'player-one');
  assert.equal(f.api.consume(profile), true);
});

test('Android uses a state-bound HTTPS code callback and sends only an opaque id back to the device', async () => {
  const f = fixture();
  const { result, record, body } = await f.start('apple', 'android');
  const url = new URL(result.authorizationUrl);
  assert.equal(url.origin, 'https://appleid.apple.com');
  assert.equal(url.searchParams.get('client_id'), env.APPLE_SIGN_IN_SERVICE_ID);
  assert.equal(url.searchParams.get('response_mode'), 'form_post');
  assert.equal(url.searchParams.get('redirect_uri'), env.APPLE_SIGN_IN_REDIRECT_URI);
  assert.doesNotMatch(JSON.stringify(f.snapshot()), new RegExp(url.searchParams.get('state')));
  await assert.rejects(f.api.callback({ state: 'forged-state', code: 'one-use-code' }));
  const returned = await f.api.callback({ state: url.searchParams.get('state'), code: 'one-use-code' });
  assert.equal(returned, APPLE_MOBILE_RETURN_URL + '?challengeId=' + result.challengeId);
  assert.doesNotMatch(returned, /token|email|code=|secret/);
  assert.equal(f.requests[0].body.get('redirect_uri'), env.APPLE_SIGN_IN_REDIRECT_URI);
  await assert.rejects(f.api.callback({ state: url.searchParams.get('state'), code: 'one-use-code' }));
  await assert.rejects(f.api.verify('apple', { ...body, verifier: 'z'.repeat(64) }));
  assert.equal((await f.api.verify('apple', body)).providerUserId, 'stable-player-id');
  assert.equal(record.status, 'verified');
});

test('cancelled and failed callbacks do not leak upstream details or create a usable identity', async () => {
  const f = fixture();
  const { result, body } = await f.start('apple', 'android');
  await f.api.callback({ state: new URL(result.authorizationUrl).searchParams.get('state'), error: 'access_denied' });
  await assert.rejects(f.api.verify('apple', body));
  assert.equal(f.requests.length, 0);
  const failure = fixture({ fetchImpl: async () => { throw new Error('secret-provider-response'); } });
  const attempt = await failure.start();
  await assert.rejects(failure.api.verify('apple', { ...attempt.body, idToken: await failure.token(attempt.record), authorizationCode: 'code' }), /start again/);
});

test('pending/verified transactions survive restart; expired or in-flight transactions fail closed', async () => {
  const f = fixture();
  const { record, body } = await f.start('facebook');
  await f.api.verify('facebook', { ...body, idToken: await f.token(record) });
  const restored = createProviderAuth({ records: f.snapshot(), env, save: async () => {}, appleKeys: keys, facebookKeys: keys });
  assert.equal((await restored.verify('facebook', body)).providerUserId, 'stable-player-id');
  const inflight = createProviderAuth({ records: [{ ...record, status: 'verifying' }], env, save: async () => {} });
  await assert.rejects(inflight.verify('facebook', body));
  f.advance(11 * 60 * 1000);
  await assert.rejects(f.api.verify('facebook', body));
  assert.deepEqual(pruneProviderTransactions(f.records, Date.now() + 11 * 60 * 1000), []);
});

test('parallel native requests cannot exchange a one-use provider code twice', async () => {
  const f = fixture();
  const { record, body } = await f.start();
  const payload = { ...body, idToken: await f.token(record), authorizationCode: 'code' };
  const results = await Promise.allSettled([f.api.verify('apple', payload), f.api.verify('apple', payload)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(f.requests.length, 1);
});

test('Apple revocation covers both client grants and fails closed if encrypted grant data is corrupt', async () => {
  const f = fixture();
  const link = {};
  for (const clientId of [env.APPLE_SIGN_IN_IOS_CLIENT_ID, env.APPLE_SIGN_IN_SERVICE_ID]) {
    f.api.attachAppleGrant(link, { appleGrant: { clientId, refreshToken: 'refresh-' + clientId } });
  }
  await f.api.revokeApple(link);
  assert.equal(f.requests.length, 2);
  assert.ok(f.requests.every(request => request.url === 'https://appleid.apple.com/auth/revoke' && request.body.get('token_type_hint') === 'refresh_token'));
  await assert.rejects(f.api.revokeApple({ appleGrantsEncrypted: 'corrupt' }));
});

test('a failed durable save prevents a challenge from being returned', async () => {
  const f = fixture({ save: async () => { throw new Error('database unavailable'); } });
  await assert.rejects(f.start(), /database unavailable/);
  assert.equal(f.requests.length, 0);
});
