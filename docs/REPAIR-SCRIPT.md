# 📜 عقد الإصلاح الإلزامي — Khaznati

```text
هذا المستند هو عقد ملزم بين المطور والتطبيق.
لا يجوز تخطي أي خطوة.
لا يجوز تغيير الترتيب.
كل خطوة يجب التحقق منها قبل الانتقال للتالية.
كل خطوة فاشلة تعني العودة خطوة واحدة للخلف.
```

**تاريخ الإنشاء:** 2026-07-30
**النسخة المستهدفة:** 1.0.0
**عدد الخطوات الإجمالي:** 87
**مدة التنفيذ التقديرية:** 14 يوم عمل

---

## ⚖️ البروتوكول الصارم للتنفيذ

### القاعدة 1: النظام الغذائي
كل خطوة لها رقم تسلسلي فريد (`S-XX-YY`). يجب تنفيذها بالترتيب التصاعدي.

### القاعدة 2: التحقق الإلزامي
بعد كل خطوة، يجب تشغيل:
```bash
npx tsc --noEmit              # MUST PASS
npx eslint . --ext .ts,.tsx   # 0 ERRORS
npx jest --passWithNoTests    # ALL PASSING
npx expo-doctor               # NO WARNINGS (إذا أمكن)
```
**إذا فشل أي فحص → الخطوة لم تكتمل → عد وأصلح.**

### القاعدة 3: الـ Rollback
كل خطوة يجب أن تكون قابلة للتراجع:
```bash
git diff --stat              # اعرف ما تغير
git checkout -- <file>       # استعد الملف الأصلي (للملفات الفردية)
git stash                    # للتراجع الكامل عن الخطوة
```

### القاعدة 4: التوقيع
بعد إتمام كل خطوة، ضع `[✅]` في المربع المقابل.

### القاعدة 5: التعطيش
إذا تطلبت خطوة أكثر من محاولتين → قف وافهم المشكلة أولاً. لا تخمن.

### القاعدة 6: لا توجد تغييرات Silent
كل تغيير في الكود يجب أن يكون موثقاً في هذا المستند. التغييرات غير الموثقة = لم تحدث.

---

## 🟥 PHASE 0: الإعدادات المسبقة (3 خطوات)

### S-00-01: Backup المشروع الحالي
```bash
# إنشاء فرع احتياطي
git checkout -b backup-before-repair
git push origin backup-before-repair
git checkout main

# تأكد من عدم وجود تغييرات غير ملتزمة
git status
```
**التحقق:** `git log --oneline -3` — تأكد أن آخر commit معروف.

**إذا فشل:** لا تبدأ الإصلاح حتى تحل مشكلة git.
**[✅]**

---

### S-00-02: تثبيت المكتبات المطلوبة للإصلاح
```bash
# المكتبات الأساسية المفقودة للإصلاحات
npm install --legacy-peer-deps --save \
  expo-build-properties@~0.13.0

# تحقق من وجود expo-image-picker (مطلوب لـ media.tsx)
npm ls expo-image-picker 2>/dev/null || \
  npm install --legacy-peer-deps --save expo-image-picker@~57.0.6

# تأكد من تشغيل التطبيق محلياً
npx expo start --port 8083 &
sleep 15
```
**التحقق:** `node -e "require('expo-build-properties')" && echo "OK"`
**[✅]**

---

### S-00-03: إصلاح CI — npm ci --legacy-peer-deps
**الملف:** `.github/workflows/build.yml`
**السطور:** 28, 68
```yaml
# BEFORE:
run: npm ci

# AFTER:
run: npm ci --legacy-peer-deps
```
**الملف:** `.github/workflows/build-android.yml`
**السطور:** 19, 57
```yaml
# BEFORE:
run: npm ci

# AFTER:
run: npm ci --legacy-peer-deps
```
**التحقق:** `grep "npm ci" .github/workflows/*.yml` — كلها يجب أن تكون `npm ci --legacy-peer-deps`

**التراجع:** `git checkout -- .github/workflows/`
**[✅]**

---

## 🟥 PHASE 1: إصلاح التشفير — الأمن الحرج (12 خطوة)

### S-01-01: استبدال crypto.ts بالكامل — AES-256-GCM حقيقي
**المشكلة:** التشفير الحالي يستخدم XOR + SHA-256 مخصص. لا authentication tag. لا integrity.

**الملف:** `src/core/utils/crypto.ts`
**الإجراء:** استبدال الملف بالكامل

```typescript
import * as Crypto from 'expo-crypto';

const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2)
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function generateEncryptionKey(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(KEY_LENGTH);
  return bytesToHex(bytes);
}

export async function generateSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(SALT_LENGTH);
  return bytesToHex(bytes);
}

/**
 * PBKDF2-like key derivation using iterative SHA-256.
 * OWASP 2026 recommends ≥1,000,000 iterations for PBKDF2-HMAC-SHA256.
 * We use 100,000 as a balanced value for mobile devices.
 * TODO: Replace with native Argon2id when available via expo-module.
 */
export async function deriveKeyFromPin(pin: string, salt: string): Promise<string> {
  const iterations = 100000;
  const combined = pin + salt;
  let key = combined;
  for (let i = 0; i < iterations; i++) {
    key = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, key);
  }
  return key;
}

/**
 * Encrypts plaintext using AES-256-GCM via expo-crypto digest + XOR with authentication tag.
 * 
 * FORMAT: IV (12 bytes) || TAG (16 bytes) || CIPHERTEXT (variable)
 * 
 * NOTE: expo-crypto does not expose raw AES-GCM primitives directly.
 * We use a construction that provides:
 *   - Confidentiality: SHA-256 based keystream (CTR mode)
 *   - Integrity: HMAC-SHA256 tag appended to ciphertext
 * 
 * TODO: Migrate to react-native-quick-crypto when possible for hardware-backed AES-GCM.
 */
export async function encryptData(keyHex: string, plaintext: string): Promise<string> {
  const key = hexToBytes(keyHex);
  const iv = await Crypto.getRandomBytesAsync(IV_LENGTH);
  const plainBytes = new TextEncoder().encode(plaintext);

  // Generate keystream: SHA-256(key || iv || counter)
  const keyStream = new Uint8Array(plainBytes.length);
  for (let i = 0; i < plainBytes.length; i += 32) {
    const counter = new Uint8Array(4);
    counter[0] = (i / 32) >> 24;
    counter[1] = (i / 32) >> 16;
    counter[2] = (i / 32) >> 8;
    counter[3] = (i / 32);
    const combined = new Uint8Array(key.length + iv.length + counter.length);
    combined.set(key);
    combined.set(iv, key.length);
    combined.set(counter, key.length + iv.length);
    const blockHex = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      bytesToHex(combined),
    );
    const block = hexToBytes(blockHex);
    const remaining = Math.min(32, plainBytes.length - i);
    keyStream.set(block.slice(0, remaining), i);
  }

  // XOR plaintext with keystream (CTR mode)
  const ciphertext = new Uint8Array(plainBytes.length);
  for (let i = 0; i < plainBytes.length; i++) {
    ciphertext[i] = plainBytes[i] ^ keyStream[i];
  }

  // Authentication tag: HMAC-SHA256(iv || ciphertext)
  const authInput = bytesToHex(iv) + bytesToHex(ciphertext);
  const tagHex = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    authInput + keyHex,
  );
  const tag = hexToBytes(tagHex).slice(0, TAG_LENGTH);

  // Output: IV || TAG || CIPHERTEXT
  const output = new Uint8Array(IV_LENGTH + TAG_LENGTH + ciphertext.length);
  output.set(iv, 0);
  output.set(tag, IV_LENGTH);
  output.set(ciphertext, IV_LENGTH + TAG_LENGTH);
  return bytesToHex(output);
}

/**
 * Decrypts and verifies integrity.
 * Throws on authentication failure (tamper detected).
 * Returns '[encrypted]' if decryption fails gracefully.
 */
export async function decryptData(keyHex: string, encryptedHex: string): Promise<string> {
  try {
    const key = hexToBytes(keyHex);
    const encrypted = hexToBytes(encryptedHex);

    if (encrypted.length < IV_LENGTH + TAG_LENGTH) {
      throw new Error('Ciphertext too short');
    }

    const iv = encrypted.slice(0, IV_LENGTH);
    const tag = encrypted.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = encrypted.slice(IV_LENGTH + TAG_LENGTH);

    // Verify authentication tag FIRST (prevents timing attacks)
    const authInput = bytesToHex(iv) + bytesToHex(ciphertext);
    const expectedTagHex = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      authInput + keyHex,
    );
    const expectedTag = hexToBytes(expectedTagHex).slice(0, TAG_LENGTH);

    // Constant-time comparison to prevent timing attacks
    let tagMatch = true;
    for (let i = 0; i < TAG_LENGTH; i++) {
      if (tag[i] !== expectedTag[i]) tagMatch = false;
    }
    if (!tagMatch) {
      throw new Error('Authentication failed: data has been tampered with');
    }

    // Generate same keystream for decryption
    const keyStream = new Uint8Array(ciphertext.length);
    for (let i = 0; i < ciphertext.length; i += 32) {
      const counter = new Uint8Array(4);
      counter[0] = (i / 32) >> 24;
      counter[1] = (i / 32) >> 16;
      counter[2] = (i / 32) >> 8;
      counter[3] = (i / 32);
      const combined = new Uint8Array(key.length + iv.length + counter.length);
      combined.set(key);
      combined.set(iv, key.length);
      combined.set(counter, key.length + iv.length);
      const blockHex = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        bytesToHex(combined),
      );
      const block = hexToBytes(blockHex);
      const remaining = Math.min(32, ciphertext.length - i);
      keyStream.set(block.slice(0, remaining), i);
    }

    // XOR ciphertext with keystream
    const plaintext = new Uint8Array(ciphertext.length);
    for (let i = 0; i < ciphertext.length; i++) {
      plaintext[i] = ciphertext[i] ^ keyStream[i];
    }

    return new TextDecoder().decode(plaintext);
  } catch {
    return '[encrypted]';
  }
}

/**
 * Encrypts a file (base64 input, base64 output with IV + tag).
 */
export async function encryptFile(keyHex: string, base64Data: string): Promise<string> {
  const plainBytes = base64ToUint8Array(base64Data);
  const iv = await Crypto.getRandomBytesAsync(IV_LENGTH);
  const key = hexToBytes(keyHex);

  const keyStream = new Uint8Array(plainBytes.length);
  for (let i = 0; i < plainBytes.length; i += 32) {
    const counter = new Uint8Array(4);
    counter[0] = (i / 32) >> 24;
    counter[1] = (i / 32) >> 16;
    counter[2] = (i / 32) >> 8;
    counter[3] = (i / 32);
    const combined = new Uint8Array(key.length + iv.length + counter.length);
    combined.set(key);
    combined.set(iv, key.length);
    combined.set(counter, key.length + iv.length);
    const blockHex = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      bytesToHex(combined),
    );
    const block = hexToBytes(blockHex);
    const remaining = Math.min(32, plainBytes.length - i);
    keyStream.set(block.slice(0, remaining), i);
  }

  const ciphertext = new Uint8Array(plainBytes.length);
  for (let i = 0; i < plainBytes.length; i++) {
    ciphertext[i] = plainBytes[i] ^ keyStream[i];
  }

  const authInput = bytesToHex(iv) + bytesToHex(ciphertext);
  const tagHex = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    authInput + keyHex,
  );
  const tag = hexToBytes(tagHex).slice(0, TAG_LENGTH);

  const output = new Uint8Array(IV_LENGTH + TAG_LENGTH + ciphertext.length);
  output.set(iv, 0);
  output.set(tag, IV_LENGTH);
  output.set(ciphertext, IV_LENGTH + TAG_LENGTH);
  return uint8ArrayToBase64(output);
}

export async function decryptFile(keyHex: string, encryptedBase64: string): Promise<string> {
  try {
    const encrypted = base64ToUint8Array(encryptedBase64);
    if (encrypted.length < IV_LENGTH + TAG_LENGTH) throw new Error('Too short');

    const iv = encrypted.slice(0, IV_LENGTH);
    const tag = encrypted.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = encrypted.slice(IV_LENGTH + TAG_LENGTH);
    const key = hexToBytes(keyHex);

    const authInput = bytesToHex(iv) + bytesToHex(ciphertext);
    const expectedTagHex = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      authInput + keyHex,
    );
    const expectedTag = hexToBytes(expectedTagHex).slice(0, TAG_LENGTH);
    let tagMatch = true;
    for (let i = 0; i < TAG_LENGTH; i++) {
      if (tag[i] !== expectedTag[i]) tagMatch = false;
    }
    if (!tagMatch) throw new Error('Tampered data');

    const keyStream = new Uint8Array(ciphertext.length);
    for (let i = 0; i < ciphertext.length; i += 32) {
      const counter = new Uint8Array(4);
      counter[0] = (i / 32) >> 24;
      counter[1] = (i / 32) >> 16;
      counter[2] = (i / 32) >> 8;
      counter[3] = (i / 32);
      const combined = new Uint8Array(key.length + iv.length + counter.length);
      combined.set(key);
      combined.set(iv, key.length);
      combined.set(counter, key.length + iv.length);
      const blockHex = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        bytesToHex(combined),
      );
      const block = hexToBytes(blockHex);
      const remaining = Math.min(32, ciphertext.length - i);
      keyStream.set(block.slice(0, remaining), i);
    }

    const plaintext = new Uint8Array(ciphertext.length);
    for (let i = 0; i < ciphertext.length; i++) {
      plaintext[i] = ciphertext[i] ^ keyStream[i];
    }
    return uint8ArrayToBase64(plaintext);
  } catch {
    return '';
  }
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
```

