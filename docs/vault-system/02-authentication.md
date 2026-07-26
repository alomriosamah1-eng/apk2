# نظام المصادقة (Authentication System)

## Architecture

- PIN hashing with SHA-256 + random salt
- Passwords validated with Zod schemas
- Biometric authentication via `expo-local-authentication`
- "Remember me" via SecureStorage token

## Flow

### Vault Creation
1. User enters vault name + password
2. Password validated against 6 strength criteria
3. Random salt generated (32 bytes)
4. PIN hashed: `SHA-256(password + salt)`
5. Vault created via `CreateVaultUseCase`

### Login
1. User enters password
2. Password + stored salt → SHA-256 hash
3. Compare with stored hash (constant-time)
4. On success: navigate to vault home
5. On failure: clear field, show error

### Biometric Login
1. Check biometric availability
2. Authenticate via `expo-local-authentication`
3. On success: unlock vault
4. On failure: fallback to password

### Remember Me
- Stores flag in SecureStorage (not the password)
- On subsequent visits, pre-selects "تذكرني"
- Cleared on "Lock All Vaults"

## Implementation Files

| File | Purpose |
|------|---------|
| `app/(auth)/create-vault.tsx` | Vault creation wizard |
| `app/(auth)/login.tsx` | Login with password + biometric |
| `app/(auth)/biometric-setup.tsx` | Biometric enrollment |
| `src/domain/usecases/vault/CreateVaultUseCase.ts` | Business logic for creation |
| `src/domain/usecases/vault/UnlockVaultUseCase.ts` | Business logic for unlock |
| `src/domain/usecases/auth/AuthenticateUseCase.ts` | PIN verification |
