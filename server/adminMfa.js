import crypto from 'crypto';
import QRCode from 'qrcode';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const LOCAL_ENCRYPTION_KEY = 'nine-below-local-admin-mfa-development-key';

function encryptionKey(env = process.env) {
  const configured = String(env.ADMIN_MFA_ENCRYPTION_KEY || '').trim();
  if (!configured && env.NODE_ENV === 'production') {
    throw new Error('ADMIN_MFA_ENCRYPTION_KEY is required for authenticator MFA in production.');
  }
  return crypto.createHash('sha256').update(configured || LOCAL_ENCRYPTION_KEY).digest();
}

function encodeBase32(buffer) {
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
  let output = '';
  for (let index = 0; index < bits.length; index += 5) {
    output += BASE32_ALPHABET[Number.parseInt(bits.slice(index, index + 5).padEnd(5, '0'), 2)];
  }
  return output;
}

function decodeBase32(value) {
  const normalized = String(value || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw new Error('Invalid authenticator secret.');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function counterBuffer(counter) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  return buffer;
}

export function generateTotpSecret() {
  return encodeBase32(crypto.randomBytes(20));
}

export function generateTotp(secret, options = {}) {
  const time = Number(options.time ?? Date.now());
  const stepSeconds = Number(options.stepSeconds || TOTP_STEP_SECONDS);
  const counter = Math.floor(time / 1000 / stepSeconds);
  const digest = crypto.createHmac('sha1', decodeBase32(secret)).update(counterBuffer(counter)).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % (10 ** TOTP_DIGITS);
  return String(value).padStart(TOTP_DIGITS, '0');
}

export function verifyTotp(secret, code, options = {}) {
  const normalized = String(code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;
  const time = Number(options.time ?? Date.now());
  const window = Math.max(0, Number(options.window ?? 1));
  for (let offset = -window; offset <= window; offset += 1) {
    const candidate = generateTotp(secret, { time: time + (offset * TOTP_STEP_SECONDS * 1000) });
    if (crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(normalized))) return true;
  }
  return false;
}

export function buildTotpUri({ secret, accountName, issuer = 'Nine Below Admin' }) {
  const label = `${issuer}:${String(accountName || 'Admin')}`;
  const query = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${query.toString()}`;
}

export async function totpQrDataUrl(uri) {
  return QRCode.toDataURL(uri, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 320,
    color: {
      dark: '#071422',
      light: '#ffffff',
    },
  });
}

export function encryptMfaSecret(secret, env = process.env) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(env), iv);
  const encrypted = Buffer.concat([cipher.update(String(secret), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptMfaSecret(payload, env = process.env) {
  const [version, ivValue, tagValue, encryptedValue] = String(payload || '').split('.');
  if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) {
    throw new Error('Invalid encrypted authenticator secret.');
  }
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    encryptionKey(env),
    Buffer.from(ivValue, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function generateRecoveryCodes(count = 10) {
  return Array.from({ length: count }, () => {
    const value = crypto.randomBytes(6).toString('hex').toUpperCase();
    return `${value.slice(0, 6)}-${value.slice(6)}`;
  });
}

export function normalizeRecoveryCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}
