# 17 — Repair Plan: Post-Phase-0 Completion (خطة الإصلاح والاستكمال)

> **Project**: Khaznati — `com.khaznati.vault`
> **Date**: 2026-08-01
> **Inputs**: `16-Audit-Findings.md` (severity matrix §9: C1–C3, H1–H6, M1–M6, L1–L3) + `02-Recovery-Roadmap.md` + `01-Project-Status.md`.
> **Status baseline**: Phase 0 complete — `tsc` clean, `eslint` clean, 7 suites / 36 tests green. All tasks below are **Phase-0-exit-gated** (each: `tsc --noEmit` + `eslint` + `npm test` green).
> **Progress**: ✅ P0 done (expo-doctor 18/18). ✅ P1 done (8 suites / 40 tests). ✅ P2 done (10 suites / 48 tests). ✅ P3 done (11 suites / 50 tests). ⛔ P4 backup **removed entirely** per user decision (feature excluded; UI, DatabaseService methods, schema tables/columns, i18n, deps `expo-sharing` removed; 11 suites / 50 tests still green). ✅ P5 done (14 suites / 65 tests; theme + language persisted via SecureStore, Arabic default + RTL at boot, missing i18n keys added, hardcoded English removed, Arabic v4 plurals, clipboard protection wired, biometric flag enforced + lockout respected, dead Security row removed, settings hydrate from storage, ActivityLog wired, SQLite settings store removed in favor of SecureStore). Remaining: P6–P7.
> **Conventions**: fixes reference `file:line`; each task lists DoD (definition of done) + verification. Arabic-language UI requirement is a hard gate (R-A).

---

## P0 — Hygiene Pass (fix app.json + dead routes first, low risk)

Smallest fixes first so later phases build on a clean base.

| # | Task | Files | DoD |
|---|---|---|---|
| P0.1 | Remove invalid app.json keys `android.enableProguardInRelease` + `android.enableHermesCodegen` (expo-doctor fail) | `app.json:44-45` | `npx expo-doctor` → 0 errors |
| P0.2 | Wire or remove dead routes: give `create-folder` an entry from files.tsx, or delete file + `modals/_layout.tsx:18` registration; delete unreachable `biometric-setup` flow or make it reachable | `app/(app)/modals/create-folder.tsx`, `app/(app)/modals/_layout.tsx`, `app/(auth)/biometric-setup.tsx`, `app/(auth)/_layout.tsx` | no route in registry lacks a navigator; `app/(auth)/_layout.tsx` and `modals/_layout.tsx` reflect reachable screens |
| P0.3 | Delete dead component `ItemRow` (+ its registry entry) | `src/ui/components/organisms/ItemRow.tsx` | no imports remain (verify via grep) |
| P0.4 | Remove dead deps from `package.json`: `expo-device`, `expo-status-bar`, `expo-build-properties` (verify no imports first) | `package.json` | `npm install` clean; `grep` finds zero imports |
| P0.5 | Trim unused permissions: remove `READ/WRITE_EXTERNAL_STORAGE` from `app.json:36-37` | `app.json` | manifest review clean; lint+tsc pass |

**Exit**: doctor clean, no dead routes/components, deps pruned. (⏱ 0.5 day)

---

## P1 — Session & Routing Repair (C1, H1, H2, M2, M5)

Goal: every transition into `(app)` is guarded by a real session; every back action preserves context.

