import { Paths, Directory, File } from 'expo-file-system';
import { StorageAccessFramework, EncodingType } from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as Crypto from 'expo-crypto';
import { SHA256 } from '@noble/hashes/sha256';
import { DIContainer } from '@core/di/container';
import { SecureStorageSource } from '@data/datasources/SecureStorageSource';
import { IItemRepository } from '@domain/repositories/IItemRepository';
import { Item } from '@domain/entities/Item';
import { ItemType } from '@core/constants';
import { generateId } from '@core/utils';
import {
  generateEncryptionKey,
  encryptBytes,
  decryptBytes,
  buildStreamHeader,
  readStreamHeader,
  encryptStreamChunk,
  decryptStreamChunk,
  STREAM_HEADER_LENGTH,
  STREAM_CHUNK_LENGTH,
} from '@core/utils/crypto';
import { probeAudioDurationMs } from '@data/media/audioMetadata';

/** In-memory session cache of vault keys. Avoids a SecureStorage read per file during bulk IO. */
const KEY_CACHE = new Map<string, string>();

export async function getVaultKey(vaultId: string): Promise<string> {
  const cached = KEY_CACHE.get(vaultId);
  if (cached) return cached;
  const storage = DIContainer.resolve<SecureStorageSource>('SecureStorageSource');
  const keyKey = `media_vault_key_${vaultId}`;
  let key = await storage.get(keyKey);
  if (!key) {
    key = await generateEncryptionKey();
    await storage.set(keyKey, key);
  }
  KEY_CACHE.set(vaultId, key);
  return key;
}

/** Drops the in-memory key cache (used when a vault key must be re-provisioned). */
export function clearVaultKeyCache(): void {
  KEY_CACHE.clear();
}

/**
 * Cooperative yield so a long-running CPU/IO task never starves the JS (UI)
 * thread. Place between chunks of heavy work.
 */
export function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Streams a local file in fixed-size chunks through a {@link FileHandle},
 * yielding to the event loop between reads so large files never block the UI.
 * Each chunk is handed to `onChunk` for incremental processing (hashing,
 * batching). Bounded memory: only `chunkSize` bytes live at a time.
 */
export async function forEachFileChunk(
  uri: string,
  onChunk: (chunk: Uint8Array) => void | Promise<void>,
  chunkSize = 4 * 1024 * 1024,
): Promise<void> {
  const handle = new File(uri).open();
  try {
    const total = handle.size ?? 0;
    let offset = 0;
    while (offset < total) {
      handle.offset = offset;
      const chunk = handle.readBytes(Math.min(chunkSize, total - offset));
      if (chunk.length === 0) break;
      await onChunk(chunk);
      offset += chunk.length;
      if (Math.floor(offset / chunkSize) % 2 === 1) await yieldToEventLoop();
    }
  } finally {
    handle.close();
  }
}

/** Computes the SHA-256 of a file by streaming it (bounded memory). */
export async function sha256File(uri: string): Promise<string> {
  const hash = new SHA256();
  await forEachFileChunk(uri, (chunk) => void hash.update(chunk));
  return bytesToHex(hash.digest());
}

/** Computes the SHA-256 of an in-memory byte buffer. */
export function sha256Bytes(bytes: Uint8Array): string {
  const hash = new SHA256();
  hash.update(bytes);
  return bytesToHex(hash.digest());
}

/** Constant-time byte equality for round-trip integrity checks. */
export function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) diff |= (a[i] as number) ^ (b[i] as number);
  return diff === 0;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** Opens a file for binary write, creating the file (and intermediates) first. */
function openWriteHandle(uri: string): import('expo-file-system').FileHandle {
  const f = new File(uri);
  if (f.exists) f.delete();
  f.create();
  return f.open();
}

/**
 * Encrypts the source file into `.enc` in bounded memory using the chunked v2
 * format. The source is read chunk-by-chunk through a FileHandle, each chunk is
 * authenticated by its own AES-GCM, and the ciphertext is appended to the
 * destination handle. Peak memory is O(chunkSize), independent of file size —
 * this is what makes large video import possible where the old whole-message
 * variant consumed ~3x the file and OOM'd.
 */
export async function encryptFileToStore(
  keyHex: string,
  srcUri: string,
  dstUri: string,
  chunkLength: number = STREAM_CHUNK_LENGTH,
  onFirstChunk?: (firstPlain: Uint8Array) => void,
): Promise<void> {
  const baseNonce = await Crypto.getRandomBytesAsync(8);
  const src = new File(srcUri).open();
  const writer = openWriteHandle(dstUri);
  try {
    writer.writeBytes(buildStreamHeader(baseNonce, chunkLength));
    let index = 0;
    let first = true;
    let wroteChunks = 0;
    for (;;) {
      const plain = src.readBytes(chunkLength);
      if (plain.length === 0) break;
      if (first) {
        first = false;
        onFirstChunk?.(plain);
      }
      writer.writeBytes(encryptStreamChunk(keyHex, baseNonce, index, plain));
      index += 1;
      wroteChunks += 1;
      if (index % 8 === 0) await yieldToEventLoop();
    }
    // A source that reports a non-empty size but yielded no readable bytes is
    // broken (provider error, revoked permission). Fail loudly instead of
    // quietly importing a header-only file.
    const srcSize = src.size ?? 0;
    if (wroteChunks === 0 && srcSize > 0) {
      throw new Error(`could not read source: ${srcUri}`);
    }
  } finally {
    src.close();
    writer.close();
  }
}

