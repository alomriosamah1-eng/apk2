# 10 — Data Repositories

Six repository implementations in `src/data/repositories/`, each implementing a `src/domain/repositories/*` interface. All return `Result<T>` and map via DTO/mapper pairs.

## 10.1 VaultRepositoryImpl (`VaultRepositoryImpl.ts`)

Constructor: `(db: DatabaseService)` (`:12`).
| Method | SQL / Behavior | Line |
|---|---|---|
| `create(vault)` | INSERT all 16 columns | `:15-30` |
| `findById` | SELECT by id | `:35-42` |
| `findAll` | ORDER BY created_at DESC | `:45-52` |
| `update` | UPDATE name/type/icon/color/... | `:55-69` |
| `delete` | DELETE by id | `:72-79` |
| `updateLastAccessed` | now() | `:82-92` |
| `lock` | is_locked=1 | `:95-102` |
| `unlock` | is_locked=0 + last_accessed_at | `:105-115` |
| `updateFields` | partial failed_attempts/locked_until | `:118-143` |
| `count` | COUNT(*) | `:146-153` |

## 10.2 ItemRepositoryImpl (`ItemRepositoryImpl.ts`)

Constructor: `(db: DatabaseService)` (`:13`).
| Method | Behavior | Line |
|---|---|---|
| `create` | INSERT + `updateVaultCounts` | `:16-34` |
| `findById` | by id | `:37-44` |
| `findByVaultId` | filters (type/sort/limit/offset) | `:47-78` |
| `findByParentId` | folder children | `:81-98` |
| `update` | full update | `:101-117` |
| `delete` | hard delete in transaction + recount | `:120-134` |
| `softDelete` | is_deleted=1 + deleted_at | `:137-147` |
| `restore` | is_deleted=0 | `:150-160` |
| `move` | parent_id change | `:163-173` |
| `toggleFavorite` | toggle flag | `:176-186` |
| `search` | name LIKE | `:189-199` |
| `countByVaultId` / `getTotalSize` | aggregates | `:202-225` |
| `getRecentItems(limit)` | newest first | `:228-238` |
| private `updateVaultCounts` | updates vaults.item_count/total_size | `:240-249` |

**Security note**: items pass through unencrypted (no crypto in this repository) — encryption responsibility sits with callers/media flow.

## 10.3 NoteRepositoryImpl (`NoteRepositoryImpl.ts`)

Constructor: `(db, secureStorage)` (`:13-16`). Encrypts content with per-vault key `note_vault_key_{vaultId}` (`:18-26`).
| Method | Behavior | Line |
|---|---|---|
| `create` | encrypt + INSERT | `:28-43` |
| `findById` | decrypt via `decryptNote` | `:45-53` |
| `findByVaultId` | ORDER pinned DESC, updated DESC, decrypt all | `:55-66` |
| `update` | encrypt + UPDATE | `:68-83` |
| `delete` | DELETE | `:85-92` |
| `togglePin` | toggle flag SQL | `:94-104` |
| `search` | title LIKE, decrypt | `:106-117` |
| private `decryptNote` | decrypt or `'[encrypted]'` | `:119-129` |

## 10.4 PasswordRepositoryImpl (`PasswordRepositoryImpl.ts`)

Constructor: `(db, secureStorage)` (`:13-16`). Key `pwd_vault_key_{vaultId}` (`:18-26`).
| Method | Behavior | Line |
|---|---|---|
| `create` | encrypt + INSERT | `:28-45` |
| `findById` | decrypt or `'[encrypted]'` | `:47-62` |
| `findByVaultId` | ORDER service_name ASC, decrypt all | `:64-84` |
| `update` | encrypt + UPDATE | `:86-101` |
| `delete` | DELETE | `:103-110` |
| `search` | LIKE on name/username/category | `:112-124` |
| `updateLastUsed` | now() | `:126-136` |

## 10.5 ActivityLogRepositoryImpl (`ActivityLogRepositoryImpl.ts`)

Constructor: `(db)` (`:14`).
| Method | Behavior | Line |
|---|---|---|
| `log(action,targetType,targetId,metadata)` | INSERT (vault_id **undefined** → NULL) | `:17-41` |
| `findAll(options)` | filter by actions, limit/offset | `:44-70` |
| `findByAction` | WHERE action = ? | `:73-83` |
| `getRecent(limit)` | newest first LIMIT | `:86-96` |
| `clear` | DELETE all | `:99-106` |
| `count` | COUNT(*) | `:109-116` |

**Key finding**: `.log()` is never invoked by any screen — table remains empty in normal operation (see `14`).

## 10.6 SettingsRepositoryImpl (`SettingsRepositoryImpl.ts`)

Constructor: `(db)` (`:25`).
- `DEFAULT_SETTINGS` (17 keys) defined `:7-22`.
- `get()` — loads all, coalesces defaults (`:29-56`).
- `update(partial)` — merge + `INSERT OR REPLACE` in transaction (`:59-83`).
- `getValue/setValue` — single key ops (`:86-109`).
- `getDefaults()` — clone (`:112-114`).
- **Unused**: registered in DI (`register.ts:67-69`) but never resolved by any screen.

## 10.7 DI Wiring (`register.ts`)

| Token | Implementation | Dependencies | Line |
|---|---|---|---|
| `DatabaseService` | — | — | `:35` |
| `SecureStorageSource` | — | — | `:36` |
| `FileSystemSource` | — | SecureStorageSource | `:37-39` |
| `MigrationRunner` | — | — | `:43` |
| `VaultRepository` | VaultRepositoryImpl | db | `:46-48` |
| `ItemRepository` | ItemRepositoryImpl | db | `:49-51` |
| `NoteRepository` | NoteRepositoryImpl | db, secure | `:52-57` |
| `PasswordRepository` | PasswordRepositoryImpl | db, secure | `:58-63` |
| `ActivityLogRepository` | ActivityLogRepositoryImpl | db | `:64-66` |
| `SettingsRepository` | SettingsRepositoryImpl | db | `:67-69` |
