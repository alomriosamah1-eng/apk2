# 04 — Button Verification

Every verifiable interactive control, traced to its handler and end action. "Real" = reaches a service/repository/DB/storage. "UI-only" = ends in state/navigation with no durable effect.

---

## Auth / Vault

### create-vault.tsx
| Control | Handler | Reach | Verdict |
|---|---|---|---|
| Submit "Create vault" | `handleCreate` (`create-vault.tsx:57-81`) | useVaults.createVault → CreateVaultUseCase → INSERT vaults + unlock | ✅ Real |
| Store biometric pin on create | `BiometricUnlockUseCase.storeBiometricPin` (`create-vault.tsx:69-70`) | SecureStore `biometric_token_{vaultId}` | ⚠️ stored even if biometrics not enabled |

### login.tsx
| Control | Handler | Reach | Verdict |
|---|---|---|---|
| Unlock button | `handleLogin` (`login.tsx:61-82`) | unlockVault → verifyPin; on success session.unlock + navigate | ✅ Real |
| Remember-me checkbox | `setRememberMe` (`login.tsx:168-173`) | local state only; on success writes flag (`login.tsx:71-73`) | ❌ UI-only (flag never read back — RC-2) |
| Biometric button | `handleBiometric` (`login.tsx:84-97`) | authenticate + BiometricUnlockUseCase.execute | ⚠️ Real but only when flag set |
| Back button | `router.back()` | nav only | 🔲 Navigation |

## Welcome
| Control | Verdict | Notes |
|---|---|---|
| Create vault / unlock CTAs | 🔲 Navigation to create-vault/login | Not part of reported bugs |

---

## Tabs

### vault.tsx
| Control | Handler | Reach | Verdict |
|---|---|---|---|
| Quick action cards / open vault | navigates to files/media/notes/passwords | nav + params | ✅ Real (passes real vaultId) |
| Add (AddOptionsSheet trigger) | `AddOptionsSheet` (`vault.tsx:136`) → import sheet | see AddOptionsSheet | ⚠️ |
| Lock / quick-exit | `lockSession` | SessionProvider.lock + router.replace | ✅ Real (session in-memory) |

### AddOptionsSheet.tsx
| Control | Handler | Reach | Verdict |
|---|---|---|---|
| Import file/doc | `handleImportFile` (`AddOptionsSheet.tsx:99-109`) | `importToVault` → DocumentPicker → encrypt → write `khaznati/{vid}` → `itemRepo.create` | ⚠️ Real pipeline but (a) `no such table: items` (RC-1), (b) routes to **files** tab (ok) |
| Import photo | `handleImportPhoto` (`AddOptionsSheet.tsx:93-97`) | importToVault({type:'image/*'}) → writes `khaznati/{vid}` as ItemType.FILE → routes to **media** tab | ❌ Broken by RC-3: file written to wrong dir + wrong type; media tab won't show it |
| Import video | `handleImportVideo` (99-109) | as above → files tab | ❌ RC-1 (+RC-3 video not read) |
| Import audio | `handleImportAudio` (99-109) | as above → files tab | ❌ RC-1 |
| `onClose` | close sheet | UI | 🔲 |

### files.tsx
| Control | Handler | Reach | Verdict |
|---|---|---|---|
| Import | `handleImport` (`files.tsx:86-126`) | DocumentPicker → encrypt → write → `itemRepo.create` → loadFiles | ❌ RC-1 (insert fails) |
| Batch export | `handleBatchExport` (`files.tsx:168-190`) | MediaLibrary.saveToLibraryAsync | ⚠️ Real; depends on items query succeeding (RC-1 blocks list) |
| Delete / select | handlers | repo.softDelete/delete | ❌ RC-1 |

### media.tsx
| Control | Handler | Reach | Verdict |
|---|---|---|---|
| Import image | `handleImport` (`media.tsx:118-152`) | MediaStorage.persistEncryptedImage → `items` insert | ❌ RC-1 (insert fails) + over-gated permission (`102-116`) |
| View | `handleView` (`media.tsx:154-162`) | readAndDecryptFile | ⚠️ Real; only works for files already in `.encrypted_media` |
| Export | `handleExport` (`media.tsx:164-184`) | decrypt + saveToLibrary | ⚠️ Real |
| Empty-state import | `onImport` (MediaGallery) | → handleImport | ❌ RC-1 |

