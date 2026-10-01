import { readTheme, writeTheme } from '@/data/services/theme-storage-service';
import type { Theme } from '@/domain/models/theme-model';
import type { ThemeRepository } from '@/domain/repositories/theme-repository';

const SUPPORTED_THEMES: readonly Theme[] = ['light', 'dark'];

function isTheme(value: string | null): value is Theme {
  return SUPPORTED_THEMES.some((theme) => theme === value);
}

async function getSavedTheme(): Promise<Theme | null> {
  let value: string | null;
  try {
    value = await readTheme();
  } catch {
    return null;
  }
  return isTheme(value) ? value : null;
}

async function saveTheme(theme: Theme): Promise<void> {
  await writeTheme(theme);
}

/** The theme of the interface saved on the device. */
export const themeRepository: ThemeRepository = { getSavedTheme, saveTheme };
