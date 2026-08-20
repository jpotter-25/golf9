import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adminEarlyAccessSignups,
  applyEarlyAccessRetention,
  claimEarlyAccessDelivery,
  completeEarlyAccessDelivery,
  completeEarlyAccessOnboarding,
  confirmEarlyAccessSignup,
  createEarlyAccessCampaign,
  decryptEarlyAccessContact,
  earlyAccessCsv,
  earlyAccessPreferences,
  earlyAccessSecurityStatus,
  encryptEarlyAccessContact,
  failEarlyAccessDelivery,
  markEarlyAccessActivated,
  normalizeEarlyAccessStore,
  renderEarlyAccessCampaignEmail,
  scheduleEarlyAccessCampaign,
  submitEarlyAccessSignup,
  unsubscribeEarlyAccess,
  updateEarlyAccessSignup,
  updateEarlyAccessConfig,
  validateEarlyAccessFeedback,
} from '../earlyAccess.js';

const env = {
  NODE_ENV: 'test',
  EARLY_ACCESS_PII_KEY: 'test-pii-key-that-is-at-least-thirty-two-characters',
  EARLY_ACCESS_TOKEN_SECRET: 'test-token-secret-that-is-at-least-thirty-two-characters',
};

function openStore() {
  const store = normalizeEarlyAccessStore({});
  updateEarlyAccessConfig(store, { enrollmentStatus: 'open', statusMessage: 'Open for testing.' });
  return store;
}

function signupBody(overrides = {}) {
  return {
    email: 'tester@example.com',
    firstName: 'Taylor',
    platforms: ['android'],
    webFuture: true,
    consent: true,
    ageConfirmed: true,
    source: 'partner-meeting',
    ...overrides,
  };
}

function confirmedSignup(store, at = 1_000_000, body = signupBody()) {
  const submitted = submitEarlyAccessSignup(store, body, { env, now: at, ipHash: 'ip-hash' });
  assert.equal(submitted.queued, true);
  const confirmed = confirmEarlyAccessSignup(store, submitted.confirmationToken, { env, now: at + 1000 });
  assert.equal(confirmed.ok, true);
  return { submitted, signup: confirmed.signup };
}

test('early-access contact data encrypts with authenticated encryption', () => {
  const encrypted = encryptEarlyAccessContact({ email: 'tester@example.com', firstName: 'Taylor' }, env);
  assert.doesNotMatch(encrypted, /tester@example\.com/);
  assert.deepEqual(decryptEarlyAccessContact(encrypted, env), { email: 'tester@example.com', firstName: 'Taylor' });
  assert.equal(decryptEarlyAccessContact(`${encrypted}tampered`, env), null);
});

test('every production environment indicator requires explicit independent secrets', () => {
  const missing = earlyAccessSecurityStatus({ APP_ENV: 'production' });
  assert.equal(missing.ready, false);
  assert.equal(missing.production, true);
  assert.equal(missing.piiConfigured, false);
  assert.equal(missing.tokenConfigured, false);

  const configured = earlyAccessSecurityStatus({
    EXPO_PUBLIC_APP_ENV: 'prod',
    EARLY_ACCESS_PII_KEY: env.EARLY_ACCESS_PII_KEY,
    EARLY_ACCESS_TOKEN_SECRET: env.EARLY_ACCESS_TOKEN_SECRET,
  });
  assert.equal(configured.ready, true);
});

test('early-access signup requires double opt-in and verifies preference changes', () => {
  const store = openStore();
  const first = submitEarlyAccessSignup(store, signupBody(), { env, now: 1_000_000, ipHash: 'ip-hash' });
  assert.equal(first.signup.consentStatus, 'pending');
  assert.deepEqual(first.signup.platforms, ['android', 'web_future']);

  const throttled = submitEarlyAccessSignup(store, signupBody(), { env, now: 1_000_100 });
  assert.equal(throttled.throttled, true);
  assert.equal(store.signups.length, 1);

  const confirmed = confirmEarlyAccessSignup(store, first.confirmationToken, { env, now: 1_001_000 });
  assert.equal(confirmed.signup.consentStatus, 'confirmed');
  assert.equal(confirmed.signup.testerStage, 'waitlisted');
  assert.equal(confirmEarlyAccessSignup(store, first.confirmationToken, { env, now: 1_002_000 }).error.length > 0, true);

  const update = submitEarlyAccessSignup(store, signupBody({ firstName: 'Updated', platforms: ['ios'], webFuture: false }), { env, now: 2_000_000 });
  assert.equal(update.signup.consentStatus, 'confirmed');
  assert.deepEqual(update.signup.platforms, ['android', 'web_future']);
  confirmEarlyAccessSignup(store, update.confirmationToken, { env, now: 2_001_000 });
  const listed = adminEarlyAccessSignups(store, {}, { env })[0];
  assert.equal(listed.firstName, 'Updated');
  assert.deepEqual(listed.platforms, ['ios']);
});

