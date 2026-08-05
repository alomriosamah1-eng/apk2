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
  const plainBytes = base64ToUint8Array(base64Data);
  const cipher = await encryptBytes(keyHex, plainBytes);
  return uint8ArrayToBase64(cipher);
}

/**
 * Encrypts raw bytes with AES-256-GCM without any base64 round-trip.
 * Layout: [version 1][IV 12][TAG 16][ciphertext].
 * This is the fast path for large media/files.
 */
export async function encryptBytes(keyHex: string, plainBytes: Uint8Array): Promise<Uint8Array> {
  const key = hexToBytes(keyHex);
  const iv = await Crypto.getRandomBytesAsync(IV_LENGTH);
  const aes = gcm(key, iv);
  const cipherAndTag = aes.encrypt(plainBytes);

  const output = new Uint8Array(1 + IV_LENGTH + cipherAndTag.length);
  output[0] = FORMAT_VERSION;
  output.set(iv, 1);
  output.set(cipherAndTag, 1 + IV_LENGTH);
  return output;
}

/**
 * Decrypts a versioned AES-256-GCM binary payload.
 * Falls back to the legacy V0 reader for old data.
 * Throws {@link CryptoError}; never returns an empty placeholder.
 */
export async function decryptFile(keyHex: string, encryptedBase64: string): Promise<string> {
  const encrypted = base64ToUint8Array(encryptedBase64);
  const plain = await decryptBytes(keyHex, encrypted);
  return uint8ArrayToBase64(plain);
}

/**
 * Decrypts raw encrypted bytes without any base64 round-trip. Fast path for
 * large media/files. Falls back to the legacy V0 reader for old payloads.
 */
export async function decryptBytes(keyHex: string, encrypted: Uint8Array): Promise<Uint8Array> {
  if (encrypted.length === 0) {
    throw new CryptoError(CryptoErrorCode.BAD_FORMAT, 'Empty ciphertext');
  }
  if (!isCurrentFormat(encrypted)) {
    const legacy = await decryptLegacyFileBytes(keyHex, encrypted);
    return legacy;
  }
  const key = hexToBytes(keyHex);
  const iv = encrypted.slice(1, 1 + IV_LENGTH);
  const cipherAndTag = encrypted.slice(1 + IV_LENGTH);
  if (cipherAndTag.length < TAG_LENGTH) {
    throw new CryptoError(CryptoErrorCode.BAD_FORMAT, 'Ciphertext too short');
  }
  try {
    const aes = gcm(key, iv);
    return aes.decrypt(cipherAndTag);
  } catch {
    throw new CryptoError(CryptoErrorCode.TAMPER, 'Authentication failed: data has been tampered with');
  }
}

/** Legacy V0 binary reader (migration-only). Returns raw plaintext bytes. */
async function decryptLegacyFileBytes(keyHex: string, encrypted: Uint8Array): Promise<Uint8Array> {
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
    return plaintext;
  } catch (error) {
    if (error instanceof CryptoError) throw error;
    throw new CryptoError(CryptoErrorCode.UNSUPPORTED_VERSION, 'Legacy payload could not be decrypted');
  }
}

// ============================================================================
// Streaming (chunked) AES-256-GCM — format v2
// ----------------------------------------------------------------------------
// The whole-message format above holds one plaintext + one ciphertext of the
// ENTIRE file in memory (O(file)), which OOMs on large videos. v2 splits the
// plaintext into fixed chunks, each authenticated independently by GCM, so peak
// memory is O(chunkSize) regardless of file size. Each chunk derives a unique
// 12-byte IV from a random 8-byte file nonce + a 4-byte counter (guaranteed
// uniqueness per file => GCM nonce-safety).
//
// Layout:
//   [0x02][nonce:8][chunkLen:u32be]
//   then, per chunk i in 0..count-1:
//     ciphertext+tag  (len = plainLen[i] + 16; plainLen[i] = chunkLen, last = remainder)
//
// The last chunk is recognised by reading fewer bytes than chunkLen+16, so the
// writer never needs to know the file size in advance (single-pass streaming).
// Backward compatible: the version byte distinguishes v1 (whole-message) from
// v2 (chunked). chunkLen is a u32, so the chunked format targets files
// < 4 GiB (more than enough for on-device media).
// ============================================================================

const STREAM_VERSION = 0x02;
/** Header: version(1) + nonce(8) + chunkLen(4) = 13 bytes. */
export const STREAM_HEADER_LENGTH = 13;
/** Default plaintext chunk size (4 MiB) — the bound on peak memory per file. */
export const STREAM_CHUNK_LENGTH = 4 * 1024 * 1024;

export interface StreamHeader {
  baseNonce: Uint8Array;
  chunkLength: number;
}

/** 4-byte big-endian counter encoding. */
function u32beBytes(value: number): Uint8Array {
  return new Uint8Array([(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]);
}

function u32beFrom(b: Uint8Array, o: number): number {
  return ((b[o] as number) << 24) | ((b[o + 1] as number) << 16) | ((b[o + 2] as number) << 8) | (b[o + 3] as number);
}

/** Serializes the fixed v2 header that precedes the chunk payloads. */
export function buildStreamHeader(baseNonce: Uint8Array, chunkLength: number): Uint8Array {
  const h = new Uint8Array(STREAM_HEADER_LENGTH);
  h[0] = STREAM_VERSION;
  h.set(baseNonce, 1);
  h.set(u32beBytes(chunkLength), 9);
  return h;
}

/** Parses the v2 header. Returns null when the buffer is not the chunked format. */
export function readStreamHeader(head: Uint8Array): StreamHeader | null {
  if (head.length < STREAM_HEADER_LENGTH || head[0] !== STREAM_VERSION) return null;
  return {
    baseNonce: head.slice(1, 9),
    chunkLength: u32beFrom(head, 9),
  };
}

/** True when the buffer's first byte marks the chunked (v2) format. */
export function isStreamFormat(encrypted: Uint8Array): boolean {
  return encrypted.length > 0 && encrypted[0] === STREAM_VERSION;
}

/** Builds the deterministic per-chunk IV: [fileNonce(8)][counter(4)]. */
export function streamChunkIv(baseNonce: Uint8Array, index: number): Uint8Array {
  const iv = new Uint8Array(12);
  iv.set(baseNonce, 0);
  iv.set(u32beBytes(index), 8);
  return iv;
}

/**
 * Encrypts a single chunk (plaintext <= chunkLength). GCM appends a 16-byte
 * authentication tag to the ciphertext, so the returned length is plain.length
 * + 16. Synchronous: the per-chunk IV is derived, not random.
 */
export function encryptStreamChunk(keyHex: string, baseNonce: Uint8Array, index: number, plain: Uint8Array): Uint8Array {
  const key = hexToBytes(keyHex);
  const iv = streamChunkIv(baseNonce, index);
  return gcm(key, iv).encrypt(plain);
}

/**
 * Decrypts a single chunk's ciphertext+tag produced by {@link encryptStreamChunk}.
 * Throws a typed {@link CryptoError} on authentication failure (tamper).
 */
export function decryptStreamChunk(keyHex: string, baseNonce: Uint8Array, index: number, cipherAndTag: Uint8Array): Uint8Array {
  const key = hexToBytes(keyHex);
  const iv = streamChunkIv(baseNonce, index);
  try {
    return gcm(key, iv).decrypt(cipherAndTag);
  } catch {
    throw new CryptoError(CryptoErrorCode.TAMPER, 'Stream chunk authentication failed');
  }
}

/** Re-exported so callers may import the typed crypto error from one place. */
export { CryptoError, CryptoErrorCode };
