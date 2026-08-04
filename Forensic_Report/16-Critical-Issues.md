# 16 — Critical Issues

Ranked list of the most consequential findings. Each: description, file/function/lines, root cause, user impact, severity, confidence.

---

## 🔴 C-1 — SQLite schema never fully applied (only `vaults` created)
- **Files:** `schema.ts:2-92`; `001_initial.ts:5-7`; `DatabaseService.ts:89-92`; expo-sqlite `runSync`/native `prepare_v2` (pzTail=nullptr); correct API `execSync` unused.
- **Root cause:** multi-statement schema string sent to single-statement `runSync`. Only first `CREATE TABLE` executes.
- **Affected:** `items`, `notes`, `passwords`, `activity_log` missing → notes, passwords, files, media, activity all fail silently. Migration 2 throws every launch.
- **User impact:** "Creating notes doesn't work", "saving passwords doesn't work", "importing xxx doesn't work", empty activity log, no error messages (silent).
- **System impact:** boot aborts before `integrityCheck`/`preventScreenCaptureAsync` (screen-capture disabled).
- **Severity:** 🔴 Critical. **Confidence:** High.

## 🔴 C-2 — Session not persisted / "Remember me" is write-only
- **Files:** `login.tsx:21,53-59,70-73`; `SessionProvider.tsx:27-63`; `app/index.tsx:4-10`; `(app)/_layout.tsx:28-30`.
- **Root cause:** remember flag written but never read back; session in React state only; no boot hydration.
- **User impact:** every restart/reload forces re-login; "remember password doesn't work"; language-change reload also logs you out.
- **Severity:** 🔴 Critical. **Confidence:** High.

## 🟠 H-1 — Media import writes to a directory the Media screen never reads
- **Files:** `AddOptionsSheet.tsx:45-80,93-97` (writes `khaznati/{vid}`, type FILE) vs `media.tsx:33-57` (reads only `.encrypted_media`), `MediaStorage.ts:21-23,33-60` (`.encrypted_media`, type IMAGE).
- **Root cause:** two divergent storage pipelines; media display is directory-based, files display is SQLite-based and unfiltered.
- **User impact:** photos imported via Add sheet invisible in Media tab; cross-type pollution in Files.
- **Severity:** 🟠 High. **Confidence:** High.

## 🟠 H-2 — `no such table` errors are silently swallowed by the UI
- **Files:** `notes.tsx:98-108`, `passwords.tsx:137-147`, `AddOptionsSheet.tsx:74-78`.
- **Root cause:** handlers only act on `result.success`; on failure they close/hide UI with no error feedback.
- **User impact:** the root, user-facing reason "buttons do nothing / data disappears."
- **Severity:** 🟠 High. **Confidence:** High.

## 🟠 H-3 — Vault PIN does not gate decryption; keys unwrapped
- **Files:** `NoteRepositoryImpl.ts:18-26`, `PasswordRepositoryImpl.ts:18-26`, `MediaStorage.ts:10-19`, `BiometricUnlockUseCase.ts:17,24-30`, `DatabaseService.ts:35-40`; `UnlockVaultUseCase.ts`.
- **Root cause:** random AES keys stored bare under static SecureStore names; `encrypted_pin_hash` never used to derive/wrap them. Unlock flips a boolean.
- **Impact:** security weakness — PIN gate is cosmetic at the data layer; screen-capture also disabled (C-1).
- **Severity:** 🟠 High (security). **Confidence:** High.

## 🟠 H-4 — `vaultId` falls back to literal `'default'` → FK violation on direct entry
- **Files:** `notes.tsx:29`, `passwords.tsx:40`; `schema.ts:51/67` FK; `DatabaseService.ts:68` foreign_keys=ON.
- **Severity:** 🟠 High. **Confidence:** Medium (only on deep-link/direct-tab entry).

## 🟠 H-5 — Startup performance: serial blocking chain + sync crypto
- **Files:** `app/_layout.tsx:60-87`; `secure.ts:59-72` (sync 100k PBKDF2); `NoteRepositoryImpl.ts:64` / `PasswordRepositoryImpl.ts:74-82` per-row decrypt.
- **Severity:** 🟠 High (perf, not correctness). **Confidence:** High.

## 🟠 H-6 — CI release falls back to debug signing (keystore secret unset)
- **Files:** `.github/workflows/build.yml:96-98`.
- **Severity:** 🟠 High (release/install). **Confidence:** High.

## 🟡 Ranked Medium
| ID | Finding | File |
|---|---|---|
| M-1 | `PRAGMA user_version` column mismatch → version=0 always | DatabaseService.ts:138-148 |
| M-2 | `PRAGMA key` unsupported → whole-file encryption nominal | DatabaseService.ts:46,49-54 |
| M-3 | PIN-hash upgrade no-op (`update` omits hash/salt) | VaultRepositoryImpl.ts:55-70 |
| M-4 | Activity log `vault_id` hardcoded undefined | ActivityLogRepositoryImpl.ts:30 |
| M-5 | Media permission over-gating → blocked on denied-library devices | media.tsx:102-116 |
| M-6 | Un-virtualized ScrollView lists | FilesList.tsx:30, MediaGallery.tsx:26, notes.tsx:263, passwords.tsx:287 |
| M-7 | SessionProvider value recreated each render | SessionProvider.tsx:100 |
| M-8 | Redundant full-vault queries per navigation | useVaults.ts:81-83, (app)/_layout.tsx:13-26 |
| M-9 | `allowBackup=true` → restore lock-out | manifest |
| M-10 | `Math.random` password generator | passwords.tsx:92-99 |
| M-11 | i18n persist fire-and-forget + reload race; forceRTL needs restart | i18n/index.ts:45-49, settings.tsx:134-141 |
| M-12 | Hardcoded light colors ignore dark mode; SYSTEM→LIGHT no-op | vault.tsx:41-47, etc.; settings.tsx:120-132 |

## 🟢 Low (representative)
- `versionCode` 1 always; android/ 1.0.0 vs 1.1.0 (08 A-3).
- `enableOnBackInvokedCallback=false` @ targetSdk36 (08 A-2).
- Rich but unused `FileSystemSource` + use-case layer (12 S1, 10 CQ-2/4).
- Deprecated+unused `@testing-library/jest-native`; unused expo-constants/linking/localization (09 D-3/4).
- Twin `@` alias drift in jest config (09 D-6).
- `MediaPreview.tsx:22` `decryptedUri!` non-null.
- `About` hardcoded Arabic (10 CQ-5).

## Cross-cutting note
The two Critical findings (C-1, C-2) are independent. C-1 is the single highest-leverage fix — it unblocks notes, passwords, files, media, and activity log at once. None of the CI/gate checks (tsc, eslint, 65 unit tests, expo-doctor) are able to detect C-1 because repository tests use an in-memory fake DB and class-level code is otherwise correct.