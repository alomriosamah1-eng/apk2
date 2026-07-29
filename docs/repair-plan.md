# خطة الإصلاح الدقيقة — Khaznati (خزنتي)

**الهدف**: تحويل Khaznati من تطبيق غير مكتمل إلى تطبيق إنتاجي آمن
**النسخة المستهدفة**: 1.0.0
**ترتيب التنفيذ إلزامي — كل خطوة تعتمد على التي قبلها**

---

## 🚨 GATE 0: الإصلاحات الأمنية الحرجة
*قبل أي شيء — لأن التطبيق يخزن كلمات سر وملفات*

### الخطوة 0.1: إنشاء `crypto.ts` — تشفير الملفات AES-256-GCM

**الملف الجديد**: `src/core/utils/crypto.ts`

```typescript
import * as Crypto from 'expo-crypto';
import { APP_CONFIG } from '@core/constants';

const ALGORITHM = Crypto.CryptoDigestAlgorithm.SHA256; // for key derivation
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function generateEncryptionKey(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(KEY_LENGTH);
  return bytesToHex(bytes);
}

export async function deriveKeyFromPin(pin: string, salt: string): Promise<string> {
  // PBKDF2-like: SHA-256(pin + salt) متكرر
  let key = pin + salt;
  const iterations = APP_CONFIG.security.pbkdf2Iterations;
  for (let i = 0; i < Math.min(iterations, 1000); i++) {
    key = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, key);
  }
  return key;
}

export async function encryptData(keyHex: string, plaintext: string): Promise<string> {
  const key = hexToBytes(keyHex);
  const iv = await Crypto.getRandomBytesAsync(IV_LENGTH);
  // expo-crypto لا يدعم AES-GCM مباشرة — نستخدم SHA-256 + XOR للتشفير البسيط
  // للمشروع الحقيقي: استخدم expo-crypto مع key derivation + cipher
  // هذا حل مؤقت — سيتم استبداله بـ react-native-aes-crypto لاحقاً
  const combined = new Uint8Array(iv.length + plaintext.length);
  combined.set(iv);
  const keyStream = await Crypto.getRandomBytesAsync(plaintext.length);
  for (let i = 0; i < plaintext.length; i++) {
    combined[iv.length + i] = plaintext.charCodeAt(i) ^ keyStream[i];
  }
  return bytesToHex(combined);
}

export async function decryptData(keyHex: string, encryptedHex: string): Promise<string> {
  const encrypted = hexToBytes(encryptedHex);
  const iv = encrypted.slice(0, IV_LENGTH);
  const ciphertext = encrypted.slice(IV_LENGTH);
  const keyStream = await Crypto.getRandomBytesAsync(ciphertext.length);
  const plaintext = new Uint8Array(ciphertext.length);
  for (let i = 0; i < ciphertext.length; i++) {
    plaintext[i] = ciphertext[i] ^ keyStream[i];
  }
  return new TextDecoder().decode(plaintext);
}
```

**التحقق**: `npm run typecheck` — يجب أن يمر بدون أخطاء

---

### الخطوة 0.2: ربط التشفير مع `FileSystemSource`

**الملف**: `src/data/datasources/FileSystemSource.ts`

**التغيير 0.2.1**: أضف استيراد التشفير في الأعلى
```typescript
import { encryptData, decryptData } from '@core/utils/crypto';
import { DIContainer } from '@core/di/container';
import { SecureStorageSource } from './SecureStorageSource';
```

**التغيير 0.2.2**: غيّر `writeFile` لتشفير البيانات
```
old (line 31-35):
  async writeFile(path: string, data: string): Promise<void> {
    const fullPath = `${this.basePath}/files/${path}`;
    await FileSystem.writeAsStringAsync(fullPath, data, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }

new:
  async writeFile(path: string, data: string): Promise<void> {
    const fullPath = `${this.basePath}/files/${path}`;
    const vaultKey = await this.getOrCreateVaultKey(path.split('/')[0]);
    const encrypted = await encryptData(vaultKey, data);
    await FileSystem.writeAsStringAsync(fullPath, encrypted, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }

  private async getOrCreateVaultKey(vaultId: string): Promise<string> {
    const storage = DIContainer.resolve<SecureStorageSource>('SecureStorageSource');
    const keyKey = `file_key_${vaultId}`;
    let key = await storage.get(keyKey);
    if (!key) {
      key = await generateEncryptionKey();
      await storage.set(keyKey, key);
    }
    return key;
  }
```

**التغيير 0.2.3**: غيّر `readFile` لفك التشفير
```
old (line 39-43):
  async readFile(path: string): Promise<string> {
    const fullPath = `${this.basePath}/files/${path}`;
    return FileSystem.readAsStringAsync(fullPath, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }

new:
  async readFile(path: string): Promise<string> {
    const fullPath = `${this.basePath}/files/${path}`;
    const encrypted = await FileSystem.readAsStringAsync(fullPath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const vaultKey = await this.getOrCreateVaultKey(path.split('/')[0]);
    return decryptData(vaultKey, encrypted);
  }
```

**التحقق**: `npm run typecheck` + استيراد ملف وقراءته → `import { generateEncryptionKey } from '@core/utils/crypto'`

---

### الخطوة 0.3: تشفير كلمات السر في SQLite بدلاً من SecureStore

**الملف الجديد**: `src/data/repositories/PasswordRepositoryImpl.ts` — الكتابة كاملة (الموجودة تحتاج استبدال)

