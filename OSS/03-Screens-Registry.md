# 03 — Screens Registry

16 screens total: 4 auth + 6 tabs + 4 modals + redirect. Every screen is documented with purpose, inputs, actions, and file evidence.

## 3.1 Auth Screens

### welcome.tsx — Onboarding
- **Purpose**: App intro with gradient hero, 3 feature bullets, primary CTA.
- **Inputs**: none.
- **Actions**: "Get Started" → create-vault (`:18`); "Existing Vault" → login (`:19`).
- **UI**: `LinearGradient` hero + `FeatureItem` list (`:29-72`); responsive padding via `useResponsive().scaleSize` (`:16`).

### create-vault.tsx — Vault Creation Wizard
- **Purpose**: Create a vault: name, icon, color, PIN + confirm.
- **Inputs**: `name` (text), `selectedIcon` (8 icons, default `shield-lock`), `selectedColor` (8 colors, default `#6C63FF`), `pin`/`confirmPin` (digits only, max 8, `:45-53`).
- **Constants**: `COLORS` and `ICONS` (`:16-17`).
- **Strength meter**: `getPinStrength(pin,t)` — ≤4 weak / ≤6 fair / >6 strong (`:19-23`).
- **Submit gating**: `canSubmit = name && pin.length>=4 && pin===confirmPin` (`:42`).
- **Actions**: calls `createVault({...})` (`:65`), then `BiometricUnlockUseCase.storeBiometricPin(vaultId, pin)` (`:67-68`), then `router.replace('/(app)/(tabs)/vault')` (`:69`).
- **Note**: PIN is stored for biometric use even when user will later skip biometrics.

### login.tsx — PIN / Biometric Login
- **Purpose**: Unlock an existing vault by PIN (or biometric). Supports "remember me".
- **Inputs**: `id` param (target vault, default `vaults[0]`) (`:28,37-40`).
- **Remember-me**: `REMEMBER_KEY = 'khaznati_remember_vault'` persisted in SecureStore per vault (`:19,44-50`).
- **Actions**:
  - `unlockVault(id,pin)` → on success `session.unlock(id)` + navigate (`:59-65`).
  - Biometric button → `authenticate()` then `BiometricUnlockUseCase.execute(vaultId)` (`:73-86`).
- **Edge states**: no vaults → empty UI; unknown id → not-found UI with button to vault tab (`:93-129`).

### biometric-setup.tsx — Biometric Enrollment
- **Purpose**: Post-creation screen to enable biometric unlock.
- **Key**: `BIOMETRIC_ENABLED_KEY = 'biometric_enabled'` stored `'true'` in SecureStore (`:13,24`).
- **Actions**: Enable (authenticate + store) or Skip, both `router.replace('/(app)/(tabs)/vault')` (`:20-31`).
- **Note**: This screen is registered in the auth stack but is **not reachable** from any other screen (no `router.push` target found — dead route).

## 3.2 Tab Screens (hidden tab bar)

### vault.tsx — Vault Home
- **Purpose**: Quick access grid of 7 cards (files, photos, video, audio, notes, passwords, quick-exit) + FAB.
- **Cards**: `quickCards` array (`:38-46`); 3 columns responsive width (`:14-19`).
- **Actions**: card press → per-type navigation (`:48-75`); video/audio → files tab; quick-exit → `BackHandler.exitApp()` (`:67-73`).
- **Sheets**: `AddOptionsSheet` + `VaultListSheet` (`:133-134`).
- **Header**: title `app.name`, subtitle current vault name; right actions vault-list + settings (`:89-101`).

### files.tsx — File Manager
- **Purpose**: List/import/rename/delete/export/share files in `Paths.document/khaznati/{vaultId}`.
- **Import**: `DocumentPicker.getDocumentAsync` → `copyImportedFile()` copies raw to vault dir (`:22-31,91-121`); also writes an `items` DB row via `ItemRepository.create` (`:98-115`).
- **Note (security)**: imported files are **copied unencrypted** (no crypto applied) — see `07-Encryption-Implementation.md`.
- **Bulk ops**: SelectionBar (share/export/delete) (`:153-174`); export copies files to `Paths.cache/khaznati_export` via MediaLibrary permission (`:158-174`).
- **Rename**: inline `RenameEditor` (`:222-237`), conflict check (`:229-231`).
- **Preview**: push `file-preview` modal with `fileName&uri` (`:176-178`).

