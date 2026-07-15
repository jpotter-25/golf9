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

const PLAY_URL = 'https://play.google.com/store/apps/details?id=us.joinup.golf_9';

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

test('release migration bootstraps build 43 without prompting or locking existing clients', () => {
  const store = normalizeReleasePolicyStore();
  const entry = store.entries['playtest.android'];

  assert.equal(entry.latestBuild, 43);
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
