# 08 — Security Plan (الأمن — إعادة تصميم)

> Based on OWASP Mobile Top-10 mapping + Android best practices. Every risk in `OSS/28` is traced. This is the security *design*; Phase 0 + Phase 5 implement.

## 1. Threat Model (in scope)

- Attacker with **device access** (lost/stolen, unlocked screen).
- Attacker with **root/adb** on the user's device.
- **Physical extraction** of app sandbox files (plaintext scan).
- **Tampering** of encrypted blobs (integrity).
- **Brute force** against PIN.
- **Malicious apps** requesting broad permissions.
- **OS backup** leaking vault DB to cloud.

Out of scope: remote network attacker (app is offline), sophisticated forensics with screen-on + PIN known.

## 2. Risk → Control Map

| # | Risk (`OSS/28`) | Control | Phase |
|---|---|---|---|
| R1 | Files plaintext on disk | Encrypt files-tab imports with vault key | 0.2 |
| R2 | Non-standard cipher | Vetted AES-256-GCM (native), versioned layout | 0.1 |
| R3 | DB `PRAGMA key` silent fallback | Explicit DB-encryption-state decision + loud warning | 0.6/4.2 |
| R4 | Plaintext PIN for biometrics | Device-keyed encrypted token | 0.4 |
| R5 | Biometric bypasses lockout / no fresh-auth | freshAuth gate + lockout parity | 5.5 |
| R6 | `Math.random` generator | CSPRNG (`getRandomBytesAsync`) | 5.1 |
| R7 | Backup excludes keys/media | Backup v2 with key manifest + checksum | 4.1 |
| R8 | Media export base64-text | Decode→binary | 3.4 |
| R9 | Decrypt silent placeholder | Typed errors surfaced | 0.8 |
| R11 | Dead security settings | implement or remove | 5.2–5.4 |
| R12 | Remember-me not a token | opaque vault-id + timestamp only | 3.1 |
| R15 | biometric flag ignored | honor flag | 5.5 |
| R17 | No error boundary/crash | ErrorBoundary (+ optional Sentry) | 0.8 |
| R13/R18 | sanitization / singleton | zod (keep), DI consistency | 1.3 |
| R14/R16 | persistence / dead routes | Phase 7 | 7 |

## 3. Cryptography Design

### 3.1 Data & File Encryption (AES-256-GCM)

- **Primitive**: native AES-256-GCM (e.g. `react-native-quick-crypto` or a WebCrypto-backed shim). **Policy**: never implement crypto from scratch.
- **Layout**: `[V 1][IV 12][TAG 16][ciphertext]` (hex for DB strings, base64 for files). Version byte enables migration (`14`).
- **Keys**: 32-byte CSPRNG per scope (`note/pwd/media/file`), wrapped under a PIN-derived key (see 3.3), stored only in SecureStore.
- **Iv**: 12-byte random per encryption; never reused with same key.

### 3.2 PIN Hashing / KDF

- PBKDF2-HMAC-SHA256 (native), salt 16B, iterations ≥ 100k (config); store `salt` + `hash` hex in DB.
- Constant-time compare (`crypto.timingSafeEqual`).
- Migration path from legacy iterated-SHA256 (Phase 14).

### 3.3 Key Management (KeyManager)

```
masterKey = PBKDF2(pin, salt)
scopeKeys = { note, pwd, media, file }   // random 32B each
stored: salt (DB), wrappedKeys = AES-GCM(masterKey, scopeKey) (SecureStore)
memory: scopeKeys decrypted only while vault unlocked
```

- PIN change ⇒ rewrap scope keys under new master key (`05` §5.12).
- Vault delete ⇒ delete wrapped keys + tokens + remember flag.

### 3.4 Biometric Token

- Store `biometric_token_{vaultId}` = AES-GCM(deviceKey, randomRecoveryValue), where deviceKey is Keystore-backed (`expo-secure-store` `WHEN_UNLOCKED_THIS_DEVICE_ONLY`).
- Flow: biometric prompt (fresh) → token decrypt → derive PIN check → unlock. No plaintext PIN anywhere.
- Lockout enforced in the biometric path too.
- Toggle `biometric_enabled` honored on login button.