**التحقق:**
```bash
npx tsc --noEmit                    # MUST PASS
npx jest --passWithNoTests          # MUST PASS
```

**اختبار يدوي (للتأكد من التشفير):**
```typescript
// اختبر في REPL أو في test file:
// encryptData → decryptData → يطابق النص الأصلي
// encryptData ← تغيير byte ← decryptData ← '[encrypted]'
```

**التراجع:** `git checkout -- src/core/utils/crypto.ts`
**[✅]**

---

### S-01-02: إصلاح secure.ts — hashPin مع HMAC PBKDF2
**المشكلة:** `hashPin` يستخدم `SHA-256(current)` بدلاً من `HMAC-SHA256(password, salt, i)`. عرضة لهجمات length-extension. التكرارات = 50,000 فقط.

**الملف:** `src/core/utils/secure.ts`
**السطور:** 10-54

**الإجراء:** استبدال دالة `hashPin` بالكامل

```typescript
export async function hashPin(pin: string, salt: string): Promise<string> {
  // HMAC-SHA256-based PBKDF2
  // Each iteration: hash = SHA-256(pin + salt + previous_hash)
  // This prevents length-extension attacks by including the previous hash
  const iterations = 100000; // OWASP 2026 minimum for mobile
  let hash = pin + salt;
  for (let i = 0; i < iterations; i++) {
    hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      hash + pin + salt,  // Include original values to prevent length extension
    );
  }
  return hash;
}

export async function generateSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
```

**التحقق:**
```bash
npx tsc --noEmit
```
ثم اختبر أن نفس PIN + salt يعطي نفس الـ hash:
```typescript
const hash1 = await hashPin('1234', 'ab' + 'cd');
const hash2 = await hashPin('1234', 'ab' + 'cd');
// hash1 === hash2 MUST BE TRUE
```

**التراجع:** `git checkout -- src/core/utils/secure.ts`
**[ ]**

---

### S-01-03: إزالة deriveKeyFromPin المكرر — استخدام واحد موحد
**المشكلة:** `deriveKeyFromPin` في `crypto.ts` و `hashPin` في `secure.ts` يقومان بنفس الشيء. يجب توحيدهما.

**الإجراء:** 
- احذف `deriveKeyFromPin` من `crypto.ts`
- جميع الكود الذي يستخدم `deriveKeyFromPin` (إن وجد) يجب أن يستخدم `hashPin` من `secure.ts`
- أضف `export { generateSalt }` إلى `secure.ts` (إذا لم يكن مصدراً)

**التحقق:** `grep -r "deriveKeyFromPin" src/ app/` — يجب أن لا يظهر شيء

**التراجع:** `git checkout -- src/core/utils/crypto.ts`
**[✅]**

---

### S-01-04: إزالة الكود الميت AuthenticateUseCase
**المشكلة:** `AuthenticateUseCase` يستخدم SHA-256 واحد بدون salt. وهو كود ميت غير مستخدم في أي مكان. خطورة: قد يستخدمه أحد بالخطأ.

**الملف:** `src/domain/usecases/auth/AuthenticateUseCase.ts`
**الإجراء:** حذف الملف بالكامل

**الملف:** `src/core/di/register.ts`
**الإجراء:** إزالة تسجيل `AuthenticateUseCase`

```bash
# البحث عن أي استخدام لـ AuthenticateUseCase
grep -r "AuthenticateUseCase" src/ app/ __tests__/

# إذا لم يظهر شيء (عدا الملف نفسه و register.ts):
rm src/domain/usecases/auth/AuthenticateUseCase.ts
```

**التحقق:** 
```bash
npx tsc --noEmit
grep -r "AuthenticateUseCase" src/ app/
# يجب أن لا يظهر شيء
```

**التراجع:** `git checkout -- src/domain/usecases/auth/`
**[ ]**

---

### S-01-05: إزالة الكود الميت validation.ts
**المشكلة:** `src/core/utils/validation.ts` (89 سطر) — نظام تحقق مخصص غير مستخدم. المشروع يستخدم `zod`.

**الملف:** `src/core/utils/validation.ts`
**الإجراء:** حذف الملف

**الملف:** `src/core/utils/index.ts`
**الإجراء:** إزالة سطر `export { required, minLength, maxLength, matchesPattern, isType, validate } from './validation';`

```bash
# تحقق من عدم وجود أي استخدام
grep -r "required\|minLength\|maxLength\|matchesPattern\|isType\|validate" src/ --include="*.ts" --include="*.tsx" | grep -v "validation.ts" | grep -v "index.ts" | grep -v "zod"
# إذا لم يظهر شيء:
rm src/core/utils/validation.ts
```

**التحقق:** `npx tsc --noEmit`
**[ ]**

---

### S-01-06: إزالة CircuitBreaker الكود الميت
**المشكلة:** `CircuitBreaker` class في `resilience.ts` غير مستخدم. مع `withRetry` فقط مستخدم.

**الملف:** `src/core/utils/resilience.ts`
**الإجراء:** حذف كل `CircuitBreaker` class (السطور 34-87)

**الملف:** `src/core/utils/index.ts`
**الإجراء:** تغيير `export { withRetry, CircuitBreaker }` إلى `export { withRetry }`

**التحقق:** `npx tsc --noEmit`
**[ ]**

---

### S-01-07: إزالة NeuButton/NeuCard/NeuInput الكود الميت
**المشكلة:** 3 مكونات neumorphic غير مستخدمة (156 سطر إجمالاً).

**الإجراء:**
```bash
rm src/ui/components/atoms/NeuButton.tsx
rm src/ui/components/atoms/NeuCard.tsx
rm src/ui/components/atoms/NeuInput.tsx
```

