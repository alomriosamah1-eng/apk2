# 17 — Recovery Recommendations

Evidence-grounded recovery roadmap. **No code is written** — this is a sequenced set of recommendations with rationale and file targets, ordered by leverage. Each maps to the root cause identified in 06/16.

---

## Phase 0 — Stabilize the foundation (highest leverage)

### R1. Fix schema application — unblocks notes/passwords/files/media/activity at once (RC-1)
- **Target:** `src/data/database/DatabaseService.ts` (`executeSql`, `query`), `src/data/database/migrations/001_initial.ts`, `schema.ts`.
- **Why:** `runSync` executes only the first statement; the 92-line `SCHEMA` drops 4 tables + 11 indexes. Use the multi-statement API (`execSync`/`execAsync`) for the schema, or split the schema into per-statement executions.
- **Verification:** after change, `SELECT name FROM sqlite_master` must list `vaults, items, notes, passwords, activity_log`. Add an integration test that runs migrations against a real (temp) database and asserts all tables exist — this is exactly what the current fake-DB repo tests can't catch.
- **Effect:** restores notes, passwords, item import, activity log, and re-enables `integrityCheck` + `preventScreenCaptureAsync` (which currently never run).

### R2. Fix `PRAGMA user_version` read (RC-1 compound / 06 H6)
- **Target:** `DatabaseService.getVersion` (`DatabaseService.ts:138-148`).
- **Why:** reads column `version` from a result whose column is `user_version` → always `0`. Correct the projection so migration bookkeeping works and migration 2 stops failing every launch.
- **Effect:** migration 2 applies; boot no longer logs "App initialization failed"; `user_version` becomes meaningful.

## Phase 1 — Session & user-facing honesty

### R3. Persist & hydrate the session / honour "remember me" (RC-2)
- **Target:** `SessionProvider.tsx`, `app/index.tsx`, `login.tsx`, `app/(app)/_layout.tsx`.
- **Why:** remember flag is written but never read; session lives only in React state → every restart/reload logs out (also causes "language change logs me out").
- **Recommendation:** on boot, if a remembered vault's PIN/biometric token validates, restore the session; store `rememberedVaultId`/`lastUnlockedAt` and rehydrate. Keep it secure: re-validate the PIN hash (or require biometric) rather than trusting a bare flag.

### R4. Surface failures instead of silently closing forms (06 CQ-1)
- **Target:** `notes.tsx:98-108`, `passwords.tsx:137-147`, `AddOptionsSheet.importToVault`.
- **Why:** on a failed `Result` the UI currently closes/clears with no feedback → "buttons do nothing."
- **Recommendation:** show an error (snackbar/alert) on `failure`, and keep the draft data.

## Phase 2 — Media pipeline unification (RC-3)

### R5. Single storage pipeline for imports
- **Target:** `AddOptionsSheet.importToVault`, `files.tsx`, `media.tsx`, `MediaStorage.ts`, and either retire or wire `FileSystemSource`.
- **Why:** imports write to `khaznati/{vid}` as FILE while Media tab reads only `.encrypted_media`; two key namespaces (`file_vault_key_*` vs `media_vault_key_*`) diverge.
- **Recommendation:** pick one canonical store+type for media and drive both the Media and Files screens from the same source of truth (single encrypt location + single `items` type + consistent dir). Resolve the `itemRepo.create` path (blocked by R1).
- **Effect:** imported photos become visible where the user expects.

### R6. Recent permissions over-gating (13 PERM-1)
- **Target:** `media.tsx:102-116`.
- **Why:** forces a MediaLibrary permission even though the system picker needs none on API 33+/iOS; denied-library devices are blocked unnecessarily.
- **Recommendation:** call the picker directly on modern Android/iOS; only request library permission when actually exporting.

## Phase 3 — Performance (07)

### R7. Move PBKDF2 off the JS thread (P-2)
- **Target:** `secure.ts:59-72`. Use a native/web-worker or a lower-cost iteration strategy; avoid the 100k async-bridge loop in the legacy path.
- **Impact:** removes multi-second login/create/unlock freezes.

### R8. Defer/offload list decryption (P-3)
- **Target:** `NoteRepositoryImpl.ts:58-72`, `PasswordRepositoryImpl.ts:67-90`. Decrypt lazily/on-demand or in a worker, and only visible rows.

### R9. Virtualize lists (P-4)
- **Target:** `FilesList.tsx:30`, `MediaGallery.tsx:26`, `notes.tsx:263`, `passwords.tsx:287` → FlatList/SectionList.

### R10. Trim startup chain (P-1)
- **Target:** `app/_layout.tsx:60-87`. Parallelize independent inits (fonts ↔ i18n), make `integrityCheck` non-blocking/optional, lazy-load fonts, hide splash earlier and stream content.

### R11. Memoize SessionProvider value (P-5); dedupe vault queries (P-6)
- **Target:** `SessionProvider.tsx:100` (`useMemo`); `useVaults.ts:81-83` + `(app)/_layout.tsx:13-26`.

