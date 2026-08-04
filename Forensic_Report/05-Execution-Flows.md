# 05 — Execution Flows

Each feature's full runtime path. `✂》BREAK` = point where execution is interrupted (exception/silent fail). Arrows are literal code call chains.

---

## 1. Create vault
```
Button (create-vault.tsx:57) handleCreate
 → useVaults.createVault (useVaults.ts:41-48)
 → CreateVaultUseCase.execute (CreateVaultUseCase.ts:23-62)
    validateVaultName / validatePin (validators)
    generateSalt() + hashPin(pin, salt)  [PBKDF2 100k]  (secure.ts:59-72)
    build Vault (encryptedPinHash, pinSalt)
 → vaultRepository.create (VaultRepositoryImpl.ts:15-30)
    INSERT INTO vaults (...)           ✅ table exists
 → BiometricUnlockUseCase.storeBiometricPin (create-vault.tsx:69-70)
    SecureStore biometric_token_{vaultId}
 → session.unlock(id) → router.replace('/(app)/(tabs)/vault', {vaultId})
```
**Result: WORKS** (vaults table is the only one RC-1 created). Perf note: PBKDF2 blocks JS thread here.

## 2. Unlock / login
```
Input pin → handleLogin (login.tsx:61-82)
 → unlockVault(id, pin) (useVaults.ts:72-79)
 → UnlockVaultUseCase.execute (UnlockVaultUseCase.ts:13-78)
    verifyPin(pin, salt, hash)  [PBKDF2 100k]  (secure.ts:105-119)
    → VaultRepositoryImpl.unlock (sets is_locked=0)
 → session.unlock(id)
 → router.replace('/(app)/(tabs)/vault')
```
**Result: WORKS** (boolean flip). Not data-gating decryption (keys stored unwrapped, see 06/14). PBKDF2 blocks thread.

## 3. Save a note
```
Button Save (notes.tsx:224) handleSaveNote (notes.tsx:85-109)
 → repo = DIContainer.resolve('NoteRepository') (notes.tsx:41-44)
 → result = repo.create(updated)  (NoteRepositoryImpl.ts:28-43)
    getVaultKey → SecureStore note_vault_key_{vaultId}
    encryptData(vaultKey, content)  [AES-GCM]
    INSERT INTO notes (...)          ✂》BREAK: "no such table: notes"
    → catch → failure(DatabaseError)
 → if (result.success) { loadNotes(); log }   // skipped
 → setEditingNote(null)                        // closes editor, no error shown
```
**Result: BROKEN. User sees the note "vanish".** RC-1.

## 4. Save a password
```
Button Save (passwords.tsx:261) handleSave (passwords.tsx:101-148)
 → repo.create({...}) (PasswordRepositoryImpl.ts:28-45)
    getVaultKey → SecureStore pwd_vault_key_{vaultId}
    encryptData → INSERT INTO passwords (...)   ✂》BREAK "no such table: passwords"
    → failure(DatabaseError)
 → if (result?.success) { loadEntries; log }    // skipped
 → setShowForm(false); clear form               // no error shown
```
**Result: BROKEN.** RC-1.

## 5. Import photo via Add sheet → media tab
```
Button "Add Photo" (vault.tsx:136 → AddOptionsSheet.tsx:93) handleImportPhoto
 → onClose()
 → importToVault({type:'image/*'}) (AddOptionsSheet.tsx:45-80)
    DocumentPicker.getDocumentAsync
    getVaultKey(targetId) → SecureStore media_vault_key_{targetId}
    srcFile.base64() → encryptFile(key, base64)
    getDefaultVaultDir() = Paths.document/khaznati/{targetId}   ← NOT .encrypted_media
    encFile.write(encryptedBase64)
    itemRepo.create({...type: ItemType.FILE...})   ✂》BREAK "no such table: items"
    (result discarded)
 → pushWithVault('/(app)/(tabs)/media')
```
**media.tsx loadMedia (media.tsx:33-57)** lists only `Paths.document/khaznati/{vendorId}/.encrypted_media`.
**Result: BROKEN twice** — (a) RC-1 insert fails; (b) even if it succeeded, file lives in `khaznati/{vid}`, media tab never reads it (RC-3). Photo invisible in Media.

