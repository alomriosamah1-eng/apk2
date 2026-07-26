# رحلة المستخدم (User Flow)

## Overview

The user journey spans from first launch to full app usage, with Arabic as the primary language.

## Flow Diagram

```
index.tsx
    │
    ▼
Welcome Screen (ترحيب)
    │
    ├── "ابدأ الآن" → Create Vault Wizard
    │
    └── "لدي خزنة بالفعل" → Login Screen
                                    │
Create Vault Wizard                  │
    │                                │
    ├── اسم الخزنة                    │
    ├── اختيار أيقونة                  │
    ├── اختيار لون                    │
    ├── كلمة المرور + strength meter  │
    ├── تأكيد كلمة المرور              │
    └── إنشاء الخزنة ──┐              │
                       │              │
                       ▼              ▼
              Biometric Setup ←── Login Screen
                       │
               ┌───────┴───────┐
               ▼               ▼
         تفعيل البصمة      تخطي الآن
               │               │
               └───────┬───────┘
                       ▼
              Vault Home (الخزنة)
                       │
               ┌───────┼───────┐───────┐───────┐───────┐
               ▼       ▼       ▼       ▼       ▼       ▼
             Files   Media   Notes  Passwords  Settings
```

## Edge Cases Handled

| Case | Handler |
|------|---------|
| First launch, no vault | Welcome → Create Vault (cannot reach login) |
| Returning user | Welcome → Login (or auto-login via remember-me) |
| Wrong password | Error message, clear field, retry |
| Empty password | Validation before submit, button disabled |
| Vault not found | "لا توجد خزنة مسجلة" + create button |
| Biometric unavailable | Hide biometric button |
| Biometric cancelled | Return to password entry |
| Biometric failed | Error message, fallback to password |
| Remember me | Stores token in SecureStorage |
| Session timeout | Navigate to welcome screen |
| Database init failure | Error logged, retry on next launch |
