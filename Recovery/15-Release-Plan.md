# 15 — Release Plan (خطة الإصدار)

> Target: **v1.1.0** "Recovery Release". Consumer = APK/CI pipeline. This file is the build+release checklist tying all 16 docs to a shippable binary.

## 1. Version & Build

- Version: `1.1.0` (bump from 1.0.x); `versionCode` increment.
- Distribution: **Android APK/AAB** via EAS Build (or `npx expo prebuild` + gradle).
- App name/slug/icon/splash: from `assets/` (new branding already present, `_branding_source.py`).

## 2. Release Gates (from `02` + `12`)

| Gate | Check |
|---|---|
| Phase 0–1 (security core) | `npm run test:security` green; no P0 risks |
| Phases 2–5 (features) | per-feature DoD in `04`; legacy migration tested |
| Phase 6–7 (UX/perf) | APK ≤ 45 MB (ceiling 55 MB); boot < 1.5 s; icons in APK |
| Phase 8 (CI) | `tsc`, `eslint`, `npm test`, `test:security`, coverage thresholds |
| Phase 9 (QA) | scripted manual QA (below) passes; Android 10–16 matrix (06) |

## 3. QA Script (manual, or Maestro if adopted)

1. Clean install → create vault (name/icon/color/PIN) → offer biometrics → unlock.
2. Create note + password; verify encryption at rest (row not plaintext).
3. Import image + document; verify appears in correct tab; preview works.
4. Export media → verify file opens on device.
5. Language switch (ar/en) → still logged in, RTL correct.
6. Theme switch → persists after restart.
7. Auto-lock after timeout → PIN required; quick-exit locks.
8. Lockout: 5 wrong PINs → locked; after expiry unlocks; biometric disabled while locked.
9. Change PIN → rewrap keys → unlock with new PIN + biometric.
10. Backup → restore → all data intact; checksum mismatch rejected.
11. Uninstall/reinstall → no data leak; restore via backup only.
12. Old v1 backup restore (migration path).

## 4. Signing & Secrets

- **Blocker**: the 4 signing secrets (`EXPO_ANDROID_KEYSTORE_*` etc.) are NOT in CI (`OSS/00` build facts). Must be added:
  - `EXPO_ANDROID_KEYSTORE_PASSWORD`, `EXPO_ANDROID_KEY_PASSWORD`, `EXPO_ANDROID_ALIAS`, `EXPO_ANDROID_KEYSTORE` (base64).
- If EAS is used: `eas build --platform android --profile production` with `buildCredentialsSource: local` or cloud.
- Fallback (no EAS): local `gradle` signing via `app/build.gradle` + `release.keystore` committed to secret store only (never repo).

## 5. APK Size Plan (revisit `07`)

```
Before: 96.5 MB (4 ABIs).  After: default arm64-v8a only + R8/minify:
  baseline arm64 (~65–75 MB deps) + minify/shader → target ≤ 45 MB (ceiling 55 MB)
- Remove dead components/hooks/DI after Phase 1 (bundle shrink)
- Rebuild with new icons/splash in place (they were absent from old APK)
```

## 6. Artifacts & Distribution

| Artifact | Action |
|---|---|
| `.aab` | internal testing track (Play) |
| `.apk` (arm64) | sideload / internal QA |
| Release notes | ar + en; include security fixes + upgrade note |
| Source tag | `git tag v1.1.0` after gates green |

## 7. Timeline & Milestones (from `02` ~20–25 days)

| Milestone | Contents | Exit |
|---|---|---|
| M1 (Phase 0) | security core (crypto, keys, biometric, session, migrations) | test:security green |
| M2 (Phases 1–2) | dead code, lockout, onboarding, media/files solid | QA items 1–6 |
| M3 (Phases 3–4) | restore/backup, export, clear-all | QA items 7–10 |
| M4 (Phases 5–7) | settings, UX, a11y, perf | size + boot targets |
| M5 (Phases 8–9) | CI, QA, release | v1.1.0 tag |

## 8. Post-Release

- Monitor: crash rate, backup restore failures, biometric enrollment failures (Phase 9 telemetry if any).
- Schedule v1.2.0 (lazy re-encrypt completion, optional recycle bin/backup reminders per `13` Q2/Q4).
- Keep `Recovery/` docs as living reference; update status in `01` after each milestone.

## 9. Definition of Done — Release

- [ ] All phase gates green (02 §3)
- [ ] Signing secrets present in CI; build reproducible
- [ ] APK ≤ 55 MB with icons/splash included
- [ ] Manual QA (12 items) passed on ≥ 2 devices (one Android 10, one ≥ 15)
- [ ] Migration (14) verified: v1 DB + v1 backup + plaintext files upgrade cleanly
- [ ] Release notes ar+en drafted
- [ ] `v1.1.0` tagged and artifacts archived

## 10. Owners & Handoff

- Single engineering owner per risk (13); one release driver.
- Handoff checklist to user: README pointer to `Recovery/00-Executive-Plan.md`, phase tracker in `02`, open decisions `13 §6` (Q1–Q5).
