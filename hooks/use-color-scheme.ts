import { createContext, useContext } from 'react';

/** Active theme of the interface, named as the two color sets of the theme constants. */
export type ColorScheme = 'light' | 'dark';

/** Active theme, provided by the theme preference provider; dark without a provider. */
export const ColorSchemeContext = createContext<ColorScheme>('dark');

/** Theme chosen by the user, on every platform, instead of the system theme. */
export function useColorScheme(): ColorScheme {
  return useContext(ColorSchemeContext);
}