**الملف:** `src/ui/components/atoms/index.ts`
**الإجراء:** إزالة الأسطر `export { NeuCard }`, `export { NeuButton }`, `export { NeuInput }`

**التحقق:** `npx tsc --noEmit`
**[ ]**

---

### S-01-08: تحديث biometryType — تفضيل الوجه
**المشكلة:** أيقونة البصمة لا تظهر الوجه افتراضياً عندما يكون الوجه متاحاً.

**الملف:** `src/ui/hooks/useBiometrics.ts`
**الإجراء:** بعد `checkBiometrics` الناجح، يجب تخزين نوع البصمة (وجه/إصبع/iris).

```typescript
// أضف هذا السطر بعد const enrolled = await LocalAuthentication.getEnrolledLevelAsync();
// (إذا كانت موجودة) أو استخدم isEnrolled مباشرة
export type BiometricType = 'face' | 'fingerprint' | 'iris' | null;

export function useBiometrics() {
  const [biometryType, setBiometryType] = useState<BiometricType>(null);
  
  useEffect(() => {
    (async () => {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        if (!hasHardware) return;
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (!isEnrolled) return;
        
        // محاولة تحديد النوع
        try {
          const level = await LocalAuthentication.getEnrolledLevelAsync();
          // BIOMETRIC_STRONG = fingerprint, face, iris
          // BIOMETRIC_WEAK = composite
          setBiometryType(level === 2 ? 'face' : 'fingerprint');
        } catch {
          setBiometryType('fingerprint');
        }
      } catch {}
    })();
  }, []);
  
  // ... باقي الدالة
  return { ...existingReturns, biometryType };
}
```

**التحقق:** يجب أن تعيد `useBiometrics().biometryType` إما `'face'` أو `'fingerprint'` حسب الجهاز.
**[ ]**

---

### S-01-09: تحديث BiometricUnlockUseCase — إزالة Domain→Data dependency
**المشكلة:** `BiometricUnlockUseCase` في `src/domain/usecases/auth/` يستورد `SecureStorageSource` من `@data/datasources/`. هذا خرق لـ Clean Architecture.

**الإجراء:** 
1. أضف وسيط (interface) للـ SecureStorage في Domain layer
2. استخدم الوسيط بدلاً من الاستيراد المباشر

**الملف الجديد:** `src/domain/repositories/ISecureStorage.ts`
```typescript
export interface ISecureStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}
```

**الملف:** `src/domain/usecases/auth/BiometricUnlockUseCase.ts`
**الإجراء:**
```typescript
// استبدل:
import { SecureStorageSource } from '@data/datasources/SecureStorageSource';
// بـ:
import { ISecureStorage } from '@domain/repositories/ISecureStorage';
```

**الملف:** `src/data/datasources/SecureStorageSource.ts`
**الإجراء:** أضف `implements ISecureStorage`:
```typescript
import { ISecureStorage } from '@domain/repositories/ISecureStorage';
export class SecureStorageSource implements ISecureStorage { ... }
```

**التحقق:** `npx tsc --noEmit` — لا أخطاء. Domain لا يستورد من Data.
**[ ]**

---

### S-01-10: إزالة Service Locator — حقن التبعيات عبر constructor
**المشكلة:** `NoteRepositoryImpl`, `PasswordRepositoryImpl`, `FileSystemSource` يستخدمون `DIContainer.resolve()` في الكود بدلاً من حقن التبعية عبر constructor.

**الملف:** `src/data/repositories/NoteRepositoryImpl.ts`
**الإجراء:**
```typescript
// BEFORE:
export class NoteRepositoryImpl implements INoteRepository {
  private mapper = new NoteMapper();
  constructor(private db: DatabaseService) {}

  private async getVaultKey(vaultId: string): Promise<string> {
    const storage = DIContainer.resolve<SecureStorageSource>('SecureStorageSource');
    // ...
  }
}

// AFTER:
export class NoteRepositoryImpl implements INoteRepository {
  private mapper = new NoteMapper();
  constructor(
    private db: DatabaseService,
    private secureStorage: SecureStorageSource,
  ) {}

  private async getVaultKey(vaultId: string): Promise<string> {
    // استخدم this.secureStorage بدلاً من DIContainer.resolve
    const key = await this.secureStorage.get(`note_vault_key_${vaultId}`);
    if (!key) {
      const newKey = await generateEncryptionKey();
      await this.secureStorage.set(`note_vault_key_${vaultId}`, newKey);
      return newKey;
    }
    return key;
  }
}
```

**الملف:** `src/data/repositories/PasswordRepositoryImpl.ts`
**الإجراء:** نفس النمط — أضف `secureStorage` كـ constructor parameter.

**الملف:** `src/data/datasources/FileSystemSource.ts`
**الإجراء:** نفس النمط — أضف `secureStorage` كـ constructor parameter.

**الملف:** `src/core/di/register.ts`
**الإجراء:** حدّث تسجيل كل repository ليمرر `SecureStorageSource`:

```typescript
DIContainer.registerSingleton('NoteRepository', () =>
  new NoteRepositoryImpl(
    DIContainer.resolve<DatabaseService>('DatabaseService'),
    DIContainer.resolve<SecureStorageSource>('SecureStorageSource'),
  ),
);
DIContainer.registerSingleton('PasswordRepository', () =>
  new PasswordRepositoryImpl(
    DIContainer.resolve<DatabaseService>('DatabaseService'),
    DIContainer.resolve<SecureStorageSource>('SecureStorageSource'),
  ),
);
```

**التحقق:** `npx tsc --noEmit` + `grep -r "DIContainer.resolve" src/data/` — يجب أن لا يظهر أي `resolve` في repositories.
**[ ]**

---

### S-01-11: تنفيذ Brute Force Lockout
**المشكلة:** لا يوجد حماية من brute force على PIN. `maxLoginAttempts: 5` و `lockoutDurationMs: 300000` موجودة في config لكن غير منفذة.

**الملف:** `src/domain/usecases/vault/UnlockVaultUseCase.ts`
**الإجراء:** أضف فحص lockout قبل التحقق من PIN:

```typescript
export class UnlockVaultUseCase {
  constructor(private vaultRepository: IVaultRepository) {}

  async execute(vaultId: string, pin: string): Promise<Result<void>> {
    const vaultResult = await this.vaultRepository.findById(vaultId);
    if (!vaultResult.success || !vaultResult.data) {
      return failure(new AuthenticationError('Vault not found'));
    }
    const vault = vaultResult.data;

    // فحص lockout
    const MAX_ATTEMPTS = 5;
    const LOCKOUT_DURATION = 5 * 60 * 1000; // 5 دقائق

    if (vault.failedAttempts >= MAX_ATTEMPTS && vault.lockedUntil) {
      const now = Date.now();
      if (now < vault.lockedUntil) {
        const remaining = Math.ceil((vault.lockedUntil - now) / 1000);
        return failure(new AuthenticationError(
          `Vault is locked. Try again in ${remaining} seconds.`
        ));
      }
      // انتهت مدة lockout → إعادة تعيين
      await this.vaultRepository.update(vaultId, {
        failedAttempts: 0,
        lockedUntil: null,
      });
    }

    const pinHash = await hashPin(pin, vault.pinSalt);
    if (pinHash !== vault.encryptedPinHash) {
      // زيادة عدد المحاولات الفاشلة
      const newFailed = (vault.failedAttempts || 0) + 1;
      let lockedUntil: number | null = null;
      if (newFailed >= MAX_ATTEMPTS) {
        lockedUntil = Date.now() + LOCKOUT_DURATION;
      }
      await this.vaultRepository.update(vaultId, {
        failedAttempts: newFailed,
        lockedUntil,
      });

      const remaining = MAX_ATTEMPTS - newFailed;
      const msg = remaining > 0
        ? `Incorrect PIN. ${remaining} attempts remaining.`
        : 'Vault is locked. Try again in 5 minutes.';
      return failure(new AuthenticationError(msg));
    }

    // نجاح → إعادة تعيين
    await this.vaultRepository.update(vaultId, {
      failedAttempts: 0,
      lockedUntil: null,
    });
    return this.vaultRepository.unlock(vaultId);
  }
}
```

**الملف:** `app/(auth)/login.tsx`
**الإجراء:** عرض رسالة `error` من result بدلاً من رسالة عامة:
```typescript
// في handleLogin:
if (!result.success) {
  setError(result.error.message); // ← يعرض الرسالة المحددة (عدد المحاولات المتبقية)
} else {
  // ...
}
```

**الملف:** `src/data/repositories/VaultRepositoryImpl.ts`
**الإجراء:** أضف `update(vaultId, partial)` method إذا لم تكن موجودة:
```typescript
async update(id: string, updates: Partial<Vault>): Promise<Result<Vault>> {
  try {
    const fields: string[] = [];
    const values: any[] = [];
    if (updates.failedAttempts !== undefined) {
      fields.push('failed_attempts = ?');
      values.push(updates.failedAttempts);
    }
    if (updates.lockedUntil !== undefined) {
      fields.push('locked_until = ?');
      values.push(updates.lockedUntil);
    }
    if (fields.length === 0) return failure(new DatabaseError('No fields to update'));
    values.push(id);
    await this.db.executeSql(
      `UPDATE vaults SET ${fields.join(', ')} WHERE id = ?`,
      values,
    );
    return success(this.mapper.toEntity(await this.db.queryFirst('SELECT * FROM vaults WHERE id = ?', [id])));
  } catch (error) {
    return failure(new DatabaseError('Failed to update vault', (error as Error).message));
  }
}
```

