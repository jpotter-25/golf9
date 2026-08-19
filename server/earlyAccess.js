import crypto from 'crypto';

export const EARLY_ACCESS_PLATFORMS = ['ios', 'android', 'web_future'];
export const EARLY_ACCESS_CONSENT_STATUSES = ['pending', 'confirmed', 'unsubscribed'];
export const EARLY_ACCESS_TESTER_STAGES = ['waitlisted', 'selected', 'onboarding', 'ready', 'invited', 'activated', 'declined'];
export const EARLY_ACCESS_CAMPAIGN_STATUSES = ['draft', 'scheduled', 'sending', 'completed', 'cancelled'];
export const EARLY_ACCESS_DELIVERY_STATUSES = ['queued', 'sending', 'sent', 'failed', 'skipped'];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONFIRMATION_TTL_MS = 48 * 60 * 60 * 1000;
const CONFIRMATION_COOLDOWN_MS = 15 * 60 * 1000;
const MANAGE_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const UNSUBSCRIBE_TOKEN_TTL_MS = 120 * 24 * 60 * 60 * 1000;
const CONSENT_TTL_MS = 730 * 24 * 60 * 60 * 1000;
const PENDING_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const UNSUBSCRIBED_PII_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const SUPPRESSION_RETENTION_MS = 730 * 24 * 60 * 60 * 1000;
const MAX_DELIVERY_ATTEMPTS = 5;
const DEFAULT_CONFIG = {
  enrollmentStatus: 'paused',
  statusMessage: 'Early-access registration will open soon.',
  consentVersion: 'early-access-2026-08-18',
  policyVersion: 'privacy-2026-08-18',
};

function nowValue(options = {}) {
  return Number(options.now) || Date.now();
}

export function safeEarlyAccessText(value, maxLength = 160) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function redactEarlyAccessError(value, maxLength = 300) {
  return safeEarlyAccessText(value, maxLength)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/\b(token|code)=[A-Za-z0-9._~-]{16,}/gi, '$1=[redacted]');
}

export function normalizeEarlyAccessEmail(value) {
  const email = safeEarlyAccessText(value, 160).toLowerCase();
  return email && !/^[=+\-@]/.test(email) && EMAIL_PATTERN.test(email) ? email : '';
}

function normalizePlatforms(value, webFuture = false) {
  const requested = Array.isArray(value) ? value : [value];
  const platforms = [...new Set(requested.map(item => String(item || '').trim().toLowerCase()))]
    .filter(platform => EARLY_ACCESS_PLATFORMS.includes(platform));
  if (webFuture === true && !platforms.includes('web_future')) platforms.push('web_future');
  return platforms;
}

function normalizeConfig(value = {}) {
  const enrollmentStatus = ['open', 'paused', 'closed'].includes(value.enrollmentStatus)
    ? value.enrollmentStatus
    : DEFAULT_CONFIG.enrollmentStatus;
  return {
    enrollmentStatus,
    statusMessage: safeEarlyAccessText(value.statusMessage || DEFAULT_CONFIG.statusMessage, 240),
    consentVersion: safeEarlyAccessText(value.consentVersion || DEFAULT_CONFIG.consentVersion, 80),
    policyVersion: safeEarlyAccessText(value.policyVersion || DEFAULT_CONFIG.policyVersion, 80),
  };
}

function deriveSecret(env, name, fallbackLabel) {
  const configured = String(env?.[name] || '').trim();
  if (!configured && isProductionEnvironment(env)) {
    throw new Error(`${name} is required in production.`);
  }
  return crypto.createHash('sha256').update(configured || `nine-below-local:${fallbackLabel}`).digest();
}

function isProductionEnvironment(env = process.env) {
  return [env?.NODE_ENV, env?.APP_ENV, env?.EXPO_PUBLIC_APP_ENV]
    .some(value => ['production', 'prod'].includes(String(value || '').trim().toLowerCase()));
}

function piiKey(env) {
  return deriveSecret(env, 'EARLY_ACCESS_PII_KEY', 'pii');
}

function tokenKey(env) {
  return deriveSecret(env, 'EARLY_ACCESS_TOKEN_SECRET', 'tokens');
}

export function earlyAccessSecurityStatus(env = process.env) {
  const piiConfigured = String(env.EARLY_ACCESS_PII_KEY || '').trim().length >= 32;
  const tokenConfigured = String(env.EARLY_ACCESS_TOKEN_SECRET || '').trim().length >= 32;
  const production = isProductionEnvironment(env);
  return {
    production,
    piiConfigured,
    tokenConfigured,
    ready: !production || (piiConfigured && tokenConfigured),
  };
}

export function earlyAccessEmailHash(email, env = process.env) {
  return crypto.createHmac('sha256', tokenKey(env)).update(normalizeEarlyAccessEmail(email)).digest('hex');
}

function tokenHash(token, env = process.env, purpose = 'generic') {
  return crypto.createHmac('sha256', tokenKey(env))
    .update(`nine-below:${purpose}:v1\0${String(token || '')}`)
    .digest('hex');
}

function secureEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function encryptEarlyAccessContact(contact, env = process.env) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', piiKey(env), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(contact || {}), 'utf8'),
    cipher.final(),
  ]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decryptEarlyAccessContact(payload, env = process.env) {
  const [version, ivValue, tagValue, cipherValue] = String(payload || '').split('.');
  if (version !== 'v1' || !ivValue || !tagValue || !cipherValue) return null;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', piiKey(env), Buffer.from(ivValue, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(cipherValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
    const contact = JSON.parse(plaintext);
    return contact && typeof contact === 'object' ? contact : null;
  } catch {
    return null;
  }
}

