# 00 — Executive Plan (خطة الإنقاذ التنفيذية)

> **Project**: Khaznati (خزنتي) — `com.khaznati.vault`
> **Version**: 1.0.0 (build 1) → target 1.1.0 (build 2+)
> **Source of truth**: `OSS/` (29 documents), `oaa.md` (audit), `docs/repair-plan.md`, `docs/plan.md`
> **Document status**: Plan — no code changed. All statements trace to OSS or marked as recommendations.

---

## 1. Situation Summary

Khaznati is an offline-first secure vault app (Expo SDK 54 / RN 0.81 / TypeScript) with a genuinely solid Clean Architecture skeleton, a 7-table SQLite schema, per-vault keying, WAL, and a working CI pipeline that produces a 96 MB release APK. **The architectural bones are good.** The problems are concentrated in **five areas**: (1) non-standard / missing encryption, (2) broken or unreachable features, (3) non-persistent session/theme/language state, (4) performance and APK size, (5) a near-empty test suite for security-critical code.

The OSS survey (read-only, 146 TS/TSX files) found **5 critical risks, 5 high risks, 8 medium risks, 5 low risks** (`OSS/28`), plus **7 dead components, 2 dead hooks, 5 dead DI registrations, 2 unreachable routes, and ~20 advertised-but-unimplemented settings** (`OSS/14`).

## 2. Readiness Snapshot (details in `01-Project-Status.md`)

| Dimension | Score | Verdict |
|---|---|---|
| Architecture quality | **75%** | Clean layering, correct DI; layer-boundary shortcuts & dead code |
| Feature completion | **40%** | 16 screens; ~9 core flows broken or unreachable |
| Data layer stability | **60%** | Schema good; encryption silent-fallback, items/activity-log partially dead |
| Security | **20%** | Custom non-standard cipher, plaintext files, plaintext PIN, silent DB fallback |
| Performance | **35%** | 96 MB APK, 4 ABIs, sync Metro stat calls, 100k-iter async hash |
| UX/UI | **60%** | Strong design system + Cairo/RTL; dead screens, missing persistence |
| Test coverage | **15%** | 4 unit files only; crypto/lockout/repos untested |
| CI/CD | **80%** | Builds succeed; secrets absent → debug-signed artifacts |
| Beta readiness | **45%** | Installable & runs, but not safe to hold real secrets |
| Production readiness | **10%** | Blocked by encryption + signing + data-integrity gaps |

## 3. The Three Non-Negotiables (Gate 0)

Before any feature work, the following must hold — they are the product's reason to exist:

1. **Every secret the user stores must be encrypted with a standard, vetted cipher** (AES-256-GCM), and the current SHA-256 stream construction must be replaced or explicitly documented as legacy.
2. **No plaintext user data on disk.** Files-tab imports must be encrypted like media; SQLite must either be encrypted with a real implementation or the app must fail loudly rather than run unencrypted.
3. **The PIN/biometric system must resist brute force and root compromise**: constant-time compare, lockout applied to *both* PIN and biometric paths, and no plaintext PIN in SecureStore.

## 4. Recovery Strategy — Phased, Sequenced

**No phase starts before the previous one's exit criteria pass** (`02-Recovery-Roadmap.md`):

| Phase | Name | Focus | Relative effort |
|---|---|---|---|
| 0 | Emergency Stabilization | Crypto core, PIN hashing, encryption of files, session guard, crash-free | 20% |
| 1 | Architecture Recovery | Route guard, DI cleanup, use-case adoption, dead-code removal | 10% |
| 2 | Performance Optimization | APK size, hash speed, Metro, memoization | 10% |
| 3 | Business Logic Recovery | Login, session, remember-me, notes/passwords wiring, activity log | 15% |
| 4 | Storage & Database | Backup/restore coverage, DB encryption decision, integrity | 10% |
| 5 | Security Hardening | Biometric token, CSPRNG, clipboard, secure delete, root check | 10% |
| 6 | Android Optimization | ABIs, minify, adaptive icon, versionCode, target SDK | 5% |
| 7 | UX/UI Refinement | Persist theme/language, dead screens, empty states, a11y | 5% |
| 8 | Testing | Unit/integration/e2e for security-critical paths | 10% |
| 9 | Production Release | Signing secrets, tag, Play pipeline, release notes | 5% |

Estimated total: **~14–18 working days** for a solo dev (deltas vs. prior plan in §9).

## 5. Highest-Impact Decisions (with rationale)

