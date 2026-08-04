# 15 — Technical Debt

Inventory of accumulated debt by category, with severity and location. Items already detailed elsewhere are cross-referenced.

## Foundational correctness debt
| Item | Sev | Ref | Location |
|---|---|---|---|
| Schema applied via single-statement `runSync` (only `vaults` created) | 🔴 Critical | 06 RC-1 / 11 | schema.ts:2-92, DatabaseService.ts:89-92, 001_initial.ts:5-7 |
| `getVersion` reads wrong column → version bookkeeping broken | 🟠 High | 06 F-H6 / 11 | DatabaseService.ts:138-148 |
| Session never persisted / remember-me write-only | 🔴 Critical | 06 RC-2 / 12 | login.tsx:70-73, SessionProvider.tsx:27-63 |
| Startup aborts at migration 2 → screen-capture & integrity never run | 🟠 High | 05 §10 / 11 | app/_layout.tsx:76-81, 002_indexes.ts:5 |

## Data & abstraction debt
| Item | Sev | Ref | Location |
|---|---|---|---|
| Two divergent media/file storage pipelines (dir + type + key namespace) | 🟠 High | 06 RC-3 / 12 / 10-CQ-3 | MediaStorage.ts vs AddOptionsSheet.tsx/files.tsx vs FileSystemSource.ts |
| `FileSystemSource` fully implemented but unused | 🟠 Medium | 12 S1 / 10-CQ-4 | FileSystemSource.ts:6-166, register.ts:36-38 |
| Use-case layer bypassed (AddItem etc. unused) | 🟡 Medium | 10-CQ-2 | files.tsx/media.tsx/AddOptionsSheet.tsx |
| `vaultId` fallback literal `'default'` → FK risk | 🟠 Medium | 06 N2/P2 | notes.tsx:29, passwords.tsx:40 |

## UX/error-handling debt
| Item | Sev | Ref | Location |
|---|---|---|---|
| Silent failure closes forms with no error | 🔴 High | 06 CQ-1 | notes.tsx:98-108, passwords.tsx:137-147, AddOptionsSheet.tsx:74-78 |
| Hardcoded light colors ignore theme | 🟡 Medium | 06 F15 / 10-CQ-5 | vault.tsx:41-47, FileRow.tsx:49, ErrorBoundary.tsx:58, etc. |
| about.tsx hardcoded Arabic strings | 🟢 Low | 10-CQ-5 | about.tsx |
| SYSTEM→LIGHT first-tap no-op theme cycle | 🟡 Low | 07 F14 | settings.tsx:120-132 |
| i18n persist fire-and-forget + reload race; forceRTL needs restart | 🟡 Medium | 07 F10/F11 | i18n/index.ts:45-49, settings.tsx:134-141 |

## Performance debt
| Item | Sev | Ref | Location |
|---|---|---|---|
| Sync 100k PBKDF2 on JS thread | 🔴 High | 07 P-2 | secure.ts:59-72 |
| Per-row AES decrypt on list load | 🟠 Medium | 07 P-3 | NoteRepositoryImpl.ts:64, PasswordRepositoryImpl.ts:74-82 |
| Un-virtualized ScrollView lists | 🟠 Medium | 07 P-4 | FilesList.tsx:30, MediaGallery.tsx:26, notes/passwords |
| SessionProvider value recreated each render | 🟡 Medium | 07 P-5 | SessionProvider.tsx:100 |
| Redundant full-vault queries per nav | 🟡 Medium | 07 P-6 | useVaults.ts:81-83, (app)/_layout.tsx:13-26 |
| Serial blocking startup + integrity scan | 🟠 High | 07 P-1 | app/_layout.tsx:60-87 |
| `withRetry` backoff masks errors | 🟡 Medium | 07 P-7 | resilience.ts, DatabaseService.ts |
| metro `fs.statSync` resolver | 🟢 Low | 07 P-9 | metro.config.js:7-44 |

## Build/release debt
| Item | Sev | Ref | Location |
|---|---|---|---|
| Debug-signing fallback in CI | 🟠 High | 09 B-4 | build.yml:96-98 |
| `versionCode` 1 always; android/ 1.0.0 vs 1.1.0 | 🟡 Medium | 08 A-3 | build.gradle:95-96, app.json |
| Universal 4-ABI release (no split/minify) | 🟡 Medium | 09 S-1/S-2 | gradle.properties:31 |
| `allowBackup=true` | 🟠 Medium | 08 A-1 | manifest |
| `enableOnBackInvokedCallback=false` @ targetSdk36 | 🟡 Medium | 08 A-2 | manifest |
| `--legacy-peer-deps` everywhere | 🟢 Low | 09 D-2 | workflows, install.sh |
| install.sh/packages.md → SDK57 image-picker | 🟠 Medium | 09 D-1 | install.sh, packages.md |
| Dead storage flags/doc (requestLegacyExternalStorage, USE_FINGERPRINT, edgeToEdge) | 🟢 Low | 08 A-4/A-5 | manifest, gradle.properties |

## Dependency debt
| Item | Sev | Ref |
|---|---|---|
| `@testing-library/jest-native` deprecated+unused | 🟡 Medium | 09 D-3 |
| unused expo-constants/linking/localization | 🟢 Low | 09 D-4 |
| `@` alias missing from jest moduleNameMapper | 🟢 Low | 09 D-6 |

## Security debt (cross-ref 14)
| Item | Sev | Ref |
|---|---|---|
| PIN doesn't wrap keys; unlock is boolean-only | 🟠 High | 14 SEC-1 |
| Whole-file DB encryption nominal | 🟡 Medium | 14 SEC-2 |
| Biometric token stored regardless of opt-in; no fresh-auth in use case | 🟡 Medium | 14 SEC-3 |
| `Math.random` password generator | 🟡 Medium | 14 SEC-5 |
| Screen-capture protection disabled on fresh install | 🟠 High | 14 SEC-9 / 05 §10 |

## Test debt
| Item | Sev | Ref |
|---|---|---|
| Repo tests use fake DB → miss RC-1 | 🟠 High | 10 Testing |
| `--passWithNoTests` would pass green with zero tests | 🟡 Medium | 10 Testing |
| No media/import/session/startup tests | 🟡 Medium | 10 Testing |

## Total debt shape
- **Fixing RC-1** removes ~60% of symptom-level debt (all "table missing" failures + boot abort + screen-capture).
- **Fixing RC-2** removes session/remember-me debt.
- **Fixing RC-3** removes the media/file-store divergence.
- Remaining debt is conventional (perf, build, security-hardening, tests).