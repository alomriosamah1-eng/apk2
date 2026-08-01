# 27 — Test Coverage

## 27.1 Test Infrastructure

| Item | Config |
|---|---|
| Framework | Jest 29 |
| Preset | `jest-expo` |
| Libraries | `@testing-library/react-native`, `@testing-library/jest-native`, `react-test-renderer` |
| Mocks | `__mocks__/expo-crypto.js` (mocks digest/getRandomBytes) |
| Location | `__tests__/unit/...` |
| CI runs | `npm test` in all 3 workflows |

## 27.2 Test Files

| Test | Subject | Coverage |
|---|---|---|
| `__tests__/unit/core/utils/secure.test.ts` | `hashPin`, `generateSalt`, `clamp`, `debounce`, `delay` | unit |
| `__tests__/unit/core/validators/index.test.ts` | `validatePin`, `validateVaultName`, schemas | unit |
| `__tests__/unit/data/mappers/VaultMapper.test.ts` | DTO ↔ entity round-trip | unit |
| `__tests__/unit/domain/usecases/vault/CreateVaultUseCase.test.ts` | validation + create + biometric store | unit |

## 27.3 Coverage Areas vs Untested

| Area | Tested? |
|---|---|
| Crypto (encrypt/decrypt round-trip) | **No** (only crypto mocks for hashing utils) |
| All repositories (SQL, encryption, counts) | **No** |
| All screens / navigation | **No** |
| Unlock/lockout logic | **No** (CreateVault tested only) |
| Session auto-lock | **No** |
| i18n / RTL | **No** |
| UI components | **No** |

> Note: `@testing-library/react-native` is installed but no component tests found.

## 27.4 Test Commands

```bash
npm test                # jest
npx jest --coverage     # coverage (not configured in CI)
```

## 27.5 Observations

1. Coverage is minimal (4 unit files) — only core utils, validators, one mapper, one use case.
2. `expo-crypto` mocked globally (`__mocks__/expo-crypto.js`) — `hashPin` tests run against mocked digest.
3. No tests for security-critical flows (lockout, biometric, encryption) despite being the product's core value.
4. No mocks for expo-sqlite/file-system/media-library — repository tests would require them.
