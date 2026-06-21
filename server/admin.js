import crypto from 'crypto';
import { publicEconomyCatalog } from './economy.js';
import { publicCosmeticCatalog, publicUserProfile } from './progression.js';

const ADMIN_SESSION_TTL_MS = 1000 * 60 * 60 * 8;
const ADMIN_MFA_TTL_MS = 1000 * 60 * 5;
const SUPPORT_TICKET_MAX_LENGTH = 1200;
const ADMIN_REASON_MAX_LENGTH = 240;

const ROLE_PERMISSIONS = {
  owner: ['*'],
  admin: [
    'users:read',
    'users:write',
    'invites:read',
    'invites:write',
    'support:read',
    'support:write',
    'economy:write',
    'cosmetics:write',
    'moderation:write',
    'audit:read',
    'catalog:read',
    'catalog:write',
    'clubs:write',
    'competitive:read',
    'competitive:write',
    'metrics:read',
  ],
  support: ['users:read', 'invites:read', 'support:read', 'support:write', 'catalog:read', 'metrics:read'],
  moderator: ['users:read', 'support:read', 'moderation:write', 'audit:read', 'catalog:read', 'metrics:read'],
  economy: ['users:read', 'economy:write', 'cosmetics:write', 'catalog:read', 'catalog:write', 'competitive:read', 'metrics:read'],
  readOnly: ['users:read', 'support:read', 'audit:read', 'catalog:read', 'competitive:read', 'metrics:read'],
};

const VALID_ROLES = Object.keys(ROLE_PERMISSIONS);
const VALID_TICKET_STATUSES = new Set(['open', 'in_review', 'waiting_on_player', 'resolved', 'closed']);
const VALID_MODERATION_TYPES = new Set(['account_ban', 'device_ban', 'suspension', 'chat_mute']);
const INVITE_CODE_MAX_LENGTH = 32;

function now() {
  return Date.now();
}

function safeString(value, maxLength = 120) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const passwordHash = crypto.pbkdf2Sync(String(password || ''), salt, 120_000, 32, 'sha256').toString('hex');
  return { salt, passwordHash };
}

function verifyPassword(password, salt, passwordHash) {
  if (!salt || !passwordHash) return false;
  return hashPassword(String(password || ''), salt).passwordHash === passwordHash;
}

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function rolePermissions(role) {
  return ROLE_PERMISSIONS[role] || [];
}

export function adminHasPermission(admin, permission) {
  const permissions = rolePermissions(admin?.role);
  return permissions.includes('*') || permissions.includes(permission);
}

function publicAdmin(admin) {
  return {
    adminId: admin.adminId,
    displayName: admin.displayName,
    role: admin.role,
    createdAt: admin.createdAt,
    lastLoginAt: admin.lastLoginAt || null,
    permissions: rolePermissions(admin.role),
  };
}

function ensureArray(store, key) {
  if (!Array.isArray(store[key])) store[key] = [];
  return store[key];
}

