import crypto from 'crypto';
import { normalizeUserProgression } from './progression.js';

const MAIL_TITLE_MAX_LENGTH = 90;
const MAIL_BODY_MAX_LENGTH = 1400;
const FEEDBACK_MAX_LENGTH = 1000;
const FEEDBACK_CATEGORIES = new Set(['bug', 'suggestion', 'account', 'gameplay', 'other']);

function now() {
  return Date.now();
}

function cleanText(value, maxLength = 120) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function cleanBody(value, maxLength = MAIL_BODY_MAX_LENGTH) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
    .slice(0, maxLength);
}

function normalizeAttachment(input = {}) {
  const type = String(input?.type || '').trim();
  if (type === 'coins') {
    const amount = Math.max(0, Math.trunc(Number(input.amount) || 0));
    return amount > 0 ? { type: 'coins', amount } : null;
  }
  if (type === 'cosmetic') {
    const cosmeticId = cleanText(input.cosmeticId || input.id, 80);
    return cosmeticId ? { type: 'cosmetic', cosmeticId } : null;
  }
  return null;
}

export function normalizeMailEntries(entries = []) {
  return (Array.isArray(entries) ? entries : [])
    .map(entry => {
      const mailId = cleanText(entry.mailId || entry.id, 80);
      const recipientUserId = cleanText(entry.recipientUserId || entry.userId, 80);
      if (!mailId || !recipientUserId) return null;
      return {
        mailId,
        batchId: cleanText(entry.batchId || mailId, 80),
        recipientUserId,
        recipientDisplayName: cleanText(entry.recipientDisplayName || '', 48),
        title: cleanText(entry.title, MAIL_TITLE_MAX_LENGTH) || 'Golf 9 Notice',
        body: cleanBody(entry.body),
        attachments: (Array.isArray(entry.attachments) ? entry.attachments : [])
          .map(normalizeAttachment)
          .filter(Boolean),
        createdAt: Number(entry.createdAt || now()) || now(),
        createdByAdminId: cleanText(entry.createdByAdminId || '', 80) || null,
        createdByAdminName: cleanText(entry.createdByAdminName || 'system', 48) || 'system',
        expiresAt: Number(entry.expiresAt || 0) || null,
        readAt: Number(entry.readAt || 0) || null,
        claimedAt: Number(entry.claimedAt || 0) || null,
        deletedAt: Number(entry.deletedAt || 0) || null,
        claimResult: entry.claimResult && typeof entry.claimResult === 'object' ? entry.claimResult : null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function publicMailEntry(entry, timestamp = now()) {
  const expired = !!entry.expiresAt && Number(entry.expiresAt) <= timestamp;
  const claimable = (entry.attachments || []).length > 0 && !entry.claimedAt && !expired;
  return {
    mailId: entry.mailId,
    batchId: entry.batchId,
    title: entry.title,
    body: entry.body,
    attachments: entry.attachments || [],
    createdAt: entry.createdAt,
    createdByAdminName: entry.createdByAdminName || 'system',
    expiresAt: entry.expiresAt || null,
    readAt: entry.readAt || null,
    claimedAt: entry.claimedAt || null,
    deletedAt: entry.deletedAt || null,
    read: !!entry.readAt,
    claimed: !!entry.claimedAt,
    expired,
    claimable,
  };
}

export function mailEntriesForUser(entries, userId, options = {}) {
  const includeDeleted = options.includeDeleted === true;
  return normalizeMailEntries(entries)
    .filter(entry => entry.recipientUserId === userId)
    .filter(entry => includeDeleted || !entry.deletedAt)
    .map(entry => publicMailEntry(entry));
}

export function mailSummaryForUser(entries, userId) {
  const mail = mailEntriesForUser(entries, userId);
  return {
    total: mail.length,
    unread: mail.filter(entry => !entry.read).length,
    claimable: mail.filter(entry => entry.claimable).length,
    latest: mail[0] || null,
  };
}

export function markMailRead(entries, userId, mailId, timestamp = now()) {
  const entry = entries.find(item => item.mailId === mailId && item.recipientUserId === userId && !item.deletedAt);
  if (!entry) return { error: 'Mail not found.' };
  if (!entry.readAt) entry.readAt = timestamp;
  return { mail: publicMailEntry(entry, timestamp) };
}

export function deleteMailForUser(entries, userId, mailId, timestamp = now()) {
  const entry = entries.find(item => item.mailId === mailId && item.recipientUserId === userId && !item.deletedAt);
  if (!entry) return { error: 'Mail not found.' };
  entry.deletedAt = timestamp;
  if (!entry.readAt) entry.readAt = timestamp;
  return { ok: true, mail: publicMailEntry(entry, timestamp) };
}

export function claimMailForUser(entries, user, catalog, mailId, timestamp = now()) {
  const entry = entries.find(item => item.mailId === mailId && item.recipientUserId === user.userId && !item.deletedAt);
  if (!entry) return { error: 'Mail not found.', status: 404 };
  if (entry.expiresAt && Number(entry.expiresAt) <= timestamp) return { error: 'This mail reward has expired.', status: 410 };
  if (entry.claimedAt) return { mail: publicMailEntry(entry, timestamp), alreadyClaimed: true, rewards: entry.claimResult || [] };

  const attachments = Array.isArray(entry.attachments) ? entry.attachments : [];
  if (!attachments.length) return { error: 'This mail does not have a reward to claim.', status: 400 };

  normalizeUserProgression(user, timestamp);
  const catalogIds = new Set((Array.isArray(catalog) ? catalog : []).map(item => item.id));
  const rewards = [];
  for (const attachment of attachments) {
    if (attachment.type === 'coins') {
      const amount = Math.max(0, Math.trunc(Number(attachment.amount) || 0));
      if (!amount) continue;
      user.currency.coins += amount;
      user.currency.lifetimeCoins += amount;
      rewards.push({ type: 'coins', amount });
    }
    if (attachment.type === 'cosmetic') {
      const cosmeticId = cleanText(attachment.cosmeticId, 80);
      if (!cosmeticId || !catalogIds.has(cosmeticId)) return { error: `Cosmetic ${cosmeticId} is not in the live catalog.`, status: 400 };
      if (!user.inventory.cosmetics.includes(cosmeticId)) user.inventory.cosmetics.push(cosmeticId);
      rewards.push({ type: 'cosmetic', cosmeticId });
    }
  }
  entry.claimedAt = timestamp;
  entry.readAt ||= timestamp;
  entry.claimResult = rewards;
  normalizeUserProgression(user, timestamp);
  return {
    mail: publicMailEntry(entry, timestamp),
    rewards,
    user,
  };
}

function normalizeMailPayload(body = {}) {
  const title = cleanText(body.title, MAIL_TITLE_MAX_LENGTH);
  const message = cleanBody(body.body || body.message);
  if (!title || !message) return { error: 'Title and message are required.' };
  const attachments = [];
  const coins = Math.trunc(Number(body.coins || body.coinAmount || 0));
  if (Number.isFinite(coins) && coins > 0) attachments.push({ type: 'coins', amount: coins });
  const cosmeticId = cleanText(body.cosmeticId, 80);
  if (cosmeticId) attachments.push({ type: 'cosmetic', cosmeticId });
  const expiresAt = body.expiresAt ? Number(new Date(body.expiresAt).getTime()) : null;
  if (expiresAt && expiresAt <= now()) return { error: 'Expiration must be in the future.' };
  return { title, body: message, attachments, expiresAt };
}

export function createSystemMail(entries, recipients, admin, body = {}, catalog = [], timestamp = now()) {
  const payload = normalizeMailPayload(body);
  if (payload.error) return payload;
  const liveIds = new Set((Array.isArray(catalog) ? catalog : []).map(item => item.id));
  const missing = payload.attachments.find(item => item.type === 'cosmetic' && !liveIds.has(item.cosmeticId));
  if (missing) return { error: `Cosmetic ${missing.cosmeticId} is not in the live catalog.` };

  const unique = new Map();
  for (const user of Array.isArray(recipients) ? recipients : []) {
    if (user?.userId && !unique.has(user.userId)) unique.set(user.userId, user);
  }
  if (!unique.size) return { error: 'At least one recipient is required.' };

  const batchId = crypto.randomUUID();
  const created = [];
  for (const user of unique.values()) {
    const entry = {
      mailId: crypto.randomUUID(),
      batchId,
      recipientUserId: user.userId,
      recipientDisplayName: cleanText(user.displayName, 48),
      title: payload.title,
      body: payload.body,
      attachments: payload.attachments,
      createdAt: timestamp,
      createdByAdminId: admin?.adminId || null,
      createdByAdminName: admin?.displayName || 'system',
      expiresAt: payload.expiresAt,
      readAt: null,
      claimedAt: null,
      deletedAt: null,
      claimResult: null,
    };
    entries.push(entry);
    created.push(entry);
  }
  return {
    batchId,
    count: created.length,
    attachments: payload.attachments,
    mail: created.map(entry => publicMailEntry(entry, timestamp)),
  };
}

export function adminMailLog(entries, limit = 100) {
  const grouped = new Map();
  for (const entry of normalizeMailEntries(entries)) {
    const group = grouped.get(entry.batchId) || {
      batchId: entry.batchId,
      title: entry.title,
      body: entry.body,
      createdAt: entry.createdAt,
      createdByAdminName: entry.createdByAdminName,
      attachments: entry.attachments || [],
      expiresAt: entry.expiresAt || null,
      recipientCount: 0,
      readCount: 0,
      claimedCount: 0,
      deletedCount: 0,
      recipients: [],
    };
    group.recipientCount += 1;
    if (entry.readAt) group.readCount += 1;
    if (entry.claimedAt) group.claimedCount += 1;
    if (entry.deletedAt) group.deletedCount += 1;
    if (group.recipients.length < 12) {
      group.recipients.push({
        userId: entry.recipientUserId,
        displayName: entry.recipientDisplayName || entry.recipientUserId,
        readAt: entry.readAt || null,
        claimedAt: entry.claimedAt || null,
        deletedAt: entry.deletedAt || null,
      });
    }
    grouped.set(entry.batchId, group);
  }
  return [...grouped.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

export function cleanFeedbackPayload(body = {}) {
  const category = FEEDBACK_CATEGORIES.has(String(body.category || '').trim()) ? String(body.category).trim() : 'other';
  const message = cleanBody(body.message, FEEDBACK_MAX_LENGTH);
  if (message.length < 6) return { error: 'Feedback must be at least 6 characters.' };
  return {
    category,
    subject: cleanText(body.subject || `Mailbox feedback: ${category}`, 100),
    message,
  };
}

export const MAIL_FEEDBACK_MAX_LENGTH = FEEDBACK_MAX_LENGTH;
export const MAIL_FEEDBACK_CATEGORIES = [...FEEDBACK_CATEGORIES];
