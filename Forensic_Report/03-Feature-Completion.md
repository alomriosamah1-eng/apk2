# 03 — Feature Completion

Verification method: for each feature, locate real UI handler, service, repository, DB/storage target, error handling, validation, tests. Completion evaluated against working at runtime, not just code presence.

Legend: ✅ Working · ⚠️ Partial (code real, blocked/conditional) · ❌ Broken · 🔲 UI-only/stub

---

## Vault management
| Aspect | Verdict | Evidence |
|---|---|---|
| Create vault (name, pin, icon, color) | ✅ | `create-vault.tsx:57-81` → `useVaults.ts:41-48` → `CreateVaultUseCase` (`CreateVaultUseCase.ts:23-62`) → `VaultRepositoryImpl.create` real INSERT (`VaultRepositoryImpl.ts:15-30`) |
| PIN hashing | ✅ | PBKDF2 100k salted (`secure.ts:59-72`) |
| Unlock (verify pin) | ✅ | `login.tsx:61-82` → `UnlockVaultUseCase` → `verifyPin` |
| Lock | ✅ | `SessionProvider.lock` + `LockVaultUseCase`/`VaultRepositoryImpl.unlock` |
| Delete vault | ✅ | `useVaults.ts:55-58` + `DeleteVaultUseCase` |
| Completion | **~90%** | works on fresh install because `vaults` table exists (RC-1 only created `vaults`) |
| **Tests** | partial | unit tests exist for usecases/repos |

## Notes
| Aspect | Verdict | Evidence |
|---|---|---|
| Create/edit/delete/pin handlers | ⚠️ code real | `notes.tsx:69-188` → `NoteRepositoryImpl` (`NoteRepositoryImpl.ts:28-142`) |
| SQLite persistence | ❌ | `INSERT INTO notes` throws `no such table: notes` (RC-1) |
| Error handling | ❌ | Save failure silently closes editor (`notes.tsx:98-108`) |
| Validation | ⚠️ | none (empty-title allowed) |
| Search | 🔲 | `NoteRepositoryImpl.search` exists but unused; screen filters in memory (`notes.tsx:195-197`) |
| Completion | **~40%** (code), **0%** (runtime) | blocked entirely by RC-1 |
| **Tests** | partial | `NoteRepositoryImpl.test.ts` uses FakeDatabaseService (in-memory) — never exercises real schema |
| vaultId fallback | ⚠️ | `vaultId = paramsVaultId || 'default'` (`notes.tsx:29`) → FK violation risk |

## Passwords
| Aspect | Verdict | Evidence |
|---|---|---|
| Add/edit/delete/copy/generate handlers | ⚠️ code real | `passwords.tsx:92-229` → `PasswordRepositoryImpl` |
| SQLite persistence | ❌ | `no such table: passwords` (RC-1) |
| Error handling | ❌ | Save failure closes form silently (`passwords.tsx:137-147`) |
| Generator entropy | ❌ | `Math.random` (`passwords.tsx:92-99`), not CSPRNG |
| Clipboard protection | ✅ | `scheduleClipboardClear` (`utils/clipboard.ts`) wired (P5) |
| Completion | **~45%** (code), **0%** (runtime) | blocked by RC-1 |
| **Tests** | partial | as notes |

## Media import (photos/videos/audio/files)
| Aspect | Verdict | Evidence |
|---|---|---|
| Image import (media tab) | ⚠️ real pipeline | `media.tsx:118-152` → `MediaStorage.persistEncryptedImage` (`MediaStorage.ts:33-60`) |
| File/video/audio import (Add sheet, files tab) | ⚠️ real pipeline | `AddOptionsSheet.importToVault:45-80`, `files.tsx:86-126` |
| SQLite metadata | ❌ | `no such table: items` (RC-1) |
| Media display | ❌ | media.tsx lists only `.encrypted_media` dir; Add sheet writes to `khaznati/{vid}` (RC-3) |
| Permissions | ⚠️ | over-gated; system picker needs no permission on 13+/iOS (`media.tsx:102-116`) |
| Completion | **~40%** (code) / **0%** (runtime) | RC-1 + RC-3 |
| **Tests** | none | no media/import tests |