export function normalizeAdminStore(store) {
  ensureArray(store, 'admins');
  ensureArray(store, 'adminSessions');
  ensureArray(store, 'adminAudit');
  ensureArray(store, 'supportTickets');
  ensureArray(store, 'bans');
  ensureArray(store, 'inviteCodes');

  store.admins = store.admins
    .filter(admin => admin?.adminId && admin?.displayName)
    .map(admin => ({
      adminId: String(admin.adminId),
      displayName: safeString(admin.displayName, 40),
      role: VALID_ROLES.includes(admin.role) ? admin.role : 'readOnly',
      salt: String(admin.salt || ''),
      passwordHash: String(admin.passwordHash || ''),
      mfaSecretHash: String(admin.mfaSecretHash || ''),
      mfaEnabled: admin.mfaEnabled !== false,
      createdAt: Number(admin.createdAt) || now(),
      lastLoginAt: Number(admin.lastLoginAt) || null,
      disabledAt: Number(admin.disabledAt) || null,
    }));

  store.adminSessions = store.adminSessions
    .filter(session => session?.token && session?.adminId && Number(session.expiresAt) > now())
    .map(session => ({
      token: String(session.token),
      adminId: String(session.adminId),
      expiresAt: Number(session.expiresAt),
      mfaVerifiedAt: Number(session.mfaVerifiedAt) || null,
      createdAt: Number(session.createdAt) || now(),
      ipHash: String(session.ipHash || ''),
      userAgent: safeString(session.userAgent, 180),
    }));

  store.adminAudit = store.adminAudit
    .filter(entry => entry?.auditId)
    .slice(-2000);

  store.supportTickets = store.supportTickets
    .filter(ticket => ticket?.ticketId)
    .map(ticket => ({
      ticketId: String(ticket.ticketId),
      userId: ticket.userId ? String(ticket.userId) : null,
      displayName: safeString(ticket.displayName, 40),
      category: safeString(ticket.category || 'general', 40),
      status: VALID_TICKET_STATUSES.has(ticket.status) ? ticket.status : 'open',
      subject: safeString(ticket.subject || 'Player support request', 100),
      message: safeString(ticket.message, SUPPORT_TICKET_MAX_LENGTH),
      deviceHash: ticket.deviceHash ? String(ticket.deviceHash) : null,
      createdAt: Number(ticket.createdAt) || now(),
      updatedAt: Number(ticket.updatedAt) || Number(ticket.createdAt) || now(),
      assignedAdminId: ticket.assignedAdminId ? String(ticket.assignedAdminId) : null,
      notes: Array.isArray(ticket.notes) ? ticket.notes.slice(-80) : [],
    }));

  store.bans = store.bans
    .filter(ban => ban?.banId)
    .map(ban => ({
      banId: String(ban.banId),
      type: VALID_MODERATION_TYPES.has(ban.type) ? ban.type : 'account_ban',
      userId: ban.userId ? String(ban.userId) : null,
      deviceHash: ban.deviceHash ? String(ban.deviceHash) : null,
      reason: safeString(ban.reason, ADMIN_REASON_MAX_LENGTH),
      createdAt: Number(ban.createdAt) || now(),
      expiresAt: Number(ban.expiresAt) || null,
      revokedAt: Number(ban.revokedAt) || null,
      createdBy: ban.createdBy ? String(ban.createdBy) : null,
    }));

  store.inviteCodes = store.inviteCodes
    .filter(invite => invite?.inviteId && invite?.code)
    .map(invite => ({
      inviteId: String(invite.inviteId),
      code: normalizeInviteCode(invite.code),
      label: safeString(invite.label || 'Pre-alpha invite', 80),
      note: safeString(invite.note || '', 240),
      maxUses: Math.max(1, Number(invite.maxUses) || 1),
      uses: Array.isArray(invite.uses) ? invite.uses.slice(-500).map(use => ({
        userId: String(use.userId || ''),
        displayName: safeString(use.displayName || '', 40),
        usedAt: Number(use.usedAt) || now(),
      })).filter(use => use.userId) : [],
      createdAt: Number(invite.createdAt) || now(),
      createdBy: invite.createdBy ? String(invite.createdBy) : null,
      expiresAt: Number(invite.expiresAt) || null,
      disabledAt: Number(invite.disabledAt) || null,
      disabledReason: safeString(invite.disabledReason || '', ADMIN_REASON_MAX_LENGTH),
    }))
    .filter(invite => invite.code);

  return store;
}

export function normalizeInviteCode(value) {
  return safeString(value, INVITE_CODE_MAX_LENGTH)
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, INVITE_CODE_MAX_LENGTH);
}

export function signupInvitesRequired(env = process.env) {
  return env.REQUIRE_INVITE_CODE === '1' || env.PREALPHA_INVITES_REQUIRED === '1';
}

function inviteStatus(invite) {
  if (invite.disabledAt) return 'disabled';
  if (invite.expiresAt && invite.expiresAt <= now()) return 'expired';
  if (invite.uses.length >= invite.maxUses) return 'exhausted';
  return 'active';
}

