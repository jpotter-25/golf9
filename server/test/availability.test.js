import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FEATURE_REGISTRY,
  normalizeAvailabilityStore,
  processAvailabilitySchedules,
  publicAvailability,
  publishAvailabilityChange,
  resolveFeatureAvailability,
  restoreAvailabilityRevision,
  scheduleAvailabilityChange,
  unavailablePayload,
  updateAvailabilityTesters,
} from '../availability.js';

test('availability migration defaults every registered feature to live', () => {
  const store = normalizeAvailabilityStore();

  assert.equal(Object.keys(store.entries).length, FEATURE_REGISTRY.length);
  for (const feature of FEATURE_REGISTRY) {
    assert.equal(store.entries[feature.key].state, 'live');
  }
  assert.equal(store.revision, 0);
  assert.deepEqual(store.schedules, []);
});

test('parent restrictions override children and preserve custom lock messaging', () => {
  const published = publishAvailabilityChange(normalizeAvailabilityStore(), {
    featureKey: 'casual',
    entry: {
      state: 'maintenance',
      title: 'Casual tables are tuning up',
      message: 'Existing matches may finish. New tables will return shortly.',
      retryAt: 10_000,
    },
    actor: 'Operator',
    reason: 'Test parent inheritance.',
    now: 1_000,
  });

  const child = resolveFeatureAvailability(published.store, 'casual.wagers');
  assert.equal(child.state, 'maintenance');
  assert.equal(child.inheritedFrom, 'casual');
  assert.equal(child.configuredState, 'live');
  assert.equal(child.title, 'Casual tables are tuning up');
  assert.equal(child.message, 'Existing matches may finish. New tables will return shortly.');
  assert.equal(child.retryAt, 10_000);

  const payload = unavailablePayload(child);
  assert.deepEqual(payload, {
    error: 'Existing matches may finish. New tables will return shortly.',
    code: 'FEATURE_UNAVAILABLE',
    feature: 'casual.wagers',
    state: 'maintenance',
    title: 'Casual tables are tuning up',
    message: 'Existing matches may finish. New tables will return shortly.',
    retryAt: 10_000,
  });
});

test('hidden features resolve as hidden and named testers receive a visible preview bypass', () => {
  const hidden = publishAvailabilityChange(normalizeAvailabilityStore(), {
    featureKey: 'shop',
    entry: { state: 'hidden', title: 'Store hidden', message: 'Preparing a new catalog.' },
    actor: 'Operator',
    reason: 'Test hidden state.',
    now: 1_000,
  });
  const testers = updateAvailabilityTesters(hidden.store, ['tester-1'], {
    actor: 'Operator',
    reason: 'Allow release preview.',
    now: 2_000,
  });

  assert.equal(resolveFeatureAvailability(testers.store, 'shop', 'player-1').state, 'hidden');
  const preview = resolveFeatureAvailability(testers.store, 'shop', 'tester-1');
  assert.equal(preview.state, 'live');
  assert.equal(preview.testerPreview, true);
  assert.equal(preview.previewState, 'hidden');
  assert.equal(preview.previewTitle, 'Store hidden');

  const publicPolicy = publicAvailability(testers.store, 'tester-1', 3_000);
  assert.equal(publicPolicy.testerPreview, true);
  assert.equal(publicPolicy.features.shop.state, 'live');
  assert.equal(publicPolicy.features.shop.previewState, 'hidden');
  assert.equal('testerUserIds' in publicPolicy, false);
  assert.equal(JSON.stringify(publicPolicy).includes('tester-1'), false);
});

test('global maintenance blocks non-essential features while inbox remains live', () => {
  const result = publishAvailabilityChange(normalizeAvailabilityStore(), {
    featureKey: 'global',
    entry: { state: 'maintenance', title: 'Scheduled maintenance', message: 'Core services are being updated.' },
    actor: 'Operator',
    reason: 'Test global maintenance.',
    now: 1_000,
  });

  const ranked = resolveFeatureAvailability(result.store, 'ranked.4p');
  assert.equal(ranked.state, 'maintenance');
  assert.equal(ranked.inheritedFrom, 'global');
  assert.equal(resolveFeatureAvailability(result.store, 'profile').state, 'maintenance');
  assert.equal(resolveFeatureAvailability(result.store, 'inbox').state, 'live');
});

test('scheduled changes activate, survive normalization, and restore automatically', () => {
  const scheduled = scheduleAvailabilityChange(normalizeAvailabilityStore(), {
    featureKey: 'ranked.2p',
    entry: { state: 'coming_soon', title: 'Ranked preview', message: 'Opens shortly.' },
    activateAt: 2_000,
    restoreAt: 4_000,
    actor: 'Operator',
    reason: 'Test scheduled window.',
    now: 1_000,
  });

  const restarted = normalizeAvailabilityStore(JSON.parse(JSON.stringify(scheduled.store)));
  assert.equal(restarted.schedules.length, 1);
  assert.equal(resolveFeatureAvailability(restarted, 'ranked.2p').state, 'live');

  const activated = processAvailabilitySchedules(restarted, { now: 2_500 });
  assert.equal(activated.changes[0].type, 'activate');
  assert.equal(resolveFeatureAvailability(activated.store, 'ranked.2p').state, 'coming_soon');
  assert.equal(activated.store.schedules.length, 1);

  const restored = processAvailabilitySchedules(activated.store, { now: 4_500 });
  assert.equal(restored.changes[0].type, 'restore');
  assert.equal(resolveFeatureAvailability(restored.store, 'ranked.2p').state, 'live');
  assert.equal(restored.store.schedules.length, 0);
});

test('audited revisions can be restored and history retains only the latest 50', () => {
  const first = publishAvailabilityChange(normalizeAvailabilityStore(), {
    featureKey: 'tutorial',
    entry: { state: 'maintenance', title: 'Tutorial maintenance' },
    actor: 'Operator',
    reason: 'First tutorial state.',
    now: 1_000,
  });
  const second = publishAvailabilityChange(first.store, {
    featureKey: 'tutorial',
    entry: { state: 'hidden' },
    actor: 'Operator',
    reason: 'Second tutorial state.',
    now: 2_000,
  });
  const restored = restoreAvailabilityRevision(second.store, first.revision.revisionId, {
    actor: 'Owner',
    reason: 'Rollback hidden tutorial.',
    now: 3_000,
  });
  assert.equal(resolveFeatureAvailability(restored.store, 'tutorial').state, 'maintenance');
  assert.equal(restored.store.revisions.at(-1).action, 'revision.restore');

  let rolling = normalizeAvailabilityStore();
  for (let index = 0; index < 55; index += 1) {
    rolling = publishAvailabilityChange(rolling, {
      featureKey: 'rules',
      entry: { state: index % 2 ? 'live' : 'maintenance' },
      actor: 'Operator',
      reason: `Revision ${index + 1}.`,
      now: 10_000 + index,
    }).store;
  }
  assert.equal(rolling.revisions.length, 50);
  assert.equal(rolling.revisions[0].revision, 6);
  assert.throws(() => publishAvailabilityChange(rolling, {
    featureKey: 'rules',
    entry: { state: 'live' },
    actor: 'Operator',
    reason: '',
  }), /administrative reason is required/i);
});
