# 17 — Configuration Registry

## 17.1 `APP_CONFIG` (`src/core/constants/config.ts`)

```ts
name: 'Khaznati'             version: '1.0.0'        buildNumber: 1
packageName: 'com.khaznati.vault'
database: { name: 'khaznati.db', version: 1, cipherPageSize: 4096, kdfIterations: 64000 }
security: { pbkdf2Iterations: 10000, saltLength: 32, keyLength: 32, ivLength: 12,
            tagLength: 16, algorithm: 'aes-256-gcm', maxLoginAttempts: 5,
            lockoutDurationMs: 300000, autoLockSeconds: 60, sessionTimeoutMs: 900000,
            clipboardClearMs: 10000 }
storage:  { thumbnailsMaxWidth: 256, thumbnailCacheDays: 30, maxFileSize: 524288000,
            chunkSize: 1048576 }
backup:   { fileExtension: '.kzb', magicHeader: 'KHAZNAti', currentVersion: 1 }
```

**Usage audit**: only `database.name`, `database.version` are consumed (`DatabaseService.ts:17`, unused elsewhere). Most security/storage/backup constants are decorative (see `14.5`).

## 17.2 Enums (`src/core/constants/enums.ts`)

| Enum | Values | Used in |
|---|---|---|
| `ThemeMode` | LIGHT/DARK/AMOLED/SYSTEM | ThemeProvider, settings.tsx |
| `VaultType` | PERSONAL/WORK/PRIVATE/CUSTOM | create-vault (PERSONAL only) |
| `ItemType` | FOLDER/IMAGE/VIDEO/AUDIO/DOCUMENT/FILE/NOTE/PASSWORD | files.tsx (FILE), MediaStorage (IMAGE) |
| `AuthMethod` | PIN/PASSWORD/BIOMETRIC/PATTERN | SettingsRepository defaults (PIN) |
| `LockType` | IMMEDIATE/30S/1M/5M/15M/NEVER | SettingsRepository default (AFTER_1M) |
| `ActivityAction` | 20 actions | ACTION_ICONS map in activity-log.tsx; repo enum |
| `SortBy` | NAME/CREATED_AT/UPDATED_AT/SIZE/TYPE | ItemRepository mapSortBy |
| `SortOrder` | ASC/DESC | ItemRepository findByVaultId |
| `PermissionStatus` | GRANTED/DENIED/UNDETERMINED/LIMITED | unused |

## 17.3 Default Settings (`SettingsRepositoryImpl.ts:7-22`)

```ts
themeMode: SYSTEM, authMethod: PIN, lockType: AFTER_1M,
isBiometricEnabled: false, screenCapturePrevention: true, autoLockEnabled: true,
clipboardProtection: true, rootDetectionEnabled: false, secureDeleteEnabled: true,
thumbnailQuality: 'medium', language: 'en', storagePath: '', autoBackupEnabled: false,
autoBackupIntervalDays: 7
```

## 17.4 Hardcoded Values in Screens (overrides / specials)

| Value | Location |
|---|---|
| `REMEMBER_KEY = 'khaznati_remember_vault'` | login.tsx:19 |
| `BIOMETRIC_ENABLED_KEY = 'biometric_enabled'` | biometric-setup.tsx:13 |
| `AUTO_LOCK_KEY = 'auto_lock_timeout'`, default 300000 | SessionProvider.tsx:21-22 |
| Vault colors `['#6C63FF','#FF6584','#03DAC5','#FFB74D','#66BB6A','#42A5F5','#AB47BC','#EF5350']` | create-vault.tsx:16 |
| Vault icons (8) | create-vault.tsx:17 |
| `CATEGORIES` (7) | passwords.tsx:24 |
| Auto-lock options 0/60k/300k/900k/1.8M | settings.tsx:64-70 |
| Theme cycle order | settings.tsx:102-107 |
| TEXT_EXTENSIONS (11) | file-preview.tsx:15 |
| QuickCards (7) + colors | vault.tsx:38-46 |
| ACTION_ICONS (14→20) | activity-log.tsx:16-33 |
| Lockout constants (dup of config) | UnlockVaultUseCase.ts:5-6 |

## 17.5 Environment / Build Config

| File | Key values |
|---|---|
| `app.json` | name khaznati, package com.khaznati.vault, blockedPermissions 3, permissions 6, jsEngine hermes, proguard, updates disabled, plugins 4 |
| `eas.json` | (reviewed earlier — build profiles) |
| `.eslintrc.js` | eslint 8, react-hooks plugin |
| `jest.config.js` | jest-expo preset |
| `babel.config.js` | babel-preset-expo |
| `metro.config.js` | custom alias resolver for `@/*`, `@app/*`, etc. |
| `.github/workflows` | ci.yml, build.yml, build-android.yml (see `26`) |
