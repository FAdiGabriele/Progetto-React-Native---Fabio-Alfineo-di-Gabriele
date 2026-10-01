import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { type RefreshControlProps, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  NewsList,
  type NewsListGroup,
  type NewsListItem,
  type NewsListProps,
} from '@/components/news/news-list';
import { Colors } from '@/constants/theme';
import { ColorSchemeContext } from '@/hooks/use-color-scheme';

jest.mock('react-native-safe-area-context', () =>
  jest.requireActual('react-native-safe-area-context/jest/mock').default
);

type HostElement = NonNullable<typeof screen.root>;
type HostNode = HostElement['children'][number];

const EMPTY_MESSAGE = 'No news to show';
const EMPTY_CELL = 'empty cell';
const INSETS = { top: 47, right: 20, bottom: 34, left: 10 };
const THEMES = ['light', 'dark'] as const;
const VIEWPORT = { width: 390, height: 400 };
const CONTENT = { width: 390, height: 1200 };

function item(id: string): NewsListItem {
  return {
    id,
    title: `Title ${id}`,
    sourceName: 'ANSA.it',
    accessibilityLabel: `Article ${id}`,
    onPress: jest.fn(),
  };
}

function group(key: string, title: string, ids: string[]): NewsListGroup {
  return { key, title, items: ids.map(item) };
}

// The list renders its first ten cells at once, a heading and a group end counting as cells:
// the two groups fit with any number of columns, the three groups with three columns.
function twoGroups(): NewsListGroup[] {
  return [group('italy', 'Italy', ['i1', 'i2', 'i3']), group('world', 'World', ['w1', 'w2'])];
}

function threeGroups(): NewsListGroup[] {
  return [
    group('italy', 'Italy', ['i1', 'i2', 'i3', 'i4']),
    group('world', 'World', ['w1', 'w2', 'w3']),
    group('sport', 'Sport', ['s1', 's2']),
  ];
}

function listElement(props: Partial<NewsListProps> = {}): ReactElement {
  return (
    <NewsList
      groups={twoGroups()}
      columns={1}
      horizontalMargin={24}
      refreshing={false}
      onRefresh={jest.fn()}
      loadingMore={false}
      emptyComponent={<Text>{EMPTY_MESSAGE}</Text>}
      {...props}
    />
  );
}

function WithInsets({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 1280, height: 800 }, insets: INSETS }}>
      {children}
    </SafeAreaProvider>
  );
}

function scrollView(): HostElement {
  const root = screen.root;
  expect(root?.type).toBe('RCTScrollView');
  return root as HostElement;
}

function card(label: string): HostElement {
  return screen.getByRole('link', { name: label });
}

function readingOrder(): string[] {
  return screen
    .getAllByRole(/^(header|link)$/)
    .map((element) =>
      element.props.accessibilityRole === 'header'
        ? `# ${element.children.join('')}`
        : element.props.accessibilityLabel
    );
}

function describeCard(node: HostNode | undefined): string {
  if (node === undefined) {
    return EMPTY_CELL;
  }
  return typeof node === 'string' ? node : node.props.accessibilityLabel;
}

// In one column each card is the only child of its row.
function singleColumnRows(): string[][] {
  const rows = new Set(screen.getAllByRole('link').map((element) => element.parent));
  return Array.from(rows, (row) => (row?.children ?? []).map(describeCard));
}

// In a grid each card fills a cell of its row.
function gridRowOf(label: string): HostElement | null | undefined {
  return card(label).parent?.parent;
}

function gridRows(): string[][] {
  const rows = new Set(screen.getAllByRole('link').map((element) => element.parent?.parent));
  return Array.from(rows, (row) =>
    (row?.children ?? []).map((cell) => describeCard(typeof cell === 'string' ? cell : cell.children[0]))
  );
}

function marginTopOf(row: HostElement | null | undefined): unknown {
  return StyleSheet.flatten(row?.props.style)?.marginTop;
}

function footers(): HostElement[] {
  return screen.container.queryAll((element) => StyleSheet.flatten(element.props.style)?.height === 44);
}

function activityIndicators(): HostElement[] {
  return screen.container.queryAll((element) => element.type === 'ActivityIndicator');
}

function contentStyle() {
  return StyleSheet.flatten(scrollView().props.contentContainerStyle);
}

function refreshControl(): HostElement {
  const [control] = screen.container.queryAll((element) => element.type === 'RCTRefreshControl');
  return control;
}

function refreshControlProps(): RefreshControlProps {
  return (scrollView().props.refreshControl as ReactElement<RefreshControlProps>).props;
}

async function scrollTo(offsetY: number) {
  await fireEvent(scrollView(), 'contentSizeChange', CONTENT.width, CONTENT.height);
  await fireEvent.scroll(scrollView(), {
    nativeEvent: {
      contentOffset: { x: 0, y: offsetY },
      contentSize: CONTENT,
      layoutMeasurement: VIEWPORT,
    },
  });
}

