import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  CategoryChips,
  type CategoryChipOption,
  type CategoryChipsProps,
} from '@/components/news/category-chips';
import { Colors } from '@/constants/theme';
import { ColorSchemeContext } from '@/hooks/use-color-scheme';

jest.mock('react-native-safe-area-context', () =>
  jest.requireActual('react-native-safe-area-context/jest/mock').default
);

type SectionKey = 'italy' | 'world' | 'sport';

const OPTIONS: CategoryChipOption<SectionKey>[] = [
  { key: 'italy', label: 'Italy' },
  { key: 'world', label: 'World' },
  { key: 'sport', label: 'Sport' },
];
const INSETS = { top: 0, right: 20, bottom: 21, left: 10 };
const THEMES = ['light', 'dark'] as const;

function WithInsets({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 844, height: 390 }, insets: INSETS }}>
      {children}
    </SafeAreaProvider>
  );
}

function chipsElement(props: Partial<CategoryChipsProps<SectionKey>> = {}) {
  return (
    <CategoryChips<SectionKey>
      options={OPTIONS}
      selectedKey="italy"
      onSelect={jest.fn()}
      horizontalMargin={24}
      {...props}
    />
  );
}

function chip(label: string) {
  return screen.getByRole('button', { name: label });
}

function contentStyle() {
  return StyleSheet.flatten(screen.root?.props.contentContainerStyle);
}

describe('CategoryChips', () => {
  it('renders one button per option, in order, named and labelled by the option label', async () => {
    await render(chipsElement());

    const labels = screen.getAllByRole('button').map((element) => element.props.accessibilityLabel);
    expect(labels).toEqual(['Italy', 'World', 'Sport']);
    for (const option of OPTIONS) {
      expect(chip(option.label)).toContainElement(screen.getByText(option.label));
    }
  });

  it('marks only the selected chip as selected', async () => {
    await render(chipsElement({ selectedKey: 'world' }));

    expect(chip('World')).toBeSelected();
    expect(chip('Italy')).not.toBeSelected();
    expect(chip('Sport')).not.toBeSelected();
    expect(screen.getAllByRole('button', { selected: true })).toHaveLength(1);
  });

  it('calls onSelect with the key of a pressed unselected chip', async () => {
    const onSelect = jest.fn();
    await render(chipsElement({ onSelect }));

    await fireEvent.press(chip('Sport'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('sport');
  });

  it('ignores presses on the selected chip', async () => {
    const onSelect = jest.fn();
    await render(chipsElement({ onSelect }));

    await fireEvent.press(chip('Italy'));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('follows the selected key when it changes', async () => {
    const onSelect = jest.fn();
    await render(chipsElement({ onSelect }));

    await screen.rerender(chipsElement({ selectedKey: 'sport', onSelect }));
    expect(chip('Sport')).toBeSelected();
    expect(chip('Italy')).not.toBeSelected();

    await fireEvent.press(chip('Sport'));
    await fireEvent.press(chip('Italy'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('italy');
  });

  it('extends the touch area of every chip by 4 points', async () => {
    await render(chipsElement());

    for (const element of screen.getAllByRole('button')) {
      expect(element).toHaveProp('hitSlop', 4);
    }
  });

  it('scrolls horizontally without a scroll indicator', async () => {
    await render(chipsElement());

    expect(screen.root).toHaveProp('horizontal', true);
    expect(screen.root).toHaveProp('showsHorizontalScrollIndicator', false);
  });

  it('pads the content by the horizontal margin when there are no insets', async () => {
    await render(chipsElement({ horizontalMargin: 24 }));

    expect(contentStyle()).toMatchObject({ paddingLeft: 24, paddingRight: 24 });
  });

  it('adds the left and right safe area insets to the horizontal margin', async () => {
    await render(chipsElement({ horizontalMargin: 32 }), { wrapper: WithInsets });

    expect(contentStyle()).toMatchObject({
      paddingLeft: 32 + INSETS.left,
      paddingRight: 32 + INSETS.right,
    });
  });

  it.each(THEMES)('fills the selected chip with the tint of the %s theme', async (scheme) => {
    const colors = Colors[scheme];
    await render(<ColorSchemeContext.Provider value={scheme}>{chipsElement()}</ColorSchemeContext.Provider>);

    expect(chip('Italy')).toHaveStyle({ backgroundColor: colors.tint, borderColor: colors.tint });
    expect(screen.getByText('Italy')).toHaveStyle({ color: colors.onTint, fontWeight: '600' });
  });

  it.each(THEMES)('draws unselected chips with the card, border and text colors of the %s theme', async (scheme) => {
    const colors = Colors[scheme];
    await render(<ColorSchemeContext.Provider value={scheme}>{chipsElement()}</ColorSchemeContext.Provider>);

    for (const label of ['World', 'Sport']) {
      expect(chip(label)).toHaveStyle({ backgroundColor: colors.card, borderColor: colors.border });
      expect(screen.getByText(label)).toHaveStyle({ color: colors.text, fontWeight: 'normal' });
    }
  });
});
