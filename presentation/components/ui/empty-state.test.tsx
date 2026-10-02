import { Ionicons } from '@expo/vector-icons';
import { fireEvent, isHiddenFromAccessibility, render, screen } from '@testing-library/react-native';

import { EmptyState } from '@/presentation/components/ui/empty-state';
import { Colors } from '@/presentation/theme/theme';
import { ColorSchemeContext } from '@/presentation/hooks/use-color-scheme';

const MESSAGE = 'There is no news to show.';
const RETRY = 'Reload';
const ICON = String.fromCodePoint(Number(Ionicons.glyphMap['file-tray-outline']));
const THEMES = ['light', 'dark'] as const;

describe('EmptyState', () => {
  it('shows the message and the retry label', async () => {
    await render(<EmptyState message={MESSAGE} retryLabel={RETRY} onRetry={jest.fn()} />);

    expect(screen.getByText(MESSAGE)).toBeOnTheScreen();
    expect(screen.getByText(RETRY)).toBeOnTheScreen();
  });

  it('exposes the retry action as a button named by the retry label', async () => {
    await render(<EmptyState message={MESSAGE} retryLabel={RETRY} onRetry={jest.fn()} />);

    const button = screen.getByRole('button', { name: RETRY });
    expect(button).toContainElement(screen.getByText(RETRY));
    expect(button).toBeEnabled();
  });

  it('calls onRetry when the retry button is pressed', async () => {
    const onRetry = jest.fn();
    await render(<EmptyState message={MESSAGE} retryLabel={RETRY} onRetry={onRetry} />);

    await fireEvent.press(screen.getByRole('button', { name: RETRY }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the empty tray icon above the message, hidden from accessibility', async () => {
    await render(<EmptyState message={MESSAGE} retryLabel={RETRY} onRetry={jest.fn()} />);

    expect(screen.queryByText(ICON)).not.toBeOnTheScreen();
    const icon = screen.getByText(ICON, { includeHiddenElements: true });
    expect(icon.parent).toHaveProp('aria-hidden', true);
    expect(isHiddenFromAccessibility(icon)).toBe(true);
    expect(icon).toHaveStyle({ fontSize: 48 });
    expect(screen.root?.children[0]).toBe(icon.parent);
  });

  it.each(THEMES)('colors the icon with the %s theme', async (scheme) => {
    await render(
      <ColorSchemeContext.Provider value={scheme}>
        <EmptyState message={MESSAGE} retryLabel={RETRY} onRetry={jest.fn()} />
      </ColorSchemeContext.Provider>
    );

    expect(screen.getByText(ICON, { includeHiddenElements: true })).toHaveStyle({
      color: Colors[scheme].icon,
    });
  });
});
