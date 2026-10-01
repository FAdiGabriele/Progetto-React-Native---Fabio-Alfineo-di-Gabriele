import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = 'news-app.theme';

/** Stored theme as a raw string, or null when nothing is stored. */
export function readTheme(): Promise<string | null> {
  return AsyncStorage.getItem(THEME_STORAGE_KEY);
}

export function writeTheme(value: string): Promise<void> {
  return AsyncStorage.setItem(THEME_STORAGE_KEY, value);
}
