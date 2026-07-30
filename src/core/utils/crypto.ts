import * as Crypto from 'expo-crypto';

const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;

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

export async function generateEncryptionKey(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(KEY_LENGTH);
  return bytesToHex(bytes);
}

export async function generateSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(SALT_LENGTH);
  return bytesToHex(bytes);
}

export async function encryptData(keyHex: string, plaintext: string): Promise<string> {
  const key = hexToBytes(keyHex);
  const iv = await Crypto.getRandomBytesAsync(IV_LENGTH);
  const plainBytes = new TextEncoder().encode(plaintext);

  const keyStream = new Uint8Array(plainBytes.length);
  for (let i = 0; i < plainBytes.length; i += 32) {
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
    const remaining = Math.min(32, plainBytes.length - i);
    keyStream.set(block.slice(0, remaining), i);
  }

  const ciphertext = new Uint8Array(plainBytes.length);
  for (let i = 0; i < plainBytes.length; i++) {
    ciphertext[i] = plainBytes[i]! ^ keyStream[i]!;
  }

  const authInput = bytesToHex(iv) + bytesToHex(ciphertext);
  const tagHex = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    authInput + keyHex,
  );
  const tag = hexToBytes(tagHex).slice(0, TAG_LENGTH);

  const output = new Uint8Array(IV_LENGTH + TAG_LENGTH + ciphertext.length);
  output.set(iv, 0);
  output.set(tag, IV_LENGTH);
  output.set(ciphertext, IV_LENGTH + TAG_LENGTH);
  return bytesToHex(output);
}

export async function decryptData(keyHex: string, encryptedHex: string): Promise<string> {
  try {
    const key = hexToBytes(keyHex);
    const encrypted = hexToBytes(encryptedHex);

    if (encrypted.length < IV_LENGTH + TAG_LENGTH) {
      throw new Error('Ciphertext too short');
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
      throw new Error('Authentication failed: data has been tampered with');
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
  } catch {
    return '[encrypted]';
  }
}

export async function encryptObject<T>(keyHex: string, obj: T): Promise<string> {
  return encryptData(keyHex, JSON.stringify(obj));
}

export async function decryptObject<T>(keyHex: string, encryptedHex: string): Promise<T> {
  const decrypted = await decryptData(keyHex, encryptedHex);
  return JSON.parse(decrypted) as T;
}

export async function encryptFile(keyHex: string, base64Data: string): Promise<string> {
  const plainBytes = base64ToUint8Array(base64Data);
  const iv = await Crypto.getRandomBytesAsync(IV_LENGTH);
  const key = hexToBytes(keyHex);

  const keyStream = new Uint8Array(plainBytes.length);
  for (let i = 0; i < plainBytes.length; i += 32) {
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
    const remaining = Math.min(32, plainBytes.length - i);
    keyStream.set(block.slice(0, remaining), i);
  }

  const ciphertext = new Uint8Array(plainBytes.length);
  for (let i = 0; i < plainBytes.length; i++) {
    ciphertext[i] = plainBytes[i]! ^ keyStream[i]!;
  }

  const authInput = bytesToHex(iv) + bytesToHex(ciphertext);
  const tagHex = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    authInput + keyHex,
  );
  const tag = hexToBytes(tagHex).slice(0, TAG_LENGTH);

  const output = new Uint8Array(IV_LENGTH + TAG_LENGTH + ciphertext.length);
  output.set(iv, 0);
  output.set(tag, IV_LENGTH);
  output.set(ciphertext, IV_LENGTH + TAG_LENGTH);
  return uint8ArrayToBase64(output);
}

export async function decryptFile(keyHex: string, encryptedBase64: string): Promise<string> {
  try {
    const encrypted = base64ToUint8Array(encryptedBase64);
    if (encrypted.length < IV_LENGTH + TAG_LENGTH) throw new Error('Too short');

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
    if (!tagMatch) throw new Error('Tampered data');

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
  } catch {
    return '';
  }
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}
