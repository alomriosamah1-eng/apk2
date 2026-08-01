import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';

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

import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';

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

/** PBKDF2-HMAC-SHA256 iterations used for PIN hashing (Recovery/05 §5.1). */
export const PIN_KDF_ITERATIONS = 100000;

/**
 * Hashes a PIN with the given salt using PBKDF2-HMAC-SHA256.
 * Returns a 64-char hex digest.
 */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const digest = pbkdf2(sha256, new TextEncoder().encode(pin), hexToBytes(salt), {
    c: PIN_KDF_ITERATIONS,
    dkLen: 32,
  });
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
 * Supports the current PBKDF2 format and the legacy chain for migration.
 * Returns `{ verified: boolean, legacy: boolean }`; when `legacy` is true the
 * caller should re-store the current PBKDF2 hash (Recovery/14 §4).
 */
export async function verifyPin(
  pin: string,
  salt: string,
  storedHash: string,
): Promise<{ verified: boolean; legacy: boolean }> {
  const current = await hashPin(pin, salt);
  if (constantTimeEqual(current, storedHash)) {
    return { verified: true, legacy: false };
  }
  const legacy = await hashPinLegacy(pin, salt);
  if (constantTimeEqual(legacy, storedHash)) {
    return { verified: true, legacy: true };
  }
  return { verified: false, legacy: false };
}