/**
 * Streams a decrypted file to a sink in bounded memory. Supports both the new
 * v2 chunked format (read per-chunk) and legacy v1 whole-message files (read
 * fully, then passed as one chunk). `onPlainChunk(plain, isLast)` is invoked per
 * chunk; the total order reproduces the original plaintext exactly.
 *
 * Legacy note: v1/v0 files are rare (pre-streaming) and small, so falling back
 * to a whole-file read for them keeps memory sane while preserving backward
 * compatibility.
 */
export async function forEachDecryptedChunk(
  keyHex: string,
  encryptedUri: string,
  onPlainChunk: (plain: Uint8Array, isLast: boolean) => void | Promise<void>,
): Promise<void> {
  const handle = new File(encryptedUri).open();
  try {
    const head = handle.readBytes(STREAM_HEADER_LENGTH);
    if (head.length === STREAM_HEADER_LENGTH && head[0] === 2) {
      const h = readStreamHeader(head);
      if (!h) throw new Error('invalid encrypted stream header');
      let index = 0;
      for (;;) {
        const ct = handle.readBytes(h.chunkLength + 16);
        if (ct.length === 0) break;
        const isLast = ct.length < h.chunkLength + 16;
        const plain = decryptStreamChunk(keyHex, h.baseNonce, index, ct);
        await onPlainChunk(plain, isLast);
        index += 1;
        if (index % 8 === 0) await yieldToEventLoop();
        if (isLast) break;
      }
      return;
    }
    // Legacy v1 (and pre-v1) whole-message file: read the remainder, decrypt whole.
    const total = Number(handle.size) || head.length;
    const restLen = Math.max(0, total - head.length);
    const rest = handle.readBytes(restLen);
    const full = concatBytes([head, rest]);
    const plain = await decryptBytes(keyHex, full);
    await onPlainChunk(plain, true);
  } finally {
    handle.close();
  }
}

/**
 * SHA-256 over the DECRYPTED contents of an encrypted file, in bounded memory
 * (streaming). Used as the post-write import/export formatReliability check.
 */
export async function sha256Decrypted(keyHex: string, encryptedUri: string): Promise<string> {
  const hash = new SHA256();
  await forEachDecryptedChunk(keyHex, encryptedUri, (chunk) => void hash.update(chunk));
  return bytesToHex(hash.digest());
}

/** Streams an encrypted file to a plaintext destination file (app-private cache). */
export async function decryptEncryptedToFile(keyHex: string, encryptedUri: string, dstUri: string): Promise<void> {
  const writer = openWriteHandle(dstUri);
  try {
    await forEachDecryptedChunk(keyHex, encryptedUri, async (chunk) => {
      writer.writeBytes(chunk);
      await yieldToEventLoop();
    });
  } finally {
    writer.close();
  }
}

/**
 * Decrypts an encrypted vault file to an app-private cache temp file so a
 * native player (ExpooAudio ExoPlayer) can read it as a plain file URI. The
 * extension is preserved so the codec is detected correctly. The caller MUST
 * call {@link deleteTempFile} when done; the plaintext copy is sensitive and
 * lives only in the app cache.
 */
export async function decryptVaultFileToCache(
  encryptedPath: string,
  vaultId: string,
  fileName: string,
): Promise<string> {
  const key = await getVaultKey(vaultId);
  const tempDir = new Directory(Paths.cache, 'khaznati_preview');
  if (!tempDir.exists) tempDir.create({ intermediates: true, idempotent: true });
  const ext = fileName.lastIndexOf('.') > 0 ? fileName.slice(fileName.lastIndexOf('.')) : '';
  const tempFile = new File(tempDir, `preview_${generateId().slice(0, 13)}${ext || '.bin'}`);
  // Streams decrypt/plaintext to the temp file in bounded memory (large audio/docs).
  await decryptEncryptedToFile(key, encryptedPath, tempFile.uri);
  return tempFile.uri;
}

/** Removes a plaintext preview temp file. Safe to call when the file is gone. */
export async function deleteTempFile(uri: string): Promise<void> {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch { /* best-effort cleanup */ }
}

/**
 * Persists the real (decoder-measured) playback duration into an item's
 * `metadata_json.duration_ms`. Duration is captured by the player at first
 * playback (the most reliable source: the actual native decode) and then kept
 * so lists and exports never need to re-probe.
 */
export async function persistPlaybackDuration(dbId: string, durationSeconds: number): Promise<void> {
  if (!dbId || durationSeconds <= 0) return;
  const repo = DIContainer.resolve<IItemRepository>('ItemRepository');
  const found = await repo.findById(dbId);
  if (!found.success || !found.data) return;
  const existingMs = Number((found.data.metadata as Record<string, unknown> | null)?.['duration_ms']) || 0;
  const newMs = Math.round(durationSeconds * 1000);
  if (Math.abs(existingMs - newMs) < 500) return;
  const metadata = { ...(found.data.metadata as Record<string, unknown> | null), duration_ms: newMs };
  await repo.update({ ...found.data, metadata, updatedAt: Date.now() });
}

export function getEncryptedDir(vaultId: string): Directory {
  return new Directory(Paths.document, 'khaznati', vaultId || 'default', '.encrypted_media');
}

interface PersistImageParams {
  vaultId: string;
  name: string;
  mimeType: string | null;
  size: number;
  encryptedBase64: string;
}