| # | Task | Files | DoD |
|---|---|---|---|
| P1.1 | **create-vault → unlock before navigating**: in `handleCreate`, after `createVault` success call `session.unlock(result.data.id)` then `router.replace({ pathname:'/(app)/(tabs)/vault', params:{ vaultId: result.data.id } })` | `app/(auth)/create-vault.tsx:65-69` | creating a vault lands on vault screen (no bounce to welcome); manual smoke |
| P1.2 | Same for `biometric-setup.tsx:25,30` (only if P0.2 keeps it) | `app/(auth)/biometric-setup.tsx` | transition guarded |
| P1.3 | **Wire `session.lock()`**: `settings.tsx:231-238` "Lock all vaults" → after locking DB rows call `session.lock()`; `vault.tsx:67-73` quick-exit → call `session.lock()` before welcome; `AddOptionsSheet.handleQuickExit` (`:89-96`) same | `settings.tsx`, `vault.tsx`, `AddOptionsSheet.tsx` | after any exit, `(app)` deep-link redirects out; state consistent |
| P1.4 | **Unify guard destination**: `(app)/_layout.tsx:10` redirect → `/(auth)/login` (matches SessionProvider auto-lock); keep welcome for first-run | `app/(app)/_layout.tsx` | guard + auto-lock navigate to same screen |
| P1.5 | Fix `login.tsx:100,125` — replace `router.push('/(app)/(tabs)/vault')` with valid flow (route to a specific vault or back to welcome) | `app/(auth)/login.tsx` | no unprotected navigation |
| P1.6 | **Back buttons**: replace `router.push('/(app)/(tabs)/vault')` with `router.back()` where screen was pushed (files.tsx:272, notes.tsx:193, passwords.tsx:237, settings.tsx:241); pass `vaultId` when forward navigation needed | `files.tsx`, `notes.tsx`, `passwords.tsx`, `settings.tsx` | back pops stack, preserves `vaultId` |
| P1.7 | **Unify vaultId fallback**: notes.tsx:25 & passwords.tsx:30 → `'default'` (match files/media) **or** better: require real vaultId and fall back to first unlocked vault | `notes.tsx:25`, `passwords.tsx:30` | no `vault_id=''` rows created |
| P1.8 | **index.tsx redirect with active vault**: read `vaultId` from session/params; else first unlocked vault | `app/index.tsx:6-9` | redirect uses active vault, not `vaults[0]` |
| P1.9 | **Guard checks vault.isLocked too**: screens (files/notes/passwords) verify their vault is unlocked before showing content; if locked → redirect login | `(app)/_layout.tsx`, tab screens | locked vault's data inaccessible in-session |
| P1.10 | Add tests: create-vault route (mock repo + session), SessionProvider lock/unlock, back-nav params | `__tests__/unit/...` | new tests green |

**Exit**: full create→unlock→use→lock cycle works; no orphan vaultIds; stack clean. (⏱ 1.5 days)

---

## P2 — Data & Notes Completion (C1-meta, H4, M3, M4)

Goal: files/media/notes are DB-consistent; notes feature-complete.

| # | Task | Files | DoD |
|---|---|---|---|
| P2.1 | ✅ **Files read from `items` DB** (source of truth) instead of directory listing; keep encrypted `.enc` files on disk | `files.tsx:54`, `ItemRepositoryImpl`, `ItemMapper` | list matches DB rows; rename/delete update DB |
| P2.2 | ✅ **File delete updates DB** — remove `items` row (not just FS file) | `files.tsx:141-154`, `media.tsx:87` | no orphan rows after delete |
| P2.3 | ✅ **Rename updates `items.encrypted_path`** | `files.tsx:225-252`, `RenameEditor.tsx` | DB path matches disk after rename |
| P2.4 | ✅ **AddOptionsSheet import → encrypt + DB row**: replace `importToVault` plain copy (`AddOptionsSheet.tsx:37-48`) with encrypt-via-vault-key + write `{ts}.{name}.enc` + insert item row (mirror `files.tsx:95-109`) | `AddOptionsSheet.tsx`, `files.tsx` | imported file visible in files list, encrypted on disk |
| P2.5 | ✅ **Vault delete cleans folder** — `DeleteVaultUseCase` removes `document/khaznati/{vaultId}/` after DB delete | `useVaults.ts` (folder cleanup) | folder gone after delete |
| P2.6 | ✅ **PIN-hash upgrade actually persists**: extend `VaultRepositoryImpl.update` (`:58-64`) UPDATE to include `encrypted_pin_hash` + `pin_salt` | `VaultRepositoryImpl.ts` | legacy→PBKDF2 upgrade persists across restart |
| P2.7 | ✅ **Notes missing buttons**: add Share (via `Share`), delete-confirmation `Alert.alert`, lock button (in header, calls `session.lock()`); batch delete confirm in SelectionBar | `notes.tsx`, `SelectionBar.tsx` | share/confirm-delete/lock work; manual smoke |
| P2.8 | ✅ **Wire notes via AddOptionsSheet** — "notes.create" option opens the notes screen in create mode (pre-filled editor) | `AddOptionsSheet.tsx`, `notes.tsx` | tapping notes from vault opens editor |
| P2.9 | ✅ Tests: files/notes repo consistency, rename/delete sync, import→encrypt→row | `__tests__/unit/data/repositories/` | 8 new tests green |

