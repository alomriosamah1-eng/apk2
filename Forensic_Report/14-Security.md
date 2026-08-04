# 14 — Security

Security architecture review of the vault app.

## What is genuinely secure (verified)
- **Field-level encryption is real AES-256-GCM** with random 12-byte IV + 16-byte tag + version byte (`crypto.ts:65-105` encryptData/decryptData; `:178-218` encryptFile/decryptFile via @noble/ciphers). Used by notes, passwords, media (files), biometric token.
- **Password hashing real PBKDF2-HMAC-SHA256, 100k iterations, salted** (`secure.ts:59-72`). Legacy V0 reader present for migration (`crypto.ts:108-161, 221-272`).
- **Keys at rest** in platform Keystore/Keychain via expo-secure-store.
- **Screen-capture protection** attempted at startup (`preventScreenCaptureAsync`, `_layout.tsx:78`) — **but never runs on fresh install** because migration 2 throws before it (RC-1). Defect.

## Findings

### SEC-1 — HIGH (high conf): vault PIN does NOT gate decryption; keys unwrapped
- Keys stored as random values under static SecureStore keys (`note_vault_key_*`, `pwd_vault_key_*`, `media_vault_key_*`, `biometric_device_key`, `db_encryption_key`). The `encrypted_pin_hash`/`pin_salt` are **never used to derive or wrap these keys**. Unlock only flips `vaults.is_locked` boolean.
- **Impact:** an attacker/buggy path that can read the app-private SecureStore can decrypt without the PIN. The PIN gate is cosmetic at the data layer.
- **Severity:** High. **Confidence:** High.

### SEC-2 — MEDIUM (high conf): whole-file DB encryption is nominal
`PRAGMA key = ?` (SQLCipher) on plain expo-sqlite → unsupported → `FIELD_ENCRYPTED`. `db_encryption_key` generated but unused. Real protection is only per-field AES. (06 F-H7, 11.)

### SEC-3 — MEDIUM (medium conf): biometric token stored regardless of opt-in; no fresh-auth in the use case
`storeBiometricPin` called on every vault create (`CreateVaultUseCase.ts:57-59`, `create-vault.tsx:69-70`) even if the user never enables biometrics. `BiometricUnlockUseCase.execute` does not itself perform a fresh authentication — the prompt is only enforced by callers (`login.tsx:84-97`, `settings.tsx`). (06 F-H3, P3.)

### SEC-4 — MEDIUM (medium conf): unlock/PIN-verify stalls UI (DoS on self)
Wrong-pin path runs `hashPinLegacy` = 100k **async** `Crypto.digestStringAsync` bridge calls → freezes UI for seconds (07 P-2). Also enables a crude timing signal. Mitigated only by `locked_until` gating (lockout exists in VaultRepository / BiometricUnlockUseCase).

### SEC-5 — MIXED: share/copy of secrets
- `notes.tsx:132-138` `Share.share` sends **decrypted plaintext** note content to the system share sheet. Intent is user-initiated, but no warning.
- `passwords.tsx:172-182` copy password → clipboard with **auto-clear** (`scheduleClipboardClear`, default 10s, toggleable) — this protection is correctly implemented (P5) and mitigates clipboard leakage. Good.
- Seed of password generator uses `Math.random` (`passwords.tsx:92-99`), not CSPRNG — weak generated passwords. (06 H12/P4.)

### SEC-6 — MEDIUM (high conf): `allowBackup=true` → restore lock-out (data loss, cross-ref 08 A-1)
Encrypted SQLite + media auto-backed up, but Keystore-backed keys excluded → restoring on a new device yields encrypted blobs without keys. Not exfiltration, but permanent data loss / denial of access.

### SEC-7 — LOW (high conf): default routes / session
Cold start always lands on welcome/login (no auto-unlock persistence — RC-2). This is secure-by-default but conflicts with "remember me" expectation.

### SEC-8 — INFO: no R8/minify, no obfuscation in release
Release built with `minifyEnabled=false`; no obfuscation for a crypto-vault app (cross-ref 10, 09-S). Debug-signing fallback in CI when keystore secret absent (09 B-4).

### SEC-9 — INFO: `db_encryption_key`
Legend says DB at-rest encryption; in practice unused. Not a vuln, but misleading design/security claim.

---

## Security posture summary
- Encryption primitive: ✅ strong and correctly used for field data.
- Key management: ❌ PIN does not wrap keys (SEC-1) — the biggest security weakness.
- Boot/recon: ❌ screen-capture protection doesn't run on fresh install (RC-1 side-effect).
- OS integration: ⚠️ Keystore stores keys; backup policy weak (SEC-6).
- Generated secrets: ⚠️ password generator uses weak RNG (SEC-5).
- Fine-grained data access: ⚠️ PIN gates UI, not ciphertext.

Priority: SEC-1 (key wrapping under PIN) is the meaningful crypto gap; RC-1 must be fixed to restore screen-capture protection.