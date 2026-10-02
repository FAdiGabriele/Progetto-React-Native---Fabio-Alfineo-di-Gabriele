import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, type ReactNode } from 'react';

import { languageRepository, themeRepository } from '@/di/container';
import type { Language } from '@/domain/models/language-model';
import type { ThemePreference } from '@/domain/models/theme-model';
import { I18nProvider } from '@/presentation/i18n/i18n-provider';
import { ThemePreferenceProvider } from '@/presentation/theme/theme-preference-provider';

type SavedPreferences = { theme: ThemePreference | null; language: Language | null };

// Called while the module loads, before the first render: later the splash screen may be gone.
SplashScreen.preventAutoHideAsync().catch(() => {});

// The two reads start together; a read that fails counts as nothing saved.
async function readSavedPreferences(): Promise<SavedPreferences> {
  const [theme, language] = await Promise.all([
    themeRepository.getSavedTheme().catch(() => null),
    languageRepository.getSavedLanguage().catch(() => null),
  ]);
  return { theme, language };
}

/**
 * Startup of the app: reads the saved theme preference and the saved language together while
 * the native splash screen stays visible, then renders its children inside the theme and
 * language providers and hides the splash screen, so the first screen already has both.
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
    <ThemePreferenceProvider initialPreference={preferences.theme}>
      <I18nProvider initialLanguage={preferences.language}>{children}</I18nProvider>
    </ThemePreferenceProvider>
  );
}
