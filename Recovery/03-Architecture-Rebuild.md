# 03 — Architecture Rebuild Plan (إعادة تصميم المعمارية)

> Traced from `OSS/00`, `OSS/12`, `OSS/13`, `OSS/14`. This is a *design* document for Phase 1 — no code here.

## 1. Target Architecture

Keep Clean Architecture; fix the boundary leaks and dead surface. The dependency rule:

```
app (routes/screens)
  → src/ui (components, hooks, providers)
    → src/domain (entities, repo interfaces, use cases)
      → src/data (datasources, repos, DTO/mappers, db, media)
        → src/core (DI, crypto, errors, theme, i18n, utils, constants)
```

**Invariants to enforce** (via lint rule `import/no-restricted-paths`):
- `src/ui` MUST NOT import `src/data/*` directly — go through `src/domain` interfaces.
- Screens MUST resolve use-cases, not repository impls, unless the use-case is a pure pass-through and a documented exception is added.
- `src/domain` MUST NOT import `src/data` (already holds).

## 2. Fixing Observed Boundary Violations

| Current violation | Evidence | Fix |
|---|---|---|
| `SessionProvider` imports `SecureStorageSource` (data) | `OSS/13` §2, `SessionProvider.tsx:5` | Introduce `ISessionStore` interface in `src/domain/repositories`; `SecureStorageSource` implements it; provider depends on interface |
| `media.tsx` imports `MediaStorage` + crypto directly | `OSS/13` §2 | Route through `MediaUseCases` (`ImportMediaUseCase`, `ExportMediaUseCase`) or `MediaRepository` interface |
| `useSecureStorage` module-level singleton | `OSS/20`, R18 | Replace with DI-resolved `SecureStorageSource`; delete the module singleton |
| Screens call `ItemRepository.create` directly | `OSS/11` (dashed links) | Adopt `AddItemUseCase`/`DeleteItemUseCase`/`SearchItemsUseCase` |
| `activity-log.tsx` resolves `ActivityLogRepositoryImpl` | `OSS/13` | Resolve `IActivityLogRepository` interface |

## 3. DI Container — Keep, then Clean

Keep the service-locator (`src/core/di/container.ts`): it's lazy, cycle-safe, testable via direct class construction. Changes:

1. **Register interfaces, resolve interfaces**: consumers type against `src/domain/repositories/*`, not impls.
2. **Remove dead registrations** or wire them: `FileSystemSource`, `SettingsRepository`, `AddItemUseCase`, `DeleteItemUseCase`, `SearchItemsUseCase` (OSS/14.3) → all become *live* after Phase 1.
3. **Add** new tokens needed by Phase 0/4/5: `CryptoService` (wraps cipher), `KeyManager` (wraps per-vault key mgmt + cipher versioning), `BackupService`, `ClipboardGuard`, `BiometricStore` (token-based).

### Proposed final DI catalog

| Token (interface) | Impl | Dependencies |
|---|---|---|
| `DatabaseService` | DatabaseService | — |
| `ISecureStorage` | SecureStorageSource | — |
| `IFileSystem` | FileSystemSource | ISecureStorage |
| `IMigrationRunner` | MigrationRunner | migrations |
| `IVaultRepository` | VaultRepositoryImpl | db |
| `IItemRepository` | ItemRepositoryImpl | db |
| `INoteRepository` | NoteRepositoryImpl | db, KeyManager |
| `IPasswordRepository` | PasswordRepositoryImpl | db, KeyManager |
| `IActivityLogRepository` | ActivityLogRepositoryImpl | db |
| `ISettingsRepository` | SettingsRepositoryImpl | db |
| `ICryptoService` | AesGcmCryptoService | — |
| `IKeyManager` | KeyManager | ISecureStorage, ICryptoService |
| `IBiometricStore` | BiometricStore | ISecureStorage, ICryptoService |
| `IBackupService` | BackupService | db, IFileSystem, IKeyManager |
| vault use-cases ×5 | …UseCase | repos |
| item use-cases ×3 | …UseCase | IItemRepository |
| media use-cases ×2 | …UseCase | IItemRepository, IFileSystem, IKeyManager |
| `BiometricUnlockUseCase` | … | IVaultRepository, IBiometricStore |

## 4. State Architecture

Current state is spread across three React contexts (`OSS/00`, `OSS/18`, `OSS/20`). Proposal:

| Concern | Holder | Persisted? | Where |
|---|---|---|---|
| Session (activeVaultId, unlocked, activity) | `SessionProvider` (Context) | partial (auto-lock timeout only) | `OSS/24.5` |
| Theme mode | `ThemeProvider` (Context) | **YES — new** via `ISettingsRepository` | Phase 7 |
| Language | i18n (i18next) | **YES — new** via `ISettingsRepository` | Phase 7 |
| Vault list | `useVaults` (local state) | no (re-fetch) | fine |
| Settings | `SettingsRepository` (DB) | yes | Phase 7 wires UI |

Rules:
- Contexts own *transient* state; durable preferences live in `settings` table (`ISettingsRepository`).
- `SessionProvider` must not trigger navigation during render (side effects in effect only) — current auto-lock calls `router.replace` inside a state updater (`OSS/04 §7`), which is a React anti-pattern; move to an effect keyed on `isUnlocked`.
- Add an `ErrorBoundary` at the root (Phase 0.8).

## 5. Feature/Module Boundaries (proposed modules)

```
src/domain/
  usecases/
    auth/       PinLogin, BiometricLogin, CreateSession?, LockAll
    vault/      Create/Get/Delete/Lock/Unlock (existing)
    item/       Add/Delete/Search (existing)
    media/      ImportMedia, ExportMedia
    backup/     CreateBackup, RestoreBackup
src/data/
  crypto/       ICryptoService (AES-GCM), KeyManager, BiometricStore
  backup/       BackupService, KZBParser
  media/        MediaStorage (kept, behind IMediaRepository)
```

## 6. Cross-Cutting Contracts

| Concern | Contract | Notes |
|---|---|---|
| Errors | `Result<T>` + `DomainError` subclasses (`OSS/25`) | Keep; add `CryptoError`, `BackupError`, `IntegrityError` |
| IDs | UUIDv4 `generateId()` | keep |
| Time | epoch-ms ints | keep |
| Crypto layout | `IV‖TAG‖CT` hex (data) / base64 (files) | keep for compat; add `V` (version) byte per `09`/`14` |
| Logging | `logger` | keep; add structured metadata for activity log |

## 7. Testability

DI + interfaces give seams for all tests (`12-Testing-Strategy.md`):
- Unit: use-cases against mock repo interfaces.
- Repo: against in-memory SQLite (`expo-sqlite` supports `:memory:` in tests) or mocked `DatabaseService`.
- Crypto: pure functions, no mocks.
- Screen: `@testing-library/react-native` with providers.

## 8. Non-Goals

- No state-manager adoption (Redux/Zustand) — Context + hooks are sufficient for this app's scale.
- No codegen/repository pattern libraries — keep hand-written DTO/mappers (already consistent).
- No backend/offline-sync — remains fully offline.
