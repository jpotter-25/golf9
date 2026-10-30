const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

const config = { providers: { google: true, facebook: true, apple: true },
  mobileProviders: { appleIos: true, appleAndroid: true, facebookIos: true } };
function fixture(platform, overrides = {}) {
  const calls = [];
  const exports = {};
  const modules = {
    'react-native': { Platform: { OS: platform } },
    '../config': { SOCIAL_AUTH_CONFIG: { googleWebClientId: 'web-id', googleIosClientId: 'ios-id',
      facebookAppId: 'fb-id', facebookClientToken: 'public-client-token', appleEnabled: true, ...overrides.config } },
    './api': { socialChallenge: async (payload, token) => {
      calls.push(['challenge', payload, token]);
      return { challengeId: 'challenge-123', nonce: 'nonce-123',
        authorizationUrl: 'https://appleid.apple.com/auth/authorize?state=state' };
    } },
    '@react-native-google-signin/google-signin': { GoogleSignin: {
      configure: value => calls.push(['google-configure', value]),
      hasPlayServices: async () => calls.push(['play-services']),
      signIn: async () => ({ type: 'success', data: { idToken: 'google-id-token' } }),
      signOut: async () => calls.push(['google-signout']),
    } },
    'react-native-fbsdk-next': {
      Settings: Object.fromEntries(['setAppID', 'setClientToken', 'setAutoLogAppEventsEnabled', 'setAdvertiserIDCollectionEnabled',
        'setAdvertiserTrackingEnabled', 'initializeSDK'].map(name => [name, (...args) => calls.push([name, ...args])])),
      LoginManager: {
        logInWithPermissions: async (...args) => { calls.push(['facebook-login', ...args]); return { isCancelled: !!overrides.cancelFacebook }; },
        logOut: () => calls.push(['facebook-logout']),
      },
      AccessToken: { getCurrentAccessToken: async () => { calls.push(['graph-token']); return { accessToken: 'graph-access' }; } },
      AuthenticationToken: { getAuthenticationTokenIOS: async () => ({ authenticationToken: 'limited-id-token' }) },
    },
    'expo-apple-authentication': {
      AppleAuthenticationScope: { EMAIL: 'email' },
      isAvailableAsync: async () => overrides.appleAvailable !== false,
      signInAsync: async options => { calls.push(['apple-native', options]); return {
        identityToken: 'apple-id-token', authorizationCode: 'one-use-code', state: overrides.wrongState ? 'other' : options.state,
      }; },
    },
    'expo-crypto': {
      CryptoDigestAlgorithm: { SHA256: 'sha256' }, CryptoEncoding: { BASE64: 'base64' },
      getRandomBytesAsync: async count => crypto.randomBytes(count),
      digestStringAsync: async (_algorithm, value) => crypto.createHash('sha256').update(value).digest('base64'),
    },
    'expo-web-browser': {
      openAuthSessionAsync: async (...args) => {
        calls.push(['apple-browser', ...args]);
        return overrides.browserResult || { type: 'success', url: 'com.potterwell.ninebelow://auth/apple?challengeId=challenge-123' };
      },
    },
  };
  const source = fs.readFileSync(path.join(__dirname, '../src/services/nativeSocialAuth.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(compiled, { exports, URL, require: name => {
    if (!(name in modules)) throw new Error('Unexpected native import: ' + name);
    return modules[name];
  } });
  return { api: exports, calls };
}

test('iOS only advertises social providers when Apple and each provider are ready', async () => {
  const f = fixture('ios');
  assert.equal(JSON.stringify(await f.api.availableSocialProviders(config)), JSON.stringify({ apple: true, google: true, facebook: true }));
  for (const options of [{ appleAvailable: false }, { config: { appleEnabled: false } }]) {
    const disabled = fixture('ios', options);
    assert.equal(Object.values(await disabled.api.availableSocialProviders(config)).some(Boolean), false);
  }
  assert.equal((await fixture('ios', { config: { googleIosClientId: '' } }).api.availableSocialProviders(config)).google, false);
  assert.equal((await f.api.availableSocialProviders({ ...config, mobileProviders: {} })).apple, false);
});

test('Google configures the iOS client ID and never checks Play Services on iOS', async () => {
  const f = fixture('ios');
  assert.equal((await f.api.getSocialCredential('google')).idToken, 'google-id-token');
  assert.equal(f.calls.find(call => call[0] === 'google-configure')[1].iosClientId, 'ios-id');
  assert.equal(f.calls.some(call => call[0] === 'play-services'), false);
  const android = fixture('android');
  await android.api.getSocialCredential('google');
  assert.equal(android.calls.some(call => call[0] === 'play-services'), true);
});

