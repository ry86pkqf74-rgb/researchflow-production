/**
 * i18n Configuration (Task 90)
 *
 * Internationalization setup using i18next.
 * Supports multiple languages with lazy loading.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import locale files
import en from './locales/en.json';
import es from './locales/es.json';

const FEATURE_I18N = import.meta.env.VITE_FEATURE_I18N !== 'false';

// Available languages
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]['code'];

// Resources bundled with the app
const resources = {
  en: { translation: en },
  es: { translation: es },
};

// Initialize i18next
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: import.meta.env.DEV,

    interpolation: {
      escapeValue: false, // React already escapes
    },

    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'ros-language',
      caches: ['localStorage'],
    },

    // Only enable if feature flag is set
    lng: FEATURE_I18N ? undefined : 'en',
  });

/**
 * Change the current language
 */
export function changeLanguage(lang: SupportedLanguage): Promise<void> {
  return i18n.changeLanguage(lang) as Promise<void>;
}

/**
 * Get the current language
 */
export function getCurrentLanguage(): string {
  return i18n.language;
}

/**
 * Check if a language is supported
 */
export function isLanguageSupported(lang: string): lang is SupportedLanguage {
  return SUPPORTED_LANGUAGES.some((l) => l.code === lang);
}

export default i18n;
