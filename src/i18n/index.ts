import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { I18nManager } from 'react-native';
import type { AppLanguagePreference } from '../types/media';

import en from './locales/en.json';
import he from './locales/he.json';

const i18n = createInstance();
const rtlChangeListeners = new Set<(isRtl: boolean) => void>();

const resources = {
  en: { translation: en },
  he: { translation: he }
};

export type SupportedAppLanguage = 'en' | 'he';
export type AppLayoutDirection = 'ltr' | 'rtl';

const initialLanguage = resolveAppLanguage('system');
let currentIsRtl = initialLanguage === 'he';
applyNativeRtlPreference(currentIsRtl);

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
  const shouldUseRtl = language === 'he';
  const rtlChanged = currentIsRtl !== shouldUseRtl;
  applyNativeRtlPreference(shouldUseRtl);

  if (i18n.language !== language) {
    await i18n.changeLanguage(language);
  }

  if (rtlChanged) {
    currentIsRtl = shouldUseRtl;
    notifyRtlChanged(shouldUseRtl);
  }

  return rtlChanged;
}

export function getCurrentLayoutDirection(): AppLayoutDirection {
  return currentIsRtl ? 'rtl' : 'ltr';
}

export function onRtlLayoutChange(listener: (isRtl: boolean) => void): () => void {
  rtlChangeListeners.add(listener);
  return () => rtlChangeListeners.delete(listener);
}

function notifyRtlChanged(isRtl: boolean) {
  rtlChangeListeners.forEach((listener) => listener(isRtl));
}

function applyNativeRtlPreference(shouldUseRtl: boolean) {
  I18nManager.allowRTL(shouldUseRtl);
  I18nManager.forceRTL(shouldUseRtl);
}

export default i18n;