**Exit**: ✅ files/media/notes fully DB-consistent; notes has share/confirm-delete/lock/batch. (⏱ 2 days)

---

## P3 — Permissions & Export Repair (C3, H3, L3)

Goal: storage/media permissions are asked correctly with rationale; exports actually work.

| # | Task | Files | DoD |
|---|---|---|---|
| P3.1 | ✅ **Fix batch export**: after decrypt into cache, call `MediaLibrary.saveToLibraryAsync(tempFile.uri)` per file; delete temp cache after (no plaintext leftovers) | `files.tsx`, `MediaStorage.ts` (`exportDecryptedToLibrary`) | files actually appear in gallery; temp cleaned |
| P3.2 | ✅ Add `NSPhotoLibraryAddUsageDescription` + `NSPhotoLibraryUsageDescription` to `app.json` iOS `infoPlist` + `expo-media-library` plugin with granular permissions | `app.json` | iOS export works; permission string shown |
| P3.3 | ✅ Improve rejection alerts with rationale + "open Settings" hint | `media.tsx`, `files.tsx` | clear permission message, not generic |
| P3.4 | ✅ Pre-import permission check on Android ≤ 12 (`requestMediaPermission` using `PermissionsAndroid`; MediaLibrary fallback) | `media.tsx` | graceful message if denied |
| P3.5 | ✅ Add missing i18n keys (`errors.permissionRationale`, `errors.permissionTitle`, `settings.openSettings`) | `ar.json`, `en.json` | no raw keys in UI |
| P3.6 | ✅ Test: export flow (mock MediaLibrary) | `__tests__/unit/data/media/MediaStorage.test.ts` | export test green |

**Exit**: ✅ exports save to gallery; permissions asked with rationale; iOS plist complete. (⏱ 1 day)

---

## P4 — Backup/Restore v2 (C2) — ⛔ REMOVED (user decision 2026-08-01)

> **Excluded entirely**: backup feature is no longer part of the product. Removed: settings UI (create/restore rows + handlers), `DatabaseService.backup()`/`restore()`, `backup_metadata` table + `vaults.backup_version` column (schema + migration + Vault entity/DTO/mapper/repo + CreateVaultUseCase), `backup` config block, `BACKUP_CREATED/BACKUP_RESTORED` activity actions, `autoBackup*` settings fields, `backups/` dir in FileSystemSource, welcome "Backup" feature (→ "Offline & Private"), all related i18n keys, and the `expo-sharing` dependency. Verified: `tsc` clean, `eslint` 0 errors, 11 suites / 50 tests green, `expo-doctor` 18/18.

| # | Task | Files | DoD |
|---|---|---|---|
| P4.1 | `BackupService` (new `src/data/backup/`): writes `.kzb` = magic `KHAZNAti` + version + checksum + SQLite DB bytes + `khaznati/{vaultId}/**` encrypted files + key manifest (SecureStore keys, encrypted) | new files | file format matches `config.ts:40-44` |
| P4.2 | `RestoreService`: validates magic/version/checksum → writes DB + media + imports keys (after user confirms; blocked while session unlocked) | new files | corrupt file rejected with clear error |
| P4.3 | Wire settings.tsx backup/restore (`:126-193`) to new services; keep old path removed | `settings.tsx` | UI uses v2 |
| P4.4 | Write `backup_metadata` row on backup (schema exists `schema.ts:88-95`); add repository | `src/data/repositories/` | metadata written |
| P4.5 | Tests: round-trip on fresh DB preserves decryptability + media; checksum/version/tamper tests | `__tests__/unit/data/backup/` | suite green |

