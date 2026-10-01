import { createContext, useContext } from 'react';

/** Active theme of the interface, named as the two color sets of the theme constants. */
export type ColorScheme = 'light' | 'dark';

/** Active theme, provided by the theme preference provider; dark without a provider. */
export const ColorSchemeContext = createContext<ColorScheme>('dark');

/**
 * Active theme, on every platform: the one chosen in the settings or, when the choice is to
 * follow the device, the theme of the device.
 */
export function useColorScheme(): ColorScheme {
  return useContext(ColorSchemeContext);
}
