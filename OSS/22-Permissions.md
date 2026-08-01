# 22 — Permissions

## 22.1 Declared Permissions (`app.json`)

### Android
```
permissions:
  android.permission.USE_BIOMETRIC
  android.permission.READ_EXTERNAL_STORAGE
  android.permission.WRITE_EXTERNAL_STORAGE
  android.permission.READ_MEDIA_IMAGES
  android.permission.READ_MEDIA_VIDEO
  android.permission.READ_MEDIA_AUDIO

blockedPermissions:
  android.permission.RECORD_AUDIO
  android.permission.SYSTEM_ALERT_WINDOW
  android.permission.CAMERA
```

### iOS
- `NSFaceIDUsageDescription`: "Khaznati uses Face ID to protect your vault."

## 22.2 Runtime Permission Requests (code)

| Permission | Requested by | When | File:Line |
|---|---|---|---|
| Biometric | `expo-local-authentication` | prompt shown on demand | `useBiometrics.ts:79-84` |
| Media library (save) | `expo-media-library` | media export / files export | `media.tsx:149`, `files.tsx:160` |
| Document picker | `expo-document-picker` | file/backup import | `files.tsx:93`, `settings.tsx:164`, `AddOptionsSheet.tsx:30` |
| Image picker | `expo-image-picker` | media import | `media.tsx:104` |
| Clipboard | `expo-clipboard` | password copy | `passwords.tsx:140` |
| Sharing | `expo-sharing` | backup share | `settings.tsx:144-149` |

## 22.3 Permission-to-Feature Map

| Feature | Required permission | Request timing | Behavior if denied |
|---|---|---|---|
| Media import (gallery) | image-picker (uses system) | on tap | `canceled` → no-op |
| Media export | media-library WRITE | on export | `Alert(permission)` (`media.tsx:150-153`) |
| File export | media-library WRITE | on export | `Alert(permission)` (`files.tsx:161-164`) |
| Biometric unlock | USE_BIOMETRIC + enrollment | on biometric tap | button hidden unless available (`login.tsx:167`) |
| Backup share | sharing (no permission) | on backup | fallback Alert path |
| Restore | document-picker (system UI) | on restore | cancel → no-op |

## 22.4 Declared vs Needed

- **Storage permissions declared** (READ/WRITE_EXTERNAL_STORAGE + READ_MEDIA_*) — required because media library write needs them on older Android; file-system ops use app-private dirs (`Paths.document`) that don't need storage permission.
- **CAMERA blocked** — no camera feature; picker uses gallery only.
- **RECORD_AUDIO blocked** — no recording; only audio file import.
- **SYSTEM_ALERT_WINDOW blocked** — security hardening.
- Note: `expo-image-picker` with `mediaTypes:['images']` and no camera permission works for gallery; camera would require `CAMERA` which is blocked.

## 22.5 Security Rationale

- Least-privilege: only biometric + media-library + storage for import/export.
- Blocking RECORD_AUDIO/SYSTEM_ALERT_WINDOW/CAMERA reduces attack surface.
- `app.json` `ios.supportsTablet:false` — tablet not supported.
- `updates.enabled:false` — no OTA binary updates.
