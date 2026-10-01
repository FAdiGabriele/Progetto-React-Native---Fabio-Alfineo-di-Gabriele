import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';
import { Appearance, Platform, Pressable, Text } from 'react-native';

import { AppBootstrap } from '@/bootstrap/app-bootstrap';
import { useI18n } from '@/i18n/i18n-provider';
import type { Language } from '@/repositories/language-model';
import { getSavedLanguage, saveLanguage } from '@/repositories/language-repository';
import type { Theme } from '@/repositories/theme-model';
import { getSavedTheme, saveTheme } from '@/repositories/theme-repository';
import { useThemePreference } from '@/theme/theme-preference-provider';

jest.mock('@/repositories/theme-repository', () => ({ getSavedTheme: jest.fn(), saveTheme: jest.fn() }));
jest.mock('@/repositories/language-repository', () => ({ getSavedLanguage: jest.fn(), saveLanguage: jest.fn() }));

// The call made while the bootstrap module loads gets a promise that a test can reject later.
jest.mock('expo-splash-screen', () => {
  const loadCall: { reject?: (error: Error) => void } = {};
  return {
    preventAutoHideAsync: jest.fn(
      () =>
        new Promise<boolean>((_resolve, reject) => {
          loadCall.reject = reject;
        })
    ),
    hideAsync: jest.fn(),
    loadCall,
  };
});

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void };

const getSavedThemeMock = jest.mocked(getSavedTheme);
const getSavedLanguageMock = jest.mocked(getSavedLanguage);
const saveThemeMock = jest.mocked(saveTheme);
const saveLanguageMock = jest.mocked(saveLanguage);
const preventAutoHideAsyncMock = jest.mocked(SplashScreen.preventAutoHideAsync);
const hideAsyncMock = jest.mocked(SplashScreen.hideAsync);
const { loadCall } = jest.requireMock<{ loadCall: { reject?: (error: Error) => void } }>('expo-splash-screen');

// What the module did with the splash screen while loading, before any test clears the mocks.
const SPLASH_SCREEN_CALLS_AT_LOAD = {
  preventAutoHideAsync: preventAutoHideAsyncMock.mock.calls.length,
  hideAsync: hideAsyncMock.mock.calls.length,
};

function defer<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