## Phase 4 — Theme & i18n polish (07 F10-F16)
- Fix SYSTEM→LIGHT first-tap no-op (`settings.tsx:120-132`).
- Await & harden i18n persistence; sequence `Updates.reloadAsync` after write (`i18n/index.ts:45-49`); prefer no-reload RTL where possible.
- Replace hardcoded light colors with theme tokens (`vault.tsx:41-47,172`, `FileRow.tsx:49`, `AddOptionsSheet.tsx:184`, `ErrorBoundary.tsx:58`, `settings.tsx:41`).
- Localize `about.tsx`.

## Phase 5 — Security hardening (14)
- **R12.** Wrap data keys under the PIN (derive keys from PIN+salt, or encrypt key blobs with a PIN-derived key) — closes SEC-1. Update `UnlockVaultUseCase` to actually gate decryption.
- **R13.** Only store the biometric token when the user opts in; add a fresh-auth requirement inside `BiometricUnlockUseCase.execute` (SEC-3).
- **R14.** Use CSPRNG for the password generator (crypto) (SEC-5).
- **R15.** Set `android:allowBackup=false` (08 A-1, SEC-6) so cloud restore cannot yield keyless encrypted blobs.
- **R16.** Restore screen-capture protection (automatic once R1 lands).

## Phase 6 — Build & release (08/09)
- **R17.** Set keystore secrets (`ANDROID_KEYSTORE_BASE64` etc.) so release builds use proper signing instead of the debug fallback (build.yml:96-98).
- **R18.** Set `android.versionCode` in `app.json` (currently always 1; android/ 1.0.0 vs 1.1.0) (08 A-3).
- **R19.** Split ABIs (`arm64-v8a/armeabi-v7a` for release) and enable R8 minify/shrink (09 S-1/S-2) → significant APK size reduction.
- **R20.** Enable `enableOnBackInvokedCallback` (08 A-2); remove dead storage flags (08 A-4/A-5).
- **R21.** Align `install.sh`/`packages.md` to SDK 54 (drop SDK-57 `expo-image-picker@~57.0.6`, add/remove expo-build-properties per need) (09 D-1).

## Phase 7 — Tests & quality (10)
- **R22.** Migrate repo tests to a real temporary SQLite DB (or assert post-migration schema) so RC-1 can't silently recur; add media/import/session/startup tests.
- **R23.** Disable `--passWithNoTests` (make no-tests a failure) (10 Testing).
- **R24.** Remove deprecated/unused `@testing-library/jest-native`; reconcile the `@` alias across Metro/TS/Jest (09 D-3/6).

## Phase 8 — APK size reduction (user-reported: ~93 MB installed)
- **R25.** Cut installed APK size from ~93 MB toward <60 MB. Context: the APK is near all-overhead (fat ABI + full icon font + unpruned assets + no R8/minify). **Note:** all candidate "unused" Expo modules are actually imported (`expo-blur` in `GlassCard.tsx`, `expo-linear-gradient` in `welcome.tsx`, `expo-image-picker` + `expo-media-library` in `media.tsx`/`files.tsx`, `expo-updates` in `settings.tsx`, `expo-screen-capture` in `app/_layout.tsx`, `expo-image` in `MediaPreview.tsx`) — so dependency removal is NOT the lever; the wins are below.
- **Concrete actions:**
  1. **Split ABIs for release** (arm64-only + optional x86_64 emulator split) instead of one universal fat APK (09 S-1). Largest single win — a fat APK carries 3 ABIs of native libs.
  2. **Enable release minification** — `minifyEnabled` + `shrinkResources` in the release Gradle build (R8 strips unused JS/libs) (09 S-2).
  3. **Verify Hermes bytecode + `dev:false`** — release bundle should compile to Hermes bytecode with dev/debug assets stripped (jsEngine already `hermes`); ensure the CI `expo export`/gradle release path sets `dev:false`.
  4. **Subset the icon font** — `@expo/vector-icons` ships the full MaterialCommunityIcons TTF (multiple MB); build a trimmed subset with only the ~40 glyphs the app uses, or migrate to a tree-shaken icon set.
  5. **Scope `assetBundlePatterns`** — currently `"**/*"` pulls everything; restrict to `assets/**` + locales so Metro doesn't inline unused assets.
  6. **Enable AAB/App Bundle for Play** — deliver `.aab` (per-device native code) instead of APK; users install ~30% smaller.
- **Verification:** rebuild via CI, compare artifact size vs the 43.7 MB AAB / 93 MB installed baseline; check `npx expo export --platform android` bundle size.

---

## Sequencing rationale
1. **R1+R2 first** — one-line class of failure unblocks the majority of user-facing symptoms and re-enables boot-time hardening. Highest ROI, lowest blast radius.
2. **R3+R4** — restore persistence trust and honest UX.
3. **R5+R6** — finish the actual media feature users report as broken.
4. Then R7–R24 are conventional hardening/perf/security/release — can be done incrementally.
5. **R25 (APK size)** — a full release build is cheap to run via CI; execute it in parallel with any phase and re-measure against the 93 MB baseline.

Each fix is independently verifiable: schema presence (`sqlite_master`), session restore on cold boot, imported photo visible in Media tab, list virtualization perf, size of release APK, clean `gh`/`expo-doctor` gate.