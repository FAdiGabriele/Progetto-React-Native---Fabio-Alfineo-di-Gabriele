import { getSavedLanguage, saveLanguage } from '@/repositories/language-repository';
import { readLanguage, writeLanguage } from '@/services/language-storage-service';

jest.mock('@/services/language-storage-service', () => ({
  readLanguage: jest.fn(),
  writeLanguage: jest.fn(),
}));

const readLanguageMock = jest.mocked(readLanguage);
const writeLanguageMock = jest.mocked(writeLanguage);

beforeEach(() => {
  jest.resetAllMocks();
});

describe('getSavedLanguage', () => {
  it('returns the saved language when it is "it" or "en"', async () => {
    readLanguageMock.mockResolvedValueOnce('it');
    await expect(getSavedLanguage()).resolves.toBe('it');

    readLanguageMock.mockResolvedValueOnce('en');
    await expect(getSavedLanguage()).resolves.toBe('en');
  });

  it('returns null when no language is saved', async () => {
    readLanguageMock.mockResolvedValueOnce(null);

    await expect(getSavedLanguage()).resolves.toBeNull();
  });

  it('returns null for a saved value that is not exactly a supported language', async () => {
    for (const value of ['IT', 'en ', 'fr', '']) {
      readLanguageMock.mockResolvedValueOnce(value);

      await expect(getSavedLanguage()).resolves.toBeNull();
    }
  });

  it('returns null when the storage cannot be read', async () => {
    readLanguageMock.mockRejectedValueOnce(new Error('storage read failed'));

    await expect(getSavedLanguage()).resolves.toBeNull();
  });
});

describe('saveLanguage', () => {
  it('writes the language to the storage', async () => {
    writeLanguageMock.mockResolvedValueOnce(undefined);

    await expect(saveLanguage('en')).resolves.toBeUndefined();

    expect(writeLanguageMock).toHaveBeenCalledTimes(1);
    expect(writeLanguageMock).toHaveBeenCalledWith('en');
  });

  it('rejects with the storage error when the write fails', async () => {
    const failure = new Error('storage write failed');
    writeLanguageMock.mockRejectedValueOnce(failure);

    await expect(saveLanguage('it')).rejects.toBe(failure);
  });
});
