import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, Platform } from 'react-native';

import { themeRepository } from '@/container';
import type { Theme } from '@/domain/models/theme-model';
import { ColorSchemeContext } from '@/hooks/use-color-scheme';

export type ThemePreference = {
  theme: Theme;
  /** Switches to the other theme at once, then saves it; a failed save is ignored. */
  toggleTheme: () => void;
};

const DEFAULT_THEME: Theme = 'dark';

const OTHER_THEME: Record<Theme, Theme> = { light: 'dark', dark: 'light' };

const ThemePreferenceContext = createContext<ThemePreference | null>(null);

/**
 * Provides the chosen theme to its children, starting from the saved theme read at startup;
 * without a valid saved value the theme is dark. On Android and iOS the theme is also
 * applied to the system elements, such as alerts.
 */
export function ThemePreferenceProvider({
  initialTheme,
  children,
}: {
  /** Saved theme, or null when there is no valid one. */
  initialTheme: Theme | null;
  children: ReactNode;
}) {
  const [theme, setTheme] = useState<Theme>(initialTheme ?? DEFAULT_THEME);

  // react-native-web has no Appearance.setColorScheme: on web the context is enough.
  useEffect(() => {
    if (Platform.OS !== 'web') {
      Appearance.setColorScheme(theme);
    }
  }, [theme]);

  const value = useMemo<ThemePreference>(
    () => ({
      theme,
      toggleTheme: () => {
        const next = OTHER_THEME[theme];
        setTheme(next);
        themeRepository.saveTheme(next).catch(() => {});
      },
    }),
    [theme]
  );

  return (
    <ThemePreferenceContext.Provider value={value}>
      <ColorSchemeContext.Provider value={theme}>{children}</ColorSchemeContext.Provider>
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference(): ThemePreference {
  const value = useContext(ThemePreferenceContext);
  if (value === null) {
    throw new Error('useThemePreference must be used within a ThemePreferenceProvider');
  }
  return value;
}
