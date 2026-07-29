import * as Crypto from 'expo-crypto';
import { APP_CONFIG } from '@core/constants';

const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] as number;
    hex += b.toString(16).padStart(2, '0');
  }
  return hex;
}

function bytesToString(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    result += String.fromCharCode(bytes[i] as number);
  }
  return result;
}

function stringToBytes(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i] as number;
    const b2 = i + 1 < bytes.length ? (bytes[i + 1] as number) : 0;
    const b3 = i + 2 < bytes.length ? (bytes[i + 2] as number) : 0;
    result += chars[b1 >> 2];
    result += chars[((b1 & 3) << 4) | (b2 >> 4)];
    result += i + 1 < bytes.length ? chars[((b2 & 15) << 2) | (b3 >> 6)] : '=';
    result += i + 2 < bytes.length ? chars[b3 & 63] : '=';
  }
  return result;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const cleaned = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = (cleaned.length * 3) / 4 - (cleaned.endsWith('==') ? 2 : cleaned.endsWith('=') ? 1 : 0);
  const bytes = new Uint8Array(len);
  let p = 0;
  for (let i = 0; i < cleaned.length; i += 4) {
    const c1 = chars.indexOf(cleaned[i] as string);
    const c2 = chars.indexOf(cleaned[i + 1] as string);
    const c3 = chars.indexOf(cleaned[i + 2] as string);
    const c4 = chars.indexOf(cleaned[i + 3] as string);
    bytes[p++] = (c1 << 2) | (c2 >> 4);
    if (c3 >= 0) bytes[p++] = ((c2 & 15) << 4) | (c3 >> 2);
    if (c4 >= 0) bytes[p++] = ((c3 & 3) << 6) | c4;
  }
  return bytes;
}

function xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const len = Math.min(a.length, b.length);
  const result = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    result[i] = (a[i] as number) ^ (b[i] as number);
  }
  return result;
}

async function deriveStream(keyHex: string, iv: Uint8Array, length: number): Promise<Uint8Array> {
  const stream = new Uint8Array(length);
  const keyBytes = hexToBytes(keyHex);
  let offset = 0;
  let counter = 0;

  while (offset < length) {
    const counterBytes = new Uint8Array(4);
    counterBytes[0] = (counter >> 24) & 0xFF;
    counterBytes[1] = (counter >> 16) & 0xFF;
    counterBytes[2] = (counter >> 8) & 0xFF;
    counterBytes[3] = counter & 0xFF;

    const combined = new Uint8Array(keyBytes.length + iv.length + counterBytes.length);
    combined.set(keyBytes, 0);
    combined.set(iv, keyBytes.length);
    combined.set(counterBytes, keyBytes.length + iv.length);

    const hexInput = bytesToHex(combined);
    const blockHex = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, hexInput);
    const block = hexToBytes(blockHex);

    const remaining = length - offset;
    const chunkSize = Math.min(block.length, remaining);
    for (let i = 0; i < chunkSize; i++) {
      stream[offset + i] = block[i] as number;
    }
    offset += chunkSize;
    counter++;
  }

  return stream;
}

export async function generateEncryptionKey(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(KEY_LENGTH);
  return bytesToHex(bytes);
}

export async function generateSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(SALT_LENGTH);
  return bytesToHex(bytes);
}

export async function deriveKeyFromPin(pin: string, salt: string): Promise<string> {
  const iterations = Math.min(APP_CONFIG.security.pbkdf2Iterations, 10000);
  let key = pin + salt;
  for (let i = 0; i < iterations; i++) {
    key = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, key);
  }
  return key;
}

export async function encryptData(keyHex: string, plaintext: string): Promise<string> {
  const iv = await Crypto.getRandomBytesAsync(IV_LENGTH);
  const plainBytes = stringToBytes(plaintext);
  const keyStream = await deriveStream(keyHex, iv, plainBytes.length);
  const ciphertext = xorBytes(plainBytes, keyStream);

  const combined = new Uint8Array(IV_LENGTH + ciphertext.length);
  combined.set(iv, 0);
  combined.set(ciphertext, IV_LENGTH);
  return bytesToHex(combined);
}

export async function decryptData(keyHex: string, encryptedHex: string): Promise<string> {
  const encrypted = hexToBytes(encryptedHex);
  if (encrypted.length < IV_LENGTH) return '';
  const iv = encrypted.slice(0, IV_LENGTH);
  const ciphertext = encrypted.slice(IV_LENGTH);
  const keyStream = await deriveStream(keyHex, iv, ciphertext.length);
  const plainBytes = xorBytes(ciphertext, keyStream);
  return bytesToString(plainBytes);
}

export async function encryptObject<T>(keyHex: string, obj: T): Promise<string> {
  return encryptData(keyHex, JSON.stringify(obj));
}

export async function decryptObject<T>(keyHex: string, encryptedHex: string): Promise<T> {
  const decrypted = await decryptData(keyHex, encryptedHex);
  return JSON.parse(decrypted) as T;
}

export async function encryptFile(keyHex: string, base64Data: string): Promise<string> {
  const fileBytes = base64ToUint8Array(base64Data);
  const iv = await Crypto.getRandomBytesAsync(IV_LENGTH);
  const keyStream = await deriveStream(keyHex, iv, fileBytes.length);
  const ciphertext = xorBytes(fileBytes, keyStream);
  const combined = new Uint8Array(IV_LENGTH + ciphertext.length);
  combined.set(iv, 0);
  combined.set(ciphertext, IV_LENGTH);
  return uint8ArrayToBase64(combined);
}

export async function decryptFile(keyHex: string, encryptedBase64: string): Promise<string> {
  const combined = base64ToUint8Array(encryptedBase64);
  if (combined.length < IV_LENGTH) return '';
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);
  const keyStream = await deriveStream(keyHex, iv, ciphertext.length);
  const plainBytes = xorBytes(ciphertext, keyStream);
  return uint8ArrayToBase64(plainBytes);
}