test('Facebook iOS requests Limited Login with a server nonce and no advertising collection', async () => {
  const f = fixture('ios');
  const credential = await f.api.getSocialCredential('facebook', 'link', 'game-session');
  assert.equal(credential.idToken, 'limited-id-token');
  assert.equal(credential.accessToken, undefined);
  assert.equal(f.calls.some(call => call[0] === 'graph-token'), false);
  assert.equal(f.calls.find(call => call[0] === 'facebook-login')[2], 'limited');
  assert.equal(f.calls.find(call => call[0] === 'facebook-login')[3], 'nonce-123');
  assert.equal(f.calls.find(call => call[0] === 'setAdvertiserTrackingEnabled')[1], false);
  const challenge = f.calls.find(call => call[0] === 'challenge');
  assert.equal(challenge[1].purpose, 'link');
  assert.equal(challenge[2], 'game-session');
  assert.equal(challenge[1].codeChallenge, crypto.createHash('sha256').update(credential.verifier).digest('base64url'));
});

test('Android keeps its existing Facebook access-token path and does not require Apple readiness', async () => {
  const f = fixture('android', { config: { appleEnabled: false } });
  assert.equal((await f.api.getSocialCredential('facebook')).accessToken, 'graph-access');
  assert.equal((await f.api.availableSocialProviders(config)).google, true);
  assert.equal(f.calls.some(call => call[0] === 'challenge'), false);
});

test('native Apple sends nonce/state and requests email but not the player real name', async () => {
  const f = fixture('ios');
  const credential = await f.api.getSocialCredential('apple', 'delete', 'session');
  const options = f.calls.find(call => call[0] === 'apple-native')[1];
  assert.equal(options.nonce, 'nonce-123');
  assert.equal(options.state, 'challenge-123');
  assert.equal(JSON.stringify(options.requestedScopes), '["email"]');
  assert.equal(credential.authorizationCode, 'one-use-code');
  assert.equal(credential.challengeId, 'challenge-123');
  await assert.rejects(fixture('ios', { wrongState: true }).api.getSocialCredential('apple'));
});

test('Android Apple browser handoff returns only device proof, never identity or session tokens', async () => {
  const f = fixture('android');
  const credential = await f.api.getSocialCredential('apple');
  assert.equal(credential.provider, 'apple');
  assert.equal(credential.challengeId, 'challenge-123');
  assert.ok(credential.verifier);
  assert.equal(credential.idToken, undefined);
  assert.equal(f.calls.some(call => call[0] === 'apple-native'), false);
});

test('browser cancellation, mismatched IDs, and foreign redirects fail closed', async () => {
  for (const browserResult of [{ type: 'cancel' }, { type: 'success', url: 'https://evil.example/auth/apple?challengeId=challenge-123' },
    { type: 'success', url: 'com.potterwell.ninebelow://auth/apple?challengeId=other' }]) {
    await assert.rejects(fixture('android', { browserResult }).api.getSocialCredential('apple'));
  }
  await assert.rejects(fixture('ios', { cancelFacebook: true }).api.getSocialCredential('facebook'));
});

test('iOS build config includes all provider plugins and refuses a linked Facebook SDK without configuration', () => {
  const source = fs.readFileSync(path.join(__dirname, '../app.config.js'), 'utf8');
  const env = { EXPO_PUBLIC_APP_TARGET: 'ios', EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED: '1',
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'web.apps.googleusercontent.com',
    EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: 'ios.apps.googleusercontent.com',
    EXPO_PUBLIC_FACEBOOK_APP_ID: '1234', EXPO_PUBLIC_FACEBOOK_CLIENT_TOKEN: 'public-client-token' };
  const build = values => {
    const module = { exports: {} };
    vm.runInNewContext(source, { module, process: { env: values } });
    return module.exports.expo;
  };
  const native = build(env);
  assert.equal(native.ios.usesAppleSignIn, true);
  assert.ok(native.scheme.includes('com.potterwell.ninebelow'));
  const google = native.plugins.find(plugin => Array.isArray(plugin) && plugin[0].includes('google-signin'));
  assert.equal(google[1].iosUrlScheme, 'com.googleusercontent.apps.ios');
  const facebook = native.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'react-native-fbsdk-next')[1];
  for (const field of ['advertiserIDCollectionEnabled', 'iosUserTrackingPermission', 'autoLogAppEventsEnabled', 'isAutoInitEnabled']) assert.equal(facebook[field], false);
  assert.ok(native.plugins.includes('expo-apple-authentication'));
  assert.throws(() => build({ ...env, EXPO_PUBLIC_FACEBOOK_APP_ID: '' }), /FACEBOOK_APP_ID/);
  assert.throws(() => build({ ...env, EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: '' }), /client IDs/);
});

test('signout avoids initializing unused providers, including Apple', async () => {
  const f = fixture('ios');
  await f.api.signOutProviders();
  assert.equal(f.calls.length, 0);
  await f.api.getSocialCredential('apple');
  await f.api.signOutProviders();
  assert.equal(f.calls.some(call => call[0] === 'google-signout'), false);
});
