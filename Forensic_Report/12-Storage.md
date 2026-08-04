# 12 — Storage

Storage subsystems and their state.

## SecureStore (`expo-secure-store`) — settings/keys
`SecureStorageSource.ts:7-11` wraps SecureStore (Android Keystore / iOS Keychain). Stores:
| Key pattern | Owner | Purpose |
|---|---|---|
| `theme_mode` | ThemeProvider | theme preference |
| `app_language` | i18n/index | language |
| `biometric_enabled` | settings | biometric flag |
| `clipboard_protection` | settings/passwords | clip auto-clear toggle |
| `auto_lock_timeout` | SessionProvider | auto-lock ms |
| `db_encryption_key` | DatabaseService | DB key (never used to encrypt files) |
| `biometric_device_key` / `biometric_token_{vaultId}` | BiometricUnlockUseCase | biometric PIN token |
| `note_vault_key_{vaultId}` | NoteRepositoryImpl | note AES key |
| `pwd_vault_key_{vaultId}` | PasswordRepositoryImpl | password AES key |
| `media_vault_key_{vaultId}` | MediaStorage | media AES key |
| `file_vault_key_*` | FileSystemSource (unused) | latent second key space |
| `khaznati_remember_vault_{vaultId}` | login | **write-only** (RC-2) |

**Key security gap (06 H2):** keys are random and stored unwrapped under static names. The vault PIN does not derive/wrap them → PIN gates `is_locked` boolean, not decryption.

## Filesystem (expo-file-system v19)
- **MediaStorage** (module, `MediaStorage.ts`): encrypts to `Paths.document/khaznati/{vid}/.encrypted_media` and Metadata row in `items`. Real, works mechanically; DB insert fails (RC-1).
- **FileSystemSource** (`FileSystemSource.ts:6-166`): full real class (`documentDirectory/khaznati/{files,thumbnails,temp}` + `.nomedia`; secure-delete with 3-chunk overwrite). **Registered but UNUSED** by any screen/repo — a second, unreconciled abstraction + key namespace.
- **AddOptionsSheet / files.tsx direct writes**: `Paths.document/khaznati/{vid}` (not `.encrypted_media`), type FILE. Divergent from MediaStorage → **RC-3**.
- **Export**: decrypt → temp in `Paths.cache/khaznati_export` → `MediaLibrary.saveToLibraryAsync` → delete in `finally` (`MediaStorage.ts:63-73`). Correct.

## SQLite (see 11)
- DB file path: `FileSystem.documentDirectory/SQLite/{name}` (`DatabaseService.ts:31`).

## Consistency assessment
- **Store state at boot:** Theme (`.get` in ThemeProvider) and language (`.get` in `initI18n`) are hydrated. Session/remember-me are **not** (RC-2). Rest is read on demand.
- Two competing filesystem pipelines + SecureStore key namespaces create ambiguity → RC-3 and medium-term data-mapping risk.

## Finding S1 — MEDIUM (high conf): divergent storage abstraction
MediaStorage.js module (`.encrypted_media`, `media_vault_key_*`, type IMAGE) vs FileSystemSource class (`files`, `file_vault_key_*`, unused) vs direct writes (`khaznati/{vid}`, type FILE). One canonical store should be the single source of truth for media/fonts/files (RC-3).

## Finding S2 — MEDIUM (high conf): remember-me not persisted (cross-ref RC-2)
No boot hydration; session in-memory only (`SessionProvider`), so every reload/kill re-locks and the "remember" flag is cosmetic.

## Finding S3 — LOW (medium conf): theme/language persistence is fire-and-forget
`ThemeProvider.tsx:40`, `i18n/index.ts:48` — non-awaited SecureStore writes; tight-but-real race on reload/kill.