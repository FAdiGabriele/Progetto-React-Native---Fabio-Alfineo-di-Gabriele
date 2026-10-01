import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, Platform, useColorScheme as useDeviceColorScheme } from 'react-native';

import { themeRepository } from '@/container';
import type { Theme, ThemePreference } from '@/domain/models/theme-model';
import { ColorSchemeContext } from '@/hooks/use-color-scheme';

export type ThemePreferenceValue = {
  /** Choice made in the settings: one of the two themes, or the theme of the device. */
  preference: ThemePreference;
  /** Theme shown by the interface: the chosen one or, with the "system" choice, the one of the device. */
  theme: Theme;
  /** Applies the preference at once, then saves it; a failed save is ignored. */
  setPreference: (preference: ThemePreference) => void;
};

const DEFAULT_PREFERENCE: ThemePreference = 'system';

const ThemePreferenceContext = createContext<ThemePreferenceValue | null>(null);

/**
 * Provides the active theme to its children, starting from the saved preference read at
 * startup; without a valid saved value the app follows the theme of the device, also while
 * it changes. On Android and iOS the preference is also applied to the system elements,
 * such as alerts.
 */
export function ThemePreferenceProvider({
  initialPreference,
  children,
}: {
  /** Saved theme preference, or null when there is no valid one. */
  initialPreference: ThemePreference | null;
  children: ReactNode;
}) {
  const [preference, setPreferenceState] = useState<ThemePreference>(
    initialPreference ?? DEFAULT_PREFERENCE
  );
  const deviceScheme = useDeviceColorScheme();
  const deviceTheme: Theme = deviceScheme === 'dark' ? 'dark' : 'light';
  const theme = preference === 'system' ? deviceTheme : preference;

  // "unspecified" removes the override, so the device theme is readable again.
  // react-native-web has no Appearance.setColorScheme: on web the context is enough.
  useEffect(() => {
    if (Platform.OS !== 'web') {
      Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
    }
  }, [preference]);

  const value = useMemo<ThemePreferenceValue>(
    () => ({
      preference,
      theme,
      setPreference: (next) => {
        setPreferenceState(next);
        themeRepository.saveTheme(next).catch(() => {});
      },
    }),
    [preference, theme]
  );

  return (
    <ThemePreferenceContext.Provider value={value}>
      <ColorSchemeContext.Provider value={theme}>{children}</ColorSchemeContext.Provider>
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference(): ThemePreferenceValue {
  const value = useContext(ThemePreferenceContext);
  if (value === null) {
    throw new Error('useThemePreference must be used within a ThemePreferenceProvider');
  }
  return value;
}
