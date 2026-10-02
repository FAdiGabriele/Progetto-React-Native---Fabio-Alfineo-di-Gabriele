import { Ionicons } from '@expo/vector-icons';
import { fireEvent, isHiddenFromAccessibility, render, screen } from '@testing-library/react-native';

import { ErrorState } from '@/presentation/components/ui/error-state';
import { Colors } from '@/presentation/theme/theme';
import { ColorSchemeContext } from '@/presentation/hooks/use-color-scheme';

const MESSAGE = 'The news could not be loaded.';
const RETRY = 'Try again';
const ICON = String.fromCodePoint(Number(Ionicons.glyphMap['alert-circle-outline']));
const THEMES = ['light', 'dark'] as const;

describe('ErrorState', () => {
  it('shows the message and the retry label', async () => {
    await render(<ErrorState message={MESSAGE} retryLabel={RETRY} onRetry={jest.fn()} />);

    expect(screen.getByText(MESSAGE)).toBeOnTheScreen();
    expect(screen.getByText(RETRY)).toBeOnTheScreen();
  });

  it('exposes the retry action as a button named by the retry label', async () => {
    await render(<ErrorState message={MESSAGE} retryLabel={RETRY} onRetry={jest.fn()} />);

    const button = screen.getByRole('button', { name: RETRY });
    expect(button).toContainElement(screen.getByText(RETRY));
    expect(button).toBeEnabled();
  });

  it('calls onRetry when the retry button is pressed', async () => {
    const onRetry = jest.fn();
    await render(<ErrorState message={MESSAGE} retryLabel={RETRY} onRetry={onRetry} />);

    await fireEvent.press(screen.getByRole('button', { name: RETRY }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the alert icon above the message, hidden from accessibility', async () => {
    await render(<ErrorState message={MESSAGE} retryLabel={RETRY} onRetry={jest.fn()} />);

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
        <ErrorState message={MESSAGE} retryLabel={RETRY} onRetry={jest.fn()} />
      </ColorSchemeContext.Provider>
    );

    expect(screen.getByText(ICON, { includeHiddenElements: true })).toHaveStyle({
      color: Colors[scheme].icon,
    });
  });
});
