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
  it('returns the saved preference when it is "system", "light" or "dark"', async () => {
    readThemeMock.mockResolvedValueOnce('system');
    await expect(themeRepository.getSavedTheme()).resolves.toBe('system');

    readThemeMock.mockResolvedValueOnce('light');
    await expect(themeRepository.getSavedTheme()).resolves.toBe('light');

    readThemeMock.mockResolvedValueOnce('dark');
    await expect(themeRepository.getSavedTheme()).resolves.toBe('dark');
  });

  it('returns null when no preference is saved', async () => {
    readThemeMock.mockResolvedValueOnce(null);

    await expect(themeRepository.getSavedTheme()).resolves.toBeNull();
  });

  it('returns null for a saved value that is not exactly a supported preference', async () => {
    for (const value of ['Dark', 'light ', 'System', 'auto', 'unspecified', '']) {
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
  it.each(['system', 'light', 'dark'] as const)('writes the %s preference to the storage', async (preference) => {
    writeThemeMock.mockResolvedValueOnce(undefined);

    await expect(themeRepository.saveTheme(preference)).resolves.toBeUndefined();

    expect(writeThemeMock).toHaveBeenCalledTimes(1);
    expect(writeThemeMock).toHaveBeenCalledWith(preference);
  });

  it('rejects with the storage error when the write fails', async () => {
    const failure = new Error('storage write failed');
    writeThemeMock.mockRejectedValueOnce(failure);

    await expect(themeRepository.saveTheme('light')).rejects.toBe(failure);
  });
});
