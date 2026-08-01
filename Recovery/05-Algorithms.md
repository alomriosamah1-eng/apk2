# 05 — Professional Algorithms (خوارزميات احترافية)

> For each major function: workflow, sequence, state machine, pseudocode, error handling, recovery, complexity, Android best practices. Pseudocode is design-level (not final TS). Traced from `OSS/04-07`, `OSS/10-11`, `OSS/15`.

**Conventions**: `Result<T>`; `CryptoError` typed; `KB(vaultId)` = `KeyManager` (per-vault AES-256-GCM); time = epoch-ms.

---

## 5.1 Login (PIN)

**Workflow**
```
LoginScreen → input PIN → UnlockVaultUseCase.execute(vaultId, pin)
 → vault = repo.findById(vaultId)                 [D1: DB read]
 → if vault.locked_until > now: return LOCKED(remaining)
 → derived = PBKDF2(pin, vault.pin_salt, iterations)
 → if constantTimeEqual(derived, vault.encrypted_pin_hash):
       repo.updateFields(vaultId, failed=0, locked_until=NULL)
       repo.unlock(vaultId); log('login'); return SUCCESS
   else:
       failed = vault.failed_attempts + 1
       locked_until = failed >= 5 ? now + 5min : NULL
       repo.updateFields(vaultId, failed, locked_until)
       return AUTH_FAILED(remaining = 5 - failed)
```

**Sequence (Mermaid)**
```mermaid
sequenceDiagram
  U->>L: pin
  L->>UC: unlockVault(id, pin)
  UC->>R: findById(id)
  alt vault missing
    UC-->>L: AUTH_FAILED(not_found)
  else locked (locked_until > now)
    UC-->>L: AUTH_FAILED(locked, remaining)
  else pin ok (const-time)
    UC->>R: updateFields(0, NULL); unlock(id)
    UC->>AL: log('unlock_vault')
    UC-->>L: SUCCESS
  else pin wrong
    UC->>R: updateFields(failed+1, lock?)
    UC-->>L: AUTH_FAILED(attempts_remaining)
  end
```

**State machine**
```
IDLE → SUBMITTING → (ok) UNLOCKED → app
                → (wrong) ATTEMPTS_REMAINING(n) → IDLE
                → (locked) LOCKED(remaining_s) → countdown → IDLE
                → (err) ERROR → IDLE
```

**Pseudocode**
```
function unlockVault(id, pin):
    vault <- repo.findById(id); if !vault: return fail(NOT_FOUND)
    if vault.locked_until != null and now < vault.locked_until:
        return fail(LOCKED, remaining=vault.locked_until-now)
    derived <- pbkdf2HmacSha256(pin, hexToBytes(vault.pin_salt), ITER, KEYLEN)
    if constTimeEqual(derived, hexToBytes(vault.encrypted_pin_hash)):
        repo.updateFields(id, failed=0, locked_until=null)
        repo.unlock(id); activity.log(UNLOCK_VAULT, id)
        return ok()
    failed <- vault.failed_attempts + 1
    locked <- (failed >= 5) ? now+5min : null
    repo.updateFields(id, failed, locked)
    return fail(AUTH_FAILED, attemptsLeft=5-failed, lockedUntil=locked)
```

**Error handling / recovery**: DB errors → `DatabaseError` retried via `withRetry` (existing). Lockout resets on success or after expiry (existing).

**Complexity**: Time `O(1)` DB + `O(iterations)` PBKDF2 (crypto, off-thread); Space `O(1)`.

**Android best practices**: run PBKDF2 on background thread (JSI/Worklet or `expo-crypto`); store `pin_salt`/hash as hex; never log pins; lockout in DB survives restart.

---

## 5.2 Session Management & Auto-Lock

**Workflow**
```
boot:
  hydrate session from SecureStore { rememberedVaultId, lastUnlockedAt, autoLockTimeout }
  route = resolveRoute(session, vaultsExist) → (app)/(auth)
run:
  recordActivity() on user interaction (touch/timer)
AppState: active → background: stamp t0
          background → active: if isUnlocked and (now - t0) >= timeout → lock()
lock(): clear session; router.replace(login)
quickExit(): for each unlocked vault: repo.lock(id); session.lock(); Platform exit or navigate welcome
```

**State machine**
```
BOOT → HYDRATING → (unlocked&valid) APP / (locked) AUTH
APP → BACKGROUND(t0) → [elapsed>=timeout] LOCKED → AUTH
APP → QUICK_EXIT → lockAll → AUTH/exit
```

**Pseudocode**
```
onForeground():
  elapsed = now - backgroundTime
  if elapsed >= autoLockTimeout and isUnlocked: lock()
resolveRoute():
  if rememberedVaultId and isUnlocked and within timeout: return APP
  if vaults.count() > 0: return AUTH/login
  return AUTH/welcome
```

**Errors/recovery**: corrupted persisted session (deleted vault) → clear session → welcome. **Complexity** `O(1)`.

