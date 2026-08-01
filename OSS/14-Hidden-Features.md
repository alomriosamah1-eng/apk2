# 14 — Hidden Features & Dead Code

Survey of unused code paths, dead registrations, unreachable routes, and config constants that imply features that don't exist in code. **No fixes applied** (OSS rules).

## 14.1 Unused Components (built but never imported)

Verified via project-wide grep (`grep -rn <Name> app src` excluding the component file itself):

| Component | File | Usage count outside itself |
|---|---|---|
| `BottomSheet` | `src/ui/components/molecules/BottomSheet.tsx` | 0 |
| `Dialog` | `src/ui/components/molecules/Dialog.tsx` | 0 |
| `GlassCard` | `src/ui/components/molecules/GlassCard.tsx` | 0 |
| `Snackbar` | `src/ui/components/atoms/Snackbar.tsx` | 0 |
| `Skeleton` | `src/ui/components/atoms/Skeleton.tsx` | 0 |
| `VaultCard` | `src/ui/components/organisms/VaultCard.tsx` | 0 |
| `ItemRow` | `src/ui/components/organisms/ItemRow.tsx` | 0 |

All re-exported through `components/{atoms,molecules,organisms}/index.ts` and `components/index.ts` — public API surface larger than used.

## 14.2 Unused Hooks

| Hook | File | Usage |
|---|---|---|
| `useAppState` | `src/ui/hooks/useAppState.ts` | exported via `hooks/index.ts` only |
| `useDebounce` | `src/ui/hooks/useDebounce.ts` | exported only |
| `useResponsive` | `src/ui/hooks/useResponsive.ts` | used only in `welcome.tsx:8,16` |

> Note: `SessionProvider` implements its own AppState listener instead of using `useAppState` (`SessionProvider.tsx:76-97`) — duplicated logic.

## 14.3 Dead DI Registrations

Registered singletons never resolved by any screen/hook:

| Token | Registration line |
|---|---|
| `FileSystemSource` | `register.ts:37-39` |
| `SettingsRepository` | `register.ts:67-69` |
| `AddItemUseCase` | `register.ts:90-92` |
| `DeleteItemUseCase` | `register.ts:93-95` |
| `SearchItemsUseCase` | `register.ts:96-98` |

Screens bypass use-cases and call repository methods directly (`files.tsx:46,98`, `notes.tsx:38,84`, `passwords.tsx:46,84`).

## 14.4 Unreachable / Dead Routes

| Screen | Evidence |
|---|---|
| `biometric-setup.tsx` | Registered in auth stack (`app/(auth)/_layout.tsx:19`) but **no `router.push/replace` target anywhere** — unreachable. Flow always goes create-vault → vault directly. |
| `create-folder.tsx` | Registered (`modals/_layout.tsx:18`); no push target found (folder creation not wired from FilesList UI). |

## 14.5 Config Constants / Settings With No Implementation

| Constant | Where defined | Runtime usage |
|---|---|---|
| `security.pbkdf2Iterations` | config.ts:18 | none (hashPin hardcodes 100000) |
| `security.algorithm: 'aes-256-gcm'` | config.ts:23 | misleading (see 07) |
| `security.autoLockSeconds: 60` | config.ts:26 | none (SessionProvider default 300000) |
| `security.sessionTimeoutMs: 15min` | config.ts:27 | none |
| `security.clipboardClearMs: 10000` | config.ts:28 | none (no clear logic) |
| `storage.thumbnailsMaxWidth` | config.ts:33 | none (no thumbnail generation) |
| `storage.maxFileSize` / `chunkSize` | config.ts:35-36 | none |
| `backup.magicHeader` / `currentVersion` | config.ts:42-43 | none (backup is raw DB copy) |
| `rootDetectionEnabled` (settings) | SettingsRepositoryImpl:15 | no root-detection code |
| `secureDeleteEnabled` (settings) | SettingsRepositoryImpl:16 | deletes use plain `File.delete` |
| `autoBackupEnabled` / `autoBackupIntervalDays` | SettingsRepositoryImpl:20-21 | no scheduler |
| `thumbnailQuality` / `storagePath` | SettingsRepositoryImpl:18-19 | unused |
| `AuthMethod.PASSWORD`, `PATTERN`, `LockType.*` variants | enums.ts | unused enum values |

## 14.6 Features That Appear Broken / Incomplete

| Feature | Evidence | Impact |
|---|---|---|
| **Activity log never populated** | No `.log()` call in app/src; modal reads empty table (`activity-log.tsx:41-45`) | Activity log always empty |
| **Files tab stores plaintext** | `copyImportedFile` raw copy (`files.tsx:22-31`); `ItemRepository.create` no encryption (`files.tsx:98-115`) | "Everything encrypted" claim false for files |
| **Biometric flag not enforced** | Login shows biometric button whenever `isAvailable` (`login.tsx:167`), ignores `biometric_enabled` | Toggle in settings has no effect on login |
| **Clipboard protection flag only** | `settings.tsx:84-88` stores boolean; no clipboard clearing logic | No actual protection |
| **Media export writes base64 text** | `tempFile.write(decryptedBase64)` writes the **base64 string** not binary (`media.tsx:158`) | Exported file may be corrupt/encoded |
| **backup_metadata never written** | table in schema; no writer | Backup versioning unavailable |
| **DB PRAGMA key silent fallback** | `DatabaseService.ts:31-35` | Unencrypted DB possible without warning |
| **`biometric_enabled` default false but PIN always stored** | create-vault stores PIN regardless (`create-vault.tsx:67-68`) | User can't "undo" stored PIN via UI |

## 14.7 Useful-but-Unused Public API

Ready-made infrastructure that could be wired up (informational):
- `ItemRepository` full CRUD incl. soft-delete/restore/move/favorite/search (10-Data-Repositories.md).
- `ActivityLogRepository.log` + action enum (20 actions defined in enums.ts:48-69).
- `MigrationRunner.getStatus`.
- `SettingsRepository` (persist settings per vault).
- `DatabaseService.backup/integrityCheck`.
