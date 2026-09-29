import type { Theme } from '@/repositories/theme-model';
import { readTheme, writeTheme } from '@/services/theme-storage-service';

const SUPPORTED_THEMES: readonly Theme[] = ['light', 'dark'];

function isTheme(value: string | null): value is Theme {
  return SUPPORTED_THEMES.some((theme) => theme === value);
}

/** Saved theme, or null when none is saved, it cannot be read or it is not supported. */
export async function getSavedTheme(): Promise<Theme | null> {
  let value: string | null;
  try {
    value = await readTheme();
  } catch {
    return null;
  }
  return isTheme(value) ? value : null;
}

export async function saveTheme(theme: Theme): Promise<void> {
  await writeTheme(theme);
}