// Waits for a macrotask, so that a rejection left without a handler reaches Jest while the test runs.
async function letRejectionsSurface(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function PreferencesProbe() {
  const { theme, toggleTheme } = useThemePreference();
  const { language, locale, t, toggleLanguage } = useI18n();

  return (
    <>
      <Text testID="preferences">{`${theme} ${language} ${locale} ${t('settings.title')}`}</Text>
      <Pressable accessibilityRole="button" onPress={toggleTheme}>
        <Text>Toggle theme</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={toggleLanguage}>
        <Text>Toggle language</Text>
      </Pressable>
    </>
  );
}

const bootstrapWithProbe = () => (
  <AppBootstrap>
    <PreferencesProbe />
  </AppBootstrap>
);

async function renderBootstrap(): Promise<void> {
  await render(bootstrapWithProbe());
}

const shownPreferences = () => screen.getByTestId('preferences');
const toggleTheme = () => fireEvent.press(screen.getByRole('button', { name: 'Toggle theme' }));
const toggleLanguage = () => fireEvent.press(screen.getByRole('button', { name: 'Toggle language' }));

describe('the bootstrap module', () => {
  it('keeps the splash screen from the moment it loads, before any render and any hideAsync', () => {
    expect(SPLASH_SCREEN_CALLS_AT_LOAD).toEqual({ preventAutoHideAsync: 1, hideAsync: 0 });
  });
});

describe('AppBootstrap', () => {
  let setColorScheme: jest.SpyInstance;
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.resetAllMocks();
    getSavedThemeMock.mockResolvedValue(null);
    getSavedLanguageMock.mockResolvedValue(null);
    saveThemeMock.mockResolvedValue(undefined);
    saveLanguageMock.mockResolvedValue(undefined);
    hideAsyncMock.mockResolvedValue(undefined);
    setColorScheme = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => undefined);
    consoleError = jest.spyOn(console, 'error');
  });

  afterEach(() => {
    const errors = [...consoleError.mock.calls];
    jest.restoreAllMocks();
    expect(errors).toEqual([]);
  });

  it('starts reading the saved theme and the saved language together and renders nothing meanwhile', async () => {
    const theme = defer<Theme | null>();
    const language = defer<Language | null>();
    getSavedThemeMock.mockReturnValue(theme.promise);
    getSavedLanguageMock.mockReturnValue(language.promise);

    await renderBootstrap();

    expect(getSavedThemeMock).toHaveBeenCalledTimes(1);
    expect(getSavedLanguageMock).toHaveBeenCalledTimes(1);
    expect(screen.toJSON()).toBeNull();
    expect(hideAsyncMock).not.toHaveBeenCalled();
  });

  it.each(['theme', 'language'] as const)(
    'renders nothing and keeps the splash screen until both reads are over, when the %s arrives first',
    async (first) => {
      const theme = defer<Theme | null>();
      const language = defer<Language | null>();
      getSavedThemeMock.mockReturnValue(theme.promise);
      getSavedLanguageMock.mockReturnValue(language.promise);
      const resolveTheme = () => theme.resolve('light');
      const resolveLanguage = () => language.resolve('en');
      const [resolveFirst, resolveSecond] =
        first === 'theme' ? [resolveTheme, resolveLanguage] : [resolveLanguage, resolveTheme];

      await renderBootstrap();
      await act(async () => resolveFirst());

      expect(screen.toJSON()).toBeNull();
      expect(hideAsyncMock).not.toHaveBeenCalled();

      await act(async () => resolveSecond());

      expect(shownPreferences()).toHaveTextContent('light en en-US Settings');
      expect(hideAsyncMock).toHaveBeenCalledTimes(1);
    }
  );

  it.each([
    { theme: 'light', language: 'it', shown: 'light it it-IT Impostazioni' },
    { theme: 'dark', language: 'en', shown: 'dark en en-US Settings' },
  ] as const)(
    'renders the children with the saved $theme theme and $language language and hides the splash screen',
    async ({ theme, language, shown }) => {
      getSavedThemeMock.mockResolvedValue(theme);
      getSavedLanguageMock.mockResolvedValue(language);

      await renderBootstrap();

      expect(shownPreferences()).toHaveTextContent(shown);
      expect(hideAsyncMock).toHaveBeenCalledTimes(1);
      expect(hideAsyncMock).toHaveBeenCalledWith();
    }
  );

  it('starts with the dark theme and Italian when nothing is saved', async () => {
    await renderBootstrap();

    expect(shownPreferences()).toHaveTextContent('dark it it-IT Impostazioni');
    expect(hideAsyncMock).toHaveBeenCalledTimes(1);
  });

  it('hides the splash screen only once, also after a new render and a change of theme and language', async () => {
    await renderBootstrap();
    await screen.rerender(bootstrapWithProbe());
    await toggleTheme();
    await toggleLanguage();

    expect(shownPreferences()).toHaveTextContent('light en en-US Settings');
    expect(hideAsyncMock).toHaveBeenCalledTimes(1);
    expect(getSavedThemeMock).toHaveBeenCalledTimes(1);
    expect(getSavedLanguageMock).toHaveBeenCalledTimes(1);
  });

  it('counts a failed theme read as nothing saved, without blocking the language read', async () => {
    getSavedThemeMock.mockRejectedValue(new Error('storage read failed'));
    getSavedLanguageMock.mockResolvedValue('en');

    await renderBootstrap();
    await letRejectionsSurface();

    expect(shownPreferences()).toHaveTextContent('dark en en-US Settings');
    expect(hideAsyncMock).toHaveBeenCalledTimes(1);
  });

  it('counts a failed language read as nothing saved, without blocking the theme read', async () => {
    getSavedThemeMock.mockResolvedValue('light');
    getSavedLanguageMock.mockRejectedValue(new Error('storage read failed'));

    await renderBootstrap();
    await letRejectionsSurface();

    expect(shownPreferences()).toHaveTextContent('light it it-IT Impostazioni');
    expect(hideAsyncMock).toHaveBeenCalledTimes(1);
  });

  it('starts with the dark theme and Italian when both reads fail', async () => {
    getSavedThemeMock.mockRejectedValue(new Error('storage read failed'));
    getSavedLanguageMock.mockRejectedValue(new Error('storage read failed'));

    await renderBootstrap();
    await letRejectionsSurface();

    expect(shownPreferences()).toHaveTextContent('dark it it-IT Impostazioni');
    expect(hideAsyncMock).toHaveBeenCalledTimes(1);
  });

  it('shows the children even when the splash screen cannot be hidden', async () => {
    hideAsyncMock.mockRejectedValue(new Error('no splash screen'));

    await renderBootstrap();
    await letRejectionsSurface();

    expect(shownPreferences()).toHaveTextContent('dark it it-IT Impostazioni');
    expect(hideAsyncMock).toHaveBeenCalledTimes(1);
  });

  it('shows the children and hides the splash screen even when it could not be kept at load', async () => {
    expect(loadCall.reject).toBeDefined();
    loadCall.reject?.(new Error('no splash screen'));

    await renderBootstrap();
    await letRejectionsSurface();

    expect(shownPreferences()).toHaveTextContent('dark it it-IT Impostazioni');
    expect(hideAsyncMock).toHaveBeenCalledTimes(1);
  });

  it('leaves its state and the splash screen alone when unmounted before the reads are over', async () => {
    const theme = defer<Theme | null>();
    const language = defer<Language | null>();
    getSavedThemeMock.mockReturnValue(theme.promise);
    getSavedLanguageMock.mockReturnValue(language.promise);
    await renderBootstrap();

    await screen.unmount();
    await act(async () => {
      theme.resolve('light');
      language.resolve('en');
    });
    await letRejectionsSurface();

    expect(getSavedThemeMock).toHaveBeenCalledTimes(1);
    expect(getSavedLanguageMock).toHaveBeenCalledTimes(1);
    expect(hideAsyncMock).not.toHaveBeenCalled();
  });

  it('switches the theme at once with toggleTheme and then saves the new one', async () => {
    const save = defer<void>();
    saveThemeMock.mockReturnValueOnce(save.promise);
    getSavedThemeMock.mockResolvedValue('light');
    await renderBootstrap();

    await toggleTheme();

    expect(shownPreferences()).toHaveTextContent('dark it it-IT Impostazioni');
    expect(saveThemeMock.mock.calls).toEqual([['dark']]);

    await act(async () => save.resolve());
    await toggleTheme();

    expect(shownPreferences()).toHaveTextContent('light it it-IT Impostazioni');
    expect(saveThemeMock.mock.calls).toEqual([['dark'], ['light']]);
    expect(saveLanguageMock).not.toHaveBeenCalled();
  });

  it('keeps the new theme when it cannot be saved', async () => {
    saveThemeMock.mockRejectedValue(new Error('storage write failed'));
    await renderBootstrap();

    await toggleTheme();
    await letRejectionsSurface();

    expect(shownPreferences()).toHaveTextContent('light it it-IT Impostazioni');
    expect(saveThemeMock).toHaveBeenCalledWith('light');
  });

  it('switches the language at once with toggleLanguage and then saves the new one', async () => {
    const save = defer<void>();
    saveLanguageMock.mockReturnValueOnce(save.promise);
    getSavedLanguageMock.mockResolvedValue('en');
    await renderBootstrap();

    await toggleLanguage();

    expect(shownPreferences()).toHaveTextContent('dark it it-IT Impostazioni');
    expect(saveLanguageMock.mock.calls).toEqual([['it']]);

    await act(async () => save.resolve());
    await toggleLanguage();

    expect(shownPreferences()).toHaveTextContent('dark en en-US Settings');
    expect(saveLanguageMock.mock.calls).toEqual([['it'], ['en']]);
    expect(saveThemeMock).not.toHaveBeenCalled();
  });

  it('keeps the new language when it cannot be saved', async () => {
    saveLanguageMock.mockRejectedValue(new Error('storage write failed'));
    await renderBootstrap();

    await toggleLanguage();
    await letRejectionsSurface();

    expect(shownPreferences()).toHaveTextContent('dark en en-US Settings');
    expect(saveLanguageMock).toHaveBeenCalledWith('en');
  });

  it.each(['ios', 'android'] as const)(
    'applies the saved theme and every change to the system elements on %s',
    async (os) => {
      jest.replaceProperty(Platform, 'OS', os);
      getSavedThemeMock.mockResolvedValue('light');

      await renderBootstrap();

      expect(setColorScheme.mock.calls).toEqual([['light']]);

      await toggleTheme();
      await toggleTheme();
      await toggleLanguage();

      expect(setColorScheme.mock.calls).toEqual([['light'], ['dark'], ['light']]);
    }
  );

  it('leaves the system elements alone on web', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    getSavedThemeMock.mockResolvedValue('light');

    await renderBootstrap();
    await toggleTheme();

    expect(shownPreferences()).toHaveTextContent('dark it it-IT Impostazioni');
    expect(setColorScheme).not.toHaveBeenCalled();
  });
});

describe('a missing provider', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('makes useThemePreference throw', async () => {
    await expect(renderHook(() => useThemePreference())).rejects.toThrow(
      'useThemePreference must be used within a ThemePreferenceProvider'
    );
  });

  it('makes useI18n throw', async () => {
    await expect(renderHook(() => useI18n())).rejects.toThrow('useI18n must be used within an I18nProvider');
  });
});
