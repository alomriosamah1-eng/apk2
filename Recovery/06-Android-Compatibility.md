# 06 — Android Compatibility (توافق أندرويد)

> Target: Android 10 (API 29) through 16 (API 36+). Every feature reviewed against modern Android guidance. Format: requirement → current state → gap → action.

## 0. Baseline

| Item | Current (`OSS/22`, `app.json`, `oaa.md`) | Required |
|---|---|---|
| `minSdk` | Expo SDK 54 default (23) | ≥ 23 (24 preferred) |
| `targetSdk` | Expo SDK 54 default | latest stable (≥ 34/35 at release) |
| `compileSdk` | Expo default | latest |
| Permissions | 6 declared, 3 blocked | prune to least-privilege |

**Action**: verify in `android/app/build.gradle` after prebuild; set `targetSdk` to current; document per release.

## 1. Scoped Storage & File Access (API 29+ / 30+)

| Requirement | Current | Gap | Action |
|---|---|---|---|
| App-private files only (`context.getFilesDir`) | ✅ `Paths.document` used | — | keep |
| No `READ_EXTERNAL_STORAGE` for own files (API 29+) | ❌ declared | Reduce risk | remove legacy storage perms; they're unused for app-private |
| `READ_MEDIA_*` (API 33+) for user gallery import | ✅ declared | — | keep (required by pickers) |
| `MANAGE_EXTERNAL_STORAGE` | not declared | ✅ good | never add |
| Legacy `WRITE_EXTERNAL_STORAGE` (≤ API 28) | declared | deps auto-manage | verify not needed; remove if unused |

**Action (Phase 6)**: move to `Photo Picker` (below); drop READ/WRITE_EXTERNAL_STORAGE unless a dependency needs them; keep `READ_MEDIA_IMAGES/VIDEO/AUDIO` only if pickers require; rely on app-private dirs.

## 2. Photo Picker (API 29+ / system picker, 13+)

| Requirement | Current | Action |
|---|---|---|
| Use system Photo Picker (no permission) where possible | Uses `expo-image-picker` (`media.tsx:104`) | Prefer `launchImageLibraryAsync` (system picker); on API 33+ the system picker requires no permission |
| No CAMERA permission (blocked) | ✅ blocked | keep blocked |

## 3. Media Permissions (API 33+ granular)

| Permission | API 33+ | API ≤32 | Current | Action |
|---|---|---|---|---|
| Read images/videos/audio | `READ_MEDIA_*` | `READ_EXTERNAL_STORAGE` | both declared | keep for ≤32 via manifest merge; ensure export path uses MediaLibrary APIs |
| Save to gallery | `WRITE_EXTERNAL_STORAGE` not needed (API 29+) | needed | declared | `MediaLibrary` handles; remove manual WRITE if unused |

**Action (Phase 6/3)**: keep MediaLibrary-based save; do NOT add `ACCESS_MEDIA_LOCATION`.

## 4. Background Limits & Battery

| Requirement | Current | Action |
|---|---|---|
| No background work needed (offline app) | ✅ none | keep |
| Auto-lock uses AppState foreground/background | ✅ | keep; do not use background timers (killed anyway) |
| Battery: no wakelocks, no polling | ✅ | keep |
| Backup/auto-backup scheduler | planned only | if added: use `WorkManager` (Expo background task) or defer (recommended: manual backup only) |

## 5. Foreground Services / WorkManager

Only relevant if background auto-backup or import-jobs are added. **Recommendation**: do NOT add background services in v1.1; keep all work user-initiated foreground. If auto-backup is later required, use `WorkManager` (Expo `expo-background-fetch` is limited) — note as future item.

## 6. BiometricPrompt (API 28+)

| Requirement | Current | Gap | Action |
|---|---|---|---|
| `BiometricPrompt` (strong biometrics) | `expo-local-authentication` uses native BiometricPrompt | ✅ | keep |
| Weak keys / fallback | `disableDeviceFallback:false` | fallback allowed | consider `disableDeviceFallback:true` with PIN fallback (product decision, `08`) |
| Face detection priority | ✅ handled in `useBiometrics` | — | keep |

## 7. Keystore (API 23+)

