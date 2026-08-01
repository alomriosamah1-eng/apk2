# 26 — Build & CI/CD Pipeline

## 26.1 Local Scripts (`package.json`)

| Script | Command |
|---|---|
| `test` | `jest` |
| `lint` | `eslint` |
| `typecheck` | `tsc --noEmit` |
| `start` / `android` / `ios` / `web` | expo standard |
| offline install | `install.sh`, `install-offline.sh` (vendor docs in `packages.md`) |

## 26.2 Build Profiles (`eas.json`)

EAS build profiles exist (reviewed earlier); offline release uses manual `expo prebuild` + Gradle in CI.

## 26.3 GitHub Actions Workflows

### ci.yml (fast PR gate)
- Triggers: push/PR to main.
- Node 22, `npm ci --legacy-peer-deps`, then `npm run typecheck`, `npm run lint`, `npm test` (`.github/workflows/ci.yml:10-28`).

### build.yml (main pipeline)
1. **verify** job: Node 22, typecheck + eslint + tests (`:17-39`).
2. **build-android** job (needs verify): Node 22 + Java 17 + Android SDK; cache Gradle; `npx expo prebuild --platform android --no-install`; append Gradle tuning (`:80-87`); optional release signing from secrets with debug fallback (`:89-113`); warm Gradle caches; `./gradlew assembleRelease -x lint` (`:122-126`); upload APK + mapping artifacts (`:128-141`).
3. **release** job (tags `v*` only): download APK → `softprops/action-gh-release` with release notes (`:143-163`).

### build-android.yml (manual dispatch)
- verify job + build job producing **debug** then **release** (release only on main/master) (`:30-95`).

## 26.4 Build Tuning (Gradle)

Appended in build.yml:
```
org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g -XX:+UseParallelGC
org.gradle.parallel=true
org.gradle.caching=true
```

## 26.5 Signing

- Secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
- If unset → debug signing fallback (notice emitted) (`build.yml:96-99`).
- Python script patches `android/app/build.gradle` to add `release` signing config (`build.yml:107-113`).
- `storeType 'PKCS12'`, `signingConfig signingConfigs.release`.

## 26.6 Artifacts

| Artifact | Path | Retention |
|---|---|---|
| `app-release.apk` | `android/app/build/outputs/apk/release/` | 30 days |
| `mapping.txt` | `android/app/build/outputs/mapping/release/` | 30 days (ignore if missing) |
| Release GH asset | from tag workflow | persistent |
| Local `khaznati-release/khaznty.apk` (96 MB) | repo | committed manually |

## 26.7 Verification Steps (OSS audit)

| Check | Command | Status expected |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | 0 errors |
| Lint | `npx eslint . --ext .ts,.tsx` | 0 errors (warnings allowed per build.yml relax) |
| Tests | `npm test` | 4 test files (see `27`) |

## 26.8 Notes

- `--legacy-peer-deps` used everywhere due to RN 0.81 + React 19 peer-range mismatches.
- CI pins Node 22 (and 20 in manual workflow).
- Prebuild runs at CI time (android/ is generated, though present in repo).
- Offline release: `khaznati-release/khaznty.apk` built Jul 31 (per git log).
