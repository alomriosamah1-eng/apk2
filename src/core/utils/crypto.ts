import * as Crypto from 'expo-crypto';
import { gcm } from '@noble/ciphers/aes';
import { CryptoError, CryptoErrorCode } from '@core/errors';

const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;
/** On-disk/DB format version byte (migration-safe). See Recovery/14. */
const FORMAT_VERSION = 1;

/**
 * Old V0 payloads (XOR-keystream from the legacy build) have no version byte;
 * their first byte is an IV byte. New payloads carry FORMAT_VERSION as byte 0.
 * Detection is heuristic: only version byte 1 is the AES-256-GCM format.
 */
function isCurrentFormat(encrypted: Uint8Array): boolean {
  return encrypted.length > 0 && encrypted[0] === FORMAT_VERSION;
}

function hexToBytes(hex: string): Uint8Array {
  const len = hex.length / 2;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++)
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Reads a Uint8Array from a base64 string. */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Encodes a Uint8Array as a base64 string. */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

/** Generates a new random 256-bit encryption key as a hex string. */
export async function generateEncryptionKey(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(KEY_LENGTH);
  return bytesToHex(bytes);
}

/** Generates a random salt as a hex string. */
export async function generateSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(SALT_LENGTH);
  return bytesToHex(bytes);
}

/**
 * Encrypts a UTF-8 string with AES-256-GCM.
 * Layout: [version 1][IV 12][TAG 16][ciphertext], hex-encoded.
 * Throws {@link CryptoError} on any failure.
 */
export async function encryptData(keyHex: string, plaintext: string): Promise<string> {
  const key = hexToBytes(keyHex);
  const iv = await Crypto.getRandomBytesAsync(IV_LENGTH);
  const plainBytes = new TextEncoder().encode(plaintext);
  const aes = gcm(key, iv);
  const cipherAndTag = aes.encrypt(plainBytes);

  const output = new Uint8Array(1 + IV_LENGTH + cipherAndTag.length);
  output[0] = FORMAT_VERSION;
  output.set(iv, 1);
  output.set(cipherAndTag, 1 + IV_LENGTH);
  return bytesToHex(output);
}

/**
 * Decrypts a versioned AES-256-GCM payload.
 * Falls back to the legacy V0 reader for old data (migration path).
 * Throws a typed {@link CryptoError}; never returns a placeholder.
 */
export async function decryptData(keyHex: string, encryptedHex: string): Promise<string> {
  const encrypted = hexToBytes(encryptedHex);
  if (encrypted.length === 0) {
    throw new CryptoError(CryptoErrorCode.BAD_FORMAT, 'Empty ciphertext');
  }
  if (!isCurrentFormat(encrypted)) {
    return decryptLegacyData(keyHex, encrypted);
  }
  const key = hexToBytes(keyHex);
  const iv = encrypted.slice(1, 1 + IV_LENGTH);
  const cipherAndTag = encrypted.slice(1 + IV_LENGTH);
  if (cipherAndTag.length < TAG_LENGTH) {
    throw new CryptoError(CryptoErrorCode.BAD_FORMAT, 'Ciphertext too short');
  }
  try {
    const aes = gcm(key, iv);
    const plainBytes = aes.decrypt(cipherAndTag);
    return new TextDecoder().decode(plainBytes);
  } catch {
    throw new CryptoError(CryptoErrorCode.TAMPER, 'Authentication failed: data has been tampered with');
  }
}

/** Legacy V0 reader (pre-release XOR-keystream format). Migration-only; do not use for new writes. */
async function decryptLegacyData(keyHex: string, encrypted: Uint8Array): Promise<string> {
  try {
    const key = hexToBytes(keyHex);
    if (encrypted.length < IV_LENGTH + TAG_LENGTH) {
      throw new CryptoError(CryptoErrorCode.BAD_FORMAT, 'Ciphertext too short');
    }
    const iv = encrypted.slice(0, IV_LENGTH);
    const tag = encrypted.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = encrypted.slice(IV_LENGTH + TAG_LENGTH);

    const authInput = bytesToHex(iv) + bytesToHex(ciphertext);
    const expectedTagHex = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      authInput + keyHex,
    );
    const expectedTag = hexToBytes(expectedTagHex).slice(0, TAG_LENGTH);
    let tagMatch = true;
    for (let i = 0; i < TAG_LENGTH; i++) {
      if (tag[i] !== expectedTag[i]) tagMatch = false;
    }
    if (!tagMatch) {
      throw new CryptoError(CryptoErrorCode.TAMPER, 'Authentication failed: data has been tampered with');
    }

    const keyStream = new Uint8Array(ciphertext.length);
    for (let i = 0; i < ciphertext.length; i += 32) {
      const counter = new Uint8Array(4);
      counter[0] = (i / 32) >> 24;
      counter[1] = (i / 32) >> 16;
      counter[2] = (i / 32) >> 8;
      counter[3] = (i / 32);
      const combined = new Uint8Array(key.length + iv.length + counter.length);
      combined.set(key);
      combined.set(iv, key.length);
      combined.set(counter, key.length + iv.length);
      const blockHex = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        bytesToHex(combined),
      );
      const block = hexToBytes(blockHex);
      const remaining = Math.min(32, ciphertext.length - i);
      keyStream.set(block.slice(0, remaining), i);
    }

    const plaintext = new Uint8Array(ciphertext.length);
    for (let i = 0; i < ciphertext.length; i++) {
      plaintext[i] = ciphertext[i]! ^ keyStream[i]!;
    }
    return new TextDecoder().decode(plaintext);
  } catch (error) {
    if (error instanceof CryptoError) throw error;
    throw new CryptoError(CryptoErrorCode.UNSUPPORTED_VERSION, 'Legacy payload could not be decrypted');
  }
}

