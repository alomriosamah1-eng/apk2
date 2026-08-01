# 16 — Audit Findings & Completion Gaps (حصيلة فحص 2026-08)

> **Project**: Khaznati (خزنتي) — `com.khaznati.vault`
> **Date**: 2026-08-01
> **Method**: 8 parallel code audits (data flow, notes buttons, i18n/Arabic, storage, settings, permissions, performance, APK size) — read-only, all references trace to `file:line`.
> **Baseline**: Phase 0 (Emergency Stabilization) completed — `tsc`/`lint` clean, 7 suites / 36 tests green. This document consolidates what remains after Phase 0.

---

## 1. Audit #1 — Data Flow & Routing (تدفق البيانات والمسارات)

### 1.1 Critical: create-vault never unlocks the session
- `app/(auth)/create-vault.tsx:69` — `router.replace('/(app)/(tabs)/vault')` **without** `session.unlock()`. The guard at `app/(app)/_layout.tsx:9-11` bounces the user back to `/(auth)/welcome`. **User creates a vault, then appears logged-out** (like creation failed).
- Same defect in `app/(auth)/biometric-setup.tsx:25,30` (screen itself is unreachable — dead route).

### 1.2 Session lock is never invoked
- `src/ui/providers/SessionProvider.tsx:56-63` — `lock()` defined but **zero callers**.
- `app/(app)/(tabs)/settings.tsx:231-238` — "Lock all vaults" locks DB rows only, then navigates to welcome; `isUnlocked` stays `true`.
- `app/(app)/(tabs)/vault.tsx:67-73` — iOS quick-exit pushes welcome without locking session.
- Result: guard state and DB lock state diverge; deep-link into `(app)` still passes when user believes they logged out.

### 1.3 Unprotected/reversed flows
- `app/(auth)/login.tsx:100,125` — two buttons `router.push('/(app)/(tabs)/vault')` without unlock → bounced to welcome.
- `app/(app)/_layout.tsx:9-11` — guard redirects to `/welcome`, while auto-lock (`SessionProvider.tsx:91`) redirects to `/login`; inconsistent destinations for same state.
- `(auth)` group is fully open; no reverse-redirect when already unlocked.

### 1.4 Back-navigation & vaultId loss (stack growth + context loss)
| File:line | Defect |
|---|---|
| `files.tsx:272` | back uses `router.push('/(app)/(tabs)/vault')` (stacks screens) without `vaultId` |
| `notes.tsx:193` | same |
| `passwords.tsx:237` | same |
| `settings.tsx:241` | same |
| `media.tsx:184` | ✅ correct — passes `vid` |
| `app/index.tsx:7` | redirect without `vaultId` → relies on `vaults[0]` (creation order), not active vault |

### 1.5 vaultId fallback inconsistency → orphan rows
- `notes.tsx:25` and `passwords.tsx:30` fall back to `''` when no param; `files.tsx:31`/`media.tsx:25` fall back to `'default'`. Empty-string vault creates orphan records.

### 1.6 Dead routes
- `app/(app)/modals/create-folder.tsx` — registered (`modals/_layout.tsx:18`) but opened by no code (no "new folder" button in files.tsx).
- `app/(auth)/biometric-setup.tsx` — registered (`(auth)/_layout.tsx:19`) but unreachable.

---

## 2. Audit #2 — Notes Screen & Required Buttons (شاشة الملاحظات)

### 2.1 Present & working
| Feature | Location |
|---|---|
| Add (FAB) | `notes.tsx:270` + EmptyState `:214` |
| Delete (single) | `notes.tsx:260-262` → `handleDelete` `:93-98` |
| Delete (batch) | `SelectionBar` `:199-201` → `handleBatchDelete` `:133-139` |
| Multiline editor | `notes.tsx:150-182` (`multiline` field `:162-170`) |
| Search (client-side) | `:146-148` via `SearchBar` `:194` |
| Multi-select | long-press `:124-131`, `:230` |
| Pin/unpin | `:257-259` → `handleTogglePin` `:100-103` |
| Back | `:193` |

