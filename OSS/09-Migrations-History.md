# 09 — Migrations History

## 1. Migration Infrastructure

- Runner: `src/data/database/MigrationRunner.ts` — `register()`, `run(db, targetVersion?)`, `getStatus(db)`.
- Registration: `src/core/di/register.ts:25-30` — `createMigrationRunner()` registers both migrations.
- Executed at boot: `app/_layout.tsx:72-73`.
- Version tracking: `_migrations` table + `PRAGMA user_version` (max wins, `MigrationRunner.ts:31-34`).
- Both up and down supported (down used when target < current).

## 2. Migration Log

| Version | Name | Up | Down | Evidence |
|---|---|---|---|---|
| 1 | initial | Creates all 7 tables + 11 indexes via `SCHEMA` | Drops tables in reverse order (backup_metadata → vaults) | `001_initial.ts:5-17` |
| 2 | indexes | Adds 7 performance indexes | Drops those indexes | `002_indexes.ts:4-22` |

## 3. Indexes Per Version

| Version | Indexes |
|---|---|
| 1 (`schema.ts:97-107`) | items: vault_id, parent_id, type, deleted, favorite; notes: vault_id, pinned; passwords: vault_id, category; activity_log: created, action |
| 2 (`002_indexes.ts:5-11`) | items: vault_id, parent_id, updated_at, type; vaults: updated_at; activity_log: vault_id, created_at |

> Note: `idx_items_vault_id`, `idx_items_parent_id`, `idx_items_type`, `idx_activity_log_created` are created by **both** migrations (idempotent `IF NOT EXISTS`).

## 4. Migration Flow (Mermaid)

```mermaid
graph TD
  A[Boot: app/_layout.tsx] --> B[resolve MigrationRunner]
  B --> C[runner.run db]
  C --> D[ensure _migrations table]
  D --> E[version = max user_version, max(_migrations)]
  E --> F{current < target?}
  F -->|yes| G[for each migration v>current && v<=target]
  G --> H[migration.up db]
  H --> I[INSERT _migrations]
  I --> J[set user_version]
  F -->|no, current > target| K[reverse: migration.down]
  K --> L[DELETE _migrations row]
  L --> M[set user_version - 1]
```

## 5. Status API

`getStatus(db)` returns `{ version, migrations: [{version,name,applied}] }` (`MigrationRunner.ts:63-76`) — supports a future diagnostics UI; currently unused by screens.

## 6. Observations

- Version 2 partially duplicates version 1 indexes (harmless due to `IF NOT EXISTS`).
- No migration for `backup_metadata` writes; table unused.
- Down path exists but no rollback UI; a manual revert would require `runner.run(db, target)`.
