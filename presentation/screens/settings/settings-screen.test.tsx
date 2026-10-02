import { fireEvent, render, screen, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import { SafeAreaProvider, type EdgeInsets } from 'react-native-safe-area-context';

import type { Language } from '@/domain/models/language-model';
import type { Theme, ThemePreference } from '@/domain/models/theme-model';
import { en as englishDictionary } from '@/presentation/i18n/en';
import { useI18n, type I18n } from '@/presentation/i18n/i18n-provider';
import { it as italianDictionary, type Dictionary } from '@/presentation/i18n/it';
import { SettingsScreen } from '@/presentation/screens/settings/settings-screen';
import { useSettingsViewModel } from '@/presentation/screens/settings/use-settings-view-model';
import { useThemePreference } from '@/presentation/theme/theme-preference-provider';

jest.mock('@/presentation/screens/settings/use-settings-view-model', () => ({ useSettingsViewModel: jest.fn() }));
jest.mock('@/presentation/i18n/i18n-provider', () => ({ useI18n: jest.fn() }));
jest.mock('@/presentation/theme/theme-preference-provider', () => ({ useThemePreference: jest.fn() }));

// The header options reach the navigator through Stack.Screen: the mock keeps the last ones.
type ScreenOptions = { title: string; headerBackButtonDisplayMode: string };
const headerOptions: { current: ScreenOptions | null } = { current: null };
jest.mock('expo-router', () => ({
  Stack: {
    Screen: ({ options }: { options: ScreenOptions }) => {
      headerOptions.current = options;
      return null;
    },
  },
}));
jest.mock('expo-router/head', () => ({ __esModule: true, default: () => null }));
jest.mock('react-native-safe-area-context', () =>
  jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default
);

type Setup = {
  preference?: ThemePreference;
  theme?: Theme;
  language?: Language;
  appVersion?: string | null;
  width?: number;
  insets?: EdgeInsets;
};

const NO_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const INSETS: EdgeInsets = { top: 47, right: 20, bottom: 34, left: 10 };

// The dictionary of a language, read as the provider does, without the provider.
function translator(dictionary: Dictionary): I18n['t'] {
  return (key, params) =>
    dictionary[key].replace(/\{(\w+)\}/g, (placeholder: string, name: string) =>
      params?.[name] === undefined ? placeholder : String(params[name])
    );
}

const I18N: Record<Language, Omit<I18n, 'setLanguage'>> = {
  it: { language: 'it', locale: 'it-IT', t: translator(italianDictionary) },
  en: { language: 'en', locale: 'en-US', t: translator(englishDictionary) },
};

function setWindowWidth(width: number): void {
  const metrics = { width, height: 900, scale: 2, fontScale: 1 };
  Dimensions.set({ window: metrics, screen: metrics });
}

async function renderSettings({
  preference = 'system',
  theme = 'dark',
  language = 'it',
  appVersion = '0.30.15',
  width = 390,
  insets = NO_INSETS,
}: Setup = {}) {
  const setPreference = jest.fn();
  const setLanguage = jest.fn();
  jest.mocked(useThemePreference).mockReturnValue({ preference, theme, setPreference });
  jest.mocked(useI18n).mockReturnValue({ ...I18N[language], setLanguage });
  jest.mocked(useSettingsViewModel).mockReturnValue({ appVersion });
  setWindowWidth(width);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width, height: 900 }, insets }}>{children}</SafeAreaProvider>
  );
  await render(<SettingsScreen />, { wrapper });
  return { setPreference, setLanguage };
}

const option = (name: string) => screen.getByRole('radio', { name });

function radioGroup(name: string) {
  const groups = screen.container.queryAll(
    (element) => element.props.accessibilityRole === 'radiogroup' && element.props.accessibilityLabel === name
  );
  expect(groups).toHaveLength(1);
  return groups[0];
}

// The accessibility labels of the options of a group, all or only the checked ones.
function optionLabels(group: string, options: { checked?: boolean } = {}): string[] {
  return within(radioGroup(group))
    .getAllByRole('radio', options)
    .map((element) => element.props.accessibilityLabel);
}

function contentStyle() {
  const [scrollView] = screen.container.queryAll((element) => element.props.contentContainerStyle !== undefined);
  return StyleSheet.flatten(scrollView.props.contentContainerStyle);
}

