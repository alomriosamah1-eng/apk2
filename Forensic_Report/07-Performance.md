# 07 — Performance Investigation

Primary causes of user-perceived slowness (startup, navigation, screen open), with cause / location / impact / severity.

---

## P-1 — CRITICAL (HIGH): Serial, blocking, slow startup chain before first frame
- **Cause:** `app/_layout.tsx:60-87` awaits, sequentially, before `ready=true` and before `SplashScreen.hideAsync()` (deferred to `onLayout`, line 56-58): `initI18n` → 4 `Font.loadAsync` → `registerDependencies` → `db.initialize` → `runner.run` → `db.integrityCheck` (full `PRAGMA integrity_check` scan, `DatabaseService.ts:151-161`) → `preventScreenCaptureAsync`.
- **Location:** `app/_layout.tsx:60-87`; `DatabaseService.ts:151-161`.
- **Impact:** Cold start shows `SplashLoading` indefinitely until all of the above complete. On a populated DB the integrity scan is slow.
- **Severity:** 🔴 / High. **Confidence:** High.

## P-2 — CRITICAL (HIGH): Synchronous 100k-iteration PBKDF2 on the JS thread
- **Cause:** `hashPin` (`secure.ts:66-72`) runs `pbkdf2(sha256, …, { c: 100000 })` synchronously on the UI thread. Called by `verifyPin` (`secure.ts:105-119`) → unlock/login, and by vault create. On a wrong PIN, `verifyPin` also calls `hashPinLegacy` (100k **async** `Crypto.digestStringAsync` bridge calls) — extreme stall.
- **Location:** `secure.ts:59-72, 75-85, 105-119`; used in `UnlockVaultUseCase.ts`, `BiometricUnlockUseCase.ts`, `CreateVaultUseCase.ts`.
- **Impact:** Multi-second (potentially 10s+ on wrong pin) UI freeze during login/unlock/create.
- **Severity:** 🔴 / High. **Confidence:** High.

## P-3 — HIGH (MEDIUM): Per-row AES-GCM decryption on the JS thread on list load
- **Cause:** `NoteRepositoryImpl.findByVaultId:58-72` → `Promise.all(rows.map(decryptNote))`; `PasswordRepositoryImpl.findByVaultId:67-90`. Pure-JS GCM on main thread, re-decrypting every row each load.
- **Impact:** Slow opening of notes/passwords screens as data grows.
- **Severity:** 🟠 / Medium-High. **Confidence:** Medium.

## P-4 — HIGH (HIGH): Un-virtualized lists (ScrollView, no FlatList)
- **Cause:** All lists use `ScrollView`: `FilesList.tsx:30`, `MediaGallery.tsx:26`, `notes.tsx:263`, `passwords.tsx:287`. Everything mounts at once.
- **Impact:** Slow render and scroll with many rows.
- **Severity:** 🟠 / Medium. **Confidence:** High.

## P-5 — MEDIUM (HIGH): SessionProvider context value rebuilt every render
- **Cause:** `SessionProvider.tsx:100` — `<SessionContext.Provider value={{...state, unlock, lock, ...}}>` new object literal each render (no `useMemo`).
- **Impact:** every consumer re-renders on any session state change (unlock/lock/activity).
- **Severity:** 🟡 / Medium. **Confidence:** High.

## P-6 — MEDIUM (HIGH): Redundant full-vault DB queries per navigation
- **Cause:** Each screen calling `useVaults()` runs `getVaults.execute()` (`useVaults.ts:81-83`) on mount — login, vault, settings; plus `(app)/_layout.tsx:13-26` runs a second `getVaults.execute()` in an effect.
- **Impact:** Multiple redundant `SELECT * FROM vaults` per navigation.
- **Severity:** 🟡 / Medium. **Confidence:** High.

## P-7 — MEDIUM (MEDIUM): every DB op wrapped in `withRetry` with backoff
- **Cause:** `resilience.ts:12-32`; `DatabaseService.executeSql/query/...` wrap in `withRetry`, adding exponential delays (up to ~3s) on any failure — including the every-launch migration-2 failure.
- **Impact:** Latency added on failing paths; masks root errors under retries.
- **Severity:** 🟡 / Medium. **Confidence:** Medium.

## P-8 — LOW (MEDIUM): navigation/redirect hops after unlock
- **Cause:** post-unlock mount → async `activeVaultLocked` check → possible `<Redirect href="/(auth)/login" />` (`(app)/_layout.tsx:28-30`).
- **Impact:** extra render/navigation hop & unlock flicker.
- **Severity:** 🟢 / Low. **Confidence:** Medium.

## P-9 — LOW (HIGH): metro alias resolver uses `fs.statSync` per resolution
- **Cause:** `metro.config.js` `resolveRequest` calls `fs.statSync` across 4 extensions + index for every `@`-import, bypassing Metro caching.
- **Impact:** slower cold Metro build (not runtime navigation on release).
- **Severity:** 🟢 / Low (dev). **Confidence:** High.

## P-10 — LOW (MEDIUM): font loading of 4 weights always
- **Cause:** `Font.loadAsync(Cairo ×4)` unconditionally at startup (`_layout.tsx:64-69`).
- **Impact:** adds to startup chain; could lazy-load.
- **Severity:** 🟢 / Low. **Confidence:** Medium.

---

## Perf blame ranking
1. P-1 startup serial chain (+ integrity scan)
2. P-2 sync PBKDF2 (login/unlock/create)
3. P-3 per-row decrypt
4. P-4 un-virtualized lists
5. P-5/P-6 re-renders + redundant queries

## Note
No native-thread blocking beyond the JS-thread crypto above; no memory-leak/circular-dependency was found. Suspicious "app is very slow" is dominated by P-1 + P-2.