import { render, screen } from '@testing-library/react-native';

import { LoadingState } from '@/presentation/components/ui/loading-state';
import { Colors } from '@/presentation/theme/theme';
import { ColorSchemeContext } from '@/presentation/hooks/use-color-scheme';

const MESSAGE = 'Loading the news';
const THEMES = ['light', 'dark'] as const;

function activityIndicators() {
  return screen.container.queryAll((element) => element.type === 'ActivityIndicator');
}

describe('LoadingState', () => {
  it('shows the message', async () => {
    await render(<LoadingState message={MESSAGE} />);

    expect(screen.getByText(MESSAGE)).toBeOnTheScreen();
  });

  it('shows a large activity indicator above the message', async () => {
    await render(<LoadingState message={MESSAGE} />);

    const indicators = activityIndicators();
    const [first, second] = screen.root?.children ?? [];
    expect(indicators).toHaveLength(1);
    expect(indicators[0]).toHaveProp('size', 'large');
    expect(first).toBe(indicators[0]);
    expect(second).toBe(screen.getByText(MESSAGE));
  });

  it('centers its content in the available space', async () => {
    await render(<LoadingState message={MESSAGE} />);

    expect(screen.root).toHaveStyle({ flex: 1, alignItems: 'center', justifyContent: 'center' });
  });

  it.each(THEMES)('colors the indicator with the %s theme tint', async (scheme) => {
    await render(
      <ColorSchemeContext.Provider value={scheme}>
        <LoadingState message={MESSAGE} />
      </ColorSchemeContext.Provider>
    );

    expect(activityIndicators()[0]).toHaveProp('color', Colors[scheme].tint);
    expect(screen.getByText(MESSAGE)).toHaveStyle({ color: Colors[scheme].text });
  });
});