function normalizeSignup(signup) {
  const createdAt = Number(signup.createdAt) || Date.now();
  const consentStatus = EARLY_ACCESS_CONSENT_STATUSES.includes(signup.consentStatus) ? signup.consentStatus : 'pending';
  const testerStage = EARLY_ACCESS_TESTER_STAGES.includes(signup.testerStage) ? signup.testerStage : 'waitlisted';
  return {
    signupId: String(signup.signupId || crypto.randomUUID()),
    emailHash: String(signup.emailHash || ''),
    contactEncrypted: String(signup.contactEncrypted || ''),
    pendingContactEncrypted: String(signup.pendingContactEncrypted || ''),
    manageTokenHash: String(signup.manageTokenHash || ''),
    manageTokenExpiresAt: Number(signup.manageTokenExpiresAt) || null,
    platforms: normalizePlatforms(signup.platforms),
    pendingPlatforms: normalizePlatforms(signup.pendingPlatforms),
    consentStatus,
    testerStage,
    confirmationTokenHash: String(signup.confirmationTokenHash || ''),
    confirmationPurpose: ['signup', 'update', 'resubscribe', 'reconfirm'].includes(signup.confirmationPurpose)
      ? signup.confirmationPurpose
      : 'signup',
    confirmationExpiresAt: Number(signup.confirmationExpiresAt) || null,
    lastConfirmationSentAt: Number(signup.lastConfirmationSentAt) || null,
    confirmationSendHistory: Array.isArray(signup.confirmationSendHistory)
      ? signup.confirmationSendHistory.map(Number).filter(Number.isFinite).slice(-10)
      : [],
    consentVersion: safeEarlyAccessText(signup.consentVersion, 80),
    policyVersion: safeEarlyAccessText(signup.policyVersion, 80),
    consentRefreshedAt: Number(signup.consentRefreshedAt) || null,
    reconfirmationRequestedAt: Number(signup.reconfirmationRequestedAt) || null,
    confirmedAt: Number(signup.confirmedAt) || null,
    unsubscribedAt: Number(signup.unsubscribedAt) || null,
    needsReconfirmation: signup.needsReconfirmation === true,
    source: safeEarlyAccessText(signup.source, 80),
    attribution: signup.attribution && typeof signup.attribution === 'object' ? {
      utmSource: safeEarlyAccessText(signup.attribution.utmSource, 80),
      utmMedium: safeEarlyAccessText(signup.attribution.utmMedium, 80),
      utmCampaign: safeEarlyAccessText(signup.attribution.utmCampaign, 80),
      referrerHost: safeEarlyAccessText(signup.attribution.referrerHost, 120),
    } : {},
    consentHistory: Array.isArray(signup.consentHistory) ? signup.consentHistory.slice(-30) : [],
    tags: Array.isArray(signup.tags) ? signup.tags.map(tag => safeEarlyAccessText(tag, 40)).filter(Boolean).slice(0, 12) : [],
    notes: Array.isArray(signup.notes) ? signup.notes.slice(-50).map(note => ({
      noteId: String(note.noteId || crypto.randomUUID()),
      text: safeEarlyAccessText(note.text, 500),
      adminId: note.adminId ? String(note.adminId) : null,
      adminName: safeEarlyAccessText(note.adminName, 80),
      createdAt: Number(note.createdAt) || createdAt,
    })).filter(note => note.text) : [],
    onboarding: signup.onboarding && typeof signup.onboarding === 'object' ? {
      deviceModel: safeEarlyAccessText(signup.onboarding.deviceModel, 80),
      osVersion: safeEarlyAccessText(signup.onboarding.osVersion, 40),
      acknowledgedAt: Number(signup.onboarding.acknowledgedAt) || null,
    } : null,
    selectedAt: Number(signup.selectedAt) || null,
    invitedAt: Number(signup.invitedAt) || null,
    activatedAt: Number(signup.activatedAt) || null,
    activatedUserId: signup.activatedUserId ? String(signup.activatedUserId) : null,
    erasedAt: Number(signup.erasedAt) || null,
    createdAt,
    updatedAt: Number(signup.updatedAt) || createdAt,
  };
}

function normalizeCampaign(campaign) {
  const createdAt = Number(campaign.createdAt) || Date.now();
  return {
    campaignId: String(campaign.campaignId || crypto.randomUUID()),
    internalName: safeEarlyAccessText(campaign.internalName || 'Early access campaign', 100),
    type: ['selection', 'access', 'update'].includes(campaign.type) ? campaign.type : 'update',
    targetPlatform: ['all', ...EARLY_ACCESS_PLATFORMS].includes(campaign.targetPlatform) ? campaign.targetPlatform : 'all',
    waveSize: Math.max(1, Math.min(5000, Number(campaign.waveSize) || 100)),
    subject: safeEarlyAccessText(campaign.subject, 120),
    preheader: safeEarlyAccessText(campaign.preheader, 160),
    heading: safeEarlyAccessText(campaign.heading, 120),
    body: safeEarlyAccessText(campaign.body, 2000),
    focusBullets: Array.isArray(campaign.focusBullets)
      ? campaign.focusBullets.map(value => safeEarlyAccessText(value, 180)).filter(Boolean).slice(0, 5)
      : [],
    feedbackInstructions: safeEarlyAccessText(campaign.feedbackInstructions, 800),
    ctaLabel: safeEarlyAccessText(campaign.ctaLabel, 60),
    accessUrl: safeEarlyAccessText(campaign.accessUrl, 500),
    startAt: Number(campaign.startAt) || null,
    scheduledAt: Number(campaign.scheduledAt) || null,
    status: EARLY_ACCESS_CAMPAIGN_STATUSES.includes(campaign.status) ? campaign.status : 'draft',
    recipientCount: Math.max(0, Number(campaign.recipientCount) || 0),
    createdBy: campaign.createdBy ? String(campaign.createdBy) : null,
    createdByName: safeEarlyAccessText(campaign.createdByName, 80),
    createdAt,
    updatedAt: Number(campaign.updatedAt) || createdAt,
    completedAt: Number(campaign.completedAt) || null,
    cancelledAt: Number(campaign.cancelledAt) || null,
  };
}

function normalizeDelivery(delivery) {
  const createdAt = Number(delivery.createdAt) || Date.now();
  return {
    deliveryId: String(delivery.deliveryId || crypto.randomUUID()),
    campaignId: String(delivery.campaignId || ''),
    signupId: String(delivery.signupId || ''),
    inviteId: delivery.inviteId ? String(delivery.inviteId) : null,
    inviteCode: delivery.inviteCode ? String(delivery.inviteCode) : null,
    inviteCodeEncrypted: String(delivery.inviteCodeEncrypted || ''),
    status: EARLY_ACCESS_DELIVERY_STATUSES.includes(delivery.status) ? delivery.status : 'queued',
    attempts: Math.max(0, Number(delivery.attempts) || 0),
    nextAttemptAt: Number(delivery.nextAttemptAt) || createdAt,
    leaseExpiresAt: Number(delivery.leaseExpiresAt) || null,
    lastError: safeEarlyAccessText(delivery.lastError, 300),
    createdAt,
    updatedAt: Number(delivery.updatedAt) || createdAt,
    sentAt: Number(delivery.sentAt) || null,
  };
}

export function normalizeEarlyAccessStore(store = {}) {
  if (!Array.isArray(store.signups)) store.signups = [];
  if (!Array.isArray(store.campaigns)) store.campaigns = [];
  if (!Array.isArray(store.deliveries)) store.deliveries = [];
  store.config = normalizeConfig(store.config || {});
  store.signups = store.signups
    .filter(item => item?.signupId && item?.emailHash)
    .map(item => Object.assign(item, normalizeSignup(item)));
  store.campaigns = store.campaigns
    .filter(item => item?.campaignId)
    .map(item => Object.assign(item, normalizeCampaign(item)));
  store.deliveries = store.deliveries
    .filter(item => item?.deliveryId && item?.campaignId && item?.signupId)
    .map(item => Object.assign(item, normalizeDelivery(item)));
  return store;
}

export function publicEarlyAccessConfig(store) {
  normalizeEarlyAccessStore(store);
  return { ...store.config };
}

export function updateEarlyAccessConfig(store, patch = {}) {
  normalizeEarlyAccessStore(store);
  store.config = normalizeConfig({ ...store.config, ...patch });
  return { ...store.config };
}

function attributionFrom(body = {}, options = {}) {
  return {
    utmSource: safeEarlyAccessText(body.utmSource || body.utm_source, 80),
    utmMedium: safeEarlyAccessText(body.utmMedium || body.utm_medium, 80),
    utmCampaign: safeEarlyAccessText(body.utmCampaign || body.utm_campaign, 80),
    referrerHost: safeEarlyAccessText(options.referrerHost || body.referrerHost, 120),
  };
}

function newContact(email, firstName, manageToken, platformEmail = '', deviceModel = '', osVersion = '') {
  return {
    email,
    firstName: safeEarlyAccessText(firstName, 60),
    platformEmail: normalizeEarlyAccessEmail(platformEmail),
    deviceModel: safeEarlyAccessText(deviceModel, 80),
    osVersion: safeEarlyAccessText(osVersion, 40),
    manageToken,
  };
}

