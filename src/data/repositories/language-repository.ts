import { readLanguage, writeLanguage } from '@/data/services/language-storage-service';
import type { Language } from '@/domain/models/language-model';
import type { LanguageRepository } from '@/domain/repositories/language-repository';

const SUPPORTED_LANGUAGES: readonly Language[] = ['it', 'en'];

function isLanguage(value: string | null): value is Language {
  return SUPPORTED_LANGUAGES.some((language) => language === value);
}

async function getSavedLanguage(): Promise<Language | null> {
  let value: string | null;
  try {
    value = await readLanguage();
  } catch {
    return null;
  }
  return isLanguage(value) ? value : null;
}

async function saveLanguage(language: Language): Promise<void> {
  await writeLanguage(language);
}

export const languageRepository: LanguageRepository = { getSavedLanguage, saveLanguage };
