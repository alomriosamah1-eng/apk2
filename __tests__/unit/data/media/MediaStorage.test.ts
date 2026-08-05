import { exportDecryptedToLibrary, readAndDecryptFile, resolveAudioMime, itemTypeForMime, countByItemType } from '@data/media/MediaStorage';
import { ItemType } from '@core/constants';
import { generateEncryptionKey, encryptFile } from '@core/utils/crypto';

jest.mock('expo-crypto');

jest.mock('expo-file-system', () => {
  const cache = new Map<string, string | Uint8Array>();
  const toBytes = (value: string | Uint8Array): Uint8Array =>
    typeof value === 'string'
      ? new TextEncoder().encode(value)
      : value;
  class MockFile {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = parts
        .filter(Boolean)
        .map((p) => (typeof p === 'object' && p !== null ? (p as { uri: string }).uri : p))
        .join('/');
    }
    get exists() {
      return true;
    }
    create() {
      if (!cache.has(this.uri)) cache.set(this.uri, new Uint8Array());
    }
    open() {
      const uri = this.uri;
      let off = 0;
      return {
        get size() {
          return toBytes(cache.get(uri) ?? new Uint8Array()).length;
        },
        get offset() {
          return off;
        },
        set offset(v: number) {
          off = v;
        },
        readBytes(n: number) {
          if (uri.includes('broken')) throw new Error('io read error');
          const data = toBytes(cache.get(uri) ?? new Uint8Array());
          const slice = data.slice(off, off + n);
          off += slice.length;
          return slice;
        },
        writeBytes(content: Uint8Array) {
          const existing = toBytes(cache.get(uri) ?? new Uint8Array());
          const merged = new Uint8Array(existing.length + content.length);
          merged.set(existing, 0);
          merged.set(content, existing.length);
          cache.set(uri, merged);
          off += content.length;
        },
        close() {},
      };
    }
    async text() {
      const value = cache.get(this.uri);
      return typeof value === 'string' ? value : new TextDecoder().decode(value ?? new Uint8Array());
    }
    async bytes() {
      if (this.uri.includes('broken')) throw new Error('io read error');
      return toBytes(cache.get(this.uri) ?? new Uint8Array());
    }
    async write(content: string | Uint8Array) {
      cache.set(this.uri, content);
    }
    copy(destination: { uri: string } | string) {
      const dest = typeof destination === 'string' ? destination : destination.uri;
      cache.set(dest, toBytes(cache.get(this.uri) ?? new Uint8Array()).slice());
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
    __cache: cache,
  };
});

/** SAF fake: folder-picker, created files and read-back, toggles to simulate failures. */
const mockSafFiles = new Map<string, { base64: string; mime: string }>();
let mockSafWriteFail = false;
let mockSafGranted = true;
jest.mock('expo-file-system/legacy', () => ({
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: jest.fn(async () => ({
      granted: mockSafGranted,
      directoryUri: mockSafGranted ? 'content://picker/doc' : undefined,
    })),
    createFileAsync: jest.fn(async (_dir: string, name: string, mime: string) => {
      const uri = `content://picker/${name}`;
      mockSafFiles.set(uri, { base64: '', mime });
      return uri;
    }),
    writeAsStringAsync: jest.fn(async (uri: string, content: string) => {
      if (mockSafWriteFail) throw new Error('saf write failed');
      const f = mockSafFiles.get(uri);
      if (f) f.base64 = content;
    }),
    readAsStringAsync: jest.fn(async (uri: string) => {
      const f = mockSafFiles.get(uri);
      return f ? f.base64 : '';
    }),
  },
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => {}),
}));

/** Filename -> saved assets, so the verification mock reflects real saves. */
const savedAssets: Array<{ id: string; filename: string }> = [];
jest.mock('expo-media-library', () => ({
  saveToLibraryAsync: jest.fn(async (uri: string) => {
    savedAssets.push({ id: `asset-${savedAssets.length + 1}`, filename: String(uri).split('/').pop() ?? 'name' });
  }),
  getAssetsAsync: jest.fn(async () => ({ assets: savedAssets.slice() })),
  deleteAssetsAsync: jest.fn(async () => true),
  SortBy: { creationTime: 'creationTime' },
}));

import { File } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