## Files
| Aspect | Verdict | Evidence |
|---|---|---|
| Import | ⚠️ real | `files.tsx:86-126` → ItemRepo.create |
| Display | ❌ | `no such table: items` → error |
| Batch export | ⚠️ real | `files.tsx:168-190` → MediaStorage/MediaLibrary |
| Completion | **~40%** / **0%** | RC-1 |

## Activity log
| Aspect | Verdict | Evidence |
|---|---|---|
| Logging calls | ⚠️ real | `log` in `useVaults.ts:26`, `notes.tsx:101,122`, `passwords.tsx:33`, `login.tsx:79` |
| SQLite | ❌ | `no such table: activity_log` (RC-1) |
| vault linkage | ❌ | `vault_id: undefined` hardcoded (`ActivityLogRepositoryImpl.ts:30`) |
| Completion | **~30%** | RC-1 + missing vault_id |

## Session / remember-me
| Aspect | Verdict | Evidence |
|---|---|---|
| unlock/lock state | ⚠️ in-memory only | `SessionProvider.tsx:47-63` |
| Remember-me | ❌ write-only | `login.tsx:70-73` writes; never read back (RC-2) |
| Auto-lock | ⚠️ | AppState timer works only while alive; wiped on reload/kill (`SessionProvider.tsx:76-97`) |
| Completion | **~25%** | RC-2 |
| **Tests** | partial | ThemeProvider/i18n/clipboard tests added; Session untested |

## Biometrics
| Aspect | Verdict | Evidence |
|---|---|---|
| Prompt | ✅ | `useBiometrics.authenticate` |
| Token persisted | ⚠️ | `storeBiometricPin` encrypts PIN under device key (`BiometricUnlockUseCase.ts:73-80`) |
| Flag enforcement | ⚠️ | button only when `biometric_enabled==='true'` (`login.tsx:178`, `settings.tsx:97`) |
| Fresh-auth gate | ❌ | use-case execute() does not itself require a fresh biometric (caller gates it) |
| Completion | **~55%** | |

## Dark mode
| Aspect | Verdict | Evidence |
|---|---|---|
| Provider palette | ✅ | correct memo + complete dark/amoled palettes |
| Reach components | ✅ | `useTheme().colors` used widely |
| Hardcoded light colors | ❌ | `vault.tsx:41-47`, `FileRow.tsx:49`, `AddOptionsSheet.tsx:184`, `ErrorBoundary.tsx:58`, etc. |
| Control UX | ⚠️ | SYSTEM→LIGHT first tap = no-op (`settings.tsx:120-132`) |
| Completion | **~60%** | |

## Language (ar/en)
| Aspect | Verdict | Evidence |
|---|---|---|
| i18n init/resources | ✅ | both locales bundled; init at startup (`i18n/index.ts:23-34`) |
| Re-render | ✅ | react-i18next subscribers re-render on languageChanged |
| Persistence | ⚠️ | `changeLanguage` fire-and-forget + non-awaited secure-store write (`i18n/index.ts:45-49`) |
| RTL | ⚠️ | `forceRTL` needs restart to apply (`settings.tsx:134-141` + `Updates.reloadAsync`) |
| Completion | **~65%** | |

## Performance
| Aspect | Verdict | Evidence |
|---|---|---|
| Startup | ❌ | serial blocking chain + integrity_check (07) |
| Login/unlock latency | ❌ | sync 100k PBKDF2 on JS thread (07) |
| List rendering | ❌ | ScrollView, no virtualization |
| Re-renders | ⚠️ | SessionProvider value recreated each render |
| Completion | **~30%** | |

---

## Overall completion
- **Code presence:** ~70% (real implementations exist for nearly all features).
- **Runtime-working:** ~35% (dominated by RC-1, RC-2, RC-3).
- The **biggest delta** between "code exists" and "works" is the schema bootstrap bug (RC-1). Second is session (RC-2). Third is media directory divergence (RC-3).