/** Maps a mime type to the canonical {@link ItemType} used for storage. */
export function itemTypeForMime(mimeType: string | null | undefined): ItemType {
  if (!mimeType) return ItemType.FILE;
  if (mimeType.startsWith('image/')) return ItemType.IMAGE;
  if (mimeType.startsWith('video/')) return ItemType.VIDEO;
  if (mimeType.startsWith('audio/')) return ItemType.AUDIO;
  return ItemType.FILE;
}

/** Audio extensions -> authoritative mime, used when a provider mislabels audio as octet-stream. */
const AUDIO_EXT_MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  mp2: 'audio/mpeg',
  mp1: 'audio/mpeg',
  mpga: 'audio/mpeg',
  mpa: 'audio/mpeg',
  mpeg3: 'audio/mpeg',
  wav: 'audio/wav',
  wave: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  aac: 'audio/aac',
  m4a: 'audio/mp4',
  m4b: 'audio/mp4',
  m4p: 'audio/mp4',
  m4r: 'audio/mp4',
  mp4a: 'audio/mp4',
  flac: 'audio/flac',
  amr: 'audio/amr',
  awb: 'audio/amr-wb',
  mid: 'audio/midi',
  midi: 'audio/midi',
  wma: 'audio/x-ms-wma',
  aif: 'audio/x-aiff',
  aiff: 'audio/x-aiff',
  ape: 'audio/x-ape',
  caf: 'audio/x-caf',
  weba: 'audio/webm',
  mka: 'audio/x-matroska',
  ac3: 'audio/ac3',
  eac3: 'audio/eac3',
  dts: 'audio/vnd.dts',
  wv: 'audio/x-wavpack',
  tta: 'audio/x-tta',
  ra: 'audio/x-realaudio',
  rm: 'audio/x-pn-realaudio',
  snd: 'audio/basic',
  au: 'audio/basic',
  voc: 'audio/x-voc',
  xmf: 'audio/x-xmf',
};

/**
 * Resolves the real audio mime for a picked file. Android document providers
 * frequently report audio files (flac/opus/wma/...) as `application/octet-stream`
 * or `application/ogg`, which {@link itemTypeForMime} would misclassify as a
 * generic FILE. When the reported mime is absent or generic, the extension is
 * used to identify audio. A clear image/video mime always wins over the
 * extension so a mislabeled non-audio file is never imported as audio.
 * Returns null when the file is definitively not audio.
 */
export function resolveAudioMime(mimeType: string | null | undefined, fileName?: string | null): string | null {
  const mime = (mimeType || '').toLowerCase().trim();
  if (mime.startsWith('audio/')) return mime;
  const ext = (fileName || '').split('.').pop()?.toLowerCase();
  const extMime = ext ? AUDIO_EXT_MIME[ext] : undefined;
  if (!extMime) return null;
  if (mime && (mime.startsWith('image/') || mime.startsWith('video/'))) {
    // Contradictory media label; trust the reported mime, not the extension.
    return null;
  }
  return extMime;
}

/**
 * Sanitizes a display name into a safe, unique encrypted-file leaf name.
 * Uses a random UUID fragment (not Date.now) so two files imported within the
 * same millisecond can never collide and overwrite each other on disk.
 */
export function encryptedFileName(name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  return `${generateId().slice(0, 13)}.${safe || 'file'}.enc`;
}

/**
 * Single canonical media/file import path (R5). Writes the encrypted payload
 * into `.encrypted_media/{vaultId}` and records it in `items` with the correct
 * ItemType derived from the mime type. Both the Media and Files screens read
 * from this same store, so an imported item is visible everywhere.
 */
export async function persistEncryptedItem({
  vaultId,
  name,
  mimeType,
  size,
  encryptedBase64,
}: PersistImageParams): Promise<string> {
  const itemRepo = DIContainer.resolve<IItemRepository>('ItemRepository');
  const encDir = getEncryptedDir(vaultId);
  if (!encDir.exists) encDir.create({ intermediates: true, idempotent: true });
  const encFileName = encryptedFileName(name);
  const encFile = new File(encDir, encFileName);
  await encFile.write(encryptedBase64);

  await itemRepo.create({
    id: generateId(),
    vaultId,
    parentId: null,
    name,
    type: itemTypeForMime(mimeType),
    mimeType: mimeType || null,
    size,
    encryptedPath: encFile.uri,
    encryptedData: null,
    thumbnailPath: null,
    metadata: null,
    isFavorite: false,
    isDeleted: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
  });
  return encFile.uri;
}

export async function persistEncryptedImage({ vaultId, name, mimeType, size, encryptedBase64 }: PersistImageParams): Promise<void> {
  await persistEncryptedItem({ vaultId, name, mimeType, size, encryptedBase64 });
}

interface PersistBytesParams {
  vaultId: string;
  name: string;
  mimeType: string | null;
  size: number;
  plainBytes: Uint8Array;
}

/**
 * Encrypts raw bytes and persists them as an item. The fast path that avoids
 * the JS base64 round-trip, used for large media/files.
 */
