import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import pl from './pl.json';
import uk from './uk.json';

const stored =
  typeof localStorage !== 'undefined' ? localStorage.getItem('aklima:lang') : null;

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      pl: { translation: pl },
      uk: { translation: uk },
    },
    lng: stored ?? 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

export function setLanguage(lang: 'en' | 'pl' | 'uk'): void {
  i18n.changeLanguage(lang);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('aklima:lang', lang);
  }
}

export default i18n;
