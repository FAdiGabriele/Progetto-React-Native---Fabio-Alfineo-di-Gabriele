import AsyncStorage from '@react-native-async-storage/async-storage';

import type { NewsCacheEntryDto } from '@/data/services/news-api-dto';

const STORAGE_KEY_PREFIX = 'news-app.news-cache.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCacheEntry(value: unknown): value is NewsCacheEntryDto {
  return (
    isRecord(value) &&
    typeof value.savedAt === 'string' &&
    Array.isArray(value.requests) &&
    value.requests.every((articles) => Array.isArray(articles))
  );
}

/**
 * Saved entry of a news section, or null when there is none, it cannot be read or
 * it does not have the expected shape.
 */
export async function readEntry(sectionKey: string): Promise<NewsCacheEntryDto | null> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY_PREFIX + sectionKey);
    if (value === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(value);
    return isCacheEntry(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeEntry(sectionKey: string, entry: NewsCacheEntryDto): Promise<void> {
  return AsyncStorage.setItem(STORAGE_KEY_PREFIX + sectionKey, JSON.stringify(entry));
}
