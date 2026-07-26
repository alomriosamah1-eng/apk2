# الأمان (Security)

## Password Storage

- Passwords are NEVER stored in plaintext
- Random salt (32 bytes) generated per vault
- SHA-256 hashing algorithm
- Constant-time comparison to prevent timing attacks

## Secure Storage

- Expo SecureStore backed by Android Keystore
- Biometric keys stored with hardware-backed protection
- Screen capture prevention via `expo-screen-capture`
- Clipboard cleared after 10 seconds (configurable)

## Security Config (`src/core/constants/config.ts`)

| Setting | Value |
|---------|-------|
| Salt length | 32 bytes |
| Key length | 32 bytes |
| Encryption | AES-256-GCM |
| Max login attempts | 5 |
| Lockout duration | 5 minutes |
| Auto-lock timeout | 60 seconds |
| Session timeout | 15 minutes |
| Clipboard clear | 10 seconds |

## Password Strength Criteria

1. Minimum 8 characters
2. At least 1 uppercase letter
3. At least 1 lowercase letter
4. At least 1 digit
5. At least 1 special character
6. Length bonus (>12 chars)

## Android Security Features

- `expo-screen-capture` prevents screenshot of sensitive screens
- Biometric authentication uses Android BiometricPrompt
- File-level encryption via AES-256-GCM (referenced in config)
- SecureStorage encrypts at rest via Android Keystore
