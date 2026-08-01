# 04 — Feature Recovery (استعادة الوظائف — تحليل كل وظيفة)

> For every feature: goal, current logic, evaluation, defects, proposed logic, lifecycle, normal/exceptional states, error handling, recovery, validation, state management, performance, security, testability. Traced from `OSS/03`, `OSS/04`, `OSS/05`, `OSS/06`, `OSS/07`, `OSS/10`, `OSS/11`, `OSS/14`, `OSS/25`.

> **Common defect pattern** (applies to several features): screens resolve repository impls directly, bypass use-cases, and several flows pass an **empty `vaultId`** (→ FK violation, silent failure). Fixes in Phase 0/1/3.

---

## 4.1 Vault Creation

- **Goal**: Create a named vault (icon, color, PIN 4–8 digits) and enter it unlocked.
- **Current logic** (`OSS/04 §3`, `OSS/03`): validate name+pin → `generateSalt()` → `hashPin` (100k iter SHA-256) → `VaultRepository.create` → `storeBiometricPin` (plaintext PIN) → replace to `(app)`.
- **Evaluation**: works, but slow (hash), stores plaintext PIN, writes PIN even if user never enables biometrics, and `biometric-setup` screen is unreachable.
- **Defects**: (1) plaintext PIN at rest (R4); (2) hash speed (R-perf); (3) PIN stored unconditionally; (4) dead post-create flow.
- **Proposed logic**: validate → derive salt → **PBKDF2-HMAC-SHA256** (iterations from `APP_CONFIG.security.pbkdf2Iterations`, off-thread) → create → `KeyManager.createVaultKeys(vaultId)` (per-vault AES-256-GCM keys, key-encrypted-under-PIN, stored in SecureStore) → optional biometric token (device-keyed, **not plaintext**) → replace to `(app)`.
- **Lifecycle**: form → validating → creating (busy) → created→unlocked → error.
- **Normal states**: valid input → created; **Exceptional**: invalid name/pin (validation errors), hash/create DB failure, keygen failure, duplicate (none).
- **Error handling**: `Result` with `ValidationError`/`DatabaseError`/`CryptoError`; screen shows localized message, preserves input.
- **Recovery**: retry submit; on partial failure (vault row exists but keys missing) → delete orphan row and re-run (idempotent create).
- **Validation**: `validateVaultName` (1–50, arabic/english), `validatePin` (4–8 digits) — already exist (`OSS/25.5`).
- **State mgmt**: local form state; `useVaults.createVault`.
- **Performance**: hash off-main-thread; target < 300 ms.
- **Security**: PBKDF2 iterations ≥ 100k (or Argon2 if available); never store plaintext PIN.
- **Testability**: unit-test `CreateVaultUseCase` with mock repos + real `hashPin` (fast iteration count in tests).

---

## 4.2 PIN Login & Lockout

- **Goal**: Unlock a vault with the correct PIN; block brute force (5 attempts / 5 min).
- **Current logic** (`OSS/04 §4`): load vault → lockout check → `hashPin` compare (non-constant-time, JS string `===`) → increment/clear `failed_attempts` → `unlock`.
- **Evaluation**: logically sound; **not** constant-time; hash slow; config values duplicated (`UnlockVaultUseCase:5-6` vs `config.ts:24-25`).
- **Defects**: (1) timing attack surface (R2-adj); (2) duplicated constants (`OSS/06.2`); (3) slow login; (4) lockout counters persisted only on vault update.
- **Proposed logic**: verify → constant-time compare of hashes → on fail increment & set `lockedUntil`; on success clear counters + record `login` activity. Move constants into `APP_CONFIG`.
- **Lifecycle**: idle → submitting → success→session.unlock / failure→(attempts-left|locked).
- **Normal**: correct pin → unlocked; **Exceptional**: wrong pin (n remaining), locked (remaining seconds), vault missing, DB error.
- **Error handling**: `AuthenticationError('AUTH_FAILED')` with `metadata.reason` + remaining info; UI shows localized message.
- **Recovery**: after lockout expiry counters auto-reset (already implemented).
- **Validation**: client-side pin length 4–8 digits.
- **State mgmt**: `useVaults` + `SessionProvider.unlock`.
- **Performance**: PBKDF2 off-thread; target unlock < 500 ms on mid device.
- **Security**: constant-time compare; lockout covers PIN path; (Phase 5) extend to biometric.
- **Testability**: unit-test lockout transitions with mocked hash; timing test.

---

## 4.3 Biometric Unlock