function publicInvite(invite) {
  return {
    inviteId: invite.inviteId,
    code: invite.code,
    label: invite.label,
    note: invite.note,
    maxUses: invite.maxUses,
    uses: invite.uses,
    remainingUses: Math.max(0, invite.maxUses - invite.uses.length),
    status: inviteStatus(invite),
    createdAt: invite.createdAt,
    createdBy: invite.createdBy,
    expiresAt: invite.expiresAt,
    disabledAt: invite.disabledAt,
    disabledReason: invite.disabledReason,
  };
}

export function adminInvites(store) {
  normalizeAdminStore(store);
  return store.inviteCodes.slice().sort((a, b) => b.createdAt - a.createdAt).map(publicInvite);
}

export function createInviteCode(store, admin, body = {}) {
  normalizeAdminStore(store);
  const providedCode = normalizeInviteCode(body.code);
  const code = providedCode || crypto.randomBytes(5).toString('hex').toUpperCase();
  if (code.length < 4) return { error: 'Invite code must be at least 4 characters.' };
  if (store.inviteCodes.some(invite => invite.code === code)) return { error: 'Invite code already exists.' };
  const invite = {
    inviteId: crypto.randomUUID(),
    code,
    label: safeString(body.label || 'Pre-alpha invite', 80),
    note: safeString(body.note || '', 240),
    maxUses: Math.max(1, Math.min(500, Number(body.maxUses) || 1)),
    uses: [],
    createdAt: now(),
    createdBy: admin?.adminId || null,
    expiresAt: Number(body.expiresAt) || null,
    disabledAt: null,
    disabledReason: '',
  };
  store.inviteCodes.push(invite);
  return { invite: publicInvite(invite) };
}

export function disableInviteCode(store, inviteId, reason) {
  normalizeAdminStore(store);
  const invite = store.inviteCodes.find(item => item.inviteId === inviteId || item.code === normalizeInviteCode(inviteId));
  if (!invite) return { error: 'Invite code not found.' };
  invite.disabledAt = now();
  invite.disabledReason = safeString(reason, ADMIN_REASON_MAX_LENGTH);
  return { invite: publicInvite(invite) };
}

export function validateSignupInvite(store, code, required = false) {
  normalizeAdminStore(store);
  const normalized = normalizeInviteCode(code);
  if (!normalized) {
    return required ? { error: 'A pre-alpha invite code is required.' } : { invite: null };
  }
  const invite = store.inviteCodes.find(item => item.code === normalized);
  if (!invite) return { error: 'Invite code is invalid.' };
  const status = inviteStatus(invite);
  if (status !== 'active') return { error: `Invite code is ${status}.` };
  return { invite };
}

export function consumeSignupInvite(store, invite, user) {
  if (!invite || !user) return null;
  normalizeAdminStore(store);
  const target = store.inviteCodes.find(item => item.inviteId === invite.inviteId);
  if (!target) return null;
  target.uses.push({
    userId: user.userId,
    displayName: user.displayName,
    usedAt: now(),
  });
  return publicInvite(target);
}

export function normalizeUserAdminFields(user) {
  user.knownDevices = Array.isArray(user.knownDevices) ? user.knownDevices.slice(-20) : [];
  user.moderation ||= {};
  user.moderation.accountBannedAt = Number(user.moderation.accountBannedAt) || null;
  user.moderation.suspendedUntil = Number(user.moderation.suspendedUntil) || null;
  user.moderation.chatMutedUntil = Number(user.moderation.chatMutedUntil) || null;
  user.moderation.reason = safeString(user.moderation.reason, ADMIN_REASON_MAX_LENGTH);
  user.moderation.updatedAt = Number(user.moderation.updatedAt) || null;
  return user;
}

export function ensureBootstrapAdmin(store, env = process.env) {
  normalizeAdminStore(store);
  const username = safeString(env.ADMIN_BOOTSTRAP_USER || '', 40);
  const password = String(env.ADMIN_BOOTSTRAP_PASSWORD || '');
  const mfaCode = String(env.ADMIN_BOOTSTRAP_MFA_CODE || '000000');
  if (!username || !password || store.admins.length) return false;
  const credentials = hashPassword(password);
  store.admins.push({
    adminId: 'admin-owner',
    displayName: username,
    role: 'owner',
    salt: credentials.salt,
    passwordHash: credentials.passwordHash,
    mfaSecretHash: hashValue(mfaCode),
    mfaEnabled: true,
    createdAt: now(),
    lastLoginAt: null,
    disabledAt: null,
  });
  return true;
}

