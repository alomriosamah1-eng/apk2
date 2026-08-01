import {
  generateEncryptionKey,
  encryptData,
  decryptData,
} from '@core/utils/crypto';
import { CryptoError, CryptoErrorCode } from '@core/errors';

jest.mock('expo-crypto');

describe('generateEncryptionKey', () => {
  it('returns a 64-character hex string', async () => {
    const key = await generateEncryptionKey();
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates unique keys each time', async () => {
    const [k1, k2] = await Promise.all([generateEncryptionKey(), generateEncryptionKey()]);
    expect(k1).not.toBe(k2);
  });
});

describe('encryptData / decryptData', () => {
  it('round-trips plaintext through AES-256-GCM', async () => {
    const key = await generateEncryptionKey();
    const cipher = await encryptData(key, 'hello secret');
    expect(cipher).not.toContain('hello secret');
    const plain = await decryptData(key, cipher);
    expect(plain).toBe('hello secret');
  });

  it('decrypts with a different IV to a valid (but different) ciphertext', async () => {
    const key = await generateEncryptionKey();
    const c1 = await encryptData(key, 'same');
    const c2 = await encryptData(key, 'same');
    expect(c1).not.toBe(c2);
  });

  it('throws CryptoError(TAMPER) when ciphertext is tampered', async () => {
    const key = await generateEncryptionKey();
    const cipher = await encryptData(key, 'do not touch');
    const bytes = Buffer.from(cipher, 'hex');
    bytes[bytes.length - 1]! ^= 0xff;
    const tampered = bytes.toString('hex');
    await expect(decryptData(key, tampered)).rejects.toBeInstanceOf(CryptoError);
    await expect(decryptData(key, tampered)).rejects.toMatchObject({
      code: CryptoErrorCode.TAMPER,
    });
  });

  it('throws CryptoError(TAMPER) when decrypted with the wrong key', async () => {
    const key = await generateEncryptionKey();
    const otherKey = await generateEncryptionKey();
    const cipher = await encryptData(key, 'secret');
    await expect(decryptData(otherKey, cipher)).rejects.toMatchObject({
      code: CryptoErrorCode.TAMPER,
    });
  });

  it('throws CryptoError(BAD_FORMAT) for empty ciphertext', async () => {
    const key = await generateEncryptionKey();
    await expect(decryptData(key, '')).rejects.toMatchObject({
      code: CryptoErrorCode.BAD_FORMAT,
    });
  });
});
