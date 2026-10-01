import { fireEvent, render, screen } from '@testing-library/react-native';

import { ListRow } from '@/components/ui/list-row';
import { Colors } from '@/constants/theme';
import { ColorSchemeContext } from '@/hooks/use-color-scheme';

const LABEL = 'Theme';
const VALUE = 'System';
const ACCESSIBILITY_LABEL = 'Theme: System';
const THEMES = ['light', 'dark'] as const;

describe('ListRow', () => {
  it('shows the label and the value', async () => {
    await render(
      <ListRow label={LABEL} value={VALUE} accessibilityLabel={ACCESSIBILITY_LABEL} onPress={jest.fn()} />
    );

    expect(screen.getByText(LABEL)).toBeOnTheScreen();
    expect(screen.getByText(VALUE)).toBeOnTheScreen();
  });

  it('exposes a button named by its accessibility label that holds both texts', async () => {
    await render(
      <ListRow label={LABEL} value={VALUE} accessibilityLabel={ACCESSIBILITY_LABEL} onPress={jest.fn()} />
    );

    const [first, second] = screen.getByRole('button', { name: ACCESSIBILITY_LABEL }).children;
    expect(first).toBe(screen.getByText(LABEL));
    expect(second).toBe(screen.getByText(VALUE));
  });

  it('calls onPress when pressed', async () => {
    const onPress = jest.fn();
    await render(
      <ListRow label={LABEL} value={VALUE} accessibilityLabel={ACCESSIBILITY_LABEL} onPress={onPress} />
    );

    await fireEvent.press(screen.getByRole('button', { name: ACCESSIBILITY_LABEL }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('keeps a minimum height of 48 points', async () => {
    await render(
      <ListRow label={LABEL} value={VALUE} accessibilityLabel={ACCESSIBILITY_LABEL} onPress={jest.fn()} />
    );

    expect(screen.getByRole('button', { name: ACCESSIBILITY_LABEL })).toHaveStyle({ minHeight: 48 });
  });

  it('keeps the label and the value on one line each, the value aligned to the right', async () => {
    await render(
      <ListRow label={LABEL} value={VALUE} accessibilityLabel={ACCESSIBILITY_LABEL} onPress={jest.fn()} />
    );

    expect(screen.getByText(LABEL)).toHaveProp('numberOfLines', 1);
    expect(screen.getByText(VALUE)).toHaveProp('numberOfLines', 1);
    expect(screen.getByText(VALUE)).toHaveStyle({ textAlign: 'right' });
  });

  it.each(THEMES)('uses the %s theme colors for the texts and the separator', async (scheme) => {
    await render(
      <ColorSchemeContext.Provider value={scheme}>
        <ListRow label={LABEL} value={VALUE} accessibilityLabel={ACCESSIBILITY_LABEL} onPress={jest.fn()} />
      </ColorSchemeContext.Provider>
    );

    expect(screen.getByText(LABEL)).toHaveStyle({ color: Colors[scheme].text });
    expect(screen.getByText(VALUE)).toHaveStyle({ color: Colors[scheme].textSecondary });
    expect(screen.getByRole('button', { name: ACCESSIBILITY_LABEL })).toHaveStyle({
      borderBottomWidth: 1,
      borderBottomColor: Colors[scheme].border,
    });
  });
});
