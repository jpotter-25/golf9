import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeReleasePolicyStore,
  processReleasePolicySchedules,
  publishReleasePolicyChange,
  resolveReleasePolicy,
  restoreReleasePolicyRevision,
  scheduleReleasePolicyChange,
  updateRequiredPayload,
} from '../releasePolicy.js';

const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.potterwell.ninebelow';

function androidEntry(overrides = {}) {
  return {
    latestBuild: 43,
    latestVersion: '0.1.0',
    minimumBuild: 0,
    storeUrl: PLAY_URL,
    storeReady: true,
    enforcement: 'after_match',
    recommendedTitle: 'Update available',
    recommendedMessage: 'Build 43 is ready.',
    requiredTitle: 'Update required',
    requiredMessage: 'Install build 43 to continue.',
    ...overrides,
  };
}

test('release migration bootstraps the Nine Below package build without prompting or locking existing clients', () => {
  const store = normalizeReleasePolicyStore();
  const entry = store.entries['playtest.android'];

  assert.equal(entry.latestBuild, 45);
  assert.equal(entry.minimumBuild, 0);
  assert.equal(entry.storeReady, false);
  assert.equal(resolveReleasePolicy(store, { platform: 'android', channel: 'playtest', build: 42 }).status, 'current');
});

test('store-ready latest builds recommend an update and minimum builds require it', () => {
  const recommended = publishReleasePolicyChange(normalizeReleasePolicyStore(), {
    platform: 'android',
    channel: 'playtest',
    entry: androidEntry(),
    actor: 'Owner',
    reason: 'Build 43 is processed in Play internal testing.',
    now: 1_000,
  });
  const recommendedPolicy = resolveReleasePolicy(recommended.store, {
    platform: 'android',
    channel: 'playtest',
    build: 42,
    version: '0.1.0',
    now: 1_100,
  });
  assert.equal(recommendedPolicy.status, 'recommended');
  assert.equal(recommendedPolicy.latestBuild, 43);

  const required = publishReleasePolicyChange(recommended.store, {
    platform: 'android',
    channel: 'playtest',
    entry: androidEntry({ minimumBuild: 43 }),
    actor: 'Owner',
    reason: 'Require the verified internal testing build.',
    now: 2_000,
  });
  const requiredPolicy = resolveReleasePolicy(required.store, {
    platform: 'android',
    channel: 'playtest',
    build: 42,
    now: 2_100,
  });
  assert.equal(requiredPolicy.status, 'required');
  assert.equal(requiredPolicy.enforcement, 'after_match');
  assert.deepEqual(updateRequiredPayload(requiredPolicy), {
    error: 'Install build 43 to continue.',
    code: 'APP_UPDATE_REQUIRED',
    release: requiredPolicy,
  });
  assert.equal(resolveReleasePolicy(required.store, {
    platform: 'android',
    channel: 'playtest',
    build: 43,
  }).status, 'current');
});

test('Android, iOS, and browser release requirements stay independent across migration and restart', () => {
  const legacyStore = normalizeReleasePolicyStore({
    entries: { 'playtest.android': androidEntry({ latestBuild: 59, minimumBuild: 59 }) },
  });
  assert.equal(resolveReleasePolicy(legacyStore, { platform: 'android', channel: 'playtest', build: 58 }).status, 'required');
  assert.equal(resolveReleasePolicy(legacyStore, { platform: 'ios', channel: 'playtest', build: 1 }).status, 'current');
  assert.equal(resolveReleasePolicy(legacyStore, { platform: 'web', channel: 'playtest', build: 0 }).status, 'current');

  const ios = publishReleasePolicyChange(legacyStore, {
    platform: 'ios', channel: 'playtest',
    entry: androidEntry({ latestBuild: 3, minimumBuild: 3, storeUrl: 'https://testflight.apple.com/j/test' }),
    actor: 'Owner', reason: 'TestFlight build 3 is available.',
  });
  const web = publishReleasePolicyChange(ios.store, {
    platform: 'web', channel: 'playtest',
    entry: { latestBuild: 7, minimumBuild: 7, storeUrl: 'https://ninebelow.potterwell.com/play/', storeReady: true },
    actor: 'Owner', reason: 'Browser build 7 is published.',
  });
  const restarted = normalizeReleasePolicyStore(JSON.parse(JSON.stringify(web.store)));
  for (const [platform, build] of [['android', 59], ['ios', 3], ['web', 7]]) {
    const current = resolveReleasePolicy(restarted, { platform, channel: 'playtest', build });
    assert.equal(current.status, 'current');
    assert.equal(current.minimumBuild, build);
    assert.equal(resolveReleasePolicy(restarted, { platform, channel: 'playtest', build: build - 1 }).status, 'required');
    assert.equal(resolveReleasePolicy(restarted, { platform, channel: 'production', build: 0 }).status, 'current');
  }
  assert.match(resolveReleasePolicy(restarted, { platform: 'web', channel: 'playtest', build: 6 }).message, /reload/i);
});