## 6. Import image via media tab
```
Button import (media.tsx:118) handleImport
 → requestMediaPermission (media.tsx:102-116)   [over-gated, see 08]
 → ImagePicker.launchImageLibraryAsync({mediaTypes:['images'], base64:true})
 → persistEncryptedImage (MediaStorage.ts:33-60)
    getEncryptedDir(vid) = .../.encrypted_media
    encFile.write → itemRepo.create(type: IMAGE)   ✂》BREAK "no such table: items"
 → loadMedia()   [dir listing only — .encrypted_media]
```
**Result: BROKEN.** RC-1 (DB record). Display path (dir scan) by itself is fine.

## 7. Activity log
```
any of: useVaults.ts:26 / notes.tsx:101,122 / passwords.tsx:33 / login.tsx:79
 → void repo.log(...) (ActivityLogRepositoryImpl.ts:17-41)
    INSERT INTO activity_log (…, vault_id, …)   ✂》BREAK "no such table: activity_log"
    (also vault_id hardcoded undefined, line 30)
 → failure(DatabaseError) — fire-and-forget, ignored
```
**Result: BROKEN.** RC-1 + missing vault_id linkage.

## 8. Theme toggle
```
settings.tsx:127 handleToggleTheme
 → setThemeMode(next) → ThemeProvider (ThemeProvider.tsx:38-49)
    mode → colors (useMemo, switch dark/amoled/light)
    value.useMemo → context → consumers re-render
    secureStorage.set(THEME_KEY, mode).catch(()=>{})   [fire-and-forget]
```
**Result: PARTIALLY WORKS.** First tap SYSTEM→LIGHT is visual no-op; many hardcoded light colors ignore theme (08/09).

## 9. Language toggle
```
settings.tsx:134 handleToggleLanguage
 → changeLanguage(next) (i18n/index.ts:45-49)
    void i18n.changeLanguage(lang)         [not awaited]
    applyTextDirection(lang) → I18nManager.forceRTL(...)  [needs restart]
    secureStorage.set(LANGUAGE_KEY, lang).catch(()=>{})   [not awaited]
 → Alert → Updates.reloadAsync()           [manual restart]
```
**Result: PARTIALLY WORKS / race-prone.** RC-F10/F11 (07). RTL won't apply without a clean restart; persist may be lost if reload races ahead.

## 10. Start to first screen
```
app/_layout.tsx:60-87 init (serial, awaited)
 → initI18n → Font×4 → registerDependencies → db.initialize
 → runner.run → [migration1 ok] → [migration2 FAIL: no such table: items]  ✂》trow
 → catch → log "App initialization failed" → setReady(true)
```
**Result: app still opens but init chain aborts early.** Because `runner.run` throws at migration 2, the statements after it — `integrityCheck()` and **`preventScreenCaptureAsync()`** (`app/_layout.tsx:76-78`) — **never run** on fresh installs. Screen-capture protection is silently disabled. Migration 2 retried every launch.

---

## Flow interruption index
| # | Feature | Interrupt point | Cause |
|---|---|---|---|
| 3 | Notes save | `NoteRepositoryImpl.ts:34` (INSERT notes) | RC-1 missing table |
| 4 | Passwords save | `PasswordRepositoryImpl.ts:34` (INSERT passwords) | RC-1 |
| 5 | Photo import | `AddOptionsSheet.tsx:~75` + media.tsx load | RC-1 + RC-3 |
| 6 | Media import | `MediaStorage.ts:57` (itemRepo.create) | RC-1 |
| 7 | Activity log | `ActivityLogRepositoryImpl.ts:33` (INSERT activity_log) | RC-1 |
| 10 | Startup | `runner.run` migration 002 (002_indexes.ts:5) | RC-1 |

Every persisted write is interrupted by RC-1. No flow is interrupted by DI/crypto failures (those layers are correct).