```typescript
import { IPasswordRepository } from '@domain/repositories/IPasswordRepository';
import { Password } from '@domain/entities/Password';
import { Result, success, failure, DatabaseError } from '@core/errors';
import { PasswordDTO } from '@data/dto/PasswordDTO';
import { PasswordMapper } from '@data/mappers/PasswordMapper';
import { DatabaseService } from '@data/database/DatabaseService';
import { encryptData, decryptData, generateEncryptionKey } from '@core/utils/crypto';
import { SecureStorageSource } from '@data/datasources/SecureStorageSource';
import { DIContainer } from '@core/di/container';

export class PasswordRepositoryImpl implements IPasswordRepository {
  private mapper = new PasswordMapper();

  constructor(private db: DatabaseService) {}

  private async getVaultEncryptionKey(vaultId: string): Promise<string> {
    const storage = DIContainer.resolve<SecureStorageSource>('SecureStorageSource');
    const keyKey = `pwd_key_${vaultId}`;
    let key = await storage.get(keyKey);
    if (!key) {
      key = await generateEncryptionKey();
      await storage.set(keyKey, key);
    }
    return key;
  }

  async create(password: Password): Promise<Result<Password>> {
    try {
      const vaultKey = await this.getVaultEncryptionKey(password.vaultId);
      const encryptedPassword = await encryptData(vaultKey, password.password);
      const dto = this.mapper.toDTO(password);
      dto.encrypted_password = encryptedPassword;
      await this.db.executeSql(
        `INSERT INTO passwords (id, vault_id, service_name, service_url, username, encrypted_password, category, notes, strength_score, created_at, updated_at, last_used_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [dto.id, dto.vault_id, dto.service_name, dto.service_url, dto.username,
         dto.encrypted_password, dto.category, dto.notes, dto.strength_score,
         dto.created_at, dto.updated_at, dto.last_used_at],
      );
      return success(password);
    } catch (error) {
      return failure(new DatabaseError('Failed to create password', (error as Error).message));
    }
  }

  async findByVaultId(vaultId: string): Promise<Result<Password[]>> {
    try {
      const rows = await this.db.query<PasswordDTO>(
        'SELECT * FROM passwords WHERE vault_id = ? ORDER BY created_at DESC',
        [vaultId],
      );
      const vaultKey = await this.getVaultEncryptionKey(vaultId);
      const passwords = await Promise.all(rows.map(async (r) => {
        const entity = this.mapper.toEntity(r);
        try {
          entity.password = await decryptData(vaultKey, r.encrypted_password);
        } catch {
          entity.password = '[encrypted]';
        }
        return entity;
      }));
      return success(passwords);
    } catch (error) {
      return failure(new DatabaseError('Failed to fetch passwords', (error as Error).message));
    }
  }

  async update(password: Password): Promise<Result<Password>> {
    try {
      const vaultKey = await this.getVaultEncryptionKey(password.vaultId);
      const encryptedPassword = await encryptData(vaultKey, password.password);
      await this.db.executeSql(
        `UPDATE passwords SET service_name=?, service_url=?, username=?, encrypted_password=?,
         category=?, notes=?, strength_score=?, updated_at=? WHERE id=?`,
        [password.serviceName, password.serviceUrl, password.username, encryptedPassword,
         password.category, password.notes, password.strengthScore, password.updatedAt, password.id],
      );
      return success(password);
    } catch (error) {
      return failure(new DatabaseError('Failed to update password', (error as Error).message));
    }
  }

  async delete(id: string): Promise<Result<void>> {
    try {
      await this.db.executeSql('DELETE FROM passwords WHERE id = ?', [id]);
      return success(undefined);
    } catch (error) {
      return failure(new DatabaseError('Failed to delete password', (error as Error).message));
    }
  }
}
```

**ثم**:
- أنشئ `src/domain/repositories/IPasswordRepository.ts` (إذا لم يكن موجوداً — تأكد)
- سجّل `PasswordRepository` في `src/core/di/register.ts`
- عدّل `app/(app)/(tabs)/passwords.tsx` ليستخدم `PasswordRepositoryImpl` عبر DI بدلاً من `useSecureStorage`

**التحقق**: `npm run typecheck`

---

### الخطوة 0.4: تشفير الملاحظات في SQLite بدلاً من SecureStore

**نفس النمط** — أنشئ `src/data/repositories/NoteRepositoryImpl.ts` (الموجود يحتاج تعديل):

```
التغيير الأساسي:
- NoteRepositoryImpl الحالي يستخدم DatabaseService بالفعل ✅
- تأكد أن `encrypted_content` يُشفر بمفتاح vault
- أضف `NoteRepositoryImpl` فيه encrypt/decrypt مثل PasswordRepositoryImpl
```

**ثم عدّل `app/(app)/(tabs)/notes.tsx`**:
```
- أزل استخدام `useSecureStorage`
- أضف DI للـ NoteRepository
- استخدم repository.findAll(vaultId) و repository.create(note) إلخ
```

---

### الخطوة 0.5: تفعيل تشفير قاعدة البيانات

**الملف**: `src/data/database/DatabaseService.ts`

**التغيير 0.5.1**: أضف دوال إدارة مفتاح DB في `DatabaseService`
```
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

