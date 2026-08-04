# 10 — Code Quality

Review of architecture, SOLID, DI, state management, naming, smells, error handling, testing.

## Strengths (verified)
- **Clean architecture** is real and respected: UI → hooks → DI → use-cases → repos → data sources → SQLite/SecureStore.
- **Polymorphic repos** with interface ports (`I*Repository`) + implementations; mapper/DTO/entity separation is consistent.
- **DI container** (`container.ts:5-55`) has singleton cache + circular-dependency detection; correct lazy resolution for forward refs.
- **Result type** (`errors/index.ts`) used consistently: `success/failure`, Domain/Database/Crypto errors. Good typology.
- **Memoization discipline** generally good: providers/list components use `useMemo`/`memo` (ThemeProvider value correctly memoized).
- **Real encryption** and **real hashing** used where claimed.

## Code smells / SOP violations

### CQ-1 — Silent failure handling (HIGH)
`notes.tsx:98-108`, `passwords.tsx:137-147`, `AddOptionsSheet.importToVault` (`AddOptionsSheet.tsx:74-78`) close/hide the UI and discard the `Result` with **no user-visible error**. This is the #1 reason "buttons do nothing." Should surface a snackbar/alert on failure.

### CQ-2 — Bypassed use-case layer (MEDIUM)
`AddItemUseCase`/`DeleteItemUseCase`/`SearchItemsUseCase` registered but unused; screens call `itemRepo` directly. Also `AddOptionsSheet` and `files.tsx`/`media.tsx` duplicate import logic instead of sharing `MediaStorage`/a single use case.

### CQ-3 — Data inconsistency: two storage pipelines (MEDIUM/HIGH)
`MediaStorage.ts` (`.encrypted_media`, type IMAGE, key `media_vault_key_*`) vs `FileSystemSource` + direct writes (`khaznati/{vid}`, type FILE, key `file_vault_key_*`). Duplicated/divergent abstractions (RC-3, F1/F2).

### CQ-4 — Unused code / dead code (LOW)
- `FileSystemSource` registered but never used.
- `AddItem/DeleteItem/SearchItems` use cases registered but never invoked from UI.
- `useDebounce`, `useAppState`, `useResponsive` partly wired; `useDebounce` unused for search (notes/passwords filter in memory, no debounce).
- SessionProvider storageRef `auto_lock_timeout` read from SecureStore — functional.

### CQ-5 — Hardcoded values / localization gaps (MEDIUM)
- `about.tsx` hardcoded Arabic strings (`stats`, `values`, `milestones`) — not localized.
- Hardcoded theme colors: `vault.tsx:41-47,172`, `FileRow.tsx:49`, `AddOptionsSheet.tsx:184`, `VaultListSheet.tsx:112`, `ErrorBoundary.tsx:58`, `settings.tsx:41` — ignore dark mode.

### CQ-6 — Long methods / large components (LOW-MEDIUM)
`settings.tsx`, `media.tsx`, `notes.tsx`, `passwords.tsx` are large single-file screens (300–400+ lines) mixing state/handlers/render. Acceptable for RN but above maintainability threshold.

### CQ-7 — Non-await / fire-and-forget (MEDIUM)
- `i18n/index.ts:45-49` `void i18n.changeLanguage` + non-awaited `secureStorage.set`.
- `ThemeProvider.tsx:40` `secureStorage.set(...).catch(()=>{})`.
- `void repo.log(...)` everywhere (activity log, which also fails in RC-1).
- `SessionProvider.tsx:91` `router.replace(...)` inside AppState listener (navigation-during-listener anti-pattern).

### CQ-8 — Error handling gaps (MEDIUM)
- Nested `if (result.success)` with no `else` error branch in several handlers (notes/passwords).
- `withRetry` masks transient errors under backoff; combined with silent UI, root causes are invisible.

### CQ-9 — Naming (LOW-INFO)
- `NoteRepositoryImpl.togglePin`/`ItemRepositoryImpl.toggleFavorite` fine. `getVersion` column-name mismatch is a subtle naming/contract bug (06-RC F-H6).

## Testing
- Test framework: `jest-expo` 54.0.17, jest 29.7, RNTL 12.9, react-test-renderer 19. Suite counts: **14 files / 65 tests** (prior CI), incl. ThemeProvider, i18n, clipboard, BiometricUnlock.
- **Gap:** repository tests use `FakeDatabaseService` (in-memory maps) → do **not** exercise the real schema, so RC-1 (schema never created) passes CI. This is why the build is green yet the app is broken.
- No tests for media import, files, notes/passwords runtime persistence, session, or startup.
- `@testing-library/jest-native` deprecated+unused.
- `npm test` = `jest --passWithNoTests` → **would pass green even with zero tests** (a false-confidence trap).

## Schema / naming warning (HIGH, cross-ref 06-RC)
- `DatabaseService.getVersion` (`DatabaseService.ts:138-142`) queries `{ version }` from `PRAGMA user_version` whose column is `user_version` → always 0. Migration version bookkeeping broken.

## Maintainability verdict
Architecture is genuinely good; the gap is application of invariants (single schema application, single storage pipeline, honest error surfacing, session persistence). Fixing RC-1/2/3 removes most symptom-level noise.