### media.tsx — Media Gallery
- **Purpose**: Encrypted photo gallery. Only `*.enc` files in `.encrypted_media` dir are listed (`:42-49`).
- **Import**: `ImagePicker` with `base64:true` → `encryptFile(key, base64)` → `persistEncryptedImage()` (`:102-128`). Key via `getVaultKey()` = `media_vault_key_{vaultId}` (`MediaStorage.ts:11`).
- **View**: decrypt file → inline `data:image/jpeg;base64,` preview (`:130-140`).
- **Export**: decrypt → temp file → `MediaLibrary.saveToLibraryAsync` (`:142-167`).
- **Bulk**: share (names only) / delete (`:78-100`).

### notes.tsx — Notes CRUD
- **Purpose**: Create/edit/delete/pin/search notes. Editing is a full-screen inline editor (`:150-182`).
- **Storage**: `NoteRepository` encrypts content with `note_vault_key_{vaultId}` at rest (see `10-Data-Repositories.md`); content is passed as plaintext through the UI (`:74-91`).
- **Sort**: pinned first then `updatedAt` desc (`:141-144`).
- **Search**: filters title + content (`:146-148`).
- **Selection**: long-press enters selection mode; batch delete (`:124-139`).

### passwords.tsx — Password Manager
- **Purpose**: CRUD password entries with categories, show/hide, copy, generator.
- **Categories**: `['social','email','finance','shopping','work','entertainment','other']` (`:24`).
- **Generator**: 16-char random from charset `:66-73` (uses `Math.random`, not CSPRNG).
- **Copy**: `Clipboard.setStringAsync` + 2s feedback (`:139-143`).
- **Storage**: `PasswordRepository` encrypts `encryptedPassword` with `pwd_vault_key_{vaultId}` (see `10`).
- **Show/hide**: per-entry `showPasswords` set (`:176-182`).

### settings.tsx — Settings
- **Purpose**: Security (biometrics, auto-lock), data (backup/restore/clear/activity), appearance (theme/language/clipboard), about/licenses, lock-all.
- **Auto-lock options**: 0 / 60s / 5m / 15m / 30m (`:64-70`), persisted via `setItem('auto_lock_timeout', ...)` (`:95`).
- **Theme cycle**: SYSTEM → LIGHT → DARK → AMOLED (`:102-114`).
- **Language toggle**: `changeLanguage()` + `forceRTL` + `Updates.reloadAsync()` (`:116-124`).
- **Backup**: copies `SQLite/khaznati.db` → `backups/khaznati-backup-{ts}.kzb` and shares (`:126-160`).
- **Restore**: `DocumentPicker` → `DatabaseService.restore(uri)` → reload (`:162-193`).
- **Clear-all**: deletes all vaults + `khaznati` dir + go to welcome (`:195-217`).
- **Lock-all**: locks every vault + go to welcome (`:231-238`).
- **Biometrics toggle**: authenticates first then flips `biometric_enabled` (`:72-82`).
- **Clipboard toggle**: writes `clipboard_protection` (flag only; no runtime behavior found) (`:84-88`).

## 3.3 Modals

### file-preview.tsx — File/Image/Text Preview
- **Purpose**: Preview image (`expo-image`), video (placeholder only), text files, or generic file info.
- **Detection**: ext → image/video/text sets (`:21-24`); `TEXT_EXTENSIONS` (`:15`).
- **Reads**: file size via `File.size`; text content via `file.text()` (`:44-52`).

### create-folder.tsx — Create Folder
- **Purpose**: Create subfolder in `khaznati/{vaultId}` via `Directory.create` (`:29-35`).
- **Note**: only creates the folder; no `items` DB row is written (inconsistent with file import).

### activity-log.tsx — Activity Log Viewer
- **Purpose**: Read latest 100 entries via `ActivityLogRepository.getRecent(100)` (`:41-45`) and clear all (`:50-63`).
- **Icons**: `ACTION_ICONS` map for 14 actions, default `information-outline` (`:16-33`).
- **Note**: `vault_id` is always `undefined` on insert (`ActivityLogRepositoryImpl.ts:30`), so entries are global.
- **Key finding**: no screen calls `.log()` anywhere — table is never populated in normal use (see `14-Hidden-Features.md`).

### about.tsx — About / Founder
- **Purpose**: Brand hero (portrait image), vision/mission/values, stats grid, features, timeline, founder, Telegram/WhatsApp links (`:54-60`).
- **Content**: static arrays + i18n keys (`:12-48`).
- **Version footer**: `Khaznati v1.0.0` (`:202`).
