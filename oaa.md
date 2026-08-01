# تقرير التدقيق الهندسي الشامل — تطبيق خزنتي v1.0.0

> الوضع: تدقيق فقط (فحص بدون تعديل) — تم الانتهاء وكتابة التقرير.

## 1. حالة المشروع والإنجازات السابقة

| البند | الحالة |
|---|---|
| **البناء #14** (`bca02ed`) | ✅ نجح بالكامل — `Build Android APK` + `Verify Code Quality` |
| **الـ artifact** | `khaznati-release` (45MB zip / **96MB APK**) — مرفوع وبحالة صالحة |
| **الإصدار v1.0.0** | Tag مدفوع على `3ef7cff` (لكنه **متقدم عن HEAD بـ 4 commits**) |
| **Secrets التوقيع** | ❌ **الأربعة غير مضبوطة بعد** → كل APK يبني بـ **debug signing** |
| **توقيع الـ APK** | v2/v3 signature present، لكن بصمة المفتاح غير قابلة للاستخراج (debug fallback) |
| **git** | `main` نظيف (فقط `package.json` غير مُلتزم + `khaznati-release*` غير متتبع) |

**ما أُصلح سابقاً**: build.yml أعيدت كتابته (timeout/Java/إعدادات Gradle/`-x lint`)، أُصلح خطأ `secrets` في `if`، refactor للملفات والوسائط، وأُولد keystore إصدار.

---

## 2. أولوية قصوى — المشكلات الجذرية المؤكدة

### 🔴 P0-1: `app/index.tsx` يعيد التوجيه دائماً إلى `(auth)/welcome`
`app/index.tsx:4` — **لا يوجد أي فحص للجلسة أو خزنة مفعلة**.
هذا وحده يفسر: **"تغيير اللغة يعيد لتسجيل الدخول"** (بعد `Updates.reloadAsync()` يُعاد فتح التطبيق → welcome) و**"لا يُحفظ الدخول"**.

### 🔴 P0-2: لا توجد حراسة (route guard) لمسار `(app)`
`app/(app)/_layout.tsx` — لا يفحص `session.isUnlocked`. أي deep link إلى `/(app)/(tabs)/vault` يتجاوز تسجيل الدخول بالكامل.

### 🔴 P0-3: إنشاء الملاحظات وكلمات المرور معطل من زر الإضافة
`AddOptionsSheet.tsx:66-74` — `handleWriteNote`/`handleAddPassword` يدفعان إلى `notes`/`passwords` **بدون `vaultId`** → `vaultId=''` في `notes.tsx:25` → إدراج بـ `vault_id=''` → **انتهاك Foreign Key** (`schema.ts:52`, مع `PRAGMA foreign_keys=ON` في `DatabaseService.ts:41`) → الفشل صامت (لا يُعرض خطأ).

### 🔴 P0-4: الملفات/الصور المستوردة مخزنة **نصاً صريحاً (غير مشفرة)**
- `AddOptionsSheet.importToVault` ينسخ الملف إلى `khaznati/<vaultId>/` **بدون تشفير وبدون تسجيل في قاعدة البيانات** (`AddOptionsSheet.tsx:29-40`).
- `files.tsx` يعرض محتويات المجلد مباشرة (`files.tsx:62-73`) والملفات نص صريح.
- الصور المستوردة من Add sheet لا تظهر أبداً في تبويب الوسائط (يقيس `.encrypted_media` فقط). → **"استيراد الصور/الفيديو/الملفات معطل"**.
- الادعاء بـ"تشفير الملفات" في واجهة About **غير صحيح**.

### 🔴 P0-5: `PRAGMA key` لا يفعل شيئاً — قاعدة البيانات غير مشفرة فعلياً
`DatabaseService.ts:32-35` — `expo-sqlite` **لا يدعم** `PRAGMA key` (خاص بـ SQLCipher). الخطأ يُبتلع بصمت و"تستمر بدون تشفير". البيانات المخزنة في SQLite نص صريح.

### 🔴 P0-6: `crypto.ts` ليس AES-256-GCM — وهو بطيء جداً
`about.tsx:13` يعلن "تشفير AES-256-GCM" لكن `crypto.ts` ينفذ **شيفرة تيار XOR مخصصة** مبنية على SHA-256 بلا GCM حقيقي. لكل 32 بايت يستدعي `digestStringAsync` بالتتابع → تشفير/فك صورة كبيرة يستغرق دقائق. **هذا هو سبب "التطبيق ثقيل وبطيء في معالجة الوسائط".**

### 🔴 P0-7: `hashPin` — 100,000 تكرار متتابع await
`secure.ts:48-57` — كل تسجيل دخول/إنشاء خزنة ينفذ 100 ألف عملية `await digestStringAsync` عبر الجسر → تسجيل الدخول بطيء جداً.

---

## 3. أسباب "التطبيق ثقيل/بطيء"

| # | السبب | الدليل |
|---|---|---|
| 1 | APK بـ **4 ABIs** (arm64, armv7, x86, x86_64) = **75MB من ملفات .so** | `gradle.properties`: `reactNativeArchitectures=all` |
| 2 | **R8/minify معطل** (default `false`) | `build.gradle:125` |
| 3 | `enableProguardInRelease` لا يتفعل تلقائياً | `app.json:44` |
| 4 | `assetBundlePatterns: "**/*"` يضمّ كل شيء | `app.json:50` |
| 5 | استدعاء `fs.statSync` متزامن لكل وحدة في Metro | `metro.config.js:7-43` |
| 6 | تشفير مخصص بطيء لكل بايتات الملف | `crypto.ts:30-236` |
| 7 | `withRetry` يلفّ كل استعلام بثلاث محاولات وbackoff | `resilience.ts` |