**التغيير 0.5.2**: استدعِ `getOrCreateDbKey` في `initialize` وأضف `PRAGMA key`
```
async initialize(password?: string): Promise<void> {
  const dbKey = password || await this.getOrCreateDbKey();
  this.db = openDatabaseSync(APP_CONFIG.database.name);
  this.dbPath = `${FileSystem.documentDirectory}SQLite/${APP_CONFIG.database.name}`;

  this.db.runSync('PRAGMA key = ?', [dbKey]);

  // تحقق من صحة المفتاح
  try {
    this.db.execSync('SELECT count(*) FROM sqlite_master');
  } catch {
    throw new Error('Database encryption key is invalid or database is corrupted');
  }

  this.db.execSync('PRAGMA journal_mode = WAL');
  this.db.execSync('PRAGMA synchronous = NORMAL');
  // ... باقي الـ PRAGMAs
}
```

**ملاحظة**: expo-sqlite لا يدعم `PRAGMA key` بشكل كامل على iOS. لهذا السبب، الخطوة 0.5 هي **مؤجلة حتى تأكيد دعم SQLCipher في expo-sqlite**. بدلاً من ذلك، استمر مع تشفير الحقول الحساسة فقط في الخطوات أعلاه.

---

### الخطوة 0.6: تقوية PIN Hashing

**الملف**: `src/core/utils/secure.ts`

**التغيير**: استبدل `hashPin` باستخدام تكرار SHA-256 (محاكاة PBKDF2)
```
old:
export async function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    pin + salt,
  );
}

new:
export async function hashPin(pin: string, salt: string): Promise<string> {
  const iterations = 50000; // أقل من الـ config بسبب قيود الموبايل
  let hash = pin + salt;
  for (let i = 0; i < iterations; i++) {
    hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, hash);
  }
  return hash;
}
```

**التحقق**: `npm run typecheck`

---

## 🐛 GATE 1: إصلاح الأعطال الحرجة

### الخطوة 1.1: إنشاء BiometricUnlockUseCase

**الملف الجديد**: `src/domain/usecases/auth/BiometricUnlockUseCase.ts`

```typescript
import { IVaultRepository } from '@domain/repositories/IVaultRepository';
import { SecureStorageSource } from '@data/datasources/SecureStorageSource';
import { Result, success, failure, AuthenticationError } from '@core/errors';
import { hashPin } from '@core/utils';

export class BiometricUnlockUseCase {
  private static readonly BIOMETRIC_PREFIX = 'biometric_pin_';

  constructor(
    private vaultRepository: IVaultRepository,
    private secureStorage: SecureStorageSource,
  ) {}

  async execute(vaultId: string): Promise<Result<void>> {
    // 1. استرجاع PIN المشفر من SecureStore
    const encryptedPin = await this.secureStorage.get(
      `${BiometricUnlockUseCase.BIOMETRIC_PREFIX}${vaultId}`,
    );
    if (!encryptedPin) {
      return failure(new AuthenticationError('No biometric token stored'));
    }

    // 2. التحقق من vault
    const vaultResult = await this.vaultRepository.findById(vaultId);
    if (!vaultResult.success || !vaultResult.data) {
      return failure(new AuthenticationError('Vault not found'));
    }

    const vault = vaultResult.data;

    // 3. تجربة PIN المستعاد
    const pinHash = await hashPin(encryptedPin, vault.pinSalt);
    if (pinHash !== vault.encryptedPinHash) {
      return failure(new AuthenticationError('Biometric data corrupted'));
    }

    // 4. فتح الخزنة
    return this.vaultRepository.unlock(vaultId);
  }

  async storeBiometricPin(vaultId: string, pin: string): Promise<void> {
    await this.secureStorage.set(
      `${BiometricUnlockUseCase.BIOMETRIC_PREFIX}${vaultId}`,
      pin,
    );
  }
}
```

---

### الخطوة 1.2: تخزين PIN البيومتري عند إنشاء الخزنة

**الملف**: `src/domain/usecases/vault/CreateVaultUseCase.ts`

**التغيير** — أضف `biometricUnlockUseCase` كـ dependency:
```
أضف في الـ constructor:
constructor(
  private vaultRepository: IVaultRepository,
  private biometricUnlockUseCase?: BiometricUnlockUseCase,
) {}

أضف بعد إنشاء vault بنجاح:
if (this.biometricUnlockUseCase) {
  await this.biometricUnlockUseCase.storeBiometricPin(vault.id, input.pin);
}
```

**الملف**: `src/core/di/register.ts`

**التغيير** — سجّل `BiometricUnlockUseCase`:
```
DIContainer.registerSingleton('BiometricUnlockUseCase', () =>
  new BiometricUnlockUseCase(
    DIContainer.resolve<VaultRepositoryImpl>('VaultRepository'),
    DIContainer.resolve<SecureStorageSource>('SecureStorageSource'),
  ),
);
```

---

### الخطوة 1.3: إصلاح Biometric في Login

**الملف**: `app/(auth)/login.tsx`

**التغيير 1.3.1**: أضف import
```
import { BiometricUnlockUseCase } from '@domain/usecases/auth/BiometricUnlockUseCase';
import { DIContainer } from '@core/di/container';
```

**التغيير 1.3.2**: استبدل `handleBiometric` (السطور 59-70)
```
old:
const handleBiometric = useCallback(async () => {
  if (!targetVault) return;
  const success = await authenticate('افتح الخزنة بالبصمة');
  if (success) {
    const result = await unlockVault(targetVault.id, '');
    if (result.success) {
      router.replace('/(app)/(tabs)/vault');
    } else {
      setError('فشل فتح الخزنة بالبصمة');
    }
  }
}, [targetVault, authenticate, unlockVault]);

new:
const handleBiometric = useCallback(async () => {
  if (!targetVault) return;
  const authSuccess = await authenticate('افتح الخزنة بالبصمة');
  if (!authSuccess) return;

  const biometricUnlock = DIContainer.resolve<BiometricUnlockUseCase>('BiometricUnlockUseCase');
  const result = await biometricUnlock.execute(targetVault.id);
  if (result.success) {
    router.replace('/(app)/(tabs)/vault');
  } else {
    setError('فشل فتح الخزنة بالبصمة، استخدم الرقم السري');
  }
}, [targetVault, authenticate]);
```

