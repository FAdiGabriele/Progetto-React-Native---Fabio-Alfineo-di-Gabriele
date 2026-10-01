import { renderHook } from '@testing-library/react-native';

import { useSettingsViewModel } from '@/screens/settings/use-settings-view-model';

jest.mock('@/container', () => ({ appInfoRepository: { getAppVersion: jest.fn() } }));

type AppInfoRepository = NonNullable<Parameters<typeof useSettingsViewModel>[0]>;

const containerRepository = jest.requireMock<{ appInfoRepository: jest.Mocked<AppInfoRepository> }>(
  '@/container'
).appInfoRepository;

function makeRepository(version: string | null): jest.Mocked<AppInfoRepository> {
  return { getAppVersion: jest.fn(() => version) };
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe('useSettingsViewModel', () => {
  it('exposes the version of the repository it receives, read once', async () => {
    const repository = makeRepository('0.30.12');

    const { result, rerender } = await renderHook(() => useSettingsViewModel(repository));
    await rerender(undefined);

    expect(result.current).toEqual({ appVersion: '0.30.12' });
    expect(repository.getAppVersion).toHaveBeenCalledTimes(1);
    expect(containerRepository.getAppVersion).not.toHaveBeenCalled();
  });

  it('exposes null when the version cannot be read', async () => {
    const { result } = await renderHook(() => useSettingsViewModel(makeRepository(null)));

    expect(result.current.appVersion).toBeNull();
  });

  it('reads the version from the repository of the container when it receives none', async () => {
    containerRepository.getAppVersion.mockReturnValue('1.2.3');

    const { result } = await renderHook(() => useSettingsViewModel());

    expect(result.current.appVersion).toBe('1.2.3');
    expect(containerRepository.getAppVersion).toHaveBeenCalledTimes(1);
  });
});
