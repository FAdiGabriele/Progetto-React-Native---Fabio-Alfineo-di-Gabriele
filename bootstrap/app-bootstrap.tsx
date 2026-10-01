import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, type ReactNode } from 'react';

import { I18nProvider } from '@/i18n/i18n-provider';
import type { Language } from '@/repositories/language-model';
import { getSavedLanguage } from '@/repositories/language-repository';
import type { Theme } from '@/repositories/theme-model';
import { getSavedTheme } from '@/repositories/theme-repository';
import { ThemePreferenceProvider } from '@/theme/theme-preference-provider';

type SavedPreferences = { theme: Theme | null; language: Language | null };

// Called while the module loads, before the first render: later the splash screen may be gone.
SplashScreen.preventAutoHideAsync().catch(() => {});

// The two reads start together; a read that fails counts as nothing saved.
async function readSavedPreferences(): Promise<SavedPreferences> {
  const [theme, language] = await Promise.all([
    getSavedTheme().catch(() => null),
    getSavedLanguage().catch(() => null),
  ]);
  return { theme, language };
}

/**
 * Startup of the app: reads the saved theme and the saved language together while the native
 * splash screen stays visible, then renders its children inside the theme and language
 * providers and hides the splash screen, so the first screen already has both.
 */
export function AppBootstrap({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<SavedPreferences | null>(null);

  useEffect(() => {
    let cancelled = false;
    readSavedPreferences().then((saved) => {
      if (!cancelled) {
        setPreferences(saved);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const isReady = preferences !== null;
  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isReady]);

  if (preferences === null) {
    return null;
  }
  return (
    <ThemePreferenceProvider initialTheme={preferences.theme}>
      <I18nProvider initialLanguage={preferences.language}>{children}</I18nProvider>
    </ThemePreferenceProvider>
  );
}