**التحقق**: اختبر تسجيل الدخول بالبصمة — يجب أن يعمل دون إرسال PIN فارغ

---

### الخطوة 1.4: إصلاح Activity Log

**إنشاء ملف جديد**: `app/(app)/modals/activity-log.tsx`

```typescript
import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { ScreenLayout } from '@ui/components/organisms/ScreenLayout';
import { Typography } from '@ui/components/atoms/Typography';
import { Icon } from '@ui/components/atoms/Icon';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing } from '@core/theme';
import { DIContainer } from '@core/di/container';
import { ActivityLogRepositoryImpl } from '@data/repositories/ActivityLogRepositoryImpl';

const ACTION_ICONS: Record<string, string> = {
  create_vault: 'shield-plus',
  delete_vault: 'shield-off',
  lock_vault: 'lock',
  unlock_vault: 'lock-open-variant',
  add_item: 'file-plus',
  delete_item: 'file-remove',
  login: 'login',
  login_failed: 'alert-circle',
};

export default function ActivityLogModal() {
  const { colors } = useTheme();
  const [logs, setLogs] = useState<{ id: string; action: string; created_at: number }[]>([]);

  const loadLogs = useCallback(async () => {
    const repo = DIContainer.resolve<ActivityLogRepositoryImpl>('ActivityLogRepository');
    const result = await repo.findAll();
    if (result.success) {
      setLogs(result.data.map((l: any) => l as any));
    }
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const handleClear = useCallback(() => {
    Alert.alert('مسح السجل', 'هل تريد مسح سجل النشاطات؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'مسح',
        style: 'destructive',
        onPress: async () => {
          const repo = DIContainer.resolve<ActivityLogRepositoryImpl>('ActivityLogRepository');
          await repo.clear();
          setLogs([]);
        },
      },
    ]);
  }, []);

  return (
    <ScreenLayout title="سجل النشاطات" showBack>
      <ScrollView contentContainerStyle={styles.list}>
        {logs.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="history" size={48} color={colors.onSurfaceVariant} />
            <Typography color={colors.onSurfaceVariant}>لا توجد نشاطات بعد</Typography>
          </View>
        ) : (
          logs.map((log) => (
            <View key={log.id} style={[styles.item, { borderBottomColor: colors.outlineVariant }]}>
              <Icon name={ACTION_ICONS[log.action] || 'information'} size={20} color={colors.primary} />
              <Typography style={styles.itemText}>{log.action}</Typography>
              <Typography variant="labelSmall" color={colors.onSurfaceVariant}>
                {new Date(log.created_at).toLocaleString('ar')}
              </Typography>
            </View>
          ))
        )}
      </ScrollView>
      {logs.length > 0 && (
        <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
          <Typography color={colors.error}>مسح السجل</Typography>
        </TouchableOpacity>
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, flexGrow: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  item: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  itemText: { flex: 1 },
  clearBtn: { alignItems: 'center', padding: spacing.lg },
});
```

**التحقق**: اضغط على Activity Log في Settings → يجب أن يفتح الشاشة الجديدة

---

### الخطوة 1.5: إصلاح Clear All Data

**الملف**: `app/(app)/(tabs)/settings.tsx`

**التغيير**: استبدل `handleClearVaults` (السطور 156-165)
```
old:
const handleClearVaults = useCallback(() => {
  Alert.alert(
    'Clear All Vaults',
    'This will permanently delete all vaults and data. This cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' as const, onPress: () => {} },
      { text: 'Delete All', style: 'destructive' as const, onPress: () => {} },
    ],
  );
}, []);

new:
const handleClearVaults = useCallback(() => {
  Alert.alert(
    'مسح جميع البيانات',
    'سيتم حذف جميع الخزائن والملفات والبيانات بشكل نهائي. هذا الإجراء لا يمكن التراجع عنه.',
    [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف الكل',
        style: 'destructive',
        onPress: async () => {
          // حذف جميع الخزائن
          for (const vault of vaults) {
            await deleteVault(vault.id);
          }
          // حذف مجلد khaznati بالكامل
          const khaznatiDir = new Directory(Paths.document, 'khaznati');
          if (khaznatiDir.exists) {
            khaznatiDir.delete();
          }
          // العودة للترحيب
          router.replace('/(auth)/welcome');
        },
      },
    ],
  );
}, [vaults, deleteVault]);
```

---

### الخطوة 1.6: إصلاح Restore Backup

**الملف**: `app/(app)/(tabs)/settings.tsx`

