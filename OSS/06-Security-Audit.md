# 06 — Security Audit

Documented from source. Findings are descriptive (no fixes applied per OSS rules).

## 1. Security Layers

| Layer | Mechanism | Evidence |
|---|---|---|
| PIN hashing | Iterative SHA-256 ×100k | `secure.ts:48-57` |
| Data encryption | SHA-256 stream construction (IV+tag+ciphertext hex) | `crypto.ts:30-72` |
| Key storage | expo-secure-store (Android Keystore/Keychain) | `SecureStorageSource.ts:8-10` |
| DB encryption | `PRAGMA key` attempted with `db_encryption_key` in SecureStore; **falls back silently** | `DatabaseService.ts:20-35` |
| Screen capture | `preventScreenCaptureAsync()` | `app/_layout.tsx:76` |
| Root/jailbreak | `rootDetectionEnabled` setting default **false**, no runtime code | `SettingsRepositoryImpl.ts:15` |
| Clipboard protection | `clipboard_protection` setting; **flag only, no clear logic found** | `settings.tsx:84-88`, `config.ts:28` |
| Auto-lock | AppState-based; default 5 min | `SessionProvider.tsx:21-22,76-97` |
| Permission blocking | RECORD_AUDIO, SYSTEM_ALERT_WINDOW, CAMERA blocked | `app.json` |
| Biometric | expo-local-authentication | `useBiometrics.ts` |

## 2. Configured vs Implemented Gaps

| Config constant | Value | Actually used? |
|---|---|---|
| `pbkdf2Iterations: 10000` | config.ts:18 | **No** — hashPin uses hardcoded 100000 iterations |
| `algorithm: 'aes-256-gcm'` | config.ts:23 | **Misleading** — real impl is SHA-256 stream cipher (see 07) |
| `maxLoginAttempts: 5` | config.ts:24 | Yes — duplicated in UnlockVaultUseCase (`:5`) |
| `lockoutDurationMs: 5min` | config.ts:25 | Yes — duplicated (`UnlockVaultUseCase:6`) |
| `autoLockSeconds: 60` | config.ts:26 | **No** — SessionProvider default is 300000ms |
| `sessionTimeoutMs: 15min` | config.ts:27 | **No** — never referenced |
| `clipboardClearMs: 10000` | config.ts:28 | **No** — no clipboard-clear implementation |
| `rootDetectionEnabled` | SettingsRepositoryImpl:15 | **No runtime code** |
| `secureDeleteEnabled` | SettingsRepositoryImpl:16 | **No** — deletes are plain `File.delete` |
| `autoBackupEnabled` / `intervalDays` | SettingsRepositoryImpl:20-21 | **No** — no scheduler |

## 3. File Storage Encryption Status

| Storage path | Encrypted? | Evidence |
|---|---|---|
| `items.encrypted_data`/`encrypted_path` | Decrypted data only if stored via encrypted flow | `ItemRepositoryImpl` stores raw DTO without encryption |
| `Files` tab import (`khaznati/{vaultId}/*`) | **NO — raw copy** | `files.tsx:22-31` (`copyImportedFile`) |
| Media gallery (`.encrypted_media/*.enc`) | **YES** — `encryptFile()` | `media.tsx:116`, `MediaStorage.ts` |
| Notes content | **YES** — `encryptData()` | `NoteRepositoryImpl.ts:31,71` |
| Password values | **YES** — `encryptData()` | `PasswordRepositoryImpl.ts:31,89` |
| SQLite DB | Partial — PRAGMA key, but silent fallback if unsupported | `DatabaseService.ts:31-35` |

## 4. Authentication Controls

- Brute-force: 5 failed attempts → 5-minute lockout (`UnlockVaultUseCase.ts:5-6,21-33,38-46`).
- Timing: no constant-time comparison; JS string compare (`:37`).
- Biometric path bypasses attempt counter (`05-Biometric-Authentication.md` §6.5).
- Remember-me stores a marker only; no secure token (`login.tsx:19,44-50`).

## 5. Secrets / Keys Inventory (SecureStore keys)

| Key | Source | Value |
|---|---|---|
| `db_encryption_key` | DatabaseService.ts:22-28 | 32-byte hex key |
| `biometric_pin_{vaultId}` | BiometricUnlockUseCase.ts:7,38 | **plaintext PIN** |
| `note_vault_key_{vaultId}` | NoteRepositoryImpl.ts:19 | 32-byte hex |
| `pwd_vault_key_{vaultId}` | PasswordRepositoryImpl.ts:19 | 32-byte hex |
| `media_vault_key_{vaultId}` | MediaStorage.ts:11 | 32-byte hex |
| `biometric_enabled` | biometric-setup.tsx:13 | `'true'` |
| `auto_lock_timeout` | SessionProvider.tsx:21 | ms number |
| `clipboard_protection` | settings.tsx:87 | boolean string |
| `khaznati_remember_vault_{vaultId}` | login.tsx:19 | `'true'` |

## 6. Risk Summary (Highest First)

1. **Files tab imports plaintext** (`files.tsx:22-31`) — sensitive files stored unencrypted on device. Contradicts product promise ("كل شيء مشفر").
2. **DB encryption silent fallback** (`DatabaseService.ts:31-35`) — on platforms without SQLCipher the app proceeds unencrypted without warning.
3. **Non-standard cipher** (custom SHA-256 stream + tag) — see `07-Encryption-Implementation.md`.
4. **Plaintext PIN in SecureStore** for biometric unlock.
5. **Dead settings** imply advertised protections (root detection, secure delete, clipboard clear) don't exist.
6. **`Math.random` password generator** (`passwords.tsx:67`) — not CSPRNG.
7. **Backup/restore copies raw DB file** — includes PIN hashes and encrypted rows; no integrity checksum enforcement on restore (`settings.tsx:126-193`, `DatabaseService.ts:148-159`).
