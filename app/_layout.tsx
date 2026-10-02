import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppBootstrap } from '@/presentation/bootstrap/app-bootstrap';
import { useColorScheme } from '@/presentation/hooks/use-color-scheme';

// The news screen stays under the settings even when `/settings` is opened directly.
export const unstable_settings = {
  anchor: 'index',
};

export default function RootLayout() {
  return (
    <AppBootstrap>
      <ThemedNavigator />
    </AppBootstrap>
  );
}

// Only inside the bootstrap, which mounts the theme provider, the context has the active theme.
function ThemedNavigator() {
  const isDark = useColorScheme() === 'dark';

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ title: '' }} />
        <Stack.Screen name="settings" options={{ title: '' }} dangerouslySingular />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
