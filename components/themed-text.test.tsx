import { render, screen } from '@testing-library/react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { ColorSchemeContext } from '@/hooks/use-color-scheme';

const TEXT = 'Latest news';
const LIGHT_COLOR = '#123456';
const DARK_COLOR = '#abcdef';
const THEMES = ['light', 'dark'] as const;

describe('ThemedText', () => {
  it.each(THEMES)('uses the text color of the %s theme and the default size by default', async (scheme) => {
    await render(
      <ColorSchemeContext.Provider value={scheme}>
        <ThemedText>{TEXT}</ThemedText>
      </ColorSchemeContext.Provider>
    );

    expect(screen.getByText(TEXT)).toHaveStyle({ color: Colors[scheme].text, fontSize: 16, lineHeight: 24 });
  });

  it.each(THEMES)('uses the secondary text color of the %s theme at 13 points for the secondary type', async (scheme) => {
    await render(
      <ColorSchemeContext.Provider value={scheme}>
        <ThemedText type="secondary">{TEXT}</ThemedText>
      </ColorSchemeContext.Provider>
    );

    expect(screen.getByText(TEXT)).toHaveStyle({
      color: Colors[scheme].textSecondary,
      fontSize: 13,
      lineHeight: 18,
    });
  });

  it.each(THEMES)('uses the tint of the %s theme for the link type', async (scheme) => {
    await render(
      <ColorSchemeContext.Provider value={scheme}>
        <ThemedText type="link">{TEXT}</ThemedText>
      </ColorSchemeContext.Provider>
    );

    expect(screen.getByText(TEXT)).toHaveStyle({ color: Colors[scheme].tint, fontSize: 16 });
  });

  it.each([
    ['light', LIGHT_COLOR],
    ['dark', DARK_COLOR],
  ] as const)('uses the override color of the %s theme', async (scheme, color) => {
    await render(
      <ColorSchemeContext.Provider value={scheme}>
        <ThemedText lightColor={LIGHT_COLOR} darkColor={DARK_COLOR} type="secondary">
          {TEXT}
        </ThemedText>
      </ColorSchemeContext.Provider>
    );

    expect(screen.getByText(TEXT)).toHaveStyle({ color });
  });

  it('keeps the theme color when only the other theme has an override', async () => {
    await render(
      <ColorSchemeContext.Provider value="dark">
        <ThemedText lightColor={LIGHT_COLOR}>{TEXT}</ThemedText>
      </ColorSchemeContext.Provider>
    );

    expect(screen.getByText(TEXT)).toHaveStyle({ color: Colors.dark.text });
  });

  it('lets the style prop override the color and the size of the type', async () => {
    await render(
      <ThemedText type="secondary" style={{ color: LIGHT_COLOR, fontSize: 20 }}>
        {TEXT}
      </ThemedText>
    );

    expect(screen.getByText(TEXT)).toHaveStyle({ color: LIGHT_COLOR, fontSize: 20, lineHeight: 18 });
  });

  it('uses the dark theme without a theme provider', async () => {
    await render(<ThemedText>{TEXT}</ThemedText>);

    expect(screen.getByText(TEXT)).toHaveStyle({ color: Colors.dark.text });
  });

  it('passes the other Text props through', async () => {
    await render(
      <ThemedText numberOfLines={2} accessibilityRole="header">
        {TEXT}
      </ThemedText>
    );

    expect(screen.getByRole('header', { name: TEXT })).toHaveProp('numberOfLines', 2);
  });
});
