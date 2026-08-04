# 09 — Dependencies

Audit of `package.json` / `package-lock.json` versus actual usage (`import`/`require` across src/app/tests) and Expo SDK 54 manifest (`node_modules/expo@54`).

## Core pipeline findings
- **Di-audit Overview:** DI is NOT the cause of feature breakage. All interfaces consumed by screens are implemented and registered (`register.ts:32-101`).
- **Bypassed use-case layer:** Screens call repositories directly instead of use cases in places — `AddItemUseCase.ts` (registered `register.ts:86-88`) is never invoked; `files.tsx`/`media.tsx`/`AddOptionsSheet` call `itemRepo.create`. Conceptual gap, low impact.
- **FileSystemSource** (`FileSystemSource.ts:6-166`, registered `register.ts:36-38`) is **completely unused** — full real implementation, unused. A latent second storage abstraction with its own key namespace `file_vault_key_*`, diverging from MediaStorage's `media_vault_key_*`.

## Dependency audit table (version → used? → verdict)

| Dep | Version (installed) | Used? | Verdict |
|---|---|---|---|
| expo | 54.0.36 | yes | ✓ matches SDK54 |
| react | 19.1.0 | yes | ✓ |
| react-native | 0.81.5 | yes | ✓ |
| expo-router | 6.0.24 | yes | ✓ |
| expo-sqlite | 16.0.10 | yes | ✓ |
| expo-secure-store | 15.0.8 | yes | ✓ |
| @noble/ciphers | 1.3.0 | yes | ✓ |
| @noble/hashes | 1.8.0 | yes | ✓ |
| ex.crypto / file-system / media-library / image-picker / document-picker / auth / clipboard | matches SDK54 | yes | ✓ |
| react-native-reanimated | 4.1.7 | yes | ✓ (~4.1.1) |
| react-native-worklets | 0.5.1 | required by reanimated 4 | ✓ (SDK54 exact) |
| react-native-gesture-handler | 2.28.0 | yes | ✓ |
| react-native-screens | 4.16.0 | peer of expo-router | ✓ (must stay) |
| safe-area-context | 5.6.2 | yes | ✓ |
| i18next / react-i18next | 26 / 17 | yes | ✓ |
| zod | 3.25.76 | yes | ✓ |
| @expo-google-fonts/cairo | 0.4.2 | yes | ✓ |
| expo-constants | 18.0.13 | **0 imports** | 🟢 removable (resolved only transitively) |
| expo-linking | 8.0.12 | **0 imports** | 🟢 removable (peer/transitive of expo-router) |
| expo-localization | 17.0.9 | **0 imports** | 🟢 removable (not used) |
| expo-blur / expo-linear-gradient / expo-screen-capture / expo-updates / expo-image / expo-font / expo-splash | present | used where relevant | ✓ |

## Version alignment
All installed versions satisfy `bundledNativeModules.json` for SDK 54 exactly. **Pass.** Reanimated 4/wroklets/gesture/screens peer ranges all satisfied. No hard mismatch.

## Issues

### D-1 — HIGH (high conf): `install.sh`/`packages.md` instruct wrong (SDK 57) versions
`install.sh:1`, `packages.md:7` — `npm install … expo-image-picker@~57.0.6 expo-build-properties@~0.13.0`. `expo-image-picker@57` is SDK **57**; this project is SDK **54** (correct is 17.0.11, already installed). `expo-build-properties` not referenced anywhere. Stale/misleading docs.

### D-2 — HIGH (high conf): `--legacy-peer-deps` used in all pipelines
`build.yml:30,78`, `build-android.yml:19,62`, `ci.yml:22`, `install.sh`. Suppresses peer validation → can mask peer/resolver drift. Low-severity risk source.

### D-3 — MEDIUM (high conf): `@testing-library/jest-native` deprecated AND unused
devDependency `^5.4.0` (installed 5.4.3). Matchers merged into RNTL (12+). Never referenced in tests. Safe to remove.

### D-4 — LOW (high conf): unused expo-constants / expo-linking / expo-localization
Declared but never imported; kept only transitively via expo-router. Removable from manifest.

### D-5 — LOW (high conf): metro alias resolver uses `fs.statSync` (M-1)
`metro.config.js:7-44` — synchronous stat per `@`-import, bypasses Metro resolver cache. Slower dev cold builds.

### D-6 — LOW (high conf): alias surface drift
`jest.config.js:8-14` `moduleNameMapper` maps `@core/@data/@domain/@ui/@app` but **omits bare `@/`** alias that `metro.config.js` and `tsconfig.json` map to `src`. Inconsistent across Metro/TS/Jest.

### D-7 — INFO: babel correct
`babel.config.js` minimal; `babel-preset-expo` auto-injects `react-native-worklets/plugin` (verified present). No defect.

### D-8 — INFO (high conf): `eas.json` unused
EAS build config present but not used; CI uses `./gradlew` directly. `production.submit` empty; no credentialsSource. Placeholder scaffolding.

## APK size signals (cross-ref 07/10)
- Universal build all 4 ABIs incl. x86/x86_64 (`gradle.properties:31`) → ~96 MB.
- Release `minifyEnabled=false` / `shrinkResources=false` (no R8) (see 10-Code-Quality / B-6).
- Heavy native deps: react-native, expo-sqlite (FTS on), reanimated 4, gesture-handler; `assetBundlePatterns:["**/*"]` widens asset set.