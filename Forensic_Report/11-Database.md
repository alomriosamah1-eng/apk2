# 11 — Database

## Serialization / API correctness (ROOT CAUSE of most features)
- `SCHEMA` (`schema.ts:2-92`) is a single multi-statement string. Migration 001 runs it via `executeSql` → `runSync` → `sqlite3_prepare_v2(..., pzTail=nullptr)` which executes only the **first** statement (`CREATE TABLE vaults`). The other 4 tables + 11 indexes are silently dropped. **RC-1.**
- `execSync`/`execAsync` (multi-statement) exist in the expo-sqlite API (`SQLiteDatabase.d.ts:135`) but are not used for schema.
- **Consequence:** fresh install has only `vaults`. `INSERT/UPDATE/SELECT items|notes|passwords|activity_log` throw `no such table` (caught → `failure(DatabaseError)` → silent UI).

## Tables intended by schema.ts
| Table | Purpose |
|---|---|
| `vaults` (:3-19) | metadata, is_locked, encrypted_pin_hash, pin_salt, counters |
| `items` (:21-39) | files/media metadata, FK→vaults, encrypted_path/data, favorite/deleted |
| `notes` (:41-52) | title, encrypted_content, color, is_pinned |
| `passwords` (:54-68) | service, username, encrypted_password, category, strength |
| `activity_log` (:70-79) | audit trail |
| + 11 indexes (:81-91) | |

## Migration runner
- `MigrationRunner.ts:12-60` — registers 2 migrations; tracks in `_migrations` + PRAGMA `user_version`.
- `getVersion` (`DatabaseService.ts:138-142`) reads column `version` from `PRAGMA user_version` (actual column is `user_version`) → **always returns 0** (06 F-H6). `run` therefore relies on `_migrations` table MAX, masking the column bug.
- **On fresh install:** migration 1 `up()` succeeds (only vaults created) → inserts `_migrations` v1 → sets `user_version`=1 (never read correctly). Migration 2 (`002_indexes.ts:5`, `CREATE INDEX ... ON items`) throws `no such table: items` → `runner.run` rejects → caught in `_layout.tsx:80-81` "App initialization failed". **This repeats every launch; `integrityCheck` and `preventScreenCaptureAsync` never run.**
- Migration down path (`MigrationRunner.ts:51-59`) is present.

## DatabaseService
- `openDatabaseSync` (correct SDK16 sync API) (`DatabaseService.ts:30`).
- PRAGMAs: WAL, synchronous=NORMAL, cache_size=-4000, temp_store=MEMORY, foreign_keys=ON — reasonable.
- `executeSql`/`query`/`queryOne`/`transaction` all wrapped in `withRetry` (`resilience.ts:12-32`) — exponential backoff on errors; masks root errors and adds latency.
- **`PRAGMA key = ?`** (`DatabaseService.ts:46`) is SQLCipher syntax; expo-sqlite ships plain SQLite → throws → caught → `FIELD_ENCRYPTED`. Whole-file encryption is nominal; real protection is field-level AES-GCM (see 14). `db_encryption_key` generated/stored in SecureStore but never consumed.
- `integrityCheck` full `PRAGMA integrity_check` on startup (perf P-1).

## Repository layer
All real INSERT/UPDATE/SELECT SQL, correctly parameterized, mapped via DTO→Mapper→Entity. Sound. Broken only because tables don't exist (RC-1):
- `VaultRepositoryImpl` — works.
- `ItemRepositoryImpl` — INSERT items fails (RC-1).
- `NoteRepositoryImpl` — INSERT notes fails (RC-1); re-decrypts every row on load (P-3).
- `PasswordRepositoryImpl` — INSERT passwords fails (RC-1); decrypts every row (P-3).
- `ActivityLogRepositoryImpl` — INSERT activity_log fails (RC-1); also `vault_id: undefined` hardcoded (line 30).
- `VaultRepositoryImpl.update` (55-70) omits `encrypted_pin_hash`/`pin_salt` → PIN-hash upgrade in `UnlockVaultUseCase` is a no-op (06 F-H8).

## Integrity / FK
- `foreign_keys=ON`; `vault_id` FK → `notes/passwords/items/activity_log`. Fallback literal `'default'` (notes.tsx:29, passwords.tsx:40) → FK violation on deep-link/direct-tab entry (06 N2/P2).

## Backup (cross-ref 08)
- `allowBackup=true` with encrypted DB + media backed up but keystore keys excluded → cloud-restore data loss (08 A-1).

## Migrations fix direction (honest, non-prescriptive)
Use multi-statement `execSync` for schema (or split statements), correct `getVersion` column mapping, ensure migration 2 applies, and re-run `integrityCheck`/`preventScreenCapture` after migrations.