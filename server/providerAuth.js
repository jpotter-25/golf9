import crypto from 'node:crypto';
import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from 'jose';
import { decryptEarlyAccessContact, encryptEarlyAccessContact, earlyAccessSecurityStatus } from './earlyAccess.js';

export const APPLE_MOBILE_RETURN_URL = 'com.potterwell.ninebelow://auth/apple';
const APPLE_ISSUER = 'https://appleid.apple.com';
const FACEBOOK_ISSUER = 'https://www.facebook.com';
const TTL = 10 * 60 * 1000;
const digest = value => crypto.createHash('sha256').update(value).digest('base64url');
const random = () => crypto.randomBytes(32).toString('base64url');
const invalid = () => new Error('Sign-in expired or could not be verified. Please start again.');
const same = (a, b) => typeof a === 'string' && typeof b === 'string'
  && Buffer.byteLength(a) === Buffer.byteLength(b) && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

// Explicit provider gates prevent incomplete console configuration from being advertised.
export function providerReadiness(env = process.env) {
  const privateKey = String(env.APPLE_SIGN_IN_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  let keyReady = false;
  try {
    const key = crypto.createPrivateKey(privateKey);
    keyReady = key.asymmetricKeyType === 'ec' && key.asymmetricKeyDetails?.namedCurve === 'prime256v1';
  } catch { /* Unconfigured providers remain off. */ }
  const secure = earlyAccessSecurityStatus(env).ready;
  const apple = env.APPLE_SIGN_IN_ENABLED === '1' && secure && keyReady
    && !!env.APPLE_SIGN_IN_TEAM_ID && !!env.APPLE_SIGN_IN_KEY_ID
    && env.APPLE_SIGN_IN_IOS_CLIENT_ID === 'com.potterwell.ninebelow';
  let redirectReady = false;
  try {
    const url = new URL(env.APPLE_SIGN_IN_REDIRECT_URI);
    redirectReady = url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash
      && url.pathname === '/auth/apple/callback'
      && url.origin === new URL(env.PUBLIC_API_URL).origin;
  } catch { /* No configurable open redirects. */ }
  return {
    appleIos: !!apple,
    appleAndroid: !!apple && env.APPLE_SIGN_IN_ANDROID_ENABLED === '1'
      && !!env.APPLE_SIGN_IN_SERVICE_ID && redirectReady,
    facebookIos: secure && env.FACEBOOK_IOS_LOGIN_ENABLED === '1' && !!env.FACEBOOK_APP_ID,
  };
}

export function pruneProviderTransactions(records, now = Date.now()) {
  // A process interruption during code exchange is fail-closed: start a new login.
  return records.filter(record => record?.expiresAt > now && record.status !== 'consumed');
}

export function createProviderAuth({
  records, save, env = process.env, now = Date.now, fetchImpl = fetch,
  appleKeys = createRemoteJWKSet(new URL(`${APPLE_ISSUER}/auth/keys`), { timeoutDuration: 10000 }),
  facebookKeys = createRemoteJWKSet(new URL(`${FACEBOOK_ISSUER}/.well-known/oauth/openid/jwks/`), { timeoutDuration: 10000 }),
}) {
  const encrypt = value => encryptEarlyAccessContact(value, env);
  const decrypt = value => decryptEarlyAccessContact(value, env);
  const readiness = () => providerReadiness(env);
  const clientIdFor = platform => platform === 'ios' ? env.APPLE_SIGN_IN_IOS_CLIENT_ID : env.APPLE_SIGN_IN_SERVICE_ID;

  function recordFor(id) {
    const record = records.find(item => item.requestId === id);
    if (!record || record.expiresAt <= now() || ['consumed', 'failed'].includes(record.status)) throw invalid();
    return record;
  }

  async function start({ provider, platform, purpose = 'login', codeChallenge }, userId = null) {
    const enabled = readiness();
    if (!(provider === 'apple' && (platform === 'ios' ? enabled.appleIos : platform === 'android' && enabled.appleAndroid))
      && !(provider === 'facebook' && platform === 'ios' && enabled.facebookIos)) throw invalid();
    if (!['login', 'link', 'delete'].includes(purpose) || (purpose !== 'login' && !userId)
      || !/^[A-Za-z0-9_-]{43}$/.test(codeChallenge || '')) throw invalid();
    records.splice(0, records.length, ...pruneProviderTransactions(records, now()));
    if (records.length >= 2000) throw new Error('Sign-in is busy. Please try again shortly.');
    const state = random();
    const record = {
      requestId: random(), provider, platform, purpose, userId: purpose === 'login' ? null : userId,
      codeChallenge, stateHash: digest(state), nonce: random(), status: 'pending',
      expiresAt: now() + TTL,
    };
    records.push(record);
    await save();
    const response = { challengeId: record.requestId, nonce: record.nonce, expiresAt: record.expiresAt };
    if (provider === 'apple' && platform === 'android') {
      const url = new URL(`${APPLE_ISSUER}/auth/authorize`);
      url.search = new URLSearchParams({
        client_id: clientIdFor(platform), redirect_uri: env.APPLE_SIGN_IN_REDIRECT_URI,
        response_type: 'code', response_mode: 'form_post', scope: 'email', state, nonce: record.nonce,
      }).toString();
      response.authorizationUrl = url.toString();
    }
    return response;
  }

  async function validateToken(token, provider, record) {
    if (typeof token !== 'string' || token.length > 16384) throw invalid();
    const { payload } = await jwtVerify(token, provider === 'apple' ? appleKeys : facebookKeys, {
      algorithms: ['RS256'], issuer: provider === 'apple' ? APPLE_ISSUER : FACEBOOK_ISSUER,
      audience: provider === 'apple' ? clientIdFor(record.platform) : env.FACEBOOK_APP_ID,
      requiredClaims: ['sub', 'exp', 'iat', 'nonce'], maxTokenAge: '10m',
      currentDate: new Date(now()), clockTolerance: 5,
    });
    const audience = provider === 'apple' ? clientIdFor(record.platform) : env.FACEBOOK_APP_ID;
    if (payload.aud !== audience || typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 255 || !same(payload.nonce, record.nonce)) throw invalid();
    return payload;
  }

  async function clientSecret(clientId) {
    const key = await importPKCS8(String(env.APPLE_SIGN_IN_PRIVATE_KEY || '').replace(/\\n/g, '\n'), 'ES256');
    const issued = Math.floor(now() / 1000);
    return new SignJWT({}).setProtectedHeader({ alg: 'ES256', kid: env.APPLE_SIGN_IN_KEY_ID })
      .setIssuer(env.APPLE_SIGN_IN_TEAM_ID).setSubject(clientId).setAudience(APPLE_ISSUER)
      .setIssuedAt(issued).setExpirationTime(issued + 300).sign(key);
  }

  async function appleRequest(endpoint, clientId, values) {
    const response = await fetchImpl(`${APPLE_ISSUER}/auth/${endpoint}`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: await clientSecret(clientId), ...values }),
      signal: AbortSignal.timeout(10000), redirect: 'error',
    });
    // Never propagate upstream bodies, codes, tokens, or signing credentials to logs/errors.
    if (!response.ok) throw new Error('Apple authorization is temporarily unavailable. Please try again.');
    return endpoint === 'revoke' ? {} : response.json();
  }

  async function exchangeApple(record, code, nativeToken) {
    if (typeof code !== 'string' || !code || code.length > 4096) throw invalid();
    const nativeClaims = record.platform === 'ios' ? await validateToken(nativeToken, 'apple', record) : null;
    const clientId = clientIdFor(record.platform);
    const tokens = await appleRequest('token', clientId, {
      grant_type: 'authorization_code', code,
      ...(record.platform === 'android' ? { redirect_uri: env.APPLE_SIGN_IN_REDIRECT_URI } : {}),
    });
    const claims = await validateToken(tokens.id_token, 'apple', record);
    if (nativeClaims && nativeClaims.sub !== claims.sub) throw invalid();
    if (typeof tokens.refresh_token !== 'string' || !tokens.refresh_token || tokens.refresh_token.length > 8192) throw invalid();
    return {
      provider: 'apple', providerUserId: claims.sub,
      email: typeof claims.email === 'string' ? claims.email.toLowerCase().slice(0, 320) : '',
      emailVerified: claims.email_verified === true || claims.email_verified === 'true',
      displayName: '', // Do not request a real name; players choose their own public name.
      appleGrant: { clientId, refreshToken: tokens.refresh_token },
    };
  }

  async function callback(body) {
    if (typeof body.state !== 'string' || body.state.length > 128) throw invalid();
    const hash = digest(body.state);
    const record = records.find(item => same(item.stateHash, hash));
    if (!record || recordFor(record.requestId).status !== 'pending' || record.provider !== 'apple' || record.platform !== 'android') throw invalid();
    // Claim synchronously before awaiting anything, and persist before exchanging a one-use code.
    record.status = 'verifying';
    await save();
    try {
      if (body.error) throw invalid();
      const profile = await exchangeApple(record, body.code);
      record.profileEncrypted = encrypt(profile);
      record.status = 'verified';
    } catch {
      record.status = 'failed';
    }
    await save();
    // Only an opaque id returns through the custom scheme. The device-held verifier
    // is required over HTTPS to retrieve the identity; no session/provider token is in a URL.
    return `${APPLE_MOBILE_RETURN_URL}?challengeId=${encodeURIComponent(record.requestId)}`;
  }

  async function verify(provider, body, purpose = 'login', userId = null) {
    const record = recordFor(body.challengeId);
    if (record.provider !== provider || record.purpose !== purpose || record.userId !== userId
      || typeof body.verifier !== 'string' || !/^[A-Za-z0-9_-]{43,128}$/.test(body.verifier)
      || !same(record.codeChallenge, digest(body.verifier))) throw invalid();
    if (record.status === 'pending' && record.platform === 'ios') {
      record.status = 'verifying';
      await save();
      try {
        let profile;
        if (provider === 'apple') {
          profile = await exchangeApple(record, body.authorizationCode, body.idToken);
        } else {
          const claims = await validateToken(body.idToken, 'facebook', record);
          // No email scope or Graph access in Limited Login. Never treat an
          // unverified email claim as an account-recovery credential.
          profile = { provider, providerUserId: claims.sub, email: '', emailVerified: false,
            displayName: typeof claims.name === 'string' ? claims.name.slice(0, 120) : '' };
        }
        record.profileEncrypted = encrypt(profile);
        record.status = 'verified';
        await save();
      } catch {
        record.status = 'failed';
        delete record.profileEncrypted;
        await save();
        throw invalid();
      }
    }
    if (record.status !== 'verified') throw invalid();
    const profile = decrypt(record.profileEncrypted);
    if (!profile || profile.provider !== provider) throw invalid();
    return { ...profile, transactionId: record.requestId };
  }

  function consume(profile) {
    if (!profile.transactionId) return true; // Legacy Google/Android Facebook.
    const record = records.find(item => item.requestId === profile.transactionId);
    if (!record || record.expiresAt <= now()) return false;
    if (record.status !== 'verified') return false;
    record.status = 'consumed';
    delete record.profileEncrypted;
    return true; // Caller persists this together with the account/session mutation.
  }

  function attachAppleGrant(link, profile) {
    if (!profile.appleGrant) return;
    const grants = link.appleGrantsEncrypted ? decrypt(link.appleGrantsEncrypted) : {};
    if (!grants) throw new Error('Apple authorization storage is unavailable. Please contact support.');
    grants[profile.appleGrant.clientId] = profile.appleGrant.refreshToken;
    link.appleGrantsEncrypted = encrypt(grants);
  }

  async function revokeApple(link) {
    if (!link?.appleGrantsEncrypted) return;
    const grants = decrypt(link.appleGrantsEncrypted);
    if (!grants || !Object.keys(grants).length) throw new Error('Apple authorization could not be revoked. Please contact support.');
    for (const [clientId, token] of Object.entries(grants)) {
      if (![env.APPLE_SIGN_IN_IOS_CLIENT_ID, env.APPLE_SIGN_IN_SERVICE_ID].includes(clientId)) throw invalid();
      await appleRequest('revoke', clientId, { token, token_type_hint: 'refresh_token' });
    }
  }

  return { start, callback, verify, consume, attachAppleGrant, revokeApple, readiness };
}
