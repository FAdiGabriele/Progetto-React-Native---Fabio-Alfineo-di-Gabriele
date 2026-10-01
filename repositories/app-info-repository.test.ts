import { getAppVersion } from '@/repositories/app-info-repository';
import { readAppVersion } from '@/services/app-info-service';

jest.mock('@/services/app-info-service', () => ({
  readAppVersion: jest.fn(),
}));

const readAppVersionMock = jest.mocked(readAppVersion);

beforeEach(() => {
  jest.resetAllMocks();
});

describe('getAppVersion', () => {
  it('returns the version of the app config', () => {
    readAppVersionMock.mockReturnValue('0.30.6');

    expect(getAppVersion()).toBe('0.30.6');
  });

  it('removes the spaces around the version', () => {
    readAppVersionMock.mockReturnValue(' 0.30.6 ');

    expect(getAppVersion()).toBe('0.30.6');
  });

  it('returns null when the version is missing, empty or blank', () => {
    for (const value of [undefined, '', '   ']) {
      readAppVersionMock.mockReturnValue(value);

      expect(getAppVersion()).toBeNull();
    }
  });
});
