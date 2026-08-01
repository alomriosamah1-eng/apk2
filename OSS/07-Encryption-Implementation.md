# 07 — Encryption Implementation

Detailed analysis of `src/core/utils/crypto.ts` (249 lines) — the only crypto module.

## 1. Overview

Despite `APP_CONFIG.security.algorithm = 'aes-256-gcm'`, the implementation is a **custom symmetric stream cipher built on SHA-256**:

- **Key**: 32 random bytes (hex-encoded) — `generateEncryptionKey()` (`:20-23`).
- **IV**: 12 random bytes per message (`:32`).
- **Keystream**: counter-mode SHA-256 over `key ‖ iv ‖ counter` producing 32-byte blocks (`:35-53`).
- **Encryption**: `ciphertext[i] = plaintext[i] XOR keystream[i]` (`:55-58`).
- **Authentication tag**: first 16 bytes of `SHA256(iv_hex + ciphertext_hex + key_hex)` (`:60-65`).
- **Output layout (hex)**: `[IV 12][TAG 16][ciphertext]` (`:67-71`).

## 2. Encrypt Flow (`encryptData`, `:30-72`)

```mermaid
graph TD
  A[keyHex 32B] --> B[hexToBytes]
  C[plaintext] --> D[TextEncoder → bytes]
  E[getRandomBytes 12B] --> F[IV]
  F --> G{loop i step 32}
  G --> H[counter = i/32 big-endian 4B]
  H --> I[combined = key ‖ IV ‖ counter]
  I --> J[SHA256(combined) → 32B block]
  J --> K[keystream[i..i+32] = block]
  K --> G
  L[keystream] --> M[XOR → ciphertext]
  M --> N[tag = SHA256(ivHex+cipherHex+keyHex) first 16B]
  N --> O[output hex = IV ‖ TAG ‖ ciphertext]
```

## 3. Decrypt Flow (`decryptData`, `:74-131`)

1. Parse `[IV][TAG][ciphertext]` (`:83-85`).
2. Recompute expected tag, constant-ish loop compare (`:87-100`) — fails → returns `'[encrypted]'` (swallows tamper error).
3. Regenerate keystream, XOR back, `TextDecoder` (`:102-127`).
4. Any error → `'[encrypted]'` placeholder (`:128-130`).

## 4. File Variants

| Function | Input | Output | Notes |
|---|---|---|---|
| `encryptData` | UTF-8 string | hex string | DB fields (`:30`) |
| `decryptData` | hex string | string | `'[encrypted]'` on failure |
| `encryptObject/decryptObject` | object → JSON | hex string | `:133-140` |
| `encryptFile` | **base64** string | **base64** string | media, `:142-184` |
| `decryptFile` | base64 string | base64 string | `''` on failure, `:186-236` |

## 5. Key Management

- Keys generated via `Crypto.getRandomBytesAsync(32)` (`:20-23`); hex strings.
- Per-vault keys stored in SecureStore: `note_vault_key_*`, `pwd_vault_key_*`, `media_vault_key_*` (see `06` §5).
- One DB key `db_encryption_key` for SQLite PRAGMA (`DatabaseService.ts:22-28`).

## 6. Correctness / Security Analysis

| Aspect | Assessment |
|---|---|
| Keystream uniqueness | IV 12B random per message — good |
| XOR stream | Correct counter-mode construction (no reuse with same IV+key) |
| Key length | 32B (256-bit) — good |
| Authentication | SHA-256 truncation to 16B tag — **not standard GCM; timing not constant-time** |
| Authenticated encryption | Encrypt-then-MAC layout; tag computed over `iv+cipher`+key — ok-ish |
| KDF | Iterated SHA-256 (not PBKDF2/HMAC); iteration count hardcoded 100k |
| Tamper detection | `decryptData` returns `'[encrypted]'` rather than throwing → silent data loss in UI |
| At-rest file coverage | Files tab does **not** use crypto at all (raw copy, `files.tsx:22-31`) |
| Standard-compliance | **Not AES-GCM.** Any doc/label claiming AES-256-GCM is inaccurate |

## 7. Constants (module-level)

`IV_LENGTH=12`, `KEY_LENGTH=32`, `SALT_LENGTH=16`, `TAG_LENGTH=16` (`:3-6`). `generateSalt()` here (16B) differs from `secure.ts` salt (also 16B) — both used: crypto for keys, secure for PIN salt.
