# 13 — Permissions

## Requested (app.json android.permissions:37-42)
`USE_BIOMETRIC`, `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_MEDIA_AUDIO`.

## Blocked (app.json blockedPermissions:32-36)
`RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW`, `CAMERA` → removed from manifest. Correct (app has no camera capture).

## iOS (app.json infoPlist:19-24)
`NSPhotoLibraryAddUsageDescription`, `NSPhotoLibraryUsageDescription` present. `NSCameraUsageDescription` not present — fine since camera is blocked/never used.

## Plugins
`expo-media-library` plugin (`app.json:62-73`) with `granularPermissions: ['photo','video','audio']` → merges `READ_MEDIA_*`, `READ_MEDIA_VISUAL_USER_SELECTED`, and `READ/WRITE_EXTERNAL_STORAGE` + `requestLegacyExternalStorage=true` into the generated manifest. `expo-image-picker`/`expo-file-system` have no config plugin (fine — only `launchImageLibraryAsync` used).

## Runtime flow
- `media.tsx:102-116` `requestMediaPermission`: on Android ≤32 → `PermissionsAndroid.request(READ_EXTERNAL_STORAGE)`; on API 33+ / iOS → `MediaLibrary.requestPermissionsAsync()` (photo/video/audio).
- On success → picker/import. On denial → `Alert` and abort.

## Findings

### PERM-1 — MEDIUM (high conf): import over-gated on a permission the picker doesn't need
`launchImageLibraryAsync` on Android 13+ and iOS uses the **system photo picker** requiring no permission. Yet `media.tsx:118-152` first forces `MediaLibrary.requestPermissionsAsync()`. If the user denied library access previously, import is blocked with an alert even though they could pick a photo directly. **Unnecessary friction; a partial cause of "media import doesn't work."** (Exacerbated by RC-1/RC-3 as the true persistence failures.)

### PERM-2 — MEDIUM (high conf): `READ_EXTERNAL_STORAGE` request may be ineffective if plugin didn't merge it
On Android ≤32 the code requests `READ_EXTERNAL_STORAGE` (`media.tsx:104-110`). That permission is injected **only** via the expo-media-library config plugin, not via `app.json android.permissions`. If the plugin fails/silently no-ops, the request returns denied on old devices. `base64:true` image import also relies on library access.

### PERM-3 — INFO (high conf): dead/misleading manifest permissions
`READ/WRITE_EXTERNAL_STORAGE` + `requestLegacyExternalStorage` are no-ops at targetSdk 36 (superseded by `READ_MEDIA_*`); `USE_FINGERPRINT` deprecated. Harmless but should be cleaned (08 A-4).

### PERM-4 — INFO (high conf): biometrics
`USE_BIOMETRIC` correct; `expo-local-authentication` uses BiometricPrompt. `settings.tsx:90-100` toggles `biometric_enabled` in SecureStore; `login.tsx:178` gates button on it.

## Permissions → feature mapping
| Feature | Needed permission | Managed? |
|---|---|---|
| Import photo (media tab) | none (picker) or library | over-gated (PERM-1) |
| Import file/doc | none | ok |
| Import video/audio | none/picker | ok |
| Save to gallery (export) | `NSPhotoLibraryAdd`/MediaLibrary | ok |
| Biometric unlock | `USE_BIOMETRIC` | ok |

**Verdict:** Permissions are not the root cause of the import bugs (RC-1/RC-3 are). PERM-1 unnecessarily blocks on denied-library devices.