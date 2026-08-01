# 02 — Recovery Roadmap (خارطة الطريق — المراحل 0..9)

> Sequencing is mandatory. **Phase N starts only when Phase N−1 exit criteria pass.**
> Each task has: priority, dependencies, risk, DoD (definition of done), acceptance tests, and estimated effort.
> Traceability: findings R1–R23 come from `OSS/28`; broken features from `OSS/03` + `OSS/14`; APK data from `oaa.md`.

---

## Phase 0 — Emergency Stabilization (الاستقرار الطارئ)
**Goal**: no plaintext secrets on disk; no silent crypto failures; app cannot crash or lose data on tamper.
**Exit**: Phase-0 DoD tests green (see below) + `tsc`/`lint` clean + manual smoke.

| # | Task | Fixes | Deps | Risk | DoD / Acceptance |
|---|---|---|---|---|---|
| 0.1 | Replace crypto core with vetted AEAD (AES-256-GCM). Keep `encryptData/decryptData/encryptFile/decryptFile` signatures + `IV‖TAG‖CT` layout for compatibility | R2 | — | High (migration of stored data) | Round-trip tests pass; tag verified; failure throws typed `CryptoError`, never `'[encrypted]'` |
| 0.2 | Encrypt Files-tab imports via the vault key (mirror `MediaStorage`) | R1 | 0.1 | Med | Imported file on disk is encrypted; preview decrypts; DB row written |
| 0.3 | `hashPin`: use PBKDF2-HMAC-SHA256 (or Argon2-style if lib available) with configured iterations, run off-JS-thread; add constant-time compare | R2/R4-adj | 0.1 | Med | PIN login faster; lockout + timing tests pass |
| 0.4 | Stop storing plaintext PIN for biometrics → store device-keyed encrypted token | R4 | 0.1,0.3 | High | Biometric unlock works; no `biometric_pin_*` plaintext in SecureStore |
| 0.5 | Route guard: `app/index.tsx` session-aware redirect + `(app)/_layout.tsx` guard | R12, P0-1/P0-2 | — | Med | Deep link to `(app)` without session → redirected to login; language reload keeps session |
| 0.6 | `DatabaseService`: replace silent `PRAGMA key` fallback with explicit `DB_ENCRYPTION_STATE` warning surface (see `09` for final decision) | R3 | — | Low | Boot logs/UI warns if DB unencrypted; decision doc updated |
| 0.7 | Fix `AddOptionsSheet` note/password flow to pass real `vaultId` (FK violation fix) | P0-3 | 0.5 | Low | Creating note/password from vault works; no FK error |
| 0.8 | Error surfaces: decrypt failures become user-visible errors; add an ErrorBoundary | R9, R17 | 0.1 | Low | Tampered media shows explicit error, not placeholder |

**Phase 0 acceptance tests**: crypto round-trip ×N; tamper → typed error; import→encrypt→decrypt; lockout (5/5min); biometric without plaintext PIN; deep-link redirect; Add-sheet creation; all `npm test` green (existing 4 files + new crypto/lockout tests).

**Estimate**: 4–5 days.

---

## Phase 1 — Architecture Recovery (استعادة المعمارية)
**Goal**: eliminate boundary violations + dead code so the surface matches reality.
**Exit**: DI registrations == consumers; no dead routes/components.

| # | Task | Fixes | Deps | Risk | DoD / Acceptance |
|---|---|---|---|---|---|
| 1.1 | Adopt item use-cases (`AddItem/DeleteItem/SearchItems`) in screens; remove direct repo calls | R21, `OSS/11` | 0 | Low | Screens go through use-cases; 3 dead registrations now live |
| 1.2 | Route `ui→data` imports through interfaces (`SessionProvider`, `media.tsx`) | `OSS/13` | — | Low | No `src/ui → src/data` direct imports (or documented exceptions) |
| 1.3 | `useSecureStorage` → DI `SecureStorageSource` | R18 | — | Low | Single source of truth; tests injectable |
| 1.4 | Delete dead components/hooks/routes (7+2+2) or wire them | `OSS/14` | — | Low | Components-registry reflects reality; bundle shrinks |
| 1.5 | Merge `enums`/config duplicates into `APP_CONFIG` single source | `OSS/06.2` | — | Low | No duplicated lockout constants |

**Estimate**: 1.5–2 days.

---

## Phase 2 — Performance Optimization (تحسين الأداء)
**Goal**: measurable UX + APK size improvements.
**Exit**: APK ≤ ~45 MB; login < 500 ms on mid-device; gallery scroll jank-free.