export async function persistEncryptedBytesItem({
  vaultId,
  name,
  mimeType,
  size,
  plainBytes,
}: PersistBytesParams): Promise<string> {
  const key = await getVaultKey(vaultId);
  const encryptedBytes = await encryptBytes(key, plainBytes);
  const itemRepo = DIContainer.resolve<IItemRepository>('ItemRepository');
  const encDir = getEncryptedDir(vaultId);
  if (!encDir.exists) encDir.create({ intermediates: true, idempotent: true });
  const encFileName = encryptedFileName(name);
  const encFile = new File(encDir, encFileName);
  encFile.write(encryptedBytes);

  await itemRepo.create({
    id: generateId(),
    vaultId,
    parentId: null,
    name,
    type: itemTypeForMime(mimeType),
    mimeType: mimeType || null,
    size,
    encryptedPath: encFile.uri,
    encryptedData: null,
    thumbnailPath: null,
    metadata: null,
    isFavorite: false,
    isDeleted: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
  });
  return encFile.uri;
}

/** Live progress report emitted during a batch import. */
export type ImportPhase = 'waiting' | 'reading' | 'hashing' | 'encrypting' | 'writing' | 'done';

export interface ImportProgressUpdate {
  phase: ImportPhase;
  /** Files fully processed so far. */
  done: number;
  /** Total files in this batch. */
  total: number;
  /** Name of the file currently being processed, or null when idle. */
  currentName: string | null;
  /** Bytes written so far (for progress/speed metrics). */
  bytesProcessed: number;
  /** Millis elapsed since the batch started. */
  elapsedMs: number;
  /** Average throughput in bytes per second. */
  speedBytesPerSec: number;
}

/** A single source file to import (encrypt into the vault). */
export interface ImportUnitSource {
  /** Source `file://` URI to read. */
  uri: string;
  /** Display name to store. */
  name: string;
  mimeType: string | null;
  /** Known size in bytes; if omitted it is read from disk. */
  size?: number;
}

export interface ImportUnitsOptions {
  vaultId: string;
  sources: ImportUnitSource[];
  /** When true, files are hashed (streaming SHA-256) and exact duplicates are skipped. */
  dedupe?: boolean;
  onProgress?: (update: ImportProgressUpdate) => void;
  /** Cooperative cancellation; returns true to stop as soon as possible. */
  shouldCancel?: () => boolean;
  /** Called after a source was imported or skipped as duplicate (for cleanup). */
  onSourceImported?: (source: ImportUnitSource) => void | Promise<void>;
}

export interface ImportBatchReport {
  imported: number;
  skippedDuplicates: number;
  failed: number;
  cancelled: boolean;
  bytes: number;
  elapsedMs: number;
  errors: Array<{ name: string; message: string }>;
}

const IMPORT_BATCH_SIZE = 50;

/**
 * Batched, cancellable, deduplicating import that encrypts many source files
 * into the vault without freezing the UI thread:
 *
 *  - reads the vault key once (cached) instead of once per file;
 *  - streams each source in chunks, encrypting with the authenticated v2
 *    chunked format in bounded O(chunkSize) memory (large videos no longer OOM);
 *  - yields to the event loop between heavy steps so UI stays responsive;
 *  - writes all records in a single DB transaction via {@link createMany};
 *  - deletes the source from the device (gallery/cache) ONLY AFTER that record
 *    exists, so a failed commit never loses the original;
 *  - emits live progress (phase, counts, bytes, elapsed, speed) for the UI.
 */
