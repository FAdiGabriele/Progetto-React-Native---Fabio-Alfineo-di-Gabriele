import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { languageRepository } from '@/di/container';
import type { Language } from '@/domain/models/language-model';
import { en } from '@/presentation/i18n/en';
import { it, type Dictionary, type TranslationKey } from '@/presentation/i18n/it';

export type Locale = 'it-IT' | 'en-US';

export type TranslationParams = Record<string, string | number>;

export type I18n = {
  language: Language;
  locale: Locale;
  /** Text of `key` in the current language, with `{name}` placeholders replaced by `params.name`. */
  t: (key: TranslationKey, params?: TranslationParams) => string;
  /** Switches to the language at once, then saves it; a failed save is ignored. */
  setLanguage: (language: Language) => void;
};

const DEFAULT_LANGUAGE: Language = 'it';

const DICTIONARIES: Record<Language, Dictionary> = { it, en };

const LOCALES: Record<Language, Locale> = { it: 'it-IT', en: 'en-US' };

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
 * Provides the interface language to its children, starting from the saved language read
 * at startup; without a valid saved value the language is Italian.
 */
export function I18nProvider({
  initialLanguage,
  children,
}: {
  /** Saved language, or null when there is no valid one. */
  initialLanguage: Language | null;
  children: ReactNode;
}) {
  const [language, setLanguageState] = useState<Language>(initialLanguage ?? DEFAULT_LANGUAGE);

  const value = useMemo<I18n>(
    () => ({
      language,
      locale: LOCALES[language],
      t: (key, params) => translate(DICTIONARIES[language], key, params),
      setLanguage: (next) => {
        setLanguageState(next);
        languageRepository.saveLanguage(next).catch(() => {});
      },
    }),
    [language]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (value === null) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return value;
}