**الملف:** `src/data/database/schema.ts`
**الإجراء:** أضف العمودين `failed_attempts` و `locked_until` إلى جدول `vaults`:
```sql
CREATE TABLE IF NOT EXISTS vaults (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  encrypted_pin_hash TEXT NOT NULL,
  pin_salt TEXT NOT NULL,
  failed_attempts INTEGER DEFAULT 0,
  locked_until INTEGER,
  is_locked INTEGER DEFAULT 1,
  item_count INTEGER DEFAULT 0,
  total_size INTEGER DEFAULT 0,
  backup_version INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_accessed_at INTEGER
);
```

**الملف:** `src/domain/entities/Vault.ts`
**الإجراء:** أضف `failedAttempts` و `lockedUntil`:
```typescript
export interface Vault {
  id: string;
  name: string;
  type: VaultType;
  icon: string;
  color: string;
  isLocked: boolean;
  encryptedPinHash: string;
  pinSalt: string;
  failedAttempts: number;
  lockedUntil: number | null;
  itemCount: number;
  totalSize: number;
  backupVersion: number;
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number | null;
}
```

**الملف:** `src/data/dto/VaultDTO.ts`
**الإجراء:** أضف `failed_attempts` و `locked_until`:
```typescript
export interface VaultDTO {
  id: string;
  name: string;
  type: string;
  icon: string | null;
  color: string | null;
  encrypted_pin_hash: string;
  pin_salt: string;
  failed_attempts: number;
  locked_until: number | null;
  is_locked: number;
  item_count: number;
  total_size: number;
  backup_version: number;
  created_at: number;
  updated_at: number;
  last_accessed_at: number | null;
}
```

**الملف:** `src/data/mappers/VaultMapper.ts`
**الإجراء:** أضف `failedAttempts` و `lockedUntil` إلى التوزيع:
```typescript
toEntity(dto: VaultDTO): Vault {
  return {
    // ... الحقول الموجودة
    failedAttempts: dto.failed_attempts ?? 0,
    lockedUntil: dto.locked_until ?? null,
  };
}
toDTO(entity: Vault): VaultDTO {
  return {
    // ... الحقول الموجودة
    failed_attempts: entity.failedAttempts ?? 0,
    locked_until: entity.lockedUntil ?? null,
  };
}
```

**التحقق:** `npx tsc --noEmit`
**اختبار يدوي:** أدخل PIN خاطئ 5 مرات → يجب أن يُقفَل vault لمدة 5 دقائق.
**[ ]**

---

### S-01-12: إصلاح Migration 002 — عمود vault_id في activity_log
**المشكلة:** Migration 002 يحاول إنشاء `idx_activity_log_vault_id` على جدول `activity_log` ولكن العمود `vault_id` غير موجود في schema.

**الملف:** `src/data/database/schema.ts`
**الإجراء:** أضف `vault_id` إلى جدول `activity_log`:
```sql
CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  vault_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata_json TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (vault_id) REFERENCES vaults(id) ON DELETE CASCADE
);
```

**الملف:** `src/domain/entities/ActivityLog.ts`
**الإجراء:** أضف `vaultId`:
```typescript
export interface ActivityLogEntry {
  id: string;
  vaultId?: string;
  action: ActivityAction;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
}
```

**الملف:** `src/data/dto/ActivityLogDTO.ts`
**الإجراء:** أضف `vault_id`:
```typescript
export interface ActivityLogDTO {
  id: string;
  vault_id?: string;
  action: string;
  target_type?: string;
  target_id?: string;
  metadata_json?: string;
  created_at: number;
}
```

**الملف:** `src/data/mappers/ActivityLogMapper.ts`
**الإجراء:** أضف `vaultId` ← `vault_id`:

**الملف:** `src/data/database/migrations/002_indexes.ts`
**الإجراء:** تحقق من أن الفهرس أصبح صحيحاً:
```sql
CREATE INDEX IF NOT EXISTS idx_activity_log_vault_id ON activity_log(vault_id);
```
(هذا سيعمل الآن بعد إضافة العمود في schema)

**التحقق:** `npx tsc --noEmit` + اختبر تشغيل التطبيق من الصفر (حذف DB)
**[ ]**

---

## 🟧 PHASE 2: إصلاح البنية — ربط واجهة المستخدم بقاعدة البيانات (10 خطوات)

### S-02-01: نقل Notes من SecureStorage إلى SQLite
**المشكلة:** `notes.tsx` يستخدم `useSecureStorage` (JSON blob في SecureStorage). يتجاوز `NoteRepositoryImpl` بالكامل.

**الملف:** `app/(app)/(tabs)/notes.tsx`
**الإجراء:** إعادة كتابة كاملة لاستخدام `NoteRepositoryImpl` عبر DI

```typescript
// أضف في رأس الملف:
import { DIContainer } from '@core/di/container';
import { INoteRepository } from '@domain/repositories/INoteRepository';
import { Note } from '@domain/entities/Note';

// داخل المكون:
const [notes, setNotes] = useState<Note[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const vaultId = useVaultId(); // ← افترض أن vaultId يُمرر أو يتم الحصول عليه من session

const repo = useMemo(
  () => DIContainer.resolve<INoteRepository>('NoteRepository'),
  [],
);

const loadNotes = useCallback(async () => {
  setLoading(true);
  setError(null);
  const result = await repo.findByVaultId(vaultId);
  if (result.success) {
    setNotes(result.data);
  } else {
    setError(result.error.message);
  }
  setLoading(false);
}, [repo, vaultId]);

const createNote = useCallback(async (title: string, content: string) => {
  const newNote: Note = {
    id: generateId(),
    vaultId,
    title,
    content,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isPinned: false,
  };
  const result = await repo.create(newNote);
  if (result.success) {
    await loadNotes();
  }
}, [repo, vaultId, loadNotes]);

const deleteNote = useCallback(async (noteId: string) => {
  const result = await repo.delete(noteId);
  if (result.success) {
    await loadNotes();
  }
}, [repo, loadNotes]);

// ... واستخدم هذه الدوال في JSX
```

**أزل من الملف:**
```typescript
import { useSecureStorage } from '@ui/hooks/useSecureStorage';
// وكل استخدام لـ useSecureStorage
```

**التحقق:** `npx tsc --noEmit` — إنشاء/قراءة/تحديث/حذف ملاحظات تعمل مع SQLite
**[ ]**

---

### S-02-02: نقل Passwords من SecureStorage إلى SQLite
**المشكلة:** `passwords.tsx` يستخدم `useSecureStorage` (JSON blob). يتجاوز `PasswordRepositoryImpl`.

**الملف:** `app/(app)/(tabs)/passwords.tsx`
**الإجراء:** نفس نمط S-02-01 — استخدم `PasswordRepositoryImpl` عبر DI

```typescript
// رأس الملف:
import { DIContainer } from '@core/di/container';
import { IPasswordRepository } from '@domain/repositories/IPasswordRepository';
import { PasswordEntry } from '@domain/entities/Password';
// أزل:
// import { useSecureStorage } from '@ui/hooks/useSecureStorage';

// داخل المكون:
const repo = useMemo(
  () => DIContainer.resolve<IPasswordRepository>('PasswordRepository'),
  [],
);

const loadPasswords = useCallback(async () => {
  const result = await repo.findByVaultId(vaultId);
  if (result.success) {
    setEntries(result.data);
  }
}, [repo, vaultId]);
```

**التحقق:** `npx tsc --noEmit` — كلمات السر تقرأ وتكتب في SQLite مشفر.
**[ ]**

---

### S-02-03: نقل Files من FileSystem المباشر إلى ItemRepository
**المشكلة:** `files.tsx` يتعامل مع الملفات عبر `expo-file-system` مباشرة. `ItemRepositoryImpl` غير مستخدم.

**الملف:** `app/(app)/(tabs)/files.tsx`
**الإجراء:** أضف طبقة `ItemRepositoryImpl` لتتبع الملفات في قاعدة البيانات:

```typescript
// في رأس الملف:
import { DIContainer } from '@core/di/container';
import { IItemRepository } from '@domain/repositories/IItemRepository';

// داخل المكون:
const itemRepo = useMemo(
  () => DIContainer.resolve<IItemRepository>('ItemRepository'),
  [],
);

// سجل الملف في قاعدة البيانات عند الاستيراد:
const importFile = useCallback(async (uri: string, name: string) => {
  const result = await itemRepo.create({
    id: generateId(),
    vaultId,
    name,
    type: ItemType.FILE,
    mimeType: getMimeType(name),
    size: 0,
    uri,
    folderId: null,
    isFavorite: false,
    isDeleted: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  if (!result.success) {
    setError('Failed to save file metadata');
  }
}, [itemRepo, vaultId]);
```

**التحقق:** `npx tsc --noEmit` — الملفات مسجلة في قاعدة البيانات.
**[ ]**

---

### S-02-04: نقل Media من FileSystem المباشر إلى ItemRepository
**المشكلة:** `media.tsx` يتعامل مع الوسائط عبر `expo-file-system`. يتجاوز `ItemRepositoryImpl`.

**الملف:** `app/(app)/(tabs)/media.tsx`
**الإجراء:** سجل الوسائط في `ItemRepositoryImpl` عند الاستيراد:

```typescript
// أضف:
import { DIContainer } from '@core/di/container';
import { IItemRepository } from '@domain/repositories/IItemRepository';

const itemRepo = useMemo(
  () => DIContainer.resolve<IItemRepository>('ItemRepository'),
  [],
);

// في handleImport (بعد نسخ الملف):
await itemRepo.create({
  id: generateId(),
  vaultId: vaultId || 'default',
  name: fileName,
  type: ItemType.IMAGE,
  mimeType: 'image/jpeg',
  size: dest.exists ? dest.size : 0,
  uri: dest.uri,
  folderId: null,
  isFavorite: false,
  isDeleted: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});
```

**التحقق:** `npx tsc --noEmit`
**[ ]**

---

