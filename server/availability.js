import crypto from 'crypto';

export const AVAILABILITY_STATES = Object.freeze(['live', 'coming_soon', 'maintenance', 'hidden']);

export const FEATURE_REGISTRY = Object.freeze([
  { key: 'global', label: 'Global maintenance', parent: null, group: 'System', impact: 'All non-essential player features' },
  { key: 'casual', label: 'Play Casual', parent: 'global', group: 'Game modes', impact: 'Casual rooms, queues, and lobbies' },
  { key: 'casual.auto_match', label: 'Auto-Match', parent: 'casual', group: 'Casual', impact: 'Casual matchmaking queue' },
  { key: 'casual.join_room', label: 'Join Room', parent: 'casual', group: 'Casual', impact: 'Room-code and invitation joins' },
  { key: 'casual.create_room', label: 'Create Room', parent: 'casual', group: 'Casual', impact: 'New custom casual rooms' },
  { key: 'casual.wagers', label: 'Wagers', parent: 'casual', group: 'Casual', impact: 'Wager rooms and buy-ins' },
  { key: 'ranked', label: 'Play Ranked', parent: 'global', group: 'Game modes', impact: 'All ranked queues and lobbies' },
  { key: 'ranked.2p', label: '2-player Ranked', parent: 'ranked', group: 'Ranked', impact: '2-player ranked queue' },
  { key: 'ranked.3p', label: '3-player Ranked', parent: 'ranked', group: 'Ranked', impact: '3-player ranked queue' },
  { key: 'ranked.4p', label: '4-player Ranked', parent: 'ranked', group: 'Ranked', impact: '4-player ranked queue' },
  { key: 'offline', label: 'Play Offline', parent: 'global', group: 'Game modes', impact: 'Local game navigation' },
  { key: 'offline.solo_ai', label: 'Solo AI', parent: 'offline', group: 'Offline', impact: 'Solo AI games' },
  { key: 'offline.pass_play', label: 'Pass & Play', parent: 'offline', group: 'Offline', impact: 'Local Pass & Play games' },
  { key: 'clubs', label: 'Clubs', parent: 'global', group: 'Community', impact: 'Clubhouse access' },
  { key: 'clubs.chat', label: 'Club Chat', parent: 'clubs', group: 'Clubs', impact: 'Live club chat' },
  { key: 'clubs.treasury', label: 'Club Treasury', parent: 'clubs', group: 'Clubs', impact: 'Donations, goals, and prestige purchases' },
  { key: 'clubs.management', label: 'Club Management', parent: 'clubs', group: 'Clubs', impact: 'Club creation, requests, roles, and management' },
  { key: 'shop', label: 'Shop', parent: 'global', group: 'Player', impact: 'Storefront and cosmetic purchases' },
  { key: 'social', label: 'Social', parent: 'global', group: 'Player', impact: 'Friends and social actions' },
  { key: 'inbox', label: 'Inbox', parent: 'global', group: 'Player', impact: 'Player mail (remains available during global maintenance)' },
  { key: 'profile', label: 'Profile & Cosmetics', parent: 'global', group: 'Player', impact: 'Profile, locker, and cosmetic equipping' },
  { key: 'rules', label: 'Rules', parent: 'global', group: 'Help', impact: 'Rules screen' },
  { key: 'tutorial', label: 'Tutorial', parent: 'global', group: 'Help', impact: 'Guided tutorial' },
]);

export const ESSENTIAL_DURING_GLOBAL_MAINTENANCE = Object.freeze(new Set(['inbox']));

const FEATURE_BY_KEY = new Map(FEATURE_REGISTRY.map(feature => [feature.key, feature]));
const HISTORY_LIMIT = 50;
const TITLE_LIMIT = 80;
const MESSAGE_LIMIT = 280;
const REASON_LIMIT = 240;

