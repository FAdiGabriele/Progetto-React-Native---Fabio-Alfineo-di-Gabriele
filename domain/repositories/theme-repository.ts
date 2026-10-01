import type { Theme } from '@/domain/models/theme-model';

/** Access to the saved theme of the interface: the port that the data layer implements. */
export interface ThemeRepository {
  /** Saved theme, or null when none is saved, it cannot be read or it is not supported. */
  getSavedTheme(): Promise<Theme | null>;
  saveTheme(theme: Theme): Promise<void>;
}