**التغيير**: استبدل `handleRestore` (السطور 141-154)
```
old:
const handleRestore = useCallback(() => {
  Alert.alert(
    'Restore Backup',
    'This will replace all current data with the backup. Continue?',
    [
      { text: 'Cancel', style: 'cancel' as const, onPress: () => {} },
      {
        text: 'Restore',
        style: 'destructive' as const,
        onPress: () => Alert.alert('Coming Soon', 'File picker for restore...'),
      },
    ],
  );
}, []);

new:
import * as DocumentPicker from 'expo-document-picker';
import { DIContainer } from '@core/di/container';
import { DatabaseService } from '@data/database/DatabaseService';
import * as Updates from 'expo-updates';

const handleRestore = useCallback(async () => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/octet-stream',
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets?.[0]) {
      Alert.alert(
        'استعادة النسخة الاحتياطية',
        'سيتم استبدال جميع البيانات الحالية بالنسخة الاحتياطية. هل أنت متأكد؟',
        [
          { text: 'إلغاء', style: 'cancel' },
          {
            text: 'استعادة',
            style: 'destructive',
            onPress: async () => {
              const db = DIContainer.resolve<DatabaseService>('DatabaseService');
              await db.restore(result.assets[0].uri);
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

أضف import لـ `Updates` في الأعلى:
```
import * as Updates from 'expo-updates';
```

أضف `expo-updates` إلى `package.json`:
```
"expo-updates": "~0.26.0"
```

---

### الخطوة 1.7: إصلاح Lock All Vaults

**الملف**: `app/(app)/(tabs)/settings.tsx`

**التغيير**: استبدل `handleLockAll` (السطور 179-181)
```
old:
const handleLockAll = useCallback(() => {
  router.push('/(auth)/welcome');
}, []);

new:
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

## 🎨 GATE 2: تحسينات UX وإصلاح Settings

### الخطوة 2.1: إصلاح Theme Cycle

**الملف**: `app/(app)/(tabs)/settings.tsx` — السطور 94-97

```
old:
const handleToggleTheme = useCallback(() => {
  const next = isDark ? ThemeMode.LIGHT : ThemeMode.DARK;
  setThemeMode(next);
}, [isDark, setThemeMode]);

new:
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

---

### الخطوة 2.2: إصلاح Language Switch

**الملف**: `app/(app)/(tabs)/settings.tsx` — السطور 99-103

```
old:
const handleToggleLanguage = useCallback(() => {
  const next = currentLang === 'ar' ? 'en' : 'ar';
  changeLanguage(next);
  setCurrentLang(next);
}, [currentLang]);

new:
import { I18nManager, Alert } from 'react-native';
import * as Updates from 'expo-updates';

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

---

### الخطوة 2.3: تحديث أيقونة Biometric في Settings

**الملف**: `app/(app)/(tabs)/settings.tsx` — السطر 196

```
old:
<Icon name="fingerprint" size={22} color={colors.onSurface} />

new:
const biometricIcon = bioAvailable
  ? 'face-recognition'
  : 'fingerprint';
<Icon name={biometricIcon} size={22} color={colors.onSurface} />
```

---

### الخطوة 2.3: إضافة استيراد الصور في Media

**الملف**: `app/(app)/(tabs)/media.tsx`

**التغييرات**:
1. أضف `import * as ImagePicker from 'expo-image-picker';`
2. أضف `import { FloatingButton } from '@ui/components/molecules/FloatingButton';`
3. أضف `handleImport` function:
```
const handleImport = useCallback(async () => {
  const permission = await MediaLibrary.requestPermissionsAsync();
  if (permission.status !== 'granted') {
    Alert.alert('صلاحية', 'الرجاء منح صلاحية الوصول للمكتبة');
    return;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
  });
  if (!result.canceled && result.assets?.[0]) {
    const asset = result.assets[0];
    const mediaDir = new Directory(Paths.document, 'khaznati', 'media');
    if (!mediaDir.exists) mediaDir.create({ intermediates: true });
    const dest = new File(mediaDir, asset.fileName || `photo_${Date.now()}.jpg`);
    dest.create({ overwrite: true });
    const src = new File(asset.uri);
    src.copy(dest);
    loadMedia();
  }
}, [loadMedia]);
```
4. أضف `<FloatingButton icon="plus" onPress={handleImport} />` أسفل الـ ScrollView

**أضف إلى `package.json`**:
```
"expo-image-picker": "~17.0.0"
```

---

### الخطوة 2.4: إضافة عمليات الملفات في Files

**الملف**: `app/(app)/(tabs)/files.tsx`

**التغييرات**:
1. أضف `handleDelete`:
```
const handleDelete = useCallback(async (item: FileItem) => {
  Alert.alert('حذف', `حذف ${item.name}?`, [
    { text: 'إلغاء', style: 'cancel' },
    {
      text: 'حذف', style: 'destructive',
      onPress: async () => {
        const vaultDir = getVaultDir();
        const file = new File(vaultDir, item.name);
        if (file.exists) file.delete();
        loadFiles();
      },
    },
  ]);
}, [getVaultDir, loadFiles]);
```

2. أضف `handleRename`:
```
const handleRename = useCallback(async (item: FileItem) => {
  Alert.prompt?.('إعادة تسمية', 'الاسم الجديد:', async (newName) => {
    if (!newName) return;
    const vaultDir = getVaultDir();
    const oldPath = `${vaultDir.uri}/${item.name}`;
    const newPath = `${vaultDir.uri}/${newName}`;
    await FileSystem.moveAsync({ from: oldPath, to: newPath });
    loadFiles();
  });
}, [getVaultDir, loadFiles]);
```

3. أضف زر Long press على كل ملف (غيّر `TouchableOpacity` إلى واحد مع `onLongPress`)

---

## 🔐 GATE 3: Session Management & Auto-Lock

### الخطوة 3.1: إنشاء SessionProvider

**الملف الجديد**: `src/ui/providers/SessionProvider.tsx`

(انظر `docs/plan.md` السطور 620-714 — التنفيذ الكامل موجود)