export async function importUnits(opts: ImportUnitsOptions): Promise<ImportBatchReport> {
  const { vaultId, sources, dedupe = false, onProgress, shouldCancel } = opts;
  const report: ImportBatchReport = { imported: 0, skippedDuplicates: 0, failed: 0, cancelled: false, bytes: 0, elapsedMs: 0, errors: [] };
  const total = sources.length;
  const started = Date.now();
  let done = 0;
  let bytesProcessed = 0;
  let currentName: string | null = null;

  // Progress is throttled (~8 Hz) so a large batch cannot drive React to
  // re-render on every chunk/item — that render storm is what makes the UI
  // appear frozen ("هنج") even though work is progressing. The final 'done'
  // emission for the whole batch is always flushed.
  let lastProgressAt = 0;
  const emitProgress = (phase: ImportPhase, force: boolean) => {
    if (!onProgress) return;
    const now = Date.now();
    if (!force && now - lastProgressAt < 120) return;
    lastProgressAt = now;
    const elapsedMs = Date.now() - started;
    onProgress({
      phase,
      done,
      total,
      currentName,
      bytesProcessed,
      elapsedMs,
      speedBytesPerSec: elapsedMs > 0 ? bytesProcessed / (elapsedMs / 1000) : 0,
    });
  };

  const tick = (phase: ImportPhase) => emitProgress(phase, false);

  const key = await getVaultKey(vaultId);
  const repo = DIContainer.resolve<IItemRepository>('ItemRepository');
  const encDir = getEncryptedDir(vaultId);
  if (!encDir.exists) encDir.create({ intermediates: true, idempotent: true });

  const knownHashes = new Set<string>();
  if (dedupe) {
    const res = await repo.findContentHashes(vaultId);
    if (res.success) for (const h of res.data) knownHashes.add(h);
  }

  const pending: Item[] = [];
  // Sources whose encrypted copy is pending a durable DB record. Deletion from
  // the device (gallery/cache) is deferred until the batch actually commits, so
  // a failed write can never destroy the original (no data loss).
  const pendingSources: ImportUnitSource[] = [];

  /**
   * Commits a batch in one transaction. On success the vault copy + DB row are
   * durable AND ONLY THEN is each source deleted from the device. On failure the
   * encrypted files just written are removed (no orphans) and the sources are
   * KEPT so the user can retry.
   */
  const commitBatch = async (): Promise<void> => {
    if (pending.length === 0) return;
    const batch = pending.splice(0);
    const sources = pendingSources.splice(0);
    const res = await repo.createMany(batch);
    if (res.success) {
      for (const s of sources) {
        try {
          await opts.onSourceImported?.(s);
        } catch { /* best-effort source cleanup; never fail the import */ }
      }
      return;
    }
    report.failed += batch.length;
    report.errors.push({ name: '(batch)', message: res.error.message });
    for (const it of batch) {
      if (it.encryptedPath) {
        try {
          const f = new File(it.encryptedPath);
          if (f.exists) f.delete();
        } catch { /* best-effort cleanup */ }
      }
    }
  };

  try {
    for (const src of sources) {
      if (shouldCancel?.()) {
        report.cancelled = true;
        break;
      }
      currentName = src.name;
      tick('reading');

      let size = src.size ?? 0;
      if (!size) {
        try {
          const f = new File(src.uri);
          size = Number(f.size) || 0;
        } catch { /* keep 0 */ }
      }

      try {
        // Root cause: Android providers mislabel flac/opus/wma/... as
        // application/octet-stream, which itemTypeForMime() would store as a
        // generic FILE and hide from the Audio tab. Normalize centrally so every
        // entry point (Media/Files/AddOptionsSheet) classifies audio identically.
        const mime = resolveAudioMime(src.mimeType, src.name) ?? src.mimeType;

        let contentHash: string | null = null;
        if (dedupe) {
          tick('hashing');
          contentHash = await sha256File(src.uri);
          await yieldToEventLoop();
          if (contentHash && knownHashes.has(contentHash)) {
            report.skippedDuplicates += 1;
            bytesProcessed += size;
            done += 1;
            tick('done');
            await opts.onSourceImported?.(src);
            continue;
          }
        }

        tick('reading');
        // Root cause of video-import OOM: the previous path read the WHOLE file
        // into memory (new File().bytes()), duplicated it as plaintext+ciphertext,
        // then wrote it — peak ~3x file size. Now we stream: chunked AUTHENTICATED
        // encryption with bounded O(chunkSize) memory regardless of file size.
        let firstPlain: Uint8Array | null = null;
        tick('encrypting');
        const encFile = new File(encDir, encryptedFileName(src.name));
        await encryptFileToStore(key, src.uri, encFile.uri, undefined, (head) => {
          firstPlain = head;
        });
        tick('writing');
        await yieldToEventLoop();

        // Integrity gate (import): decrypt the just-written copy back (streamed,
        // bounded memory) and compare its SHA-256 to the source hash. AES-GCM
        // authenticates every chunk, so a mismatch means tampering or a lossy
        // write. On any failure the encrypted copy is removed and the source is
        // kept (rollback — no data loss, no orphan file).
        if (contentHash) {
          try {
            const roundTripHash = await sha256Decrypted(key, encFile.uri);
            if (roundTripHash !== contentHash) {
              throw new Error('decrypted content does not match source');
            }
          } catch (err) {
            try {
              const f = new File(encFile.uri);
              if (f.exists) f.delete();
            } catch { /* best-effort rollback */ }
            throw new Error(`integrity verification failed: ${(err as Error).message}`);
          }
          await yieldToEventLoop();
        }

        const nowTs = Date.now();
        // Capture duration from the stream headers while we still hold the first
        // plaintext chunk (bounded memory; audio containers carry headers up front).
        const durationMs = firstPlain ? probeAudioDurationMs(firstPlain, src.name) : null;
        pending.push({
          id: generateId(),
          vaultId,
          parentId: null,
          name: src.name,
          type: itemTypeForMime(mime),
          mimeType: mime,
          size,
          encryptedPath: encFile.uri,
          encryptedData: null,
          thumbnailPath: null,
          metadata: {
            ...(contentHash ? { content_hash: contentHash } : null),
            ...(durationMs ? { duration_ms: durationMs } : null),
          },
          isFavorite: false,
          isDeleted: false,
          createdAt: nowTs,
          updatedAt: nowTs,
          deletedAt: null,
        });

        bytesProcessed += size;
        done += 1;
        tick('done');
        // Defer device-side (gallery) deletion until the DB record is durable.
        pendingSources.push(src);

        if (pending.length >= IMPORT_BATCH_SIZE) {
          await commitBatch();
        }
      } catch (err) {
        report.failed += 1;
        report.errors.push({ name: src.name, message: (err as Error).message });
      }
    }
  } finally {
    await commitBatch();
  }

  report.imported = Math.max(0, total - report.failed - report.skippedDuplicates);
  report.bytes = bytesProcessed;
  report.elapsedMs = Date.now() - started;
  emitProgress('done', true);
  return report;
}

/**
 * Requests add-only (write) photo-library permission, which is all that is
 * needed to save/export media. Uses write-only so iOS never drops the user into
 * the "limited" picker for a save action. Returns true when saving is allowed.
 */
export async function ensureLibraryWritePermission(): Promise<boolean> {
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync(true);
    return status === 'granted';
  } catch {
    return false;
  }
}

/** Reads + decrypts an encrypted `.enc` file and returns plaintext bytes. */
export async function readAndDecryptFileBytes(key: string, encryptedUri: string): Promise<Uint8Array> {
  const src = new File(encryptedUri);
  const raw = await src.bytes();
  let encryptedBytes: Uint8Array = raw;
  // Backward compatibility: older items stored the base64-encoded ciphertext
  // as UTF-8 text. A raw binary payload always starts with the version byte
  // (0x01), which is never a valid ASCII base64 leading character, so legacy
  // text files are detected by checking the first byte.
  if (raw.length > 0 && raw[0] !== 1) {
    const text = new TextDecoder().decode(raw);
    encryptedBytes = base64ToBytes(text.trim());
  }
  return decryptBytes(key, encryptedBytes);
}

