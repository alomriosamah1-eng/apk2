# 18 — Evidence

Index of the primary evidence citations supporting the investigation. Method: read-only static analysis of `app/`, `src/`, configs, and relevant `node_modules` sources. No runtime/device logs were used. Confidence is stated per finding in each source document.

---

## Database / schema (RC-1 — the biggest root cause)
| Claim | Evidence |
|---|---|
| SCHEMA is one multi-statement string | `src/data/database/schema.ts:2-92` (5 CREATE TABLE + 11 CREATE INDEX in one template literal) |
| Migration 1 runs it via executeSql | `src/data/database/migrations/001_initial.ts:5-7` (`await db.executeSql(SCHEMA)`) |
| executeSql → runSync (single-statement) | `src/data/database/DatabaseService.ts:89-92` (`this.db!.runSync(sql, params)`) |
| runSync → prepareSync | `node_modules/expo-sqlite/build/SQLiteDatabase.js:320-330` |
| prepare_v2 passes pzTail=nullptr → first statement only | `node_modules/expo-sqlite/android/src/main/cpp/NativeDatabaseBinding.cpp:119-125` |
| multi-statement `execSync` exists but is unused for schema | `node_modules/expo-sqlite/build/SQLiteDatabase.d.ts:135` (`execSync(source)`) |
| `PRAGMA user_version` read with wrong column name | `DatabaseService.ts:138-142` (`queryOne<{version}>('PRAGMA user_version')`; SQLite returns column `user_version`) |
| Migration 2 targets missing `items` table → fails every launch | `src/data/database/migrations/002_indexes.ts:5`; `MigrationRunner.ts:21-49`; error caught `app/_layout.tsx:80-81` |
| `PRAGMA key` (SQLCipher) unsupported → catch → FIELD_ENCRYPTED | `DatabaseService.ts:46-62` |

## Repositories (real SQL that breaks only because tables are missing)
| Claim | Evidence |
|---|---|
| Notes INSERT fails silently | `NoteRepositoryImpl.ts:28-43` (INSERT notes); UI `notes.tsx:98-108` closes with no error |
| Passwords INSERT fails silently | `PasswordRepositoryImpl.ts:28-45`; UI `passwords.tsx:137-147` |
| Items INSERT (files/media) | `ItemRepositoryImpl.ts:16-34`; callers `files.tsx:119-125`, `media.tsx` via `MediaStorage.ts:33-60`, `AddOptionsSheet.tsx:45-80` |
| Activity log INSERT + vault_id undefined | `ActivityLogRepositoryImpl.ts:17-41` (line 30 `vault_id: undefined`) |
| Vault create works | `VaultRepositoryImpl.ts:15-30` (vaults table is the one that exists) |
| Repo tests use fake in-memory DB (miss RC-1) | `__tests__/unit/data/repositories/*` + `--passWithNoTests` (`package.json:test`) |

## Session / remember-me (RC-2)
| Claim | Evidence |
|---|---|
| Flag write-only | `app/(auth)/login.tsx:21,53-59,70-73` |
| Session in React state only | `src/ui/providers/SessionProvider.tsx:27-63` |
| No boot hydration | `app/index.tsx:4-10`, `app/(app)/_layout.tsx:28-30` |

## Media pipeline divergence (RC-3)
| Claim | Evidence |
|---|---|
| Add sheet writes `khaznati/{vid}` as FILE, then routes to media tab | `AddOptionsSheet.tsx:45-80` (`getDefaultVaultDir()` + `ItemType.FILE`), `:93-97` (routes to media) |
| Media screen reads only `.encrypted_media` | `app/(app)/(tabs)/media.tsx:33-57` (`getEncryptedDir(vid)`) |
| MediaStorage uses `.encrypted_media` + IMAGE | `src/data/media/MediaStorage.ts:21-23,33-60` |
| Files display = SQLite unfiltered (returns both types) | `ItemRepositoryImpl.findByVaultId:47-78` |

## Crypto / keys
| Claim | Evidence |
|---|---|
| Real AES-256-GCM field encryption | `src/core/utils/crypto.ts:65-105` (encryptData), `:178-218` (encryptFile) |
| Real PBKDF2-HMAC-SHA256 100k salted | `src/core/utils/secure.ts:59-72`; legacy loop `:75-85` |
| Per-vault unwrapped keys in SecureStore | `NoteRepositoryImpl.ts:18-26`, `PasswordRepositoryImpl.ts:18-26`, `MediaStorage.ts:10-19`, `BiometricUnlockUseCase.ts:17,24-30`, `DatabaseService.ts:35-40` |
| PIN gates boolean, not decryption | `UnlockVaultUseCase.ts:13-78` vs `VaultRepositoryImpl.unlock` (`VaultRepositoryImpl.ts:106-116`) |