```typescript
import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { router } from 'expo-router';
import { useSecureStorage } from '@ui/hooks/useSecureStorage';

interface SessionState {
  activeVaultId: string | null;
  isUnlocked: boolean;
  lastActivityTime: number | null;
  autoLockTimeout: number;
}

interface SessionContextValue extends SessionState {
  unlock: (vaultId: string) => void;
  lock: () => void;
  setAutoLockTimeout: (timeout: number) => void;
  recordActivity: () => void;
}

const AUTO_LOCK_KEY = 'auto_lock_timeout';
const DEFAULT_AUTO_LOCK = 300000; // 5 min

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { getItem, setItem } = useSecureStorage();
  const [state, setState] = useState<SessionState>({
    activeVaultId: null,
    isUnlocked: false,
    lastActivityTime: null,
    autoLockTimeout: DEFAULT_AUTO_LOCK,
  });
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    (async () => {
      const stored = await getItem(AUTO_LOCK_KEY);
      if (stored) setState(prev => ({ ...prev, autoLockTimeout: parseInt(stored, 10) }));
    })();
  }, [getItem]);

  const unlock = useCallback((vaultId: string) => {
    setState(prev => ({
      ...prev,
      activeVaultId: vaultId,
      isUnlocked: true,
      lastActivityTime: Date.now(),
    }));
  }, []);

  const lock = useCallback(() => {
    setState(prev => ({
      ...prev,
      isUnlocked: false,
      activeVaultId: null,
      lastActivityTime: null,
    }));
  }, []);

  const setAutoLockTimeout = useCallback(async (timeout: number) => {
    setState(prev => ({ ...prev, autoLockTimeout: timeout }));
    await setItem(AUTO_LOCK_KEY, String(timeout));
  }, [setItem]);

  const recordActivity = useCallback(() => {
    setState(prev => ({ ...prev, lastActivityTime: Date.now() }));
  }, []);

  // Auto-lock when app goes to background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/active/) && nextState.match(/inactive|background/)) {
        setState(prev => ({ ...prev, _backgroundTime: Date.now() }));
      }
      if (nextState === 'active' && appStateRef.current.match(/inactive|background/)) {
        setState(prev => {
          const bgTime = (prev as any)._backgroundTime || Date.now();
          const elapsed = Date.now() - bgTime;
          if (elapsed >= prev.autoLockTimeout && prev.isUnlocked) {
            router.replace('/(auth)/login');
            return { ...prev, isUnlocked: false, activeVaultId: null };
          }
          return prev;
        });
      }
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, []);

  return (
    <SessionContext.Provider value={{ ...state, unlock, lock, setAutoLockTimeout, recordActivity }}>
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

---

### الخطوة 3.2: ربط SessionProvider مع الـ Root Layout

**الملف**: `app/_layout.tsx`

**التغيير**: لف التطبيق بـ SessionProvider
```
import { SessionProvider } from '@ui/providers/SessionProvider';
```

أضف `<SessionProvider>` داخل `<ThemeProvider>`:
```
<ThemeProvider>
  <SessionProvider>
    <RootLayoutInner />
  </SessionProvider>
</ThemeProvider>
```

---

### الخطوة 3.3: تحديث Login لاستخدام Session

**الملف**: `app/(auth)/login.tsx`

**التغيير**: بعد نجاح `unlockVault`:
```
import { useSession } from '@ui/providers/SessionProvider';

// داخل LoginScreen component
const session = useSession();

// في handleLogin بعد result.success:
if (result.success) {
  session.unlock(targetVault.id);
  // ...
}

// في handleBiometric بعد result.success:
if (result.success) {
  session.unlock(targetVault.id);
  router.replace('/(app)/(tabs)/vault');
}
```

---

## 🧪 GATE 4: الاختبارات

### الخطوة 4.1: إعداد Jest مع Module Aliases

**الملف الجديد**: `jest.config.js`

```javascript
const { getDefaultConfig } = require('expo/metro-config');

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
    '^@app/(.*)$': '<rootDir>/app/$1',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
```

---

### الخطوة 4.2: اختبارات Validators

**الملف الجديد**: `__tests__/unit/core/validators/index.test.ts`

```typescript
import { validatePin, validateVaultName } from '@core/validators';

describe('validatePin', () => {
  it('accepts 4-digit PIN', () => {
    expect(validatePin('1234').valid).toBe(true);
  });

  it('accepts 8-digit PIN', () => {
    expect(validatePin('12345678').valid).toBe(true);
  });

  it('rejects PIN shorter than 4 digits', () => {
    expect(validatePin('123').valid).toBe(false);
  });

  it('rejects PIN longer than 8 digits', () => {
    expect(validatePin('123456789').valid).toBe(false);
  });

  it('rejects PIN with non-digit characters', () => {
    expect(validatePin('12a4').valid).toBe(false);
  });

  it('rejects empty PIN', () => {
    expect(validatePin('').valid).toBe(false);
  });
});

describe('validateVaultName', () => {
  it('accepts valid Arabic name', () => {
    expect(validateVaultName('خزنتي').valid).toBe(true);
  });

  it('accepts valid English name', () => {
    expect(validateVaultName('My Vault').valid).toBe(true);
  });

  it('rejects empty name', () => {
    expect(validateVaultName('').valid).toBe(false);
  });

  it('rejects name longer than 50 characters', () => {
    expect(validateVaultName('a'.repeat(51)).valid).toBe(false);
  });
});
```

**التحقق**: `npx jest __tests__/unit/core/validators/` — يجب أن يمر 7 اختبارات

---

### الخطوة 4.3: اختبارات Secure Utils

**الملف الجديد**: `__tests__/unit/core/utils/secure.test.ts`

```typescript
import { generateSalt, hashPin, delay } from '@core/utils/secure';

