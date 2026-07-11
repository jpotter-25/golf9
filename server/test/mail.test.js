import assert from 'node:assert/strict';
import test from 'node:test';
import {
  claimMailForUser,
  cleanFeedbackPayload,
  createSystemMail,
  deleteMailForUser,
  mailEntriesForUser,
  mailSummaryForUser,
  markMailRead,
} from '../mail.js';

function player(overrides = {}) {
  return {
    userId: 'mail-user',
    displayName: 'Mail User',
    salt: 'unused',
    passwordHash: 'unused',
    ...overrides,
  };
}

test('system mail delivers notices and summarizes unread claimable rewards', () => {
  const entries = [];
  const timestamp = Date.UTC(2026, 0, 1, 12);
  const result = createSystemMail(entries, [player()], { adminId: 'a1', displayName: 'Admin' }, {
    title: 'Welcome gift',
    message: 'Thanks for helping test Golf 9.',
    coins: 125,
  }, [], timestamp);

  assert.equal(result.error, undefined);
  assert.equal(result.count, 1);
  const summary = mailSummaryForUser(entries, 'mail-user');
  assert.equal(summary.total, 1);
  assert.equal(summary.unread, 1);
  assert.equal(summary.claimable, 1);
  assert.equal(summary.attention, 1);
  assert.equal(summary.latest.title, 'Welcome gift');
});

test('mail attention counts unread-or-claimable entries once until both resolve', () => {
  const entries = [];
  const account = player({ currency: { coins: 0, lifetimeCoins: 0 } });
  createSystemMail(entries, [account], { displayName: 'Admin' }, {
    title: 'One badge, two reasons',
    message: 'Read this and collect the attached coins.',
    coins: 25,
  });
  const mailId = entries[0].mailId;

  assert.deepEqual(
    (({ unread, claimable, attention }) => ({ unread, claimable, attention }))(mailSummaryForUser(entries, account.userId)),
    { unread: 1, claimable: 1, attention: 1 },
  );
  markMailRead(entries, account.userId, mailId);
  assert.deepEqual(
    (({ unread, claimable, attention }) => ({ unread, claimable, attention }))(mailSummaryForUser(entries, account.userId)),
    { unread: 0, claimable: 1, attention: 1 },
  );
  claimMailForUser(entries, account, [], mailId);
  assert.deepEqual(
    (({ unread, claimable, attention }) => ({ unread, claimable, attention }))(mailSummaryForUser(entries, account.userId)),
    { unread: 0, claimable: 0, attention: 0 },
  );
});

test('mail reward claims are idempotent', () => {
  const entries = [];
  const account = player({ currency: { coins: 10, lifetimeCoins: 10 } });
  createSystemMail(entries, [account], { displayName: 'Admin' }, {
    title: 'Compensation',
    message: 'A small thank you.',
    coins: 50,
  });
  const mailId = entries[0].mailId;

  const first = claimMailForUser(entries, account, [], mailId);
  const second = claimMailForUser(entries, account, [], mailId);

  assert.equal(first.error, undefined);
  assert.equal(second.alreadyClaimed, true);
  assert.equal(account.currency.coins, 60);
  assert.equal(account.currency.lifetimeCoins, 60);
  assert.deepEqual(second.rewards, [{ type: 'coins', amount: 50 }]);
});

test('expired reward mail cannot be claimed', () => {
  const entries = [];
  const account = player({ currency: { coins: 0, lifetimeCoins: 0 } });
  const createdAt = Date.now();
  createSystemMail(entries, [account], { displayName: 'Admin' }, {
    title: 'Timed gift',
    message: 'Claim soon.',
    coins: 25,
    expiresAt: new Date(createdAt + 1000).toISOString(),
  }, [], createdAt);

  const result = claimMailForUser(entries, account, [], entries[0].mailId, createdAt + 2000);

  assert.equal(result.status, 410);
  assert.equal(account.currency.coins, 0);
});

test('mail can be marked read and deleted without removing history', () => {
  const entries = [];
  createSystemMail(entries, [player()], { displayName: 'Admin' }, {
    title: 'Patch notes',
    message: 'New update is live.',
  });
  const mailId = entries[0].mailId;

  const read = markMailRead(entries, 'mail-user', mailId);
  const deleted = deleteMailForUser(entries, 'mail-user', mailId);

  assert.equal(read.mail.read, true);
  assert.equal(deleted.ok, true);
  assert.equal(mailEntriesForUser(entries, 'mail-user').length, 0);
  assert.equal(mailEntriesForUser(entries, 'mail-user', { includeDeleted: true }).length, 1);
});

test('mail feedback payloads are categorized and length-limited', () => {
  const clean = cleanFeedbackPayload({
    category: 'bug',
    subject: 'Card issue',
    message: `${'x'.repeat(1200)}`,
  });
  const fallback = cleanFeedbackPayload({ category: 'not-real', message: 'This is a suggestion.' });
  const rejected = cleanFeedbackPayload({ category: 'bug', message: 'no' });

  assert.equal(clean.category, 'bug');
  assert.equal(clean.message.length, 1000);
  assert.equal(fallback.category, 'other');
  assert.equal(rejected.error, 'Feedback must be at least 6 characters.');
});