test('preferences, unsubscribe, resubscribe, onboarding, and feedback preserve consent boundaries', () => {
  const store = openStore();
  const { signup } = confirmedSignup(store);
  const contact = decryptEarlyAccessContact(signup.contactEncrypted, env);
  const preferences = earlyAccessPreferences(store, contact.manageToken, { env, now: 1_050_000 });
  assert.match(preferences.signup.email, /^te\*+@example\.com$/);

  const unsubscribed = unsubscribeEarlyAccess(store, contact.manageToken, { env, now: 1_100_000 });
  assert.equal(unsubscribed.signup.consentStatus, 'unsubscribed');
  assert.equal(unsubscribed.signup.testerStage, 'declined');

  const resubmitted = submitEarlyAccessSignup(store, signupBody(), { env, now: 2_100_000 });
  assert.equal(resubmitted.signup.consentStatus, 'pending');
  const rejoinedContact = decryptEarlyAccessContact(resubmitted.signup.contactEncrypted, env);
  assert.notEqual(rejoinedContact.manageToken, contact.manageToken);
  assert.ok(earlyAccessPreferences(store, contact.manageToken, { env, now: 2_100_500 }).error);
  const reconfirmed = confirmEarlyAccessSignup(store, resubmitted.confirmationToken, { env, now: 2_101_000 });
  updateEarlyAccessSignup(store, reconfirmed.signup.signupId, { testerStage: 'selected' }, { adminId: 'admin-1' }, { env, now: 2_101_500 });
  const onboarding = completeEarlyAccessOnboarding(store, rejoinedContact.manageToken, {
    platformEmail: 'play-tester@gmail.com',
    deviceModel: 'Pixel Test',
    osVersion: 'Android Test',
    acknowledged: true,
  }, { env, now: 2_102_000 });
  assert.equal(onboarding.signup.testerStage, 'ready');
  const protectedContact = decryptEarlyAccessContact(onboarding.signup.contactEncrypted, env);
  assert.equal(protectedContact.platformEmail, 'play-tester@gmail.com');
  assert.equal(protectedContact.deviceModel, 'Pixel Test');
  assert.doesNotMatch(JSON.stringify(onboarding.signup), /Pixel Test|Android Test/);

  const feedback = validateEarlyAccessFeedback(store, rejoinedContact.manageToken, {
    category: 'bug', severity: 'blocking', actual: 'The match stopped before the final card resolved.',
  }, { env, now: 2_103_000 });
  assert.equal(feedback.feedback.signupId, signup.signupId);
  assert.equal(feedback.feedback.severity, 'blocking');
});

test('management credentials stop authorizing participant operations after expiry', () => {
  const store = openStore();
  const { signup } = confirmedSignup(store);
  const manageToken = decryptEarlyAccessContact(signup.contactEncrypted, env).manageToken;
  signup.manageTokenExpiresAt = 1_049_999;
  assert.match(earlyAccessPreferences(store, manageToken, { env, now: 1_050_000 }).error, /invalid|expired|no longer active/i);
  const neutralUnsubscribe = unsubscribeEarlyAccess(store, manageToken, { env, now: 1_050_000 });
  assert.equal(neutralUnsubscribe.ok, true);
  assert.equal(neutralUnsubscribe.signup, undefined);
  assert.equal(signup.consentStatus, 'confirmed');
});

test('a confirmed resubmission cannot revive an expired management credential', () => {
  const store = openStore();
  const { signup } = confirmedSignup(store);
  const originalToken = decryptEarlyAccessContact(signup.contactEncrypted, env).manageToken;
  signup.manageTokenExpiresAt = 1_049_999;

  const resubmitted = submitEarlyAccessSignup(store, signupBody({ platforms: ['ios'], webFuture: false }), {
    env,
    now: 2_000_000,
  });
  assert.equal(resubmitted.signup.consentStatus, 'confirmed');
  assert.deepEqual(resubmitted.signup.platforms, ['android', 'web_future']);
  assert.match(earlyAccessPreferences(store, originalToken, { env, now: 2_000_001 }).error, /invalid|expired|no longer active/i);

  const confirmed = confirmEarlyAccessSignup(store, resubmitted.confirmationToken, { env, now: 2_001_000 });
  assert.equal(confirmed.ok, true);
  const rotatedToken = decryptEarlyAccessContact(confirmed.signup.contactEncrypted, env).manageToken;
  assert.notEqual(rotatedToken, originalToken);
  assert.deepEqual(earlyAccessPreferences(store, rotatedToken, { env, now: 2_001_001 }).signup.platforms, ['ios']);
});

