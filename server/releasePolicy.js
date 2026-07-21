import crypto from 'crypto';

export const RELEASE_PLATFORMS = Object.freeze(['android', 'ios']);
export const RELEASE_CHANNELS = Object.freeze(['playtest', 'production']);
export const RELEASE_ENFORCEMENTS = Object.freeze(['after_match', 'immediate']);

const HISTORY_LIMIT = 50;
const REASON_LIMIT = 240;
const TITLE_LIMIT = 80;
const MESSAGE_LIMIT = 280;
const VERSION_LIMIT = 40;
const URL_LIMIT = 500;

const ANDROID_STORE_URL = 'https://play.google.com/store/apps/details?id=us.joinup.golf_9';

function cleanText(value, maxLength) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function finiteTimestamp(value) {
  const parsed = typeof value === 'string' ? Date.parse(value) : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function nonnegativeInteger(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

export function releasePolicyKey(platform, channel) {
  const normalizedPlatform = RELEASE_PLATFORMS.includes(platform) ? platform : null;
  const normalizedChannel = RELEASE_CHANNELS.includes(channel) ? channel : null;
  if (!normalizedPlatform || !normalizedChannel) throw new Error('Unknown release platform or channel.');
  return `${normalizedChannel}.${normalizedPlatform}`;
}

function splitReleasePolicyKey(key) {
  const [channel, platform] = String(key || '').split('.');
  releasePolicyKey(platform, channel);
  return { platform, channel };
}

function defaultEntry(platform, channel) {
  const isPlaytestAndroid = platform === 'android' && channel === 'playtest';
  return {
    key: releasePolicyKey(platform, channel),
    platform,
    channel,
    latestBuild: isPlaytestAndroid ? 43 : 0,
    latestVersion: isPlaytestAndroid ? '0.1.0' : '',
    minimumBuild: 0,
    storeUrl: platform === 'android' ? ANDROID_STORE_URL : '',
    storeReady: false,
    enforcement: 'after_match',
    recommendedTitle: 'Nine Below update available',
    recommendedMessage: 'A newer version of Nine Below is ready. Update now for the latest fixes and features.',
    requiredTitle: 'Update required',
    requiredMessage: 'A newer version of Nine Below is required before online play can continue.',
    updatedAt: null,
    updatedBy: null,
  };
}

export function normalizeReleasePolicyEntry(platform, channel, value = {}) {
  const defaults = defaultEntry(platform, channel);
  const latestBuild = nonnegativeInteger(value?.latestBuild ?? defaults.latestBuild);
  const minimumBuild = nonnegativeInteger(value?.minimumBuild ?? defaults.minimumBuild);
  const enforcement = RELEASE_ENFORCEMENTS.includes(value?.enforcement)
    ? value.enforcement
    : defaults.enforcement;
  return {
    key: releasePolicyKey(platform, channel),
    platform,
    channel,
    latestBuild,
    latestVersion: cleanText(value?.latestVersion ?? defaults.latestVersion, VERSION_LIMIT),
    minimumBuild,
    storeUrl: cleanText(value?.storeUrl ?? defaults.storeUrl, URL_LIMIT),
    storeReady: value?.storeReady === true,
    enforcement,
    recommendedTitle: cleanText(value?.recommendedTitle ?? defaults.recommendedTitle, TITLE_LIMIT),
    recommendedMessage: cleanText(value?.recommendedMessage ?? defaults.recommendedMessage, MESSAGE_LIMIT),
    requiredTitle: cleanText(value?.requiredTitle ?? defaults.requiredTitle, TITLE_LIMIT),
    requiredMessage: cleanText(value?.requiredMessage ?? defaults.requiredMessage, MESSAGE_LIMIT),
    updatedAt: finiteTimestamp(value?.updatedAt),
    updatedBy: cleanText(value?.updatedBy, 80) || null,
  };
}

function validatePublishableEntry(entry) {
  if (entry.minimumBuild > entry.latestBuild) {
    throw new Error('Minimum build cannot be higher than the latest build.');
  }
  if (entry.minimumBuild > 0 && !entry.storeReady) {
    throw new Error('Confirm the store release is ready before requiring this build.');
  }
  if ((entry.latestBuild > 0 || entry.minimumBuild > 0) && !entry.storeUrl) {
    throw new Error('A store URL is required for published app builds.');
  }
  return entry;
}

function normalizeSchedule(value) {
  try {
    const { platform, channel } = splitReleasePolicyKey(value?.key);
    const activateAt = finiteTimestamp(value?.activateAt);
    if (!activateAt) return null;
    return {
      scheduleId: cleanText(value?.scheduleId, 80) || crypto.randomUUID(),
      key: releasePolicyKey(platform, channel),
      entry: normalizeReleasePolicyEntry(platform, channel, value?.entry),
      previousEntry: normalizeReleasePolicyEntry(platform, channel, value?.previousEntry),
      activateAt,
      activatedAt: finiteTimestamp(value?.activatedAt),
      createdAt: finiteTimestamp(value?.createdAt) || Date.now(),
      createdBy: cleanText(value?.createdBy, 80) || null,
      reason: cleanText(value?.reason, REASON_LIMIT),
    };
  } catch {
    return null;
  }
}

function allKeys() {
  return RELEASE_CHANNELS.flatMap(channel => RELEASE_PLATFORMS.map(platform => releasePolicyKey(platform, channel)));
}

function entriesSnapshot(store) {
  return Object.fromEntries(allKeys().map(key => [key, { ...store.entries[key] }]));
}

function addRevision(store, { actor, reason, action, key = null, now = Date.now() }) {
  const cleanReason = cleanText(reason, REASON_LIMIT);
  if (!cleanReason) throw new Error('An administrative reason is required.');
  store.revision += 1;
  const revision = {
    revisionId: crypto.randomUUID(),
    revision: store.revision,
    action: cleanText(action, 40) || 'publish',
    key,
    actor: cleanText(actor, 80) || null,
    reason: cleanReason,
    createdAt: now,
    snapshot: { entries: entriesSnapshot(store) },
  };
  store.revisions.push(revision);
  if (store.revisions.length > HISTORY_LIMIT) store.revisions.splice(0, store.revisions.length - HISTORY_LIMIT);
  return revision;
}

export function normalizeReleasePolicyStore(value = {}) {
  const entries = {};
  for (const channel of RELEASE_CHANNELS) {
    for (const platform of RELEASE_PLATFORMS) {
      const key = releasePolicyKey(platform, channel);
      entries[key] = normalizeReleasePolicyEntry(platform, channel, value?.entries?.[key]);
    }
  }
  const schedules = (value?.schedules || []).map(normalizeSchedule).filter(Boolean);
  const latestScheduleByKey = new Map();
  for (const schedule of schedules) latestScheduleByKey.set(schedule.key, schedule);
  const revisions = (value?.revisions || []).filter(item => item?.revisionId).slice(-HISTORY_LIMIT).map(item => ({
    revisionId: String(item.revisionId),
    revision: nonnegativeInteger(item.revision),
    action: cleanText(item.action, 40) || 'publish',
    key: allKeys().includes(item.key) ? item.key : null,
    actor: cleanText(item.actor, 80) || null,
    reason: cleanText(item.reason, REASON_LIMIT),
    createdAt: finiteTimestamp(item.createdAt) || Date.now(),
    snapshot: {
      entries: Object.fromEntries(allKeys().map(key => {
        const { platform, channel } = splitReleasePolicyKey(key);
        return [key, normalizeReleasePolicyEntry(platform, channel, item.snapshot?.entries?.[key])];
      })),
    },
  }));
  return {
    revision: Math.max(nonnegativeInteger(value?.revision), ...revisions.map(item => item.revision), 0),
    entries,
    schedules: [...latestScheduleByKey.values()],
    revisions,
  };
}

export function resolveReleasePolicy(storeValue, {
  platform = 'android',
  channel = 'playtest',
  build = 0,
  version = '',
  now = Date.now(),
} = {}) {
  const store = normalizeReleasePolicyStore(storeValue);
  const key = releasePolicyKey(platform, channel);
  const entry = store.entries[key];
  const installedBuild = nonnegativeInteger(build);
  let status = 'current';
  if (entry.storeReady && entry.minimumBuild > installedBuild) status = 'required';
  else if (entry.storeReady && entry.latestBuild > installedBuild) status = 'recommended';
  return {
    revision: store.revision,
    fetchedAt: now,
    key,
    platform,
    channel,
    installedBuild,
    installedVersion: cleanText(version, VERSION_LIMIT),
    latestBuild: entry.latestBuild,
    latestVersion: entry.latestVersion,
    minimumBuild: entry.minimumBuild,
    storeUrl: entry.storeUrl,
    storeReady: entry.storeReady,
    enforcement: entry.enforcement,
    status,
    title: status === 'required' ? entry.requiredTitle : entry.recommendedTitle,
    message: status === 'required' ? entry.requiredMessage : entry.recommendedMessage,
  };
}

export function releasePolicyAdminView(storeValue, now = Date.now()) {
  const store = normalizeReleasePolicyStore(storeValue);
  return {
    ...store,
    platforms: RELEASE_PLATFORMS,
    channels: RELEASE_CHANNELS,
    enforcements: RELEASE_ENFORCEMENTS,
    fetchedAt: now,
  };
}

export function publishReleasePolicyChange(storeValue, {
  platform,
  channel,
  entry,
  actor,
  reason,
  now = Date.now(),
} = {}) {
  const store = normalizeReleasePolicyStore(storeValue);
  const key = releasePolicyKey(platform, channel);
  const nextEntry = validatePublishableEntry(normalizeReleasePolicyEntry(platform, channel, {
    ...entry,
    updatedAt: now,
    updatedBy: actor,
  }));
  store.entries[key] = nextEntry;
  store.schedules = store.schedules.filter(schedule => schedule.key !== key);
  const revision = addRevision(store, { actor, reason, action: 'publish', key, now });
  return { store, revision, entry: nextEntry };
}

export function scheduleReleasePolicyChange(storeValue, {
  platform,
  channel,
  entry,
  activateAt,
  actor,
  reason,
  replace = false,
  now = Date.now(),
} = {}) {
  const store = normalizeReleasePolicyStore(storeValue);
  const key = releasePolicyKey(platform, channel);
  const startsAt = finiteTimestamp(activateAt);
  if (!startsAt || startsAt <= now) throw new Error('Scheduled activation must be in the future.');
  const existing = store.schedules.find(schedule => schedule.key === key);
  if (existing && !replace) throw new Error('This release channel already has a pending schedule. Confirm replacement to continue.');
  const cleanReason = cleanText(reason, REASON_LIMIT);
  if (!cleanReason) throw new Error('An administrative reason is required.');
  const nextEntry = validatePublishableEntry(normalizeReleasePolicyEntry(platform, channel, entry));
  store.schedules = store.schedules.filter(schedule => schedule.key !== key);
  const schedule = {
    scheduleId: crypto.randomUUID(),
    key,
    entry: nextEntry,
    previousEntry: { ...store.entries[key] },
    activateAt: startsAt,
    activatedAt: null,
    createdAt: now,
    createdBy: cleanText(actor, 80) || null,
    reason: cleanReason,
  };
  store.schedules.push(schedule);
  const revision = addRevision(store, { actor, reason, action: existing ? 'schedule.replace' : 'schedule.create', key, now });
  return { store, revision, schedule };
}

export function cancelReleasePolicySchedule(storeValue, key, { actor, reason, now = Date.now() } = {}) {
  const store = normalizeReleasePolicyStore(storeValue);
  const schedule = store.schedules.find(item => item.key === key);
  if (!schedule) throw new Error('No pending release schedule exists for this channel.');
  store.schedules = store.schedules.filter(item => item.key !== key);
  const revision = addRevision(store, { actor, reason, action: 'schedule.cancel', key, now });
  return { store, revision, schedule };
}

export function processReleasePolicySchedules(storeValue, { now = Date.now(), actor = 'system' } = {}) {
  const store = normalizeReleasePolicyStore(storeValue);
  const changes = [];
  for (const schedule of [...store.schedules]) {
    if (schedule.activateAt > now) continue;
    const { platform, channel } = splitReleasePolicyKey(schedule.key);
    store.entries[schedule.key] = normalizeReleasePolicyEntry(platform, channel, {
      ...schedule.entry,
      updatedAt: now,
      updatedBy: actor,
    });
    store.schedules = store.schedules.filter(item => item.scheduleId !== schedule.scheduleId);
    const revision = addRevision(store, {
      actor,
      reason: schedule.reason || 'Scheduled app release policy activation.',
      action: 'schedule.activate',
      key: schedule.key,
      now,
    });
    changes.push({ key: schedule.key, revision });
  }
  return { store, changes };
}

export function restoreReleasePolicyRevision(storeValue, revisionId, { actor, reason, now = Date.now() } = {}) {
  const store = normalizeReleasePolicyStore(storeValue);
  const target = store.revisions.find(revision => revision.revisionId === String(revisionId || ''));
  if (!target) throw new Error('Release policy revision not found.');
  store.entries = Object.fromEntries(allKeys().map(key => {
    const { platform, channel } = splitReleasePolicyKey(key);
    return [key, normalizeReleasePolicyEntry(platform, channel, target.snapshot.entries[key])];
  }));
  store.schedules = [];
  const revision = addRevision(store, { actor, reason, action: 'revision.restore', key: null, now });
  return { store, revision, restoredRevision: target };
}

export function updateRequiredPayload(policy) {
  return {
    error: policy.message || 'Update Nine Below to continue.',
    code: 'APP_UPDATE_REQUIRED',
    release: policy,
  };
}