**Best practice**: navigation from effects, never inside state updaters; clear AppState listener on unmount.

---

## 5.3 Biometric Unlock (token-based)

**Workflow**
```
User taps biometric → UI calls useBiometrics.authenticate(prompt) [system prompt]
 → success?  → BiometricUnlockUseCase.execute(vaultId, freshAuth=true)
   → if lockout active → fail(locked)
   → token = secureStore.get('biometric_token_'+id)     // device-keyed encrypted
   → if !token → fail(not_configured)
   → pin = crypto.decrypt(token, deviceKey)             // ephemeral in memory
   → derived = PBKDF2(pin, vault.pin_salt); compare
   → match → unlock; clear ephemeral pin; return ok
```

**State machine**
```
IDLE → PROMPT → granted→VERIFY → (ok) UNLOCKED / (bad) FAIL→PIN-fallback
              → denied → IDLE (stay)
```

**Security notes** (`08`): token is a random 32B password-encrypted blob, not the PIN; `freshAuth` required; lockout enforced; `pin` zeroed after use.

**Complexity**: `O(iterations)` PBKDF2 + `O(1)` decrypt.

**Best practice**: `expo-secure-store` `WHEN_UNLOCKED_THIS_DEVICE_ONLY` + Keystore; do not cache token in JS modules.

---

## 5.4 Key Management (per-vault)

**Workflow**
```
CreateVault:
  masterPinDerived = PBKDF2(pin, salt)            // key from PIN
  for each scope s in {note, pwd, media, file}:
      scopeKey = random(32)
      wrappedKey = AES-GCM(masterPinDerived, scopeKey)   // stored in SecureStore
  Store { salt, wrappedKeys } ; DB stores salt + pin hash
Unlock:
  derived = PBKDF2(pin, salt)
  for each s: scopeKey = AES-GCM-decrypt(derived, wrappedKey_s)
  cache scopeKeys in memory (per session) — never persisted plaintext
```

**Pseudocode**
```
createKeys(vaultId, pin):
  salt <- random(16); mk <- pbkdf2(pin, salt)
  for s in SCOPES:
    k <- random(32)
    secureStore.set('wrapped_'+s+'_'+vaultId, aesGcm(mk, k))
  return {salt, mk}
unlockKeys(vaultId, pin):
  mk <- pbkdf2(pin, salt)
  for s in SCOPES: keys[s] <- aesGcmDec(mk, get('wrapped_'+s+'_'+vaultId))
```

**Errors/recovery**: missing key → prompt PIN re-entry; corrupted wrapped key → `CryptoError`, offer re-wrap from PIN.

**Complexity**: `O(SCOPES)` decryptions at unlock.

**Best practice**: keys only in SecureStore wrapped form; memory-only plaintext keys; cleared on lock.

---

## 5.5 Encrypt / Decrypt (AES-256-GCM)

**Layout** (compat: prepend a **version byte** on migration): `[V 1][IV 12][TAG 16][ciphertext]`.

```
encrypt(key, plaintext) → hex / base64
  iv <- random(12); ct <- aesGcmEncrypt(key, iv, plaintext); tag <- ct.tag
  out <- V || iv || tag || ct.data
decrypt(key, data):
  parse V; if V != CURRENT: run legacy/custom path (migration 14)
  iv, tag, ct <- parse; p <- aesGcmDecrypt(key, iv, ct, tag)   // throws on tamper
```

**Complexity**: `O(n)` time, `O(n)` memory (streamable for large files).

**Best practice**: never reuse `(key, iv)`; use CSPRNG IV; authenticate-then-decrypt; error on tamper (`CryptoError`), never placeholder.

---

## 5.6 File / Media Import → Encrypt → Store

```
import(asset, vaultId):
  bytes <- readFileBinary(asset.uri)          // chunked
  key <- keyManager.get(vaultId, file)
  enc <- encryptFileStream(key, bytes)         // chunked
  id <- uuid(); path <- khaznati/{vaultId}/files/{id}.enc
  writeFile(path, enc); repo.createItem({id, name, type, size, encrypted_path:path})
  thumb <- makeThumbnail(bytes) if image (optional Phase 2)
```

**Errors**: partial write → delete `.enc` + retry; disk full → error; **Complexity** `O(n)`.

**Best practice**: stream (not whole-file base64); background thread for large files; verify integrity on write.

---

## 5.7 Export (media/file) → binary

```
export(item):
  raw <- readFile(item.encrypted_path)
  data <- decryptFile(key, raw)                // bytes
  tmp <- cache/khaznati_export/{name}
  writeBinary(tmp, data)                        // NOT base64-text
  await MediaLibrary.saveToLibraryAsync(tmp.uri) or Sharing.shareAsync(tmp.uri)
  cleanup tmp
```

**Key fix**: decode to binary before writing (R8). **Errors**: permission → Alert; tamper → error. **Complexity** `O(n)`.