/** Reads + decrypts an encrypted `.enc` file and returns base64 plaintext. */
export async function readAndDecryptFile(key: string, encryptedUri: string): Promise<string> {
  const plain = await readAndDecryptFileBytes(key, encryptedUri);
  return bytesToBase64(plain);
}

/** Exports raw decrypted bytes to the OS photo library, then removes the temp copy. */
export async function exportBytesToLibrary(fileName: string, plainBytes: Uint8Array): Promise<void> {
  const tempDir = new Directory(Paths.cache, 'khaznati_export');
  if (!tempDir.exists) tempDir.create({ intermediates: true, idempotent: true });
  const safeName = sanitizeExportName(fileName);
  const tempFile = new File(tempDir, safeName);
  tempFile.write(plainBytes);
  try {
    await saveTempToLibrary(tempFile.uri, safeName);
  } finally {
    try { tempFile.delete(); } catch { /* best-effort cleanup */ }
  }
}

/**
 * Saves an already-decrypted temp file to the OS photo library by URI — no
 * whole-file read into memory, so even a large video export stays bounded. The
 * temp file is copied to a nicely named cache file first (MediaStore uses the
 * basename), then removed.
 */
async function saveTempToLibrary(tempUri: string, safeName: string): Promise<void> {
  const named = new File(Paths.cache, safeName);
  try {
    new File(tempUri).copy(named);
    // Root cause: the export previously gated success on re-reading the asset
    // back from MediaStore. Under write-only media-library permission (or with
    // normal MediaStore indexing latency) that enumeration cannot see the fresh
    // asset, so the code deleted a possibly-committed file and threw, forcing
    // EVERY media export through the SAF folder-picker — which is why nothing
    // could be extracted. A resolved saveToLibraryAsync is the OS committing
    // the asset to MediaStore, so it IS the success signal. Confirmation is now
    // best-effort and never destructive.
    await MediaLibrary.saveToLibraryAsync(named.uri);
    await verifyMediaLibraryAsset(safeName);
  } finally {
    try { named.delete(); } catch { /* best-effort cleanup */ }
  }
}

/** True when MediaStore contains a recent asset whose filename matches exactly. */
export async function verifyMediaLibraryAsset(fileName: string): Promise<boolean> {
  try {
    const page = await MediaLibrary.getAssetsAsync({
      first: 20,
      sortBy: [[MediaLibrary.SortBy.creationTime, false]],
    });
    return page.assets.some((a) => a.filename === fileName);
  } catch {
    return false;
  }
}

/** Exports a decrypted base64-encoded file to the OS photo library, then deletes the temp copy. */
export async function exportDecryptedToLibrary(fileName: string, decryptedBase64: string): Promise<void> {
  const plainBytes = base64ToBytes(decryptedBase64);
  await exportBytesToLibrary(fileName, plainBytes);
}

/** How a decrypted payload was written out (or cancelled by the user). */
export type ExportOutcome = 'media-library' | 'saf' | 'share' | 'cancelled';

/** Detailed result of exporting a single unit with integrity verification. */
export interface ExportUnitResult {
  outcome: ExportOutcome;
  /** true when the written copy was read back and matched (SAF) or the MediaStore write resolved without error. */
  verified: boolean;
  /** SAF content-URI when written via the folder picker. */
  destinationUri?: string;
}

/** Reads a local temp file and returns its bytes (used for the SAF base64 write). */
async function fileBytes(uri: string): Promise<Uint8Array> {
  return new File(uri).bytes();
}

/**
 * Writes a decrypted file (already materialized at `tempUri`) to a user-chosen
 * folder via the Storage Access Framework. Works for ANY mime type (pdf, zip,
 * docx, audio codecs, ...) which MediaStore-based {@link exportBytesToLibrary}
 * cannot handle. Returns {@link ExportOutcome.cancelled} when the user dismisses
 * the folder picker. Pass `directoryUri` (from {@link pickSafDirectory}) to
 * reuse a single folder across a batch and avoid multiple pickers.
 */
export async function exportFileToSAF(
  fileName: string,
  mimeType: string | null,
  tempUri: string,
  directoryUri?: string | null,
): Promise<ExportUnitResult> {
  let dirUri = directoryUri ?? null;
  if (!dirUri) {
    const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permission.granted || !permission.directoryUri) {
      return { outcome: 'cancelled', verified: false };
    }
    dirUri = permission.directoryUri;
  }
  const safeName = sanitizeExportName(fileName);
  const plain = await fileBytes(tempUri);
  const base64 = bytesToBase64(plain);
  const fileUri = await StorageAccessFramework.createFileAsync(
    dirUri,
    safeName,
    mimeType || 'application/octet-stream',
  );
  await StorageAccessFramework.writeAsStringAsync(fileUri, base64, {
    encoding: EncodingType.Base64,
  });
  // Integrity check: read the copy back and confirm it matches what we wrote.
  let verified = false;
  try {
    const written = await StorageAccessFramework.readAsStringAsync(fileUri, {
      encoding: EncodingType.Base64,
    });
    verified = written === base64;
  } catch {
    verified = false;
  }
  return { outcome: 'saf', verified, destinationUri: fileUri };
}

