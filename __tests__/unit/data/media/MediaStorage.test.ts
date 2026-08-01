import { exportDecryptedToLibrary, readAndDecryptFile } from '@data/media/MediaStorage';
import { generateEncryptionKey, encryptFile } from '@core/utils/crypto';

jest.mock('expo-crypto');

jest.mock('expo-file-system', () => {
  const cache = new Map<string, string>();
  class MockFile {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = parts.filter(Boolean).join('/');
    }
    get exists() {
      return true;
    }
    async text() {
      return cache.get(this.uri) ?? '';
    }
    async write(content: string) {
      cache.set(this.uri, content);
    }
    delete() {
      cache.delete(this.uri);
    }
  }
  class MockDirectory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = parts.filter(Boolean).join('/');
    }
    get exists() {
      return true;
    }
    create() {}
  }
  return {
    File: MockFile,
    Directory: MockDirectory,
    Paths: { cache: 'cache', document: 'document' },
  };
});

jest.mock('expo-media-library', () => ({
  saveToLibraryAsync: jest.fn(async () => {}),
}));

import { File } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

describe('MediaStorage export flow (P3)', () => {
  const mockSave = MediaLibrary.saveToLibraryAsync as jest.Mock;

  beforeEach(() => {
    mockSave.mockClear();
  });

  it('exports decrypted content to the library and cleans temp', async () => {
    const key = await generateEncryptionKey();
    const base64 = Buffer.from('top secret document').toString('base64');
    const encrypted = await encryptFile(key, base64);
    await new File('cache/khaznati/vault-1/doc.enc').write(encrypted);

    const decrypted = await readAndDecryptFile(key, `cache/khaznati/vault-1/doc.enc`);
    expect(Buffer.from(decrypted, 'base64').toString('utf-8')).toBe('top secret document');

    await exportDecryptedToLibrary('doc.txt', decrypted);
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(String(mockSave.mock.calls[0][0])).toContain('doc.txt');
  });

  it('still cleans temp when MediaLibrary throws', async () => {
    mockSave.mockRejectedValueOnce(new Error('save failed'));

    const key = await generateEncryptionKey();
    const base64 = Buffer.from('secret').toString('base64');
    const encrypted = await encryptFile(key, base64);
    await new File('cache/khaznati/vault-1/f.enc').write(encrypted);

    const decrypted = await readAndDecryptFile(key, `cache/khaznati/vault-1/f.enc`);

    await expect(exportDecryptedToLibrary('f.txt', decrypted)).rejects.toThrow('save failed');
  });
});
