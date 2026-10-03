import type { Language } from '@/domain/models/language-model';

export interface LanguageRepository {
  /** Saved language, or null when none is saved, it cannot be read or it is not supported. */
  getSavedLanguage(): Promise<Language | null>;
  saveLanguage(language: Language): Promise<void>;
}