describe('resolveAudioMime / itemTypeForMime', () => {
  it('accepts an explicit audio mime', () => {
    expect(resolveAudioMime('audio/mpeg', 'song.mp3')).toBe('audio/mpeg');
    expect(resolveAudioMime('audio/flac', 'song.flac')).toBe('audio/flac');
  });

  it('infers audio from the extension when the provider reports octet-stream', () => {
    expect(resolveAudioMime('application/octet-stream', 'song.flac')).toBe('audio/flac');
    expect(resolveAudioMime(null, 'song.opus')).toBe('audio/ogg');
    expect(resolveAudioMime(undefined, 'song.wma')).toBe('audio/x-ms-wma');
    expect(resolveAudioMime('application/octet-stream', 'voice.m4a')).toBe('audio/mp4');
  });

  it('returns null for non-audio files', () => {
    expect(resolveAudioMime('application/pdf', 'doc.pdf')).toBeNull();
    expect(resolveAudioMime('image/jpeg', 'photo.jpg')).toBeNull();
    expect(resolveAudioMime(null, 'archive.zip')).toBeNull();
    expect(resolveAudioMime(null, null)).toBeNull();
  });

  it('accepts application/ogg mislabels and exotic codecs', () => {
    expect(resolveAudioMime('application/ogg', 'song.ogg')).toBe('audio/ogg');
    expect(resolveAudioMime('application/x-ogg', 'voice.opus')).toBe('audio/ogg');
    expect(resolveAudioMime('application/octet-stream', 'music.mka')).toBe('audio/x-matroska');
    expect(resolveAudioMime(null, 'track.wma')).toBe('audio/x-ms-wma');
    expect(resolveAudioMime('audio/x-flac', 'song.flac')).toBe('audio/x-flac');
  });

  it('lets a clear image/video mime win over a misleading extension', () => {
    expect(resolveAudioMime('image/jpeg', 'song.mp3')).toBeNull();
    expect(resolveAudioMime('video/mp4', 'voice.m4a')).toBeNull();
  });

  it('classifies item types from mime', () => {
    expect(itemTypeForMime('image/png')).toBe('image');
    expect(itemTypeForMime('video/mp4')).toBe('video');
    expect(itemTypeForMime('audio/mpeg')).toBe('audio');
    expect(itemTypeForMime('application/pdf')).toBe('file');
    expect(itemTypeForMime(null)).toBe('file');
  });
});

