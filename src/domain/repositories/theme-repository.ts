import type { ThemePreference } from '@/domain/models/theme-model';

export interface ThemeRepository {
  /** Saved theme preference, or null when none is saved, it cannot be read or it is not supported. */
  getSavedTheme(): Promise<ThemePreference | null>;
  saveTheme(preference: ThemePreference): Promise<void>;
}
