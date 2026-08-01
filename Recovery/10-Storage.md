# 10 — Storage Plan (التخزين)

> Current map from `OSS/24`; design decisions here align with `08` (security) and `09` (database).

## 1. Target Storage Layout

```
expo-file-system Paths.document
├── SQLite/khaznati.db (+ -wal, -shm)          // field-level encrypted
├── khaznati/
│   └── {vaultId}/
│       ├── files/            // ALL imported files → {id}.enc (AES-256-GCM)  [fixes R1]
│       ├── .encrypted_media/ // *.enc images (keep)                          [existing]
│       └── .thumbs/          // thumbnail cache                              [Phase 2]
├── backups/khaznati-backup-{ts}.kzb            // Backup v2 (magic+checksum+manifest)
└── .export/                                    // temp decrypted exports (transient)
Paths.cache/khaznati_export/                    // transient share temp
expo-secure-store                               // wrapped keys, tokens, remember flag, settings-timeout
```

## 2. Change Summary vs Current (`OSS/24`)

| Path | Current | Change | Phase |
|---|---|---|---|
| `khaznati/{vaultId}/*` (files) | plaintext | → `files/{id}.enc` encrypted | 0.2 |
| `.encrypted_media/*.enc` | encrypted | keep | — |
| `backups/*.kzb` | raw DB copy | → Backup v2 container | 4.1 |
| `cache/khaznati_export` | temp | keep; ensure binary | 3.4 |
| SecureStore | keys+flags+plaintext PIN | drop plaintext PIN; wrapped keys/tokens | 0.4 |

## 3. File Naming & Metadata

- Store files as `{itemId}.enc` (id stable across rename) — rename updates DB row only (Phase 3.6).
- Keep original `name` + `mime_type` + `size` in `items` row (needed for listing/preview).
- Media stays `{ts}.{ext}.enc` (existing).

## 4. Encryption-at-Rest Matrix

| Store | Content | Cipher | Key source |
|---|---|---|---|
| SQLite | metadata + encrypted fields | field-level (09) | KeyManager |
| files/*.enc | imported files | AES-256-GCM | `file` scope key |
| .encrypted_media/*.enc | media | AES-256-GCM | `media` scope key |
| SecureStore | wrapped keys / tokens | OS Keystore | device |
| backups/*.kzb | db + media + keys | container + key-manifest | recovery key |
| temp export | transient plaintext | none | deleted after use |

## 5. Lifecycle & Cleanup

| Event | Action |
|---|---|
| Vault delete | secure-delete files/`.thumbs`, delete keys+tokens+remember (Phase 5.3/7) |
| Clear-all | delete `khaznati/`, backups, all per-vault SecureStore keys |
| Export | write temp → share/save → delete temp |
| Thumbnail cache | purge older than `thumbnailCacheDays` (config exists) |
| Activity log | prune > 500 rows |
| Backup | keep last N (config) |

## 6. Import/Export Paths (single pipeline)

```
IMPORT: picker(uri) → read chunks → encrypt(vaultKey) → write files/{id}.enc → insert item row → (optional thumb)
EXPORT: read .enc → decrypt → write binary temp → MediaLibrary/Sharing → delete temp
```
Both streamed; no whole-file base64 in JS heap (Phase 2/3). Verify: same code path used by media and files tabs.

## 7. Permissions & Scoped Storage

- All app data in app-private `Paths.document` → **no storage permissions required** for own files.
- User gallery import: system Photo Picker (no permission on API 33+; `READ_MEDIA_*` for legacy pickers).
- Gallery save/export: `expo-media-library` (API handles scoped storage).
- Document import: `expo-document-picker` (system).
- Android backup: `android:allowBackup="false"` + exclude `SQLite`, `khaznati/`, keys (06).

## 8. Backup/Restore Storage (Phase 4)

- Backup container `.kzb`: header(magic+version) → payload(manifest, db dump, media files, wrapped keys) → SHA-256 trailer.
- Restore: verify → snapshot current → swap DB → write media → restore keys → validate → reload; rollback on failure.
- Store backups under `document/backups/` (survives), export/share to user-selected location.

## 9. Space/Size Management

| Concern | Control |
|---|---|
| Large media | streaming; no full-file memory |
| Duplicate imports | optional dedupe by content hash (future) |
| Orphan `.enc` files | reconcile against `items` on load (stray file cleanup) |
| Storage full | catch write errors → user message; reserve headroom |

## 10. Testing (storage)

- Mock `FileSystem`/`Directory`/`File`; test import/export/delete/rename and cleanup paths.
- Backup round-trip test on tmp dir.
- Verify no plaintext residue after delete (best-effort).