export function seedDevelopmentAdmin(store, env = process.env) {
  normalizeAdminStore(store);
  if (env.SEED_ADMIN_ACCOUNT === '0' || env.NODE_ENV === 'production' || store.admins.length) return false;
  const credentials = hashPassword('admin9');
  store.admins.push({
    adminId: 'dev-admin-owner',
    displayName: 'admin',
    role: 'owner',
    salt: credentials.salt,
    passwordHash: credentials.passwordHash,
    mfaSecretHash: hashValue('000000'),
    mfaEnabled: true,
    createdAt: now(),
    lastLoginAt: null,
    disabledAt: null,
  });
  return true;
}

function requestMeta(req) {
  return {
    ipHash: hashValue(req.ip || req.socket?.remoteAddress || ''),
    userAgent: safeString(req.headers['user-agent'] || '', 180),
  };
}

export function writeAudit(store, req, admin, action, target = {}, details = {}) {
  normalizeAdminStore(store);
  const previousHash = store.adminAudit.at(-1)?.entryHash || '';
  const entry = {
    auditId: crypto.randomUUID(),
    adminId: admin?.adminId || null,
    adminName: admin?.displayName || 'system',
    action,
    target,
    details,
    createdAt: now(),
    ...requestMeta(req || {}),
    previousHash,
  };
  entry.entryHash = hashValue(JSON.stringify(entry));
  store.adminAudit.push(entry);
  if (store.adminAudit.length > 2000) store.adminAudit.splice(0, store.adminAudit.length - 2000);
  return entry;
}

export function createAdminSession(store, req, admin) {
  normalizeAdminStore(store);
  const session = {
    token: crypto.randomBytes(32).toString('hex'),
    adminId: admin.adminId,
    expiresAt: now() + ADMIN_SESSION_TTL_MS,
    mfaVerifiedAt: null,
    createdAt: now(),
    ...requestMeta(req),
  };
  store.adminSessions.push(session);
  admin.lastLoginAt = now();
  return session;
}

export function authenticateAdmin(store, token) {
  normalizeAdminStore(store);
  if (!token) return null;
  const session = store.adminSessions.find(item => item.token === token && item.expiresAt > now());
  if (!session) return null;
  const admin = store.admins.find(item => item.adminId === session.adminId && !item.disabledAt);
  return admin ? { session, admin } : null;
}

export function loginAdmin(store, req, displayName, password) {
  normalizeAdminStore(store);
  const admin = store.admins.find(item => item.displayName.toLowerCase() === safeString(displayName, 40).toLowerCase() && !item.disabledAt);
  if (!admin || !verifyPassword(password, admin.salt, admin.passwordHash)) return { error: 'Invalid admin credentials.' };
  const session = createAdminSession(store, req, admin);
  writeAudit(store, req, admin, 'admin.login.started', { adminId: admin.adminId });
  return { sessionToken: session.token, mfaRequired: !!admin.mfaEnabled, admin: publicAdmin(admin) };
}

export function verifyAdminMfa(store, req, token, code) {
  const auth = authenticateAdmin(store, token);
  if (!auth) return { error: 'Admin authentication required.' };
  const expectedHash = auth.admin.mfaSecretHash || hashValue('000000');
  if (expectedHash !== hashValue(String(code || '').trim())) return { error: 'Invalid MFA code.' };
  auth.session.mfaVerifiedAt = now();
  writeAudit(store, req, auth.admin, 'admin.login.completed', { adminId: auth.admin.adminId });
  return { admin: publicAdmin(auth.admin) };
}

