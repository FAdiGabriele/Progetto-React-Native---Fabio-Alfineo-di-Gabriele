import { fireEvent, render, screen } from '@testing-library/react-native';

import { TextButton } from '@/presentation/components/ui/text-button';
import { Colors } from '@/presentation/theme/theme';
import { ColorSchemeContext } from '@/presentation/hooks/use-color-scheme';

const TITLE = 'Retry';
const LABEL = 'Retry loading the news';
const THEMES = ['light', 'dark'] as const;

function activityIndicators() {
  return screen.container.queryAll((element) => element.type === 'ActivityIndicator');
}

describe('TextButton', () => {
  it('exposes an enabled button named by its accessibility label that shows the title', async () => {
    await render(<TextButton title={TITLE} accessibilityLabel={LABEL} onPress={jest.fn()} />);

    const button = screen.getByRole('button', { name: LABEL });
    expect(button).toContainElement(screen.getByText(TITLE));
    expect(button).toBeEnabled();
    expect(button).not.toBeBusy();
    expect(activityIndicators()).toHaveLength(0);
  });

  it('calls onPress once for each press', async () => {
    const onPress = jest.fn();
    await render(<TextButton title={TITLE} accessibilityLabel={LABEL} onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: LABEL }));
    expect(onPress).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByRole('button', { name: LABEL }));
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('replaces the title with a small activity indicator while loading', async () => {
    await render(<TextButton title={TITLE} accessibilityLabel={LABEL} onPress={jest.fn()} loading />);

    const button = screen.getByRole('button', { name: LABEL });
    const indicators = activityIndicators();
    expect(screen.queryByText(TITLE)).not.toBeOnTheScreen();
    expect(indicators).toHaveLength(1);
    expect(button).toContainElement(indicators[0]);
    expect(indicators[0]).toHaveProp('size', 'small');
  });

  it('is disabled and busy while loading and ignores presses', async () => {
    const onPress = jest.fn();
    await render(<TextButton title={TITLE} accessibilityLabel={LABEL} onPress={onPress} loading />);

    const button = screen.getByRole('button', { name: LABEL });
    expect(button).toBeDisabled();
    expect(button).toBeBusy();

    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows the title and accepts presses again once loading ends', async () => {
    const onPress = jest.fn();
    await render(<TextButton title={TITLE} accessibilityLabel={LABEL} onPress={onPress} loading />);

    await screen.rerender(<TextButton title={TITLE} accessibilityLabel={LABEL} onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: LABEL }));

    expect(screen.getByText(TITLE)).toBeOnTheScreen();
    expect(activityIndicators()).toHaveLength(0);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('keeps a touch target of at least 44 by 44 points', async () => {
    await render(<TextButton title={TITLE} accessibilityLabel={LABEL} onPress={jest.fn()} />);

    expect(screen.getByRole('button', { name: LABEL })).toHaveStyle({ minWidth: 44, minHeight: 44 });
  });

  it.each(THEMES)('colors the title and the indicator with the %s theme tint', async (scheme) => {
    await render(
      <ColorSchemeContext.Provider value={scheme}>
        <TextButton title={TITLE} accessibilityLabel={LABEL} onPress={jest.fn()} />
      </ColorSchemeContext.Provider>
    );
    expect(screen.getByText(TITLE)).toHaveStyle({ color: Colors[scheme].tint });

    await screen.rerender(
      <ColorSchemeContext.Provider value={scheme}>
        <TextButton title={TITLE} accessibilityLabel={LABEL} onPress={jest.fn()} loading />
      </ColorSchemeContext.Provider>
    );
    expect(activityIndicators()[0]).toHaveProp('color', Colors[scheme].tint);
  });
});
