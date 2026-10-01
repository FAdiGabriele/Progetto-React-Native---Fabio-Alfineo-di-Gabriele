import type { Language } from '@/domain/models/language-model';

/** Access to the saved language of the interface: the port that the data layer implements. */
export interface LanguageRepository {
  /** Saved language, or null when none is saved, it cannot be read or it is not supported. */
  getSavedLanguage(): Promise<Language | null>;
  saveLanguage(language: Language): Promise<void>;
}