export function requireAdmin(store, permission = null) {
  return (req, res, next) => {
    const cookieToken = String(req.headers.cookie || '').match(/(?:^|;\s*)golf9_admin=([^;]+)/)?.[1];
    const headerToken = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const auth = authenticateAdmin(store, decodeURIComponent(cookieToken || headerToken || ''));
    if (!auth) return res.status(401).json({ error: 'Admin authentication required.' });
    if (!auth.session.mfaVerifiedAt || now() - auth.session.mfaVerifiedAt > ADMIN_MFA_TTL_MS + ADMIN_SESSION_TTL_MS) {
      return res.status(403).json({ error: 'Admin MFA verification required.' });
    }
    if (permission && !adminHasPermission(auth.admin, permission)) return res.status(403).json({ error: 'Admin permission denied.' });
    req.admin = auth;
    return next();
  };
}

export function activeBansFor(store, user, deviceHash = null) {
  normalizeAdminStore(store);
  normalizeUserAdminFields(user);
  const current = now();
  return store.bans.filter(ban => {
    if (ban.revokedAt) return false;
    if (ban.expiresAt && ban.expiresAt <= current) return false;
    if (ban.userId && user?.userId && ban.userId === user.userId) return true;
    return deviceHash && ban.deviceHash && ban.deviceHash === deviceHash;
  });
}

export function banErrorFor(store, user, deviceHash = null) {
  const bans = activeBansFor(store, user, deviceHash);
  const hardBan = bans.find(ban => ban.type === 'account_ban' || ban.type === 'device_ban');
  if (hardBan) return 'This account or device cannot access Golf 9.';
  const suspension = bans.find(ban => ban.type === 'suspension');
  if (suspension) return 'This account is temporarily suspended.';
  return null;
}

export function trackUserDevice(user, req, rawDeviceId = null) {
  normalizeUserAdminFields(user);
  const source = rawDeviceId || req.headers['x-golf9-device-id'] || req.headers['x-device-id'] || '';
  if (!source) return null;
  const deviceHash = hashValue(source);
  const platform = safeString(req.headers['x-golf9-platform'] || req.headers['user-agent'] || 'unknown', 80);
  const existing = user.knownDevices.find(device => device.deviceHash === deviceHash);
  if (existing) {
    existing.lastSeenAt = now();
    existing.platform = platform;
  } else {
    user.knownDevices.push({ deviceHash, platform, firstSeenAt: now(), lastSeenAt: now() });
    if (user.knownDevices.length > 20) user.knownDevices.splice(0, user.knownDevices.length - 20);
  }
  return deviceHash;
}

function publicUserForAdmin(user, rankedSeason, extras = {}, competitiveConfig = null) {
  normalizeUserAdminFields(user);
  return {
    ...publicUserProfile(user, rankedSeason, competitiveConfig),
    knownDevices: user.knownDevices,
    moderation: user.moderation,
    ...extras,
  };
}

export function adminUserList(users, rankedSeason, query = '', competitiveConfig = null) {
  const needle = safeString(query, 80).toLowerCase();
  return [...users.values()]
    .filter(user => !needle || user.displayName.toLowerCase().includes(needle) || user.userId.toLowerCase().includes(needle))
    .slice(0, 100)
    .map(user => publicUserForAdmin(user, rankedSeason, {}, competitiveConfig));
}

export function adminUserDetail(user, rankedSeason, results, cosmeticCatalog, economyCatalog, competitiveConfig = null) {
  return publicUserForAdmin(user, rankedSeason, {
    results: results.filter(result => result.players?.some(player => player.userId === user.userId)).slice(-25).reverse(),
    cosmetics: cosmeticCatalog,
    economy: economyCatalog,
  }, competitiveConfig);
}

export function cleanAdminReason(reason) {
  const cleaned = safeString(reason, ADMIN_REASON_MAX_LENGTH);
  return cleaned || null;
}

