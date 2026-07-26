# الأذونات (Permissions)

## Required Permissions

| Permission | When Requested | Rationale |
|------------|---------------|-----------|
| `USE_BIOMETRIC` | On biometric setup | Unlock vault with fingerprint/face |
| `READ_EXTERNAL_STORAGE` | On file import | Import files into vault |
| `WRITE_EXTERNAL_STORAGE` | On file import | Save imported files |
| `CAMERA` | Future: photo capture | Capture photos directly into vault |
| `POST_NOTIFICATIONS` | Future: reminders | Backup reminders |

## Permission Handling

- Request only when feature is first accessed
- Explain why permission is needed (Arabic explanation)
- Handle denial gracefully
- Handle permanent denial with settings redirect
- Use `expo-media-library` for media permissions

## Implementation

Permissions are requested at point of use, not at app start.
Each request includes an Arabic-language rationale.