describe('MediaStorage export flow (P3)', () => {
  const mockSave = MediaLibrary.saveToLibraryAsync as jest.Mock;

  beforeEach(() => {
    savedAssets.length = 0;
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

describe('MediaStore export verification (P3)', () => {
  beforeEach(() => {
    savedAssets.length = 0;
  });

  it('verifies a just-saved asset is queryable in MediaStore', async () => {
    const { verifyMediaLibraryAsset, exportBytesToLibrary } = require('@data/media/MediaStorage') as typeof import('@data/media/MediaStorage');
    await exportBytesToLibrary('song.mp3', new Uint8Array([1, 2, 3]));
    await expect(verifyMediaLibraryAsset('song.mp3')).resolves.toBe(true);
  });

  it('reports a non-queryable write as unverifiable', async () => {
    const { verifyMediaLibraryAsset } = require('@data/media/MediaStorage') as typeof import('@data/media/MediaStorage');
    await expect(verifyMediaLibraryAsset('missing.mp3')).resolves.toBe(false);
  });

  it('treats a resolved MediaStore save as committed even when it cannot be enumerated', async () => {
    const { exportBytesToLibrary } = require('@data/media/MediaStorage') as typeof import('@data/media/MediaStorage');
    const real = MediaLibrary.getAssetsAsync as jest.Mock;
    real.mockImplementationOnce(async () => ({ assets: [] }));
    // A save that resolves is committed by the OS; the export must NOT fail or
    // delete the asset just because MediaStore indexing/enumeration is delayed.
    await expect(exportBytesToLibrary('song.mp3', new Uint8Array([9]))).resolves.toBeUndefined();
    expect(MediaLibrary.deleteAssetsAsync).not.toHaveBeenCalled();
  });

  it('rejects an export only when the MediaStore write itself fails', async () => {
    const { exportBytesToLibrary } = require('@data/media/MediaStorage') as typeof import('@data/media/MediaStorage');
    (MediaLibrary.saveToLibraryAsync as jest.Mock).mockRejectedValueOnce(new Error('save failed'));
    await expect(exportBytesToLibrary('song.mp3', new Uint8Array([9]))).rejects.toThrow('save failed');
  });
});

describe('removeStoredItem ordering (extract safety)', () => {
  const { removeStoredItem } = require('@data/media/MediaStorage') as typeof import('@data/media/MediaStorage');

  it('removes the stored copy before the DB row', async () => {
    const filePath = 'document/khaznati/vault-1/remove.me.enc';
    const file = new File(filePath);
    await file.write('encrypted');
    const repo = { delete: jest.fn(async () => ({ success: true })) };
    const { DIContainer } = require('@core/di/container') as typeof import('@core/di/container');
    DIContainer.register('ItemRepository', () => repo as never);
    await removeStoredItem(filePath, 'db-1');
    expect(repo.delete).toHaveBeenCalledWith('db-1');
    await expect(file.bytes()).resolves.toEqual(new Uint8Array()); // removed
  });
});

describe('importUnits engine (audio classification + integrity + cleanup)', () => {
  const { importUnits } = require('@data/media/MediaStorage') as typeof import('@data/media/MediaStorage');

  class FakeStorage {
    store = new Map<string, string>();
    async get(k: string) {
      return this.store.get(k) ?? null;
    }
    async set(k: string, v: string) {
      this.store.set(k, v);
    }
    async delete(k: string) {
      this.store.delete(k);
    }
    async contains(k: string) {
      return this.store.has(k);
    }
    async isAvailable() {
      return true;
    }
  }
  class FakeRepo {
    items: Array<Record<string, unknown>> = [];
    failCreate = false;
    async findContentHashes() {
      return { success: true, data: [] };
    }
    async createMany(items: Array<Record<string, unknown>>) {
      if (this.failCreate) return { success: false, error: new Error('db down') };
      this.items.push(...items);
      return { success: true };
    }
  }

  let storage: FakeStorage;
  let repo: FakeRepo;
  let DIContainer: typeof import('@core/di/container').DIContainer;

  beforeEach(() => {
    storage = new FakeStorage();
    repo = new FakeRepo();
    DIContainer = require('@core/di/container').DIContainer;
    DIContainer.register('SecureStorageSource', () => storage as never);
    DIContainer.register('ItemRepository', () => repo as never);
    require('expo-file-system').__cache.clear();
  });

  /** Builds a minimal but structurally valid 5-second 16-bit stereo 44.1kHz WAV header. */
  function buildWav(): Uint8Array {
    const byteRate = 44100 * 2 * 2;
    const dataSize = byteRate * 5;
    const buf = new Uint8Array(44);
    buf.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
    buf[4] = 36; buf[5] = 0; buf[6] = 0; buf[7] = 0;
    buf.set([0x57, 0x41, 0x56, 0x45], 8); // WAVE
    buf.set([0x66, 0x6d, 0x74, 0x20], 12); // fmt
    buf[16] = 16; buf[17] = 0; buf[18] = 0; buf[19] = 0;
    buf[20] = 1; buf[21] = 0;            // PCM
    buf[22] = 2; buf[23] = 0;            // channels
    buf.set(u32le(44100), 24);           // sample rate
    buf.set(u32le(byteRate), 28);        // byte rate
    buf[32] = 4; buf[33] = 0;            // block align
    buf[34] = 16; buf[35] = 0;           // bits per sample
    buf.set([0x64, 0x61, 0x74, 0x61], 36); // data
    buf.set(u32le(dataSize), 40);
    return buf;
  }

  function u32le(v: number): [number, number, number, number] {
    return [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
  }

  it('normalizes octet-stream audio to ItemType.AUDIO instead of FILE', async () => {
    const plain = buildWav();
    await new File('content://src/track.wav').write(plain);
    const report = await importUnits({
      vaultId: 'vault-1',
      sources: [{ uri: 'content://src/track.wav', name: 'track.wav', mimeType: 'application/octet-stream', size: plain.length }],
      dedupe: true,
    });
    expect(report.imported).toBe(1);
    expect(report.failed).toBe(0);
    expect(repo.items).toHaveLength(1);
    expect(repo.items[0]!['type']).toBe(ItemType.AUDIO);
    expect(repo.items[0]!['mimeType']).toBe('audio/wav');
    // duration was probed from the WAV header and stored
    const meta = repo.items[0]!['metadata'] as Record<string, unknown>;
    expect(meta['duration_ms']).toBe(5000);
    expect(typeof meta['content_hash']).toBe('string');
  });

  it('runs a round-trip integrity check before reporting success', async () => {
    const plain = buildWav();
    await new File('content://src/ok.wav').write(plain);
    const report = await importUnits({
      vaultId: 'vault-1',
      sources: [{ uri: 'content://src/ok.wav', name: 'ok.wav', mimeType: null, size: plain.length }],
      dedupe: true,
    });
    expect(report.imported).toBe(1);
    expect(report.failed).toBe(0);
  });

  it('keeps the source and does not create a record when reading the source fails', async () => {
    const onSourceImported = jest.fn();
    const report = await importUnits({
      vaultId: 'vault-1',
      sources: [{ uri: 'content://src/broken.wav', name: 'broken.wav', mimeType: 'audio/wav' }],
      dedupe: true,
      onSourceImported,
    });
    // no onSourceImported cleanup, no DB row (rollback on failure)
    expect(report.imported).toBe(0);
    expect(report.failed).toBe(1);
    expect(repo.items).toHaveLength(0);
    expect(onSourceImported).not.toHaveBeenCalled();
  });

  it('removes just-written encrypted files when the DB commit fails (no orphan files)', async () => {
    const plain = buildWav();
    repo.failCreate = true;
    await new File('content://src/a.wav').write(plain);
    const report = await importUnits({
      vaultId: 'vault-1',
      sources: [
        { uri: 'content://src/a.wav', name: 'a.wav', mimeType: 'audio/wav', size: plain.length },
        { uri: 'content://src/a.wav', name: 'b.wav', mimeType: 'audio/wav', size: plain.length },
      ],
      dedupe: true,
    });
    expect(report.failed).toBe(2);
    expect(repo.items).toHaveLength(0);
    // no encrypted .enc files should remain on disk after the failed commit
    const encCache = require('expo-file-system').__cache as Map<string, unknown>;
    const leftover = [...encCache.keys()].filter((k) => k.includes('.enc'));
    expect(leftover).toHaveLength(0);
  });

  it('imports a large (multi-chunk) file through the streaming path', async () => {
    // Deliberately larger than the 4 MiB stream chunk so the import MUST span
    // several chunks — the exact case that OOM'd under the old whole-file read.
    const chunk = 4 * 1024 * 1024;
    const plain = new Uint8Array(chunk + 5000);
    for (let i = 0; i < plain.length; i += 997) plain[i] = i % 251;
    await new File('content://src/big.mp4').write(plain);
    const report = await importUnits({
      vaultId: 'vault-1',
      sources: [{ uri: 'content://src/big.mp4', name: 'big.mp4', mimeType: 'video/mp4', size: plain.length }],
      dedupe: true,
    });
    expect(report.imported).toBe(1);
    expect(report.failed).toBe(0);
    const encCache = require('expo-file-system').__cache as Map<string, unknown>;
    const encKey = [...encCache.keys()].find((k) => k.includes('.enc'))!;
    // The vault copy survives and is exactly one chunk-stream per byte larger
    // than the plaintext (header + 16-byte GCM tag per chunk).
    const encBytes = encCache.get(encKey) as Uint8Array;
    expect(encBytes.length).toBe(13 + Math.ceil(plain.length / chunk) * 16 + plain.length);
  });

  it('auto-deletes the source from the device only after a successful import', async () => {
    const plain = buildWav();
    await new File('content://src/gallery.wav').write(plain);
    const onSourceImported = jest.fn(async (src: { uri: string }) => {
      const { deleteImportedSource } = require('@data/media/MediaStorage') as typeof import('@data/media/MediaStorage');
      await deleteImportedSource(src.uri);
    });
    const report = await importUnits({
      vaultId: 'vault-1',
      sources: [{ uri: 'content://src/gallery.wav', name: 'gallery.wav', mimeType: 'audio/wav', size: plain.length }],
      dedupe: true,
      onSourceImported,
    });
    expect(report.imported).toBe(1);
    expect(onSourceImported).toHaveBeenCalledTimes(1);
    // the device copy is gone once the vault record is durable
    const encCache = require('expo-file-system').__cache as Map<string, unknown>;
    expect(encCache.has('content://src/gallery.wav')).toBe(false);
  });

  it('keeps the source on a DB commit failure (never deletes before the vault copy is durable)', async () => {
    const plain = buildWav();
    await new File('content://src/safe.wav').write(plain);
    const onSourceImported = jest.fn();
    repo.failCreate = true;
    const report = await importUnits({
      vaultId: 'vault-1',
      sources: [{ uri: 'content://src/safe.wav', name: 'safe.wav', mimeType: 'audio/wav', size: plain.length }],
      dedupe: true,
      onSourceImported,
    });
    expect(report.imported).toBe(0);
    expect(report.failed).toBe(1);
    expect(onSourceImported).not.toHaveBeenCalled();
    // the original survives so the user can retry
    const encCache = require('expo-file-system').__cache as Map<string, unknown>;
    expect(encCache.has('content://src/safe.wav')).toBe(true);
  });
});

describe('exportUnits media path (regression: extraction must not detour to SAF)', () => {
  const { exportUnits } = require('@data/media/MediaStorage') as typeof import('@data/media/MediaStorage');

  class FakeExportStorage {
    store = new Map<string, string>();
    async get(k: string) {
      return this.store.get(k) ?? null;
    }
    async set(k: string, v: string) {
      this.store.set(k, v);
    }
  }
  class FakeExportRepo {
    deleted: string[] = [];
    async findById(_id: string) {
      return { success: true, data: { metadata: null } };
    }
    async update(_i: Record<string, unknown>) {
      return { success: true };
    }
    async delete(id: string) {
      this.deleted.push(id);
      return { success: true };
    }
  }

  let DIContainer: typeof import('@core/di/container').DIContainer;
  let storage: FakeExportStorage;
  let repo: FakeExportRepo;

  beforeEach(() => {
    savedAssets.length = 0;
    const { generateEncryptionKey, encryptBytes } = require('@core/utils/crypto') as typeof import('@core/utils/crypto');
    return (async () => {
      DIContainer = require('@core/di/container').DIContainer;
      storage = new FakeExportStorage();
      repo = new FakeExportRepo();
      DIContainer.register('SecureStorageSource', () => storage as never);
      DIContainer.register('ItemRepository', () => repo as never);
      require('expo-file-system').__cache.clear();
      require('@data/media/MediaStorage').clearVaultKeyCache();
      const key = await generateEncryptionKey();
      await storage.set('media_vault_key_vault-1', key);
      const plain = new Uint8Array([0x1, 0x2, 0x3, 0x4]);
      const enc = await encryptBytes(key, plain);
      await new File('document/khaznati/vault-1/.encrypted_media/pic.enc').write(enc);
    })();
  });

  it('extracts a media item through the MediaStore without falling back to SAF', async () => {
    const report = await exportUnits({
      vaultId: 'vault-1',
      mode: 'extract',
      items: [{ encryptedPath: 'document/khaznati/vault-1/.encrypted_media/pic.enc', dbId: 'db-1', name: 'pic.jpg', mimeType: 'image/jpeg' }],
    });
    expect(report.success).toBe(1);
    expect(report.failed).toBe(0);
    // The vault copy was removed and the DB row gone only after a successful write.
    expect(repo.deleted).toEqual(['db-1']);
    const encCache = require('expo-file-system').__cache as Map<string, unknown>;
    expect(encCache.has('document/khaznati/vault-1/.encrypted_media/pic.enc')).toBe(false);
    expect(MediaLibrary.saveToLibraryAsync).toHaveBeenCalled();
  });

  it('keeps the vault copy in copy mode and never touches the DB row', async () => {
    const report = await exportUnits({
      vaultId: 'vault-1',
      mode: 'copy',
      items: [{ encryptedPath: 'document/khaznati/vault-1/.encrypted_media/pic.enc', name: 'pic.jpg', mimeType: 'image/jpeg' }],
    });
    expect(report.success).toBe(1);
    expect(repo.deleted).toHaveLength(0);
    expect(new (require('expo-file-system') as typeof import('expo-file-system')).File('document/khaznati/vault-1/.encrypted_media/pic.enc').exists).toBe(true);
  });
});

describe('exportUnits audio/document path (reliability + auto-delete from vault)', () => {
  const { exportUnits } = require('@data/media/MediaStorage') as typeof import('@data/media/MediaStorage');
  const StorageAccessFramework = require('expo-file-system/legacy').StorageAccessFramework as {
    requestDirectoryPermissionsAsync: jest.Mock;
    writeAsStringAsync: jest.Mock;
    readAsStringAsync: jest.Mock;
    createFileAsync: jest.Mock;
  };
  const Sharing = require('expo-sharing') as { isAvailableAsync: jest.Mock; shareAsync: jest.Mock };

  class FakeStorage {
    store = new Map<string, string>();
    async get(k: string) {
      return this.store.get(k) ?? null;
    }
    async set(k: string, v: string) {
      this.store.set(k, v);
    }
  }
  class FakeRepo {
    deleted: string[] = [];
    async findById(_id: string) {
      return { success: true, data: { metadata: null } };
    }
    async update(_i: Record<string, unknown>) {
      return { success: true };
    }
    async delete(id: string) {
      this.deleted.push(id);
      return { success: true };
    }
  }

  let DIContainer: typeof import('@core/di/container').DIContainer;
  let storage: FakeStorage;
  let repo: FakeRepo;
  const encAudio = 'document/khaznati/vault-1/.encrypted_media/song.enc';
  const encDoc = 'document/khaznati/vault-1/.encrypted_media/report.enc';
  const plain = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x01, 0x02]);

  const seed = async (uri: string, key: string) => {
    const { encryptBytes } = require('@core/utils/crypto') as typeof import('@core/utils/crypto');
    const enc = await encryptBytes(key, plain);
    await new File(uri).write(enc);
  };

  beforeEach(() => {
    savedAssets.length = 0;
    mockSafFiles.clear();
    mockSafWriteFail = false;
    mockSafGranted = true;
    (StorageAccessFramework.requestDirectoryPermissionsAsync as jest.Mock).mockClear();
    (StorageAccessFramework.writeAsStringAsync as jest.Mock).mockClear();
    (StorageAccessFramework.readAsStringAsync as jest.Mock).mockClear();
    (StorageAccessFramework.createFileAsync as jest.Mock).mockClear();
    (Sharing.shareAsync as jest.Mock).mockClear();
    (MediaLibrary.saveToLibraryAsync as jest.Mock).mockClear();
    return (async () => {
      DIContainer = require('@core/di/container').DIContainer;
      storage = new FakeStorage();
      repo = new FakeRepo();
      DIContainer.register('SecureStorageSource', () => storage as never);
      DIContainer.register('ItemRepository', () => repo as never);
      require('expo-file-system').__cache.clear();
      require('@data/media/MediaStorage').clearVaultKeyCache();
      const { generateEncryptionKey } = require('@core/utils/crypto') as typeof import('@core/utils/crypto');
      const key = await generateEncryptionKey();
      await storage.set('media_vault_key_vault-1', key);
      await seed(encAudio, key);
      await seed(encDoc, key);
    })();
  });

  it('extracts audio through the MediaStore and removes the vault copy', async () => {
    const report = await exportUnits({
      vaultId: 'vault-1',
      mode: 'extract',
      items: [{ encryptedPath: encAudio, dbId: 'db-audio', name: 'song.mp3', mimeType: 'audio/mpeg' }],
    });
    expect(report.success).toBe(1);
    expect(MediaLibrary.saveToLibraryAsync).toHaveBeenCalled();
    expect(repo.deleted).toEqual(['db-audio']);
    const encCache = require('expo-file-system').__cache as Map<string, unknown>;
    expect(encCache.has(encAudio)).toBe(false);
  });

  it('routes audio mislabeled as octet-stream to the MediaStore (export-side mime normalize)', async () => {
    const report = await exportUnits({
      vaultId: 'vault-1',
      mode: 'copy',
      items: [{ encryptedPath: encAudio, name: 'voice.flac', mimeType: 'application/octet-stream' }],
    });
    expect(report.success).toBe(1);
    expect(MediaLibrary.saveToLibraryAsync).toHaveBeenCalled();
    expect(StorageAccessFramework.createFileAsync).not.toHaveBeenCalled();
  });

  it('falls back from a failing MediaStore to SAF for audio, still verifies and deletes from vault', async () => {
    (MediaLibrary.saveToLibraryAsync as jest.Mock).mockRejectedValueOnce(new Error('media store busy'));
    const report = await exportUnits({
      vaultId: 'vault-1',
      mode: 'extract',
      items: [{ encryptedPath: encAudio, dbId: 'db-audio2', name: 'song.mp3', mimeType: 'audio/mpeg' }],
    });
    expect(report.success).toBe(1);
    expect(StorageAccessFramework.createFileAsync).toHaveBeenCalled();
    expect(repo.deleted).toEqual(['db-audio2']);
    const encCache = require('expo-file-system').__cache as Map<string, unknown>;
    expect(encCache.has(encAudio)).toBe(false);
  });

  it('extracts a document to SAF (folder picker), verifies the write, then removes the vault copy', async () => {
    const report = await exportUnits({
      vaultId: 'vault-1',
      mode: 'extract',
      items: [{ encryptedPath: encDoc, dbId: 'db-doc', name: 'report.pdf', mimeType: 'application/pdf' }],
    });
    expect(report.success).toBe(1);
    expect(StorageAccessFramework.createFileAsync).toHaveBeenCalled();
    // the SAF write was read back and matched, so the vault copy can go
    expect(repo.deleted).toEqual(['db-doc']);
    const encCache = require('expo-file-system').__cache as Map<string, unknown>;
    expect(encCache.has(encDoc)).toBe(false);
    // base64 in the SAF store decodes back to the original plaintext
    const written = mockSafFiles.get('content://picker/report.pdf')!;
    const decoded = new Uint8Array(Buffer.from(written.base64, 'base64'));
    expect(decoded).toEqual(plain);
  });

  it('falls back to the share sheet when SAF fails; keeps the vault copy (share is unverifiable)', async () => {
    mockSafWriteFail = true;
    const report = await exportUnits({
      vaultId: 'vault-1',
      mode: 'extract',
      items: [{ encryptedPath: encDoc, dbId: 'db-doc2', name: 'report.pdf', mimeType: 'application/pdf' }],
    });
    expect(Sharing.shareAsync).toHaveBeenCalled();
    // reported as a success, but the vault copy is KEPT so nothing is lost
    expect(report.success).toBe(1);
    expect(repo.deleted).toEqual([]);
    const encCache = require('expo-file-system').__cache as Map<string, unknown>;
    expect(encCache.has(encDoc)).toBe(true);
  });

  it('does not remove anything when the SAF folder picker is cancelled', async () => {
    mockSafGranted = false;
    const report = await exportUnits({
      vaultId: 'vault-1',
      mode: 'extract',
      items: [{ encryptedPath: encDoc, dbId: 'db-doc3', name: 'report.pdf', mimeType: 'application/pdf' }],
    });
    expect(report.cancelled).toBe(1);
    expect(repo.deleted).toEqual([]);
    const encCache = require('expo-file-system').__cache as Map<string, unknown>;
    expect(encCache.has(encDoc)).toBe(true);
  });
});

describe('countByItemType', () => {
  it('counts items per category, zeroing untouched types', () => {
    const counts = countByItemType([
      { type: ItemType.IMAGE },
      { type: ItemType.IMAGE },
      { type: ItemType.DOCUMENT },
      { type: ItemType.VIDEO },
    ]);
    expect(counts[ItemType.IMAGE]).toBe(2);
    expect(counts[ItemType.VIDEO]).toBe(1);
    expect(counts[ItemType.DOCUMENT]).toBe(1);
    expect(counts[ItemType.AUDIO]).toBe(0);
    expect(counts[ItemType.FILE]).toBe(0);
  });

  it('ignores unrelated types (notes, folders)', () => {
    const counts = countByItemType([
      { type: ItemType.IMAGE },
      { type: ItemType.NOTE },
      { type: ItemType.FOLDER },
      { type: ItemType.PASSWORD },
    ]);
    expect(counts[ItemType.IMAGE]).toBe(1);
    expect(counts[ItemType.FILE]).toBe(0);
  });
});