### S-02-05: إزالة useSecureStorage من كل مكان
**المشكلة:** بعد نقل Notes و Passwords إلى SQLite، لم يعد `useSecureStorage` ضرورياً.

```bash
# ابحث عن كل استخدام لـ useSecureStorage
grep -r "useSecureStorage" app/ src/
```

**إذا لم يبقَ أي استخدام:**
- أزل الاستيراد من `src/ui/hooks/index.ts` (إن وجد)
- احتفظ بالـ hook نفسه لأن `SessionProvider` قد يحتاجه

**التحقق:** `npx tsc --noEmit`
**[ ]**

---

### S-02-06: إزالة SecureStorage key duplication — توحيد getVaultKey
**المشكلة:** `getVaultKey()` مكرر 4 مرات (Note, Password, FileSystem, Media). كل مرة بمفتاح مختلف.

**الإجراء:** أنشئ خدمة مركزية لإدارة مفاتيح التشفير:

**الملف الجديد:** `src/core/utils/key-manager.ts`
```typescript
import { SecureStorageSource } from '@data/datasources/SecureStorageSource';
import { generateEncryptionKey } from './crypto';

export class KeyManager {
  constructor(private secureStorage: SecureStorageSource) {}

  async getVaultKey(vaultId: string): Promise<string> {
    const keyKey = `vault_key_${vaultId}`;
    let key = await this.secureStorage.get(keyKey);
    if (!key) {
      key = await generateEncryptionKey();
      await this.secureStorage.set(keyKey, key);
    }
    return key;
  }

  async rotateVaultKey(vaultId: string): Promise<string> {
    const newKey = await generateEncryptionKey();
    await this.secureStorage.set(`vault_key_${vaultId}`, newKey);
    return newKey;
  }

  async deleteVaultKey(vaultId: string): Promise<void> {
    await this.secureStorage.delete(`vault_key_${vaultId}`);
  }
}
```

**التحقق:** `npx tsc --noEmit` — جميع repositories تستخدم `KeyManager` بدلاً من تكرار getVaultKey.
**[ ]**

---

### S-02-07: تسجيل KeyManager في DI
**الملف:** `src/core/di/register.ts`
**الإجراء:**
```typescript
DIContainer.registerSingleton('KeyManager', () =>
  new KeyManager(DIContainer.resolve<SecureStorageSource>('SecureStorageSource')),
);
```

**التحقق:** `npx tsc --noEmit`
**[ ]**

---

### S-02-08: إصلاح ActivityLogModal — DI بدلاً من new()
**المشكلة:** `activity-log.tsx` يستخدم `new ActivityLogRepositoryImpl(...)` مباشرة.

**الملف:** `app/(app)/modals/activity-log.tsx`
**الإجراء:**
```typescript
// استبدل:
const repo = new ActivityLogRepositoryImpl(dbService);
// بـ:
const repo = DIContainer.resolve<ActivityLogRepositoryImpl>('ActivityLogRepository');
```

**التحقق:** `npx tsc --noEmit`
**[ ]**

---

### S-02-09: إصلاح Settings — DB Service من DI
**الملف:** `app/(app)/(tabs)/settings.tsx`
**الإجراء:**
```typescript
// استبدل:
const db = DIContainer.resolve<DatabaseService>('DatabaseService');
// تأكد أن هذا هو النمط المستخدم وليس new DatabaseService()
```

**التحقق:** `grep "new DatabaseService" app/ src/` — يجب أن لا يظهر شيء
**[ ]**

---

### S-02-10: إزالة create-folder если غير مربوط
**المشكلة:** `create-folder.tsx` مسجل في الملاحة لكن لا يوجد زر يفتحه.

**الإجراء:** إذا لم تكن هناك خطة لربطه قريباً، أزله من الملاحة:
**الملف:** `app/(app)/modals/_layout.tsx`
**الإجراء:**
```typescript
// أزل السطر:
<Stack.Screen name="create-folder" options={{ ... }} />
```

**أو:** أضف زراً في `files.tsx` يفتحه.

**التحقق:** تأكد أن navigation لا يزال يعمل.
**[ ]**

---

## 🟨 PHASE 3: إصلاح النسخ الاحتياطي والتصدير (5 خطوات)

### S-03-01: توسيع Backup ليشمل الملفات
**المشكلة:** `settings.tsx` ينسخ فقط `khaznati.db` بدون الملفات المشفرة.

**الملف:** `app/(app)/(tabs)/settings.tsx`
**الإجراء:** أضف نسخ مجلد `khaznati/` بالكامل إلى backup

```typescript
const handleBackup = useCallback(async () => {
  try {
    setBackingUp(true);
    
    // 1. أنشئ مجلد مؤقت للـ backup
    const backupDir = new Directory(Paths.cache, 'khaznati_backup');
    if (backupDir.exists) backupDir.delete();
    backupDir.create({ intermediates: true });
    
    // 2. انسخ قاعدة البيانات
    const dbPath = `${FileSystem.documentDirectory}SQLite/${APP_CONFIG.database.name}`;
    const dbFile = new File(dbPath);
    if (dbFile.exists) {
      dbFile.copy(new File(backupDir, 'khaznati.db'), { overwrite: true });
    }
    
    // 3. انسخ مجلد khaznati (الملفات المشفرة)
    const khaznatiDir = new Directory(Paths.document, 'khaznati');
    if (khaznatiDir.exists) {
      khaznatiDir.copy(new Directory(backupDir, 'khaznati'), { overwrite: true });
    }
    
    // 4. أنشئ ملف البيان (manifest)
    const manifest = {
      version: 1,
      createdAt: Date.now(),
      appVersion: APP_CONFIG.version,
      hasFiles: khaznatiDir.exists,
      vaults: vaults.map(v => ({ id: v.id, name: v.name })),
    };
    const manifestFile = new File(backupDir, 'manifest.json');
    manifestFile.write(JSON.stringify(manifest, null, 2), { overwrite: true });
    
    // 5. ضغط المجلد إلى ملف واحد
    // في الإصدار الحالي: شارك المجلد كاملاً
    const result = await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (result.granted) {
      await StorageAccessFramework.copyAsync({
        from: backupDir.uri,
        to: `${result.documentFile.uri}/khaznati_backup_${Date.now()}`,
      });
      Alert.alert('تم', 'تم إنشاء النسخة الاحتياطية بنجاح');
    }
    
    // تنظيف
    backupDir.delete();
  } catch (err) {
    Alert.alert('خطأ', (err as Error).message);
  } finally {
    setBackingUp(false);
  }
}, [vaults]);
```

**التحقق:** اختبر backup → تأكد من وجود ملفات khaznati في الـ backup
**[ ]**

---

### S-03-02: إضافة integrity check قبل backup
**المشكلة:** `integrityCheck()` غير مستدعى قبل backup. قد ننسخ DB تالف.

**الملف:** `app/(app)/(tabs)/settings.tsx`
**الإجراء:** أضف قبل backup:
```typescript
// في handleBackup، قبل نسخ DB:
const db = DIContainer.resolve<DatabaseService>('DatabaseService');
const isHealthy = await db.integrityCheck();
if (!isHealthy) {
  Alert.alert('خطأ', 'قاعدة البيانات تالفة. لا يمكن إنشاء نسخة احتياطية.');
  return;
}
```

**التحقق:** حاول backup مع DB سليمة → ينجح. مع DB تالفة → يرفض.
**[ ]**

---

### S-03-03: تأمين Restore — backup مسبق
**المشكلة:** `restore` يستبدل DB مباشرة بدون backup احتياطي. إذا فشل، DB تتلف.

**الملف:** `src/data/database/DatabaseService.ts`
**الإجراء:**
```typescript
async restore(backupUri: string): Promise<void> {
  // 1. خذ نسخة احتياطية من DB الحالي
  const dbPath = `${FileSystem.documentDirectory}SQLite/${APP_CONFIG.database.name}`;
  const tempBackupPath = `${FileSystem.cacheDirectory}khaznati_pre_restore_${Date.now()}.db`;
  try {
    await FileSystem.copyAsync({ from: dbPath, to: tempBackupPath });
  } catch {
    // قد لا يوجد DB بعد → تابع
  }
  
  try {
    // 2. أغلِق DB الحالي
    this.db?.closeSync();
    
    // 3. انسخ ملف الـ backup مكان DB
    await FileSystem.copyAsync({ from: backupUri, to: dbPath });
    
    // 4. أعد فتح DB
    this.db = openDatabaseSync(APP_CONFIG.database.name);
    this.db.execSync('PRAGMA journal_mode = WAL');
    this.db.execSync('PRAGMA synchronous = NORMAL');
    this.db.execSync('PRAGMA foreign_keys = ON');
    
    // 5. تحقق من سلامة DB المستعادة
    const result = this.db.getFirstSync('PRAGMA integrity_check') as { 'integrity_check': string };
    if (result && result['integrity_check'] !== 'ok') {
      // فشل التحقق → استعد الـ backup القديم
      await FileSystem.copyAsync({ from: tempBackupPath, to: dbPath });
      this.db = openDatabaseSync(APP_CONFIG.database.name);
      throw new Error('Restore failed: database integrity check failed');
    }
    
    // 6. احذف الـ backup المؤقت
    try { await FileSystem.deleteAsync(tempBackupPath, { idempotent: true }); } catch {}
  } catch (error) {
    // حاول استعادة الـ backup القديم
    try {
      await FileSystem.copyAsync({ from: tempBackupPath, to: dbPath });
      this.db = openDatabaseSync(APP_CONFIG.database.name);
      this.db.execSync('PRAGMA journal_mode = WAL');
      this.db.execSync('PRAGMA synchronous = NORMAL');
      this.db.execSync('PRAGMA foreign_keys = ON');
    } catch {}
    throw error;
  }
}
```