## 4. Storage & File Security

| Store | Encryption | Notes |
|---|---|---|
| SQLite | field-level (content encrypted) | DB encryption decision in `09` |
| Files (`khaznati/{vid}/files/*.enc`) | AES-256-GCM | Phase 0.2 |
| Media (`*.encrypted_media/*.enc`) | AES-256-GCM | keep |
| SecureStore | OS Keystore | keys + tokens only |
| Cache temp exports | plaintext transient | delete after export; document |

**Secure delete** (Phase 5.3): overwrite file bytes with random before `delete()` (best-effort on flash), for files tab + media + backups.

## 5. Memory Protection

- Zero scope keys + PIN from memory on `lock()`.
- Avoid logging secrets; logger already minimal (`OSS/25.6`).
- No PIN in error messages, analytics, or screenshots (screen-capture prevention at boot; re-assert on login).

## 6. Integrity & Tamper Detection

- AEAD tag verifies on every decrypt; failure ⇒ `CryptoError('TAMPER')` ⇒ user-visible message (not placeholder).
- DB `integrityCheck` at boot (existing) + optional checksum on backup/restore.
- Backup manifest checksum SHA-256 verified before restore.

## 7. Secure Backup (design)

```
Backup v2 (.kzb):
  header: magic "KHAZNAti" | version 2 | header_len
  payload: manifest.json {created, vaultIds, checksums}
           db_dump (SQLite backup) — field-encrypted content
           media_files (encrypted blobs)
           key_manifest (wrapped keys) encrypted with a recovery key
  trailer: SHA-256 of payload
Restore:
  verify magic+version+checksum → parse → validate → atomic swap → reload
```

**Key decision**: include wrapped keys so restore preserves decryptability (fixes R7). Wrap the key manifest with either (a) the same per-vault master key derived from the vault PIN (user re-enters PIN on restore) or (b) a recovery passphrase chosen at backup time. **Recommend (a)** for v1.1 to avoid a new passphrase UX; document recovery.

## 8. Session Security

- Remember-me = opaque `{vaultId, lastUnlockedAt}` in SecureStore; **not** a credential; honored only within auto-lock timeout.
- Auto-lock default 5 min; lock on background ≥ timeout; lock on quick-exit (both platforms).
- SessionProvider navigation from effects (no router in state updater).

## 9. Input Validation & Injection

- All SQL parameterized (verified `OSS/25`); keep.
- zod validators for name/PIN/password (existing); extend to service_name/url/notes lengths; no HTML/JS evaluation.

## 10. Android/OWASP Mobile Checklist

| Control | Status → Target |
|---|---|
| M1 Improper platform usage | ✅ minimize deps |
| M2 Insecure storage | plaintext→encrypted (0.2), keys Keystore |
| M3 Insecure comms | n/a offline |
| M4 Auth | lockout both paths (5.5), const-time compare |
| M5 Bad crypto | replace (0.1) |
| M6 Reverse engineering | enable R8/proguard + root check (5.4) |
| M7 Client injection | parameterized SQL + zod |
| M8 Integrity | AEAD + checksums |
| M9/10 Privacy/extra data | minimize permissions; no analytics |
| `android:allowBackup=false` | OS backup leak (6) |

## 11. Residual Risks (documented)

| Risk | Mitigation / Acceptance |
|---|---|
| Rooted device: SecureStore keys extractable | Root detection warning (5.4); document that rooted devices reduce assurance |
| Forensics with known PIN | Out of scope |
| Debug-signed builds until secrets added | Release-blocking; add secrets (9) |

## 12. Security Verification Gates

- Unit: crypto round-trip, tamper → CryptoError, const-time compare, lockout (PIN + biometric), key rewrap on PIN change.
- Manual: import→preview→delete (no plaintext left), backup→restore round-trip, rooted-device warning, biometric re-enroll after PIN change.
- CI: run crypto/lockout suite; gate on failure.