---

## 5.8 Password Generator (CSPRNG)

```
generate(length=16, charset):
  b <- randomBytes(length)                     // Crypto.getRandomBytesAsync
  out[i] <- charset[b[i] % charset.length]     // modulo bias negligible for 32-bit > len
  return out
```

**Best practice**: CSPRNG only; no `Math.random`.

---

## 5.9 Notes CRUD

```
create(vaultId, {title, content}):
  key <- keyManager.get(vaultId, note); enc <- encrypt(key, content)
  repo.create({id, vault_id, title, encrypted_content:enc})
read/list: repo.findByVaultId(vaultId) → decrypt each (cache in memory)
update: re-encrypt with same key; delete: repo.delete + log
search(q): debounce 300ms → filter cached decrypted list (title+content)
```

**Complexity**: `O(n)` decrypt on list; cached.

---

## 5.10 Passwords CRUD

```
create: enc = encrypt(key, password); repo.create
list:   decrypt each; NEVER render all passwords visible (reveal-on-demand)
copy:   Clipboard.setStringAsync + schedule clear after clipboardClearMs (Phase 5)
```

---

## 5.11 Backup (v2) & Restore

```
backup():
  manifest = { magic:"KHAZNAti", version:2, created:now, vaultIds:[...] }
  dbBytes = db.export()                        // SQLite dump or copy
  mediaFiles = collect khaznati/{vid}/files/*.enc + .encrypted_media/*
  keysBlob = secureStore.wrapAllKeys(masterExportKey?)  // see 08; or exclude + document
  file = KZBParser.pack({ manifest, dbBytes, mediaFiles, keys })
  checksum = SHA256(file); append header
restore(fileUri):
  verify magic + version + checksum          // reject corrupt
  atomicSwap: backup current db → restore new db → write media files → restore keys
  reload
```

**Complexity**: `O(total bytes)`; streamed.

**Decision needed** (`08`, `09`): whether to include wrapped keys. Recommend **include wrapped keys** so restore preserves decryptability (fixes R7); wrapped with a recovery passphrase (ask user) or device key.

---

## 5.12 Change PIN (new)

```
changePin(vaultId, old, new):
  verify old (PBKDF2+compare)                   // re-auth required
  newSalt <- random(16); newHash <- PBKDF2(new, newSalt)
  oldMk <- pbkdf2(old, oldSalt); newMk <- pbkdf2(new, newSalt)
  for s: rewrap(scopeKey_s, oldMk → newMk)      // decrypt with old, encrypt with new
  repo.update(pin_salt, encrypted_pin_hash, failed=0, locked_until=null)
  delete biometric tokens (require re-enroll)
```

**Complexity**: `O(SCOPES)` rewraps. **Security**: re-auth required; tokens invalidated.

---

## 5.13 Vault Deletion / Secure Delete

```
deleteVault(id):
  secureDeleteAllFiles(khaznati/{id}/)          // best-effort overwrite
  remove SecureStore keys for id (wrapped + tokens + remember)
  repo.delete(id)                                // FK cascade children
  log('delete_vault')
```

---

## 5.14 Clear-All / Lock-All

```
clearAll():
  for each vault: deleteVault(v)                // incl. keys cleanup
  delete khaznati/ dir
  clear backup dir
  session.lock(); replace welcome
lockAll():
  for each vault where !isLocked: repo.lock(id)
  session.lock(); replace welcome
```

---

## 5.15 Session Hydration (cold start)

```
hydrate():
  timeout <- secureStore.get(AUTO_LOCK_KEY) || 300000
  remembered <- secureStore.get(REMEMBERED_VAULT_KEY)   // vaultId
  last <- secureStore.get(LAST_UNLOCK_AT_KEY)
  isUnlocked <- remembered && last && (now - last) <= timeout
  if isUnlocked: activeVaultId = remembered
```

---

## 5.16 Error & Recovery Strategy (general)

- **All crypto failures** → typed `CryptoError` with `code` (`TAMPER`, `BAD_KEY`, `UNSUPPORTED_VERSION`) surfaced to UI; never `'[encrypted]'`.
- **DB** → `DatabaseError` + `withRetry` (existing, keep) + optional queue for writes.
- **File partial-write** → delete orphan + retry.
- **Restore** → checksum gate before swap.
- **Unknown vaultId in params** → fall back to session vault or clear error, never default `'default'` silently (P0-3 fix).

## Complexity Table

| Function | Time | Space | Thread |
|---|---|---|---|
| PIN login | O(iter) | O(1) | bg |
| Unlock keys | O(SCOPES·iter) | O(1) | bg |
| Encrypt/decrypt small | O(n) | O(n) | main ok |
| Encrypt/decrypt large file | O(n) | O(chunk) | bg |
| Backup/restore | O(total) | O(chunk) | bg |
| List notes/passwords | O(n) | O(n·keylen) | main (cached) |
| Password generate | O(len) | O(len) | main |