- **Goal**: unlock via Face ID / fingerprint.
- **Current logic** (`OSS/05`): UI `authenticate()` → `BiometricUnlockUseCase.execute` reads plaintext `biometric_pin_{id}` from SecureStore → hash compare → unlock.
- **Evaluation**: works, but security-weak and inconsistent (R4, R5, R15).
- **Defects**: (1) plaintext PIN at rest; (2) no fresh-biometric enforcement inside use case (any caller can invoke without prompt); (3) bypasses lockout; (4) `biometric_enabled` flag ignored by login button; (5) dead `biometric-setup` route.
- **Proposed logic** (`OSS/28 §5.5`, `08-Security.md`): device-keyed encrypted **token** (random 32B), stored under `biometric_token_{vaultId}`, encrypted with a key from `expo-secure-store` (Keystore) so only this device can decrypt; use case REQUIRES a `freshAuth` boolean passed only after a successful system prompt; checks lockout; honors `biometric_enabled`.
- **Lifecycle**: idle → prompt → granted/denied → verified→unlocked / denied→stay.
- **Normal**: granted + token decrypt + hash match → unlocked; **Exceptional**: denied, not enrolled, token missing, token invalid, lockout active.
- **Error handling**: prompt failures → `false`; token missing → clear error "biometric not configured".
- **Recovery**: fallback to PIN; re-enroll via settings.
- **Validation**: `biometric_enabled` must be true; lockout must not be active.
- **State mgmt**: `useBiometrics` + `SessionProvider.unlock`.
- **Security**: never plaintext PIN; fresh-auth gate; lockout parity (Phase 5).
- **Testability**: unit-test `BiometricUnlockUseCase` with fake storage; integration with mocked `LocalAuthentication`.

---

## 4.4 Remember Me / Session Persistence

- **Goal**: optionally keep the session across app restarts within auto-lock timeout.
- **Current logic** (`OSS/04 §8`): writes `khaznati_remember_vault_{id}` = `'true'`; **never read** to auto-unlock; session lives in memory only (`SessionProvider`).
- **Evaluation**: remember-me is a UI checkbox with no effect; session dies on reload → **"language change logs me out"** bug (`OSS/19.6`, P0-1).
- **Defects**: (1) flag never consumed (R12); (2) `app/index.tsx` unconditional redirect (`OSS/02 §3`); (3) no persistence of `isUnlocked`.
- **Proposed logic** (`00` D4): `app/index.tsx` becomes router: if a vault is active & within timeout & remember-me → `(app)`; else `(auth)/login|welcome`. `SessionProvider` reads `rememberedVaultId` + `lastUnlockedAt` from SecureStore at boot; unlock writes them when remember-me on.
- **Lifecycle**: cold start → boot → session hydrated (unlocked | locked).
- **Normal**: remember-me on → cold start stays unlocked; **Exceptional**: timeout exceeded → login; remembered vault deleted → welcome.
- **Recovery**: if persisted session references a deleted vault → reset session.
- **Security**: never store the PIN or a token usable off-device; only an opaque vault-id + timestamp.
- **Testability**: boot-hydration unit tests with fake timers; route-guard tests.

---

## 4.5 Files Tab (Import / List / Rename / Delete / Export / Share)

- **Goal**: manage arbitrary files inside a vault, encrypted at rest.
- **Current logic** (`OSS/03 §files`): `DocumentPicker` → **raw copy** to `khaznati/{vaultId}` → `ItemRepository.create` row (no crypto) → list dir; rename/delete via FS; export via MediaLibrary.
- **Evaluation**: functional but **stores plaintext** (R1, P0-4) — the most critical gap.
- **Defects**: (1) plaintext storage; (2) export writes wrong bytes for media (base64-text); (3) `create-folder` doesn't write DB row; (4) preview only for images/text; (5) bulk share sends names only.
- **Proposed logic** (Phase 0.2 + Phase 3.6): import → read bytes → `encryptFile(vaultKey, bytes)` → write `khaznati/{vaultId}/files/{id}.enc` + DB row (`encrypted_path`); list = decrypt header/meta only (or lazy decrypt on preview); rename updates DB row; delete = secure-delete (Phase 5) + DB row; export = decrypt→binary temp→share/save.
- **Lifecycle**: idle → picking → importing(encrypt) → listed / error; preview → decrypt→show.
- **Normal**: import succeeds, appears encrypted on disk; **Exceptional**: picker cancel, encrypt failure, name conflict, permission denied.
- **Error handling**: picker cancel = no-op; encrypt failure → `CryptoError` surfaced; permission → `Alert`.
- **Recovery**: on partial write, delete orphan `.enc`; retry.
- **Validation**: name conflict pre-check (existing), size limit from config.
- **Performance**: encrypt on worker for large files; list without full decrypt (metadata only).
- **Security**: AES-GCM at rest; `scoped storage` compliant (app-private dir).
- **Testability**: repo-level tests with mocked FS; crypto round-trip tests.

---

## 4.6 Media Gallery (Import / View / Export)