/**
 * Last-resort export destination that never requires permissions: opens the OS
 * share sheet with the decrypted temp file. This CANNOT be verified (the user
 * may dismiss the sheet), so `verified` is always false and extract-mode callers
 * must keep the vault copy.
 */
async function exportFileToShare(
  fileName: string,
  mimeType: string | null,
  tempUri: string,
): Promise<ExportUnitResult> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('no share target available');
  }
  await Sharing.shareAsync(tempUri, {
    mimeType: mimeType || undefined,
    dialogTitle: `Export ${fileName}`,
    UTI: mimeType || undefined,
  });
  return { outcome: 'share', verified: false };
}

/** Asks the user for a destination folder (SAF). Returns null if cancelled. */
export async function pickSafDirectory(): Promise<string | null> {
  const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permission.granted || !permission.directoryUri) return null;
  return permission.directoryUri;
}

/**
 * Single export entry point that routes an already-decrypted temp file to the
 * correct Android destination:
 *
 *  - image/video/audio mime  -> MediaStore (OS gallery) via MediaLibrary
 *  - anything else (files, unknown mime) -> SAF folder picker
 *
 * Failure handling (so an export can NEVER hard-fail on a permission or storage
 * edge case):
 *  1. MediaStore throws  -> SAF folder picker
 *  2. SAF throws         -> OS share sheet (always reachable)
 *
 * The share-sheet leg is unverifiable, so `verified` is false there.
 */
export async function exportDecryptedFile(opts: {
  fileName: string;
  mimeType: string | null;
  tempUri: string;
  directoryUri?: string | null;
}): Promise<ExportUnitResult> {
  // Normalize audio mime here too: providers/old records may label flac/opus/
  // wma as application/octet-stream, which would otherwise send audio down the
  // SAF path. Resolve from the filename so audio still goes to the MediaStore.
  const mime = resolveAudioMime(opts.mimeType, opts.fileName) ?? opts.mimeType?.toLowerCase() ?? null;
  const isMedia = !!mime && (
    mime.startsWith('image/') || mime.startsWith('video/') || mime.startsWith('audio/')
  );
  if (isMedia) {
    try {
      // exportBytesToLibrary's rules apply, but we save the already-decrypted
      // temp file by URI (bounded memory) instead of re-reading it into a buffer.
      // A resolved save is the OS committing the asset to MediaStore; a real OS
      // failure throws and we fall back to SAF.
      await saveTempToLibrary(opts.tempUri, sanitizeExportName(opts.fileName));
      return { outcome: 'media-library', verified: true };
    } catch {
      // MediaStore rejected the write outright; fall through to the SAF picker.
    }
  }
  try {
    return await exportFileToSAF(opts.fileName, opts.mimeType, opts.tempUri, opts.directoryUri);
  } catch (err) {
    // SAF failed (no folder app, provider error, ...): fall back to the OS share
    // sheet, which only needs the temp file. Never throw a hard export failure.
    const share = await exportFileToShare(opts.fileName, opts.mimeType, opts.tempUri).catch(
      () => null,
    );
    if (share) return share;
    throw new Error(`SAF export failed: ${(err as Error).message}`);
  }
}

/**
 * Removes a stored (encrypted) item from the vault after an extract.
 *
 * Order matters for integrity: the encrypted file is deleted FIRST and the DB
 * row LAST. If file deletion fails we throw before touching the DB, so the
 * vault copy and its record survive intact (no data loss, no orphan file). Only
 * after the file is confirmed gone is the DB row deleted (the commit point).
 */
export async function removeStoredItem(encryptedPath: string, dbId?: string): Promise<void> {
  if (encryptedPath) {
    const file = new File(encryptedPath);
    if (file.exists) {
      try {
        file.delete();
      } catch (err) {
        throw new Error(`could not remove vault copy: ${(err as Error).message}`);
      }
    }
  }
  if (dbId) {
    const repo = DIContainer.resolve<IItemRepository>('ItemRepository');
    const res = await repo.delete(dbId);
    if (!res.success) throw res.error;
  }
}

/** Counts items by category for type-aware messages. */
export function countByItemType(items: Array<{ type: ItemType }>): Record<string, number> {
  const counts: Record<string, number> = {
    [ItemType.IMAGE]: 0,
    [ItemType.VIDEO]: 0,
    [ItemType.AUDIO]: 0,
    [ItemType.DOCUMENT]: 0,
    [ItemType.FILE]: 0,
  };
  for (const it of items) {
    const current = counts[it.type] ?? 0;
    counts[it.type] = current + 1;
  }
  return counts;
}

/** A single unit meant for export (copy or extract). */
export interface ExportUnitInput {
  encryptedPath: string;
  dbId?: string;
  name: string;
  mimeType: string | null;
}

export type ExportMode = 'copy' | 'extract';

export interface ExportBatchReport {
  success: number;
  failed: number;
  cancelled: number;
  errors: Array<{ name: string; message: string }>;
}

/** Live progress report emitted during a batch export. */
export interface ExportProgressUpdate {
  /** Items fully exported so far. */
  done: number;
  /** Total items in this batch. */
  total: number;
  /** Name of the item currently being exported, or null when idle. */
  currentName: string | null;
  /** Millis elapsed since the batch started. */
  elapsedMs: number;
}

