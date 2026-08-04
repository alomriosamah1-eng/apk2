# 00 — Executive Summary

## Khaznati Forensic Investigation
**Date:** 2026-08-04
**Scope:** Full read-only code audit of `/home/osamah/program/my-valut` (Expo SDK 54 / React Native 0.81.5 / expo-router 6 / expo-sqlite 16 / @noble AES-256-GCM)
**Mode:** Evidence-backed reverse engineering. No file was modified. No conclusion was inferred; every finding cites `file:line` and the actual code read.

---

## Headline verdict

The app is **architecturally sound** — clean layering, real DI container, real AES-256-GCM field encryption, real SQLite repositories, real screens with real handlers. **The UI is not a fake shell.**

But the app is broken by a small number of **high-severity engineering defects** concentrated in the database bootstrap and the session layer. Because these sit at the foundation, a large fraction of the UI appears "non-functional" even though the feature code is real.

---

## The three systemic root causes

### 🔴 RC-1 (affects most features): SQLite schema is never fully applied
`SCHEMA` (`src/data/database/schema.ts:2-92`) is one string containing **5 `CREATE TABLE` + 11 `CREATE INDEX`** statements. Migration 001 calls `db.executeSql(SCHEMA)` (`001_initial.ts:5-7`), which routes through `DatabaseService.executeSql` → `runSync` (`DatabaseService.ts:89-92`) → native `sqlite3_prepare_v2(..., pzTail=nullptr)` (`NativeDatabaseBinding.cpp:119-125`). `prepare_v2` compiles **only the first statement** and silently discards the rest when `pzTail` is null. Result: on a fresh install only `vaults` is created; **`items`, `notes`, `passwords`, `activity_log` never exist.**

→ Every INSERT/UPDATE/SELECT against those tables throws `no such table`, is caught, and returned as a `DatabaseError` `Result`. The screens treat a failed `Result` by doing nothing and closing the form silently (e.g. `notes.tsx:98-108`, `passwords.tsx:137-147`). This is the true root cause of:
- Creating notes "does not work"
- Saving passwords "does not work"
- Importing images/videos/audio/files "does not work" (DB record failure)
- Activity log being empty
- Migration 002 failing on every launch (`app/_layout.tsx:80-81` "App initialization failed")

### 🔴 RC-2: "Remember me" / session is never persisted
`REMEMBER_KEY` flag is written to SecureStore on login (`login.tsx:70-73`) but **never read back** to restore a session. `SessionProvider` keeps everything in React state only (`SessionProvider.tsx:47-63, 27-32`). On any app restart or `Updates.reloadAsync()` the session is wiped.

### 🟠 RC-3: Media import writes to a directory the Media screen never reads
The primary "Add Photo" flow (`AddOptionsSheet.importToVault`, `AddOptionsSheet.tsx:45-80, 93-97`) writes imported media to `Paths.document/khaznati/{vaultId}` as `ItemType.FILE`. But `media.tsx loadMedia` (`media.tsx:33-57`) lists **only** files under `Paths.document/khaznati/{vaultId}/.encrypted_media`. The photo is therefore invisible in the Media tab. Two divergent, unreconciled storage pipelines (see 05/06).

---

## Feature completion snapshot (full detail in 03)

| Feature | Status | Root cause |
|---|---|---|
| Create/Unlock vault | ✅ Works | vaults table exists (RC-1 only created it) |
| Notes CRUD | ❌ Broken | RC-1 (`no such table: notes`) |
| Passwords CRUD | ❌ Broken | RC-1 (`no such table: passwords`) |
| Import photos/videos/audio/files | ❌ Broken | RC-1 + RC-3 (DB record + wrong dir) |
| Activity log | ❌ Broken | RC-1 (`no such table: activity_log`) |
| Encryption (AES-GCM) | ✅ Real | — |
| Biometric unlock | ⚠️ Partial | works only when `biometric_enabled` flag set |
| Remember me | ❌ Broken | RC-2 (never consumed) |
| Dark mode | ⚠️ Partial | provider works; many hardcoded light colors + SYSTEM→LIGHT no-op |
| Language (ar/en) | ⚠️ Partial | i18n works; persistence is fire-and-forget + needs reload; `forceRTL` needs restart |
| Performance | ❌ Slow | sync 100k-iter PBKDF2, per-row AES on JS thread, un-virtualized ScrollView, serial blocking startup |

---

## Severity distribution

| Severity | Count | Representative findings |
|---|---|---|
| 🔴 Critical | 2 | RC-1 (schema), RC-2 (session) |
| 🟠 High | 7 | RC-3, vaultId='default' FK, unwrapped keys, biometric token, backup=true, CI debug-signing, 100k PBKDF2 |
| 🟡 Medium | 12 | PRAGMA user_version mismatch, note batch pin, no virtualization, `Math.random` password gen, hardcoded colors, permission over-gating |
| 🟢 Low / Info | ~15 | Unused deps, deprecated jest-native, legacy storage flags, RTL hardcode, non-null assertions |

Full matrices in `16-Critical-Issues.md`, `06-Root-Cause.md`.

---

## Key positive findings (things that are genuinely real and correct)
- **Layering is clean** (UI → hooks → DI → use cases → repositories → SQLite/secure-store), verified structure in 02.
- **AES-256-GCM field encryption is genuine** (`crypto.ts:65-105, 178-218`) and used by notes, passwords, media, biometrics.
- **Password hashing is real PBKDF2** (100k iterations, salted) — `secure.ts:59-72`.
- **DI container** correctly wires every repository and use case (`register.ts`); DI is NOT the breakage.
- **Android scoped-storage & photo-picker flow** is modern and correct (`media.tsx:102-152`).
- **Camera is correctly blocked**; FileProvider is in place; no background/FG-service conflicts (Android 10–15 compatible).
- **Version alignment** with Expo SDK 54 manifest is exact (all deps satisfy `bundledNativeModules.json`).

---

## Recommended order of recovery (evidence basis in 17/06)
1. Fix schema application (use multi-statement `execSync`/`execAsync`, or split statements) → unblocks notes, passwords, items, activity log, media DB records.
2. Fix `PRAGMA user_version` column-name mapping (`DatabaseService.ts:138-148`).
3. Fix session persistence / remember-me (read flag back at boot).
4. Unify media import pipeline (single directory + single SQL type) → RC-3.
5. Performance: move PBKDF2 + decrypt off JS thread, virtualize lists, memoize SessionProvider value, shorten serial startup.
6. Release hardening: ABI split, R8 minify, keystore secrets, `allowBackup=false`, `versionCode` in app.json.

---

## Evidence provenance
- 19 files in this folder. Every table, flow, and severity is cross-referenced to concrete source lines read during investigation.
- Files 18-Evidence / 06-Root-Cause / 16-Critical-Issues carry the primary evidence citations.
- No runtime instrumentation or device logs were used; conclusions are **static code analysis with High confidence** on the codepaths, except where marked Medium/Low and cross-checked against `node_modules` native sources (e.g. `sqlite3_prepare_v2` pzTail behavior).