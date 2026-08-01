# 15 — Critical Paths (Execution Flows)

## 15.1 App Boot

```mermaid
sequenceDiagram
  participant OS
  participant Root as app/_layout.tsx
  participant DI as DIContainer
  participant DB as DatabaseService
  participant MR as MigrationRunner
  participant SC as expo-screen-capture
  OS->>Root: launch
  Root->>Root: SplashScreen.preventAutoHideAsync()
  Root->>Root: Font.loadAsync(Cairo 400/500/600/700)
  Root->>DI: registerDependencies()
  Root->>DB: initialize()
  DB->>DB: PRAGMA key / WAL / foreign_keys
  Root->>MR: runner.run(db)
  MR->>MR: apply migrations 001, 002
  Root->>DB: integrityCheck()
  Root->>SC: preventScreenCaptureAsync()
  Root->>Root: setReady(true) → render providers
```

## 15.2 Vault Creation → First Screen

```mermaid
sequenceDiagram
  participant W as welcome.tsx
  participant C as create-vault.tsx
  participant V as useVaults
  participant CC as CreateVaultUseCase
  participant B as BiometricUnlockUseCase
  participant VR as VaultRepository
  participant SS as SecureStorage
  W->>C: router.push(create-vault)
  C->>C: gather name/icon/color/pin
  C->>V: createVault(input)
  V->>CC: execute(input)
  CC->>CC: validate name + pin
  CC->>CC: salt = generateSalt(); hash = hashPin(pin,salt)
  CC->>VR: create(vault)
  VR->>VR: INSERT INTO vaults
  CC->>B: storeBiometricPin(id, pin)
  B->>SS: set("biometric_pin_"+id, pin)
  C->>C: router.replace(vault tab)
```

## 15.3 PIN Login (with lockout)

```mermaid
sequenceDiagram
  participant L as login.tsx
  participant V as useVaults
  participant U as UnlockVaultUseCase
  participant VR as VaultRepository
  L->>V: unlockVault(id, pin)
  V->>U: execute(id, pin)
  U->>VR: findById(id)
  alt failedAttempts>=5 AND now<lockedUntil
    U-->>L: AUTH_FAILED "locked, remaining s"
  end
  U->>U: hashPin(pin, vault.pinSalt)
  alt wrong
    U->>VR: updateFields(failedAttempts+1 [, lockedUntil=now+5m if >=5])
    U-->>L: AUTH_FAILED "N attempts remaining"
  else correct
    U->>VR: updateFields(0, null) if needed
    U->>VR: unlock(id)
    U-->>L: success
  end
  L->>L: session.unlock + remember + navigate
```

## 15.4 Auto-Lock on App Background

```mermaid
sequenceDiagram
  participant OS
  participant SP as SessionProvider
  participant R as Router
  OS-->>SP: AppState → background/inactive
  SP->>SP: record backgroundTime
  OS-->>SP: AppState → active
  SP->>SP: elapsed = now - backgroundTime
  alt elapsed >= autoLockTimeout AND isUnlocked
    SP->>SP: clear session state
    SP->>R: router.replace('/(auth)/login')
  end
```

## 15.5 File Import (Files tab) — note: unencrypted

```mermaid
sequenceDiagram
  participant F as files.tsx
  participant DP as expo-document-picker
  participant FS as expo-file-system
  participant IR as ItemRepository
  F->>DP: getDocumentAsync(copyToCacheDirectory)
  DP-->>F: asset
  F->>FS: copyImportedFile() → khaznati/{vaultId}/{name} [RAW]
  F->>IR: create(item)  [no encryption]
  IR->>IR: INSERT items + updateVaultCounts
  F->>F: loadFiles()
```

## 15.6 Media Import (encrypted)

```mermaid
sequenceDiagram
  participant M as media.tsx
  participant IP as expo-image-picker
  participant CR as utils/crypto
  participant MS as MediaStorage
  M->>IP: launchImageLibraryAsync(base64:true)
  IP-->>M: asset.base64
  M->>MS: getVaultKey(vaultId)
  MS->>MS: read/create media_vault_key_{id}
  M->>CR: encryptFile(key, base64)
  CR-->>M: encryptedBase64
  M->>MS: persistEncryptedImage(...)
  MS->>MS: write .encrypted_media/{ts}.{ext}.enc
  MS->>IR: create(items row)
  M->>M: reload gallery
```

## 15.7 Backup & Restore

```mermaid
sequenceDiagram
  participant S as settings.tsx
  participant DB as DatabaseService
  participant FS as expo-file-system
  participant SH as expo-sharing
  participant DP as expo-document-picker
  participant U as expo-updates
  S->>FS: create backups/ dir
  S->>DB: copy SQLite/khaznati.db → backups/khaznati-backup-{ts}.kzb
  S->>SH: shareAsync(kzb)
  Note over S: RESTORE
  S->>DP: getDocumentAsync()
  S->>DB: restore(asset.uri)  [close, copy, re-init]
  S->>U: reloadAsync()
```

## 15.8 Clear All Data / Lock All

```mermaid
sequenceDiagram
  participant S as settings.tsx
  participant V as useVaults
  participant FS as expo-file-system
  participant R as Router
  S->>V: deleteVault(id) for each vault
  V->>V: DeleteVaultUseCase → repository.delete
  S->>FS: delete khaznati/ dir
  S->>R: replace('/(auth)/welcome')
```