function addConsentEvent(signup, type, at, details = {}) {
  signup.consentHistory.push({ type, at, ...details });
  if (signup.consentHistory.length > 30) signup.consentHistory.splice(0, signup.consentHistory.length - 30);
}

function eraseEarlyAccessPii(signup, at, eventType = 'erased') {
  signup.contactEncrypted = '';
  signup.pendingContactEncrypted = '';
  signup.manageTokenHash = '';
  signup.manageTokenExpiresAt = null;
  signup.confirmationTokenHash = '';
  signup.confirmationExpiresAt = null;
  signup.platforms = [];
  signup.pendingPlatforms = [];
  signup.source = '';
  signup.attribution = {};
  signup.tags = [];
  signup.notes = [];
  signup.onboarding = null;
  signup.selectedAt = null;
  signup.invitedAt = null;
  signup.activatedAt = null;
  signup.activatedUserId = null;
  signup.needsReconfirmation = false;
  signup.reconfirmationRequestedAt = null;
  signup.consentStatus = 'unsubscribed';
  signup.testerStage = 'declined';
  signup.unsubscribedAt ||= at;
  signup.erasedAt = at;
  signup.updatedAt = at;
  addConsentEvent(signup, eventType, at);
}

export function submitEarlyAccessSignup(store, body = {}, options = {}) {
  normalizeEarlyAccessStore(store);
  const at = nowValue(options);
  if (store.config.enrollmentStatus !== 'open') {
    return { error: store.config.enrollmentStatus === 'closed' ? 'Early-access registration is closed.' : store.config.statusMessage, status: 503 };
  }
  const email = normalizeEarlyAccessEmail(body.email);
  const firstName = safeEarlyAccessText(body.firstName, 60);
  const platforms = normalizePlatforms(body.platforms, body.webFuture === true);
  const mobilePlatforms = platforms.filter(platform => platform === 'ios' || platform === 'android');
  if (!email) return { error: 'Enter a valid email address.' };
  if (!mobilePlatforms.length) return { error: 'Choose iOS, Android, or both.' };
  if (body.consent !== true) return { error: 'Consent is required to receive early-access email.' };
  if (body.ageConfirmed !== true) return { error: 'You must confirm that you are at least 13.' };

  const emailHash = earlyAccessEmailHash(email, options.env);
  let signup = store.signups.find(item => secureEqual(item.emailHash, emailHash));
  if (signup?.lastConfirmationSentAt && at - signup.lastConfirmationSentAt < CONFIRMATION_COOLDOWN_MS) {
    return { ok: true, queued: false, throttled: true };
  }

  const confirmationToken = crypto.randomBytes(32).toString('base64url');
  if (!signup) {
    const manageToken = crypto.randomBytes(32).toString('base64url');
    signup = normalizeSignup({
      signupId: crypto.randomUUID(),
      emailHash,
      contactEncrypted: encryptEarlyAccessContact(newContact(email, firstName, manageToken), options.env),
      manageTokenHash: tokenHash(manageToken, options.env, 'manage'),
      manageTokenExpiresAt: at + MANAGE_TOKEN_TTL_MS,
      platforms,
      consentStatus: 'pending',
      testerStage: 'waitlisted',
      createdAt: at,
      updatedAt: at,
      source: safeEarlyAccessText(body.source || 'website', 80),
      attribution: attributionFrom(body, options),
    });
    store.signups.push(signup);
  } else {
    const currentContact = decryptEarlyAccessContact(signup.contactEncrypted, options.env) || {};
    const rejoining = signup.consentStatus === 'unsubscribed' || signup.erasedAt;
    const manageToken = rejoining ? crypto.randomBytes(32).toString('base64url') : (currentContact.manageToken || crypto.randomBytes(32).toString('base64url'));
    const nextContactEncrypted = encryptEarlyAccessContact(newContact(
      email,
      firstName,
      manageToken,
      currentContact.platformEmail,
      currentContact.deviceModel,
      currentContact.osVersion,
    ), options.env);
    signup.manageTokenHash = tokenHash(manageToken, options.env, 'manage');
    signup.manageTokenExpiresAt = at + MANAGE_TOKEN_TTL_MS;
    signup.source = safeEarlyAccessText(body.source || signup.source || 'website', 80);
    signup.attribution = attributionFrom(body, options);
    if (signup.consentStatus === 'confirmed') {
      signup.pendingContactEncrypted = nextContactEncrypted;
      signup.pendingPlatforms = platforms;
      signup.confirmationPurpose = 'update';
    } else {
      signup.contactEncrypted = nextContactEncrypted;
      signup.platforms = platforms;
      signup.pendingContactEncrypted = '';
      signup.pendingPlatforms = [];
      signup.confirmationPurpose = signup.consentStatus === 'unsubscribed' ? 'resubscribe' : 'signup';
      signup.consentStatus = 'pending';
      signup.needsReconfirmation = false;
      signup.erasedAt = null;
    }
    signup.updatedAt = at;
  }

  signup.confirmationTokenHash = tokenHash(confirmationToken, options.env, 'confirmation');
  signup.confirmationExpiresAt = at + CONFIRMATION_TTL_MS;
  signup.lastConfirmationSentAt = at;
  signup.confirmationSendHistory.push(at);
  signup.confirmationSendHistory = signup.confirmationSendHistory.slice(-10);
  signup.consentVersion = store.config.consentVersion;
  signup.policyVersion = store.config.policyVersion;
  addConsentEvent(signup, 'submitted', at, {
    consentVersion: store.config.consentVersion,
    policyVersion: store.config.policyVersion,
    ipHash: safeEarlyAccessText(options.ipHash, 80),
  });
  return { ok: true, queued: true, signup, confirmationToken, email, firstName };
}

export function confirmEarlyAccessSignup(store, token, options = {}) {
  normalizeEarlyAccessStore(store);
  const at = nowValue(options);
  const hash = tokenHash(token, options.env, 'confirmation');
  const signup = store.signups.find(item => item.confirmationTokenHash && secureEqual(item.confirmationTokenHash, hash));
  if (!signup || !signup.confirmationExpiresAt || signup.confirmationExpiresAt < at) {
    return { error: 'This confirmation link is invalid or has expired.' };
  }
  if (signup.pendingContactEncrypted) signup.contactEncrypted = signup.pendingContactEncrypted;
  if (signup.pendingPlatforms.length) signup.platforms = signup.pendingPlatforms;
  const confirmationPurpose = signup.confirmationPurpose;
  const wasUpdate = confirmationPurpose === 'update';
  signup.pendingContactEncrypted = '';
  signup.pendingPlatforms = [];
  signup.consentStatus = 'confirmed';
  signup.confirmedAt ||= at;
  signup.consentRefreshedAt = at;
  signup.reconfirmationRequestedAt = null;
  signup.unsubscribedAt = null;
  signup.needsReconfirmation = false;
  if (!wasUpdate && signup.testerStage === 'declined') signup.testerStage = 'waitlisted';
  signup.confirmationTokenHash = '';
  signup.confirmationExpiresAt = null;
  signup.updatedAt = at;
  addConsentEvent(signup, wasUpdate ? 'preferences_confirmed' : confirmationPurpose === 'reconfirm' ? 'reconfirmed' : 'confirmed', at, {
    consentVersion: signup.consentVersion,
    policyVersion: signup.policyVersion,
  });
  return { ok: true, signup };
}

