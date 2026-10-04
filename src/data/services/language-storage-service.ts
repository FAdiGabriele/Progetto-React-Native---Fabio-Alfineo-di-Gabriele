import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_STORAGE_KEY = 'news-app.language';

export function readLanguage(): Promise<string | null> {
  return AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
}

export function writeLanguage(value: string): Promise<void> {
  return AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, value);
}
