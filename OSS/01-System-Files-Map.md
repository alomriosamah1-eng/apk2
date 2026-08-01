# 01 — System Files Map

Complete TypeScript/JSON source map (146 files under `app/` + `src/`). Generated during OSS survey.

## app/ — Presentation Layer (20 files)

| File | Purpose |
|---|---|
| `_layout.tsx` | Root layout: fonts, DI, DB init, migrations, providers, root Stack |
| `index.tsx` | Redirect `/ → /(auth)/welcome` |
| `(auth)/_layout.tsx` | Auth Stack container |
| `(auth)/welcome.tsx` | Onboarding / welcome (gradient hero, features, CTAs) |
| `(auth)/create-vault.tsx` | Vault creation wizard (name, icon, color, PIN) |
| `(auth)/login.tsx` | PIN + biometric login, remember-me |
| `(auth)/biometric-setup.tsx` | Biometric enable screen |
| `(app)/_layout.tsx` | App Stack container (tabs + modals) |
| `(app)/(tabs)/_layout.tsx` | Tabs container (6 tabs, hidden bar) |
| `(app)/(tabs)/vault.tsx` | Vault home (quick cards grid, FAB, sheets) |
| `(app)/(tabs)/files.tsx` | File manager (import/rename/delete/export/share) |
| `(app)/(tabs)/media.tsx` | Media gallery (encrypted images import/view/export) |
| `(app)/(tabs)/notes.tsx` | Notes CRUD + pin + search |
| `(app)/(tabs)/passwords.tsx` | Password manager (CRUD, categories, generator) |
| `(app)/(tabs)/settings.tsx` | Settings (theme, language, backup/restore, security) |
| `(app)/modals/_layout.tsx` | Modals Stack container |
| `(app)/modals/file-preview.tsx` | File/image/text preview modal |
| `(app)/modals/create-folder.tsx` | Create folder modal |
| `(app)/modals/activity-log.tsx` | Activity log viewer modal |
| `(app)/modals/about.tsx` | About / founder / contact modal |

## src/core/ — Shared Infrastructure (35 files)

| Area | Files |
|---|---|
| Constants | `constants/config.ts`, `constants/enums.ts`, `constants/index.ts` |
| DI | `di/container.ts`, `di/register.ts` |
| Errors | `errors/index.ts` (DomainError/AuthError/DatabaseError/ValidationError/Result) |
| i18n | `i18n/index.ts`, `i18n/locales/ar.json`, `i18n/locales/en.json` |
| Theme | `theme/colors.ts`, `spacing.ts`, `typography.ts`, `breakpoints.ts`, `elevation.ts`, `icons.ts`, `motion.ts`, `neu.ts`, `state.ts`, `index.ts` |
| Utils | `utils/crypto.ts`, `secure.ts`, `file.ts`, `id.ts`, `logger.ts`, `resilience.ts`, `time.ts`, `index.ts` |
| Validators | `validators/index.ts` |

## src/domain/ — Business Logic (26 files)

| Area | Files |
|---|---|
| Entities | `entities/Vault.ts`, `Item.ts`, `Note.ts`, `Password.ts`, `Settings.ts`, `ActivityLog.ts`, `index.ts` |
| Repositories (interfaces) | `repositories/IVaultRepository.ts`, `IItemRepository.ts`, `INoteRepository.ts`, `IPasswordRepository.ts`, `ISettingsRepository.ts`, `IActivityLogRepository.ts`, `ISecureStorage.ts`, `index.ts` |
| Use cases | `usecases/vault/{Create,Get,Delete,Lock,Unlock}VaultUseCase.ts`, `usecases/item/{Add,Delete,Search}ItemUseCase.ts`, `usecases/auth/BiometricUnlockUseCase.ts`, `usecases/index.ts` |

## src/data/ — Data Layer (35 files)

| Area | Files |
|---|---|
| Database | `database/DatabaseService.ts`, `MigrationRunner.ts`, `schema.ts`, `database/index.ts`, `database/migrations/001_initial.ts`, `002_indexes.ts` |
| Datasources | `datasources/SecureStorageSource.ts`, `FileSystemSource.ts`, `datasources/index.ts` |
| Repositories | `repositories/{Vault,Item,Note,Password,ActivityLog,Settings}RepositoryImpl.ts`, `repositories/index.ts` |
| DTOs | `dto/{Vault,Item,Note,Password,ActivityLog}DTO.ts`, `dto/index.ts` |
| Mappers | `mappers/{Vault,Item,Note,Password,ActivityLog}Mapper.ts`, `mappers/index.ts` |
| Media | `media/MediaStorage.ts` |
| Index | `index.ts` |

## src/ui/ — Presentation Support (49 files)

| Area | Files |
|---|---|
| Providers | `providers/ThemeProvider.tsx`, `SessionProvider.tsx` |
| Hooks | `hooks/{useVaults,useBiometrics,useSecureStorage,useAppState,useDebounce,useResponsive}.ts`, `hooks/index.ts` |
| Components atoms | `atoms/{Button,Card,Divider,EmptyState,ErrorView,Icon,Input,Loading,Skeleton,Snackbar,Typography}.tsx`, `atoms/index.ts` |
| Components molecules | `molecules/{BottomSheet,Dialog,FileRow,FloatingButton,GlassCard,Header,MediaGallery,MediaPreview,MediaThumb,SearchBar}.tsx`, `molecules/index.ts` |
| Components organisms | `organisms/{AddOptionsSheet,FilesList,ItemRow,RenameEditor,ScreenLayout,SelectionBar,VaultCard,VaultListSheet}.tsx`, `organisms/index.ts` |
| Components templates | `templates/index.ts` (empty placeholder) |
| Components index | `components/index.ts` |

## Root Config (outside app/src)

`package.json`, `app.json`, `tsconfig.json`, `babel.config.js`, `metro.config.js`, `jest.config.js`, `.eslintrc.js`, `.prettierrc`, `eas.json`, `.gitignore`, `README.md`, `packages.md`, `install.sh`, `install-offline.sh`, `docs/` (plan + vault-system), `.github/workflows/` (3), `android/`, `khaznati-release/` (APK).