function findByManageToken(store, token, options = {}) {
  if (!token) return null;
  const at = nowValue(options);
  const hash = tokenHash(token, options.env, 'manage');
  let signup = store.signups.find(item => item.manageTokenHash && secureEqual(item.manageTokenHash, hash)) || null;
  if (!signup) {
    signup = store.signups.find(item => {
      const contact = decryptEarlyAccessContact(item.contactEncrypted, options.env);
      return contact?.manageToken && secureEqual(contact.manageToken, token);
    }) || null;
    if (signup) {
      signup.manageTokenHash = hash;
      signup.manageTokenExpiresAt = at + MANAGE_TOKEN_TTL_MS;
      signup.updatedAt = Math.max(signup.updatedAt || 0, at);
    }
  }
  if (!signup) return null;
  if (!signup.manageTokenExpiresAt) signup.manageTokenExpiresAt = at + MANAGE_TOKEN_TTL_MS;
  return signup.manageTokenExpiresAt >= at ? signup : null;
}

function scopedUnsubscribeToken(signup, options = {}) {
  const expiresAt = nowValue(options) + UNSUBSCRIBE_TOKEN_TTL_MS;
  const payload = `${signup.signupId}.${expiresAt}`;
  const signature = crypto.createHmac('sha256', tokenKey(options.env))
    .update(`nine-below:unsubscribe:v1\0${payload}`)
    .digest('base64url');
  return `u1.${payload}.${signature}`;
}

function findByUnsubscribeToken(store, token, options = {}) {
  const match = /^u1\.([0-9a-f-]{36})\.(\d{10,16})\.([A-Za-z0-9_-]{40,})$/.exec(String(token || ''));
  if (!match) return null;
  const [, signupId, expiresValue, signature] = match;
  const expiresAt = Number(expiresValue);
  if (!Number.isFinite(expiresAt) || expiresAt < nowValue(options)) return null;
  const payload = `${signupId}.${expiresValue}`;
  const expected = crypto.createHmac('sha256', tokenKey(options.env))
    .update(`nine-below:unsubscribe:v1\0${payload}`)
    .digest('base64url');
  if (!secureEqual(signature, expected)) return null;
  return store.signups.find(item => item.signupId === signupId) || null;
}

