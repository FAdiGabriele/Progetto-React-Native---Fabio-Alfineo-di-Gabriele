/** Themes of the user interface, named as the two color sets of the theme constants. */
export type Theme = 'light' | 'dark';

/** Theme chosen in the settings: one of the two themes, or the theme of the device. */
export type ThemePreference = Theme | 'system';