- **Goal**: encrypted image/video gallery per vault.
- **Current logic** (`OSS/03 §media`, `OSS/15 §15.6`): `ImagePicker(base64:true)` → `encryptFile` → `.encrypted_media/*.enc` + item row; preview decrypt inline; export decrypt→**write base64 text**→MediaLibrary.
- **Evaluation**: import + preview work; **export corrupts files** (R8).
- **Defects**: (1) export base64-text bug (`media.tsx:155-158`); (2) Add-sheet media path not wired (imports via vault screen land in wrong tab); (3) decrypt failures silent; (4) base64-in-JS memory heavy for large videos.
- **Proposed logic**: import via picker (no base64 when possible — use file URI → read bytes → encrypt → write); view: decrypt→temp→`expo-image`; export: decrypt→**decode binary**→write temp→MediaLibrary.
- **Lifecycle**: idle → pick → encrypt→persist→refresh / error.
- **Normal**: encrypted media appears; **Exceptional**: decrypt fail (tamper), permission, storage full.
- **Error handling**: tamper → typed error + user message (not `''`); permission → `Alert`.
- **Recovery**: re-import; delete corrupted `.enc`.
- **Performance**: chunked encrypt/decrypt (avoid full-base64 in memory); thumbnails (config exists, unimplemented).
- **Security**: AES-GCM; no plaintext at rest.
- **Testability**: crypto round-trip; MediaStorage unit tests; export decode test.

---

## 4.7 Notes CRUD

- **Goal**: create/edit/delete/pin/search notes; encrypted at rest.
- **Current logic** (`OSS/03 §notes`, `OSS/10 §10.3`): repo encrypts content with `note_vault_key_*`; CRUD works via notes screen.
- **Evaluation**: repo is correct; **the Add-sheet entry path is broken** (P0-3: `AddOptionsSheet.tsx:66-74` pushes notes without vaultId → `notes.tsx:25` defaults to `'default'` → FK violation; the `vault_id=''` insert fails silently).
- **Defects**: (1) P0-3 vaultId bug; (2) no debounce on search (`OSS/20`); (3) decrypt failures return `'[encrypted]'`.
- **Proposed logic**: pass `activeVaultId` from `SessionProvider`/params; adopt `use-case` layer or keep repo but enforce vaultId validation; add `useDebounce` for search.
- **Lifecycle**: list → create/edit (full-screen) → save(encrypt) → list refresh.
- **Normal**: CRUD + pin + search; **Exceptional**: FK violation (vault missing), encrypt failure, missing key.
- **Error handling**: explicit vault-missing error; `CryptoError` surfaced.
- **Recovery**: if key missing (vault recreated) → prompt to re-enter PIN or mark undecryptable.
- **Validation**: title optional? (currently default `''`); non-empty content guard.
- **Performance**: memoized list; decrypted content cached in memory.
- **Security**: AES-GCM content at rest (already); constant-time not relevant here.
- **Testability**: NoteRepository tests with mock db+key.

---

## 4.8 Passwords CRUD + Generator

- **Goal**: store/retrieve passwords encrypted; generate strong passwords.
- **Current logic** (`OSS/03 §passwords`): repo encrypts with `pwd_vault_key_*`; **generator uses `Math.random`** (R6); same P0-3 vaultId bug via Add sheet.
- **Defects**: (1) `Math.random` not CSPRNG (R6); (2) P0-3; (3) copy feedback only; (4) strength score computed client-side (ok).
- **Proposed logic**: generator uses `Crypto.getRandomBytesAsync` + charset mapping; fix vaultId; clipboard auto-clear per setting (Phase 5.2).
- **Lifecycle**: list → add/edit → save(encrypt) → list; reveal/copy per entry.
- **Normal**: CRUD + generate + copy; **Exceptional**: generator error, FK, key missing.
- **Error handling**: `CryptoError`; clipboard failure fallback.
- **Recovery**: retry; re-enter PIN if key missing.
- **Security**: CSPRNG; AES-GCM at rest; clipboard clear.
- **Testability**: generator randomness (statistical light test), repo tests.

---

## 4.9 Search

- **Goal**: filter files/notes/passwords/media by query.
- **Current logic** (`OSS/03`, `OSS/10`): `LIKE` filters per screen; no debounce.
- **Defects**: (1) no debounce; (2) notes search decrypts all to filter (perf); (3) no combined/normalized search.
- **Proposed logic**: debounce (300 ms); for notes, keep in-memory decrypted index per session; limit results; use `SearchItemsUseCase`.
- **Lifecycle**: typing → debounce → results.
- **Performance**: memoized; index cache.
- **Testability**: search use-case unit tests.

---

## 4.10 Settings (Backup / Restore / Theme / Language / Security toggles)