function maskEmail(email) {
  const [local, domain] = String(email || '').split('@');
  if (!local || !domain) return '';
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(2, Math.min(8, local.length - 2)))}@${domain}`;
}

export function earlyAccessPreferences(store, token, options = {}) {
  normalizeEarlyAccessStore(store);
  const signup = findByManageToken(store, token, options);
  if (!signup || signup.erasedAt) return { error: 'This preferences link is invalid or no longer active.' };
  const contact = decryptEarlyAccessContact(signup.contactEncrypted, options.env);
  if (!contact) return { error: 'Early-access preferences are unavailable.' };
  return {
    signup: {
      signupId: signup.signupId,
      email: maskEmail(contact.email),
      firstName: contact.firstName || '',
      platforms: signup.platforms,
      consentStatus: signup.consentStatus,
      testerStage: signup.testerStage,
      onboarding: signup.onboarding ? {
        ...signup.onboarding,
        deviceModel: contact.deviceModel || signup.onboarding.deviceModel || '',
        osVersion: contact.osVersion || signup.onboarding.osVersion || '',
      } : null,
    },
  };
}

export function unsubscribeEarlyAccess(store, token, options = {}) {
  normalizeEarlyAccessStore(store);
  const signup = findByManageToken(store, token, options) || findByUnsubscribeToken(store, token, options);
  if (!signup) return { ok: true };
  const at = nowValue(options);
  if (signup.consentStatus !== 'unsubscribed') {
    signup.consentStatus = 'unsubscribed';
    signup.unsubscribedAt = at;
    signup.testerStage = 'declined';
    signup.updatedAt = at;
    addConsentEvent(signup, 'unsubscribed', at);
  }
  return { ok: true, signup };
}

export function completeEarlyAccessOnboarding(store, token, body = {}, options = {}) {
  normalizeEarlyAccessStore(store);
  const signup = findByManageToken(store, token, options);
  if (!signup || signup.consentStatus !== 'confirmed') return { error: 'This onboarding link is invalid or no longer active.' };
  if (!['selected', 'onboarding', 'ready'].includes(signup.testerStage)) return { error: 'This signup has not been selected for a testing wave.' };
  if (body.acknowledged !== true) return { error: 'Acknowledge the testing expectations to continue.' };
  const contact = decryptEarlyAccessContact(signup.contactEncrypted, options.env);
  if (!contact) return { error: 'Early-access contact information is unavailable.' };
  const platformEmail = normalizeEarlyAccessEmail(body.platformEmail || contact.email);
  if (signup.platforms.includes('android') && !platformEmail) return { error: 'Enter the Google account used with Google Play.' };
  const at = nowValue(options);
  signup.contactEncrypted = encryptEarlyAccessContact({
    ...contact,
    platformEmail,
    deviceModel: safeEarlyAccessText(body.deviceModel, 80),
    osVersion: safeEarlyAccessText(body.osVersion, 40),
  }, options.env);
  signup.onboarding = {
    acknowledgedAt: at,
  };
  signup.testerStage = 'ready';
  signup.updatedAt = at;
  return { ok: true, signup };
}

export function validateEarlyAccessFeedback(store, token, body = {}, options = {}) {
  normalizeEarlyAccessStore(store);
  const signup = findByManageToken(store, token, options);
  if (!signup || signup.consentStatus !== 'confirmed') return { error: 'This feedback link is invalid or no longer active.' };
  const contact = decryptEarlyAccessContact(signup.contactEncrypted, options.env);
  if (!contact) return { error: 'Early-access contact information is unavailable.' };
  const category = ['bug', 'gameplay', 'performance', 'account_install', 'other'].includes(body.category) ? body.category : 'other';
  const severity = ['low', 'medium', 'high', 'blocking'].includes(body.severity) ? body.severity : 'medium';
  const actual = safeEarlyAccessText(body.actual, 1200);
  if (actual.length < 10) return { error: 'Describe what happened in a little more detail.' };
  return {
    feedback: {
      signupId: signup.signupId,
      contactName: contact.firstName || 'Early access tester',
      contactEmail: contact.email,
      category,
      severity,
      build: safeEarlyAccessText(body.build, 60),
      steps: safeEarlyAccessText(body.steps, 1200),
      expected: safeEarlyAccessText(body.expected, 800),
      actual,
      device: safeEarlyAccessText(body.device, 120),
    },
  };
}

function publicSignup(signup, env, includePii = true) {
  const contact = decryptEarlyAccessContact(signup.contactEncrypted, env) || {};
  return {
    signupId: signup.signupId,
    email: includePii ? (contact.email || null) : (maskEmail(contact.email) || null),
    firstName: includePii ? (contact.firstName || '') : '',
    platformEmail: includePii ? (contact.platformEmail || '') : '',
    platforms: signup.platforms,
    consentStatus: signup.consentStatus,
    testerStage: signup.testerStage,
    consentVersion: signup.consentVersion,
    policyVersion: signup.policyVersion,
    confirmedAt: signup.confirmedAt,
    consentRefreshedAt: signup.consentRefreshedAt,
    unsubscribedAt: signup.unsubscribedAt,
    needsReconfirmation: signup.needsReconfirmation,
    source: signup.source,
    attribution: includePii ? signup.attribution : {},
    tags: signup.tags,
    notes: includePii ? signup.notes : [],
    consentHistory: signup.consentHistory,
    onboarding: signup.onboarding ? {
      ...signup.onboarding,
      deviceModel: includePii ? (contact.deviceModel || signup.onboarding.deviceModel || '') : '',
      osVersion: includePii ? (contact.osVersion || signup.onboarding.osVersion || '') : '',
    } : null,
    selectedAt: signup.selectedAt,
    invitedAt: signup.invitedAt,
    activatedAt: signup.activatedAt,
    activatedUserId: signup.activatedUserId,
    erasedAt: signup.erasedAt,
    createdAt: signup.createdAt,
    updatedAt: signup.updatedAt,
  };
}

export function earlyAccessSummary(store) {
  normalizeEarlyAccessStore(store);
  const count = predicate => store.signups.filter(predicate).length;
  return {
    total: store.signups.length,
    pending: count(item => item.consentStatus === 'pending'),
    confirmed: count(item => item.consentStatus === 'confirmed'),
    unsubscribed: count(item => item.consentStatus === 'unsubscribed'),
    selected: count(item => ['selected', 'onboarding', 'ready'].includes(item.testerStage)),
    ready: count(item => item.testerStage === 'ready'),
    invited: count(item => item.testerStage === 'invited'),
    activated: count(item => item.testerStage === 'activated'),
    platforms: Object.fromEntries(EARLY_ACCESS_PLATFORMS.map(platform => [platform, count(item => item.platforms.includes(platform))])),
    campaigns: store.campaigns.length,
    deliveries: Object.fromEntries(EARLY_ACCESS_DELIVERY_STATUSES.map(status => [status, store.deliveries.filter(item => item.status === status).length])),
  };
}

export function adminEarlyAccessSignups(store, query = {}, options = {}) {
  normalizeEarlyAccessStore(store);
  const needle = safeEarlyAccessText(query.q, 120).toLowerCase();
  const status = safeEarlyAccessText(query.status, 40);
  const platform = safeEarlyAccessText(query.platform, 40);
  const stage = safeEarlyAccessText(query.stage, 40);
  const limit = Math.max(1, Math.min(500, Number(query.limit) || 200));
  return store.signups
    .map(item => publicSignup(item, options.env, options.includePii !== false))
    .filter(item => !status || item.consentStatus === status)
    .filter(item => !platform || item.platforms.includes(platform))
    .filter(item => !stage || item.testerStage === stage)
    .filter(item => !needle || [item.email, item.firstName, item.signupId, item.source, ...item.tags].filter(Boolean).join(' ').toLowerCase().includes(needle))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

export function updateEarlyAccessSignup(store, signupId, patch = {}, admin = null, options = {}) {
  normalizeEarlyAccessStore(store);
  const signup = store.signups.find(item => item.signupId === String(signupId || ''));
  if (!signup) return { error: 'Early-access signup not found.' };
  const at = nowValue(options);
  if (patch.testerStage !== undefined) {
    if (!EARLY_ACCESS_TESTER_STAGES.includes(patch.testerStage)) return { error: 'Invalid tester stage.' };
    if (signup.consentStatus !== 'confirmed' && !['waitlisted', 'declined'].includes(patch.testerStage)) {
      return { error: 'Only confirmed signups can enter a testing wave.' };
    }
    signup.testerStage = patch.testerStage;
    if (patch.testerStage === 'selected') signup.selectedAt ||= at;
  }
  if (patch.tags !== undefined) {
    signup.tags = Array.isArray(patch.tags)
      ? [...new Set(patch.tags.map(tag => safeEarlyAccessText(tag, 40)).filter(Boolean))].slice(0, 12)
      : signup.tags;
  }
  const note = safeEarlyAccessText(patch.note, 500);
  if (note) signup.notes.push({
    noteId: crypto.randomUUID(),
    text: note,
    adminId: admin?.adminId || null,
    adminName: safeEarlyAccessText(admin?.displayName || 'Admin', 80),
    createdAt: at,
  });
  if (patch.unsubscribe === true) unsubscribeEarlyAccess(store, decryptEarlyAccessContact(signup.contactEncrypted, options.env)?.manageToken, options);
  signup.updatedAt = at;
  return { signup: publicSignup(signup, options.env, options.includePii !== false) };
}

export function eraseEarlyAccessSignup(store, signupId, options = {}) {
  normalizeEarlyAccessStore(store);
  const signup = store.signups.find(item => item.signupId === String(signupId || ''));
  if (!signup) return { error: 'Early-access signup not found.' };
  const at = nowValue(options);
  eraseEarlyAccessPii(signup, at);
  return { signup: publicSignup(signup, options.env) };
}

function safeHttpsUrl(value) {
  const raw = safeEarlyAccessText(value, 500);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' ? parsed.toString() : '';
  } catch {
    return '';
  }
}

function campaignInput(body = {}) {
  const campaign = normalizeCampaign({ ...body, status: body.status || 'draft' });
  campaign.accessUrl = safeHttpsUrl(body.accessUrl);
  return campaign;
}

function campaignValidation(campaign) {
  if (campaign.internalName.length < 3) return 'Enter an internal campaign name.';
  if (campaign.subject.length < 3) return 'Enter an email subject.';
  if (campaign.heading.length < 3) return 'Enter an email heading.';
  if (campaign.body.length < 10) return 'Enter campaign body copy.';
  if (campaign.type === 'access' && !campaign.accessUrl) return 'Access campaigns require a secure HTTPS install or opt-in URL.';
  if (campaign.type === 'access' && !['ios', 'android'].includes(campaign.targetPlatform)) return 'Access campaigns must target iOS or Android.';
  return null;
}

export function createEarlyAccessCampaign(store, body = {}, admin = null, options = {}) {
  normalizeEarlyAccessStore(store);
  const at = nowValue(options);
  const campaign = campaignInput({
    ...body,
    campaignId: crypto.randomUUID(),
    createdBy: admin?.adminId || null,
    createdByName: admin?.displayName || 'Admin',
    createdAt: at,
    updatedAt: at,
    status: 'draft',
  });
  const error = campaignValidation(campaign);
  if (error) return { error };
  store.campaigns.push(campaign);
  return { campaign };
}

export function updateEarlyAccessCampaign(store, campaignId, body = {}, options = {}) {
  normalizeEarlyAccessStore(store);
  const campaign = store.campaigns.find(item => item.campaignId === String(campaignId || ''));
  if (!campaign) return { error: 'Campaign not found.' };
  if (campaign.status !== 'draft') return { error: 'Only draft campaigns can be edited.' };
  const next = campaignInput({ ...campaign, ...body, campaignId: campaign.campaignId, createdAt: campaign.createdAt, createdBy: campaign.createdBy, createdByName: campaign.createdByName, updatedAt: nowValue(options), status: 'draft' });
  const error = campaignValidation(next);
  if (error) return { error };
  Object.assign(campaign, next);
  return { campaign };
}

function signupEligibleForCampaign(signup, campaign, at) {
  if (signup.consentStatus !== 'confirmed' || signup.needsReconfirmation || !signup.contactEncrypted) return false;
  if (signup.consentRefreshedAt && signup.consentRefreshedAt + CONSENT_TTL_MS <= at) return false;
  if (campaign.targetPlatform !== 'all' && !signup.platforms.includes(campaign.targetPlatform)) return false;
  if (campaign.type === 'selection') return signup.testerStage === 'waitlisted';
  if (campaign.type === 'access') return signup.testerStage === 'ready';
  return signup.testerStage !== 'declined';
}

export function earlyAccessCampaignRecipients(store, campaign, options = {}) {
  normalizeEarlyAccessStore(store);
  const at = nowValue(options);
  return store.signups
    .filter(signup => signupEligibleForCampaign(signup, campaign, at))
    .sort((a, b) => (a.confirmedAt || a.createdAt) - (b.confirmedAt || b.createdAt))
    .slice(0, campaign.waveSize);
}

export function adminEarlyAccessCampaigns(store) {
  normalizeEarlyAccessStore(store);
  return store.campaigns.slice().sort((a, b) => b.createdAt - a.createdAt).map(campaign => ({
    ...campaign,
    deliveries: Object.fromEntries(EARLY_ACCESS_DELIVERY_STATUSES.map(status => [status, store.deliveries.filter(item => item.campaignId === campaign.campaignId && item.status === status).length])),
  }));
}

export function previewEarlyAccessCampaign(store, campaignId, options = {}) {
  normalizeEarlyAccessStore(store);
  const campaign = store.campaigns.find(item => item.campaignId === String(campaignId || ''));
  if (!campaign) return { error: 'Campaign not found.' };
  const recipients = earlyAccessCampaignRecipients(store, campaign, options);
  return { campaign, recipientCount: recipients.length, sample: recipients.slice(0, 5).map(item => publicSignup(item, options.env)) };
}

function deterministicDeliveryId(campaignId, signupId) {
  return crypto.createHash('sha256').update(`${campaignId}:${signupId}`).digest('hex').slice(0, 40);
}

export function scheduleEarlyAccessCampaign(store, campaignId, admin, options = {}) {
  normalizeEarlyAccessStore(store);
  const at = nowValue(options);
  const campaign = store.campaigns.find(item => item.campaignId === String(campaignId || ''));
  if (!campaign) return { error: 'Campaign not found.' };
  if (campaign.status !== 'draft') return { error: 'Only draft campaigns can be scheduled.' };
  const recipients = earlyAccessCampaignRecipients(store, campaign, options);
  if (!recipients.length) return { error: 'No confirmed signups match this campaign.' };
  const scheduledAt = Math.max(at, Number(options.scheduledAt || campaign.scheduledAt) || at);
  const created = [];
  for (const signup of recipients) {
    const deliveryId = deterministicDeliveryId(campaign.campaignId, signup.signupId);
    if (store.deliveries.some(item => item.deliveryId === deliveryId)) continue;
    let invite = null;
    if (campaign.type === 'access') {
      invite = options.createInvite?.(signup, campaign) || null;
      if (!invite?.inviteId || !invite?.code) return { error: 'A one-use game invite could not be created.' };
    }
    const delivery = normalizeDelivery({
      deliveryId,
      campaignId: campaign.campaignId,
      signupId: signup.signupId,
      inviteId: invite?.inviteId || null,
      inviteCodeEncrypted: invite?.code ? encryptEarlyAccessContact({ inviteCode: invite.code }, options.env) : '',
      status: 'queued',
      attempts: 0,
      nextAttemptAt: scheduledAt,
      createdAt: at,
      updatedAt: at,
    });
    store.deliveries.push(delivery);
    created.push(delivery);
    if (campaign.type === 'selection') {
      signup.testerStage = 'selected';
      signup.selectedAt ||= at;
      signup.updatedAt = at;
    }
  }
  campaign.status = 'scheduled';
  campaign.scheduledAt = scheduledAt;
  campaign.recipientCount = created.length;
  campaign.updatedAt = at;
  campaign.scheduledBy = admin?.adminId || null;
  return { campaign, deliveries: created };
}

export function cancelEarlyAccessCampaign(store, campaignId, options = {}) {
  normalizeEarlyAccessStore(store);
  const campaign = store.campaigns.find(item => item.campaignId === String(campaignId || ''));
  if (!campaign) return { error: 'Campaign not found.' };
  if (['completed', 'cancelled'].includes(campaign.status)) return { error: `Campaign is already ${campaign.status}.` };
  const at = nowValue(options);
  campaign.status = 'cancelled';
  campaign.cancelledAt = at;
  campaign.updatedAt = at;
  for (const delivery of store.deliveries.filter(item => item.campaignId === campaign.campaignId && ['queued', 'failed'].includes(item.status))) {
    delivery.status = 'skipped';
    delivery.lastError = 'Campaign cancelled.';
    delivery.inviteCode = null;
    delivery.inviteCodeEncrypted = '';
    delivery.updatedAt = at;
  }
  return { campaign };
}

export function retryEarlyAccessCampaignFailures(store, campaignId, options = {}) {
  normalizeEarlyAccessStore(store);
  const campaign = store.campaigns.find(item => item.campaignId === String(campaignId || ''));
  if (!campaign) return { error: 'Campaign not found.' };
  const at = nowValue(options);
  let count = 0;
  for (const delivery of store.deliveries.filter(item => item.campaignId === campaign.campaignId && item.status === 'failed')) {
    delivery.status = 'queued';
    delivery.attempts = 0;
    delivery.nextAttemptAt = at;
    delivery.lastError = '';
    delivery.updatedAt = at;
    count += 1;
  }
  if (count) campaign.status = 'sending';
  return { campaign, count };
}

export function claimEarlyAccessDelivery(store, options = {}) {
  normalizeEarlyAccessStore(store);
  const at = nowValue(options);
  for (const delivery of store.deliveries) {
    if (delivery.status === 'sending' && delivery.leaseExpiresAt && delivery.leaseExpiresAt <= at) {
      delivery.status = delivery.attempts >= MAX_DELIVERY_ATTEMPTS ? 'failed' : 'queued';
      delivery.nextAttemptAt = at;
    }
  }
  const delivery = store.deliveries.find(item => item.status === 'queued' && item.nextAttemptAt <= at && item.attempts < MAX_DELIVERY_ATTEMPTS);
  if (!delivery) return null;
  const campaign = store.campaigns.find(item => item.campaignId === delivery.campaignId);
  const signup = store.signups.find(item => item.signupId === delivery.signupId);
  if (!campaign || !signup || campaign.status === 'cancelled' || signup.consentStatus !== 'confirmed') {
    delivery.status = 'skipped';
    delivery.lastError = !campaign ? 'Campaign missing.' : !signup ? 'Signup missing.' : campaign.status === 'cancelled' ? 'Campaign cancelled.' : 'Recipient is not subscribed.';
    delivery.updatedAt = at;
    return null;
  }
  delivery.status = 'sending';
  delivery.attempts += 1;
  delivery.leaseExpiresAt = at + 5 * 60 * 1000;
  delivery.updatedAt = at;
  campaign.status = 'sending';
  campaign.updatedAt = at;
  return { delivery, campaign, signup };
}

function updateCampaignCompletion(store, campaign, at) {
  const deliveries = store.deliveries.filter(item => item.campaignId === campaign.campaignId);
  if (deliveries.length && deliveries.every(item => ['sent', 'failed', 'skipped'].includes(item.status))) {
    campaign.status = 'completed';
    campaign.completedAt = at;
    campaign.updatedAt = at;
  }
}

export function completeEarlyAccessDelivery(store, deliveryId, options = {}) {
  normalizeEarlyAccessStore(store);
  const delivery = store.deliveries.find(item => item.deliveryId === String(deliveryId || ''));
  if (!delivery) return { error: 'Delivery not found.' };
  const at = nowValue(options);
  const campaign = store.campaigns.find(item => item.campaignId === delivery.campaignId);
  const signup = store.signups.find(item => item.signupId === delivery.signupId);
  delivery.status = 'sent';
  delivery.sentAt = at;
  delivery.leaseExpiresAt = null;
  delivery.lastError = '';
  delivery.inviteCode = null;
  delivery.inviteCodeEncrypted = '';
  delivery.updatedAt = at;
  if (campaign && signup) {
    if (campaign.type === 'selection') signup.testerStage = 'onboarding';
    if (campaign.type === 'access') {
      signup.testerStage = 'invited';
      signup.invitedAt = at;
    }
    signup.updatedAt = at;
    updateCampaignCompletion(store, campaign, at);
  }
  return { delivery, campaign, signup };
}

export function failEarlyAccessDelivery(store, deliveryId, error, options = {}) {
  normalizeEarlyAccessStore(store);
  const delivery = store.deliveries.find(item => item.deliveryId === String(deliveryId || ''));
  if (!delivery) return { error: 'Delivery not found.' };
  const at = nowValue(options);
  delivery.leaseExpiresAt = null;
  delivery.lastError = redactEarlyAccessError(error?.message || error || 'Email delivery failed.', 300);
  delivery.updatedAt = at;
  if (delivery.attempts >= MAX_DELIVERY_ATTEMPTS || options.permanent === true) {
    delivery.status = 'failed';
  } else {
    delivery.status = 'queued';
    delivery.nextAttemptAt = at + Math.min(60 * 60 * 1000, (2 ** delivery.attempts) * 60 * 1000);
  }
  const campaign = store.campaigns.find(item => item.campaignId === delivery.campaignId);
  if (campaign) updateCampaignCompletion(store, campaign, at);
  return { delivery, campaign };
}

export function markEarlyAccessActivated(store, signupId, userId, options = {}) {
  normalizeEarlyAccessStore(store);
  const signup = store.signups.find(item => item.signupId === String(signupId || ''));
  if (!signup) return null;
  const at = nowValue(options);
  signup.testerStage = 'activated';
  signup.activatedAt = at;
  signup.activatedUserId = String(userId || '');
  signup.updatedAt = at;
  return signup;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[character]));
}

function linkWithFragment(baseUrl, path, token) {
  return `${String(baseUrl || '').replace(/\/$/, '')}${path}#token=${encodeURIComponent(token)}`;
}