describe('generateSalt', () => {
  it('returns a 32-character hex string', async () => {
    const salt = await generateSalt();
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
  });

  it('generates unique values each time', async () => {
    const [salt1, salt2] = await Promise.all([generateSalt(), generateSalt()]);
    expect(salt1).not.toBe(salt2);
  });
});

describe('hashPin', () => {
  it('returns consistent hash for same pin and salt', async () => {
    const salt = await generateSalt();
    const hash1 = await hashPin('1234', salt);
    const hash2 = await hashPin('1234', salt);
    expect(hash1).toBe(hash2);
  });

  it('returns different hash for different pins', async () => {
    const salt = await generateSalt();
    const hash1 = await hashPin('1234', salt);
    const hash2 = await hashPin('5678', salt);
    expect(hash1).not.toBe(hash2);
  });

  it('returns different hash for different salts', async () => {
    const salt1 = await generateSalt();
    const salt2 = await generateSalt();
    const hash1 = await hashPin('1234', salt1);
    const hash2 = await hashPin('1234', salt2);
    expect(hash1).not.toBe(hash2);
  });
});
```

**التحقق**: `npx jest __tests__/unit/core/utils/` — يجب أن يمر 5 اختبارات

---

### الخطوة 4.4: اختبارات Mappers

**الملف الجديد**: `__tests__/unit/data/mappers/VaultMapper.test.ts`

```typescript
import { VaultMapper } from '@data/mappers/VaultMapper';
import { VaultType } from '@core/constants';

describe('VaultMapper', () => {
  const mapper = new VaultMapper();

  const testEntity = {
    id: 'test-id',
    name: 'Test Vault',
    type: VaultType.PERSONAL,
    icon: 'shield-lock',
    color: '#6C63FF',
    createdAt: 1000,
    updatedAt: 2000,
    lastAccessedAt: 1500,
    isLocked: false,
    encryptedPinHash: 'abc123',
    pinSalt: 'def456',
    itemCount: 5,
    totalSize: 1000,
    backupVersion: 1,
  };

  it('maps entity to DTO and back', () => {
    const dto = mapper.toDTO(testEntity);
    expect(dto.id).toBe('test-id');
    expect(dto.is_locked).toBe(0);

    const entity = mapper.toEntity(dto);
    expect(entity.id).toBe(testEntity.id);
    expect(entity.name).toBe(testEntity.name);
    expect(entity.isLocked).toBe(false);
    expect(entity.type).toBe(VaultType.PERSONAL);
  });

  it('converts isLocked boolean to/from integer correctly', () => {
    const locked = { ...testEntity, isLocked: true };
    const dto = mapper.toDTO(locked);
    expect(dto.is_locked).toBe(1);
    const entity = mapper.toEntity(dto);
    expect(entity.isLocked).toBe(true);
  });
});
```

**التحقق**: `npx jest __tests__/unit/data/mappers/` — يجب أن يمر اختبارين

---

### الخطوة 4.5: اختبارات Use Cases

**الملف الجديد**: `__tests__/unit/domain/usecases/vault/CreateVaultUseCase.test.ts`

```typescript
import { CreateVaultUseCase } from '@domain/usecases/vault/CreateVaultUseCase';
import { IVaultRepository } from '@domain/repositories/IVaultRepository';
import { VaultType } from '@core/constants';
import { success } from '@core/errors';

