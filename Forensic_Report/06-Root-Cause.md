# 06 — Root Cause Investigation

Root causes, each with: description, true root cause, file, function, lines, how discovered, why it happened, user impact, perf impact, system impact, severity, confidence.

---

## RC-1 — CRITICAL (HIGH confidence): SQLite schema never fully applied

### Description
Only the `vaults` table is created; `items`, `notes`, `passwords`, `activity_log` and their indexes never exist.

### Evidence
- `src/data/database/schema.ts:2-92` — `SCHEMA` = one template string with 5 `CREATE TABLE` + 11 `CREATE INDEX`.
- `src/data/database/migrations/001_initial.ts:5-7` — `up()` → `await db.executeSql(SCHEMA)`.
- `src/data/database/DatabaseService.ts:89-92` — `executeSql` → `this.db!.runSync(sql, params)`.
- `node_modules/expo-sqlite/build/SQLiteDatabase.js:320-330` — `runSync` → `prepareSync(source)`.
- `node_modules/expo-sqlite/android/.../NativeDatabaseBinding.cpp:119-125` — `::exsqlite3_prepare_v2(db, source, source.size(), &stmt, nullptr)` — **`pzTail = nullptr`**.
- `node_modules/expo-sqlite/build/SQLiteDatabase.d.ts:135` — **`execSync(source)` exists** (multi-statement) and is available, but the app uses `runSync` for schema.

### Root cause
`sqlite3_prepare_v2` compiles only the first statement of a multi-statement string. With `pzTail=nullptr` the remaining statements are silently discarded. `runSync` is a single-statement API; the code passed a 92-line script to it, reducing it to `CREATE TABLE IF NOT EXISTS vaults (...)`.

### How discovered
Traced migration 001 → `DatabaseService.executeSql` → `runSync` → native `prepare_v2`; confirmed the multi-statement string and the null `pzTail`; confirmed `execSync` (correct API) exists but is unused for schema.

### Why it happened
Designer assumed `runSync` behaves like `exec(sql)` (multi-statement). The correct multi-statement API (`execSync`/`execAsync`) was available but not used. No integration test exercised the real schema (repo tests use in-memory `FakeDatabaseService`).

### Impact
- **User:** notes/passwords/files/media/activity — every persisted write fails silently; UI closes forms with no error. Migration 002 error logged every launch.
- **Performance:** migration 2 throws each cold start (small) — minor.
- **System:** `preventScreenCaptureAsync()` and `integrityCheck()` never run on fresh install (startup aborts at migration 2). DB is effectively read-only for 4 of 5 tables.

---

## RC-2 — CRITICAL (HIGH confidence): Session / "remember me" never persisted

### Description
`REMEMBER_KEY` written but never read back; session lives only in React state.

### Evidence
- `app/(auth)/login.tsx:21` — `const REMEMBER_KEY = 'khaznati_remember_vault';`
- `login.tsx:53-59` — reads `..._{vaultId}` **only to pre-tick the checkbox**.
- `login.tsx:70-73` — on success writes `'true'`; nothing else consumes it.
- `src/ui/providers/SessionProvider.tsx:27-32, 47-63` — `activeVaultId/isUnlocked/lastActivityTime` in state only.
- `app/index.tsx:4-10` redirects on `isUnlocked`; no boot-time SecureStore read.
- `app/(app)/_layout.tsx:28-30` gate on in-memory `isUnlocked`/`activeVaultLocked`.

### Root cause
Write-only flag. No `rememberedVaultId`/`lastUnlockedAt` hydration at boot. Design docs (`Recovery/*`) specify persistence that was not implemented.

### Impact
Every app restart or `Updates.reloadAsync()` forces re-login. Explains "remember password doesn't work." Also explains "language change logs me out" (reload wipes session).

---

## RC-3 — HIGH (HIGH confidence): Media import writes to a directory the Media screen never reads

### Evidence
- `src/ui/components/organisms/AddOptionsSheet.tsx:45-80` `importToVault` → `getDefaultVaultDir()` = `Paths.document/khaznati/{vid}` → writes there as `ItemType.FILE`.
- `AddOptionsSheet.tsx:93-97` `handleImportPhoto` → then routes to `/(app)/(tabs)/media`.
- `app/(app)/(tabs)/media.tsx:33-57` `loadMedia` lists **only** `getEncryptedDir(vid)` = `Paths.document/khaznati/{vid}/.encrypted_media`.
- `src/data/media/MediaStorage.ts:21-23,33-60` uses `.encrypted_media` + `ItemType.IMAGE`.

### Root cause
Two divergent pipelines: (a) media tab / MediaStorage → `.encrypted_media` + type IMAGE; (b) Add sheet / files.tsx → `khaznati/{vid}` + type FILE. Media display is directory-based (`.encrypted_media`), files display is SQLite-based. Photos via Add sheet are invisible in Media.

### Impact
Media import appears broken (even where DB insert would succeed). Type/dir mismatch also pollutes the Files tab (returns both IMAGE and FILE rows).

---

## High-severity findings

### F-H1 — HIGH (high conf): `vaultId` falls back to literal `'default'`
`notes.tsx:29`, `passwords.tsx:40`, `AddOptionsSheet` `getTargetVaultId` — `vaultId = paramsVaultId || 'default'`. `schema.ts:51/67` set `FOREIGN KEY (vault_id) REFERENCES vaults(id) ON DELETE CASCADE` and `foreign_keys=ON` (`DatabaseService.ts:68`). Direct-tab/deep-link entry → FK violation → silent failure.