### 2.2 Missing buttons/features
1. **Share** — not imported anywhere in notes.tsx (exists in files/media/settings).
2. **Delete confirmation** — deletes instantly; files.tsx:142 has an `Alert.alert` confirm, notes does not.
3. **Lock/exit button** — no lock control on notes (nor in tab bar; tabBar hidden in `(tabs)/_layout.tsx:17-20`).
4. **Batch actions** beyond delete (no batch pin/share/move in SelectionBar).
5. **Explicit rename button** — rename only via opening the editor.
6. **Server-side search** — `repo.search` (`INoteRepository.ts:19`) exists but unused; filter is in-memory, no debounce.

### 2.3 Dead code discovered
- `src/ui/components/organisms/ItemRow.tsx` — unused by any screen (dead component).
- `AddItem/DeleteItem/SearchItemsUseCase` + `ItemRepositoryImpl` belong to the **Files** domain, not notes; notes calls `INoteRepository` directly (by design, but bypasses use-cases).

---

## 3. Audit #3 — Arabic as Default Language (اللغة العربية)

### 3.1 Not default
- `src/core/i18n/index.ts:23` — `lng: systemLanguage === 'ar' ? 'ar' : 'en'` — follows device; Arabic only on Arabic devices.
- `fallbackLng: 'en'` (`:24`).
- `app.json` has **no** `locales`, `locale`, or `supportsRtl` — native build language is system default.

### 3.2 Language preference not persisted
- `changeLanguage()` (`index.ts:33-40`) in-memory only; restarts re-detect from system. `settings.tsx:116-124` forces `Updates.reloadAsync()` to apply RTL.
- i18n system otherwise healthy: `getLocales()` (`:3`), `forceRTL`/`swapLeftAndRightInRTL` (`:15-16`), ar.json (299 keys) + en.json (302 keys).

### 3.3 Missing translation keys (render as raw keys)
`auth.biometric`, `common.rename`, `files.nameExists`, `files.namePlaceholder`, `media.search`, `settings.languageRestart`.

### 3.4 Hardcoded English (visible to users)
- `ErrorBoundary.tsx:23,39,43` — "Something went wrong", "Reload", "Unexpected error".
- `passwords.tsx:208` — placeholder `"Additional notes"` (key `passwords.notes` exists).
- Accessibility labels: `Input.tsx:90,98`, `SelectionBar.tsx:47`, `ItemRow.tsx:73`, `Header.tsx:34`.

### 3.5 Arabic pluralization risk
- `time` section in ar.json uses `base/_plural` only; i18next v4 Arabic needs 6 categories (zero/one/two/few/many/other).

---

## 4. Audit #4 — Save & Store Everything (الحفظ والتخزين)

### 4.1 Working (persistent)
- SQLite WAL (`DatabaseService.ts:64-68`), 7 tables (`schema.ts`), migration runner v1→v2 (`register.ts:25-30`).
- AES-256-GCM field-level encryption: notes (`NoteRepositoryImpl.ts:31`), passwords (`PasswordRepositoryImpl.ts:31`), files on disk (`files.tsx:93,175`), media (`MediaStorage.ts`), biometric token (`BiometricUnlockUseCase.ts:63`).
- Keys in SecureStore: `db_encryption_key`, `note/pwd/media_vault_key_*`, `biometric_device_key`.

### 4.2 Critical gaps
| # | Gap | Evidence |
|---|---|---|
| G1 | **Backup/restore loses decryptability** — copies only `khaznati.db`; excludes SecureStore keys + encrypted files → restore on another device cannot decrypt | `settings.tsx:126-193`, `DatabaseService.ts:183-194` |
| G2 | File delete/rename doesn't update `items` table → orphan rows | `files.tsx:148,244`, `media.tsx:87` |
| G3 | Files/media lists read from filesystem, not `items` DB → favourites/metadata invisible | `files.tsx:54`, `media.tsx:41` |
| G4 | `ActivityLogRepository.log()` has zero callers → activity_log always empty | grep: no `.log(` outside repo |
| G5 | PIN-hash upgrade is no-op: `VaultRepositoryImpl.update` (`:58-64`) omits `encrypted_pin_hash`/`pin_salt` columns | `UnlockVaultUseCase.ts:62-75` |
| G6 | DeleteVault doesn't delete `document/khaznati/{vaultId}/` folder | `DeleteVaultUseCase.ts:7-9` |
| G7 | `SettingsRepository` (SQLite) dead code; theme & language never persisted | `register.ts:67-69`, `ThemeProvider.tsx:24` |
| G8 | DB `PRAGMA key` unsupported by expo-sqlite → file stored plaintext (field-level only) | `DatabaseService.ts:46-62` |

