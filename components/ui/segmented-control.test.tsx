import { fireEvent, render, screen } from '@testing-library/react-native';

import {
  SegmentedControl,
  type SegmentedControlOption,
  type SegmentedControlProps,
} from '@/components/ui/segmented-control';
import { Colors } from '@/constants/theme';
import { ColorSchemeContext } from '@/hooks/use-color-scheme';

type ThemeKey = 'system' | 'light' | 'dark';

const OPTIONS: SegmentedControlOption<ThemeKey>[] = [
  { key: 'system', label: 'System', accessibilityLabel: 'Theme: System' },
  { key: 'light', label: 'Light', accessibilityLabel: 'Theme: Light' },
  { key: 'dark', label: 'Dark', accessibilityLabel: 'Theme: Dark' },
];
const THEMES = ['light', 'dark'] as const;

function controlElement(props: Partial<SegmentedControlProps<ThemeKey>> = {}) {
  return (
    <SegmentedControl<ThemeKey>
      options={OPTIONS}
      selectedKey="light"
      onSelect={jest.fn()}
      accessibilityLabel="Theme"
      {...props}
    />
  );
}

function option(accessibilityLabel: string) {
  return screen.getByRole('radio', { name: accessibilityLabel });
}

describe('SegmentedControl', () => {
  it('renders one radio option per option, in order, with its label and its own accessibility label', async () => {
    await render(controlElement());

    const options = screen.getAllByRole('radio');
    expect(options.map((element) => element.props.accessibilityLabel)).toEqual([
      'Theme: System',
      'Theme: Light',
      'Theme: Dark',
    ]);
    OPTIONS.forEach(({ label }, index) => {
      expect(options[index]).toContainElement(screen.getByText(label));
    });
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('groups the options in a radio group named by its accessibility label', async () => {
    await render(controlElement());

    expect(screen.root).toHaveProp('accessibilityRole', 'radiogroup');
    expect(screen.root).toHaveProp('accessibilityLabel', 'Theme');
    for (const element of screen.getAllByRole('radio')) {
      expect(screen.root).toContainElement(element);
    }
  });

  it('marks only the selected option as checked', async () => {
    await render(controlElement({ selectedKey: 'dark' }));

    expect(option('Theme: Dark')).toBeChecked();
    expect(option('Theme: System')).not.toBeChecked();
    expect(option('Theme: Light')).not.toBeChecked();
    expect(screen.getAllByRole('radio', { checked: true }).map((element) => element.props.accessibilityLabel)).toEqual([
      'Theme: Dark',
    ]);
  });

  it('calls onSelect with the key of a pressed unselected option', async () => {
    const onSelect = jest.fn();
    await render(controlElement({ onSelect }));

    await fireEvent.press(option('Theme: System'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('system');
  });

  it('ignores presses on the selected option', async () => {
    const onSelect = jest.fn();
    await render(controlElement({ onSelect }));

    await fireEvent.press(option('Theme: Light'));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('follows the selected key when it changes', async () => {
    const onSelect = jest.fn();
    await render(controlElement({ onSelect }));

    await screen.rerender(controlElement({ selectedKey: 'system', onSelect }));
    expect(option('Theme: System')).toBeChecked();
    expect(option('Theme: Light')).not.toBeChecked();

    await fireEvent.press(option('Theme: System'));
    await fireEvent.press(option('Theme: Light'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('light');
  });

  it('keeps every option at least 44 points high and every label on one line', async () => {
    await render(controlElement());

    for (const element of screen.getAllByRole('radio')) {
      expect(element).toHaveStyle({ minHeight: 44 });
    }
    for (const { label } of OPTIONS) {
      expect(screen.getByText(label)).toHaveProp('numberOfLines', 1);
    }
  });

  it.each(THEMES)('fills the selected option with the tint of the %s theme', async (scheme) => {
    const colors = Colors[scheme];
    await render(<ColorSchemeContext.Provider value={scheme}>{controlElement()}</ColorSchemeContext.Provider>);

    expect(option('Theme: Light')).toHaveStyle({ backgroundColor: colors.tint });
    expect(screen.getByText('Light')).toHaveStyle({ color: colors.onTint, fontWeight: '600' });
  });

  it.each(THEMES)('draws unselected options with the text color of the %s theme over the group', async (scheme) => {
    const colors = Colors[scheme];
    await render(<ColorSchemeContext.Provider value={scheme}>{controlElement()}</ColorSchemeContext.Provider>);

    for (const label of ['System', 'Dark']) {
      expect(option(`Theme: ${label}`)).not.toHaveStyle({ backgroundColor: colors.tint });
      expect(screen.getByText(label)).toHaveStyle({ color: colors.text, fontWeight: 'normal' });
    }
  });

  it.each(THEMES)('draws the group with the card background and the border color of the %s theme', async (scheme) => {
    const colors = Colors[scheme];
    await render(<ColorSchemeContext.Provider value={scheme}>{controlElement()}</ColorSchemeContext.Provider>);

    expect(screen.root).toHaveStyle({ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 });
  });
});
