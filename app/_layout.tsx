import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { I18nProvider } from '@/i18n/i18n-provider';
import { ThemePreferenceProvider } from '@/theme/theme-preference-provider';

// The news screen stays under the settings even when `/settings` is opened directly.
export const unstable_settings = {
  anchor: 'index',
};

export default function RootLayout() {
  return (
    <ThemePreferenceProvider>
      <ThemedNavigator />
    </ThemePreferenceProvider>
  );
}

// Only a child of the provider reads the chosen theme from the context.
function ThemedNavigator() {
  const isDark = useColorScheme() === 'dark';

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <I18nProvider>
        <Stack>
          <Stack.Screen name="index" options={{ title: '' }} />
          <Stack.Screen name="settings" options={{ title: '' }} dangerouslySingular />
        </Stack>
      </I18nProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
