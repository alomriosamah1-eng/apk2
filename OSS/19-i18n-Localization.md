# 19 — i18n & Localization

## 19.1 Setup (`src/core/i18n/index.ts`)

- Library: **i18next + react-i18next** (`:1-2`).
- Sources: `locales/ar.json`, `locales/en.json` (`:5-6`).
- System language from `expo-localization` `getLocales()` (`:8-11`).
- **RTL forced at import**: `I18nManager.forceRTL(isRTL)` + `swapLeftAndRightInRTL(isRTL)` where `isRTL` = any locale has `textDirection==='rtl'` (`:13-16`).
- Init: `lng = systemLanguage==='ar' ? 'ar':'en'`, `fallbackLng='en'`, `compatibilityJSON:'v4'` (`:18-29`).

## 19.2 API

| Function | Behavior | Line |
|---|---|---|
| default `i18n` | instance | `:31` |
| `changeLanguage(lang)` | change + forceRTL/swap when mismatch | `:33-40` |
| `getCurrentLanguage()` | 'ar' if language startsWith 'ar' else 'en' | `:42-44` |

## 19.3 Usage in Screens

Every screen uses `useTranslation()` → `t('key')`. Examples:
- `welcome.tsx:2,14` — `t('app.name')`, `t('welcome.features.*')`.
- `settings.tsx:6,58` — theme/language labels; language toggle calls `changeLanguage` + `Updates.reloadAsync()` (`:116-124`).
- `passwords.tsx:5` — `t('passwords.categories.*')`.
- `about.tsx` — `t('about.*')` for vision/mission/values/timeline.

## 19.4 Locale Files

| File | Coverage | Notes |
|---|---|---|
| `ar.json` | full UI (auth, tabs, settings, modals, errors, common) | Arabic-first |
| `en.json` | full UI | fallback |

Both contain namespaces like `app`, `common`, `errors`, `auth`, `vault`, `files`, `media`, `notes`, `passwords`, `settings`, `activityLog`, `about`, `welcome`. Translations were authored during the "Arabic rewrite" phase (see `docs/vault-system/10-final-report.md`).

## 19.5 RTL Handling Summary

| Aspect | Implementation |
|---|---|
| Direction at boot | `I18nManager.forceRTL(systemRTL)` (`:15`) |
| Direction on switch | `changeLanguage()` (`:36-39`) |
| Layout flip | `swapLeftAndRightInRTL` (boot + switch) |
| Manual RTL overrides | `vault.tsx:169` `writingDirection:'rtl'` on card label |
| Font | Cairo supports Arabic |

## 19.6 Gaps / Observations

1. `activity-log.tsx:79` hardcodes `toLocaleString('ar')` regardless of selected language.
2. `settings.tsx:314` shows `'العربية'` hardcoded for the Arabic label; English label uses `t('settings.english')`.
3. Language preference is **not persisted** (state only in settings screen); app reloads use system locale.
4. `biometric-setup` uses `t('settings.biometricAuthPrompt')` for its prompt message — cross-namespace reuse.
5. `en.json` referenced a `files.fileType` key used with interpolation (`file-preview.tsx:101`).
