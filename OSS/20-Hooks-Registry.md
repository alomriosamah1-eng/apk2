# 20 — Hooks Registry

All hooks in `src/ui/hooks/`. Exported via `hooks/index.ts`.

## 20.1 Used Hooks

### useVaults (`useVaults.ts`)
State: `vaults, loading, error`. Resolves 5 use cases from DI (`:15-19`).
| Exposed | Behavior | Line |
|---|---|---|
| `loadVaults()` | GetVaultsUseCase → setVaults | `:21-31` |
| `createVault(input)` | CreateVaultUseCase, prepends result | `:33-39` |
| `deleteVault(id)` | DeleteVaultUseCase, filters out | `:41-47` |
| `lockVault(id)` | LockVaultUseCase, marks isLocked | `:49-55` |
| `unlockVault(id,pin)` | UnlockVaultUseCase, marks unlocked | `:57-63` |
- `useEffect` auto-load on mount (`:65-67`).
- Consumed by: welcome indirectly via create; vault.tsx, settings.tsx, login.tsx, create-vault.tsx, AddOptionsSheet, VaultListSheet.

### useBiometrics (`useBiometrics.ts`)
State: `isAvailable, isEnrolled, biometryType`; methods `checkBiometrics()`, `authenticate(prompt?)`. Full detail in `05`.
Consumed by: login.tsx, biometric-setup.tsx, settings.tsx.

### useSecureStorage (`useSecureStorage.ts`)
Wraps a module-level `SecureStorageSource` instance (`:4`).
| Exposed | Line |
|---|---|
| `setItem(key,value)` | `:9-16` |
| `getItem(key)` | `:18-20` |
| `deleteItem(key)` | `:22-24` |
| `loading` flag | `:7` |
Consumed by: login.tsx (remember), settings.tsx (flags).

### useResponsive (`useResponsive.ts`)
Exposes `scaleSize` for responsive sizing. Used only in `welcome.tsx:16`.

## 20.2 Unused Hooks (exported only)

### useAppState (`useAppState.ts`)
`useAppState(onForeground?, onBackground?)` — AppState listener. **Not used**; `SessionProvider` duplicates this logic inline (`SessionProvider.tsx:76-97`).

### useDebounce (`useDebounce.ts`)
Debounce helper. **Not used** — search inputs filter directly (`files.tsx:24-26`, `notes.tsx:146-148`, `passwords.tsx:189-191`, `media.tsx:169-171`).

## 20.3 Hook → Screen Usage Matrix

| Hook | welcome | create-vault | login | vault | files | media | notes | passwords | settings |
|---|---|---|---|---|---|---|---|---|---|
| useVaults | | ✓ | ✓ | ✓ | | | | | ✓ |
| useBiometrics | | | ✓ | | | | | | ✓ |
| useSecureStorage | | | ✓ | | | | | | ✓ |
| useResponsive | ✓ | | | | | | | | |
| useAppState | | | | | | | | | |
| useDebounce | | | | | | | | | |

> Note: AddOptionsSheet & VaultListSheet (organisms) also consume `useVaults` (`AddOptionsSheet.tsx:11,21`, `VaultListSheet.tsx:9,31`).

## 20.4 Implementation Notes

- `useVaults` resolves DI singletons on every render (no `useMemo` on container refs) — acceptable but suboptimal.
- `useSecureStorage` uses a **shared module singleton** instead of DI — mild inconsistency with the DI-first pattern.
- Hooks don't persist to DB/SecureStore except where explicitly called by screens (e.g. auto-lock writes only via settings).