---

## 4. أسباب المشاكل الوظيفية المبلغ عنها

| المشكلة | السبب الجذري | الملف:سطر |
|---|---|---|
| **تغيير اللغة يعيد للدخول** | `index.tsx` دائمًا → welcome + `Updates.reloadAsync()` | `index.tsx:4`, `settings.tsx:116-124` |
| **اللغة لا تتغير فعلياً** | لا يوجد تخزين للغة؛ i18n يعيد التهيئة من لغة النظام عند الإقلاع | `i18n/index.ts:18-29` |
| **لا حفظ للجلسة** | `isUnlocked/activeVaultId` في الذاكرة فقط؛ remember-me يُخزن ولا يُقرأ | `SessionProvider.tsx`, `login.tsx:19` |
| **الثيم لا يُحفظ** | `ThemeProvider` يبدأ بـ SYSTEM بلا persistence | `ThemeProvider.tsx:24` |
| **إنشاء ملاحظات معطل** | انتقال بدون `vaultId` → FK violation | `AddOptionsSheet.tsx:66`, `schema.ts:52` |
| **استيراد الوسائط معطل** | Add sheet يكتب لمجلد آخر غير المُقرأ | `AddOptionsSheet.tsx:29-64`, `media.tsx:36` |
| **استيراد ملفات نص صريح** | `copyImportedFile` بلا تشفير | `files.tsx:22-31` |
| **إعدادات لا تُعكس** | قيم افتراضية ثابتة بلا قراءة من التخزين | `settings.tsx:59-62` |
| **تبويب "قفل سريع" على iOS** | يدفع لـ welcome وليس قفل فعلي | `vault.tsx:67-72` |
| **إعدادات SecureStore لا تُقرأ عند التحميل** | `bioEnabled/clipboard/autoLock` بلا تهيئة من الذاكرة | `settings.tsx` |
| **تصدير الصور ينتج ملف تالف** | `tempFile.write(decryptedBase64)` يكتب النص وليس الباينري | `media.tsx:158` |
| **أيقونات التطبيق فارغة 1×1** | `icon.png/splash.png/android-icon-foreground.png` كلها 69 بايت 1×1 | `assets/` |
| **الوعد بـ AES-256-GCM غير حقيقي** | شيفرة تيار XOR مخصصة | `about.tsx:13`, `crypto.ts` |
| **`biometric-setup.tsx` غير مرتبط** | شاشة بيومترية ميتة، لا يُنتقل إليها أبداً | `create-vault.tsx:67-69` |
| **نسخة التطبيق ثابتة versionCode 1** | كل إصدار بـ `versionCode 1` → مشاكل تحديث/تثبيت | `build.gradle:95` |
| **ترجمات ناقصة** | 3 مفاتيح plural مفقودة في `ar.json` | locales |

---

## 5. إيجابيات (مبنية بشكل صحيح)
- الطبقات نظيفة (domain/data/ui), DI صحيح بدون دوائر، migrations تعمل (`user_version` + جدول `_migrations`).
- تدفق القفل/الفتح مع lockout بعد 5 محاولات سليم منطقياً.
- `tsc` نظيف (exit 0)، و27 اختبار موجودة في `__tests__/`.
- workflow مبني الآن بشكل صحيح (cache, timeout, warm-up) — البناء #14 اكتمل في زمن مقبول.

---

## 6. خطة الإصلاح المقترحة (بالأولوية)

**المرحلة A — الجلسة والتوجيه** (يصلح 4 مشاكل):
1. `app/index.tsx`: فحص `SecureStore` لـ `remember` + `SessionProvider` → إعادة توجيه ذكية (vault مفعلة / login / welcome).
2. إضافة حراسة في `app/(app)/_layout.tsx` تفحص `session.isUnlocked`.
3. تمرير `vaultId` من `AddOptionsSheet` (استخدام الخزنة النشطة).

**المرحلة B — التشفير الحقيقي**:
4. استبدال `crypto.ts` بمعيار حقيقي (AES-GCM عبر مكتبة ناضجة مثل `react-native-quick-crypto`، أو دمج SQLCipher) — أو على الأقل تصحيح الادعاءات في الواجهة.
5. تشفير ملفات الخزنة عبر `FileSystemSource` الحقيقي بدل النسخ المباشر.
6. إزالة `PRAGMA key` الوهمي أو دمج مكتبة تشفير SQLite فعلية.

**المرحلة C — الأداء والحجم**:
7. `gradle.properties`: `reactNativeArchitectures=arm64-v8a` فقط + `enableMinifyInReleaseBuilds=true` → APK من 96MB إلى ~30MB.
8. استبدال `await digestStringAsync` في `hashPin`/`encryptData` بتكرار غير متتالٍ أو مكتبة ناضجة.

**المرحلة D — الحالة والتفضيلات**:
9. Persist للغة (`SettingsRepositoryImpl.language`) وإعادة تهيئة i18n منها.
10. Persist للثيم في `ThemeProvider`.
11. إصلاح `handleExport` في `media.tsx` (كتابة باينري).
12. حذف مجلدات الأيقونات الفارغة ووضع أيقونات حقيقية.

**المرحلة E — الإصدار**:
13. رفع `versionCode` ديناميكياً، إضافة Secrets الأربعة، وإعادة بناء وإصدار `v1.0.1`.

---

*كتب في 2026-08-01 ضمن وضع التدقيق (بدون تعديل الملفات).*
