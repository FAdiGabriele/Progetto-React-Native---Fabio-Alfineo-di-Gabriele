import type { ThemePreference } from '@/domain/models/theme-model';

/** Access to the saved theme preference: the port that the data layer implements. */
export interface ThemeRepository {
  /** Saved theme preference, or null when none is saved, it cannot be read or it is not supported. */
  getSavedTheme(): Promise<ThemePreference | null>;
  saveTheme(preference: ThemePreference): Promise<void>;
}