### F-H2 — HIGH (high conf): Keys stored unwrapped under static SecureStore keys; PIN does not gate decryption
`NoteRepositoryImpl.ts:18-26` `note_vault_key_{vaultId}`, `PasswordRepositoryImpl.ts:18-26`, `MediaStorage.ts:10-19` `media_vault_key_{vaultId}`, `BiometricUnlockUseCase.ts:17,24-30`, `DatabaseService.ts:35-40`. Random keys in Keystore; `encrypted_pin_hash` never derives keys. Vault PIN gates `is_locked` boolean, not decryption.

### F-H3 — HIGH (medium conf): Biometric token stored unconditionally; no fresh-auth gate in use case
`BiometricUnlockUseCase.ts:32-92`; `storeBiometricPin` called on every create (`CreateVaultUseCase.ts:57-59`, `create-vault.tsx:69-70`). `execute()` doesn't itself require a fresh biometric; caller gates it.

### F-H4 — HIGH (high conf): CI release falls back to debug signing
`.github/workflows/build.yml:96-98` — when `ANDROID_KEYSTORE_BASE64` unset, notices and `exit 0`; `assembleRelease` produces a debug-signed "release" APK. Uninstallable alongside debug, ineligible for Play. Version/keys not in repo.

### F-H5 — HIGH (high conf): `allowBackup=true` → data loss on restore
`AndroidManifest.xml` — backup of encrypted SQLite + media enabled, but keystore-backed SecureStore keys are excluded from backup → restore to new device yields encrypted blobs without keys (lock-out).

### F-H6 — MEDIUM (high conf): `PRAGMA user_version` column-name mismatch
`DatabaseService.ts:138-148` — `getVersion` reads `{ version }` from `PRAGMA user_version`, but SQLite returns column `user_version` → `row?.version` always undefined → returns 0. Version bookkeeping broken (compounds RC-1's retry loop).

### F-H7 — MEDIUM (high conf): `PRAGMA key = ?` unsupported (SQLCipher syntax on plain SQLite)
`DatabaseService.ts:46,49-54` — throws, caught → `FIELD_ENCRYPTED`. Whole-file encryption is nominal; field-level only.

### F-H8 — MEDIUM (high conf): PIN-hash upgrade on unlock is a no-op
`UnlockVaultUseCase.ts:62-75` upgrades legacy hash; `VaultRepositoryImpl.update` (`VaultRepositoryImpl.ts:55-70`) omits `encrypted_pin_hash`/`pin_salt` from its UPDATE.

### F-H9 — MEDIUM (high conf): Activity log `vault_id` always undefined
`ActivityLogRepositoryImpl.ts:30` — hardcoded `undefined`.

### F-H10 — MEDIUM (high conf): Synchronous 100k PBKDF2 on JS thread
`secure.ts:59-72` `hashPin`; `verifyPin` also runs `hashPinLegacy` 100k async bridge calls on wrong pin. Blocks UI during login/create/unlock. (07)

### F-H11 — MEDIUM (medium conf): Per-row AES-GCM decrypt on JS thread on list load
`NoteRepositoryImpl.ts:64`, `PasswordRepositoryImpl.ts:74-82` — `Promise.all(rows.map(decrypt))`. (07)

### F-H12 — MEDIUM (high conf): Un-virtualized lists (ScrollView)
`FilesList.tsx:30`, `MediaGallery.tsx:26`, `notes.tsx:263`, `passwords.tsx:287`. (07)

---

## Medium / Low (condensed; full in 07/08/09/14)
- MED: SessionProvider context value rebuilt every render (`SessionProvider.tsx:100`).
- MED: Redundant full vault query per navigation (`useVaults.ts:81-83`, `(app)/_layout.tsx:13-26`).
- MED: `Math.random` password generator (`passwords.tsx:92-99`).
- MED: Media permission over-gating (`media.tsx:102-116`).
- MED: hardcoded light-only colors ignore dark theme (`vault.tsx:41-47,172`, `FileRow.tsx:49`, `AddOptionsSheet.tsx:184`, `ErrorBoundary.tsx:58`, `settings.tsx:41`).
- MED-LOW: SYSTEM→LIGHT first-tap no-op in theme cycle (`settings.tsx:120-132`).
- MED: i18n persist fire-and-forget + reload race (`i18n/index.ts:45-49`, `settings.tsx:134-141`); `forceRTL` needs restart.
- LOW: `enableOnBackInvokedCallback=false` vs targetSdk 36 (`manifest`).
- LOW: `versionCode 1` always; `android/` 1.0.0 vs app.json 1.1.0.
- LOW: metro `fs.statSync` resolver hot-path (`metro.config.js`).
- LOW: `@` alias not in jest moduleNameMapper.
- LOW: unused `expo-constants`, `expo-linking`, `expo-localization`; deprecated+unused `@testing-library/jest-native`.
- LOW: `MediaPreview.tsx:22` non-null `decryptedUri!`.
- LOW-INFO: `database at-rest encryption` is documented nominal only; `requestLegacyExternalStorage`/`WRITE_EXTERNAL_STORAGE` dead config on targetSdk 36; `USE_FINGERPRINT` deprecated (auto-injected).
- INFO: `About` screen has hardcoded Arabic strings (`about.tsx`), ignores i18n.

---

## Consolidated interruption map
All durable-write features break at RC-1. Session breaks at RC-2. Media display breaks at RC-3. Performance breaks are orthogonal (07).