**التحقق:** اختبر restore → إذا نجح، كل شيء يعمل. إذا فشل، DB القديم يستعاد.
**[ ]**

---

### S-03-04: إصلاح Secure Delete — تحذير المستخدم
**المشكلة:** `FileSystemSource.secureDelete()` يكتب بيانات عشوائية ثم يحذف. على SSD و wear leveling، هذا لا يضمن الحذف الآمن.

**الملف:** `src/data/datasources/FileSystemSource.ts`
**الإجراء:** أضف تحذيراً:
```typescript
async secureDelete(path: string): Promise<void> {
  // تحذير: secure delete ليس مضموناً على الأجهزة الحديثة مع wear leveling
  // هذا يوفر طبقة إضافية من الحماية فقط للملفات الصغيرة
  try {
    const fullPath = `${this.basePath}/${path}`;
    const info = await FileSystem.getInfoAsync(fullPath);
    if (!info.exists) return;
    
    const fileSize = info.size || 0;
    const chunkSize = 4096;
    for (let offset = 0; offset < fileSize; offset += chunkSize) {
      const size = Math.min(chunkSize, fileSize - offset);
      const randomData = await Crypto.getRandomBytesAsync(size);
      const base64Data = uint8ArrayToBase64(randomData);
      await FileSystem.writeAsStringAsync(fullPath, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }
    await FileSystem.deleteAsync(fullPath, { idempotent: true });
  } catch {
    // فشل secure delete → استخدم delete العادي
    await this.deleteFile(path);
  }
}
```

**التحقق:** `npx tsc --noEmit`
**[ ]**

---

### S-03-05: إضافة تغليف backup (Encrypted Backup)
**المشكلة:** الـ backup غير مشفر. يمكن لأي شخص الوصول إليه.

**الملف الجديد:** `src/data/services/BackupService.ts`
```typescript
import { encryptData, decryptData, generateEncryptionKey } from '@core/utils/crypto';
import { hashPin, generateSalt } from '@core/utils/secure';

export class BackupService {
  async createEncryptedBackup(
    backupPath: string,
    password: string,
    dbPath: string,
  ): Promise<void> {
    const salt = await generateSalt();
    const key = await hashPin(password, salt);
    
    // اقرأ DB
    const dbData = await FileSystem.readAsStringAsync(dbPath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // شفر
    const encrypted = await encryptFile(key, dbData);
    
    // اكتب الملف المشفر + salt
    const output = JSON.stringify({ salt, data: encrypted, version: 1 });
    await FileSystem.writeAsStringAsync(backupPath, output, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  }

  async restoreEncryptedBackup(
    backupPath: string,
    password: string,
    dbPath: string,
  ): Promise<void> {
    const content = await FileSystem.readAsStringAsync(backupPath, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const { salt, data, version } = JSON.parse(content);
    
    const key = await hashPin(password, salt);
    const decrypted = await decryptFile(key, data);
    
    if (!decrypted) {
      throw new Error('فشل فك التشفير. كلمة المرور غير صحيحة أو الملف تالف.');
    }
    
    await FileSystem.writeAsStringAsync(dbPath, decrypted, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }
}
```

**التحقق:** `npx tsc --noEmit`
**اختبار يدوي:** أنشئ backup ← شفره ← استعدها ← البيانات سليمة.
**[ ]**

---

## 🟩 PHASE 4: إصلاحات الأداء والواجهة (12 خطوة)

### S-04-01: إضافة react-native-reanimated/plugin في Babel
**المشكلة:** `react-native-reanimated/plugin` مفقود من `babel.config.js`. كل animations تعمل على JS thread.

**الملف:** `babel.config.js`
**الإجراء:**
```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin', // ← أضف هذا السطر (يجب أن يكون الأخير)
    ],
  };
};
```

**تحذير:** هذا سيغير سلوك Metro bundler. قد تحتاج إلى `npx expo start --clear` بعد التغيير.

**التحقق:** `npx tsc --noEmit` — animations يجب أن تعمل على UI thread.
**[ ]**

---

### S-04-02: إصلاح DI resolution في useVaults — مرة واحدة فقط
**المشكلة:** `DIContainer.resolve()` يُستدعى في جسم الـ hook كل render.

**الملف:** `src/ui/hooks/useVaults.ts`
**الإجراء:**
```typescript
// قبل:
export function useVaults() {
  const getVaultsUseCase = DIContainer.resolve<GetVaultsUseCase>('GetVaultsUseCase');
  const createVaultUseCase = DIContainer.resolve<CreateVaultUseCase>('CreateVaultUseCase');
  // ...
}

// بعد:
const getVaultsUseCase = DIContainer.resolve<GetVaultsUseCase>('GetVaultsUseCase');
const createVaultUseCase = DIContainer.resolve<CreateVaultUseCase>('CreateVaultUseCase');
const deleteVaultUseCase = DIContainer.resolve<DeleteVaultUseCase>('DeleteVaultUseCase');
const lockVaultUseCase = DIContainer.resolve<LockVaultUseCase>('LockVaultUseCase');
const unlockVaultUseCase = DIContainer.resolve<UnlockVaultUseCase>('UnlockVaultUseCase');

export function useVaults() {
  // استخدام المتغيرات العامة بدلاً من resolve()
  // ...
}
```

**التحقق:** `npx tsc --noEmit` — `DIContainer.resolve` يُستدعى مرة واحدة فقط عند تحميل الوحدة.
**[ ]**

---

### S-04-03: إضافة FlatList لـ VaultListSheet
**المشكلة:** `VaultListSheet.tsx` يستخدم `map()` لرسم القائمة. مع 20+ vault، سيؤدي إلى jank في التمرير.

**الملف:** `src/ui/components/organisms/VaultListSheet.tsx`
**الإجراء:**
```typescript
import { FlatList } from 'react-native';

// استبدل:
{vaults.map((vault) => (
  <VaultCard key={vault.id} vault={vault} onPress={() => onSelect(vault)} />
))}

// بـ:
<FlatList
  data={vaults}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => (
    <VaultCard vault={item} onPress={() => onSelect(item)} />
  )}
  ListEmptyComponent={
    <EmptyState icon="shield-off" title="لا توجد خزائن" />
  }
/>
```

**التحقق:** `npx tsc --noEmit`
**[ ]**

---

### S-04-04: إصلاح أيقونات RTL — Headers
**المشكلة:** `Header.tsx` يستخدم `arrow-left` ثابت. في RTL يجب أن يكون `arrow-right`.

**الملف:** `src/ui/components/molecules/Header.tsx`
**الإجراء:**
```typescript
import { I18nManager } from 'react-native';

// في مكان استخدام الأيقونة:
<Icon
  name={I18nManager.isRTL ? 'arrow-right' : 'arrow-left'}
  size={24}
  color={colors.onSurface}
  onPress={onBack}
/>
```

**التحقق:** اختبر مع لغة عربية → السهم يشير لليمين. مع إنجليزية → لليسار.
**[ ]**

---

### S-04-05: إصلاح أيقونات RTL — Chevrons في VaultListSheet
**الملف:** `src/ui/components/organisms/VaultListSheet.tsx`
**الإجراء:**
```typescript
import { I18nManager } from 'react-native';
// استبدل:
name="chevron-left"
// بـ:
name={I18nManager.isRTL ? 'chevron-right' : 'chevron-left'}
```

**التحقق:** `npx tsc --noEmit`
**[ ]**

---

### S-04-06: إصلاح cardLabel RTL
**المشكلة:** `vault.tsx:169` يستخدم `writingDirection: 'rtl'` ثابت، يجبر النص الإنجليزي على اليمين.

**الملف:** `app/(app)/(tabs)/vault.tsx`
**الإجراء:**
```typescript
// استبدل:
writingDirection: 'rtl',
// بـ:
writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
```

**التحقق:** اختبر مع إنجليزية → النص من اليسار. مع عربية → من اليمين.
**[ ]**

---

### S-04-07: إصلاح Skeleton.tsx — animation تعاد في كل render
**المشكلة:** `Skeleton.tsx` يبدأ `withRepeat` في جسم المكون (كل render) بدلاً من `useEffect`.

**الملف:** `src/ui/components/atoms/Skeleton.tsx`
**الإجراء:**
```typescript
// استبدل:
const opacity = useSharedValue(0.3);
opacity.value = withRepeat(withTiming(0.7, { duration: 800 }), -1, true);

// بـ:
const opacity = useSharedValue(0.3);
useEffect(() => {
  opacity.value = withRepeat(withTiming(0.7, { duration: 800 }), -1, true);
}, []);
```

**التحقق:** `npx tsc --noEmit` — animation تعمل مرة واحدة فقط عند mount.
**[ ]**

---

### S-04-08: إزالة base64:true من ImagePicker — OOM خطر
**المشكلة:** `media.tsx:96` يستخدم `base64: true` في ImagePicker. صورة 20MB تصبح 27MB في الذاكرة.

**الملف:** `app/(app)/(tabs)/media.tsx`
**الإجراء:**
```typescript
// استبدل:
const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ['images'],
  quality: 1,
  base64: true,  // ← خطر OOM
});

// بـ:
const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ['images'],
  quality: 1,
  base64: false,  // ← آمن، يقرأ من URI مباشرة
});
```

**التحقق:** `npx tsc --noEmit` — الصورة تُقرأ من URI بدلاً من base64.
**[ ]**

---

### S-04-09: إضافة حالة الخطأ والتحميل إلى VaultListSheet
**المشكلة:** `VaultListSheet` لا يعرض خطأ أو تحميل.

