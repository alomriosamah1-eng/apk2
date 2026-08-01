# 24 — Storage Locations

Map of every on-device storage location, its content, and encryption status.

## 24.1 Storage Map (Mermaid)

```mermaid
graph TD
  ROOT[expo-file-system Paths.document] --> SQLITE[SQLite/khaznati.db]
  ROOT --> KHAZ[khaznati/]
  KHAZ --> V1[khaznati/{vaultId}/ files tab]
  KHAZ --> ENC[.encrypted_media/*.enc]
  ROOT --> BK[backups/khaznati-backup-*.kzb]
  CACHE[Paths.cache] --> EXP[khaznati_export/ temp]
  SECURE[expo-secure-store] --> KEYS[keys/flags/PIN]
```

## 24.2 Locations Detail

| Location | Contents | Encrypted | Producer | Consumer |
|---|---|---|---|---|
| `document/SQLite/khaznati.db` | relational DB (vaults/items/notes/passwords/log/settings) | Partial (optional PRAGMA key) | DatabaseService | all repositories |
| `document/SQLite/khaznati.db-wal/-shm` | WAL journal files | — | SQLite WAL mode | expo-sqlite |
| `document/khaznati/{vaultId}/` | imported files (raw) | **No** | files.tsx `copyImportedFile` | FilesList, file-preview |
| `document/khaznati/{vaultId}/.encrypted_media/*.enc` | encrypted image payloads (base64 text) | Yes (encryptFile) | MediaStorage.persistEncryptedImage | media.tsx decrypt |
| `document/backups/*.kzb` | DB backup copies | DB-level | settings.tsx backup | settings.tsx restore |
| `cache/khaznati_export/` | temp export files | No (transient) | media/files export | media-library save; deleted after |
| SecureStore | keys + flags + biometric PIN + remember | OS-level | many | many |

## 24.3 File-System API

- Uses the modern **`expo-file-system`** API: `Paths.document`, `Paths.cache`, `Directory`, `File` (e.g. `settings.tsx:4`, `media.tsx:5`, `files.tsx:5`).
- `DatabaseService` uses **legacy** API (`expo-file-system/legacy`) for `documentDirectory`, `copyAsync`, `makeDirectoryAsync` (`DatabaseService.ts:2,18,133-141`).

## 24.4 Storage Lifecycle

- **Create**: dirs created lazily on first use with `create({ intermediates:true, idempotent:true })`.
- **Delete**: 
  - Single file delete: `new File(id).delete()` (files.tsx:145,188; media.tsx:87).
  - Vault dir delete (clear-all): `khaznatiDir.delete()` (settings.tsx:210).
  - DB delete: never in normal flow; clear-all deletes vaults via repo.
- **No** recycle-bin/trash; soft-delete flag exists in items schema but Files tab does hard delete.

## 24.5 Persistence of App State

| State | Where | Lifetime |
|---|---|---|
| Theme mode | React state (ThemeProvider) | in-memory only |
| Language | i18next state | in-memory only |
| Session (unlocked/active vault) | React state (SessionProvider) | in-memory; auto-lock clears |
| Auto-lock timeout | SecureStore `auto_lock_timeout` | persistent |
| Vault data | SQLite | persistent |

## 24.6 Backup Coverage Gaps

- Backup copies **only** the DB file — encrypted media files (`.encrypted_media`), imported raw files, and SecureStore keys are **not** backed up. Restoring a backup without the SecureStore keys yields undecryptable content.
- Restore does not verify checksum/integrity beyond DB self-check.