### notes.tsx
| Control | Handler | Reach | Verdict |
|---|---|---|---|
| Create (FAB) | `handleCreate` (`notes.tsx:69-83`) | opens local editor (state) | 🔲 UI-only (not persistence yet) |
| Save | `handleSaveNote` (`notes.tsx:85-109`) | repo.create/update → INSERT notes | ❌ RC-1; failure silent (`98-108`) |
| Delete | `handleDelete` (`notes.tsx:111-130`) | repo.delete | ❌ RC-1; failure silent |
| Toggle pin | `handleTogglePin` (`notes.tsx:140-143`) | repo.togglePin (uncached call updates ALL selected? — see notes) | ⚠️ RC-1 + note: `togglePin` uses `repo.togglePin` per id correctly; but `notes.tsx:140` calls with id, then reload — blocked by RC-1 |
| Share | `handleShare` (`notes.tsx:132-138`) | RN Share.share | ✅ Real (plaintext preview — security note) |
| Batch delete | `handleBatchDelete` (`notes.tsx:173-188`) | repo.delete loop | ❌ RC-1 |

Note on pin toggling: `NoteRepositoryImpl.togglePin` (`NoteRepositoryImpl.ts:100-110`) is correct per-id.

### passwords.tsx
| Control | Handler | Reach | Verdict |
|---|---|---|---|
| Add (FAB) | `setShowForm(true)` | local form state | 🔲 UI (opens form) |
| Save | `handleSave` (`passwords.tsx:101-148`) | repo.create/update | ❌ RC-1; failure silent (`137-147`) |
| Generate | `generatePassword` (`passwords.tsx:92-99`) | local state; `Math.random` | ⚠️ Real but non-CSPRNG |
| Copy | `handleCopy` (`passwords.tsx:172-182`) | Clipboard + scheduleClipboardClear | ✅ Real |
| Show/hide | `toggleShowPassword` | local state | ✅ Real |
| Delete | `handleDelete` (`163-170`) | repo.delete | ❌ RC-1 |
| Batch delete | `handleBatchDelete` (`207-213`) | repo.delete loop | ❌ RC-1 |
| Category chips | `setSelectedCategory` | local state | ✅ Real |

### settings.tsx
| Control | Handler | Reach | Verdict |
|---|---|---|---|
| Theme toggle | `handleToggleTheme` (`settings.tsx:127-132`) | setThemeMode → ThemeProvider persist | ⚠️ SYSTEM→LIGHT no-op first tap; provider persists (`.catch(()=>{})`) |
| Language toggle | `handleToggleLanguage` (`settings.tsx:134-141`) | changeLanguage + Alert → `Updates.reloadAsync` | ⚠️ fire-and-forget + non-awaited persist + reload race |
| Biometric toggle | handler | SecureStore `biometric_enabled` | ✅ Real |
| Clip/auto-lock toggles | handlers | SecureStore | ✅ Real |
| About link | navigate | nav | 🔲 |

---

## Modals / components
| Control | Verdict |
|---|---|
| file-preview back/decrypt | ⚠️ real decrypt via `File.text()` → `decryptFile` (`file-preview.tsx:40-66`); video = static placeholder only |
| MediaPreview export/back | ✅ real |
| ErrorView retry | ✅ re-runs loader |
| EmptyState action | ✅ invokes onAction |
| SelectionBar batch delete | ❌ blocked by RC-1 |

---

## Summary of button truth
- **Truly real & working:** vault create/unlock/lock, share, clipboard copy, category chips, exports (when items exist), theme/language toggles (mechanically).
- **Real pipeline but blocked by RC-1:** notes save/delete/pin, passwords save/delete, item import & delete, activity log.
- **Real pipeline but broken by RC-3 (dir/type divergence):** photo import via Add sheet → media tab.
- **UI-only / write-only:** remember-me flag (RC-2).
- **No genuine "dead" placeholder buttons** with TODOs/stubs were found in `src/` or `app/` (grep for TODO/FIXME/stub returned nothing of substance). The user's impression of "buttons doing nothing" is the **silent-failure** pattern above, not absent handlers.