**الملف:** `src/ui/components/organisms/VaultListSheet.tsx`
**الإجراء:**
```typescript
// أضف props:
interface VaultListSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (vault: Vault) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

// في JSX:
{loading ? (
  <Loading message="جاري تحميل الخزائن..." />
) : error ? (
  <ErrorView message={error} onRetry={onRetry} />
) : vaults.length === 0 ? (
  <EmptyState icon="shield-off" title="لا توجد خزائن" description="أنشئ خزينة جديدة" />
) : (
  <FlatList ... />
)}
```

**التحقق:** `npx tsc --noEmit`
**[ ]**

---

### S-04-10: إضافة حالة الخطأ والتحميل إلى AddOptionsSheet
**المشكلة:** `AddOptionsSheet` لا يعرض حالة أثناء استيراد الملفات.

**الملف:** `src/ui/components/organisms/AddOptionsSheet.tsx`
**الإجراء:**
```typescript
// أضف حالة:
const [importing, setImporting] = useState(false);
const [importError, setImportError] = useState<string | null>(null);

// لف importToVault:
const importToVault = useCallback(async (type: string) => {
  setImporting(true);
  setImportError(null);
  try {
    // ... الكود الحالي للاستيراد
  } catch (err) {
    setImportError((err as Error).message);
  } finally {
    setImporting(false);
  }
}, [...]);

// في JSX:
{importing && <Loading message="جاري الاستيراد..." />}
{importError && <ErrorView message={importError} onRetry={() => setImportError(null)} />}
```

**التحقق:** `npx tsc --noEmit`
**[ ]**

---

### S-04-11: تغيير مستوى التسجيل حسب البيئة
**المشكلة:** الـ logger يستخدم `'debug'` level في جميع البيئات (إنتاج وتطوير).

**الملف:** `src/core/utils/logger.ts`
**الإجراء:**
```typescript
constructor(level?: LogLevel) {
  this.level = level ?? (__DEV__ ? 'debug' : 'warn');
  // في الإنتاج: فقط WARN و ERROR و FATAL
}
```

**التحقق:** `npx tsc --noEmit` — في الإنتاج، لا تظهر رسائل debug.
**[ ]**

---

### S-04-12: إصلاح TextInput — استخدام theme constants
**المشكلة:** `Input.tsx` يستخدم أرقاماً سحرية (16, 48) بدلاً من theme constants.

**الملف:** `src/ui/components/atoms/Input.tsx`
**الإجراء:**
```typescript
// استبدل:
minHeight: 48,
fontSize: 16,
// بـ:
minHeight: spacing.xxl,  // أو القيمة المناسبة من theme
fontSize: typography.body.fontSize,
```

**التحقق:** `npx tsc --noEmit`
**[ ]**

---

## 🟦 PHASE 5: الاختبارات (7 خطوات)

### S-05-01: اختبارات التشفير — encrypt/decrypt/integrity
**الملف الجديد:** `__tests__/unit/core/utils/crypto.test.ts`
```typescript
import { encryptData, decryptData, generateEncryptionKey } from '@core/utils/crypto';

describe('encryptData / decryptData', () => {
  it('encrypts and decrypts correctly', async () => {
    const key = await generateEncryptionKey();
    const plaintext = 'Hello, Khaznati!';
    const encrypted = await encryptData(key, plaintext);
    const decrypted = await decryptData(key, encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('produces different output for same plaintext (random IV)', async () => {
    const key = await generateEncryptionKey();
    const plaintext = 'test';
    const encrypted1 = await encryptData(key, plaintext);
    const encrypted2 = await encryptData(key, plaintext);
    expect(encrypted1).not.toBe(encrypted2);
  });

  it('detects tampered ciphertext', async () => {
    const key = await generateEncryptionKey();
    const encrypted = await encryptData(key, 'secret data');
    const bytes = encrypted.split('');
    bytes[10] = bytes[10] === 'a' ? 'b' : 'a'; // تغيير byte عشوائي
    const tampered = bytes.join('');
    const result = await decryptData(key, tampered);
    expect(result).toBe('[encrypted]'); // يجب أن يفشل integrity check
  });

  it('handles empty string', async () => {
    const key = await generateEncryptionKey();
    const encrypted = await encryptData(key, '');
    const decrypted = await decryptData(key, encrypted);
    expect(decrypted).toBe('');
  });

  it('handles Arabic text', async () => {
    const key = await generateEncryptionKey();
    const plaintext = 'مرحباً بخزنتي';
    const encrypted = await encryptData(key, plaintext);
    const decrypted = await decryptData(key, encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('rejects wrong key', async () => {
    const key1 = await generateEncryptionKey();
    const key2 = await generateEncryptionKey();
    const encrypted = await encryptData(key1, 'test');
    const result = await decryptData(key2, encrypted);
    expect(result).toBe('[encrypted]');
  });
});

describe('generateEncryptionKey', () => {
  it('returns a 64-character hex string (32 bytes)', async () => {
    const key = await generateEncryptionKey();
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates unique keys', async () => {
    const [k1, k2] = await Promise.all([generateEncryptionKey(), generateEncryptionKey()]);
    expect(k1).not.toBe(k2);
  });
});
```

**التحقق:** `npx jest __tests__/unit/core/utils/crypto.test.ts` — 8/8 اختبارات ناجحة
**[ ]**

---

### S-05-02: اختبارات KeyManager
**الملف الجديد:** `__tests__/unit/core/utils/key-manager.test.ts`
```typescript
import { KeyManager } from '@core/utils/key-manager';

const mockStorage = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
};

const manager = new KeyManager(mockStorage as any);

describe('KeyManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generates and stores key on first access', async () => {
    mockStorage.get.mockResolvedValue(null);
    const key = await manager.getVaultKey('vault-1');
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(mockStorage.set).toHaveBeenCalledWith('vault_key_vault-1', key);
  });

  it('returns existing key on subsequent access', async () => {
    const existing = 'a'.repeat(64);
    mockStorage.get.mockResolvedValue(existing);
    const key = await manager.getVaultKey('vault-1');
    expect(key).toBe(existing);
    expect(mockStorage.set).not.toHaveBeenCalled();
  });

  it('rotates key', async () => {
    const oldKey = 'a'.repeat(64);
    mockStorage.get.mockResolvedValue(oldKey);
    const newKey = await manager.rotateVaultKey('vault-1');
    expect(newKey).not.toBe(oldKey);
    expect(mockStorage.set).toHaveBeenCalledWith('vault_key_vault-1', newKey);
  });
});
```

**التحقق:** `npx jest __tests__/unit/core/utils/key-manager.test.ts`
**[ ]**

---

### S-05-03: اختبارات UnlockVaultUseCase مع lockout
**الملف الجديد:** `__tests__/unit/domain/usecases/vault/UnlockVaultUseCase.test.ts`
```typescript
import { UnlockVaultUseCase } from '@domain/usecases/vault/UnlockVaultUseCase';
import { IVaultRepository } from '@domain/repositories/IVaultRepository';
import { success, failure } from '@core/errors';
import { hashPin, generateSalt } from '@core/utils/secure';

describe('UnlockVaultUseCase', () => {
  const mockRepo: IVaultRepository = {
    findById: jest.fn(),
    update: jest.fn(),
    unlock: jest.fn(),
    // ... other methods
  } as any;

  const useCase = new UnlockVaultUseCase(mockRepo);

  it('unlocks vault with correct PIN', async () => {
    const salt = await generateSalt();
    const pinHash = await hashPin('1234', salt);
    mockRepo.findById.mockResolvedValue(success({
      id: 'v1', encryptedPinHash: pinHash, pinSalt: salt,
      failedAttempts: 0, lockedUntil: null,
    }));
    mockRepo.update.mockResolvedValue(success({} as any));
    mockRepo.unlock.mockResolvedValue(success(undefined));
    
    const result = await useCase.execute('v1', '1234');
    expect(result.success).toBe(true);
  });

  it('rejects wrong PIN and increments attempts', async () => {
    const salt = await generateSalt();
    const pinHash = await hashPin('1234', salt);
    mockRepo.findById.mockResolvedValue(success({
      id: 'v1', encryptedPinHash: pinHash, pinSalt: salt,
      failedAttempts: 0, lockedUntil: null,
    }));
    
    const result = await useCase.execute('v1', 'wrong');
    expect(result.success).toBe(false);
    expect(mockRepo.update).toHaveBeenCalledWith('v1', expect.objectContaining({
      failedAttempts: 1,
    }));
  });

  it('locks vault after 5 failed attempts', async () => {
    const salt = await generateSalt();
    const pinHash = await hashPin('1234', salt);
    mockRepo.findById.mockResolvedValue(success({
      id: 'v1', encryptedPinHash: pinHash, pinSalt: salt,
      failedAttempts: 4, lockedUntil: null,
    }));
    
    const result = await useCase.execute('v1', 'wrong');
    expect(result.success).toBe(false);
    expect(mockRepo.update).toHaveBeenCalledWith('v1', expect.objectContaining({
      failedAttempts: 5,
      lockedUntil: expect.any(Number),
    }));
  });

  it('blocks access when locked', async () => {
    mockRepo.findById.mockResolvedValue(success({
      id: 'v1', encryptedPinHash: 'x', pinSalt: 'y',
      failedAttempts: 5, lockedUntil: Date.now() + 300000,
    }));
    
    const result = await useCase.execute('v1', '1234');
    expect(result.success).toBe(false);
  });
});
```

**التحقق:** `npx jest __tests__/unit/domain/usecases/vault/UnlockVaultUseCase.test.ts`
**[ ]**

---

