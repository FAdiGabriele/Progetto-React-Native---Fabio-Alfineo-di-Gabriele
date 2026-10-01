import { appInfoRepository } from '@/data/repositories/app-info-repository';
import { readAppVersion } from '@/data/services/app-info-service';

jest.mock('@/data/services/app-info-service', () => ({
  readAppVersion: jest.fn(),
}));

const readAppVersionMock = jest.mocked(readAppVersion);

beforeEach(() => {
  jest.resetAllMocks();
});

describe('appInfoRepository.getAppVersion', () => {
  it('returns the version of the app config', () => {
    readAppVersionMock.mockReturnValue('0.30.6');

    expect(appInfoRepository.getAppVersion()).toBe('0.30.6');
  });

  it('removes the spaces around the version', () => {
    readAppVersionMock.mockReturnValue(' 0.30.6 ');

    expect(appInfoRepository.getAppVersion()).toBe('0.30.6');
  });

  it('returns null when the version is missing, empty or blank', () => {
    for (const value of [undefined, '', '   ']) {
      readAppVersionMock.mockReturnValue(value);

      expect(appInfoRepository.getAppVersion()).toBeNull();
    }
  });
});
