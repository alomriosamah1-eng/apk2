# 14 — Migration Plan (خطة الترحيل/الترقية)

> How existing (and future) users' data moves through the recovery. Two audiences: (A) dev/CI data pipelines, (B) existing user data on devices. Phase 0.2/4/14 + each feature's data change.

## 1. Migration Principles

1. **Non-destructive**: new columns additive; destructive changes = new table + copy.
2. **Versioned**: every piece of crypto/backup carries a version byte; readers understand older versions.
3. **Lazy re-encrypt**: old ciphertext re-encrypted on read (not bulk rewrite) to avoid startup cost.
4. **Backup before change**: migration v3+ runs inside a DB transaction; user data backed up pre-restore.
5. **Field-level truth**: DB metadata plaintext, secret fields encrypted (09). Never claim whole-file encryption.

## 2. Data Pipelines to Migrate

| Pipeline | Current | Target | Phase |
|---|---|---|---|
| Notes/passwords content | `aes-256-gcm` (V1) | same algo + `cipher_version` col; lazy re-wrap | 0.2 |
| Files on disk | plaintext `{name}` | `files/{id}.enc` | 0.2 |
| Media `.enc` | V1 header | add version byte (keep compat) | 0.2 |
| Vault key storage | SecureStore plaintext PIN used for biometric | wrapped key + biometric token | 0.3/0.4 |
| Backup files | raw DB copy | `.kzb` v2 container | 4 |
| Settings | `AsyncStorage`-style/defaults | `settings` table via repo | 7.4 |
| DB | v2 | v3 (additive columns) | 0.6 |

## 3. DB Migration v3 (detailed)

```sql
-- additive only
ALTER TABLE vaults   ADD COLUMN cipher_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE items    ADD COLUMN cipher_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE activity_log ADD COLUMN vault_id INTEGER NULL; -- no longer required to be non-null
ALTER TABLE items    ADD COLUMN content_hash TEXT NULL;     -- optional future dedupe
CREATE INDEX IF NOT EXISTS idx_items_vault_parent_deleted ON items(vault_id, parent_id, is_deleted);
```
- `_migrations` gets `(3, 'v3_field_version')` row via `MigrationRunner`.
- No user data transformation in this step; only schema + version flag.

## 4. Legacy Crypto Reader (V1)

- Keep `decryptV1` for old ciphertext (notes/passwords/media headers without version byte).
- On read: if `cipher_version=1` → decrypt with legacy path → optionally re-encrypt (V2) and update row (background, throttled).
- Remove legacy reader only after a release with 100% migration (per telemetry/scan, or 2 releases later).

## 5. File Migration (`files/` plaintext → encrypted)

- New imports → encrypted immediately (Phase 0.2).
- Existing plaintext files → migration job:
  1. snapshot DB + list files
  2. for each plaintext file: read → encrypt → write `files/{id}.enc` → update row `path` → delete original
  3. verify row/file count before deleting originals
- Runs once at first launch post-update; progress UI; resume-safe (idempotent by checking `path` extension/row flag).

## 6. Backup v1 → v2

- Reader supports v1 raw-DB import (wrap it as v2 with `legacy:true` manifest).
- New backups always v2 with checksum + key manifest + migration list (04/4, 10 §8).
- Restore prefers v2; v1 accepted with warning.

## 7. Keystore/SecureStore Migration

- On PIN change: rewrap all per-vault keys with new PIN-derived KEK (already intended; make atomic: rewrap keys → then update encrypted PIN-token, else rollback).
- Biometric token: replace plaintext PIN storage with encrypted token; if device has old plaintext PIN, upgrade on next unlock (Phase 0.3/0.4).

## 8. User-Facing Upgrade Flow

1. Update installed → integrityCheck → detect old version(s) (`cipher_version`, legacy files, v1 backups).
2. Show "One-time upgrade in progress" if file migration needed (Phase 0.2) with progress; do NOT block app if only schema.
3. On completion: `settings.upgrade_done=1`; clear flag on rollback.

## 9. Rollback Plan

- Pre-migration DB snapshot + file manifest backup auto-created (tmp, then merged into `.kzb` or `.bak`).
- If migration fails midway: restore snapshot, mark version as previous, prompt retry (don't auto-loop).
- Data-lossy steps (delete plaintext file) only run after verification step passes.

## 10. Testing Migration

- Unit/integration: run v1 DB fixture → apply v3 → assert schema + data intact; round-trip legacy ciphertext.
- File migration: fixture dir with plaintext + encrypted files → run job → assert all encrypted, originals removed only after verify.
- Backup v1→v2 restore test.
- CI job `migration-tests` in Phase 8 gate.

## 11. When to Ship Migrations

- v1.1.0 (this release): v3 schema + legacy reader + file migration job + backup v2 write path (Phase 4).
- v1.2.0: lazy re-encrypt background job; drop legacy reader if scan shows clean.
- Any schema change after v3 follows §1 rules.

## 12. Definition of Done (Migration)

- [ ] All DB columns additive; no data-loss path without backup
- [ ] Legacy reader covers V1 ciphertext
- [ ] File migration idempotent + resume-safe
- [ ] v1 backups restorable
- [ ] Rollback snapshot works in test
- [ ] CI `migration-tests` green
