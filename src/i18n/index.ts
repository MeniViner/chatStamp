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
applyRtlPreference(initialLanguage);

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false
  }
});

export function getSystemAppLanguage(): SupportedAppLanguage {
  const locales = getLocales();
  const languageTag = locales?.[0]?.languageTag ?? 'en';
  return languageTag.startsWith('he') ? 'he' : 'en';
}

export function resolveAppLanguage(preference: AppLanguagePreference = 'system'): SupportedAppLanguage {
  if (preference === 'en' || preference === 'he') return preference;
  return getSystemAppLanguage();
}

/**
 * Syncs the i18n instance with the desired preference.
 * Returns true if the layout direction (RTL/LTR) was changed, 
 * suggesting a restart might be needed for full layout application.
 */
export async function syncI18nLanguage(preference: AppLanguagePreference = 'system'): Promise<boolean> {
  const language = resolveAppLanguage(preference);
  const rtlChanged = applyRtlPreference(language);

  if (i18n.language !== language) {
    await i18n.changeLanguage(language);
  }

  return rtlChanged;
}

function applyRtlPreference(language: SupportedAppLanguage): boolean {
  const shouldUseRtl = language === 'he';
  if (I18nManager.isRTL === shouldUseRtl) return false;
  
  I18nManager.allowRTL(shouldUseRtl);
  I18nManager.forceRTL(shouldUseRtl);
  return true;
}

export default i18n;
