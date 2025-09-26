// i18n.ts
import { I18n } from 'i18n-js';
import { getLocales } from 'expo-localization';

import en from './locales/en.json';
import pt from './locales/pt.json';

// Create a new i18n instance without initial translations
const i18n = new I18n();

// Explicitly set the available translations
i18n.translations = {
  en,
  pt,
};

// --- DEBUGGING ---
// Log the detected device locales to the terminal
const locales = getLocales();
// console.log('DETECTED LOCALES:', JSON.stringify(locales, null, 2));
// --- END DEBUGGING ---

// Set the locale once at the beginning of your app.
i18n.locale = 'pt'; // Force the app to always start in Portuguese

// When a value is missing from a language it'll fallback to another language.
i18n.enableFallback = true;
i18n.defaultLocale = 'pt';

export default i18n;