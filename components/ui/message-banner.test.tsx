import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MessageBanner } from '@/components/ui/message-banner';
import { Colors } from '@/constants/theme';
import { ColorSchemeContext } from '@/hooks/use-color-scheme';

jest.mock('react-native-safe-area-context', () =>
  jest.requireActual('react-native-safe-area-context/jest/mock').default
);

const MESSAGE = 'The news could not be updated.';
const CLOSE = 'Close';
const INSETS = { top: 47, right: 20, bottom: 34, left: 10 };
const THEMES = ['light', 'dark'] as const;

function WithInsets({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 844, height: 390 }, insets: INSETS }}>
      {children}
    </SafeAreaProvider>
  );
}

describe('MessageBanner', () => {
  it('shows the message in a container with the alert role', async () => {
    await render(
      <MessageBanner message={MESSAGE} closeLabel={CLOSE} onClose={jest.fn()} horizontalMargin={24} />
    );

    expect(screen.root).toHaveProp('accessibilityRole', 'alert');
    expect(screen.root).toContainElement(screen.getByText(MESSAGE));
  });

  it('offers a close button named by the close label, after the message', async () => {
    await render(
      <MessageBanner message={MESSAGE} closeLabel={CLOSE} onClose={jest.fn()} horizontalMargin={24} />
    );

    const button = screen.getByRole('button', { name: CLOSE });
    const [first, second] = screen.root?.children ?? [];
    expect(button).toContainElement(screen.getByText(CLOSE));
    expect(first).toBe(screen.getByText(MESSAGE));
    expect(second).toBe(button);
  });

  it('calls onClose when the close button is pressed', async () => {
    const onClose = jest.fn();
    await render(
      <MessageBanner message={MESSAGE} closeLabel={CLOSE} onClose={onClose} horizontalMargin={24} />
    );

    await fireEvent.press(screen.getByRole('button', { name: CLOSE }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('applies the horizontal margin on both sides when there are no insets', async () => {
    await render(
      <MessageBanner message={MESSAGE} closeLabel={CLOSE} onClose={jest.fn()} horizontalMargin={24} />
    );

    expect(screen.root).toHaveStyle({ marginLeft: 24, marginRight: 24 });
  });

  it('adds the left and right safe area insets to the horizontal margin', async () => {
    await render(
      <MessageBanner message={MESSAGE} closeLabel={CLOSE} onClose={jest.fn()} horizontalMargin={32} />,
      { wrapper: WithInsets }
    );

    expect(screen.root).toHaveStyle({ marginLeft: 32 + INSETS.left, marginRight: 32 + INSETS.right });
  });

  it.each(THEMES)('uses the card and border colors of the %s theme', async (scheme) => {
    await render(
      <ColorSchemeContext.Provider value={scheme}>
        <MessageBanner message={MESSAGE} closeLabel={CLOSE} onClose={jest.fn()} horizontalMargin={24} />
      </ColorSchemeContext.Provider>
    );

    expect(screen.root).toHaveStyle({
      backgroundColor: Colors[scheme].card,
      borderColor: Colors[scheme].border,
      borderWidth: 1,
    });
    expect(screen.getByText(MESSAGE)).toHaveStyle({ color: Colors[scheme].text });
  });
});