test('unsafe release policies are rejected before publication', () => {
  assert.throws(() => publishReleasePolicyChange(normalizeReleasePolicyStore(), {
    platform: 'android',
    channel: 'playtest',
    entry: androidEntry({ latestBuild: 42, minimumBuild: 43 }),
    actor: 'Owner',
    reason: 'Invalid ordering.',
  }), /minimum build cannot be higher/i);

  assert.throws(() => publishReleasePolicyChange(normalizeReleasePolicyStore(), {
    platform: 'android',
    channel: 'playtest',
    entry: androidEntry({ minimumBuild: 43, storeReady: false }),
    actor: 'Owner',
    reason: 'Store is not ready.',
  }), /confirm the store release is ready/i);

  assert.throws(() => publishReleasePolicyChange(normalizeReleasePolicyStore(), {
    platform: 'android',
    channel: 'playtest',
    entry: androidEntry(),
    actor: 'Owner',
    reason: '',
  }), /administrative reason is required/i);
});

test('scheduled release requirements survive restart and activate on server time', () => {
  const scheduled = scheduleReleasePolicyChange(normalizeReleasePolicyStore(), {
    platform: 'android',
    channel: 'playtest',
    entry: androidEntry({ minimumBuild: 43 }),
    activateAt: 5_000,
    actor: 'Owner',
    reason: 'Require build after the store rollout completes.',
    now: 1_000,
  });
  const restarted = normalizeReleasePolicyStore(JSON.parse(JSON.stringify(scheduled.store)));
  assert.equal(restarted.schedules.length, 1);
  assert.equal(resolveReleasePolicy(restarted, { platform: 'android', channel: 'playtest', build: 42 }).status, 'current');

  const waiting = processReleasePolicySchedules(restarted, { now: 4_999 });
  assert.equal(waiting.changes.length, 0);
  const activated = processReleasePolicySchedules(waiting.store, { now: 5_000 });
  assert.equal(activated.changes.length, 1);
  assert.equal(activated.store.schedules.length, 0);
  assert.equal(resolveReleasePolicy(activated.store, { platform: 'android', channel: 'playtest', build: 42 }).status, 'required');
});

test('release revisions restore all channel snapshots and clear schedules', () => {
  const first = publishReleasePolicyChange(normalizeReleasePolicyStore(), {
    platform: 'android',
    channel: 'playtest',
    entry: androidEntry(),
    actor: 'Owner',
    reason: 'Recommend build 43.',
    now: 1_000,
  });
  const second = publishReleasePolicyChange(first.store, {
    platform: 'android',
    channel: 'playtest',
    entry: androidEntry({ minimumBuild: 43 }),
    actor: 'Owner',
    reason: 'Require build 43.',
    now: 2_000,
  });
  const restored = restoreReleasePolicyRevision(second.store, first.revision.revisionId, {
    actor: 'Owner',
    reason: 'Roll back the requirement.',
    now: 3_000,
  });

  assert.equal(restored.store.entries['playtest.android'].minimumBuild, 0);
  assert.equal(restored.store.schedules.length, 0);
  assert.equal(restored.store.revisions.at(-1).action, 'revision.restore');
});