## DI (confirmed NOT the breakage)
| Claim | Evidence |
|---|---|
| All consumer interfaces registered | `src/core/di/register.ts:32-101` |
| Container mechanics | `src/core/di/container.ts:5-55` |
| MediaStorage module resolves repos lazily | `src/data/media/MediaStorage.ts` (free functions) |
| Use-case layer bypassed | `AddItemUseCase.ts` registered (`register.ts:86-88`) but never called; screens call `itemRepo` directly |

## Startup / performance
| Claim | Evidence |
|---|---|
| Serial blocking init before first frame | `app/_layout.tsx:60-87`; `SplashScreen.hideAsync` deferred to `onLayout` (`:56-58`) |
| `integrityCheck` full scan on critical path | `DatabaseService.ts:151-161` |
| Sync 100k PBKDF2 on JS thread | `secure.ts:59-72`; used in login/create/unlock |
| Per-row decrypt on list load | `NoteRepositoryImpl.ts:58-72`, `PasswordRepositoryImpl.ts:67-90` |
| Un-virtualized lists | `FilesList.tsx:30`, `MediaGallery.tsx:26`, `notes.tsx:263`, `passwords.tsx:287` |
| SessionProvider value rebuilt each render | `SessionProvider.tsx:100` |
| Redundant vault queries per nav | `useVaults.ts:81-83`, `(app)/_layout.tsx:13-26` |
| metro `fs.statSync` alias resolver | `metro.config.js:7-44` |

## Theme / i18n
| Claim | Evidence |
|---|---|
| Provider palette correct + memoized | `ThemeProvider.tsx:38-68`; full dark/amoled palettes `theme/colors.ts:50-111` |
| Persistence fire-and-forget | `ThemeProvider.tsx:40`, `i18n/index.ts:48` |
| Language change fire-and-forget + reload race | `i18n/index.ts:45-49`; `settings.tsx:134-141` (`Updates.reloadAsync`) |
| forceRTL needs restart | `i18n/index.ts:39-43` |
| Hardcoded light colors | `vault.tsx:41-47,172`, `FileRow.tsx:49`, `AddOptionsSheet.tsx:184`, `VaultListSheet.tsx:112`, `ErrorBoundary.tsx:58`, `settings.tsx:41` |
| SYSTEM→LIGHT no-op first tap | `settings.tsx:120-132` |
| about.tsx hardcoded Arabic | `app/(app)/modals/about.tsx` |

## Android / build
| Claim | Evidence |
|---|---|
| minSdk24/targetSdk36, 4 ABIs | `gradle.properties:31`; RN 0.81 catalog |
| Camera blocked; media perms correct | `app.json:32-42`; generated manifest |
| `allowBackup=true` | generated manifest (`fullBackupContent`) |
| `enableOnBackInvokedCallback=false` | generated manifest |
| `versionCode 1` / android 1.0.0 vs 1.1.0 | `android/app/build.gradle:95-96` |
| Debug-signing fallback | `.github/workflows/build.yml:96-98` (confirmed secret unset in recent Build #15 notice) |
| Version alignment to SDK 54 | `package-lock.json` vs `node_modules/expo@54/bundledNativeModules.json` |

---

## The claim behind every headline finding
1. **RC-1 (schema):** proven by tracing `SCHEMA → executeSql → runSync → prepare_v2(pzTail=nullptr)` and by the presence of multi-statement `execSync`. Confidence High.
2. **RC-2 (session):** proven by write-only flag + state-only provider + no hydration. Confidence High.
3. **RC-3 (media):** proven by the two differing directories/types and the directory-based Media loader. Confidence High.
4. **Performance:** proven by synchronous PBKDF2/decrypt call sites and un-virtualized lists. Confidence High/Medium.

These four propositions do not depend on runtime logs — they are direct consequences of the read source. Any runtime confirmation (device log showing `no such table`, `sqlite_master` listing only `vaults`, cold-boot session loss) would re-confirm the static conclusions.