### 4.3 Not persisted
Theme (`ThemeProvider.tsx:24` — always SYSTEM), language (see §3.2). Backup DB `DatabaseService.backup()` (`:164-180`) has no caller.

---

## 5. Audit #5 — Settings Components (مكونات الإعدادات)

### 5.1 Working
Backup (copy DB + share, `:126-160`), Restore (`:162-193`), Clear all data (`:195-217`), Lock all vaults (`:231-238`), auto-lock (applies **after restart only**), biometric toggle requests real device auth (`useBiometrics.ts:39,45,79`).

### 5.2 Advertised-but-inert (decorative)
| Setting | Defect | Location |
|---|---|---|
| "Security settings" row | `TouchableOpacity` with **no onPress** | `settings.tsx:246-250` |
| Clipboard protection | toggle writes flag only; **no reader, no `Clipboard.clearAsync`** | `settings.tsx:84-88`; `config.ts:28` unused |
| Biometric flag | written but **never read**; login button shows whenever hardware available | `settings.tsx:81`; `login.tsx:167` |
| Theme | not persisted | `ThemeProvider.tsx:24` |
| Language | not persisted | §3.2 |
| Activity log | modal always empty (G4) | `activity-log.tsx:68-72` |
| 8 settings in `Settings.ts` | not exposed in UI: authMethod, lockType, screenCapturePrevention, rootDetection, secureDelete, thumbnailQuality, autoBackup, autoBackupIntervalDays, storagePath | `src/domain/entities/Settings.ts:8-32` |

### 5.3 Two competing settings stores
`SettingsRepositoryImpl` (SQLite `settings` table, DI-registered) is dead; screens write SecureStore directly. Single source of truth missing.

---

## 6. Audit #6 — Storage Permission Prompts (نوافذ أذونات الوصول)

### 6.1 Only export-time requests exist
- `MediaLibrary.requestPermissionsAsync()` at `files.tsx:163` and `media.tsx:149`.
- **Zero `PermissionsAndroid`** in project; no `getPermissionsAsync` checks.

### 6.2 Critical bug: batch export writes to cache only
- `files.tsx:161-184` requests permission, decrypts files into `Paths.cache/khaznati_export`, but **never calls `MediaLibrary.saveToLibraryAsync`** → nothing saved to gallery; shows misleading "export success". Temp files left unencrypted, no cleanup.

### 6.3 Imports need no permission (rely on system pickers) — OK on Android 13+, silent-fails on ≤12.
- `files.tsx:87` DocumentPicker, `media.tsx:104` ImagePicker, `AddOptionsSheet.tsx:38` DocumentPicker.

### 6.4 iOS config incomplete
- `app.json:19-21` — only `NSFaceIDUsageDescription`; **missing `NSPhotoLibraryAddUsageDescription`** (required for `saveToLibraryAsync`).

### 6.5 No rationale messages; generic rejection alert
- `media.tsx:150-153` shows generic "unexpected error" instead of permission explanation.

### 6.6 Declared-but-unused permissions
- `READ/WRITE_EXTERNAL_STORAGE` (`app.json:36-37`) unused (Scoped Storage makes WRITE inert on 11+); expands attack surface.

---

## 7. Audit #7 — Performance (سرعة الأداء)

### 7.1 Fixed so far (Phase 0/partial)
- PBKDF2 replaces 100k-await hash (`secure.ts:66-72`). WAL+NORMAL+retry (`DatabaseService.ts:64-68`). Memoized atoms (Icon, Button, Card, BottomSheet, etc.). ThemeProvider memoized (`ThemeProvider.tsx:26-51`). Media decrypt on-demand.

