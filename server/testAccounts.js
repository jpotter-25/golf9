import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { normalizeUserProgression } from './progression.js';
import { normalizeRankedSeason } from './ranked.js';

export const DEV_TEST_ACCOUNTS = [
  { userId: 'dev-test-one', displayName: 't1test', password: 't1test' },
  { userId: 'dev-test-two', displayName: 't2test', password: 't2test' },
  { userId: 'dev-test-three', displayName: 't3test', password: 't3test' },
];

const STARTING_TEST_COINS = 5000;

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const passwordHash = crypto.pbkdf2Sync(password, salt, 120_000, 32, 'sha256').toString('hex');
  return { salt, passwordHash };
}

function hasPassword(user, password) {
  if (!user?.salt || !user?.passwordHash) return false;
  return hashPassword(password, user.salt).passwordHash === user.passwordHash;
}

export function shouldSeedDevTestAccounts(dataDir, defaultDataDir, env = process.env) {
  if (env.SEED_TEST_ACCOUNTS === '1') return true;
  if (env.SEED_TEST_ACCOUNTS === '0') return false;
  if (env.NODE_ENV === 'production') return false;
  return path.resolve(dataDir) === path.resolve(defaultDataDir);
}

export function devTestAccountForDisplayName(displayName) {
  const normalized = String(displayName || '').trim().toLowerCase();
  return DEV_TEST_ACCOUNTS.find(account => account.displayName.toLowerCase() === normalized) || null;
}

export function ensureDevTestAccounts(users, rankedSeason = null, now = Date.now()) {
  let changed = false;

  for (const account of DEV_TEST_ACCOUNTS) {
    const existingByName = [...users.values()]
      .find(user => user.displayName?.toLowerCase() === account.displayName.toLowerCase());
    const existingById = users.get(account.userId);
    const isNewUser = !existingByName && !existingById;
    const user = existingByName || existingById || {
      userId: account.userId,
      displayName: account.displayName,
      stats: { gamesPlayed: 0, wins: 0 },
      currency: { coins: STARTING_TEST_COINS, lifetimeCoins: STARTING_TEST_COINS },
    };

    if (user.displayName !== account.displayName) {
      user.displayName = account.displayName;
      changed = true;
    }

    if (!hasPassword(user, account.password)) {
      const credentials = hashPassword(account.password);
      user.salt = credentials.salt;
      user.passwordHash = credentials.passwordHash;
      changed = true;
    }

    normalizeUserProgression(user, now, rankedSeason || undefined);
    if (isNewUser) {
      user.currency.coins = Math.max(user.currency.coins, STARTING_TEST_COINS);
      user.currency.lifetimeCoins = Math.max(user.currency.lifetimeCoins, STARTING_TEST_COINS);
      changed = true;
    }
    if (!users.has(user.userId)) changed = true;
    users.set(user.userId, user);
  }

  return changed;
}

export function seedDevTestAccountsInStore(dataFile, now = Date.now()) {
  let store = { users: [], sessions: [], results: [], rankedSeason: normalizeRankedSeason(null, now) };
  try {
    store = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } catch {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  }

  const rankedSeason = normalizeRankedSeason(store.rankedSeason, now);
  const users = new Map((store.users || []).map(user => [user.userId, normalizeUserProgression(user, now, rankedSeason)]));
  const changed = ensureDevTestAccounts(users, rankedSeason, now);
  if (changed) {
    fs.writeFileSync(dataFile, JSON.stringify({
      users: [...users.values()],
      sessions: store.sessions || [],
      results: store.results || [],
      rankedSeason,
      clubs: store.clubs || [],
    }, null, 2));
  }
  return { changed, accounts: DEV_TEST_ACCOUNTS.map(({ displayName, password }) => ({ displayName, password })) };
}