| # | Decision | Rationale | Impact |
|---|---|---|---|
| D1 | Introduce a vetted crypto primitive (e.g. `react-native-quick-crypto` AES-GCM, or a pure-RN WebCrypto shim) for data + files; keep field layout `IV‖TAG‖CT` | Standard AEAD gives confidentiality + integrity + tamper detection; replaces the audited-but-custom stream | Security |
| D2 | Files-tab imports go through the same encrypt-to-disk path as media | Closes R1 (plaintext files) — the single most damaging gap | Security |
| D3 | Move biometric storage from plaintext PIN to an **encrypted token** unlockable by a device-keyed secret | Removes R4 (PIN at rest) | Security |
| D4 | `app/index.tsx` becomes a session-aware router (`/app`, `/auth`) instead of an unconditional redirect; add guard in `(app)/_layout.tsx` | Closes the "language change → logged out" bug and deep-link bypass | UX/Security |
| D5 | Persist theme + language via `SettingsRepository` (DB) and rehydrate before render | Fixes "settings reset on restart" | UX |
| D6 | Keep the custom DI/Result architecture — it is sound | Avoids rewrite churn; focus effort on defects | Maintainability |
| D7 | Reduce APK to ~40 MB: `arm64-v8a` only + R8/proguard + trimmed `assetBundlePatterns` | 4 ABIs (75 MB `.so`) + no minify is the dominant size driver | Performance |
| D8 | Backup v2: `magic-header + checksum + DB + encrypted media + key manifest` | Restoring today's backup can lose decryptability | Data integrity |

## 6. What We Explicitly Will NOT Do

- No full rewrite of the architecture (D6).
- No cloud/sync — the product is offline-first; that is a feature, not a bug.
- No new frameworks (keep expo-router, expo-sqlite, Context for state).
- No crypto implemented "from scratch" — only vetted primitives wired correctly (D1).
- No adding features until Gate 0 + Gate 1 pass.

## 7. Execution Governance

- **Per-phase definition of done**: each task lists `Typecheck / Lint / Test` gates and a manual acceptance step (`02`, `12`).
- **Branch strategy**: work on `main` for small fixes is acceptable post-stabilization; use `backup-before-repair` as the safety branch; tag each phase completion.
- **Definition of "stable"**: `npx tsc --noEmit` clean, `eslint` clean, `npm test` green, APK builds, manual smoke test passes.

## 8. Top Risks That Could Kill the Plan

1. **Crypto migration complexity** — changing cipher breaks existing stored ciphertext. Mitigation: keep a `cipher_version` field, migrate lazily on read, or ship migration v3 that re-encrypts (see `09`, `14`).
2. **expo-sqlite has no real `PRAGMA key`** — "encrypt the DB" cannot be satisfied with the current driver. Mitigation: decide between (a) SQLCipher-capable library, (b) field-level encryption everywhere (preferred, already 80% there), and (c) documented plaintext-with-field-encryption. `09-Database.md`.
3. **Signing secrets unavailable** — until `ANDROID_KEYSTORE_*` secrets exist, every artifact is debug-signed and uninstallable-over-release. This is a *process* blocker, not code.
4. **Backup compatibility** — restoring an old backup into a new cipher version must be handled (or documented as "backup before upgrade").

## 9. Relationship to Previous Plans

`docs/plan.md` and `docs/repair-plan.md` are accurate historical fix lists and contain **valid, implementable items** (biometric use-case, session provider, clear-all, restore, theme cycle, language reload, Jest config). This PREMP does not discard them — it **re-sequences and hardens** them:

- Their crypto instructions predate the audit; this plan replaces "implement SHA-256+XOR and call it AES-GCM" with a vetted-primitive policy.
- Their `PRAGMA key` step is **deferred** with a decision point (D8/§4 in `09`) because `expo-sqlite` cannot enforce it.
- Their time estimate (~10.5 days) is revised to ~14–18 days to include security hardening + real tests + release signing.

## 10. Success Criteria (Final Gate)

The release is "production-ready" only when **all** hold:

1. All secrets encrypted with vetted AES-256-GCM; no plaintext user data at rest; decrypt failures are user-visible errors, not `'[encrypted]'` placeholders.
2. PIN + biometric + lockout tested; no plaintext PIN in SecureStore.
3. Session, theme, language persist across restarts; deep-link guard enforced.
4. APK ≤ ~45 MB, `arm64-v8a`, minified, R8-mapped, real keystore-signed, versionCode ≥ 2.
5. Backup/restore round-trips with encrypted media and key manifest; checksum verified.
6. Test suite: 0 failures; ≥ 30 tests; coverage report on crypto, lockout, repos, session.
7. All advertised settings either work or are removed from the UI (`OSS/14.5`).
8. Release on a `v*` tag with signed APK asset and release notes.

---
**Owners**: single engineering track (this document is the single source for sequencing).
**Next step**: execute Phase 0 in `02-Recovery-Roadmap.md`.