function campaignManageContact(signup, options = {}) {
  const at = nowValue(options);
  const contact = decryptEarlyAccessContact(signup.contactEncrypted, options.env);
  if (!contact?.email) return null;
  if (!contact.manageToken || !signup.manageTokenExpiresAt || signup.manageTokenExpiresAt <= at) {
    const manageToken = crypto.randomBytes(32).toString('base64url');
    const refreshed = { ...contact, manageToken };
    signup.contactEncrypted = encryptEarlyAccessContact(refreshed, options.env);
    signup.manageTokenHash = tokenHash(manageToken, options.env, 'manage');
    signup.manageTokenExpiresAt = at + MANAGE_TOKEN_TTL_MS;
    signup.updatedAt = Math.max(signup.updatedAt || 0, at);
    return refreshed;
  }
  const expectedHash = tokenHash(contact.manageToken, options.env, 'manage');
  if (!secureEqual(signup.manageTokenHash, expectedHash)) {
    signup.manageTokenHash = expectedHash;
    signup.updatedAt = Math.max(signup.updatedAt || 0, at);
  }
  return contact;
}

function deliveryInviteCode(delivery, env) {
  if (!delivery) return '';
  const protectedInvite = decryptEarlyAccessContact(delivery.inviteCodeEncrypted, env)?.inviteCode;
  if (protectedInvite) return safeEarlyAccessText(protectedInvite, 64);
  const legacyInvite = safeEarlyAccessText(delivery.inviteCode, 64);
  if (legacyInvite) {
    delivery.inviteCodeEncrypted = encryptEarlyAccessContact({ inviteCode: legacyInvite }, env);
    delivery.inviteCode = null;
  }
  return legacyInvite;
}