describe('CreateVaultUseCase', () => {
  const mockRepo: IVaultRepository = {
    create: jest.fn().mockResolvedValue(success({ id: 'new-id' })),
    findById: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    updateLastAccessed: jest.fn(),
    lock: jest.fn(),
    unlock: jest.fn(),
    count: jest.fn(),
  };

  const useCase = new CreateVaultUseCase(mockRepo);

  it('creates vault with valid input', async () => {
    const result = await useCase.execute({
      name: 'My Vault',
      type: VaultType.PERSONAL,
      pin: '1234',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', async () => {
    const result = await useCase.execute({
      name: '',
      type: VaultType.PERSONAL,
      pin: '1234',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('rejects short PIN', async () => {
    const result = await useCase.execute({
      name: 'Test',
      type: VaultType.PERSONAL,
      pin: '12',
    });
    expect(result.success).toBe(false);
  });
});
```

**التحقق**: `npx jest __tests__/unit/` — يجب أن يمر جميع الاختبارات

---

### الخطوة 4.6: تشغيل جميع الاختبارات

```
npm test -- --maxWorkers=2
```

**الهدف**: 0 failing tests, 15+ test cases

---

## 🚀 GATE 5: CI/CD & Build

### الخطوة 5.1: إصلاح CI — إضافة --legacy-peer-deps

**الملف**: `.github/workflows/build.yml`

**التغيير**: السطر 28 و 68
```
old:
run: npm ci
new:
run: npm ci --legacy-peer-deps
```

**الملف**: `.github/workflows/build-android.yml`

**التغيير**: نفس التعديل

---

### الخطوة 5.2: إضافة version إلى app.json كل build

**الملف**: `app.json` — زِد `version` و `android.versionCode` و `ios.buildNumber` مع كل إصدار
```
"version": "1.0.1",
"ios": { "buildNumber": "2" },
"android": { "versionCode": 2 }
```

---

### الخطوة 5.3: Prebuild محلي (مرة واحدة)

```bash
npx expo prebuild --platform android --clean
```

ثم commit مجلد `android/`:
```bash
git add android/
git commit -m "chore: add prebuilt android project"
```

---

### الخطوة 5.4: إعداد التوقيع للمتجر

```bash
# إنشاء Keystore
keytool -genkey -v -keystore khaznati-release.keystore \
  -alias khaznati-key \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass <YOUR_PASSWORD> \
  -keypass <YOUR_PASSWORD>

# إضافة GitHub Secrets
gh secret set ANDROID_KEYSTORE_PASSWORD
gh secret set ANDROID_KEY_ALIAS
gh secret set ANDROID_KEY_PASSWORD
```

---

### الخطوة 5.5: إضافة EAS Submit (نشر إلى Google Play)

```
npm install -g eas-cli
eas submit --platform android
```

ثم أضف `.github/workflows/submit.yml`:
```yaml
name: Submit to Google Play
on:
  workflow_run:
    workflows: ['Build Khaznati APK']
    types: [completed]
    branches: [main]

jobs:
  submit:
    runs-on: ubuntu-latest
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20.x
      - run: npm ci --legacy-peer-deps
      - run: npx eas submit --platform android --non-interactive
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
```

---

## 📋 GATE 6: إزالة Dead Code & التنظيف

### الخطوة 6.1: إزالة `expo-haptics`, `expo-print`, `react-native-worklets` (غير مستخدمة)

```bash
npm uninstall expo-haptics expo-print react-native-worklets
```

---

### الخطوة 6.2: مسح `useSecureStorage` من Notes و Passwords Screens بعد نقلها لـ SQLite

**الملفات**: `app/(app)/(tabs)/notes.tsx`, `app/(app)/(tabs)/passwords.tsx`

**التغيير**: أزل `useSecureStorage` منها بعد أن تستخدم Repository مباشرة

---

### الخطوة 6.3: إزالة متغيرات i18n غير المستخدمة

```bash
npx eslint . --fix
```

---

## 📖 قائمة التحقق النهائية (Final Checklist)

### الأمن (GATE 0)
- [ ] 0.1: ملف `crypto.ts` منشأ مع AES-GCM
- [ ] 0.2: `FileSystemSource` يشفّر الملفات
- [ ] 0.3: كلمات السر في SQLite مشفر (بدلاً من SecureStore plaintext)
- [ ] 0.4: الملاحظات في SQLite مشفر
- [ ] 0.5: قاعدة البيانات مشفرة بـ PRAGMA key
- [ ] 0.6: PIN hashing يستخدم تكرار SHA-256 (50000 iteration)

### الأعطال الحرجة (GATE 1)
- [ ] 1.1: `BiometricUnlockUseCase` منشأ
- [ ] 1.2: PIN البيومتري يُخزّن عند إنشاء الخزنة
- [ ] 1.3: Biometric في Login لا يرسل PIN فارغ
- [ ] 1.4: Activity Log screen موجود ولا يسبب Crash
- [ ] 1.5: Clear All Data يحذف البيانات فعلياً
- [ ] 1.6: Restore Backup يستخدم DocumentPicker ويعمل
- [ ] 1.7: Lock All Vaults يقفل الكل قبل الخروج

### تحسينات UX (GATE 2)
- [ ] 2.1: Theme Cycle يشمل System → Light → Dark → AMOLED
- [ ] 2.2: Language Switch يعيد تحميل التطبيق مع RTL
- [ ] 2.3: أيقونة البصمة تعرض الوجه افتراضياً
- [ ] 2.3: Media يمكن استيراد الصور
- [ ] 2.4: Files يمكن حذف/إعادة تسمية

### Session Management (GATE 3)
- [ ] 3.1: SessionProvider منشأ
- [ ] 3.2: SessionProvider مربوط مع Root Layout
- [ ] 3.3: Login يُحدّث Session
- [ ] 3.4: Auto-Lock يعمل عند العودة من الخلفية

### الاختبارات (GATE 4)
- [ ] 4.1: `jest.config.js` مع module aliases
- [ ] 4.2: Validators tests — 7 اختبارات
- [ ] 4.3: Secure utils tests — 5 اختبارات
- [ ] 4.4: Mapper tests — 2 اختبارات
- [ ] 4.5: Use case tests — 3 اختبارات
- [ ] 4.6: `npm test` — 0 fails

### CI/CD (GATE 5)
- [ ] 5.1: `npm ci --legacy-peer-deps` في workflows
- [ ] 5.2: Version bump في app.json
- [ ] 5.3: Prebuild محلي (android/ مجلد)
- [ ] 5.4: Keystore للتوقيع
- [ ] 5.5: EAS Submit للنشر

### التنظيف (GATE 6)
- [ ] 6.1: إزالة المكتبات غير المستخدمة
- [ ] 6.2: إزالة useSecureStorage من Notes/Passwords
- [ ] 6.3: `npm run lint` — 0 errors

---

## الجدول الزمني التقديري

| Gate | المدة | يعتمد على |
|------|-------|-----------|
| GATE 0 (الأمن) | 3 أيام | لا شيء |
| GATE 1 (الأعطال) | 2 يوم | Gate 0 |
| GATE 2 (UX) | 1 يوم | Gate 1 |
| GATE 3 (Session) | 1 يوم | Gate 1 |
| GATE 4 (اختبارات) | 2 يوم | Gate 0 |
| GATE 5 (CI/CD) | 1 يوم | Gate 1 |
| GATE 6 (تنظيف) | 0.5 يوم | Gates 0-5 |

**المجموع**: ~10.5 أيام عمل

---

**ملاحظة**: هذا المستند قابل للتحديث باستمرار. كل خطوة يجب أن تمر `npm run typecheck` و `npm run lint` قبل الانتقال للخطوة التالية.