describe('NewsList', () => {
  describe('headings and cards', () => {
    it('renders each group heading as a header followed by the cards of its group, in order', async () => {
      await render(listElement());

      expect(readingOrder()).toEqual([
        '# Italy',
        'Article i1',
        'Article i2',
        'Article i3',
        '# World',
        'Article w1',
        'Article w2',
      ]);
      expect(screen.getByRole('header', { name: 'World' })).toHaveProp('aria-level', 2);
    });

    it('renders every card of every group, in order, in three columns', async () => {
      await render(listElement({ groups: threeGroups(), columns: 3 }));

      expect(readingOrder()).toEqual([
        '# Italy',
        'Article i1',
        'Article i2',
        'Article i3',
        'Article i4',
        '# World',
        'Article w1',
        'Article w2',
        'Article w3',
        '# Sport',
        'Article s1',
        'Article s2',
      ]);
      expect(screen.getAllByText(/^Title /).map((title) => title.children.join(''))).toEqual([
        'Title i1',
        'Title i2',
        'Title i3',
        'Title i4',
        'Title w1',
        'Title w2',
        'Title w3',
        'Title s1',
        'Title s2',
      ]);
    });

    it('gives each card the content and the press handler of its item', async () => {
      const groups = twoGroups();
      await render(listElement({ groups }));

      expect(card('Article w2')).toContainElement(screen.getByText('Title w2'));
      await fireEvent.press(card('Article w2'));

      const [italy, world] = groups;
      expect(world.items[1].onPress).toHaveBeenCalledTimes(1);
      for (const other of [...italy.items, world.items[0]]) {
        expect(other.onPress).not.toHaveBeenCalled();
      }
    });

    it('spaces every heading after the first from the group above it', async () => {
      await render(listElement({ groups: threeGroups(), columns: 3 }));

      const [first, ...others] = screen.getAllByRole('header');
      expect(StyleSheet.flatten(first.props.style)?.paddingTop).toBeUndefined();
      expect(others).toHaveLength(2);
      for (const heading of others) {
        expect(heading).toHaveStyle({ paddingTop: 24 });
      }
    });

    it('keeps groups that share a key apart, each under its own heading', async () => {
      const consoleError = jest.spyOn(console, 'error');
      try {
        await render(
          listElement({
            groups: [group('italy', 'Italy', ['i1']), group('italy', 'Italy, more', ['i2'])],
          })
        );

        expect(readingOrder()).toEqual(['# Italy', 'Article i1', '# Italy, more', 'Article i2']);
        expect(consoleError).not.toHaveBeenCalled();
      } finally {
        consoleError.mockRestore();
      }
    });
  });

  describe('rows', () => {
    it('puts one card in each row with one column', async () => {
      await render(listElement({ columns: 1 }));

      expect(singleColumnRows()).toEqual([
        ['Article i1'],
        ['Article i2'],
        ['Article i3'],
        ['Article w1'],
        ['Article w2'],
      ]);
    });

    it('fills rows of three cards and starts every group on a new row', async () => {
      await render(listElement({ groups: threeGroups(), columns: 3 }));

      expect(gridRows()).toEqual([
        ['Article i1', 'Article i2', 'Article i3'],
        ['Article i4', EMPTY_CELL, EMPTY_CELL],
        ['Article w1', 'Article w2', 'Article w3'],
        ['Article s1', 'Article s2', EMPTY_CELL],
      ]);
    });

    it('completes the last row of a group with empty cells as wide as the card cells', async () => {
      await render(listElement({ groups: threeGroups(), columns: 3 }));

      const row = gridRowOf('Article i4');
      const [cardCell, ...fillers] = row?.children ?? [];
      expect(row).toHaveStyle({ flexDirection: 'row' });
      expect(cardCell).toHaveStyle({ flex: 1 });
      expect(fillers).toHaveLength(2);
      for (const filler of fillers) {
        expect(filler).toHaveStyle({ flex: 1 });
        expect(filler).toBeEmptyElement();
      }
    });

    it('spaces the rows of a group by the mobile gap in one column, but not the first row of a group', async () => {
      await render(listElement({ columns: 1 }));

      const rowOf = (label: string) => card(label).parent;
      expect(marginTopOf(rowOf('Article i1'))).toBeUndefined();
      expect(marginTopOf(rowOf('Article i2'))).toBe(12);
      expect(marginTopOf(rowOf('Article i3'))).toBe(12);
      expect(marginTopOf(rowOf('Article w1'))).toBeUndefined();
      expect(marginTopOf(rowOf('Article w2'))).toBe(12);
    });

    it('spaces the rows of a group by the desktop gap in a grid, but not the first row of a group', async () => {
      await render(listElement({ groups: threeGroups(), columns: 3 }));

      expect(marginTopOf(gridRowOf('Article i1'))).toBeUndefined();
      expect(marginTopOf(gridRowOf('Article i4'))).toBe(16);
      expect(marginTopOf(gridRowOf('Article w1'))).toBeUndefined();
      expect(marginTopOf(gridRowOf('Article s1'))).toBeUndefined();
      expect(gridRowOf('Article i1')).toHaveStyle({ gap: 16 });
    });

    it('remounts the list when the number of columns changes', async () => {
      await render(listElement({ columns: 3 }));
      const gridList = scrollView();
      expect(gridRows()).toEqual([
        ['Article i1', 'Article i2', 'Article i3'],
        ['Article w1', 'Article w2', EMPTY_CELL],
      ]);

      await screen.rerender(listElement({ columns: 3, refreshing: true }));
      expect(scrollView() === gridList).toBe(true);

      await screen.rerender(listElement({ columns: 1 }));
      expect(scrollView() === gridList).toBe(false);
      expect(singleColumnRows()).toEqual([
        ['Article i1'],
        ['Article i2'],
        ['Article i3'],
        ['Article w1'],
        ['Article w2'],
      ]);
    });
  });

  describe('empty list', () => {
    it('renders the empty component when there are no groups', async () => {
      await render(listElement({ groups: [] }));

      expect(screen.getByText(EMPTY_MESSAGE)).toBeOnTheScreen();
      expect(screen.queryAllByRole('header')).toHaveLength(0);
      expect(screen.queryAllByRole('link')).toHaveLength(0);
    });

    it('does not render the empty component when there are groups', async () => {
      await render(listElement());

      expect(screen.queryByText(EMPTY_MESSAGE)).not.toBeOnTheScreen();
    });
  });

  describe('footer', () => {
    it('shows an activity indicator in a 44-point footer while more news is loading', async () => {
      await render(listElement({ loadingMore: true, onEndReached: jest.fn() }));

      const indicators = activityIndicators();
      expect(footers()).toHaveLength(1);
      expect(indicators).toHaveLength(1);
      expect(indicators[0]).toHaveProp('size', 'small');
      expect(footers()[0]).toContainElement(indicators[0]);
    });

    it('shows the footer indicator while loading even without onEndReached', async () => {
      await render(listElement({ loadingMore: true }));

      expect(footers()).toHaveLength(1);
      expect(footers()[0]).toContainElement(activityIndicators()[0]);
    });

    it('keeps an empty 44-point footer while more news can be loaded', async () => {
      await render(listElement({ onEndReached: jest.fn() }));

      expect(footers()).toHaveLength(1);
      expect(footers()[0]).toBeEmptyElement();
      expect(activityIndicators()).toHaveLength(0);
    });

    it('renders no footer when nothing is loading and nothing more can be loaded', async () => {
      await render(listElement());

      expect(footers()).toHaveLength(0);
      expect(activityIndicators()).toHaveLength(0);
    });
  });

  describe('end of the list', () => {
    it('calls onEndReached when the scroll gets within half a screen of the end', async () => {
      const onEndReached = jest.fn();
      await render(listElement({ onEndReached }));

      await scrollTo(610);

      expect(onEndReached).toHaveBeenCalledTimes(1);
      expect(onEndReached).toHaveBeenCalledWith({ distanceFromEnd: 190 });
    });

    it('does not call onEndReached while the end is more than half a screen away', async () => {
      const onEndReached = jest.fn();
      await render(listElement({ onEndReached }));

      await scrollTo(590);

      expect(onEndReached).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('calls onRefresh when the list is pulled to refresh', async () => {
      const onRefresh = jest.fn();
      await render(listElement({ onRefresh }));

      await fireEvent(refreshControl(), 'refresh');

      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('passes the refreshing state to the refresh control', async () => {
      await render(listElement({ refreshing: true }));
      expect(refreshControlProps().refreshing).toBe(true);

      await screen.rerender(listElement({ refreshing: false }));
      expect(refreshControlProps().refreshing).toBe(false);
    });

    it.each(THEMES)('colors the refresh control and the footer indicator with the %s theme', async (scheme) => {
      const colors = Colors[scheme];
      await render(
        <ColorSchemeContext.Provider value={scheme}>
          {listElement({ loadingMore: true })}
        </ColorSchemeContext.Provider>
      );

      expect(refreshControlProps()).toMatchObject({
        tintColor: colors.tint,
        colors: [colors.tint],
        progressBackgroundColor: colors.card,
      });
      expect(activityIndicators()[0]).toHaveProp('color', colors.tint);
    });
  });

  describe('content padding', () => {
    it('pads the content by the horizontal margin, with the mobile gap at the bottom in one column', async () => {
      await render(listElement({ horizontalMargin: 24 }));

      expect(contentStyle()).toMatchObject({
        paddingTop: 4,
        paddingLeft: 24,
        paddingRight: 24,
        paddingBottom: 12,
      });
    });

    it('adds the safe area insets, with the desktop gap at the bottom in a grid', async () => {
      await render(listElement({ columns: 3, horizontalMargin: 32 }), { wrapper: WithInsets });

      expect(contentStyle()).toMatchObject({
        paddingLeft: 32 + INSETS.left,
        paddingRight: 32 + INSETS.right,
        paddingBottom: 16 + INSETS.bottom,
      });
    });
  });
});
