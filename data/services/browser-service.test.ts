import { openBrowserAsync, WebBrowserResultType } from 'expo-web-browser';
import { Linking, Platform } from 'react-native';

import { openInBrowser } from '@/data/services/browser-service';

jest.mock('expo-web-browser', () => ({ ...jest.requireActual('expo-web-browser'), openBrowserAsync: jest.fn() }));

const openBrowserAsyncMock = jest.mocked(openBrowserAsync);
const openUrlMock = jest.mocked(Linking.openURL);

const ARTICLE_URL = 'https://example.com/article';

beforeEach(() => {
  jest.resetAllMocks();
  openBrowserAsyncMock.mockResolvedValue({ type: WebBrowserResultType.DISMISS });
  openUrlMock.mockResolvedValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe.each(['android', 'ios'] as const)('openInBrowser on %s', (os) => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', os);
  });

  it('opens the URL in the in-app browser and resolves to true', async () => {
    await expect(openInBrowser(ARTICLE_URL)).resolves.toBe(true);

    expect(openBrowserAsyncMock.mock.calls).toEqual([[ARTICLE_URL]]);
    expect(openUrlMock).not.toHaveBeenCalled();
  });

  it('resolves to true whatever the result of the in-app browser', async () => {
    openBrowserAsyncMock.mockResolvedValueOnce({ type: WebBrowserResultType.CANCEL });

    await expect(openInBrowser(ARTICLE_URL)).resolves.toBe(true);

    expect(openUrlMock).not.toHaveBeenCalled();
  });

  it('falls back to the system browser when the in-app browser fails', async () => {
    openBrowserAsyncMock.mockRejectedValueOnce(new Error('unavailable'));

    await expect(openInBrowser(ARTICLE_URL)).resolves.toBe(true);

    expect(openBrowserAsyncMock.mock.calls).toEqual([[ARTICLE_URL]]);
    expect(openUrlMock.mock.calls).toEqual([[ARTICLE_URL]]);
  });

  it('resolves to false when the system browser fails too', async () => {
    openBrowserAsyncMock.mockRejectedValueOnce(new Error('unavailable'));
    openUrlMock.mockRejectedValueOnce(new Error('no browser'));

    await expect(openInBrowser(ARTICLE_URL)).resolves.toBe(false);

    expect(openUrlMock).toHaveBeenCalledTimes(1);
  });
});

describe('openInBrowser on web', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'web');
  });

  it('opens the URL with Linking, in a new tab, without the in-app browser', async () => {
    await expect(openInBrowser(ARTICLE_URL)).resolves.toBe(true);

    expect(openUrlMock.mock.calls).toEqual([[ARTICLE_URL]]);
    expect(openBrowserAsyncMock).not.toHaveBeenCalled();
  });

  it('resolves to false when Linking fails, without trying the in-app browser', async () => {
    openUrlMock.mockRejectedValueOnce(new Error('blocked'));

    await expect(openInBrowser(ARTICLE_URL)).resolves.toBe(false);

    expect(openBrowserAsyncMock).not.toHaveBeenCalled();
  });
});