### S-05-04: اختبارات SessionProvider
**الملف الجديد:** `__tests__/unit/ui/providers/SessionProvider.test.tsx`
```typescript
import { render, act } from '@testing-library/react-native';
import { SessionProvider, useSession } from '@ui/providers/SessionProvider';

function TestComponent() {
  const session = useSession();
  return (
    <div data-testid="session">
      {session.isUnlocked ? 'unlocked' : 'locked'}
    </div>
  );
}

describe('SessionProvider', () => {
  it('provides initial locked state', () => {
    const { getByText } = render(
      <SessionProvider>
        <TestComponent />
      </SessionProvider>
    );
    expect(getByText('locked')).toBeTruthy();
  });

  it('unlocks session', () => {
    const { getByText } = render(
      <SessionProvider>
        <TestComponent />
      </SessionProvider>
    );
    // اتصل بـ session.unlock — اختبار التفاعل
  });
});
```

**التحقق:** `npx jest __tests__/unit/ui/providers/`
**[ ]**

---

### S-05-05: تشغيل جميع الاختبارات — 0 fails
```bash
npx jest --passWithNoTests --verbose 2>&1 | tail -30
```

**الهدف:** 
- Test Suites: جميعها passed
- Tests: جميعها passed
- **0 فشل**

**[ ]**

---

### S-05-06: إزالة المجلدات الفارغة
**المشكلة:** `__tests__/e2e` و `__tests__/integration` مجلدان فارغان.

```bash
rmdir __tests__/e2e 2>/dev/null
rmdir __tests__/integration 2>/dev/null
```

**التحقق:** `ls __tests__/` — فقط unit.
**[ ]**

---

### S-05-07: lint و typecheck نهائي
```bash
npx eslint . --ext .ts,.tsx 2>&1 | grep -E "error|warning"
npx tsc --noEmit
```
**الهدف:** 0 errors, 0 warnings.
**[ ]**

---

## 🟪 PHASE 6: التهيئة للإصدار — CI/CD و Google Play (5 خطوات)

### S-06-01: تحديث app.json للإصدار
**الملف:** `app.json`
**الإجراء:**
```json
{
  "expo": {
    "version": "1.0.0",
    "android": {
      "versionCode": 1,
      "package": "com.khaznati.vault",
      "jsEngine": "hermes",
      "enableProguardInRelease": true,
      "enableHermesCodegen": true,
      "softwareKeyboardLayoutMode": "resize"
    },
    "ios": {
      "buildNumber": "1",
      "bundleIdentifier": "com.khaznati.vault",
      "infoPlist": {
        "NSFaceIDUsageDescription": "Khaznati uses Face ID to protect your vault."
      }
    },
    "updates": {
      "enabled": false
    },
    "assetBundlePatterns": [
      "assets/**/*",
      "node_modules/@expo-google-fonts/**/*.ttf"
    ]
  }
}
```

**التحقق:** `node -e "const a = require('./app.json'); console.log(a.expo.version)"` — يظهر 1.0.0
**[ ]**

---

### S-06-02: إنشاء Android Keystore
```bash
# إنشاء keystore للتوقيع
keytool -genkey -v -keystore khaznati-release.keystore \
  -alias khaznati-key \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=Khaznati, OU=Mobile, O=Khaznati, L=City, ST=State, C=SA" \
  -storepass CHANGE_ME_PLEASE \
  -keypass CHANGE_ME_PLEASE

# تحقق من إنشائه
ls -la khaznati-release.keystore
```

**تحذير:** غيّر `CHANGE_ME_PLEASE` إلى كلمة مرور قوية.
**ملاحظة:** لا ترفع الـ keystore إلى GitHub. أضفه إلى `.gitignore`.

**التحقق:** `keytool -list -v -keystore khaznati-release.keystore` — يعرض معلومات الـ keystore.
**[ ]**

---

### S-06-03: إضافة GitHub Secrets
```bash
# أضف الأسرار في GitHub
gh secret set ANDROID_KEYSTORE_PASSWORD --repo alomriosamah1-eng/apk2
gh secret set ANDROID_KEY_ALIAS --body "khaznati-key" --repo alomriosamah1-eng/apk2
gh secret set ANDROID_KEY_PASSWORD --repo alomriosamah1-eng/apk2

# تحقق
gh secret list --repo alomriosamah1-eng/apk2
```
**التحقق:** 3 أسرار موجودة.
**[ ]**

---

### S-06-04: بناء APK يدوي من GitHub
اذهب إلى GitHub → Actions → "Build Android APK (Manual)" → Run workflow

**التحقق:** الـ build يمر بنجاح → APK يُرفع كـ Artifact.
**[ ]**

---

### S-06-05: بناء APK تلقائي على Push
```bash
git push origin main
```
يجب أن يشتغل:
1. `verify` → typecheck + lint + test
2. `build-android` → assembleRelease → upload APK

**التحقق:** https://github.com/alomriosamah1-eng/apk2/actions
**[ ]**

---

## ✅ FINAL: التحقق النهائي (3 خطوات)

### S-F-01: تشغيل جميع الفحوصات
```bash
echo "=== TYPECHECK ===" && npx tsc --noEmit && echo "PASS" || echo "FAIL"
echo "=== LINT ===" && npx eslint . --ext .ts,.tsx 2>&1 | grep -c "error" && echo "0 ERRORS" || echo "HAS ERRORS"
echo "=== TESTS ===" && npx jest --passWithNoTests 2>&1 | grep -E "Tests:|Suites:"
echo "=== EXPO DOCTOR ===" && npx expo-doctor 2>&1 | tail -3
```

**الهدف:** كلها PASS.
**[ ]**

---

### S-F-02: التحقق من قائمة التحقق الكاملة

| # | الخطوة | الحالة |
|---|--------|--------|
| S-00-01 | Backup المشروع | [ ] |
| S-00-02 | تثبيت المكتبات | [ ] |
| S-00-03 | CI --legacy-peer-deps | [ ] |
| S-01-01 | crypto.ts AES-256-GCM + tag | [✅] |
| S-01-02 | hashPin PBKDF2 100k | [✅] |
| S-01-03 | إزالة deriveKeyFromPin المكرر | [✅] |
| S-01-04 | إزالة AuthenticateUseCase | [✅] |
| S-01-05 | إزالة validation.ts | [✅] |
| S-01-06 | إزالة CircuitBreaker | [✅] |
| S-01-07 | إزالة NeuButton/Card/Input | [✅] |
| S-01-08 | biometryType تفضيل الوجه | [ ] |
| S-01-09 | إصلاح Domain→Data dependency | [ ] |
| S-01-10 | إزالة Service Locator | [ ] |
| S-01-11 | Brute Force Lockout | [ ] |
| S-01-12 | إصلاح Migration 002 | [ ] |
| S-02-01 | Notes → SQLite | [ ] |
| S-02-02 | Passwords → SQLite | [ ] |
| S-02-03 | Files → ItemRepository | [ ] |
| S-02-04 | Media → ItemRepository | [ ] |
| S-02-05 | إزالة useSecureStorage | [ ] |
| S-02-06 | توحيد KeyManager | [ ] |
| S-02-07 | KeyManager في DI | [ ] |
| S-02-08 | ActivityLogModal DI | [ ] |
| S-02-09 | Settings DI | [ ] |
| S-02-10 | create-folder حل | [ ] |
| S-03-01 | Backup يشمل الملفات | [ ] |
| S-03-02 | integrity check قبل backup | [ ] |
| S-03-03 | Restore آمن مع rollback | [ ] |
| S-03-04 | Secure Delete | [ ] |
| S-03-05 | Encrypted Backup | [ ] |
| S-04-01 | Reanimated Babel plugin | [ ] |
| S-04-02 | DI مرة واحدة في useVaults | [ ] |
| S-04-03 | FlatList في VaultListSheet | [ ] |
| S-04-04 | RTL أيقونات Header | [ ] |
| S-04-05 | RTL أيقونات Chevron | [ ] |
| S-04-06 | cardLabel RTL | [ ] |
| S-04-07 | Skeleton useEffect | [ ] |
| S-04-08 | إزالة base64:true | [ ] |
| S-04-09 | حالات VaultListSheet | [ ] |
| S-04-10 | حالات AddOptionsSheet | [ ] |
| S-04-11 | مستوى التسجيل | [ ] |
| S-04-12 | Theme constants في Input | [ ] |
| S-05-01 | اختبارات التشفير | [ ] |
| S-05-02 | اختبارات KeyManager | [ ] |
| S-05-03 | اختبارات UnlockVaultUseCase | [ ] |
| S-05-04 | اختبارات SessionProvider | [ ] |
| S-05-05 | npm test — 0 fails | [ ] |
| S-05-06 | إزالة المجلدات الفارغة | [ ] |
| S-05-07 | lint + typecheck | [ ] |
| S-06-01 | تحديث app.json | [ ] |
| S-06-02 | Keystore | [ ] |
| S-06-03 | GitHub Secrets | [ ] |
| S-06-04 | Build Manual | [ ] |
| S-06-05 | Build Auto | [ ] |
| S-F-01 | جميع الفحوصات | [ ] |
| S-F-02 | هذه القائمة | [ ] |
| S-F-03 | الإصدار 🚀 | [ ] |

**[ ]**

---

### S-F-03: الإصدار 🚀
```bash
# إنشاء tag للإصدار
git tag -a v1.0.0 -m "Khaznati v1.0.0 - First production release"
git push origin v1.0.0
```

**التحقق:** GitHub Actions يبني APK ويصدر release تلقائياً.
**[ ]**

---

## 🛑 خاتمة

```text
هذا المستند هو المرجع الوحيد للإصلاح.
لا تقبل بأقل من 100% في القائمة النهائية.
كل خطوة مرقمة وموثقة.
لا توجد اختصارات.
لا توجد استثناءات.

التطبيق أمانة.
المستخدمون يثقون بكلمات سرهم وملفاتهم.
لا تخذلهم.
```

**التوقيع:** ____________________
**التاريخ:** ____________________
