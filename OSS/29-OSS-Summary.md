# 29 — OSS Summary (Final Report)

## 29.1 Survey Scope

**Operational System Survey** of **Khaznati (خزنتي)** — an offline-first secure vault app (Expo SDK 54 / React Native 0.81.5 / React 19 / TypeScript). The codebase was **read-only** surveyed; no files modified.

## 29.2 System at a Glance

| Aspect | Summary |
|---|---|
| Architecture | Clean Architecture: `app` (screens) → `ui` (components/hooks/providers) → `domain` (entities/usecases) → `data` (DB/repos) + `core` (utils/DI/theme/i18n) |
| Screens | 16 (4 auth + 6 tabs + 4 modals + redirect), file-based expo-router |
| Database | SQLite (expo-sqlite), 7 tables + `_migrations`, WAL, FK cascade |
| Auth | PIN (iterated SHA-256 ×100k) + biometric (stored-PIN via SecureStore); 5 attempts/5-min lockout |
| Crypto | Custom SHA-256 stream cipher (not AES-GCM despite config label) |
| Storage | SQLite + app-private dirs; media encrypted, files tab plaintext |
| i18n | Arabic-first + English, forced RTL, Cairo font |
| Theme | Light/Dark/AMOLED/SYSTEM via Context |
| DI | Custom Service Locator, 19 singletons |
| CI/CD | 3 GitHub Actions workflows; APK build + release on tags |
| Tests | 4 unit files (utils, validators, one mapper, CreateVaultUseCase) |

## 29.3 Verified File Counts

- Total TS/TSX under `app`+`src`: **146 files**.
- Screens: **20** in `app/`; components: **29** in `src/ui/components/`.
- Domain entities: 6; repo interfaces: 7; use cases: 10; repos: 6; DTOs: 5; mappers: 5.

## 29.4 Key Findings (High-Impact)

1. **Encryption gap in Files tab** — imports copied raw (`files.tsx:22-31`).
2. **Crypto is non-standard** — custom SHA-256 stream; config labels AES-GCM (`crypto.ts`, `config.ts:23`).
3. **DB PRAGMA key silent fallback** (`DatabaseService.ts:31-35`).
4. **Activity log never populated** — no `.log()` calls anywhere.
5. **7 dead components + 2 dead hooks + 5 dead DI registrations + 2 unreachable screens** (see `14`).
6. **Multiple config constants advertise unimplemented features** (root detection, secure delete, clipboard clear, auto-backup, thumbnails, session timeout).
7. **Backup only copies DB** — media files and SecureStore keys excluded, restoring may lose decryptability.
8. **Media export writes base64 text not binary** (`media.tsx:155-158`).

## 29.5 Strengths

- Clean layering and consistent `Result<T>` error handling.
- Per-vault keys for notes/passwords/media; SecureStore isolation.
- WAL + foreign_keys + integrity check at boot.
- Password strength, biometrics, auto-lock, remember-me flows implemented.
- Full Arabic UI + RTL + professional Cairo font.
- Reasonable CI quality gates (typecheck/lint/test).

## 29.6 Weaknesses

- Security-critical areas under-tested; crypto undocumented.
- Dead code / dead routes inflate surface area.
- Advertised security settings not all implemented.
- No crash reporting, no error boundary.
- Settings/theme/language not persisted across restarts.

## 29.7 Documentation Index (this folder)

| # | Doc | # | Doc |
|---|---|---|---|
| 00 | System Overview | 15 | Critical Paths |
| 01 | Files Map | 16 | Services Registry |
| 02 | Navigation | 17 | Configuration Registry |
| 03 | Screens Registry | 18 | Theme & Design System |
| 04 | Authentication Flow | 19 | i18n & Localization |
| 05 | Biometric Auth | 20 | Hooks Registry |
| 06 | Security Audit | 21 | Components Registry |
| 07 | Encryption Impl | 22 | Permissions |
| 08 | Database Schema | 23 | Data Formats |
| 09 | Migrations History | 24 | Storage Locations |
| 10 | Data Repositories | 25 | Error Handling |
| 11 | Use Cases Registry | 26 | Build & CI/CD |
| 12 | Dependency Injection | 27 | Test Coverage |
| 13 | Dependency Graph | 28 | Risk Areas |
| 14 | Hidden Features & Dead Code | 29 | This Summary |

> Next recommended step per OSS process: address `28-Risk-Areas.md` items in a prioritized repair plan (see also `docs/repair-plan.md` in the repo).
