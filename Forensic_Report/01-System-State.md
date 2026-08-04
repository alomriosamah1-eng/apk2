# 01 — System State

Current repository state at time of investigation (commit `07447b2`, v1.1.0).

## Build / runtime facts
- **Bundle:** Expo SDK 54, React Native 0.81.5, expo-router 6, expo-sqlite 16, Hermes, New Architecture.
- **Entry:** `expo-router/entry` (`package.json:main`). JS entry is `app/_layout.tsx`.
- **DB:** SQLite WAL, `openDatabaseSync` (`DatabaseService.ts:30`). Keys via `expo-secure-store`.
- **Crypto:** `@noble/ciphers` AES-256-GCM + `@noble/hashes` PBKDF2 HMAC-SHA256.

## What the user experiences
1. App is very slow (startup, navigation, screen open).
2. Importing photos, videos, audio, files "does not work".
3. Creating notes "does not work".
4. Changing language / dark mode "does not work".
5. "Remember password" / session does not persist.
6. Many buttons appear to be UI without effect.

## What the code actually is (contrast)
- Not a shell: screens contain real handlers wired to real repositories (verified).
- The apparent "buttons do nothing" is overwhelmingly caused by **silent failure results**: repositories return `failure(DatabaseError)` due to missing tables (RC-1), and the UI closes/hides the form with no error shown.
- Source of "no error shown": `notes.tsx:98-108` (only reloads list on success, then `setEditingNote(null)` regardless), `passwords.tsx:137-147` (closes form & clears regardless), `AddOptionsSheet.importToVault` (`AddOptionsSheet.tsx:45-80`) discards the `Result`.

## Feature capability matrix (real implementation exists = yes, works at runtime = conditional)

| Area | Code present | Runtime works? | Blocker |
|---|---|---|---|
| Vault create/unlock/lock/delete | Yes | Yes (new install) | vaults table exists |
| Notes create/edit/delete/pin | Yes | No | `no such table: notes` (RC-1) |
| Passwords create/edit/delete | Yes | No | `no such table: passwords` (RC-1) |
| Item import (doc/img/media) | Yes | No | `no such table: items` + RC-3 dir |
| Activity log | Yes | No | `no such table: activity_log` |
| Encryption | Yes | Yes | — |
| Session/remember | Partial | No | RC-2 (write-only flag) |
| Dark mode | Yes | Partial | hardcoded colors + cycle no-op |
| Language | Yes | Partial | persistence + reload race |
| Startup perf | — | No | serial blocking init |

## Environment perimeter (from prior CI evidence)
- GitHub Actions `build.yml` builds `assembleRelease`. `ANDROID_KEYSTORE_BASE64` secret unset → **debug-signing fallback** (build.yml:96-98). Recent Build #15 succeeded (20m 36s), artifact `khaznati-release` 43.7 MB.
- APK reported ~96 MB local; universal build includes x86/x86_64 debug-only ABIs.

## Configuration baseline
- `minSdk 24` / `targetSdk 36` / `compileSdk 36`; New Arch + Hermes; all 4 ABIs.
- `allowBackup=true`, `enableOnBackInvokedCallback=false`, `edgeToEdgeEnabled=true` (see 08).
- `app.json` plugins: expo-router, expo-sqlite(enableFTS), expo-secure-store, expo-local-authentication, expo-media-library(granular photo/video/audio). iOS photo-library usage strings present.