import { useMemo, type ReactElement } from 'react';
import { FlatList, type ListRenderItemInfo, RefreshControl, StyleSheet, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NewsCard, type NewsCardProps } from '@/components/news/news-card';
import { Layout } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';

export type NewsListItem = NewsCardProps & { id: string };

export type NewsListProps = {
  items: NewsListItem[];
  columns: number;
  horizontalMargin: number;
  refreshing: boolean;
  onRefresh: () => void;
  emptyComponent: ReactElement;
};

// A cell without an item fills an incomplete last grid row, so every card keeps the column width.
type NewsListCell = { id: string; item?: NewsListItem };

function toCells(items: NewsListItem[], columns: number): NewsListCell[] {
  const cells: NewsListCell[] = items.map((item) => ({ id: item.id, item }));
  const fillerCount = (columns - (items.length % columns)) % columns;
  for (let index = 0; index < fillerCount; index += 1) {
    cells.push({ id: `filler-${index}` });
  }
  return cells;
}

function keyExtractor(cell: NewsListCell) {
  return cell.id;
}

function renderCard(item: NewsListItem) {
  const { id, ...card } = item;
  return <NewsCard {...card} />;
}

function renderRow({ item: cell }: ListRenderItemInfo<NewsListCell>) {
  return cell.item === undefined ? null : renderCard(cell.item);
}

function renderGridCell({ item: cell }: ListRenderItemInfo<NewsListCell>) {
  return <View style={styles.gridCell}>{cell.item === undefined ? null : renderCard(cell.item)}</View>;
}

function RowSeparator() {
  return <View style={styles.rowSeparator} />;
}

function GridRowSeparator() {
  return <View style={styles.gridRowSeparator} />;
}

export function NewsList({
  items,
  columns,
  horizontalMargin,
  refreshing,
  onRefresh,
  emptyComponent,
}: NewsListProps) {
  const insets = useSafeAreaInsets();
  const tint = useThemeColor({}, 'tint');
  const isGrid = columns > 1;
  const cells = useMemo(() => toCells(items, columns), [items, columns]);

  return (
    <FlatList<NewsListCell>
      key={`columns-${columns}`}
      data={cells}
      numColumns={columns}
      columnWrapperStyle={isGrid ? styles.gridRow : undefined}
      keyExtractor={keyExtractor}
      renderItem={isGrid ? renderGridCell : renderRow}
      ItemSeparatorComponent={isGrid ? GridRowSeparator : RowSeparator}
      ListEmptyComponent={emptyComponent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tint} colors={[tint]} />
      }
      style={styles.list}
      contentContainerStyle={[
        styles.content,
        {
          paddingLeft: horizontalMargin + insets.left,
          paddingRight: horizontalMargin + insets.right,
          paddingBottom: (isGrid ? Layout.cardGap.desktop : Layout.cardGap.mobile) + insets.bottom,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingTop: 4,
  },
  gridRow: {
    gap: Layout.cardGap.desktop,
  },
  gridCell: {
    flex: 1,
  },
  rowSeparator: {
    height: Layout.cardGap.mobile,
  },
  gridRowSeparator: {
    height: Layout.cardGap.desktop,
  },
});
