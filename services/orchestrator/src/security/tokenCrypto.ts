/**
 * Token Encryption/Decryption - Task 151
 *
 * AES-256-GCM encryption for OAuth tokens stored in database.
 * Never stores tokens in plaintext.
 */

import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Get encryption key from environment
 * Key should be 32 bytes (256 bits) base64 encoded
 */
function getEncryptionKey(): Buffer {
  const keyBase64 = process.env.OAUTH_TOKEN_ENC_KEY;
  if (!keyBase64) {
    throw new Error(
      'OAUTH_TOKEN_ENC_KEY environment variable is required for token encryption'
    );
  }

  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) {
    throw new Error(
      `OAUTH_TOKEN_ENC_KEY must be 32 bytes (256 bits), got ${key.length} bytes`
    );
  }

  return key;
}

/**
 * Encrypt an object to base64 string using AES-256-GCM
 *
 * Format: base64(iv || authTag || ciphertext)
 */
export function encryptJson<T>(obj: T, key?: Buffer): string {
  const encKey = key ?? getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGO, encKey, iv);
  const plaintext = Buffer.from(JSON.stringify(obj), 'utf8');

  const ciphertext = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  // Combine: iv (12 bytes) || tag (16 bytes) || ciphertext
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

/**
 * Decrypt a base64 string to object using AES-256-GCM
 */
export function decryptJson<T>(b64: string, key?: Buffer): T {
  const encKey = key ?? getEncryptionKey();
  const raw = Buffer.from(b64, 'base64');

  if (raw.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error('Invalid encrypted data: too short');
  }

  const iv = raw.subarray(0, IV_LENGTH);
  const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGO, encKey, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return JSON.parse(plaintext.toString('utf8')) as T;
}

/**
 * Generate a new encryption key (for initial setup)
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('base64');
}

/**
 * Rotate encryption - re-encrypt with new key
 */
export function rotateEncryption<T>(
  encryptedB64: string,
  oldKey: Buffer,
  newKey: Buffer
): string {
  const decrypted = decryptJson<T>(encryptedB64, oldKey);
  return encryptJson(decrypted, newKey);
}

/**
 * Verify encryption key is valid (basic sanity check)
 */
export function verifyEncryptionKey(key?: Buffer): boolean {
  try {
    const encKey = key ?? getEncryptionKey();
    const testData = { test: 'verification', timestamp: Date.now() };
    const encrypted = encryptJson(testData, encKey);
    const decrypted = decryptJson<typeof testData>(encrypted, encKey);
    return decrypted.test === 'verification';
  } catch {
    return false;
  }
}

export default {
  encryptJson,
  decryptJson,
  generateEncryptionKey,
  rotateEncryption,
  verifyEncryptionKey,
};