| Requirement | Current | Action |
|---|---|---|
| Keys in Android Keystore (non-exportable) | `expo-secure-store` uses Keystore with `WHEN_UNLOCKED_THIS_DEVICE_ONLY` | keep; document |
| No plaintext secrets in files | ❌ files plaintext (Phase 0) | encrypt (0.2) |
| No plaintext PIN | ❌ (Phase 0.4) | token-based (0.4) |
| Key invalidation on user remove | OS handles | ensure we react to `SecureStore` errors gracefully |

## 8. Material Design 3 & Dynamic Color

| Requirement | Current | Action |
|---|---|---|
| Material-3 design tokens | ✅ `theme/` tokens | keep |
| Dynamic color (Android 12+, `MaterialYou`) | not used | optional Phase 7: map system palette when theme = SYSTEM |
| Edge-to-edge (Android 15 enforces) | RN handles insets via SafeArea | verify with `useSafeAreaInsets` |

## 9. RTL & Localization

| Requirement | Current | Action |
|---|---|---|
| Forced RTL for Arabic | ✅ `I18nManager` | keep; persist (7.x) |
| Layout mirroring | `swapLeftAndRightInRTL` | keep |
| Locale-aware formatting | ❌ hardcoded `'ar'` in `activity-log.tsx:79` | fix (7.2) |

## 10. Accessibility (Android TalkBack)

| Requirement | Current | Action |
|---|---|---|
| Touch targets ≥ 48dp | partial | audit (7.3) |
| `contentDescription` on icons | partial | audit |
| `accessibilityRole/Label` | partial | audit |
| RTL focus order | verify | audit |

## 11. Large Screens & Foldables

| Requirement | Current | Action |
|---|---|---|
| Responsive grid | partial (`Dimensions`, `useResponsive`) | Phase 7: adopt `react-native` `useWindowDimensions` + breakpoint tokens |
| `supportsTablet:false` (iOS) | ❌ | product decision: enable or keep; document |
| Foldable posture | not handled | note: not required for v1.1; no special handling |

## 12. Screen Capture Prevention

| Requirement | Current | Action |
|---|---|---|
| `FLAG_SECURE` | ✅ `preventScreenCaptureAsync` at boot | keep; consider appending on login screen too |

## 13. Backup & Restore (Android Auto-Backup)

| Requirement | Current | Action |
|---|---|---|
| `allowBackup` config | default true | **Action**: set `android:allowBackup="false"` (sensitive vault) or exclude `khaznati.db`/keys from OS backup via `fullBackupContent`. |
| OS cloud restore leaking DB | risk if allowBackup true | configure `backup_rules` excluding secrets (Phase 6) |

## 14. Compatibility Matrix (planned verification)

| Feature | 10 (29) | 11 (30) | 12 (31/32) | 13 (33) | 14 (34) | 15 (35) | 16 (36) |
|---|---|---|---|---|---|---|---|
| Scoped storage | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Photo picker | picker | picker | picker | system | system | system | system |
| Media save | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Biometric | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Keystore | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dynamic color | — | — | ✅ opt | ✅ opt | ✅ opt | ✅ opt | ✅ opt |
| Edge-to-edge | — | — | — | — | enforced | enforced | enforced |
| RTL | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| allowBackup off | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**Verification (Phase 6.3)**: emulator matrix smoke: create vault → import file/media → lock/unlock → backup/restore → theme/lang switch → quick-exit. Manual or Maestro script.

## 15. Android 15/16 Specifics (API 35/36)

- **Edge-to-edge enforcement (15)**: ensure SafeArea handling; test status/nav bar contrast in both themes.
- **16KB page size (16)**: ABI must be built for devices with 16 KB page sizes — Expo SDK 54/RN 0.81 handles via `arm64-v8a`/new ABIs; verify release build flags (Phase 6/2).
- **Private space / credential manager**: not applicable (no autofill/credential manager in v1.1).

## 16. Summary of Required Changes

1. Photo-picker-first media import; prune storage permissions.
2. `android:allowBackup="false"` + backup rules excluding secrets.
3. Dynamic color optional; edge-to-edge SafeArea verify.
4. A11y audit + 48dp targets.
5. Icon: use new `assets/` (rebuild) + adaptive foreground.
6. `targetSdk` current; versionCode ≥ 2.
