# 09 — Database Plan (قاعدة البيانات)

> Current state from `OSS/08`, `OSS/09`, `OSS/10`, `OSS/23`. Decisions here are recommendations (Phase 0/4).

## 1. Current State

- Engine: `expo-sqlite` (openDatabaseSync, WAL, foreign_keys ON) — `DatabaseService.ts`.
- Tables: `vaults, items, notes, passwords, activity_log, settings, backup_metadata` + `_migrations`.
- Migrations: v1 `initial`, v2 `indexes` (`MigrationRunner`).
- Repos: 6 implementations, DTO/mapper pattern, `Result<T>`.

## 2. Issues Found

| Issue | Evidence | Impact |
|---|---|---|
| `PRAGMA key` ineffective in `expo-sqlite`; silent fallback | `DatabaseService.ts:31-35` | DB plaintext, no warning |
| `activity_log.vault_id` always NULL; never populated | `OSS/10.5` | log useless |
| `backup_metadata` never written | `OSS/08` | versioning unavailable |
| Duplicate indexes (v1∩v2) | `OSS/09` | minor |
| Items: `encrypted_data`/`encrypted_path` dual columns, only path used | `OSS/08` | ambiguity |
| Restore copies raw DB with no checksum/version gate | `settings.tsx:162-193` | corrupt/old backup accepted |
| `vault_id=''` default when param missing (FK violation) | `OSS/02 §4` | silent failure |

## 3. DB Encryption Decision (Phase 0.6 / 4.2)

**Facts**: `expo-sqlite` does not enforce `PRAGMA key` (SQLCipher-only); the code swallows the error. Options:

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| A. Field-level encryption (recommended) | Works with current driver; sensitive columns already encrypted for notes/passwords/media; no dependency | schema metadata (names, sizes) plaintext; more keys to manage | **Recommended** — matches existing 80% pattern |
| B. Real SQLCipher (custom native / `op-sqlcipher` or fork) | full-file encryption | native complexity, CI risk, migration of existing plaintext DB | Stretch only |
| C. Documented plaintext + field-level | simplest | misleads "everything encrypted" | Only as explicit fallback with loud warning |

**Decision (recommended)**: **Option A (field-level)**, with an explicit `DB_ENCRYPTION_STATE` mechanism:
- `DatabaseService` sets state `FIELD_ENCRYPTED` and logs/UI-warns if `PRAGMA key` unsupported (replaces silent fallback).
- All secret-bearing columns encrypted via `KeyManager` (note content, password value, file payload path references, activity metadata where sensitive).
- Remove or clearly flag `algorithm:'aes-256-gcm'` DB-level claims; reflect truth.

> If user later insists on SQLCipher, treat as Phase 4 sub-project with its own migration; keep field-level as fallback.

## 4. Schema Changes (migration v3)

Recommended v3 migration (additive, backward-compatible):

| Change | SQL intent |
|---|---|
| `vaults.cipher_version` INTEGER DEFAULT 1 | per-vault crypto version (Phase 0/14) |
| `items.cipher_version` INTEGER DEFAULT 1 | file-level |
| `settings` fine as-is | key/value |
| `activity_log.vault_id` NOT NULL enforcement? | keep nullable; fix caller to pass vaultId (Phase 3) |
| `backup_metadata` gain `checksum`, `encrypted_key_ref` writers | Phase 4 |
| Add `items.is_deleted/deleted_at` usage for recycle bin (optional) | Phase 4 (recycle bin is optional; files currently hard-delete) |
| Deduplicate indexes | optional cleanup in v4 |

**Backward compat**: all columns additive; existing v1/v2 data migrates without data loss. If field layout of ciphertext changes (V byte), `cipher_version` allows lazy re-encryption on read (`14`).

## 5. Connection & Concurrency

- Keep WAL + `synchronous=NORMAL` + `foreign_keys=ON` (existing).
- Keep `withRetry` for transient failures; do not retry user-cancelled.
- Consider single-writer queue for import/export to avoid SQLITE_BUSY.
- Move heavy repo operations off main thread where possible (JSI sqlite is sync; fine for small ops).

## 6. Query Performance

- Existing indexes cover vault_id/parent/type/deleted/favorite/notes.pinned/passwords.category/activity.created (`OSS/08 §2`).
- Add composite index `items(vault_id, parent_id, is_deleted)` for folder listing if profiling shows need.
- Prune `activity_log` (cap 500; delete older) to bound table size.
- Notes list decrypts all — cache decrypted content in memory per session (no DB change).

## 7. Integrity & Recovery

- `integrityCheck()` at boot (existing) → keep, run async.
- On restore: verify header/version/checksum before swap; keep a pre-restore snapshot to roll back.
- Backup includes `user_version` + migration list so restore can re-apply if needed.

## 8. Migration Strategy Rules

- New migrations only additive in the first 2 releases; destructive changes get a new table + copy.
- `MigrationRunner.getStatus` can power a diagnostics screen (optional).
- Migration rollback (down) kept for dev; no user-facing down path.

## 9. Settings Persistence

- Move theme/language/clipboard/security toggles into `settings` table via `SettingsRepository` (currently registered but unused, `OSS/10.6`) — Phase 7.
- Cache `Settings` in memory; write-through on change.

## 10. Testing

- Repository tests against in-memory SQLite (`openDatabaseSync(':memory:')` or tmp file) with migrations applied.
- Test FK behavior (vault cascade), counts, soft-delete, restore round-trip.
- CI job runs migration tests (Phase 8).
