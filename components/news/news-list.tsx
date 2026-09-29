import { useMemo, type ReactElement } from 'react';
import {
  ActivityIndicator,
  FlatList,
  type ListRenderItemInfo,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';

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
  /** Shows an activity indicator below the last card while a later page is loading. */
  loadingMore: boolean;
  /** Called when the scroll reaches the end of the list; absent when there is nothing more to load. */
  onEndReached?: () => void;
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

// The footer keeps a fixed height while more pages exist, so that a page starting or failing
// does not change the content length: the FlatList would otherwise call onEndReached again by itself.
function ListFooter({ loading, color }: { loading: boolean; color: string }) {
  return (
    <View style={styles.footer}>
      {loading && <ActivityIndicator size="small" color={color} />}
    </View>
  );
}

export function NewsList({
  items,
  columns,
  horizontalMargin,
  refreshing,
  onRefresh,
  loadingMore,
  onEndReached,
  emptyComponent,
}: NewsListProps) {
  const insets = useSafeAreaInsets();
  const tint = useThemeColor({}, 'tint');
  const card = useThemeColor({}, 'card');
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
      ListFooterComponent={
        loadingMore || onEndReached !== undefined ? (
          <ListFooter loading={loadingMore} color={tint} />
        ) : null
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={tint}
          colors={[tint]}
          // By default Android draws the indicator on a near-white circle, where a white tint disappears.
          progressBackgroundColor={card}
        />
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
  footer: {
    height: 44, // 12 points above and below the 20-point indicator
    alignItems: 'center',
    justifyContent: 'center',
  },
});
