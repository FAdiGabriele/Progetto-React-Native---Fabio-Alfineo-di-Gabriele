import { themeRepository } from '@/data/repositories/theme-repository';
import { readTheme, writeTheme } from '@/data/services/theme-storage-service';

jest.mock('@/data/services/theme-storage-service', () => ({
  readTheme: jest.fn(),
  writeTheme: jest.fn(),
}));

const readThemeMock = jest.mocked(readTheme);
const writeThemeMock = jest.mocked(writeTheme);

beforeEach(() => {
  jest.resetAllMocks();
});

describe('themeRepository.getSavedTheme', () => {
  it('returns the saved theme when it is "light" or "dark"', async () => {
    readThemeMock.mockResolvedValueOnce('light');
    await expect(themeRepository.getSavedTheme()).resolves.toBe('light');

    readThemeMock.mockResolvedValueOnce('dark');
    await expect(themeRepository.getSavedTheme()).resolves.toBe('dark');
  });

  it('returns null when no theme is saved', async () => {
    readThemeMock.mockResolvedValueOnce(null);

    await expect(themeRepository.getSavedTheme()).resolves.toBeNull();
  });

  it('returns null for a saved value that is not exactly a supported theme', async () => {
    for (const value of ['Dark', 'light ', 'system', '']) {
      readThemeMock.mockResolvedValueOnce(value);

      await expect(themeRepository.getSavedTheme()).resolves.toBeNull();
    }
  });

  it('returns null when the storage cannot be read', async () => {
    readThemeMock.mockRejectedValueOnce(new Error('storage read failed'));

    await expect(themeRepository.getSavedTheme()).resolves.toBeNull();
  });
});

describe('themeRepository.saveTheme', () => {
  it('writes the theme to the storage', async () => {
    writeThemeMock.mockResolvedValueOnce(undefined);

    await expect(themeRepository.saveTheme('dark')).resolves.toBeUndefined();

    expect(writeThemeMock).toHaveBeenCalledTimes(1);
    expect(writeThemeMock).toHaveBeenCalledWith('dark');
  });

  it('rejects with the storage error when the write fails', async () => {
    const failure = new Error('storage write failed');
    writeThemeMock.mockRejectedValueOnce(failure);

    await expect(themeRepository.saveTheme('light')).rejects.toBe(failure);
  });
});
