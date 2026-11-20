import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { I18nManager } from 'react-native';
import type { AppLanguagePreference } from '../types/media';

import en from './locales/en.json';
import he from './locales/he.json';

const i18n = createInstance();

const resources = {
  en: { translation: en },
  he: { translation: he }
};

export type SupportedAppLanguage = 'en' | 'he';

const initialLanguage = resolveAppLanguage('system');
let languageSync: Promise<unknown> = Promise.resolve();

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false
  }
});

export function getSystemAppLanguage(): SupportedAppLanguage {
  try {
    const languageTag = getLocales()?.[0]?.languageTag ?? 'en';
    return /^(he|iw)(?:[-_]|$)/i.test(languageTag.trim()) ? 'he' : 'en';
  } catch { return 'en'; }
}

export function resolveAppLanguage(preference: AppLanguagePreference = 'system'): SupportedAppLanguage {
  if (preference === 'en' || preference === 'he') return preference;
  return getSystemAppLanguage();
}

/** Call after the preference commits. True means this runtime still needs a restart. */
export function syncI18nLanguage(preference: AppLanguagePreference = 'system'): Promise<boolean> {
  const synchronize = async () => {
    const language = resolveAppLanguage(preference);
    const desiredRtl = language === 'he';
    I18nManager.allowRTL(desiredRtl);
    I18nManager.forceRTL(desiredRtl);
    if (i18n.language !== language) await i18n.changeLanguage(language);
    return desiredRtl !== I18nManager.isRTL;
  };
  const result = languageSync.then(synchronize, synchronize);
  languageSync = result;
  void result.catch(() => undefined);
  return result;
}

export default i18n;