export function earlyAccessConfirmationEmail({ email, firstName, confirmationToken, baseUrl }) {
  const confirmationUrl = linkWithFragment(baseUrl, '/early-access/confirm', confirmationToken);
  const greeting = firstName ? `Hello ${firstName},` : 'Hello,';
  return {
    to: email,
    subject: 'Confirm your Nine Below early-access signup',
    text: [
      greeting,
      '',
      'Confirm that you want early-access and testing updates for Nine Below by Potterwell:',
      confirmationUrl,
      '',
      'This link expires in 48 hours. Signing up does not guarantee selection for a testing wave.',
      `Privacy: ${String(baseUrl || '').replace(/\/$/, '')}/privacy`,
    ].join('\n'),
    html: `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#07182a;color:#eef6f3;padding:28px"><main style="max-width:620px;margin:auto;background:#10223d;padding:32px;border-radius:10px"><p style="color:#f4c55c;font-weight:700">A Potterwell game</p><h1 style="margin:0 0 20px">Confirm Nine Below early access</h1><p>${escapeHtml(greeting)}</p><p>Confirm that you want early-access and testing updates for Nine Below by Potterwell.</p><p><a href="${escapeHtml(confirmationUrl)}" style="display:inline-block;background:#57dda8;color:#061421;padding:14px 20px;border-radius:6px;font-weight:700;text-decoration:none">Confirm my signup</a></p><p style="color:#b9c8d2">This link expires in 48 hours. Signing up does not guarantee selection for a testing wave.</p><p><a href="${escapeHtml(String(baseUrl || '').replace(/\/$/, ''))}/privacy" style="color:#5bc5ee">Privacy policy</a></p></main></body></html>`,
  };
}

