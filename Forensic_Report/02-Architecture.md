# 02 — Architecture

## Layers (Clean Architecture, verified by import graph)

```
app/                         expo-router UI routes (screens, modals, tabs)
  └─ (auth)/welcome, login, create-vault
  └─ (app)/(tabs)/vault, files, media, notes, passwords, settings
  └─ (app)/modals/about, activity-log, file-preview
src/ui/
  ├─ providers/   ThemeProvider, SessionProvider
  ├─ hooks/       useVaults, useBiometrics, useSecureStorage, useAppState, useDebounce, useResponsive
  ├─ components/  atoms/molecules/organisms (Button, Input, Card, FilesList, AddOptionsSheet, MediaGallery …)
src/core/
  ├─ di/          container.ts (DIContainer), register.ts (all bindings)
  ├─ constants/   config.ts, enums.ts
  ├─ i18n/        index.ts + locales/ar.json, en.json
  ├─ theme/       colors, typography, spacing, motion, state, neu, ...
  ├─ utils/       crypto, secure, file, id, time, logger, resilience, clipboard
  ├─ validators/  index.ts
  ├─ errors/      index.ts (Result, success, failure, DatabaseError, CryptoError)
src/domain/
  ├─ entities/    Vault, Item, Note, Password, ActivityLog
  ├─ repositories/ I*Repository (ports)
  └─ usecases/    vault/*, item/*, auth/BiometricUnlockUseCase
src/data/
  ├─ database/    DatabaseService, MigrationRunner, migrations/001,002, schema
  ├─ repos/       *RepositoryImpl
  ├─ datasources/ FileSystemSource, SecureStorageSource
  ├─ media/       MediaStorage (module of free functions)
  ├─ dto/ mappers/
```

## Request path (normal flow)
`Button onPress → screen handler → (use-case | repository) → DatabaseService → SQLite` or `MediaStorage → expo-file-system → encrypted file`.

## Dependency inversion
- Screens resolve repositories via `DIContainer.resolve<T>('Token')` (e.g. `notes.tsx:41-44`).
- `register.ts:32-101` binds all singletons. **All interfaces consumers use are registered** — DI is functional (verified, not the breakage).
- Some flows bypass the use-case layer: files.tsx/media.tsx/AddOptionsSheet call `itemRepo.create(...)` directly instead of `AddItemUseCase` (see 03/09).

## Data storage division of labour (source of RC-3)
- **Files/media on disk** → expo-file-system v19 (`MediaStorage`, `FileSystemSource`).
- **Metadata in DB** → `items` table (`ItemRepositoryImpl`).
- **Media display** → **directory-based** listing of `.encrypted_media` (`media.tsx:33-57`), **not** the `items` table.
- **Files display** → **SQLite-based** `findByVaultId` (no type filter), returns both FILE and IMAGE.
→ Two divergent display sources. Root of `media`/`files` inconsistency (RC-3, F1/F2 in 03).

## Startup sequence (app/_layout.tsx:60-87)
```
SplashScreen.preventAutoHideAsync()
 → initI18n()            [secure-store read + i18n.init + forceRTL]
 → Font.loadAsync(Cairo ×4)
 → registerDependencies()
 → db.initialize()       [openDatabaseSync + PRAGMAs + possible key gen]
 → runner.run(db)        [DDL migrations — FAILS at migration 2 on fresh install]
 → db.integrityCheck()   [PRAGMA integrity_check — full scan]
 → preventScreenCaptureAsync()
 → setReady(true)
```
Serial, before first frame. All these run before `SplashScreen.hideAsync()` (deferred to `onLayout`, line 56-58). See 07.

## Configuration & build
- `metro.config.js`: custom `@`-alias resolver using `fs.statSync` per resolution (perf, 09).
- `babel.config.js`: `babel-preset-expo` only; preset auto-injects `react-native-worklets/plugin` for reanimated 4 (correct).
- `tsconfig.json`: `moduleResolution: "bundler"` with paths; jest `moduleNameMapper` covers `@core/@data/@domain/@ui/@app` but **omit bare `@`** (09).
- `.github/workflows/build.yml`: verify → build-android (`assembleRelease -x lint`) → release. Debug-signing fallback when keystore secret absent.