| # | Task | Impact | Deps | Risk | DoD / Acceptance |
|---|---|---|---|---|---|
| 2.1 | `reactNativeArchitectures=arm64-v8a` (or arm64+armeabi-v7a) | −75 MB | — | Med (x86 emulator) | APK rebuild; size measured |
| 2.2 | Enable R8/proguard release minify + shrink resources | −several MB | — | Med (RN proguard rules) | Release builds; `mapping.txt` uploaded |
| 2.3 | `assetBundlePatterns` → explicit asset folders | size + startup | — | Low | Assets still load |
| 2.4 | Metro config: drop sync `statSync` (static alias map) | dev-time | — | Low | `expo start` still works |
| 2.5 | `hashPin`/crypto off main thread (Worklets/JSI or batched) | login/encrypt latency | 0.3 | Med | benchmark in `07` |
| 2.6 | Memoize lists (`React.memo`, `useCallback`), debounce search, `useVaults` resolve once | UI jank | — | Low | 60fps list scroll in profiler |

**Estimate**: 2–3 days.

---

## Phase 3 — Business Logic Recovery (استعادة منطق الأعمال)
**Goal**: every core flow actually works end-to-end.
**Exit**: manual walkthrough of all flows in `04` passes.

| # | Task | Fixes | Deps | Risk | DoD / Acceptance |
|---|---|---|---|---|---|
| 3.1 | Login flow: remember-me → true auto-unlock token; session persists across reload | R12, P0-1 | 0.5 | Med | Reopen app → stays unlocked if within timeout |
| 3.2 | Notes CRUD + search wired through `AddOptionsSheet` with vaultId | P0-3 | 0.7 | Low | Full CRUD from vault works |
| 3.3 | Passwords CRUD + CSPRNG generator | R6 | 0 | Low | Generator uses `getRandomBytesAsync`; copy works |
| 3.4 | Media import via Add sheet + correct export (decode base64→binary) | R8, P0-4 | 0.2 | Med | Exported file opens correctly |
| 3.5 | Wire activity logging into vault/item/password/note actions | R10 | 0 | Low | Activity log populates; modal shows data |
| 3.6 | Files: real folder creation + DB rows; delete/rename/export working | `OSS/03` | 0.2 | Low | Folder appears; file ops consistent with DB |

**Estimate**: 3 days.

---

## Phase 4 — Storage & Database (التخزين وقاعدة البيانات)
**Goal**: backup/restore is complete and verifiable.
**Exit**: full backup→wipe→restore round-trip preserves decryptability.

| # | Task | Fixes | Deps | Risk | DoD / Acceptance |
|---|---|---|---|---|---|
| 4.1 | Backup v2: magic header + checksum + DB + encrypted media + key manifest (export), import verifies checksum | R7 | 0 | High | Round-trip on fresh install preserves all data + decryptability |
| 4.2 | DB encryption decision: field-level (recommended) vs SQLCipher vs documented plaintext-with-field-encryption | R3 | 0 | Med | `09-Database.md` finalized; implementation matches |
| 4.3 | `backup_metadata` table writer + restore validation | R10-adj | 4.1 | Low | Metadata written; restore checks |
| 4.4 | Restore guards: block restore while session unlocked; verify magic/version/checksum | R7 | 4.1 | Med | Corrupt file rejected with clear error |

**Estimate**: 2.5–3 days.

---

## Phase 5 — Security Hardening (تقوية الأمان)
**Goal**: OWASP-Mobile + Android best-practice baseline.
**Exit**: security checklist in `08` all satisfied (or explicitly waived with rationale).

| # | Task | Fixes | Deps | Risk | DoD / Acceptance |
|---|---|---|---|---|---|
| 5.1 | CSPRNG everywhere (passwords, keys, tokens) | R6 | 0 | Low | No `Math.random` in security paths |
| 5.2 | Clipboard clear after N seconds (config) + clipboard toggle enforced | R11 | 0 | Low | Copy auto-clears per setting |
| 5.3 | Secure delete (overwrite) for sensitive files | R11 | 0 | Med | Delete writes zeros (best-effort on flash) |
| 5.4 | Root/jailbreak detection (if enabled) + warning | R11 | 0 | Med | Setting wired; detects common cases |
| 5.5 | Enforce `biometric_enabled` flag on login button; biometric path checks lockout | R5, R15 | 0.4 | Med | Toggle has real effect; brute-force covers biometric |
| 5.6 | Constant-time comparisons everywhere (hash + tag) | R2 | 0.1 | Low | Timing tests pass |

**Estimate**: 2–2.5 days.

---

