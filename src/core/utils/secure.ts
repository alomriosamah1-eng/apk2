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

/** Converts a Uint8Array to a hex string. */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Generates a cryptographically random salt string (32 hex chars). */
export async function generateSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return bytesToHex(bytes);
}

/** Hashes a PIN with the given salt using iterative SHA-256 (PBKDF2-like). */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const iterations = 10000;
  let hash = pin + salt;
  for (let i = 0; i < iterations; i++) {
    hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, hash);
  }
  return hash;
}
