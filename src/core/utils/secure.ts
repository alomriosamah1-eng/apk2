import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';

/** Checks if the current platform is Android. */
export function isAndroid(): boolean {
  return Platform.OS === 'android';
}

/** Checks if the app is running in development mode. */
export function isDev(): boolean {
  return __DEV__;
}

/** Returns a promise that resolves after the given number of milliseconds. */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Clamps a number between a minimum and maximum value. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Creates a debounced version of the provided function. */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  waitMs: number,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), waitMs);
  };
}

/** Converts a Uint8Array to a hex string. */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Converts a hex string to a Uint8Array. */
function hexToBytes(hex: string): Uint8Array {
  const len = hex.length / 2;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++)
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  return bytes;
}

/** Generates a cryptographically random salt string (32 hex chars). */
export async function generateSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return bytesToHex(bytes);
}

/**
 * PBKDF2-HMAC-SHA256 iterations used for NEW PIN hashes.
 *
 * Reduced from 100,000 → 30,000 for a mobile-friendly balance (Forensic_Report
 * /07 P-2). The pre-format PBKDF2 used 100,000; stored hashes from that era are
 * still verified via {@link LEGACY_PIN_KDF_ITERATIONS} and upgraded on login.
 */
export const PIN_KDF_ITERATIONS = 30000;

/** Iterations used to verify pre-format PBKDF2 vault hashes (no `v2:` prefix). */
export const LEGACY_PIN_KDF_ITERATIONS = 100000;

/** Iterations per chunk before yielding to the JS event loop (keeps UI alive). */
const PBKDF2_CHUNK = 2000;

/**
 * Async PBKDF2-HMAC-SHA256. Yields to the event loop every {@link PBKDF2_CHUNK}
 * iterations so the React Native JS thread never freezes while hashing a PIN
 * (Forensic_Report /07 P-2). Matches @noble/hashes pbkdf2 output byte-for-byte.
 */
async function pbkdf2Async(
  pin: string,
  salt: Uint8Array,
  iterations: number,
  dkLen: number,
): Promise<Uint8Array> {
  const password = new TextEncoder().encode(pin);
  const blockSize = 32; // sha256 output size
  const numBlocks = Math.ceil(dkLen / blockSize);
  const out = new Uint8Array(numBlocks * blockSize);

  for (let block = 1; block <= numBlocks; block++) {
    const blockInput = new Uint8Array(salt.length + 4);
    blockInput.set(salt);
    blockInput[salt.length + 3] = block;

    let u = hmac(sha256, password, blockInput);
    const t = u.slice();
    for (let i = 1; i < iterations; i++) {
      u = hmac(sha256, password, u);
      for (let j = 0; j < blockSize; j++) t[j]! ^= u[j]!;
      if (i % PBKDF2_CHUNK === 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }
    out.set(t, (block - 1) * blockSize);
  }

  return out.slice(0, dkLen);
}

/**
 * Hashes a PIN with the given salt using PBKDF2-HMAC-SHA256.
 * Returns a versioned hash `v2:<iterations>:<hex>`, so future iteration-count
 * changes never orphan existing vaults.
 */
export async function hashPin(
  pin: string,
  salt: string,
  iterations: number = PIN_KDF_ITERATIONS,
): Promise<string> {
  const digest = await pbkdf2Async(pin, hexToBytes(salt), iterations, 32);
  return `v2:${iterations}:${bytesToHex(digest)}`;
}

/** Raw pre-format PBKDF2 digest (64 hex chars, no version prefix). */
async function hashPinLegacyPBKDF2(pin: string, salt: string): Promise<string> {
  const digest = await pbkdf2Async(pin, hexToBytes(salt), LEGACY_PIN_KDF_ITERATIONS, 32);
  return bytesToHex(digest);
}

/** Legacy PIN hash (pre-release iterative SHA-256 chain). Migration-only; used to upgrade old vaults. */
export async function hashPinLegacy(pin: string, salt: string): Promise<string> {
  const iterations = 100000;
  let hash = pin + salt;
  for (let i = 0; i < iterations; i++) {
    hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      hash + pin + salt,
    );
  }
  return hash;
}

/** Compares two hex digests in constant time to prevent timing attacks. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i]! ^ bBytes[i]!;
  }
  return diff === 0;
}

/**
 * Verifies a PIN against a stored hash.
 *
 * Accepts three formats:
 *  1. `v2:<iterations>:<hex>` — current PBKDF2 format (self-describing).
 *  2. Plain 64-char hex — pre-format PBKDF2 at {@link LEGACY_PIN_KDF_ITERATIONS}.
 *  3. Any other string — legacy iterative SHA-256 chain (pre-release migration).
 *
 * Returns `{ verified: boolean, legacy: boolean }`; when `legacy` is true the
 * caller should re-store the current PBKDF2 hash (Recovery/14 §4, /05 §5.1).
 */
export async function verifyPin(
  pin: string,
  salt: string,
  storedHash: string,
): Promise<{ verified: boolean; legacy: boolean }> {
  if (storedHash.startsWith('v2:')) {
    const parts = storedHash.split(':');
    if (parts.length !== 3) return { verified: false, legacy: false };
    const iterations = Number(parts[1]);
    const expected = parts[2]!;
    if (!Number.isInteger(iterations) || iterations <= 0) {
      return { verified: false, legacy: false };
    }
    const current = await pbkdf2Async(pin, hexToBytes(salt), iterations, 32);
    if (constantTimeEqual(bytesToHex(current), expected)) {
      return { verified: true, legacy: false };
    }
    return { verified: false, legacy: false };
  }

  if (storedHash.length === 64 && /^[0-9a-f]+$/.test(storedHash)) {
    const legacy = await hashPinLegacyPBKDF2(pin, salt);
    if (constantTimeEqual(legacy, storedHash)) {
      return { verified: true, legacy: true };
    }
  }

  const chain = await hashPinLegacy(pin, salt);
  if (constantTimeEqual(chain, storedHash)) {
    return { verified: true, legacy: true };
  }
  return { verified: false, legacy: false };
}