export function renderEarlyAccessCampaignEmail(campaign, signup, delivery, options = {}) {
  const contact = campaignManageContact(signup, options);
  if (!contact?.email || !contact.manageToken) throw new Error('Recipient contact information is unavailable.');
  const baseUrl = String(options.baseUrl || '').replace(/\/$/, '');
  const manageUrl = linkWithFragment(baseUrl, '/early-access/preferences', contact.manageToken);
  const feedbackUrl = linkWithFragment(baseUrl, '/early-access/feedback', contact.manageToken);
  const onboardingUrl = linkWithFragment(baseUrl, '/early-access/onboarding', contact.manageToken);
  const unsubscribeUrl = `${baseUrl}/early-access/unsubscribe?token=${encodeURIComponent(scopedUnsubscribeToken(signup, options))}`;
  const ctaUrl = campaign.type === 'selection' ? onboardingUrl : campaign.accessUrl || feedbackUrl;
  const ctaLabel = campaign.type === 'selection' ? 'Complete tester setup' : campaign.ctaLabel || (campaign.type === 'access' ? 'Join the test' : 'Learn more');
  const greeting = contact.firstName ? `Hello ${contact.firstName},` : 'Hello,';
  const startLine = campaign.startAt ? `Testing begins ${new Date(campaign.startAt).toLocaleString()}.` : '';
  const inviteCode = deliveryInviteCode(delivery, options.env);
  const inviteLine = inviteCode ? `Your one-use Nine Below invite code: ${inviteCode}` : '';
  const focusText = campaign.focusBullets.length ? ['What to watch for:', ...campaign.focusBullets.map(item => `- ${item}`)] : [];
  const footer = [
    `Manage preferences or unsubscribe: ${manageUrl}`,
    options.postalAddress ? `Potterwell, ${options.postalAddress}` : '',
  ].filter(Boolean);
  const text = [greeting, '', campaign.heading, '', campaign.body, startLine, '', ...focusText, campaign.feedbackInstructions, inviteLine, '', `${ctaLabel}: ${ctaUrl}`, `Send feedback: ${feedbackUrl}`, '', ...footer].filter(value => value !== '').join('\n');
  const focusHtml = campaign.focusBullets.length ? `<h2 style="font-size:18px">What to watch for</h2><ul>${campaign.focusBullets.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '';
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#07182a;color:#eef6f3;padding:28px"><span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${escapeHtml(campaign.preheader)}</span><main style="max-width:620px;margin:auto;background:#10223d;padding:32px;border-radius:10px"><p style="color:#f4c55c;font-weight:700">Nine Below by Potterwell</p><h1 style="margin:0 0 20px">${escapeHtml(campaign.heading)}</h1><p>${escapeHtml(greeting)}</p><p style="white-space:pre-wrap">${escapeHtml(campaign.body)}</p>${startLine ? `<p><strong>${escapeHtml(startLine)}</strong></p>` : ''}${focusHtml}${campaign.feedbackInstructions ? `<p style="white-space:pre-wrap">${escapeHtml(campaign.feedbackInstructions)}</p>` : ''}${inviteLine ? `<div style="margin:22px 0;padding:16px;background:#07182a;border:1px solid #5bc5ee;border-radius:6px"><strong>${escapeHtml(inviteLine)}</strong></div>` : ''}<p><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#57dda8;color:#061421;padding:14px 20px;border-radius:6px;font-weight:700;text-decoration:none">${escapeHtml(ctaLabel)}</a></p><p><a href="${escapeHtml(feedbackUrl)}" style="color:#5bc5ee">Send early-access feedback</a></p><hr style="border:0;border-top:1px solid #405365;margin:28px 0"><p style="font-size:12px;color:#b9c8d2">You are receiving this because you confirmed the Nine Below early-access list. <a href="${escapeHtml(manageUrl)}" style="color:#5bc5ee">Manage preferences or unsubscribe</a>.${options.postalAddress ? `<br>Potterwell, ${escapeHtml(options.postalAddress)}` : ''}</p></main></body></html>`;
  return {
    to: contact.email,
    subject: campaign.subject,
    text,
    html,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}

export function previewEarlyAccessCampaignEmail(campaign, email, options = {}) {
  const manageToken = crypto.randomBytes(24).toString('base64url');
  const signup = normalizeSignup({
    signupId: 'preview',
    emailHash: 'preview',
    contactEncrypted: encryptEarlyAccessContact(newContact(normalizeEarlyAccessEmail(email), 'Partner', manageToken, email), options.env),
    manageTokenHash: tokenHash(manageToken, options.env, 'manage'),
    manageTokenExpiresAt: Date.now() + MANAGE_TOKEN_TTL_MS,
    platforms: campaign.targetPlatform === 'all' ? ['ios', 'android'] : [campaign.targetPlatform],
    consentStatus: 'confirmed',
    testerStage: campaign.type === 'access' ? 'ready' : 'waitlisted',
  });
  return renderEarlyAccessCampaignEmail(campaign, signup, campaign.type === 'access'
    ? { inviteCodeEncrypted: encryptEarlyAccessContact({ inviteCode: 'PREVIEW-CODE' }, options.env) }
    : {}, options);
}

function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function earlyAccessCsv(store, query = {}, options = {}) {
  const signups = adminEarlyAccessSignups(store, { ...query, limit: 5000 }, options)
    .filter(item => item.consentStatus === 'confirmed' && item.email);
  if (query.format === 'google-play') {
    const rows = signups.filter(item => item.platforms.includes('android')).map(item => item.platformEmail || item.email);
    return rows.join('\r\n');
  }
  const headers = ['signup_id', 'email', 'first_name', 'platforms', 'consent_status', 'tester_stage', 'source', 'created_at', 'confirmed_at'];
  const rows = signups.map(item => [item.signupId, item.email, item.firstName, item.platforms.join('|'), item.consentStatus, item.testerStage, item.source, new Date(item.createdAt).toISOString(), item.confirmedAt ? new Date(item.confirmedAt).toISOString() : '']);
  return [headers.map(csvCell).join(','), ...rows.map(row => row.map(csvCell).join(','))].join('\r\n');
}

export function applyEarlyAccessRetention(store, options = {}) {
  normalizeEarlyAccessStore(store);
  const at = nowValue(options);
  let removed = 0;
  let erased = 0;
  const reconfirmations = [];
  const removedSignupIds = [];
  const erasedSignupIds = [];
  for (const signup of store.signups) {
    if (signup.consentStatus === 'confirmed' && signup.consentRefreshedAt && signup.consentRefreshedAt + CONSENT_TTL_MS <= at) {
      const contact = decryptEarlyAccessContact(signup.contactEncrypted, options.env);
      const confirmationToken = crypto.randomBytes(32).toString('base64url');
      signup.consentStatus = 'pending';
      signup.needsReconfirmation = true;
      signup.reconfirmationRequestedAt = at;
      signup.confirmationPurpose = 'reconfirm';
      signup.confirmationTokenHash = tokenHash(confirmationToken, options.env, 'confirmation');
      signup.confirmationExpiresAt = at + CONFIRMATION_TTL_MS;
      signup.lastConfirmationSentAt = at;
      signup.confirmationSendHistory.push(at);
      signup.confirmationSendHistory = signup.confirmationSendHistory.slice(-10);
      signup.updatedAt = at;
      addConsentEvent(signup, 'reconfirmation_required', at);
      if (contact?.email) reconfirmations.push({
        signup,
        confirmationToken,
        email: contact.email,
        firstName: contact.firstName || '',
      });
    }
    if (signup.needsReconfirmation && signup.reconfirmationRequestedAt && signup.reconfirmationRequestedAt + PENDING_RETENTION_MS <= at && !signup.erasedAt) {
      eraseEarlyAccessPii(signup, at, 'reconfirmation_expired');
      erased += 1;
      erasedSignupIds.push(signup.signupId);
    }
    if (signup.consentStatus === 'unsubscribed' && signup.unsubscribedAt && !signup.erasedAt && signup.unsubscribedAt + UNSUBSCRIBED_PII_RETENTION_MS <= at) {
      eraseEarlyAccessPii(signup, at, 'pii_retention_erased');
      erased += 1;
      erasedSignupIds.push(signup.signupId);
    }
  }
  store.signups = store.signups.filter(signup => {
    const expiredPending = signup.consentStatus === 'pending' && !signup.needsReconfirmation && signup.confirmationExpiresAt && signup.confirmationExpiresAt + PENDING_RETENTION_MS <= at;
    const expiredSuppression = signup.consentStatus === 'unsubscribed' && signup.unsubscribedAt && signup.unsubscribedAt + SUPPRESSION_RETENTION_MS <= at;
    if (expiredPending || expiredSuppression) {
      removed += 1;
      removedSignupIds.push(signup.signupId);
      return false;
    }
    return true;
  });
  return { removed, erased, reconfirmations, removedSignupIds, erasedSignupIds, changed: removed + erased + reconfirmations.length > 0 };
}
