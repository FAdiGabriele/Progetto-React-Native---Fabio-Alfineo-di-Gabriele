import { createContext, useContext } from 'react';

export type ColorScheme = 'light' | 'dark';

export const ColorSchemeContext = createContext<ColorScheme>('dark');

/**
 * Active theme, on every platform: the one chosen in the settings or, when the choice is to
 * follow the device, the theme of the device.
 */
export function useColorScheme(): ColorScheme {
  return useContext(ColorSchemeContext);
}
