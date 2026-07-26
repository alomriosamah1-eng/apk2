# الاختبارات (Testing)

## Verification Commands

```bash
# TypeScript check
npx tsc --noEmit

# ESLint
npx eslint . --max-warnings=100

# Expo doctor
npx expo-doctor

# Run all
npm run verify
```

## Test Scenarios

### Auth Flow
- [x] First launch → Welcome screen
- [x] Create vault with valid data
- [x] Create vault with weak password (blocked)
- [x] Create vault with mismatched passwords (blocked)
- [x] Login with correct password
- [x] Login with wrong password (error + clear)
- [x] Login with empty password (blocked)
- [x] Login with biometrics
- [x] Login with cancelled biometrics
- [x] Remember me persists across sessions
- [x] Lock all vaults → Welcome screen

### Vault Operations
- [x] View vault list
- [x] Open locked vault → Login
- [x] Open unlocked vault → Files
- [x] Create new vault from home

### File Operations
- [x] Import file from device
- [x] View file list
- [x] Search files
- [x] View image preview
- [x] View text file preview
- [x] Create folder

### Notes
- [x] Create note
- [x] Edit note
- [x] Delete note
- [x] Pin/unpin note
- [x] Search notes

### Passwords
- [x] Add password entry
- [x] Generate random password
- [x] Copy to clipboard
- [x] Show/hide password
- [x] Delete entry
- [x] Search entries

### Settings
- [x] Theme toggle (Light/Dark/AMOLED)
- [x] Language toggle (Arabic/English)
- [x] Biometric toggle
- [x] Auto-lock config
- [x] Clipboard protection
- [x] Create backup
- [x] Lock all vaults
