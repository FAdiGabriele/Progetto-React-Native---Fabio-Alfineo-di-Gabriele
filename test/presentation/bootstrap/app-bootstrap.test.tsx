import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';
import { Appearance, DeviceEventEmitter, Platform, Pressable, Text } from 'react-native';

import { AppBootstrap } from '@/presentation/bootstrap/app-bootstrap';
import { languageRepository, themeRepository } from '@/di/container';
import type { Language } from '@/domain/models/language-model';
import type { Theme, ThemePreference } from '@/domain/models/theme-model';
import { useI18n } from '@/presentation/i18n/i18n-provider';
import { useThemePreference } from '@/presentation/theme/theme-preference-provider';

jest.mock('@/di/container', () => ({
  themeRepository: { getSavedTheme: jest.fn(), saveTheme: jest.fn() },
  languageRepository: { getSavedLanguage: jest.fn(), saveLanguage: jest.fn() },
}));

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

// The preset replaces useColorScheme with a fixed light theme: the real hook reads and follows
// the device theme through Appearance, as in the app.
jest.unmock('react-native/Libraries/Utilities/useColorScheme');

// The native Appearance module, missing in Jest: it reports the color scheme of the device.
jest.mock('react-native/Libraries/Utilities/NativeAppearance', () => {
  const device: { colorScheme: string | null; setColorScheme: (style: string) => void } = {
    colorScheme: 'light',
    setColorScheme: () => undefined,
  };
  return {
    __esModule: true,
    default: {
      getColorScheme: () => device.colorScheme,
      setColorScheme: (style: string) => device.setColorScheme(style),
      addListener: () => undefined,
      removeListeners: () => undefined,
    },
    device,
  };
});

// The theme every themed component reads; bootstrap files do not import hooks.
const { useColorScheme } = jest.requireActual<typeof import('@/presentation/hooks/use-color-scheme')>('@/presentation/hooks/use-color-scheme');

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void };
type DeviceColorScheme = Theme | 'unspecified' | null;

const getSavedThemeMock = jest.mocked(themeRepository.getSavedTheme);
const getSavedLanguageMock = jest.mocked(languageRepository.getSavedLanguage);
const saveThemeMock = jest.mocked(themeRepository.saveTheme);
const saveLanguageMock = jest.mocked(languageRepository.saveLanguage);
const preventAutoHideAsyncMock = jest.mocked(SplashScreen.preventAutoHideAsync);
const hideAsyncMock = jest.mocked(SplashScreen.hideAsync);
const { loadCall } = jest.requireMock<{ loadCall: { reject?: (error: Error) => void } }>('expo-splash-screen');
const { device } = jest.requireMock<{
  device: { colorScheme: DeviceColorScheme; setColorScheme: (style: string) => void };
}>('react-native/Libraries/Utilities/NativeAppearance');

// What the module did with the splash screen while loading, before any test clears the mocks.
const SPLASH_SCREEN_CALLS_AT_LOAD = {
  preventAutoHideAsync: preventAutoHideAsyncMock.mock.calls.length,
  hideAsync: hideAsyncMock.mock.calls.length,
};

const PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];
const LANGUAGES: readonly Language[] = ['it', 'en'];
const LANGUAGE_TEXTS: Record<Language, string> = { it: 'it it-IT Impostazioni', en: 'en en-US Settings' };

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