test('controlled campaigns segment recipients, queue once, render unsubscribe headers, and activate invite users', () => {
  const store = openStore();
  const { signup } = confirmedSignup(store);
  const admin = { adminId: 'admin-1', displayName: 'Owner' };
  const selection = createEarlyAccessCampaign(store, {
    internalName: 'Android selection wave 1',
    type: 'selection',
    targetPlatform: 'android',
    waveSize: 25,
    subject: 'You were selected for Nine Below',
    heading: 'Your table is almost ready',
    body: 'Complete your private tester setup so we can prepare your access.',
  }, admin, { now: 2_000_000 });
  assert.equal(selection.error, undefined);
  const scheduledSelection = scheduleEarlyAccessCampaign(store, selection.campaign.campaignId, admin, { env, now: 2_001_000 });
  assert.equal(scheduledSelection.deliveries.length, 1);
  assert.equal(store.signups.find(item => item.signupId === signup.signupId).testerStage, 'selected');
  const claimedSelection = claimEarlyAccessDelivery(store, { now: 2_001_000 });
  const selectionMessage = renderEarlyAccessCampaignEmail(claimedSelection.campaign, claimedSelection.signup, claimedSelection.delivery, {
    env, baseUrl: 'https://ninebelow.potterwell.com', postalAddress: 'PO Box 9, Example, WI 00000',
  });
  assert.match(selectionMessage.text, /Complete tester setup/);
  assert.match(selectionMessage.headers['List-Unsubscribe'], /early-access\/unsubscribe/);
  const unsubscribeToken = decodeURIComponent(selectionMessage.headers['List-Unsubscribe'].match(/token=([^>]+)/)?.[1] || '');
  assert.match(unsubscribeToken, /^u1\./);
  assert.ok(earlyAccessPreferences(store, unsubscribeToken, { env }).error);
  completeEarlyAccessDelivery(store, claimedSelection.delivery.deliveryId, { now: 2_002_000 });
  assert.equal(store.signups.find(item => item.signupId === signup.signupId).testerStage, 'onboarding');

  const currentSignup = store.signups.find(item => item.signupId === signup.signupId);
  const manageToken = decryptEarlyAccessContact(currentSignup.contactEncrypted, env).manageToken;
  completeEarlyAccessOnboarding(store, manageToken, { acknowledged: true }, { env, now: 2_003_000 });
  const access = createEarlyAccessCampaign(store, {
    internalName: 'Android access wave 1', type: 'access', targetPlatform: 'android', waveSize: 25,
    subject: 'Nine Below early access starts now', heading: 'Welcome to the first deal',
    body: 'Install the testing build and use your private one-use game code.',
    accessUrl: 'https://play.google.com/apps/testing/com.potterwell.ninebelow',
  }, admin, { now: 2_004_000 });
  const scheduledAccess = scheduleEarlyAccessCampaign(store, access.campaign.campaignId, admin, {
    env,
    now: 2_005_000,
    createInvite: () => ({ inviteId: 'invite-1', code: 'WAVE1-CODE' }),
  });
  assert.equal(scheduledAccess.deliveries.length, 1);
  assert.equal(scheduleEarlyAccessCampaign(store, access.campaign.campaignId, admin, { env, now: 2_006_000 }).error.length > 0, true);
  const claimedAccess = claimEarlyAccessDelivery(store, { now: 2_005_000 });
  const accessMessage = renderEarlyAccessCampaignEmail(claimedAccess.campaign, claimedAccess.signup, claimedAccess.delivery, {
    env, baseUrl: 'https://ninebelow.potterwell.com', postalAddress: 'PO Box 9, Example, WI 00000',
  });
  assert.match(accessMessage.text, /WAVE1-CODE/);
  completeEarlyAccessDelivery(store, claimedAccess.delivery.deliveryId, { now: 2_006_000 });
  assert.equal(store.signups.find(item => item.signupId === signup.signupId).testerStage, 'invited');
  markEarlyAccessActivated(store, signup.signupId, 'user-1', { now: 2_007_000 });
  assert.equal(store.signups.find(item => item.signupId === signup.signupId).testerStage, 'activated');
  assert.equal(store.signups.find(item => item.signupId === signup.signupId).activatedUserId, 'user-1');
});

