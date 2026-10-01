/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    card: '#fff', // Card and unselected chip background, same white as background
    border: '#D7DBDF', // Card and unselected chip border (Radix slate 7)
    textSecondary: '#687076', // Card description, date and author (Radix slate 11)
    placeholder: '#F1F3F5', // Image placeholder background (Radix slate 3)
    onTint: '#fff', // Text on a tint background, like the selected chip
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    card: '#202425', // Card and unselected chip background (Radix slateDark 3)
    border: '#3A3F42', // Card and unselected chip border (Radix slateDark 7)
    textSecondary: '#9BA1A6', // Card description, date and author (Radix slateDark 11)
    placeholder: '#2B2F31', // Image placeholder background (Radix slateDark 5)
    onTint: '#151718', // Text on a tint background, like the selected chip (Radix slateDark 1)
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const Layout = {
  desktopMinWidth: 768,
  horizontalMargin: { mobile: 24, desktop: 32 },
  cardGap: { mobile: 12, desktop: 16 },
  minCardWidth: 320,
  minColumns: 2,
};