### 7.2 Remaining bottlenecks
| # | Bottleneck | Evidence |
|---|---|---|
| P1 | **No FlatList/FlashList anywhere** — all lists `ScrollView+map` (no virtualization) | `FilesList.tsx:30-54`, `MediaGallery.tsx:26-53`, `notes.tsx:204-268`, `passwords.tsx:248-303` |
| P2 | **Crypto is pure JS on main thread** — full base64 in JS heap; large images block UI | `crypto.ts:178-218`; `media.tsx:107` (`base64:true`) |
| P3 | **Search not debounced** — `useDebounce` defined but unused | `useDebounce.ts:3-12`; filter at render in all lists |
| P4 | No real thumbnails — `MediaThumb` renders static icon | `MediaThumb.tsx:37`; `config.ts:33` unused |
| P5 | Sequential boot: fonts→DI→db.initialize→migrations→integrityCheck on main | `app/_layout.tsx:60-86` |
| P6 | Batch delete per-row SQL, no transaction | `notes.tsx:133-139`, `passwords.tsx:168-174` |
| P7 | No decrypt session cache — every `findByVaultId` re-decrypts all rows | `NoteRepositoryImpl.ts:64`, `PasswordRepositoryImpl.ts:74` |
| P8 | `useVaults` resolves DI every render | `useVaults.ts:15-19` |

---

## 8. Audit #8 — App Size (حجم التطبيق)

### 8.1 Measured
| Item | Value |
|---|---|
| node_modules | 551 MB |
| **Built release APK** | **93 MB** (universal, 4 ABIs) |
| native `.so` (4 ABIs) | 72 MB |
| dex | 28.5 MB |
| JS bundle | 3.3 MB (reasonable) |
| fonts | 4.6 MB |

### 8.2 Size drivers & quick wins
| # | Issue | Fix | Saving |
|---|---|---|---|
| S1 | **4 ABIs** built into universal APK | build arm64-v8a only (or AAB) | ~40–50 MB |
| S2 | All 19 @expo/vector-icons fonts bundled | only MaterialCommunityIcons needed | ~4 MB |
| S3 | All 8 Cairo weights bundled (4 used) | single weight set | ~375 KB |
| S4 | expo-updates native code bundled despite `enabled:false` | replace `Updates.reloadAsync()` (settings.tsx:122,184) | ~1–2 MB |
| S5 | Dead deps: `expo-device`, `expo-status-bar`, `expo-build-properties` | remove | small |
| S6 | `assetBundlePatterns: ["**/*"]` | explicit globs | startup+size |

### 8.3 app.json errors (expo-doctor fail)
- `app.json:44` `android.enableProguardInRelease` and `:45` `android.enableHermesCodegen` — not valid `android` schema keys → remove.
- Projected: arm64-only APK **~45–55 MB**; AAB ~35–45 MB per device.

---

## 9. Consolidated Severity Matrix

| Severity | ID | Item | Fix home |
|---|---|---|---|
| 🔴 Critical | C1 | create-vault → no unlock → bounce to welcome | §P1 |
| 🔴 Critical | C2 | Backup/restore loses keys+media (unreadable restore) | §P4 |
| 🔴 Critical | C3 | Batch export requests permission, saves nothing | §P3 |
| 🔴 High | H1 | Session lock never called; DB/guard state diverge | §P1 |
| 🔴 High | H2 | Guard redirects to welcome vs login inconsistently | §P1 |
| 🔴 High | H3 | Missing iOS photo-library usage description | §P3 |
| 🟠 High | H4 | Files read from FS not DB → orphan rows, lost metadata | §P2 |
| 🟠 High | H5 | Settings largely decorative (clipboard/biometric/theme/lang/activity) | §P5 |
| 🟠 High | H6 | Arabic not default; language pref not saved | §P5 |
| 🟡 Med | M1 | No FlatList / no debounce / main-thread crypto | §P2 |
| 🟡 Med | M2 | Back buttons stack screens + lose vaultId | §P1 |
| 🟡 Med | M3 | Missing notes buttons (share, confirm-delete, lock, batch) | §P2 |
| 🟡 Med | M4 | PIN-hash upgrade no-op; deleteVault leaves folder | §P2 |
| 🟡 Med | M5 | Dead routes (create-folder, biometric-setup); ItemRow dead | §P1 |
| 🟡 Med | M6 | 6 missing i18n keys + hardcoded English | §P5 |
| 🟢 Low | L1 | APK 93 MB (arm64 → ~50 MB) + dead deps | §P6 |
| 🟢 Low | L2 | app.json invalid keys | §P6 |
| 🟢 Low | L3 | Unused permissions declared | §P3 |

---
**Source of truth for fixes**: `17-Repair-Plan.md` (this audit is the "what"; the plan is the "how/when").
