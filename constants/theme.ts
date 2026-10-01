export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: '#0a7ea4',
    icon: '#687076',
    card: '#fff', // Card and unselected chip background, same white as background
    border: '#D7DBDF', // Card and unselected chip border (Radix slate 7)
    textSecondary: '#687076', // Card description, date and author (Radix slate 11)
    placeholder: '#F1F3F5', // Image placeholder background (Radix slate 3)
    onTint: '#fff', // Text on a tint background, like the selected chip
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: '#fff',
    icon: '#9BA1A6',
    card: '#202425', // Card and unselected chip background (Radix slateDark 3)
    border: '#3A3F42', // Card and unselected chip border (Radix slateDark 7)
    textSecondary: '#9BA1A6', // Card description, date and author (Radix slateDark 11)
    placeholder: '#2B2F31', // Image placeholder background (Radix slateDark 5)
    onTint: '#151718', // Text on a tint background, like the selected chip (Radix slateDark 1)
  },
};

export const Layout = {
  desktopMinWidth: 768,
  horizontalMargin: { mobile: 24, desktop: 32 },
  cardGap: { mobile: 12, desktop: 16 },
  minCardWidth: 320,
  minColumns: 2,
};