**Exit**: wipe → restore → all data decrypts + media visible. (⏱ 2 days)

---

## P5 — Settings & i18n/Arabic (H5, H6, M6, R-A)

Goal: every setting works or is removed; Arabic is default, persisted, complete.

| # | Task | Files | DoD |
|---|---|---|---|
| P5.1 | ✅ **Persist theme** via `SettingsRepository` (or SecureStore): rehydrate before first render in `ThemeProvider` (`:24`), not hardcoded SYSTEM | `ThemeProvider.tsx`, `SettingsRepositoryImpl` | restart keeps theme |
| P5.2 | ✅ **Persist language**: store `ar|en`; `i18n/index.ts` reads stored pref before `getLocales()`; `changeLanguage` writes it | `src/core/i18n/index.ts`, `settings.tsx:116-124` | restart keeps language |
| P5.3 | ✅ **Arabic default**: if no stored pref → `ar` (change `index.ts:23` logic so non-Arabic devices still default to Arabic per product requirement); set `supportsRtl` and iOS `CFBundleDevelopmentRegion=ar` + `android.locale` in app.json | `i18n/index.ts`, `app.json` | fresh install shows Arabic + RTL |
| P5.4 | ✅ **Fix missing i18n keys**: add `auth.biometric`, `common.rename`, `files.nameExists`, `files.namePlaceholder`, `media.search`, `settings.languageRestart` to both locales | `ar.json`, `en.json` | no raw keys rendered |
| P5.5 | ✅ **Remove hardcoded English**: ErrorBoundary → wrap with translated props or use `i18n.t` directly (`ErrorBoundary.tsx:23,39,43`); `passwords.tsx:208` placeholder → `t('passwords.notes')`; a11y labels (`Input.tsx:90,98`, `SelectionBar.tsx:47`, `ItemRow` deleted at P0.3, `Header.tsx:34`) | listed files | UI shows Arabic only |
| P5.6 | ✅ Fix Arabic pluralization: `time` section to i18next v4 6-category format | `ar.json` | `t('time.x', {count:3})` renders correctly |
| P5.7 | ✅ **Clipboard protection implemented or removed**: wire `clipboardClearMs` (config.ts:28) → after copy (`passwords.tsx:140`) schedule clipboard clear; read `clipboard_protection` flag at settings load | `passwords.tsx`, `settings.tsx`, new hook | copy clears per setting |
| P5.8 | ✅ **Enforce biometric flag**: `login.tsx:167` shows biometric button only when flag true (read from SecureStore); biometric path checks vault lockout | `login.tsx`, `BiometricUnlockUseCase` | toggle has real effect |
| P5.9 | ✅ Fix dead "Security settings" row (`settings.tsx:246-250`) — add real navigation or remove row | `settings.tsx` | no inert buttons |
| P5.10 | ✅ **Settings state reads from storage on open** (auto_lock_timeout `:61`, biometric `:59` currently hardcoded defaults) | `settings.tsx` | screen reflects stored values |
| P5.11 | ✅ **Wire ActivityLog**: call `ActivityLogRepository.log()` on vault open/create/lock, item add/delete, password copy | screens + use-cases | activity-log modal shows data |
| P5.12 | ✅ Resolve dual settings stores: choose SecureStore as single source (delete SQLite `settings` usage) or migrate to SQLite | `register.ts:67-69`, `settings.tsx` | one store documented |
| P5.13 | ✅ Tests: theme/lang persistence, Arabic plural, biometric flag enforcement, clipboard | `__tests__/unit/...` | suite green |

**Exit**: ✅ settings all functional, Arabic default+persisted, no hardcoded English, activity log populated. (⏱ 2–2.5 days)

---

## P6 — Performance & APK Size (P1–P8, S1–S6, L1–L2)

Goal: responsive lists, off-main-thread crypto where feasible, APK ≤ ~50 MB.

