# 16 — Services Registry

Application services (runtime singletons + external SDK wrappers).

## 16.1 In-App Services (DI singletons)

| Service | Impl | Provides | Resolved by |
|---|---|---|---|
| DatabaseService | SQLite wrapper | open, PRAGMAs, query/execute/transaction, backup/restore, integrity | layout, all repositories |
| SecureStorageSource | expo-secure-store | set/get/delete/contains/isAvailable | repos, session, auth screens, settings |
| FileSystemSource | expo-file-system wrapper | file ops | **registered only (unused)** |
| MigrationRunner | migration engine | run/getStatus | layout |

## 16.2 External SDK Services (used directly)

| Service | Package | Usage sites |
|---|---|---|
| LocalAuthentication | expo-local-authentication | `useBiometrics.ts` (hasHardware/isEnrolled/getEnrolledLevel/authenticateAsync) |
| SecureStore | expo-secure-store | `SecureStorageSource.ts:8-31` |
| expo-crypto | crypto primitives | `crypto.ts`, `secure.ts` (getRandomBytes, digestStringAsync) |
| expo-sqlite | database | `DatabaseService.ts:1,17` |
| expo-file-system | paths/files | files/media/settings screens, MediaStorage |
| expo-document-picker | pick files | files.tsx, settings.tsx, AddOptionsSheet |
| expo-image-picker | pick images | media.tsx |
| expo-media-library | save to gallery + permission | media.tsx, files.tsx export |
| expo-sharing | share files | settings.tsx backup |
| expo-clipboard | copy text | passwords.tsx |
| expo-updates | OTA reload | settings.tsx language/restore |
| expo-screen-capture | block screenshots | app/_layout.tsx |
| expo-splash-screen | splash control | app/_layout.tsx |
| expo-font | Cairo font loading | app/_layout.tsx |
| expo-image | fast image rendering | file-preview.tsx |
| expo-linear-gradient | gradient hero | welcome.tsx |
| expo-constants / device / localization | device info / locale | i18n, misc |

## 16.3 Storage Location Map

| Service / Path | Used for | Encrypted? |
|---|---|---|
| SecureStore | keys, flags, remember, biometric pin | OS-level |
| `SQLite/khaznati.db` | all relational data | partial (PRAGMA key optional) |
| `document/khaznati/{vaultId}/*` | files tab | **no** |
| `document/khaznati/{vaultId}/.encrypted_media/*.enc` | media gallery | yes (crypto) |
| `document/backups/*.kzb` | backups | DB-level |
| `cache/khaznati_export/` | temp export | no (temp) |

## 16.4 Service Availability / Readiness

- DB and migrations must complete before UI renders (blocking boot).
- No network services — the app is fully offline; no API endpoints exist.
- No background workers, notifications, or sync services.
- `expo-updates` present but `updates.enabled=false` in `app.json` — OTA disabled at build config; only used for in-app reloads.