test('exports neutralize spreadsheet formulas and retention erases or removes expired records', () => {
  const store = openStore();
  const { signup } = confirmedSignup(store, 1_000_000, signupBody({ firstName: '=HYPERLINK("bad")' }));
  const csv = earlyAccessCsv(store, {}, { env });
  assert.match(csv, /"'=HYPERLINK/);

  const contact = decryptEarlyAccessContact(signup.contactEncrypted, env);
  unsubscribeEarlyAccess(store, contact.manageToken, { env, now: 2_000_000 });
  const retention = applyEarlyAccessRetention(store, { now: 2_000_000 + (31 * 24 * 60 * 60 * 1000) });
  assert.equal(retention.erased, 1);
  assert.equal(store.signups[0].contactEncrypted, '');
  assert.deepEqual(store.signups[0].platforms, []);
  assert.deepEqual(store.signups[0].attribution, {});
  assert.deepEqual(store.signups[0].notes, []);

  const pending = submitEarlyAccessSignup(store, signupBody({ email: 'pending@example.com' }), { env, now: 5_000_000 });
  assert.equal(pending.signup.consentStatus, 'pending');
  applyEarlyAccessRetention(store, { now: pending.signup.confirmationExpiresAt + (31 * 24 * 60 * 60 * 1000) });
  assert.equal(store.signups.some(item => item.signupId === pending.signup.signupId), false);

  const abandonedStore = openStore();
  const { signup: previous } = confirmedSignup(abandonedStore, 10_000_000, signupBody({ email: 'resubscribe@example.com' }));
  const previousToken = decryptEarlyAccessContact(previous.contactEncrypted, env).manageToken;
  unsubscribeEarlyAccess(abandonedStore, previousToken, { env, now: 11_000_000 });
  const abandoned = submitEarlyAccessSignup(abandonedStore, signupBody({ email: 'resubscribe@example.com' }), { env, now: 12_000_000 });
  applyEarlyAccessRetention(abandonedStore, { env, now: abandoned.signup.confirmationExpiresAt + (31 * 24 * 60 * 60 * 1000) });
  assert.equal(abandonedStore.signups.length, 0);
});

test('delivery errors redact addresses and bearer values before persistence', () => {
  const store = openStore();
  const { signup } = confirmedSignup(store);
  const campaign = createEarlyAccessCampaign(store, {
    type: 'update', subject: 'Update', heading: 'Update', body: 'Testing update.',
  }, { adminId: 'admin-1', displayName: 'Owner' }).campaign;
  scheduleEarlyAccessCampaign(store, campaign.campaignId, { adminId: 'admin-1' }, { env, now: 2_000_000 });
  const claimed = claimEarlyAccessDelivery(store, { now: 2_000_000 });
  failEarlyAccessDelivery(store, claimed.delivery.deliveryId, new Error('Rejected tester@example.com token=abcdefghijklmnopqrstuvwxyz123456'), { now: 2_000_100 });
  assert.doesNotMatch(claimed.delivery.lastError, /tester@example\.com|abcdefghijklmnopqrstuvwxyz123456/);
  assert.match(claimed.delivery.lastError, /\[redacted-email\]|\[redacted\]/);
  assert.equal(signup.signupId, claimed.signup.signupId);
});

test('retention requests renewed consent after 24 months and erases PII when it is not renewed', () => {
  const day = 24 * 60 * 60 * 1000;
  const renewedStore = openStore();
  const { signup: renewable } = confirmedSignup(renewedStore, 1_000_000, signupBody({ email: 'renew@example.com' }));
  const renewalAt = renewable.consentRefreshedAt + (730 * day) + 1;
  const renewal = applyEarlyAccessRetention(renewedStore, { env, now: renewalAt });
  assert.equal(renewal.changed, true);
  assert.equal(renewal.reconfirmations.length, 1);
  assert.equal(renewable.consentStatus, 'pending');
  assert.equal(renewable.needsReconfirmation, true);
  const confirmed = confirmEarlyAccessSignup(renewedStore, renewal.reconfirmations[0].confirmationToken, { env, now: renewalAt + 1000 });
  assert.equal(confirmed.ok, true);
  assert.equal(renewable.consentStatus, 'confirmed');
  assert.equal(renewable.needsReconfirmation, false);
  assert.equal(renewable.consentHistory.at(-1).type, 'reconfirmed');

  const expiredStore = openStore();
  const { signup: expired } = confirmedSignup(expiredStore, 1_000_000, signupBody({ email: 'expire@example.com' }));
  const requestAt = expired.consentRefreshedAt + (730 * day) + 1;
  applyEarlyAccessRetention(expiredStore, { env, now: requestAt });
  const erased = applyEarlyAccessRetention(expiredStore, { env, now: requestAt + (31 * day) });
  assert.equal(erased.erased, 1);
  assert.equal(expired.consentStatus, 'unsubscribed');
  assert.equal(expired.contactEncrypted, '');
  assert.equal(expired.erasedAt, requestAt + (31 * day));
});
