import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { en } from '@/i18n/en';
import { it, type Dictionary, type TranslationKey } from '@/i18n/it';
import type { Language } from '@/repositories/language-model';
import { getSavedLanguage, saveLanguage } from '@/repositories/language-repository';

export type Locale = 'it-IT' | 'en-US';

export type TranslationParams = Record<string, string | number>;

export type I18n = {
  language: Language;
  locale: Locale;
  /** Text of `key` in the current language, with `{name}` placeholders replaced by `params.name`. */
  t: (key: TranslationKey, params?: TranslationParams) => string;
  /** Switches to the other language at once, then saves it; a failed save is ignored. */
  toggleLanguage: () => void;
};

const DEFAULT_LANGUAGE: Language = 'it';

const DICTIONARIES: Record<Language, Dictionary> = { it, en };

const LOCALES: Record<Language, Locale> = { it: 'it-IT', en: 'en-US' };

const OTHER_LANGUAGE: Record<Language, Language> = { it: 'en', en: 'it' };

const PLACEHOLDER_PATTERN = /\{(\w+)\}/g;

function translate(dictionary: Dictionary, key: TranslationKey, params?: TranslationParams): string {
  const text = dictionary[key];
  if (params === undefined) {
    return text;
  }
  return text.replace(PLACEHOLDER_PATTERN, (placeholder: string, name: string) => {
    const value = params[name];
    return value === undefined ? placeholder : String(value);
  });
}

const I18nContext = createContext<I18n | null>(null);

/**
 * Provides the interface language to its children, which render only once the saved
 * language has been read; without a valid saved value the language is Italian.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSavedLanguage().then(
      (saved) => {
        if (!cancelled) {
          setLanguage(saved ?? DEFAULT_LANGUAGE);
        }
      },
      () => {
        if (!cancelled) {
          setLanguage(DEFAULT_LANGUAGE);
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<I18n | null>(() => {
    if (language === null) {
      return null;
    }
    return {
      language,
      locale: LOCALES[language],
      t: (key, params) => translate(DICTIONARIES[language], key, params),
      toggleLanguage: () => {
        const next = OTHER_LANGUAGE[language];
        setLanguage(next);
        saveLanguage(next).catch(() => {});
      },
    };
  }, [language]);

  if (value === null) {
    return null;
  }
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (value === null) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return value;
}
