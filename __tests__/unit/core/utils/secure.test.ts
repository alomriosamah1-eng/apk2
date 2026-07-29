import { generateSalt, hashPin } from '@core/utils/secure';

jest.mock('expo-crypto');

describe('generateSalt', () => {
  it('returns a 32-character hex string', async () => {
    const salt = await generateSalt();
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
  });

  it('generates unique values each time', async () => {
    const [salt1, salt2] = await Promise.all([generateSalt(), generateSalt()]);
    expect(salt1).not.toBe(salt2);
  });
});

describe('hashPin', () => {
  it('returns consistent hash for same pin and salt', async () => {
    const salt = await generateSalt();
    const hash1 = await hashPin('1234', salt);
    const hash2 = await hashPin('1234', salt);
    expect(hash1).toBe(hash2);
  }, 30000);

  it('returns different hash for different pins', async () => {
    const salt = await generateSalt();
    const hash1 = await hashPin('1234', salt);
    const hash2 = await hashPin('5678', salt);
    expect(hash1).not.toBe(hash2);
  }, 30000);

  it('returns different hash for different salts', async () => {
    const salt1 = await generateSalt();
    const salt2 = await generateSalt();
    const hash1 = await hashPin('1234', salt1);
    const hash2 = await hashPin('1234', salt2);
    expect(hash1).not.toBe(hash2);
  }, 30000);
});
