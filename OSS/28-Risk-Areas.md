# 28 — Risk Areas & Vulnerabilities

Prioritized findings from the OSS survey. All are observations — **no fixes applied**.

## 28.1 Critical Risks

| # | Risk | Location | Impact |
|---|---|---|---|
| R1 | **Files tab stores imported files unencrypted** on disk | `files.tsx:22-31` `copyImportedFile` + `files.tsx:98-115` | Sensitive user files accessible in app sandbox if device compromised; contradicts "everything encrypted" claim |
| R2 | **Non-standard cipher** — custom SHA-256 stream+XOR, truncated tag; not AES-GCM despite config label | `crypto.ts:30-72,142-236`, `config.ts:23` | Undocumented crypto; no external audit; potential misuse risks |
| R3 | **DB encryption silent fallback** — PRAGMA key errors swallowed | `DatabaseService.ts:31-35` | App can run with plaintext DB without any warning |
| R4 | **Plaintext PIN stored in SecureStore** for biometric unlock | `BiometricUnlockUseCase.ts:36-41`, `create-vault.tsx:67-68` | Root/Keystore compromise leaks PIN |
| R5 | **Biometric path bypasses lockout** — `BiometricUnlockUseCase.execute` doesn't check failed attempts and doesn't require fresh biometric itself | `BiometricUnlockUseCase.ts:14-34`, `login.tsx:73-86` | Reduces brute-force protection |

## 28.2 High Risks

| # | Risk | Location |
|---|---|---|
| R6 | `Math.random` password generator (not CSPRNG) | `passwords.tsx:66-73` |
| R7 | Backup excludes encrypted media files + keys — restore yields undecryptable DB rows | `settings.tsx:126-160`, `24-Storage-Locations.md §6` |
| R8 | Media export writes base64 **text** into file (not decoded binary) | `media.tsx:155-158` |
| R9 | `decryptData`/`decryptFile` silently return placeholders on tamper/error — no user feedback | `crypto.ts:128-130,233-235` |
| R10 | Activity log never populated (`.log()` never called) | `ActivityLogRepositoryImpl.ts:17-41` |

## 28.3 Medium Risks

| # | Risk | Location |
|---|---|---|
| R11 | Dead settings advertise protections that don't exist (root detection, secure delete, clipboard clear, auto backup) | `SettingsRepositoryImpl.ts:15-21`, `settings.tsx:84-88` |
| R12 | Remember-me is a flag only, not secure token; doesn't persist session across restarts properly | `login.tsx:19,44-50` |
| R13 | No input sanitization beyond zod basics; no injection surface analysis (SQL params used — good) | `validators/index.ts` |
| R14 | Theme/language not persisted — resets each launch | `18-Theme`, `19-i18n` |
| R15 | `biometric_enabled` flag ignored by login button visibility | `login.tsx:167` |
| R16 | Unreachable screens (biometric-setup, create-folder) — confusing flow surface | `03-Screens-Registry.md` |
| R17 | No crash reporting / error boundary | `25-Error-Handling.md §7` |
| R18 | Shared `SecureStorageSource` module singleton outside DI in `useSecureStorage.ts:4` | inconsistency |

## 28.4 Low / Cosmetic

| # | Risk | Location |
|---|---|---|
| R19 | `activity-log.tsx:79` hardcodes Arabic locale formatting | `activity-log.tsx:79` |
| R20 | Duplicate index creation across migrations (harmless) | `09-Migrations-History.md §3` |
| R21 | `useVaults` re-resolves DI each render | `useVaults.ts:15-19` |
| R22 | Hardcoded version strings `Khaznati v1.0.0` in settings/about | `settings.tsx:349`, `about.tsx:202` |
| R23 | `en.json` `settings.english` label used as language display | `settings.tsx:314` |

## 28.5 Recommended Next Actions (informational — not performed)

1. Add AES-GCM via a vetted library or document/rename the custom scheme.
2. Encrypt Files-tab imports with the vault key (mirror MediaStorage).
3. Make DB encryption mandatory + warn if PRAGMA key unsupported.
4. Replace `Math.random` with `Crypto.getRandomBytesAsync` for generator.
5. Enforce fresh biometric + lockout checks inside `BiometricUnlockUseCase`.
6. Fix media export to decode base64 → binary before writing.
7. Wire `.log()` calls into vault/item/password actions so activity log works.
8. Extend backup to include media files and vault keys (or document limitation).
9. Add unit tests for crypto round-trips, lockout, and repository layers.