## Phase 6 — Android Optimization (تحسين أندرويد)
**Goal**: modern-target, small, correctly-signed artifacts.
**Exit**: `targetSdk` current, adaptive icon, versionCode ≥ 2, minified release.

| # | Task | Fixes | Deps | Risk | DoD / Acceptance |
|---|---|---|---|---|---|
| 6.1 | Adaptive icon using the new `assets/` set (done in repo; rebuild) | R22/icon | — | Low | Launcher shows real icon |
| 6.2 | Dynamic `versionCode`/`versionName` from config | R22 | — | Low | Install over previous version works |
| 6.3 | Android 10–16 compat pass (see `06`) | — | 0 | Med | Emulator matrix smoke passes |
| 6.4 | Release signing with real keystore secrets | signing | — | High | APK signed; `apksigner verify` passes |

**Estimate**: 1.5 days.

---

## Phase 7 — UX/UI Refinement (تحسين التجربة)
**Goal**: settings persist, dead UI removed, accessibility baseline.
**Exit**: `OSS/14.5` advertised-but-dead settings resolved (implement or remove).

| # | Task | Fixes | Deps | Risk | DoD / Acceptance |
|---|---|---|---|---|---|
| 7.1 | Persist theme + language via `SettingsRepository`; rehydrate before first render | R14 | — | Low | Restart keeps theme/lang |
| 7.2 | Replace dead screens/flows (biometric-setup reachable or removed; quick-exit iOS path) | R16 | — | Low | Navigation registry matches UI |
| 7.3 | a11y: touch targets ≥ 48dp, labels, RTL audit | — | — | Low | a11y pass in `11` |
| 7.4 | Settings shows true state only; remove "root/secure-delete/clipboard" rows until implemented (or Phase 5 wires them) | R11 | 5 | Low | No dead toggles |

**Estimate**: 1.5 days.

---

## Phase 8 — Testing (الاختبارات)
**Goal**: protect the security-critical core.
**Exit**: ≥ 30 tests; coverage report; CI green.

| # | Task | Fixes | Deps | Risk | DoD / Acceptance |
|---|---|---|---|---|---|
| 8.1 | Crypto round-trip, tamper, format tests | — | 0.1 | Low | suite passes |
| 8.2 | Lockout, timing, biometric use-case tests | — | 0.3/0.4 | Low | suite passes |
| 8.3 | Repository tests with mocked sqlite/filesystem | — | — | Med | repos verified |
| 8.4 | Session/auto-lock tests (fake timers) | — | 0.5 | Low | suite passes |
| 8.5 | Component/screen smoke + e2e (Detox/Maestro optional) | — | — | Med | critical flows green |
| 8.6 | CI: add coverage threshold + security smoke job | — | — | Low | CI green |

**Estimate**: 2.5–3 days.

---

## Phase 9 — Production Release (الإصدار)
**Goal**: signed, tagged, documented release.
**Exit**: v1.1.0 tag with signed APK + release notes; Play-ready artifacts.

| # | Task | Fixes | Deps | Risk | DoD / Acceptance |
|---|---|---|---|---|---|
| 9.1 | Add `ANDROID_KEYSTORE_*` secrets | signing | — | High | build uses release config |
| 9.2 | Final `tsc`/lint/test + APK size + smoke matrix | — | all | Low | gates green |
| 9.3 | Tag `v1.1.0`; CI builds + creates release with signed APK | — | 9.1 | Med | artifact downloadable & verified |
| 9.4 | Release notes (`15`), user-facing changelog | — | — | Low | doc complete |

**Estimate**: 1 day.

---

## Global Estimates

| Phase | Effort | Blocks | Depends on |
|---|---|---|---|
| 0 | 4–5d | all | — |
| 1 | 1.5–2d | 2,7 | 0 |
| 2 | 2–3d | 6 | 0,1 |
| 3 | 3d | 7,8 | 0,1 |
| 4 | 2.5–3d | 9 | 0 |
| 5 | 2–2.5d | 7 | 0 |
| 6 | 1.5d | 9 | 2 |
| 7 | 1.5d | 9 | 1,3,5 |
| 8 | 2.5–3d | 9 | 0–7 |
| 9 | 1d | release | all |

**Total**: ~20–25 days sequential; parallelizable: {1,2,5} and {4} after 0; {7} after {1,3,5}.

## Critical Path

```
Phase 0 (crypto, guard, FK fix) → Phase 1 → Phase 3 (logic)
Phase 0 → Phase 4 (backup) [parallelizable]
Phase 0 → Phase 5 (hardening) [parallelizable]
Phase 2 → Phase 6 → Phase 9
Phase 8 spreads across 0–7; final pass before 9.
```
