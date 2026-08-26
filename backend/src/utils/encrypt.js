/**
 * AES-256-GCM helpers for encrypting tenant OAuth client secrets at rest.
 * Stored format: base64(iv) . base64(authTag) . base64(ciphertext)
 */
const crypto = require('crypto');

const ALGO = 'aes-256-gcm';

function getKey() {
  const hex = process.env.TENANT_SECRET_ENC_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      'TENANT_SECRET_ENC_KEY must be a 64-character hex string (32 bytes) in .env'
    );
  }
  return Buffer.from(hex, 'hex');
}

function encrypt(plainText) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join('.');
}

function decrypt(payload) {
  const key = getKey();
  const [ivB64, tagB64, dataB64] = payload.split('.');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

/** Returns a masked preview like "••••••ab12" for display, never the real secret. */
function mask(plainText) {
  if (!plainText || plainText.length < 4) return '••••';
  return `••••${plainText.slice(-4)}`;
}

module.exports = { encrypt, decrypt, mask };
