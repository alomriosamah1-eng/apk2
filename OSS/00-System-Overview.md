# 00 — System Overview

> Operational System Survey (OSS) — documented without modifying the codebase.

## 1. Identity

| Field | Value |
|---|---|
| App name | Khaznati (خزنتي) |
| Package name | `com.khaznati.vault` (`app.json`) |
| Version | `1.0.0` (build 1) |
| Type | Offline-first secure digital vault (files, media, notes, passwords) |
| Monorepo location | `/home/osamah/program/my-valut` |

## 2. Technology Stack

| Layer | Technology | Evidence |
|---|---|---|
| Framework | Expo SDK 54 (React Native) | `package.json` → `"expo": "~54.0.33"` |
| React | React 19.1.0 | `package.json` |
| RN | react-native 0.81.5 | `package.json` |
| Language | TypeScript ~5.9.2 | `package.json` |
| Navigation | expo-router ~6.0.24 (file-based) | `package.json`, `app/` folder |
| Database | expo-sqlite ~16.0.10 (WAL) | `src/data/database/DatabaseService.ts` |
| State | React Context (Theme/Session) + local `useState` | `src/ui/providers/` |
| DI | Custom DIContainer (Service Locator) | `src/core/di/container.ts` |
| Crypto | expo-crypto (SHA-256 stream construction) | `src/core/utils/crypto.ts` |
| Secure storage | expo-secure-store | `src/data/datasources/SecureStorageSource.ts` |
| Biometrics | expo-local-authentication | `src/ui/hooks/useBiometrics.ts` |
| i18n | i18next + react-i18next | `src/core/i18n/index.ts` |
| Validation | zod | `src/core/validators/index.ts` |
| Fonts | Cairo (Arabic-first) | `app/_layout.tsx:62` |
| Icon set | MaterialCommunityIcons | `@expo/vector-icons` |
| Tests | Jest + jest-expo + @testing-library/react-native | `jest.config.js` |
| CI/CD | GitHub Actions (3 workflows) | `.github/workflows/` |

## 3. Architecture — Clean Architecture, 5 folders

```
app/           Presentation: screens & navigators (expo-router file-based)
src/ui/        UI components, providers, hooks
src/domain/    Entities, repository interfaces, use cases (pure business logic)
src/data/      DB service, migrations, datasources, repositories, DTOs, mappers, media
src/core/      Constants, DI, errors, i18n, theme, utils, validators
```

Dependency rule: `app → src/ui → src/domain → src/data`, with `src/core` shared everywhere. The `app/` layer imports both `src/ui` (components) and `src/core`/`src/domain`/`src/data` directly (e.g. `app/(app)/(tabs)/files.tsx:18` resolves `ItemRepository` from DI).

## 4. Path Aliases (`tsconfig.json` + `metro.config.js`)

| Alias | Target |
|---|---|
| `@/*` | `src/*` |
| `@app/*` | `app/*` |
| `@ui/*` | `src/ui/*` |
| `@core/*` | `src/core/*` |
| `@domain/*` | `src/domain/*` |
| `@data/*` | `src/data/*` |

## 5. Bootstrap Sequence (`app/_layout.tsx`)

1. `SplashScreen.preventAutoHideAsync()` (`app/_layout.tsx:20`)
2. Load Cairo fonts (Regular/Medium/SemiBold/Bold) (`:62-67`)
3. `registerDependencies()` — registers all DI tokens (`:69`)
4. Resolve `DatabaseService`, `initialize()` — opens SQLite + PRAGMAs (`:70-71`)
5. Resolve `MigrationRunner`, `runner.run(db)` — applies migrations 001/002 (`:72-73`)
6. `db.integrityCheck()` (`:74`)
7. `preventScreenCaptureAsync()` — block screenshots (`:76`)
8. Render `GestureHandlerRootView > SafeAreaProvider > ThemeProvider > SessionProvider > Stack` (`:91-100`)

## 6. Navigation Containers

- Root `Stack` (`app/_layout.tsx:26`) → `(auth)` and `(app)` groups, slide_from_right, headers hidden.
- `(auth)` Stack (`app/(auth)/_layout.tsx:8`): welcome, login, create-vault, biometric-setup.
- `(app)` Stack (`app/(app)/_layout.tsx:8`): `(tabs)` + `modals`.
- `(tabs)` `Tabs` (`app/(app)/(tabs)/_layout.tsx:12`): vault, files, media, notes, passwords, settings — **tab bar hidden** (`display:none; height:0`, lines 17-20); navigation driven by `router.push`.
- `modals` Stack (`app/(app)/modals/_layout.tsx:8`): file-preview, create-folder, activity-log, about — `presentation:'modal'`, slide_from_bottom.

## 7. Feature Surface (16 screens)

6 auth + 6 tabs + 4 modals. See `03-Screens-Registry.md`.

## 8. Key Data Model

7 SQLite tables: `vaults, items, notes, passwords, activity_log, settings, backup_metadata` + migration table `_migrations` (see `08-Database-Schema.md`).

## 9. Notable Facts

- **Tab bar is hidden**; user flows are push-based — Tabs container is effectively a route group.
- 6 UI components and 2 hooks exist but are **unused (dead code)**; several DI-registered services (FileSystemSource, SettingsRepository, Item use-cases) are never resolved by screens (see `14-Hidden-Features.md`).
- Activity log repository exists and is read by the modal, but **no screen ever calls `.log()`** — the table stays empty in practice.
- Crypto implementation is a **SHA-256-based stream construction**, not a standard AES-GCM primitive despite config label `aes-256-gcm` (see `07-Encryption-Implementation.md`).
