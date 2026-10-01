import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_STORAGE_KEY = 'news-app.language';

/** Stored language as a raw string, or null when nothing is stored. */
export function readLanguage(): Promise<string | null> {
  return AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
}

export function writeLanguage(value: string): Promise<void> {
  return AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, value);
}
