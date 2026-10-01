import AsyncStorage from '@react-native-async-storage/async-storage';

import everythingAnsa from '@/services/fixtures/everything-ansa.json';
import topHeadlinesItaly from '@/services/fixtures/top-headlines-italy.json';
import topHeadlinesUs from '@/services/fixtures/top-headlines-us.json';
import type { NewsCacheEntryDto } from '@/services/news-api-dto';
import { readEntry, writeEntry } from '@/services/news-cache-service';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const ITALY_KEY = 'news-app.news-cache.italy';
const USA_KEY = 'news-app.news-cache.usa';
const SAVED_AT = '2026-09-28T10:30:00.000Z';

const ITALY_ENTRY: NewsCacheEntryDto = {
  savedAt: SAVED_AT,
  requests: [topHeadlinesItaly.articles, everythingAnsa.articles],
};

const USA_ENTRY: NewsCacheEntryDto = {
  savedAt: '2026-09-28T11:00:00.000Z',
  requests: [topHeadlinesUs.articles],
};

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('readEntry', () => {
  it('returns null when the section has no entry, reading the key news-app.news-cache.<sectionKey>', async () => {
    await expect(readEntry('italy')).resolves.toBeNull();

    expect(AsyncStorage.getItem).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.getItem).toHaveBeenCalledWith(ITALY_KEY);
  });

  it('returns the entry saved by writeEntry, with one array of article DTOs per request as they were saved', async () => {
    await writeEntry('italy', ITALY_ENTRY);

    const entry = await readEntry('italy');

    expect(entry).toEqual(ITALY_ENTRY);
    expect(entry?.requests.map((articles) => articles.length)).toEqual([20, 10]);
    expect(entry?.requests.flat().filter((article) => article.urlToImage === 'null')).toHaveLength(8);
  });

  it('returns null for a value that is not valid JSON', async () => {
    await AsyncStorage.setItem(ITALY_KEY, '{"savedAt":"2026-09-28T10:30:00.000Z","requests":[');

    await expect(readEntry('italy')).resolves.toBeNull();
  });

  it.each([
    { shape: 'an object whose savedAt is not a string', value: { savedAt: 1790591400000, requests: [] } },
    { shape: 'an object without savedAt', value: { requests: [] } },
    { shape: 'an object without requests', value: { savedAt: SAVED_AT } },
    { shape: 'an object whose requests are not an array', value: { savedAt: SAVED_AT, requests: {} } },
    { shape: 'an object with a request that is not an array', value: { savedAt: SAVED_AT, requests: [[], null] } },
    {
      shape: 'an object with the article DTOs directly in requests',
      value: { savedAt: SAVED_AT, requests: everythingAnsa.articles },
    },
    {
      shape: 'the flat shape { savedAt, articles }',
      value: { savedAt: SAVED_AT, articles: everythingAnsa.articles },
    },
    { shape: 'null', value: null },
    { shape: 'a number', value: 42 },
    { shape: 'a string', value: 'entry' },
    { shape: 'an array', value: [ITALY_ENTRY] },
  ])('returns null for $shape', async ({ value }) => {
    await AsyncStorage.setItem(ITALY_KEY, JSON.stringify(value));

    await expect(readEntry('italy')).resolves.toBeNull();
  });

  it('leaves to its caller the checks of the instant, of the number of requests and of the articles', async () => {
    const unchecked = { savedAt: 'yesterday', requests: [[], [null, 42, 'text', { title: 'No URL' }], []] };
    await AsyncStorage.setItem(ITALY_KEY, JSON.stringify(unchecked));

    await expect(readEntry('italy')).resolves.toEqual(unchecked);
  });

  it('returns null when the storage cannot be read', async () => {
    jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('storage read failed'));

    await expect(readEntry('italy')).resolves.toBeNull();
  });
});

describe('writeEntry', () => {
  it('stores the entry as JSON under the key of its section', async () => {
    await writeEntry('italy', ITALY_ENTRY);

    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(ITALY_KEY, JSON.stringify(ITALY_ENTRY));
    await expect(AsyncStorage.getItem(ITALY_KEY)).resolves.toBe(JSON.stringify(ITALY_ENTRY));
  });

  it('keeps one entry per section and replaces only the entry of the section written again', async () => {
    const newer: NewsCacheEntryDto = { savedAt: '2026-09-28T12:00:00.000Z', requests: [[], everythingAnsa.articles] };

    await writeEntry('italy', ITALY_ENTRY);
    await writeEntry('usa', USA_ENTRY);
    await writeEntry('italy', newer);

    expect((await AsyncStorage.getAllKeys()).slice().sort()).toEqual([ITALY_KEY, USA_KEY]);
    await expect(readEntry('italy')).resolves.toEqual(newer);
    await expect(readEntry('usa')).resolves.toEqual(USA_ENTRY);
  });

  it('rejects with the storage error when the write fails, storing nothing', async () => {
    const failure = new Error('storage write failed');
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(failure);

    await expect(writeEntry('italy', ITALY_ENTRY)).rejects.toBe(failure);
    await expect(readEntry('italy')).resolves.toBeNull();
  });
});
