# 23 — Data Formats

DTOs, mappers, and on-disk formats.

## 23.1 DTO ↔ Entity Mapping (all in `src/data/dto` + `src/data/mappers`)

Snake_case DB columns ↔ camelCase entities. Five pairs:

| Entity | DTO | Mapper | Key columns |
|---|---|---|---|
| Vault | VaultDTO | VaultMapper | all 16 columns incl. encrypted_pin_hash, pin_salt, failed_attempts, locked_until, item_count, total_size, backup_version |
| Item | ItemDTO | ItemMapper | name, type, mime_type, size, encrypted_path, encrypted_data, thumbnail_path, metadata_json, is_favorite, is_deleted, deleted_at |
| Note | NoteDTO | NoteMapper | title, encrypted_content, is_encrypted, color, is_pinned |
| Password | PasswordDTO | PasswordMapper | service_name, service_url, username, encrypted_password, category, notes, strength_score, last_used_at |
| ActivityLog | ActivityLogDTO | ActivityLogMapper | action, target_type, target_id, metadata_json, vault_id, created_at |

Mapper pattern: `toDTO(entity)` / `toEntity(dto)` (e.g. `VaultMapper.ts:17,39`).

## 23.2 Encrypted Payload Format (crypto.ts)

**Hex string layout**: `[IV 12B][TAG 16B][ciphertext]` (`crypto.ts:67-71`).
- For `encryptData/decryptData` → hex string (DB text columns).
- For `encryptFile/decryptFile` → base64 string (`.enc` files, `media.tsx:116,136`).

## 23.3 Backup File Format (`.kzb`)

| Aspect | Value | Evidence |
|---|---|---|
| Extension | `.kzb` | settings.tsx:134,140 |
| Content | **raw copy** of `SQLite/khaznati.db` | settings.tsx:138-142 |
| Magic header | `KHAZNAti` (config only, unused) | config.ts:42 |
| Checksum | config backup has none; `backup_metadata` table has checksum column but no writer | schema.ts:93 |
| Versioning | `backup_version` column default 0 (unused beyond default) | CreateVaultUseCase.ts:54 |

## 23.4 File-System Naming

| Purpose | Pattern | Example | Evidence |
|---|---|---|---|
| Files dir | `document/khaznati/{vaultId}/` | `khaznati/abc/` | files.tsx:22 |
| Media enc file | `.encrypted_media/{ts}.{ext}.enc` | `1690000000000.jpg.enc` | MediaStorage.ts:37 |
| Backup file | `backups/khaznati-backup-{ts}.kzb` | `khaznati-backup-1712345678901.kzb` | settings.tsx:134,140 |
| Export temp | `cache/khaznati_export/{name}` | | media.tsx:155-158, files.tsx:167-171 |

## 23.5 SecureStore Key-Value Formats

| Key | Value type | Written by |
|---|---|---|
| `db_encryption_key` | 64-hex | DatabaseService.ts:27 |
| `biometric_pin_{vaultId}` | plaintext PIN string | BiometricUnlockUseCase.ts:38 |
| `note_vault_key_{vaultId}` | 64-hex | NoteRepositoryImpl.ts:23 |
| `pwd_vault_key_{vaultId}` | 64-hex | PasswordRepositoryImpl.ts:23 |
| `media_vault_key_{vaultId}` | 64-hex | MediaStorage.ts:15 |
| `biometric_enabled` | `'true'` | biometric-setup.tsx:24 |
| `auto_lock_timeout` | ms number string | settings.tsx:95 |
| `clipboard_protection` | `'true'`/`'false'` | settings.tsx:87 |
| `khaznati_remember_vault_{vaultId}` | `'true'` | login.tsx:63 |

## 23.6 ID & Time Formats

- IDs: UUID v4 via `generateId()` (`src/core/utils/id.ts`).
- Timestamps: epoch ms integers (`Date.now()`, `now()` util) — all `created_at/updated_at` columns.

## 23.7 Metadata JSON

- `items.metadata_json` — free-form object for items (used with `null` in current flows).
- `activity_log.metadata_json` — JSON string of action context (`ActivityLogRepositoryImpl.ts:29`).

## 23.8 Settings Key/Value

`settings` table stores all 17 settings as `key → string(value)` pairs; booleans as `'true'`/`'false'`; numbers as strings (`SettingsRepositoryImpl.ts:65-68`).