/** Encrypts a JSON-serializable object and returns the hex ciphertext. */
export async function encryptObject<T>(keyHex: string, obj: T): Promise<string> {
  return encryptData(keyHex, JSON.stringify(obj));
}

/** Decrypts a JSON object payload. Throws {@link CryptoError} on failure. */
export async function decryptObject<T>(keyHex: string, encryptedHex: string): Promise<T> {
  const decrypted = await decryptData(keyHex, encryptedHex);
  return JSON.parse(decrypted) as T;
}

/**
 * Encrypts a base64-encoded binary blob with AES-256-GCM.
 * Layout: [version 1][IV 12][TAG 16][ciphertext], base64-encoded.
 */
export async function encryptFile(keyHex: string, base64Data: string): Promise<string> {
  const key = hexToBytes(keyHex);
  const iv = await Crypto.getRandomBytesAsync(IV_LENGTH);
  const plainBytes = base64ToUint8Array(base64Data);
  const aes = gcm(key, iv);
  const cipherAndTag = aes.encrypt(plainBytes);

  const output = new Uint8Array(1 + IV_LENGTH + cipherAndTag.length);
  output[0] = FORMAT_VERSION;
  output.set(iv, 1);
  output.set(cipherAndTag, 1 + IV_LENGTH);
  return uint8ArrayToBase64(output);
}

/**
 * Decrypts a versioned AES-256-GCM binary payload.
 * Falls back to the legacy V0 reader for old data.
 * Throws {@link CryptoError}; never returns an empty placeholder.
 */
export async function decryptFile(keyHex: string, encryptedBase64: string): Promise<string> {
  const encrypted = base64ToUint8Array(encryptedBase64);
  if (encrypted.length === 0) {
    throw new CryptoError(CryptoErrorCode.BAD_FORMAT, 'Empty ciphertext');
  }
  if (!isCurrentFormat(encrypted)) {
    return decryptLegacyFile(keyHex, encrypted);
  }
  const key = hexToBytes(keyHex);
  const iv = encrypted.slice(1, 1 + IV_LENGTH);
  const cipherAndTag = encrypted.slice(1 + IV_LENGTH);
  if (cipherAndTag.length < TAG_LENGTH) {
    throw new CryptoError(CryptoErrorCode.BAD_FORMAT, 'Ciphertext too short');
  }
  try {
    const aes = gcm(key, iv);
    const plainBytes = aes.decrypt(cipherAndTag);
    return uint8ArrayToBase64(plainBytes);
  } catch {
    throw new CryptoError(CryptoErrorCode.TAMPER, 'Authentication failed: data has been tampered with');
  }
}

/** Legacy V0 binary reader (migration-only). */
async function decryptLegacyFile(keyHex: string, encrypted: Uint8Array): Promise<string> {
  try {
    if (encrypted.length < IV_LENGTH + TAG_LENGTH) {
      throw new CryptoError(CryptoErrorCode.BAD_FORMAT, 'Ciphertext too short');
    }
    const iv = encrypted.slice(0, IV_LENGTH);
    const tag = encrypted.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = encrypted.slice(IV_LENGTH + TAG_LENGTH);
    const key = hexToBytes(keyHex);

    const authInput = bytesToHex(iv) + bytesToHex(ciphertext);
    const expectedTagHex = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      authInput + keyHex,
    );
    const expectedTag = hexToBytes(expectedTagHex).slice(0, TAG_LENGTH);
    let tagMatch = true;
    for (let i = 0; i < TAG_LENGTH; i++) {
      if (tag[i] !== expectedTag[i]) tagMatch = false;
    }
    if (!tagMatch) throw new CryptoError(CryptoErrorCode.TAMPER, 'Tampered data');

    const keyStream = new Uint8Array(ciphertext.length);
    for (let i = 0; i < ciphertext.length; i += 32) {
      const counter = new Uint8Array(4);
      counter[0] = (i / 32) >> 24;
      counter[1] = (i / 32) >> 16;
      counter[2] = (i / 32) >> 8;
      counter[3] = (i / 32);
      const combined = new Uint8Array(key.length + iv.length + counter.length);
      combined.set(key);
      combined.set(iv, key.length);
      combined.set(counter, key.length + iv.length);
      const blockHex = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        bytesToHex(combined),
      );
      const block = hexToBytes(blockHex);
      const remaining = Math.min(32, ciphertext.length - i);
      keyStream.set(block.slice(0, remaining), i);
    }

    const plaintext = new Uint8Array(ciphertext.length);
    for (let i = 0; i < ciphertext.length; i++) {
      plaintext[i] = ciphertext[i]! ^ keyStream[i]!;
    }
    return uint8ArrayToBase64(plaintext);
  } catch (error) {
    if (error instanceof CryptoError) throw error;
    throw new CryptoError(CryptoErrorCode.UNSUPPORTED_VERSION, 'Legacy payload could not be decrypted');
  }
}

/** Re-exported so callers may import the typed crypto error from one place. */
export { CryptoError, CryptoErrorCode };
