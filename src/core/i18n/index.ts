import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { I18nManager } from 'react-native';
import ar from './locales/ar.json';
import en from './locales/en.json';

const systemLocales = getLocales();
const systemLanguage = systemLocales.length > 0
  ? systemLocales[0]?.languageCode?.toLowerCase()
  : undefined;

const isRTL = systemLocales.some((l) => l.textDirection === 'rtl');

I18nManager.forceRTL(isRTL);
I18nManager.swapLeftAndRightInRTL(isRTL);

void i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: ar },
    en: { translation: en },
  },
  lng: systemLanguage === 'ar' ? 'ar' : 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  compatibilityJSON: 'v4',
});

export default i18n;

export function changeLanguage(lang: 'ar' | 'en'): void {
  void i18n.changeLanguage(lang);
  const isArabic = lang === 'ar';
  if (I18nManager.isRTL !== isArabic) {
    I18nManager.forceRTL(isArabic);
    I18nManager.swapLeftAndRightInRTL(isArabic);
  }
}

export function getCurrentLanguage(): 'ar' | 'en' {
  return (i18n.language?.startsWith('ar') ? 'ar' : 'en') as 'ar' | 'en';
}
