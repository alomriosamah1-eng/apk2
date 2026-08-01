# 13 — Risk Management (إدارة المخاطر)

> Recovery-phase risk register. Product risks R1–R23 live in `08` (Security) — this document covers execution risks of the plan itself, plus a mitigation matrix.

## 1. Risk Register (Execution)

| ID | Risk | Prob | Impact | Mitigation | Owner phase |
|---|---|---|---|---|---|
| ER1 | Crypto rewrite breaks existing encrypted data | Med | High | Lazy re-encrypt via `cipher_version`; keep legacy reader for V1 during Phase 0 | 0.2/14 |
| ER2 | New expo-file-system (SDK 54) async API breaks import/export | High | Med | Audit first; write adapter `IFileStore` behind interface; mock in tests | 0.1/0.7 |
| ER3 | expo-local-authentication enrollment returns false negatives on some devices | Med | Med | Check `enrolledLevel` + system fallback (PIN) + user-facing error | 0.3 |
| ER4 | expo-secure-store size limit hit (keys/tokens) | Low | Med | Store wrapped keys for vaults; single data key wraps others; keep payloads small | 0.4 |
| ER5 | Language-persist + session-hydration ordering regression (P0-1) | Med | High | Re-hydrate after store ready; gate routes on session; e2e covers language switch | 0.5 |
| ER6 | Settings refactor removes a working toggle | Med | Low | Keep parity tests; feature-flag new repo | 7.4 |
| ER7 | Signing secrets missing → release blocked | Certain | High | Add 4 secrets to CI now (Phase 8), local keystore fallback | 8 |
| ER8 | APK size target (≤45MB) missed | Med | Med | Single ABI + R8/minify + bundle; verify after each build; allow 55MB ceiling | 0.9 |
| ER9 | Maestro/e2e infra cost too high for team | Med | Low | Use scripted manual QA checklist instead (documented in 15) | 8 |
| ER10 | Migration to field-level encryption leaves legacy plaintext rows | High | High | Migration job runs re-encrypt; scan test asserts no plaintext | 14 |
| ER11 | Backup v2 corrupts existing manual backups | Med | Med | Read v1 backups too; write v2 alongside; checksum gate | 4 |
| ER12 | Quick-exit lock adds regression on iOS | Low | Low | Lock-all path is same as timer-lock (already tested) | 4.14 |
| ER13 | Scope creep during phases | Med | Med | Phase gates + Definition of Done in `02`; defer non-critical to backlog | all |
| ER14 | Team capacity (~20–25 days est.) overruns | Med | Med | Phase ordering delivers security value first (0–1); ship partial at each milestone | all |
| ER15 | `openDatabaseSync` main-thread stalls on large lists | Low | Med | Query indexes + pagination; measure in perf pass | 7 |

## 2. Dependency & Compatibility Risks

| Dep | Risk | Mitigation |
|---|---|---|
| expo-sqlite | `PRAGMA key` unsupported | Field-level encryption (09); no SQLCipher dependency |
| react-native-quick-crypto | JSI build on Android CI | Pin version; fallback `expo-crypto` for hashing if build fails; keep AES path mocked in CI |
| expo-file-system 54 | API surface change | Adapter interface + tests; do not couple screens to FS |
| expo-router 6 | Route-guard internals | Test `(app)` guard; replace route with session-check if needed |

## 3. Threat/Product Risks (link to `08`)

- R1 (plaintext files), R6 (plaintext PIN→biometric), R8 (corrupt export), R9 (silent decrypt), R10 (lockout bypass), R11 (Math.random), R15 (incomplete backup) are **top-5 severity** — each has a dedicated Phase-0 work item. Full map in `08` §5.
- Residual risks after remediation are listed in `08` §9 (accepted + documented).

## 4. Contingency & Rollback

| Failure | Rollback |
|---|---|
| Crypto rewrite incompatible | Revert to V1 reader; keep old files until migration verified on device |
| Migration corrupts DB | Pre-migration backup; restore snapshot; log and pause |
| Release blocker (signing) | Local keystore fallback documented in 15 §6 |
| Any phase gate not green | Do not advance phase; fix-in-place; re-run gate (02 §3) |

## 5. Risk Owners & Cadence

- Owner per risk = phase lead (single engineering team; one person = all).
- Risk review at each phase gate; register updated in this file.
- Escalation criteria: any P0 regression reopens → pause shipping milestone, fix before next.

## 6. Open Questions (Require Decision)

| # | Question | Needed by |
|---|---|---|
| Q1 | Approve SQLCipher stretch goal or lock to field-level? (Recommendation: field-level now, SQLCipher deferred) | Phase 0.6 |
| Q2 | Recycle bin required for v1.1 or defer? (Recommendation: defer, files currently hard-delete) | Phase 4 |
| Q3 | Biometric enroll forced on new vault or opt-in? (Recommendation: opt-in with offer) | Phase 0.3 |
| Q4 | Backup auto-reminders UI in v1.1? (Recommendation: manual only) | Phase 4 |
| Q5 | Keep 4-ABI universal build option for sideload, default arm64 only? (Recommendation: default arm64) | Phase 8 |

## 7. Definitions

- **P0**: data loss / lockout / security bypass → must fix before milestone.
- **P1**: core flow broken (create/login/import/export) → fix within phase.
- **P2**: cosmetic/non-critical → backlog, track in `04` per-function backlog.