export interface ExportUnitsOptions {
  vaultId: string;
  items: ExportUnitInput[];
  mode: ExportMode;
  directoryUri?: string | null;
  /** Cooperative cancellation; returns true to stop as soon as possible. */
  shouldCancel?: () => boolean;
  /** Live progress callback so a long batch never looks frozen. */
  onProgress?: (update: ExportProgressUpdate) => void;
}

/**
 * Exports one or many units. In `copy` mode the vault copy is kept; in
 * `extract` mode (a genuine move-to-out) the stored copy and its DB record are
 * removed only AFTER the destination copy was written and verified, so a failed
 * transfer never loses data. Runs on a shared cached vault key and yields to the
 * event loop between items so large batches never freeze the UI. Returns real
 * success/failure counts.
 */
export async function exportUnits(opts: ExportUnitsOptions): Promise<ExportBatchReport> {
  const start = Date.now();
  let done = 0;
  const report: ExportBatchReport = { success: 0, failed: 0, cancelled: 0, errors: [] };
  const total = opts.items.length;

  // Throttled like import: emitting per-item during a big batch otherwise
  // floods React with state updates and makes the UI look frozen.
  let lastProgressAt = 0;
  const tick = (currentName: string | null, force = false) => {
    if (!opts.onProgress) return;
    const now = Date.now();
    if (!force && now - lastProgressAt < 120) return;
    lastProgressAt = now;
    opts.onProgress({ done, total, currentName, elapsedMs: now - start });
  };

  const key = await getVaultKey(opts.vaultId);

  for (const item of opts.items) {
    if (opts.shouldCancel?.()) {
      report.cancelled = total - done; // mark the remaining items as not attempted
      break;
    }
    tick(item.name);
    // Decrypt into a temp plaintext file (streamed, bounded memory) so large
    // videos/docs never OOM during export, then route that file to the best
    // destination. The temp file is always cleaned up.
    let tempUri: string | null = null;
    try {
      const tmp = new File(Paths.cache, `_export_${generateId()}${safeExt(item.name)}`);
      tmp.create();
      tempUri = tmp.uri;
      await decryptEncryptedToFile(key, item.encryptedPath, tempUri);
      const res = await exportDecryptedFile({
        fileName: item.name,
        mimeType: item.mimeType,
        tempUri,
        directoryUri: opts.directoryUri,
      });
      if (res.outcome === 'cancelled') {
        report.cancelled += 1;
      } else if (!res.verified) {
        // Only a verified write lets extract-mode remove the vault copy — the
        // share-sheet leg is unverifiable, so extract mode KEEPS the vault copy
        // (no data loss). Report it gracefully, not as a hard failure.
        if (res.outcome === 'share') {
          report.success += 1;
          if (opts.mode === 'extract') {
            report.errors.push({
              name: item.name,
              message: 'shared, but the vault copy was kept (share is unverifiable)',
            });
          }
        } else {
          report.failed += 1;
          report.errors.push({ name: item.name, message: 'verification failed' });
        }
      } else {
        if (opts.mode === 'extract') {
          await removeStoredItem(item.encryptedPath, item.dbId);
        }
        report.success += 1;
      }
    } catch (err) {
      report.failed += 1;
      report.errors.push({ name: item.name, message: (err as Error).message });
    } finally {
      if (tempUri) {
        try {
          const f = new File(tempUri);
          if (f.exists) f.delete();
        } catch { /* best-effort temp cleanup */ }
      }
    }
    done += 1;
    tick(null);
    // Let the UI repaint between items; large batches should never freeze.
    await yieldToEventLoop();
  }
  tick(null, true); // force a final flush so the UI reflects the finished total
  return report;
}

/**
 * Sanitizes a file name so MediaLibrary can infer a valid mime type from the
 * extension. Non-alphanumeric characters become underscores; the extension is
 * kept so saveToLibraryAsync succeeds on Android.
 */
function sanitizeExportName(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100) || 'export';
  const lower = base.toLowerCase();
  const hasExt = /\.[a-z0-9]{1,5}$/.test(lower);
  return hasExt ? base : `${base}.bin`;
}

/** Extracts a short, safe file extension (including the dot) for temp naming. */
function safeExt(name: string): string {
  const match = /\.([a-zA-Z0-9]{1,10})$/.exec(name);
  return match ? `.${match[1]!.toLowerCase()}` : '.bin';
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const part = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...part);
  }
  return btoa(binary);
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += (bytes[i] as number).toString(16).padStart(2, '0');
  return hex;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export interface DeleteSourceResult {
  cacheRemoved: boolean;
  galleryRemoved: boolean;
}

/**
 * Best-effort removal of an imported source file after it has been encrypted
 * into the vault. Deletes the app-owned cache/temp copy and, when an `assetId`
 * is available, requests write-only media-library permission to remove the
 * original from the device gallery. Never throws so an import can never break
 * because of a cleanup failure.
 */
export async function deleteImportedSource(uri: string, assetId?: string | null): Promise<DeleteSourceResult> {
  const result: DeleteSourceResult = { cacheRemoved: false, galleryRemoved: false };

  try {
    const src = new File(uri);
    if (src.exists) {
      src.delete();
      result.cacheRemoved = true;
    }
  } catch {
    // best-effort cleanup
  }

  if (assetId) {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      if (status === 'granted') {
        result.galleryRemoved = await MediaLibrary.deleteAssetsAsync(assetId);
      }
    } catch {
      // best-effort cleanup
    }
  }

  return result;
}