| # | Task | Files | DoD |
|---|---|---|---|
| P6.1 | **Lists → FlatList/FlashList** with `keyExtractor`, `React.memo` rows, `getItemLayout` where fixed height; replace `ScrollView+map` in FilesList, MediaGallery, notes, passwords | `FilesList.tsx:30-54`, `MediaGallery.tsx:26-53`, `notes.tsx:204-268`, `passwords.tsx:248-303` | 60fps scroll w/ 200 items (profiler) |
| P6.2 | **Debounce search**: wire `useDebounce` into SearchBar consumers | `useDebounce.ts`, files/media/notes/passwords | search runs on settled input |
| P6.3 | **useMemo filter/sort** in all lists; `useVaults` resolve DI once (`:15-19`) | list screens, `useVaults.ts` | no per-render recompute |
| P6.4 | **Real thumbnails**: generate `.thumbs` on import (config.ts:33), `MediaThumb` shows image not icon | `MediaStorage.ts`, `MediaThumb.tsx:37` | gallery shows image thumbs |
| P6.5 | **Chunked/lazy decrypt**: decrypt per-row lazily; batch export with concurrency limit (not sequential `for...of`) | `crypto.ts:178-218`, `files.tsx:172-178` | large import/export doesn't freeze UI |
| P6.6 | **DB batch delete** in one transaction | `notes.tsx:133-139`, `passwords.tsx:168-174` | batch delete is atomic/fast |
| P6.7 | **APK size**: `gradle.properties` → `arm64-v8a` only (or AAB); `assetBundlePatterns` → explicit; single Cairo weight; subset @expo/vector-icons | `gradle.properties`, `app.json:50-52`, fonts loader `app/_layout.tsx:63-68` | release APK ≤ ~55 MB; assets load |
| P6.8 | **Replace `Updates.reloadAsync`** (settings.tsx:122,184) with app-state reset or keep expo-updates (document tradeoff) | `settings.tsx` | reload works without expo-updates if removed |
| P6.9 | Tests: list render perf smoke, debounce timing | `__tests__/unit/...` | suite green |

**Exit**: lists smooth, APK measured ≤ ~55 MB, search debounced. (⏱ 2–2.5 days)

---

## P7 — Final Integration & Release Prep

| # | Task | Files | DoD |
|---|---|---|---|
| P7.1 | Full smoke matrix (create→add all types→search→select→export→backup→wipe→restore→lock→biometric) | manual | all flows pass |
| P7.2 | Final `tsc` + `eslint` + `npm test` + `expo-doctor` | CI | all green |
| P7.3 | Bump version/build; release notes | `config.ts:5`, `app.json`, `Recovery/15` | v1.1.0 candidate |
| P7.4 | Update `01-Project-Status.md` + `16`/`17` checkboxes | docs | docs reflect reality |

**Exit**: production-ready gates from `00 §10` satisfied. (⏱ 1 day)

---

## Sequencing & Dependencies

```
P0 (hygiene, 0.5d) ──► P1 (session, 1.5d) ──► P2 (data/notes, 2d)
                                              │
P4 (backup, 2d) ── can run parallel after P1 (needs P1 for clean nav) ──► P7
P3 (permissions, 1d) ── after P0 ──► can parallel with P1/P2 ──► P7
P5 (settings/i18n, 2.5d) ── after P1 (needs session for exit test) ──► P7
P6 (perf/size, 2.5d) ── after P2 ──► P7
P7 (integration, 1d)
```

**Critical path**: P0 → P1 → P2 → P6 → P7. **Parallelizable**: {P3, P4} after P0/P1; P5 after P1.
**Total**: ~11–13 working days (sequential worst case) / ~9–11 parallel.

## Gates (unchanged from `00 §10`)

1. `tsc --noEmit` clean + `eslint` clean + `npm test` green after **every** task.
2. Manual smoke per phase (walkthrough list in `12-Testing-Strategy.md`).
3. No plaintext user data at rest; no silent crypto failure; no dead toggles/routes.
4. APK ≤ ~55 MB, signed, versionCode ≥ 2.

---
**Owner**: single engineering track. **After P7**, update `00-Executive-Plan.md` readiness scores.