async function letNativeEventsArrive(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

// What the native module does when the theme of the device changes.
function setDeviceTheme(colorScheme: DeviceColorScheme): void {
  device.colorScheme = colorScheme;
  DeviceEventEmitter.emit('appearanceChanged', { colorScheme });
}

async function changeDeviceTheme(colorScheme: DeviceColorScheme): Promise<void> {
  await act(async () => setDeviceTheme(colorScheme));
}

function PreferencesProbe() {
  const { preference, theme, setPreference } = useThemePreference();
  const colorScheme = useColorScheme();
  const { language, locale, t, setLanguage } = useI18n();

  return (
    <>
      <Text testID="preferences">{`${preference} ${theme} ${colorScheme} ${language} ${locale} ${t('settings.title')}`}</Text>
      {PREFERENCES.map((next) => (
        <Pressable key={next} accessibilityRole="button" onPress={() => setPreference(next)}>
          <Text>{`Theme ${next}`}</Text>
        </Pressable>
      ))}
      {LANGUAGES.map((next) => (
        <Pressable key={next} accessibilityRole="button" onPress={() => setLanguage(next)}>
          <Text>{`Language ${next}`}</Text>
        </Pressable>
      ))}
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
const choosePreference = (preference: ThemePreference) =>
  fireEvent.press(screen.getByRole('button', { name: `Theme ${preference}` }));
const chooseLanguage = (language: Language) =>
  fireEvent.press(screen.getByRole('button', { name: `Language ${language}` }));

// The preference, the active theme of both contexts, the language with its locale and a translated text.
function expectShown(preference: ThemePreference, theme: Theme, language: Language): void {
  expect(shownPreferences()).toHaveTextContent(`${preference} ${theme} ${theme} ${LANGUAGE_TEXTS[language]}`);
}

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
    device.setColorScheme = () => undefined;
    setDeviceTheme('light');
    setColorScheme = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => undefined);
    consoleError = jest.spyOn(console, 'error');
  });

  afterEach(() => {
    const errors = [...consoleError.mock.calls];
    jest.restoreAllMocks();
    expect(errors).toEqual([]);
  });

  it('starts reading the saved theme preference and the saved language together and renders nothing meanwhile', async () => {
    const theme = defer<ThemePreference | null>();
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
      const theme = defer<ThemePreference | null>();
      const language = defer<Language | null>();
      getSavedThemeMock.mockReturnValue(theme.promise);
      getSavedLanguageMock.mockReturnValue(language.promise);
      const resolveTheme = () => theme.resolve('dark');
      const resolveLanguage = () => language.resolve('en');
      const [resolveFirst, resolveSecond] =
        first === 'theme' ? [resolveTheme, resolveLanguage] : [resolveLanguage, resolveTheme];

      await renderBootstrap();
      await act(async () => resolveFirst());

      expect(screen.toJSON()).toBeNull();
      expect(hideAsyncMock).not.toHaveBeenCalled();

      await act(async () => resolveSecond());

      expectShown('dark', 'dark', 'en');
      expect(hideAsyncMock).toHaveBeenCalledTimes(1);
    }
  );

  it.each([
    { preference: 'light', device: 'dark', language: 'it', theme: 'light' },
    { preference: 'dark', device: 'light', language: 'en', theme: 'dark' },
    { preference: 'system', device: 'dark', language: 'it', theme: 'dark' },
    { preference: 'system', device: 'light', language: 'en', theme: 'light' },
  ] as const)(
    'renders the children with the saved $preference preference on a $device device and $language, and hides the splash screen',
    async ({ preference, device: deviceTheme, language, theme }) => {
      setDeviceTheme(deviceTheme);
      getSavedThemeMock.mockResolvedValue(preference);
      getSavedLanguageMock.mockResolvedValue(language);

      await renderBootstrap();

      expectShown(preference, theme, language);
      expect(hideAsyncMock).toHaveBeenCalledTimes(1);
      expect(hideAsyncMock).toHaveBeenCalledWith();
    }
  );

  it.each(['light', 'dark'] as const)(
    'follows the %s theme of the device and starts in Italian when nothing is saved',
    async (deviceTheme) => {
      setDeviceTheme(deviceTheme);

      await renderBootstrap();

      expectShown('system', deviceTheme, 'it');
      expect(hideAsyncMock).toHaveBeenCalledTimes(1);
    }
  );

  it.each(['light', 'dark'] as const)(
    'follows the %s theme of the device and starts in Italian when both reads fail',
    async (deviceTheme) => {
      setDeviceTheme(deviceTheme);
      getSavedThemeMock.mockRejectedValue(new Error('storage read failed'));
      getSavedLanguageMock.mockRejectedValue(new Error('storage read failed'));

      await renderBootstrap();
      await letRejectionsSurface();

      expectShown('system', deviceTheme, 'it');
      expect(hideAsyncMock).toHaveBeenCalledTimes(1);
    }
  );

  it.each([null, 'unspecified'] as const)('uses the light theme when the device reports %s', async (colorScheme) => {
    setDeviceTheme(colorScheme);

    await renderBootstrap();

    expectShown('system', 'light', 'it');
  });

  it('follows every change of the device theme while the preference is system', async () => {
    await renderBootstrap();
    expectShown('system', 'light', 'it');

    await changeDeviceTheme('dark');
    expectShown('system', 'dark', 'it');

    await changeDeviceTheme('light');
    expectShown('system', 'light', 'it');
  });

  it.each(['light', 'dark'] as const)(
    'keeps the %s theme while the device theme changes, and follows the device again once system is chosen',
    async (preference) => {
      getSavedThemeMock.mockResolvedValue(preference);
      await renderBootstrap();

      await changeDeviceTheme('dark');
      expectShown(preference, preference, 'it');
      await changeDeviceTheme('light');
      expectShown(preference, preference, 'it');
      await changeDeviceTheme('dark');
      expectShown(preference, preference, 'it');

      await choosePreference('system');
      expectShown('system', 'dark', 'it');
    }
  );

  it('hides the splash screen only once, also after a new render and a change of theme and language', async () => {
    await renderBootstrap();
    await screen.rerender(bootstrapWithProbe());
    await choosePreference('dark');
    await chooseLanguage('en');
    await changeDeviceTheme('dark');

    expectShown('dark', 'dark', 'en');
    expect(hideAsyncMock).toHaveBeenCalledTimes(1);
    expect(getSavedThemeMock).toHaveBeenCalledTimes(1);
    expect(getSavedLanguageMock).toHaveBeenCalledTimes(1);
  });

  it('counts a failed theme read as nothing saved, without blocking the language read', async () => {
    setDeviceTheme('dark');
    getSavedThemeMock.mockRejectedValue(new Error('storage read failed'));
    getSavedLanguageMock.mockResolvedValue('en');

    await renderBootstrap();
    await letRejectionsSurface();

    expectShown('system', 'dark', 'en');
    expect(hideAsyncMock).toHaveBeenCalledTimes(1);
  });

  it('counts a failed language read as nothing saved, without blocking the theme read', async () => {
    getSavedThemeMock.mockResolvedValue('dark');
    getSavedLanguageMock.mockRejectedValue(new Error('storage read failed'));

    await renderBootstrap();
    await letRejectionsSurface();

    expectShown('dark', 'dark', 'it');
    expect(hideAsyncMock).toHaveBeenCalledTimes(1);
  });

  it('shows the children even when the splash screen cannot be hidden', async () => {
    hideAsyncMock.mockRejectedValue(new Error('no splash screen'));

    await renderBootstrap();
    await letRejectionsSurface();

    expectShown('system', 'light', 'it');
    expect(hideAsyncMock).toHaveBeenCalledTimes(1);
  });

  it('shows the children and hides the splash screen even when it could not be kept at load', async () => {
    expect(loadCall.reject).toBeDefined();
    loadCall.reject?.(new Error('no splash screen'));

    await renderBootstrap();
    await letRejectionsSurface();

    expectShown('system', 'light', 'it');
    expect(hideAsyncMock).toHaveBeenCalledTimes(1);
  });

  it('leaves its state and the splash screen alone when unmounted before the reads are over', async () => {
    const theme = defer<ThemePreference | null>();
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

  it('applies every preference at once with setPreference and then saves it', async () => {
    const save = defer<void>();
    saveThemeMock.mockReturnValueOnce(save.promise);
    setDeviceTheme('dark');
    await renderBootstrap();

    await choosePreference('light');

    expectShown('light', 'light', 'it');
    expect(saveThemeMock.mock.calls).toEqual([['light']]);

    await act(async () => save.resolve());
    await choosePreference('dark');

    expectShown('dark', 'dark', 'it');
    expect(saveThemeMock.mock.calls).toEqual([['light'], ['dark']]);

    await choosePreference('system');

    expectShown('system', 'dark', 'it');
    expect(saveThemeMock.mock.calls).toEqual([['light'], ['dark'], ['system']]);
    expect(saveLanguageMock).not.toHaveBeenCalled();
  });

  it.each(PREFERENCES)('keeps the %s preference when it cannot be saved', async (preference) => {
    saveThemeMock.mockRejectedValue(new Error('storage write failed'));
    getSavedThemeMock.mockResolvedValue(preference === 'dark' ? 'light' : 'dark');
    setDeviceTheme('dark');
    await renderBootstrap();

    await choosePreference(preference);
    await letRejectionsSurface();

    expectShown(preference, preference === 'light' ? 'light' : 'dark', 'it');
    expect(saveThemeMock.mock.calls).toEqual([[preference]]);
  });

  it('switches the language at once with setLanguage and then saves it', async () => {
    const save = defer<void>();
    saveLanguageMock.mockReturnValueOnce(save.promise);
    await renderBootstrap();

    await chooseLanguage('en');

    expectShown('system', 'light', 'en');
    expect(saveLanguageMock.mock.calls).toEqual([['en']]);

    await act(async () => save.resolve());
    await chooseLanguage('it');

    expectShown('system', 'light', 'it');
    expect(saveLanguageMock.mock.calls).toEqual([['en'], ['it']]);
    expect(saveThemeMock).not.toHaveBeenCalled();
  });

  it('keeps the language passed to setLanguage when it is already the current one', async () => {
    getSavedLanguageMock.mockResolvedValue('en');
    await renderBootstrap();

    await chooseLanguage('en');

    expectShown('system', 'light', 'en');
  });

  it('keeps the new language when it cannot be saved', async () => {
    saveLanguageMock.mockRejectedValue(new Error('storage write failed'));
    await renderBootstrap();

    await chooseLanguage('en');
    await letRejectionsSurface();

    expectShown('system', 'light', 'en');
    expect(saveLanguageMock.mock.calls).toEqual([['en']]);
  });

  it.each(['ios', 'android'] as const)(
    'applies the saved preference and every change to the system elements on %s, unspecified to follow the device',
    async (os) => {
      jest.replaceProperty(Platform, 'OS', os);
      getSavedThemeMock.mockResolvedValue('light');

      await renderBootstrap();

      expect(setColorScheme.mock.calls).toEqual([['light']]);

      await choosePreference('dark');
      await choosePreference('system');
      await changeDeviceTheme('dark');
      await choosePreference('light');
      await chooseLanguage('en');

      expect(setColorScheme.mock.calls).toEqual([['light'], ['dark'], ['unspecified'], ['light']]);
    }
  );

  it.each(['ios', 'android'] as const)(
    'lets the system elements follow the device on %s when nothing is saved',
    async (os) => {
      jest.replaceProperty(Platform, 'OS', os);

      await renderBootstrap();
      await changeDeviceTheme('dark');

      expect(setColorScheme.mock.calls).toEqual([['unspecified']]);
      expectShown('system', 'dark', 'it');
    }
  );

  it.each([
    { preference: 'dark', device: 'light' },
    { preference: 'light', device: 'dark' },
  ] as const)(
    'shows the $device device theme again when system replaces the $preference preference, once the native module reports it',
    async ({ preference, device: deviceTheme }) => {
      // As on iOS: after the call, an event reports the overridden theme, or the device theme
      // once the override is removed; until then the module reports the previous one.
      device.setColorScheme = (style) => {
        const reported = style === 'light' || style === 'dark' ? style : deviceTheme;
        setTimeout(() => setDeviceTheme(reported), 0);
      };
      setColorScheme.mockRestore();
      jest.replaceProperty(Platform, 'OS', 'ios');
      setDeviceTheme(deviceTheme);
      getSavedThemeMock.mockResolvedValue(preference);

      await renderBootstrap();
      await letNativeEventsArrive();

      expectShown(preference, preference, 'it');

      await choosePreference('system');
      await letNativeEventsArrive();

      expectShown('system', deviceTheme, 'it');
    }
  );

  it('leaves the system elements alone on web, whatever the preference', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    getSavedThemeMock.mockResolvedValue('light');

    await renderBootstrap();
    await choosePreference('dark');
    await choosePreference('system');
    await changeDeviceTheme('dark');

    expectShown('system', 'dark', 'it');
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
