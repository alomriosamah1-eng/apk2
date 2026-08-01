# 13 — Dependency & Call Graph

Cross-cutting call graph: screen → hook/component → use case → repository → database/core.

## 1. Full Call Graph (Mermaid)

```mermaid
graph LR
  %% ===== Auth =====
  INDEX[index.tsx] --> WELCOME
  WELCOME[welcome.tsx] --> CREATE[create-vault.tsx]
  WELCOME --> LOGIN[login.tsx]
  CREATE -->|createVault| USE_CV[useVaults]
  CREATE -->|storeBiometricPin| BIO[BiometricUnlockUseCase]
  LOGIN -->|unlockVault| USE_CV
  LOGIN -->|execute| BIO
  BIO -->|get/hashPin/unlock| VAULT_REPO[VaultRepository]
  BIO --> SEC_STORE[SecureStorageSource]
  BIO_SETUP[biometric-setup.tsx] --> SEC_STORE

  %% ===== useVaults hook =====
  USE_CV[useVaults.ts] --> GET_VC[GetVaultsUseCase]
  USE_CV --> CREATE_VC[CreateVaultUseCase]
  USE_CV --> DEL_VC[DeleteVaultUseCase]
  USE_CV --> LOCK_VC[LockVaultUseCase]
  USE_CV --> UNLOCK_VC[UnlockVaultUseCase]
  GET_VC --> VAULT_REPO
  CREATE_VC --> VAULT_REPO
  DEL_VC --> VAULT_REPO
  LOCK_VC --> VAULT_REPO
  UNLOCK_VC --> VAULT_REPO
  VAULT_REPO --> DB[DatabaseService]

  %% ===== Vault tab =====
  VAULT[vault.tsx] --> ADD_SHEET[AddOptionsSheet]
  VAULT --> VAULT_LIST[VaultListSheet]
  VAULT_LIST --> LOGIN
  ADD_SHEET -->|import| FILES
  ADD_SHEET --> MEDIA
  ADD_SHEET --> NOTES
  ADD_SHEET --> PASSWORDS

  %% ===== Files =====
  FILES[files.tsx] --> ITEM_REPO[ItemRepository]
  FILES --> PREVIEW[file-preview.tsx]
  ITEM_REPO --> DB

  %% ===== Media =====
  MEDIA[media.tsx] --> CRYPTO[utils/crypto]
  MEDIA --> MED_STOR[MediaStorage]
  MED_STOR --> SEC_STORE
  MED_STOR --> ITEM_REPO

  %% ===== Notes =====
  NOTES[notes.tsx] --> NOTE_REPO[NoteRepository]
  NOTE_REPO --> CRYPTO
  NOTE_REPO --> DB
  NOTE_REPO --> SEC_STORE

  %% ===== Passwords =====
  PASSWORDS[passwords.tsx] --> PWD_REPO[PasswordRepository]
  PWD_REPO --> CRYPTO
  PWD_REPO --> DB
  PWD_REPO --> SEC_STORE

  %% ===== Settings =====
  SETTINGS[settings.tsx] --> DB
  SETTINGS --> BIO
  SETTINGS --> SEC_STORE
  SETTINGS --> ACT_LOG[activity-log.tsx]
  SETTINGS --> ABOUT[about.tsx]

  %% ===== Modals =====
  ACT_LOG --> ALR[ActivityLogRepository]
  ALR --> DB

  %% ===== Core shared =====
  DB --> SQLITE[expo-sqlite]
  CRYPTO --> EXPO_CRYPTO[expo-crypto]
  SEC_STORE --> EXPO_SS[expo-secure-store]
  SETTINGS --> FS[expo-file-system]
  SETTINGS --> DOCPICK[expo-document-picker]
  SETTINGS --> UPDATES[expo-updates]
```

## 2. Layer Boundaries

| Direction | Allowed | Evidence |
|---|---|---|
| app → ui/domain/data/core | yes | screens import components + DI tokens |
| ui → domain | yes | hooks call use cases |
| ui → data | yes | activity-log resolves `ActivityLogRepositoryImpl` directly (`activity-log.tsx:11,41`) |
| domain → data | **no (by design)** | domain only knows interfaces; data implements them |
| data → core | yes | repositories import `@core/errors`, `@core/utils/crypto` |
| core → external libs | yes | crypto uses expo-crypto |

**Violation noted**: `ui/providers/SessionProvider.tsx:5` imports `SecureStorageSource` (data) directly; `media.tsx` imports `MediaStorage` (data) and `encryptFile/decryptFile` (core) directly; screens import DTO/repository impls. Pragmatic shortcuts that skip interface indirection.

## 3. Module Import Hotspots (frequently imported)

| Module | Imported by |
|---|---|
| `@core/utils` (index) | ~everywhere (id, time, logger, resilience, secure) |
| `@core/theme` | all UI + screens (spacing/colors/typography) |
| `@core/errors` | all domain + data |
| `@core/di/container` | all hooks + screens using DI |
| `@ui/providers/ThemeProvider` | all UI + screens |
| `react-i18next` `useTranslation` | all screens |

## 4. Circular Dependency Risk Assessment

- `CreateVaultUseCase → BiometricUnlockUseCase → VaultRepository` (no cycle).
- `useVaults` resolves 5 use cases each render — cheap (singletons) but not memoized list.
- Container resolves lazily; boot order (register → resolve) avoids cycles (`app/_layout.tsx:69-73`).

## 5. Dead Ends (resolve/import to nowhere)

- `FileSystemSource`, `SettingsRepository`, `AddItemUseCase`, `DeleteItemUseCase`, `SearchItemsUseCase` — registered only.
- Components `BottomSheet`, `Dialog`, `GlassCard`, `Snackbar`, `Skeleton`, `VaultCard`, `ItemRow`; hooks `useDebounce`, `useAppState` — exported but unused (see `14`).
