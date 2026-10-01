import { Ionicons } from '@expo/vector-icons';
import { fireEvent, isHiddenFromAccessibility, render, screen } from '@testing-library/react-native';

import { IconButton } from '@/components/ui/icon-button';
import { Colors } from '@/constants/theme';
import { ColorSchemeContext } from '@/hooks/use-color-scheme';

const LABEL = 'Settings';
const ICON = String.fromCodePoint(Number(Ionicons.glyphMap['settings-outline']));
const THEMES = ['light', 'dark'] as const;

describe('IconButton', () => {
  it('exposes a button named by its accessibility label', async () => {
    await render(<IconButton icon="settings-outline" accessibilityLabel={LABEL} onPress={jest.fn()} />);

    expect(screen.getByRole('button', { name: LABEL })).toBeEnabled();
  });

  it('calls onPress when pressed', async () => {
    const onPress = jest.fn();
    await render(<IconButton icon="settings-outline" accessibilityLabel={LABEL} onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: LABEL }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('keeps a touch target of at least 44 by 44 points', async () => {
    await render(<IconButton icon="settings-outline" accessibilityLabel={LABEL} onPress={jest.fn()} />);

    expect(screen.getByRole('button', { name: LABEL })).toHaveStyle({ minWidth: 44, minHeight: 44 });
  });

  it('shows the requested icon inside the button, hidden from accessibility', async () => {
    await render(<IconButton icon="settings-outline" accessibilityLabel={LABEL} onPress={jest.fn()} />);

    expect(screen.queryByText(ICON)).not.toBeOnTheScreen();
    const icon = screen.getByText(ICON, { includeHiddenElements: true });
    expect(icon).toHaveProp('aria-hidden', true);
    expect(isHiddenFromAccessibility(icon)).toBe(true);
    expect(icon).toHaveStyle({ fontSize: 24 });
    expect(screen.getByRole('button', { name: LABEL })).toContainElement(icon);
  });

  it.each(THEMES)('colors the icon with the %s theme tint', async (scheme) => {
    await render(
      <ColorSchemeContext.Provider value={scheme}>
        <IconButton icon="settings-outline" accessibilityLabel={LABEL} onPress={jest.fn()} />
      </ColorSchemeContext.Provider>
    );

    expect(screen.getByText(ICON, { includeHiddenElements: true })).toHaveStyle({
      color: Colors[scheme].tint,
    });
  });
});
