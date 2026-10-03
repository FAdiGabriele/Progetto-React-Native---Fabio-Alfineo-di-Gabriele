import { readTheme, writeTheme } from '@/data/services/theme-storage-service';
import type { ThemePreference } from '@/domain/models/theme-model';
import type { ThemeRepository } from '@/domain/repositories/theme-repository';

const SUPPORTED_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

function isThemePreference(value: string | null): value is ThemePreference {
  return SUPPORTED_PREFERENCES.some((preference) => preference === value);
}

async function getSavedTheme(): Promise<ThemePreference | null> {
  let value: string | null;
  try {
    value = await readTheme();
  } catch {
    return null;
  }
  return isThemePreference(value) ? value : null;
}

async function saveTheme(preference: ThemePreference): Promise<void> {
  await writeTheme(preference);
}

export const themeRepository: ThemeRepository = { getSavedTheme, saveTheme };