- **Goal**: full settings with real behavior.
- **Current logic** (`OSS/03 §settings`, `OSS/14.5`): theme/lang in-memory only; backup = raw DB copy; restore = overwrite DB; ~8 advertised features unimplemented.
- **Defects**: (1) R7 backup coverage; (2) R14 no persistence; (3) dead settings (root/secure-delete/clipboard/auto-backup); (4) clear-all may leave SecureStore keys; (5) version strings hardcoded.
- **Proposed logic** (Phases 4,5,7): backup v2 with key manifest; settings via `ISettingsRepository`; implement-or-remove dead toggles; clear-all wipes SecureStore keys + backup metadata; version from `APP_CONFIG`.
- **Lifecycle**: open → load settings (async) → edits persist.
- **Normal**: toggles persist across restarts; **Exceptional**: corrupt backup rejected.
- **Recovery**: restore validates checksum first; on failure keep current data (atomic swap).
- **Security**: backup encrypted; restore guarded.
- **Testability**: settings repo tests; backup round-trip tests.

---

## 4.11 Activity Log

- **Goal**: record and display user actions.
- **Current logic** (`OSS/03 §activity-log`, `OSS/10 §10.5`): table + repo + modal exist; **no caller ever logs** (R10).
- **Defects**: (1) never populated; (2) `vault_id` always NULL; (3) Arabic locale hardcoded.
- **Proposed logic** (Phase 3.5): call `.log()` from vault/item/note/password/backup actions with `vaultId` + metadata; locale-aware timestamps; cap table (e.g. 500 rows, prune).
- **Lifecycle**: action → write row; modal → read recent 100.
- **Performance**: async insert, no UI blocking; prune old rows.
- **Testability**: repo tests; action-hook wiring tests.

---

## 4.12 Theme

- **Goal**: Light/Dark/AMOLED/System, persisted.
- **Current logic** (`OSS/18`): Context state only → resets each launch (R14).
- **Proposed logic** (Phase 7): load `settings.themeMode` at boot → hydrate provider → cycle persists.
- **Lifecycle**: boot→hydrate→render; change→persist.
- **Testability**: provider unit test with fake settings repo.

---

## 4.13 Language / RTL

- **Goal**: Arabic/English switch, forced RTL, persisted.
- **Current logic** (`OSS/19`): i18next from system locale; switch requires `Updates.reloadAsync()` (→ **logs out**, P0-1); not persisted.
- **Defects**: (1) not persisted; (2) reload wipes session; (3) hardcoded Arabic (`activity-log.tsx:79`, `settings.tsx:314`).
- **Proposed logic** (Phase 7): persist `settings.language`; rehydrate before render (no reload needed via `I18nManager` at boot only); keep RTL logic; remove hardcoded strings.
- **Lifecycle**: boot→load lang→render; switch→persist→(no reload).
- **Testability**: i18n unit tests; language-persistence tests.

---

## 4.14 Auto-Lock & Quick-Exit

- **Goal**: lock after inactivity; quick exit button.
- **Current logic** (`OSS/04 §7`, `OSS/03 §vault`): AppState listener; quick-exit = `exitApp()` (Android) or push welcome (iOS) — **iOS path doesn't lock** (P0-adj).
- **Defects**: (1) router.replace inside state updater (React anti-pattern); (2) iOS quick-exit doesn't lock vaults; (3) timeout not applied if app killed.
- **Proposed logic** (Phase 0.5): effect-driven navigation; lock all vaults on quick-exit both platforms; persist `lastActivity` for boot hydration.
- **Lifecycle**: active→background→timeout→locked.
- **Testability**: fake-timer tests for timeout; AppState mock.

---

## 4.15 Vault Switcher & Clear-All / Lock-All

- **Goal**: switch vaults; clear/lock all.
- **Current logic** (`OSS/03`, `OSS/15 §15.8`): clear-all deletes vaults + `khaznati/` dir + welcome; lock-all sets lock + welcome.
- **Defects**: (1) clear-all may leave `SecureStore` keys (`biometric_pin_*`, `*_vault_key_*`); (2) lock-all on settings pushes welcome only.
- **Proposed logic** (Phase 7): clear-all also deletes per-vault SecureStore keys + `backup_metadata`; lock-all updates DB locks first.
- **Security**: key cleanup critical.
- **Testability**: repo + key-cleanup tests.

---

## 4.16 Missing / Incomplete (design from scratch)

Per OSS `14.6-14.7` + Phase 4/5: **Backup v2** (`04.10`), **Secure delete** (Phase 5), **Clipboard clear** (Phase 5), **Root detection** (Phase 5), **Thumbnails** (Phase 2), **Crash/error boundary + crash reporting** (Phase 0.8), **Auto-backup scheduler** (optional, defer — not core).