export function createSupportTicket(store, req, user, body = {}) {
  normalizeAdminStore(store);
  const message = safeString(body.message, SUPPORT_TICKET_MAX_LENGTH);
  if (message.length < 6) return { error: 'Support message must be at least 6 characters.' };
  const ticket = {
    ticketId: crypto.randomUUID(),
    userId: user?.userId || null,
    displayName: user?.displayName || safeString(body.displayName, 40),
    category: safeString(body.category || 'general', 40),
    status: 'open',
    subject: safeString(body.subject || 'Player support request', 100),
    message,
    deviceHash: trackUserDevice(user, req, body.deviceId) || null,
    createdAt: now(),
    updatedAt: now(),
    assignedAdminId: null,
    notes: [],
  };
  store.supportTickets.push(ticket);
  return { ticket: publicTicket(ticket) };
}

function publicTicket(ticket) {
  return {
    ticketId: ticket.ticketId,
    userId: ticket.userId,
    displayName: ticket.displayName,
    category: ticket.category,
    status: ticket.status,
    subject: ticket.subject,
    message: ticket.message,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    assignedAdminId: ticket.assignedAdminId,
    notes: ticket.notes || [],
  };
}

export function adminTickets(store, status = null) {
  normalizeAdminStore(store);
  return store.supportTickets
    .filter(ticket => !status || ticket.status === status)
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(publicTicket);
}

export function updateSupportTicket(store, ticketId, patch = {}) {
  normalizeAdminStore(store);
  const ticket = store.supportTickets.find(item => item.ticketId === ticketId);
  if (!ticket) return { error: 'Support ticket not found.' };
  if (patch.status !== undefined) {
    if (!VALID_TICKET_STATUSES.has(patch.status)) return { error: 'Invalid support ticket status.' };
    ticket.status = patch.status;
  }
  if (patch.assignedAdminId !== undefined) ticket.assignedAdminId = patch.assignedAdminId ? String(patch.assignedAdminId) : null;
  ticket.updatedAt = now();
  return { ticket: publicTicket(ticket) };
}

export function addSupportNote(store, ticketId, admin, note) {
  normalizeAdminStore(store);
  const ticket = store.supportTickets.find(item => item.ticketId === ticketId);
  if (!ticket) return { error: 'Support ticket not found.' };
  const text = safeString(note, 800);
  if (!text) return { error: 'Note cannot be empty.' };
  ticket.notes.push({
    noteId: crypto.randomUUID(),
    adminId: admin.adminId,
    adminName: admin.displayName,
    text,
    createdAt: now(),
  });
  ticket.updatedAt = now();
  return { ticket: publicTicket(ticket) };
}

export function adminEconomySummary(users) {
  const allUsers = [...users.values()];
  return {
    users: allUsers.length,
    totalCoins: allUsers.reduce((sum, user) => sum + (user.currency?.coins || 0), 0),
    totalLifetimeCoins: allUsers.reduce((sum, user) => sum + (user.currency?.lifetimeCoins || 0), 0),
    catalog: publicEconomyCatalog(),
  };
}

export function adminMetrics(users, rooms, clubs, supportTickets) {
  return {
    users: users.size,
    activeRooms: rooms.size,
    clubs: clubs.size,
    openTickets: supportTickets.filter(ticket => ticket.status !== 'resolved' && ticket.status !== 'closed').length,
    onlineUsers: null,
  };
}

export function adminCosmeticCatalogFor(user, rankedSeason, catalog = undefined, competitiveConfig = null) {
  return publicCosmeticCatalog(user, rankedSeason, catalog, competitiveConfig);
}

export function publicAdminState(store) {
  normalizeAdminStore(store);
  return {
    admins: store.admins.map(publicAdmin),
    auditCount: store.adminAudit.length,
    supportTicketCount: store.supportTickets.length,
  };
}

export function setAdminCookie(res, token) {
  res.setHeader('Set-Cookie', `golf9_admin=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/admin; Max-Age=${Math.floor(ADMIN_SESSION_TTL_MS / 1000)}`);
}

export function clearAdminCookie(res) {
  res.setHeader('Set-Cookie', 'golf9_admin=; HttpOnly; SameSite=Strict; Path=/admin; Max-Age=0');
}

export { hashPassword as hashAdminPassword, hashValue as hashAdminValue, publicAdmin };
