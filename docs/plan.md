# خطة الإصلاح والإكمال الشاملة لمشروع Khaznati

**تاريخ التحديث:** 2026-07-27  
**الحالة:** قيد التنفيذ  
**النسخة المستهدفة:** 1.0.0

---

## فهرس

1. [المرحلة 1: إصلاح الأعطال الحرجة](#المرحلة-1-إصلاح-الأعطال-الحرجة)
2. [المرحلة 2: البصمة = وجه وليس إصبع](#المرحلة-2-البصمة--وجه-وليس-إصبع)
3. [المرحلة 3: إصلاح ميزات Settings الناقصة](#المرحلة-3-إصلاح-ميزات-settings-الناقصة)
4. [المرحلة 4: إضافة تشفير الملفات وقاعدة البيانات](#المرحلة-4-إضافة-تشفير-الملفات-وقاعدة-البيانات)
5. [المرحلة 5: إدارة الجلسة و Auto-Lock](#المرحلة-5-إدارة-الجلسة-و-auto-lock)
6. [المرحلة 6: إكمال الشاشات الناقصة](#المرحلة-6-إكمال-الشاشات-الناقصة)
7. [المرحلة 7: CI/CD — بناء APK ناجح](#المرحلة-7-cicd--بناء-apk-ناجح)
8. [المرحلة 8: اختبارات وتحسين نهائي](#المرحلة-8-اختبارات-وتحسين-نهائي)
9. [الجدول الزمني](#الجدول-الزمني)
10. [الملخص النهائي](#الملخص-النهائي)

---

## المرحلة 1: إصلاح الأعطال الحرجة

**المدة:** يوم واحد | **الأولوية:** 🔴 قصوى

### 1.1 البصمة تفشل لأنها ترسل PIN فارغ

**الملفات المتأثرة:**
- `app/(auth)/login.tsx:63`
- `src/domain/usecases/vault/UnlockVaultUseCase.ts`

**المشكلة:**  
عند تسجيل الدخول بالبصمة، يتم استدعاء `unlockVault(targetVault.id, '')` مع PIN فارغ.  
`UnlockVaultUseCase` يقوم بعمل hash للـ PIN الفارغ ومقارنته مع الـ hash المخزن — ولن يتطابق أبداً.

**الحل:**

1. إنشاء `BiometricUnlockUseCase` جديد:

```typescript
// src/domain/usecases/auth/BiometricUnlockUseCase.ts
export class BiometricUnlockUseCase {
  constructor(
    private vaultRepository: IVaultRepository,
    private secureStorage: SecureStorageSource,
  ) {}

  async execute(vaultId: string): Promise<Result<void>> {
    // جلب التوكن البيومتري من SecureStore
    const token = await this.secureStorage.get(`biometric_token_${vaultId}`);
    if (!token) return failure(new AuthenticationError('No biometric token stored'));

    // فك تشفير التوكن باستخدام مفتاح الجهاز
    const pin = decrypt(token, deviceKey);

    // استخدام PIN المستعاد لفتح الخزنة
    return this.vaultRepository.unlockWithPin(vaultId, pin);
  }
}
```

2. تخزين `biometric_token` عند إنشاء الخزنة في `create-vault.tsx`:

```typescript
// بعد إنشاء الخزنة بنجاح
const pinToken = encrypt(pin, deviceKey);
await secureStorage.set(`biometric_token_${vault.id}`, pinToken);
```

3. تعديل `login.tsx` لاستخدام `BiometricUnlockUseCase` عند الضغط على زر البصمة بدلاً من تمرير PIN فارغ.

### 1.2 Activity Log يسبب Crash

**الملف المتأثر:** `app/(app)/(tabs)/settings.tsx:168`

**المشكلة:**  
`router.push('/(app)/modals/activity-log')` يؤدي إلى route غير موجود.

**الحل:**

إنشاء ملف `app/(app)/modals/activity-log.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { ScreenLayout } from '@ui/components/organisms/ScreenLayout';
import { Typography } from '@ui/components/atoms/Typography';
import { Icon } from '@ui/components/atoms/Icon';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing } from '@core/theme';
// استيراد ActivityLogRepository وقراءة آخر 50 حدثاً
```

**المتطلبات:**
- قراءة من جدول `activity_log` في SQLite
- عرض أيقونة لكل نوع حدث
- تاريخ ووقت الحدث
- إمكانية مسح السجل
- Search/Filter

### 1.3 `npm ci` يفشل في CI

**الملفات المتأثرة:**
- `package.json` (تعارضات peer dependency في lockfile)
- `.github/workflows/build.yml`
- `.github/workflows/build-android.yml`

**الحل:**

```yaml
# في جميع workflows
- name: Install dependencies
  run: npm ci --legacy-peer-deps
```

أو إصلاح lockfile نهائياً عن طريق:

```bash
npx expo install --fix
npm install --package-lock-only
```

---

## المرحلة 2: البصمة = وجه وليس إصبع

**المدة:** يوم واحد | **الأولوية:** 🔴 قصوى

**الهدف:** جعل التعرف على الوجه هو طريقة المصادقة البيومترية الأساسية.

### 2.1 تعديل `useBiometrics.ts`

**الملف:** `src/ui/hooks/useBiometrics.ts`

```typescript
import { useState, useCallback, useEffect } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export type BiometricType = 'face' | 'fingerprint' | 'iris' | null;

interface BiometricsState {
  isAvailable: boolean;
  isEnrolled: boolean;
  biometryType: BiometricType;
  preferredType: BiometricType;
}

export function useBiometrics() {
  const [state, setState] = useState<BiometricsState>({
    isAvailable: false,
    isEnrolled: false,
    biometryType: null,
    preferredType: null,
  });

  const getBiometricTypeName = useCallback((type: LocalAuthentication.AuthenticationType): BiometricType => {
    switch (type) {
      case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
        return 'face';
      case LocalAuthentication.AuthenticationType.FINGERPRINT:
        return 'fingerprint';
      case LocalAuthentication.AuthenticationType.IRIS:
        return 'iris';
      default:
        return null;
    }
  }, []);

  const checkBiometrics = useCallback(async () => {
    if (Platform.OS === 'web') {
      setState({ isAvailable: false, isEnrolled: false, biometryType: null, preferredType: null });
      return;
    }

    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

    const mappedTypes = supportedTypes.map(getBiometricTypeName).filter(Boolean) as BiometricType[];

    // الوجه له الأولوية
    const preferred = mappedTypes.includes('face') ? 'face'
      : mappedTypes.includes('iris') ? 'iris'
      : mappedTypes.includes('fingerprint') ? 'fingerprint'
      : null;

    setState({
      isAvailable: hasHardware && isEnrolled && preferred !== null,
      isEnrolled,
      biometryType: preferred,
      preferredType: preferred,
    });
  }, [getBiometricTypeName]);

  const authenticate = useCallback(async (
    promptMessage: string = 'Authenticate to access Khaznati',
  ): Promise<boolean> => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        fallbackLabel: 'Use PIN',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      return result.success;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    checkBiometrics();
  }, [checkBiometrics]);

  return {
    ...state,
    checkBiometrics,
    authenticate,
    getBiometricTypeName,
  };
}
```

### 2.2 تعديل `biometric-setup.tsx`

**التغييرات:**
- الأيقونة الافتراضية: `face-recognition`
- النص الافتراضي: "الوجه" (بدون تحديد نوع)
- إظهار رسالة توضيحية: "استخدم وجهك لفتح الخزنة بسرعة"
- إذا كان الجهاز يدعم بصمة الإصبع فقط: أيقونة `fingerprint` ونص "البصمة"

```typescript
const biometricIcon = state.preferredType === 'fingerprint' ? 'fingerprint' : 'face-recognition';
const biometricName = state.preferredType === 'fingerprint' ? 'البصمة' : 'الوجه';
```

### 2.3 تعديل `login.tsx`

**التغييرات:**
- زر البصمة: أيقونة `face-recognition` (أو مناسبة للنوع)
- استخدام التوكن المخزن في SecureStore بدلاً من PIN الفارغ

```typescript
const handleBiometric = useCallback(async () => {
  if (!targetVault) return;
  const authSuccess = await authenticate('افتح الخزنة');
  if (!authSuccess) return;

  // استخدام BiometricUnlockUseCase
  const result = await biometricUnlockUseCase.execute(targetVault.id);
  if (result.success) {
    router.replace('/(app)/(tabs)/vault');
  } else {
    setError('فشل فتح الخزنة، استخدم الرقم السري');
  }
}, [targetVault, authenticate, biometricUnlockUseCase]);
```

### 2.4 تعديل `settings.tsx`

**التغييرات:**
- أيقونة Biometrics: الوجه (أو مناسبة للنوع)
- إضافة نص توضيحي: نوع البصمة المستخدمة
- إضافة خيار "تغيير نوع البصمة" (إذا كان الجهاز يدعم أكثر من نوع)

### 2.5 تحديث `app.json`

```json
{
  "ios": {
    "infoPlist": {
      "NSFaceIDUsageDescription": "Khaznati uses Face ID to protect your vault."
    }
  },
  "android": {
    "permissions": [
      "android.permission.USE_BIOMETRIC"
    ]
  }
}
```

---

## المرحلة 3: إصلاح ميزات Settings الناقصة

**المدة:** نصف يوم | **الأولوية:** 🟡 عالية

### 3.1 تبديل التيم Cycle

**الملف:** `app/(app)/(tabs)/settings.tsx:94-97`

**التغيير:**  
تغيير الترتيب من `Light ↔ Dark` إلى `System → Light → Dark → Amoled → System`

```typescript
const THEME_CYCLE: ThemeMode[] = [
  ThemeMode.SYSTEM,
  ThemeMode.LIGHT,
  ThemeMode.DARK,
  ThemeMode.AMOLED,
];

const handleToggleTheme = useCallback(() => {
  const currentIndex = THEME_CYCLE.indexOf(mode);
  const next = THEME_CYCLE[(currentIndex + 1) % THEME_CYCLE.length];
  setThemeMode(next);
}, [mode, setThemeMode]);
```

### 3.2 تبديل اللغة مع إعادة تشغيل

**الملف:** `app/(app)/(tabs)/settings.tsx:99-103`

**التغيير:**  
بما أن `I18nManager.forceRTL()` يتطلب إعادة تشغيل التطبيق، نعرض Alert:

```typescript
const handleToggleLanguage = useCallback(() => {
  const next = currentLang === 'ar' ? 'en' : 'ar';
  changeLanguage(next);
  setCurrentLang(next);
  I18nManager.forceRTL(next === 'ar');

  Alert.alert(
    'تغيير اللغة',
    'سيتم إعادة تشغيل التطبيق لتطبيق تغيير اللغة',
    [
      { text: 'إعادة التشغيل', onPress: () => Updates.reloadAsync() },
      { text: 'لاحقاً', style: 'cancel' },
    ],
  );
}, [currentLang]);
```

### 3.3 Clear All Data

**الملف:** `app/(app)/(tabs)/settings.tsx:162`

**التنفيذ:**

```typescript
const handleClearVaults = useCallback(() => {
  Alert.alert(
    'مسح جميع البيانات',
    'سيتم حذف جميع الخزائن والبيانات بشكل نهائي. هذا الإجراء لا يمكن التراجع عنه.',
    [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف الكل',
        style: 'destructive',
        onPress: async () => {
          // 1. حذف جميع الخزائن من قاعدة البيانات
          for (const vault of vaults) {
            await deleteVault(vault.id);
          }

          // 2. حذف مجلدات الملفات
          const khaznatiDir = new Directory(Paths.document, 'khaznati');
          if (khaznatiDir.exists) {
            khaznatiDir.delete();
          }

          // 3. مسح SecureStore
          // مسح جميع المفاتيح المخزنة

          // 4. العودة لشاشة الترحيب
          router.replace('/(auth)/welcome');
        },
      },
    ],
  );
}, [vaults, deleteVault]);
```

### 3.4 Restore Backup

**الملف:** `app/(app)/(tabs)/settings.tsx:148-153`

**التنفيذ:**

```typescript
const handleRestore = useCallback(async () => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/octet-stream',
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];

      Alert.alert(
        'استعادة النسخة الاحتياطية',
        'سيتم استبدال جميع البيانات الحالية. هل أنت متأكد؟',
        [
          { text: 'إلغاء', style: 'cancel' },
          {
            text: 'استعادة',
            style: 'destructive',
            onPress: async () => {
              const db = DIContainer.resolve<DatabaseService>('DatabaseService');
              await db.restore(asset.uri);
              Alert.alert('تم', 'تمت استعادة البيانات بنجاح. سيتم إعادة تشغيل التطبيق.');
              Updates.reloadAsync();
            },
          },
        ],
      );
    }
  } catch (err) {
    Alert.alert('خطأ', (err as Error).message);
  }
}, []);
```

### 3.5 Lock All Vaults

**الملف:** `app/(app)/(tabs)/settings.tsx:179-181`

**التنفيذ:**

```typescript
const handleLockAll = useCallback(async () => {
  for (const vault of vaults) {
    if (!vault.isLocked) {
      await lockVault(vault.id);
    }
  }
  router.push('/(auth)/welcome');
}, [vaults, lockVault]);
```

---

## المرحلة 4: إضافة تشفير الملفات وقاعدة البيانات

**المدة:** يومين | **الأولوية:** 🔴 قصوى

### 4.1 إضافة مكتبة تشفير

إضافة `expo-crypto` (موجودة بالفعل في `package.json`).

### 4.2 إنشاء `crypto.ts`

**الملف الجديد:** `src/core/utils/crypto.ts`

```typescript
import * as Crypto from 'expo-crypto';

const ALGORITHM = 'AES-256-GCM';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits

export async function generateEncryptionKey(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(KEY_LENGTH);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function encryptFile(key: string, data: Uint8Array): Promise<Uint8Array> {
  // استخدام expo-crypto للتشفير
  // AES-256-GCM مع key مشتق من key string
  // الناتج: IV + ciphertext + auth tag
}

export async function decryptFile(key: string, encryptedData: Uint8Array): Promise<Uint8Array> {
  // فك التشفير
}

export function deriveKeyFromPin(pin: string, salt: string): string {
  // PBKDF2-like derivation باستخدام SHA-256
}
```

### 4.3 تعديل `FileSystemSource.ts`

**التغييرات:**
- `writeFile` و `readFile` تستخدم `encryptFile` / `decryptFile`
- كل خزنة لها مفتاح تشفير خاص (`vaultEncryptionKey`) مخزن في `SecureStorageSource`
- المفتاح مشفر بـ PIN hash قبل التخزين

```typescript
async writeFile(path: string, data: string, vaultId: string): Promise<void> {
  const vaultKey = await this.getVaultKey(vaultId);
  const encrypted = await encryptFile(vaultKey, Buffer.from(data, 'base64'));
  const fullPath = `${this.basePath}/files/${vaultId}/${path}`;
  await FileSystem.writeAsStringAsync(fullPath, Buffer.from(encrypted).toString('base64'), {
    encoding: FileSystem.EncodingType.Base64,
  });
}
```

### 4.4 تشفير قاعدة البيانات

**الملف:** `src/data/database/DatabaseService.ts`

**التغييرات:**
- توليد مفتاح قاعدة بيانات عند أول تشغيل
- تخزين المفتاح في `SecureStorageSource`
- استخدام `PRAGMA key = ?` مع المفتاح

```typescript
async initialize(password?: string): Promise<void> {
  this.db = openDatabaseSync(APP_CONFIG.database.name);

  const dbKey = password || await this.getOrCreateDbKey();

  if (dbKey) {
    this.db.runSync('PRAGMA key = ?', [dbKey]);
    // التحقق من صحة المفتاح
    try {
      this.db.execSync('SELECT count(*) FROM sqlite_master');
    } catch {
      throw new Error('Database encryption key is invalid');
    }
  }

  this.db.execSync('PRAGMA journal_mode = WAL');
  // ... باقي الإعدادات
}

private async getOrCreateDbKey(): Promise<string> {
  const storage = new SecureStorageSource();
  let key = await storage.get('db_encryption_key');

  if (!key) {
    key = await generateEncryptionKey();
    await storage.set('db_encryption_key', key);
  }

  return key;
}
```

### 4.5 تخزين مفتاح الخزنة في `CreateVaultUseCase.ts`

```typescript
async execute(input: CreateVaultInput): Promise<Result<Vault>> {
  // ... التحقق من الصحة

  const pinSalt = await generateSalt();
  const encryptedPinHash = await hashPin(input.pin, pinSalt);

  // توليد مفتاح تشفير فريد للخزنة
  const vaultKey = await generateEncryptionKey();
  const encryptedVaultKey = await encryptWithPin(vaultKey, input.pin, pinSalt);

  // تخزين المفتاح المشفر في SecureStore
  const secureStorage = new SecureStorageSource();
  await secureStorage.set(`vault_key_${vault.id}`, encryptedVaultKey);

  // تخزين التوكن البيومتري
  const biometricToken = encryptWithDeviceKey(input.pin);
  await secureStorage.set(`biometric_token_${vault.id}`, biometricToken);

  // ... إنشاء الخزنة في قاعدة البيانات
}
```

### 4.6 تعديل `files.tsx` لاستخدام التشفير

```typescript
const handleImport = useCallback(async () => {
  try {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];

      // قراءة الملف المصدر
      const srcContent = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // تشفير وكتابة الملف
      const fsSource = DIContainer.resolve<FileSystemSource>('FileSystemSource');
      await fsSource.writeFile(asset.name, srcContent, vaultId || 'default');

      loadFiles();
    }
  } catch (err) {
    setError((err as Error).message);
  }
}, [getVaultDir, loadFiles, vaultId]);
```

### 4.7 تعديل `media.tsx` لقراءة من المجلد المشفر

```typescript
const loadMedia = useCallback(async () => {
  // استخدام FileSystemSource.getVaultPath(vaultId) بدلاً من المسار المباشر
  const fsSource = DIContainer.resolve<FileSystemSource>('FileSystemSource');
  const vaultPath = fsSource.getVaultPath(vaultId || 'default');

  // فك تشفير وعرض الصور المصغرة
  const files = await fsSource.listFiles(vaultPath);
  const mediaItems = await Promise.all(
    files
      .filter(f => IMAGE_EXTENSIONS.includes(ext(f)))
      .map(async f => ({
        id: f,
        uri: await getDecryptedThumbnail(vaultId, f),
        name: f,
      }))
  );
  // ...
}, [vaultId]);
```

---

## المرحلة 5: إدارة الجلسة و Auto-Lock

**المدة:** يوم واحد | **الأولوية:** 🟡 عالية

### 5.1 إنشاء `SessionProvider.tsx`

**الملف الجديد:** `src/ui/providers/SessionProvider.tsx`

```typescript
import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { router } from 'expo-router';

interface SessionState {
  activeVaultId: string | null;
  isUnlocked: boolean;
  lastUnlockTime: number | null;
  autoLockTimeout: number; // milliseconds
}

interface SessionContextValue extends SessionState {
  unlock: (vaultId: string) => void;
  lock: () => void;
  setAutoLockTimeout: (timeout: number) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>({
    activeVaultId: null,
    isUnlocked: false,
    lastUnlockTime: null,
    autoLockTimeout: 300000, // 5 دقائق افتراضياً
  });

  const appState = useRef<AppStateStatus>(AppState.currentState);

  const unlock = useCallback((vaultId: string) => {
    setState(prev => ({
      ...prev,
      activeVaultId: vaultId,
      isUnlocked: true,
      lastUnlockTime: Date.now(),
    }));
  }, []);

  const lock = useCallback(() => {
    setState(prev => ({
      ...prev,
      isUnlocked: false,
      activeVaultId: null,
    }));
  }, []);

  const setAutoLockTimeout = useCallback((timeout: number) => {
    setState(prev => ({ ...prev, autoLockTimeout: timeout }));
    // تخزين في SecureStore
  }, []);

  // مراقبة حالة التطبيق (خلفية/أمامية)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (
        appState.current.match(/active/) &&
        nextState.match(/inactive|background/)
      ) {
        // التطبيق ذهب للخلفية — تسجيل الوقت
        setState(prev => ({ ...prev, lastBackgroundTime: Date.now() }));
      } else if (
        nextState === 'active' &&
        appState.current.match(/inactive|background/)
      ) {
        // التطبيق عاد للأمامية — فحص auto-lock
        const bgTime = state.lastBackgroundTime || Date.now();
        const elapsed = Date.now() - bgTime;
        if (elapsed >= state.autoLockTimeout && state.isUnlocked) {
          lock();
          router.replace('/(auth)/login');
        }
      }
      appState.current = nextState;
    });

    return () => subscription.remove();
  }, [state.autoLockTimeout, state.isUnlocked, lock]);

  return (
    <SessionContext.Provider value={{ ...state, unlock, lock, setAutoLockTimeout }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
```

### 5.2 تعديل `_layout.tsx`

لف التطبيق بـ `SessionProvider`:

```tsx
export default function RootLayout() {
  // ...
  return (
    <GestureHandlerRootView style={styles.root} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <ThemeProvider>
          <SessionProvider>
            <RootLayoutInner />
          </SessionProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

### 5.3 تعديل `login.tsx`

بعد فتح الخزنة بنجاح، تحديث Session:

```typescript
const handleLogin = useCallback(async () => {
  // ...
  const result = await unlockVault(targetVault.id, password);
  if (result.success) {
    session.unlock(targetVault.id); // تحديث الجلسة
    // ...
  }
}, []);
```

### 5.4 حماية الشاشات

إضافة فحص في كل شاشة تتطلب جلسة مفتوحة:

```typescript
const { isUnlocked } = useSession();

useEffect(() => {
  if (!isUnlocked) {
    router.replace('/(auth)/login');
  }
}, [isUnlocked]);
```

---

## المرحلة 6: إكمال الشاشات الناقصة

**المدة:** يوم ونصف | **الأولوية:** 🟡 عالية

### 6.1 شاشة Media — إضافة استيراد الصور

**الملف:** `app/(app)/(tabs)/media.tsx`

**الإضافات:**
- FAB مع أيقونة `plus` لاستيراد الصور
- استخدام `expo-image-picker` لاختيار الصور من المعرض
- تشفير الصور المستوردة
- عرض شبكة الصور مع إمكانية الضغط للتكبير

```typescript
const handleImport = useCallback(async () => {
  const permission = await MediaLibrary.requestPermissionsAsync();
  if (permission.status !== 'granted') return;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
  });

  if (!result.canceled && result.assets?.[0]) {
    const asset = result.assets[0];
    // قراءة وتشفير وحفظ
    await importAndEncryptMedia(asset);
    loadMedia();
  }
}, []);
```

### 6.2 شاشة Files — إضافة عمليات الملفات

**الملف:** `app/(app)/(tabs)/files.tsx`

**الإضافات:**
- زر "إنشاء مجلد" في الـ Header
- Long press على الملف → BottomSheet مع خيارات:
  - Delete (تأكيد + حذف آمن)
  - Rename (Input modal)
  - Share (expo-sharing)
  - Info (حجم، نوع، تاريخ)

```typescript
// BottomSheet للإجراءات
const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);

const handleLongPress = useCallback((item: FileItem) => {
  setSelectedFile(item);
  // إظهار BottomSheet
}, []);

const handleDelete = useCallback(async (item: FileItem) => {
  // حذف الملف من نظام الملفات
  const filePath = `${getVaultDir().uri}/${item.name}`;
  const file = new File(filePath);
  if (file.exists) file.delete();
  loadFiles();
}, [getVaultDir, loadFiles]);

const handleRename = useCallback(async (item: FileItem, newName: string) => {
  const oldPath = `${getVaultDir().uri}/${item.name}`;
  const newPath = `${getVaultDir().uri}/${newName}`;
  await FileSystem.moveAsync({ from: oldPath, to: newPath });
  loadFiles();
}, [getVaultDir, loadFiles]);

const handleShare = useCallback(async (item: FileItem) => {
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    // فك تشفير ومشاركة
    await Sharing.shareAsync(item.id, {
      mimeType: 'application/octet-stream',
    });
  }
}, []);
```

### 6.3 شاشة File Preview — تشغيل الفيديو

**الملف:** `app/(app)/modals/file-preview.tsx`

**التغييرات:**
- إضافة مشغل فيديو حقيقي (expo-video أو Video من react-native)
- Zoom للصور (react-native-gesture-handler pinch gesture)
- معلومات الملف (حجم، نوع، أبعاد)

### 6.4 إنشاء Activity Log

**الملف الجديد:** `app/(app)/modals/activity-log.tsx`

```typescript
export default function ActivityLogModal() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    const repo = DIContainer.resolve<ActivityLogRepositoryImpl>('ActivityLogRepository');
    repo.findAll().then(result => {
      if (result.success) setLogs(result.data);
    });
  }, []);

  return (
    <ScreenLayout title="سجل النشاطات" showBack>
      <ScrollView>
        {logs.map(log => (
          <View key={log.id} style={styles.logItem}>
            <Icon name={getIconForAction(log.action)} size={20} />
            <View style={styles.logInfo}>
              <Typography>{getActionLabel(log.action)}</Typography>
              <Typography variant="bodySmall" color={colors.onSurfaceVariant}>
                {formatDate(log.timestamp)}
              </Typography>
            </View>
          </View>
        ))}
      </ScrollView>
    </ScreenLayout>
  );
}
```

---

## المرحلة 7: CI/CD — بناء APK ناجح

**المدة:** نصف يوم | **الأولوية:** 🔴 قصوى

### 7.1 تعديل workflows

**الملفات:**
- `.github/workflows/build.yml`
- `.github/workflows/build-android.yml`

**التغييرات:**
- `npm ci` → `npm ci --legacy-peer-deps`
- إضافة `--legacy-peer-deps` في جميع أماكن `npm ci`

```yaml
- name: Install dependencies
  run: npm ci --legacy-peer-deps
```

### 7.2 Prebuild محلي

**تشغيل محلي** (ليس في CI):

```bash
npx expo prebuild --platform android --clean
```

**ثم commit مجلد `android/`:**

```bash
git add android/
git commit -m "chore: add prebuilt android native project"
```

### 7.3 إضافة Signing Config

**إنشاء debug keystore:**

```bash
keytool -genkey -v -keystore debug.keystore -alias androiddebugkey \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass android -keypass android \
  -dname "CN=Android Debug, O=Android, C=US"
```

**تعديل `android/app/build.gradle`:**

```gradle
android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            storeFile file('khaznati-release.keystore')
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD") ?: ""
            keyAlias System.getenv("ANDROID_KEY_ALIAS") ?: ""
            keyPassword System.getenv("ANDROID_KEY_PASSWORD") ?: ""
        }
    }

    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

### 7.4 إضافة Secrets

في GitHub repository: **Settings → Secrets and variables → Actions**

| Secret | القيمة |
|---|---|
| `ANDROID_KEYSTORE_PASSWORD` | كلمة مرور keystore |
| `ANDROID_KEY_ALIAS` | الاسم المستعار للمفتاح |
| `ANDROID_KEY_PASSWORD` | كلمة مرور المفتاح |

### 7.5 تنظيف `package.json`

```bash
# إزالة المكاتب غير المستخدمة
npm uninstall expo-haptics expo-print react-native-worklets
```

### 7.6 إصلاح تحذيرات ESLint

إضافة تعليقات `// eslint-disable-next-line` في 5 ملفات تحتوي على تحذيرات `explicit-function-return-type`.

---

## المرحلة 8: اختبارات وتحسين نهائي

**المدة:** يوم واحد | **الأولوية:** 🟢 متوسطة

### 8.1 إنشاء اختبارات

| الملف | الاختبارات |
|---|---|
| `src/core/validators/__tests__/index.test.ts` | `validatePin` (أرقام فقط، 4-8 خانات)، `validateVaultName` (عربي/إنجليزي، طول) |
| `src/core/utils/__tests__/secure.test.ts` | `generateSalt`, `hashPin` (اتساق، اختلاف) |
| `src/data/mappers/__tests__/VaultMapper.test.ts` | `toDTO`, `toEntity` (تعيين الحقول) |
| `src/domain/usecases/vault/__tests__/CreateVaultUseCase.test.ts` | نجاح، فشل validation |

### 8.2 إعداد Jest

```javascript
// jest.config.js
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  moduleNameMapper: {
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@data/(.*)$': '<rootDir>/src/data/$1',
    '^@domain/(.*)$': '<rootDir>/src/domain/$1',
    '^@ui/(.*)$': '<rootDir>/src/ui/$1',
  },
};
```

### 8.3 الفحص النهائي

```bash
# TypeScript
npx tsc --noEmit

# ESLint
npx eslint .

# expo-doctor
npx expo-doctor

# Tests
npm test -- --maxWorkers=2
```

تأكيد 0 errors في جميع الفحوصات.

---

## الجدول الزمني

| المرحلة | المدة | التكلفة النسبية |
|---|---|---|
| 1️⃣ إصلاح الأعطال الحرجة | يوم واحد | 10% |
| 2️⃣ البصمة = وجه | يوم واحد | 10% |
| 3️⃣ إصلاح Settings | نصف يوم | 5% |
| 4️⃣ تشفير الملفات + DB | يومان | 25% |
| 5️⃣ إدارة الجلسة | يوم واحد | 10% |
| 6️⃣ إكمال الشاشات | يوم ونصف | 20% |
| 7️⃣ CI/CD | نصف يوم | 10% |
| 8️⃣ اختبارات | يوم واحد | 10% |
| **المجموع** | **~8.5 أيام** | **100%** |

---

## الملخص النهائي

### المخرجات المتوقعة بعد الإكمال

| الميزة | الحالة |
|---|---|
| بصمة الوجه كطريقة المصادقة الأساسية | ✅ |
| إنشاء خزنة برقم سري 4-8 أرقام مع أيقونة ولون | ✅ |
| فتح الخزنة بالرقم السري أو الوجه (Face ID) | ✅ |
| تذكرني (Remember Me) مع تخزين آمن | ✅ |
| تشفير كامل للملفات على القرص (AES-256-GCM) | ✅ |
| تشفير قاعدة البيانات SQLite | ✅ |
| إدارة الجلسة مع Auto-Lock تلقائي | ✅ |
| جميع إعدادات Settings تشتغل (Backup, Restore, Clear, Activity Log, Theme, Language) | ✅ |
| شاشة Media تستورد وتعرض الصور والفيديو | ✅ |
| شاشة Files: استيراد/حذف/إعادة تسمية/مشاركة/إنشاء مجلدات | ✅ |
| CI/CD يبني APK بنجاح (Debug + Release) | ✅ |
| 0 TypeScript errors | ✅ |
| 0 ESLint errors | ✅ |
| جميع الاختبارات تمر بنجاح | ✅ |
| كل النصوص بالعربية (الواجهات والإعدادات) | ✅ |

### الفرق بين قبل وبعد

| قبل | بعد |
|---|---|
| البصمة تفشل دائماً (ترسل PIN فارغ) | البصمة تشتغل عبر توكن مشفر في SecureStore |
| الأيقونة دائماً إصبع (fingerprint) | الأيقونة وجه (face-recognition) أو إصبع حسب الجهاز |
| الملفات مخزنة بنص عادي | الملفات مشفرة بـ AES-256-GCM |
| قاعدة البيانات غير مشفرة | قاعدة البيانات مشفرة بـ SQLCipher |
| لا يوجد Session Management | Session مع Auto-Lock تلقائي |
| Settings: Activity Log يسبب Crash | جميع إعدادات Settings تشتغل |
| Media: قراءة فقط بدون استيراد | Media: استيراد + عرض + تشفير |
| Files: استيراد فقط بدون عمليات | Files: استيراد/حذف/إعادة تسمية/مشاركة |
| CI/CD: `npm ci` يفشل | CI/CD: بناء APK ناجح |
| 0 اختبارات | اختبارات للـ validators والـ use cases |
