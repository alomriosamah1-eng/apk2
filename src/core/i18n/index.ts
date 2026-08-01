import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';
import ar from './locales/ar.json';
import en from './locales/en.json';
import { SecureStorageSource } from '@data/datasources/SecureStorageSource';

const LANGUAGE_KEY = 'app_language';
const secureStorage = new SecureStorageSource();

i18n.use(initReactI18next);

/** Initializes i18next using the persisted language, defaulting to Arabic. */
export async function initI18n(): Promise<void> {
  let storedLang: string | null = null;
  try {
    storedLang = await secureStorage.get(LANGUAGE_KEY);
  } catch {
    // Secure storage may be unavailable (e.g. unit tests); fall back to default.
  }
  const lang: 'ar' | 'en' = storedLang === 'ar' || storedLang === 'en' ? storedLang : 'ar';

  await i18n.init({
    resources: {
      ar: { translation: ar },
      en: { translation: en },
    },
    lng: lang,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    compatibilityJSON: 'v4',
  });

  applyTextDirection(lang);
}

function applyTextDirection(lang: 'ar' | 'en'): void {
  const isArabic = lang === 'ar';
  I18nManager.forceRTL(isArabic);
  I18nManager.swapLeftAndRightInRTL(isArabic);
}

export function changeLanguage(lang: 'ar' | 'en'): void {
  void i18n.changeLanguage(lang);
  applyTextDirection(lang);
  secureStorage.set(LANGUAGE_KEY, lang).catch(() => {});
}

export function getCurrentLanguage(): 'ar' | 'en' {
  return (i18n.language?.startsWith('ar') ? 'ar' : 'en') as 'ar' | 'en';
}

export default i18n;