function cleanText(value, maxLength) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function finiteTimestamp(value) {
  const parsed = typeof value === 'string' ? Date.parse(value) : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function defaultEntry(featureKey) {
  return {
    featureKey,
    state: 'live',
    title: '',
    message: '',
    retryAt: null,
    updatedAt: null,
    updatedBy: null,
  };
}

export function isFeatureKey(value) {
  return FEATURE_BY_KEY.has(String(value || ''));
}

export function featureDefinition(featureKey) {
  return FEATURE_BY_KEY.get(String(featureKey || '')) || null;
}

export function normalizeAvailabilityEntry(featureKey, value = {}) {
  if (!isFeatureKey(featureKey)) throw new Error('Unknown feature key.');
  const state = AVAILABILITY_STATES.includes(value?.state) ? value.state : 'live';
  return {
    featureKey,
    state,
    title: cleanText(value?.title, TITLE_LIMIT),
    message: cleanText(value?.message, MESSAGE_LIMIT),
    retryAt: finiteTimestamp(value?.retryAt),
    updatedAt: finiteTimestamp(value?.updatedAt),
    updatedBy: cleanText(value?.updatedBy, 80) || null,
  };
}

function normalizeSchedule(value) {
  const featureKey = String(value?.featureKey || '');
  if (!isFeatureKey(featureKey)) return null;
  const activateAt = finiteTimestamp(value?.activateAt);
  if (!activateAt) return null;
  return {
    scheduleId: cleanText(value?.scheduleId, 80) || crypto.randomUUID(),
    featureKey,
    entry: normalizeAvailabilityEntry(featureKey, value?.entry),
    previousEntry: normalizeAvailabilityEntry(featureKey, value?.previousEntry),
    activateAt,
    restoreAt: finiteTimestamp(value?.restoreAt),
    activatedAt: finiteTimestamp(value?.activatedAt),
    createdAt: finiteTimestamp(value?.createdAt) || Date.now(),
    createdBy: cleanText(value?.createdBy, 80) || null,
    reason: cleanText(value?.reason, REASON_LIMIT),
  };
}

function snapshot(store) {
  return {
    entries: Object.fromEntries(FEATURE_REGISTRY.map(feature => [
      feature.key,
      { ...store.entries[feature.key] },
    ])),
    testerUserIds: [...store.testerUserIds],
  };
}

function addRevision(store, { actor = null, reason = '', action = 'publish', featureKey = null, now = Date.now() } = {}) {
  const cleanReason = cleanText(reason, REASON_LIMIT);
  if (!cleanReason) throw new Error('An administrative reason is required.');
  store.revision += 1;
  store.revisions.push({
    revisionId: crypto.randomUUID(),
    revision: store.revision,
    action,
    featureKey,
    actor: cleanText(actor, 80) || null,
    reason: cleanReason,
    createdAt: now,
    snapshot: snapshot(store),
  });
  if (store.revisions.length > HISTORY_LIMIT) store.revisions.splice(0, store.revisions.length - HISTORY_LIMIT);
  return store.revisions[store.revisions.length - 1];
}

export function normalizeAvailabilityStore(value = {}) {
  const entries = {};
  for (const feature of FEATURE_REGISTRY) {
    entries[feature.key] = normalizeAvailabilityEntry(feature.key, value?.entries?.[feature.key] || defaultEntry(feature.key));
  }
  const testerUserIds = [...new Set((value?.testerUserIds || []).map(item => String(item || '').trim()).filter(Boolean))];
  const schedules = (value?.schedules || []).map(normalizeSchedule).filter(Boolean);
  const latestScheduleByFeature = new Map();
  for (const schedule of schedules) latestScheduleByFeature.set(schedule.featureKey, schedule);
  const revisions = (value?.revisions || []).filter(item => item && item.revisionId).slice(-HISTORY_LIMIT).map(item => ({
    revisionId: String(item.revisionId),
    revision: Math.max(0, Number(item.revision) || 0),
    action: cleanText(item.action, 40) || 'publish',
    featureKey: isFeatureKey(item.featureKey) ? item.featureKey : null,
    actor: cleanText(item.actor, 80) || null,
    reason: cleanText(item.reason, REASON_LIMIT),
    createdAt: finiteTimestamp(item.createdAt) || Date.now(),
    snapshot: {
      entries: Object.fromEntries(FEATURE_REGISTRY.map(feature => [
        feature.key,
        normalizeAvailabilityEntry(feature.key, item.snapshot?.entries?.[feature.key]),
      ])),
      testerUserIds: [...new Set((item.snapshot?.testerUserIds || []).map(id => String(id || '').trim()).filter(Boolean))],
    },
  }));
  return {
    revision: Math.max(Number(value?.revision) || 0, ...revisions.map(item => item.revision), 0),
    entries,
    testerUserIds,
    schedules: [...latestScheduleByFeature.values()],
    revisions,
  };
}

function configuredResolution(store, featureKey) {
  const feature = featureDefinition(featureKey);
  if (!feature) throw new Error('Unknown feature key.');
  const own = store.entries[featureKey] || defaultEntry(featureKey);
  if (featureKey !== 'global' && !ESSENTIAL_DURING_GLOBAL_MAINTENANCE.has(featureKey)) {
    const globalEntry = store.entries.global || defaultEntry('global');
    if (globalEntry.state !== 'live') return { ...globalEntry, featureKey, inheritedFrom: 'global', configuredState: own.state };
  }
  if (feature.parent && feature.parent !== 'global') {
    const parent = configuredResolution(store, feature.parent);
    if (parent.state !== 'live') return { ...parent, featureKey, inheritedFrom: parent.inheritedFrom || feature.parent, configuredState: own.state };
  }
  return { ...own, featureKey, inheritedFrom: null, configuredState: own.state };
}

export function resolveFeatureAvailability(storeValue, featureKey, userId = null) {
  const store = normalizeAvailabilityStore(storeValue);
  const configured = configuredResolution(store, featureKey);
  const tester = !!userId && store.testerUserIds.includes(String(userId));
  if (tester && configured.state !== 'live') {
    return {
      ...configured,
      state: 'live',
      testerPreview: true,
      previewState: configured.state,
      previewTitle: configured.title,
      previewMessage: configured.message,
    };
  }
  return { ...configured, testerPreview: false, previewState: null, previewTitle: '', previewMessage: '' };
}

export function publicAvailability(storeValue, userId = null, now = Date.now()) {
  const store = normalizeAvailabilityStore(storeValue);
  return {
    revision: store.revision,
    fetchedAt: now,
    testerPreview: !!userId && store.testerUserIds.includes(String(userId)),
    features: Object.fromEntries(FEATURE_REGISTRY.map(feature => {
      const resolved = resolveFeatureAvailability(store, feature.key, userId);
      return [feature.key, {
        featureKey: resolved.featureKey,
        state: resolved.state,
        configuredState: resolved.configuredState,
        inheritedFrom: resolved.inheritedFrom,
        title: resolved.title,
        message: resolved.message,
        retryAt: resolved.retryAt,
        testerPreview: resolved.testerPreview,
        previewState: resolved.previewState,
        previewTitle: resolved.previewTitle,
        previewMessage: resolved.previewMessage,
        label: feature.label,
        parent: feature.parent,
      }];
    })),
  };
}

export function availabilityAdminView(storeValue, now = Date.now()) {
  const store = normalizeAvailabilityStore(storeValue);
  return {
    ...store,
    registry: FEATURE_REGISTRY,
    states: AVAILABILITY_STATES,
    fetchedAt: now,
  };
}

export function publishAvailabilityChange(storeValue, {
  featureKey,
  entry,
  testerUserIds,
  actor,
  reason,
  restoreAt = null,
  now = Date.now(),
} = {}) {
  const store = normalizeAvailabilityStore(storeValue);
  if (!isFeatureKey(featureKey)) throw new Error('Unknown feature key.');
  const previousEntry = { ...store.entries[featureKey] };
  const nextEntry = normalizeAvailabilityEntry(featureKey, {
    ...entry,
    updatedAt: now,
    updatedBy: actor,
    retryAt: entry?.retryAt || restoreAt,
  });
  store.entries[featureKey] = nextEntry;
  if (testerUserIds !== undefined) {
    store.testerUserIds = [...new Set((testerUserIds || []).map(id => String(id || '').trim()).filter(Boolean))];
  }
  store.schedules = store.schedules.filter(schedule => schedule.featureKey !== featureKey);
  const normalizedRestoreAt = finiteTimestamp(restoreAt);
  if (normalizedRestoreAt && normalizedRestoreAt > now) {
    store.schedules.push({
      scheduleId: crypto.randomUUID(),
      featureKey,
      entry: nextEntry,
      previousEntry,
      activateAt: now,
      restoreAt: normalizedRestoreAt,
      activatedAt: now,
      createdAt: now,
      createdBy: cleanText(actor, 80) || null,
      reason: cleanText(reason, REASON_LIMIT),
    });
  }
  const revision = addRevision(store, { actor, reason, action: 'publish', featureKey, now });
  return { store, revision, entry: nextEntry };
}

export function updateAvailabilityTesters(storeValue, testerUserIds, {
  actor,
  reason,
  now = Date.now(),
} = {}) {
  const store = normalizeAvailabilityStore(storeValue);
  store.testerUserIds = [...new Set((testerUserIds || [])
    .map(id => String(id || '').trim())
    .filter(Boolean))];
  const revision = addRevision(store, {
    actor,
    reason,
    action: 'testers.update',
    featureKey: null,
    now,
  });
  return { store, revision, testerUserIds: [...store.testerUserIds] };
}

export function scheduleAvailabilityChange(storeValue, {
  featureKey,
  entry,
  activateAt,
  restoreAt = null,
  actor,
  reason,
  replace = false,
  now = Date.now(),
} = {}) {
  const store = normalizeAvailabilityStore(storeValue);
  if (!isFeatureKey(featureKey)) throw new Error('Unknown feature key.');
  const startsAt = finiteTimestamp(activateAt);
  if (!startsAt || startsAt <= now) throw new Error('Scheduled activation must be in the future.');
  const existing = store.schedules.find(schedule => schedule.featureKey === featureKey);
  if (existing && !replace) throw new Error('This feature already has a pending schedule. Confirm replacement to continue.');
  const cleanReason = cleanText(reason, REASON_LIMIT);
  if (!cleanReason) throw new Error('An administrative reason is required.');
  store.schedules = store.schedules.filter(schedule => schedule.featureKey !== featureKey);
  const schedule = {
    scheduleId: crypto.randomUUID(),
    featureKey,
    entry: normalizeAvailabilityEntry(featureKey, entry),
    previousEntry: { ...store.entries[featureKey] },
    activateAt: startsAt,
    restoreAt: finiteTimestamp(restoreAt),
    activatedAt: null,
    createdAt: now,
    createdBy: cleanText(actor, 80) || null,
    reason: cleanReason,
  };
  if (schedule.restoreAt && schedule.restoreAt <= startsAt) throw new Error('Automatic restoration must occur after activation.');
  store.schedules.push(schedule);
  const revision = addRevision(store, { actor, reason, action: existing ? 'schedule.replace' : 'schedule.create', featureKey, now });
  return { store, revision, schedule };
}

export function cancelAvailabilitySchedule(storeValue, featureKey, { actor, reason, now = Date.now() } = {}) {
  const store = normalizeAvailabilityStore(storeValue);
  const schedule = store.schedules.find(item => item.featureKey === featureKey);
  if (!schedule) throw new Error('No pending schedule exists for this feature.');
  if (schedule.activatedAt && schedule.restoreAt) store.entries[featureKey] = { ...schedule.previousEntry, updatedAt: now, updatedBy: actor || null };
  store.schedules = store.schedules.filter(item => item.featureKey !== featureKey);
  const revision = addRevision(store, { actor, reason, action: 'schedule.cancel', featureKey, now });
  return { store, revision, schedule };
}

export function processAvailabilitySchedules(storeValue, { now = Date.now(), actor = 'system' } = {}) {
  const store = normalizeAvailabilityStore(storeValue);
  const changes = [];
  for (const schedule of [...store.schedules]) {
    if (!schedule.activatedAt && schedule.activateAt <= now) {
      store.entries[schedule.featureKey] = {
        ...schedule.entry,
        updatedAt: now,
        updatedBy: actor,
        retryAt: schedule.restoreAt || schedule.entry.retryAt || null,
      };
      schedule.activatedAt = now;
      const revision = addRevision(store, {
        actor,
        reason: schedule.reason || 'Scheduled Live Ops activation.',
        action: 'schedule.activate',
        featureKey: schedule.featureKey,
        now,
      });
      changes.push({ type: 'activate', featureKey: schedule.featureKey, revision });
    }
    if (schedule.activatedAt && schedule.restoreAt && schedule.restoreAt <= now) {
      store.entries[schedule.featureKey] = { ...schedule.previousEntry, updatedAt: now, updatedBy: actor };
      store.schedules = store.schedules.filter(item => item.scheduleId !== schedule.scheduleId);
      const revision = addRevision(store, {
        actor,
        reason: `Automatic restoration: ${schedule.reason || 'scheduled window ended'}`,
        action: 'schedule.restore',
        featureKey: schedule.featureKey,
        now,
      });
      changes.push({ type: 'restore', featureKey: schedule.featureKey, revision });
    } else if (schedule.activatedAt && !schedule.restoreAt) {
      store.schedules = store.schedules.filter(item => item.scheduleId !== schedule.scheduleId);
    }
  }
  return { store, changes };
}

export function restoreAvailabilityRevision(storeValue, revisionId, { actor, reason, now = Date.now() } = {}) {
  const store = normalizeAvailabilityStore(storeValue);
  const target = store.revisions.find(revision => revision.revisionId === String(revisionId || ''));
  if (!target) throw new Error('Availability revision not found.');
  store.entries = Object.fromEntries(FEATURE_REGISTRY.map(feature => [
    feature.key,
    normalizeAvailabilityEntry(feature.key, target.snapshot.entries[feature.key]),
  ]));
  store.testerUserIds = [...target.snapshot.testerUserIds];
  store.schedules = [];
  const revision = addRevision(store, { actor, reason, action: 'revision.restore', featureKey: null, now });
  return { store, revision, restoredRevision: target };
}

export function unavailablePayload(resolution) {
  const state = resolution?.previewState || resolution?.state || 'maintenance';
  const title = resolution?.previewTitle || resolution?.title || (state === 'coming_soon' ? 'Coming Soon' : 'Temporarily Unavailable');
  const message = resolution?.previewMessage || resolution?.message || 'This feature is not available right now. Please check back soon.';
  return {
    error: message,
    code: 'FEATURE_UNAVAILABLE',
    feature: resolution?.featureKey || null,
    state,
    title,
    message,
    retryAt: resolution?.retryAt || null,
  };
}
