# 12 — Testing Strategy (استراتيجية الاختبارات)

> Current state from `OSS/27` (4 unit files, no crypto/lockout/repo/session tests). Phase 8 primary; crypto/lockout tests land with Phase 0.

## 1. Test Pyramid Target

```
 e2e        ~3 critical journeys (Maestro or manual-scripted)
 integration ~12 repository + session + backup tests
 unit        ~30+ (crypto, validators, use-cases, mappers, utils)
```

## 2. Unit Tests (Jest + jest-expo)

| Suite | Subject | Deps/mocks |
|---|---|---|
| Crypto | encrypt/decrypt round-trip (data + file), tamper→`CryptoError`, version byte, constant-time compare | real `react-native-quick-crypto` (or mocks where unavailable) |
| KDF | `deriveKey` PBKDF2 determinism; iterations | real |
| KeyManager | wrap/unwrap, rewrap on PIN change, delete | mock `ISecureStorage` |
| validators | `validatePin/VaultName/Password` | none |
| secure utils | salt, clamp, delay | none |
| mappers ×5 | DTO↔entity | none |
| use-cases | Create/Unlock (lockout transitions)/Delete/Lock/Biometric(store+execute)/AddItem/Search | mock repos |
| errors | `Result`, code mapping | none |

**Existing**: secure utils, validators, VaultMapper, CreateVault (`OSS/27`). Keep + extend.

## 3. Integration Tests

| Suite | Approach |
|---|---|
| Repositories | in-memory SQLite (`:memory:` or tmp file) + real `DatabaseService` + migrations; verify CRUD, counts, FK cascade, soft-delete/restore, search |
| Note/Password repos | with mock `KeyManager`; verify encrypt at rest (row text ≠ plaintext) |
| Session/auto-lock | fake timers + AppState mock; verify timeout lock, hydration, remember-me |
| Backup | build `.kzb` in tmp → restore → assert round-trip + checksum reject path |
| Settings repo | persistence + defaults coalescing |

## 4. Component / Screen Tests

- `@testing-library/react-native` (installed, unused per `OSS/27`).
- Smoke: Login (PIN ok/wrong/locked), CreateVault, Notes list + create, Settings toggles.
- Route-guard test: `(app)` blocked without session.

## 5. E2E

- **Recommended**: Maestro flows (create vault → login → import → backup → restore) or a scripted manual checklist (`15`).
- If Maestro infra is heavy for this project, use a **documented manual QA script** (same journeys) executed at each phase gate.

## 6. Security Tests

| Test | Assertion |
|---|---|
| Crypto tamper | flipping a byte throws `CryptoError` (not placeholder) |
| Const-time compare | no branch on early mismatch (structural; timing smoke optional) |
| Lockout | 5 fails → locked; expiry resets; biometric path also blocked |
| Plaintext scan | after import, no plaintext content bytes in app dirs |
| Key isolation | vault A keys not decrypting vault B content |

## 7. Performance Tests (light)

- Benchmark helpers: hash time, encrypt 12MP, cold boot (record in `07`).
- Assert APK size ≤ 45 MB in CI (read artifact size).

## 8. CI Integration

- Extend `verify` job: `npm test` (existing) + `--coverage` with threshold (e.g. lines ≥ 40% global, 100% crypto core) — adjust realistically.
- Add `npm run test:security` job (crypto+lockout) as hard gate.
- Keep `tsc`/`eslint` gates.

## 9. Coverage Targets (end state)

| Area | Target |
|---|---|
| crypto + KeyManager | ≥ 90% |
| domain use-cases | ≥ 80% |
| validators/utils | ≥ 80% |
| repositories | ≥ 60% |
| screens | smoke (≥ 30%) |
| overall | ≥ 50% lines |

## 10. Test Infrastructure Notes

- Mock map needed: `expo-sqlite`, `expo-file-system` (new API), `expo-secure-store`, `expo-local-authentication`, `expo-crypto` (exists).
- Existing `__mocks__/expo-crypto.js` — update to support AES-GCM if JSI lib mocks needed.
- Add module aliases already in `jest.config.js` (per `OSS/26`, repair-plan).

## 11. Definition of Green (per gate)

```
npx tsc --noEmit         # 0 errors
npx eslint .             # 0 errors
npm test                 # 0 failures
npm run test:security    # 0 failures (Phase 8+)
npx jest --coverage      # meets thresholds
```
