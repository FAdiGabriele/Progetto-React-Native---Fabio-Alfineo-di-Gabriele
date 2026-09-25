import type { Language } from '@/repositories/language-model';
import { readLanguage, writeLanguage } from '@/services/language-storage-service';

const SUPPORTED_LANGUAGES: readonly Language[] = ['it', 'en'];

function isLanguage(value: string | null): value is Language {
  return SUPPORTED_LANGUAGES.some((language) => language === value);
}

/** Saved language, or null when none is saved, it cannot be read or it is not supported. */
export async function getSavedLanguage(): Promise<Language | null> {
  let value: string | null;
  try {
    value = await readLanguage();
  } catch {
    return null;
  }
  return isLanguage(value) ? value : null;
}

export async function saveLanguage(language: Language): Promise<void> {
  await writeLanguage(language);
}