describe('SettingsScreen', () => {
  beforeEach(() => {
    headerOptions.current = null;
  });

  it('shows the theme and the language settings, in this order, each with its name', async () => {
    await renderSettings();

    expect(screen.getByText('Tema')).toBeOnTheScreen();
    expect(screen.getByText('Lingua')).toBeOnTheScreen();
    expect(screen.getAllByRole('radio').map((element) => element.props.accessibilityLabel)).toEqual([
      'Tema: Sistema',
      'Tema: Chiaro',
      'Tema: Scuro',
      'Lingua: Italiano',
      'Lingua: English',
    ]);
  });

  it('offers system, light and dark as the theme options, named after the setting', async () => {
    await renderSettings();

    expect(optionLabels('Tema')).toEqual(['Tema: Sistema', 'Tema: Chiaro', 'Tema: Scuro']);
    const options = within(radioGroup('Tema')).getAllByRole('radio');
    ['Sistema', 'Chiaro', 'Scuro'].forEach((label, index) => {
      expect(options[index]).toContainElement(screen.getByText(label));
    });
  });

  it.each([
    { preference: 'system', theme: 'dark', selected: 'Tema: Sistema' },
    { preference: 'light', theme: 'light', selected: 'Tema: Chiaro' },
    { preference: 'dark', theme: 'dark', selected: 'Tema: Scuro' },
  ] as const)(
    'selects the theme option of the $preference preference, whatever the active theme',
    async ({ preference, theme, selected }) => {
      await renderSettings({ preference, theme });

      expect(optionLabels('Tema', { checked: true })).toEqual([selected]);
    }
  );

  it.each([
    { preference: 'system', pressed: 'Tema: Chiaro', chosen: 'light' },
    { preference: 'system', pressed: 'Tema: Scuro', chosen: 'dark' },
    { preference: 'dark', pressed: 'Tema: Sistema', chosen: 'system' },
  ] as const)(
    'sets the $chosen preference when its option is pressed with the $preference preference',
    async ({ preference, pressed, chosen }) => {
      const { setPreference, setLanguage } = await renderSettings({ preference });

      await fireEvent.press(option(pressed));

      expect(setPreference.mock.calls).toEqual([[chosen]]);
      expect(setLanguage).not.toHaveBeenCalled();
    }
  );

  it('ignores a press on the theme option already selected', async () => {
    const { setPreference } = await renderSettings({ preference: 'light', theme: 'light' });

    await fireEvent.press(option('Tema: Chiaro'));

    expect(setPreference).not.toHaveBeenCalled();
  });

  it.each([
    { language: 'it', names: ['Lingua: Italiano', 'Lingua: English'], group: 'Lingua' },
    { language: 'en', names: ['Language: Italiano', 'Language: English'], group: 'Language' },
  ] as const)(
    'offers Italiano and English as the language options in the $language interface, the current one selected',
    async ({ language, names, group }) => {
      await renderSettings({ language });

      expect(optionLabels(group)).toEqual(names);
      const options = within(radioGroup(group)).getAllByRole('radio');
      expect(options[0]).toContainElement(screen.getByText('Italiano'));
      expect(options[1]).toContainElement(screen.getByText('English'));
      expect(optionLabels(group, { checked: true })).toEqual([names[language === 'it' ? 0 : 1]]);
    }
  );

  it('switches to English when its option is pressed in the Italian interface', async () => {
    const { setLanguage, setPreference } = await renderSettings({ language: 'it' });

    await fireEvent.press(option('Lingua: English'));
    await fireEvent.press(option('Lingua: Italiano'));

    expect(setLanguage.mock.calls).toEqual([['en']]);
    expect(setPreference).not.toHaveBeenCalled();
  });

  it('switches to Italian when its option is pressed in the English interface', async () => {
    const { setLanguage } = await renderSettings({ language: 'en' });

    await fireEvent.press(option('Language: Italiano'));
    await fireEvent.press(option('Language: English'));

    expect(setLanguage.mock.calls).toEqual([['it']]);
  });

  it('translates the names and the theme options in the English interface', async () => {
    await renderSettings({ language: 'en', preference: 'dark' });

    expect(screen.getByText('Theme')).toBeOnTheScreen();
    expect(screen.getByText('Language')).toBeOnTheScreen();
    expect(optionLabels('Theme')).toEqual(['Theme: System', 'Theme: Light', 'Theme: Dark']);
    expect(optionLabels('Theme', { checked: true })).toEqual(['Theme: Dark']);
    expect(screen.getByText('Version 0.30.15')).toBeOnTheScreen();
    expect(screen.getByText('Developed by Fabio Alfineo di Gabriele')).toBeOnTheScreen();
  });

  it('shows the version of the app and the footer', async () => {
    await renderSettings({ appVersion: '0.30.15' });

    expect(screen.getByText('Versione 0.30.15')).toBeOnTheScreen();
    expect(screen.getByText('Sviluppato da Fabio Alfineo di Gabriele')).toBeOnTheScreen();
  });

  it('shows only the footer when the version cannot be read', async () => {
    await renderSettings({ appVersion: null });

    expect(screen.queryByText(/^Versione/)).toBeNull();
    expect(screen.getByText('Sviluppato da Fabio Alfineo di Gabriele')).toBeOnTheScreen();
  });

  it.each([
    { language: 'it', title: 'Impostazioni' },
    { language: 'en', title: 'Settings' },
  ] as const)('titles the header $title, with the minimal back button', async ({ language, title }) => {
    await renderSettings({ language });

    expect(headerOptions.current).toEqual({ title, headerBackButtonDisplayMode: 'minimal' });
  });

  it.each([
    { width: 390, margin: 24 },
    { width: 767, margin: 24 },
    { width: 768, margin: 32 },
    { width: 1280, margin: 32 },
  ])('pads the content by $margin points on a window $width points wide', async ({ width, margin }) => {
    await renderSettings({ width });

    expect(contentStyle()).toMatchObject({ paddingLeft: margin, paddingRight: margin, paddingBottom: 16 });
  });

  it.each([
    { width: 390, margin: 24 },
    { width: 1024, margin: 32 },
  ])('adds the safe area insets to the padding of the content $width points wide', async ({ width, margin }) => {
    await renderSettings({ width, insets: INSETS });

    expect(contentStyle()).toMatchObject({
      paddingLeft: margin + INSETS.left,
      paddingRight: margin + INSETS.right,
      paddingBottom: 16 + INSETS.bottom,
    });
  });
});
