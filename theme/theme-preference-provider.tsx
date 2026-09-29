import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, Platform } from 'react-native';

import { ColorSchemeContext } from '@/hooks/use-color-scheme';
import type { Theme } from '@/repositories/theme-model';
import { getSavedTheme, saveTheme } from '@/repositories/theme-repository';

export type ThemePreference = {
  theme: Theme;
  /** Switches to the other theme at once, then saves it; a failed save is ignored. */
  toggleTheme: () => void;
};

const DEFAULT_THEME: Theme = 'dark';

const OTHER_THEME: Record<Theme, Theme> = { light: 'dark', dark: 'light' };

const ThemePreferenceContext = createContext<ThemePreference | null>(null);

/**
 * Provides the chosen theme to its children, which render only once the saved theme has
 * been read; without a valid saved value the theme is dark. On Android and iOS the theme
 * is also applied to the system elements, such as alerts.
 */
export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSavedTheme().then(
      (saved) => {
        if (!cancelled) {
          setTheme(saved ?? DEFAULT_THEME);
        }
      },
      () => {
        if (!cancelled) {
          setTheme(DEFAULT_THEME);
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // react-native-web has no Appearance.setColorScheme: on web the context is enough.
  useEffect(() => {
    if (theme !== null && Platform.OS !== 'web') {
      Appearance.setColorScheme(theme);
    }
  }, [theme]);

  const value = useMemo<ThemePreference | null>(() => {
    if (theme === null) {
      return null;
    }
    return {
      theme,
      toggleTheme: () => {
        const next = OTHER_THEME[theme];
        setTheme(next);
        saveTheme(next).catch(() => {});
      },
    };
  }, [theme]);

  if (value === null) {
    return null;
  }
  return (
    <ThemePreferenceContext.Provider value={value}>
      <ColorSchemeContext.Provider value={value.theme}>{children}</ColorSchemeContext.Provider>
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
