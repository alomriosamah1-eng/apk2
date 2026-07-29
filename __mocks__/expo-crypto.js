const crypto = {
  CryptoDigestAlgorithm: {
    SHA256: 'SHA-256',
    SHA384: 'SHA-384',
    SHA512: 'SHA-512',
  },
  getRandomBytesAsync: jest.fn(async (count) => {
    const bytes = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
    return bytes;
  }),
  getRandomBytes: jest.fn((count) => {
    const bytes = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
    return bytes;
  }),
  digestStringAsync: jest.fn(async (algorithm, data) => {
    const { createHash } = require('crypto');
    return createHash('sha256').update(data).digest('hex');
  }),
  digest: jest.fn(async (algorithm, data) => {
    const { createHash } = require('crypto');
    const hash = createHash('sha256').update(Buffer.from(data)).digest();
    return hash.buffer;
  }),
};

module.exports = crypto;
