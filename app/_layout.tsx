import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { I18nProvider } from '@/i18n/i18n-provider';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <I18nProvider>
        <Stack>
          <Stack.Screen name="index" options={{ title: 'Notizie' }} />
        </Stack>
      </I18nProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
