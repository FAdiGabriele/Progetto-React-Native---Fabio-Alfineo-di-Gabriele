import { useCallback, useMemo, type ReactElement } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  SectionList,
  type SectionListData,
  type SectionListRenderItemInfo,
  StyleSheet,
  View,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NewsCard, type NewsCardProps } from '@/presentation/components/news/news-card';
import { ThemedText } from '@/presentation/components/themed-text';
import { TextButton } from '@/presentation/components/ui/text-button';
import { Layout } from '@/presentation/theme/theme';
import { useThemeColor } from '@/presentation/hooks/use-theme-color';

export type NewsListItem = NewsCardProps & { id: string };

/** Cards shown under one heading. */
export type NewsListGroup = { key: string; title: string; items: NewsListItem[] };

export type NewsListProps = {
  groups: NewsListGroup[];
  columns: number;
  horizontalMargin: number;
  refreshing: boolean;
  onRefresh: () => void;
  /** Shows an activity indicator below the last card while a later page is loading. */
  loadingMore: boolean;
  /** Called when the scroll reaches the end of the list; absent when there is nothing more to load. */
  onEndReached?: () => void;
  /** Label of the button shown below the last card, in place of the indicator, when a later page failed. */
  retryLabel: string;
  /** Loads again the later page that failed; absent when none did, and the button with it. */
  onRetry?: () => void;
  emptyComponent: ReactElement;
};

// A row of the list: up to `columns` cards of one group, fewer in the last row of the group.
type NewsListRow = { key: string; items: NewsListItem[] };

// A section of the list is a group: its heading, then its rows.
type NewsListSection = { key: string; title: string; first: boolean };

type NewsListSectionData = SectionListData<NewsListRow, NewsListSection>;

// The section key is the group key, so that it survives a page that adds a group before it;
// a repeated group key gets a counter.
function toSections(groups: NewsListGroup[], columns: number): NewsListSectionData[] {
  const occurrences = new Map<string, number>();
  return groups.map((group, index) => {
    const occurrence = (occurrences.get(group.key) ?? 0) + 1;
    occurrences.set(group.key, occurrence);
    const data: NewsListRow[] = [];
    for (let start = 0; start < group.items.length; start += columns) {
      const items = group.items.slice(start, start + columns);
      data.push({ key: items[0].id, items });
    }
    return {
      key: occurrence === 1 ? group.key : `${group.key}-${occurrence}`,
      title: group.title,
      first: index === 0,
      data,
    };
  });
}

function keyExtractor(row: NewsListRow) {
  return row.key;
}

function renderCard(item: NewsListItem) {
  const { id, ...card } = item;
  return <NewsCard {...card} />;
}

// Empty cells fill an incomplete row, so every card keeps the column width.
function GridCells({ row, columns }: { row: NewsListRow; columns: number }) {
  const fillers = Array.from({ length: columns - row.items.length }, (_, index) => `filler-${index}`);
  return (
    <>
      {row.items.map((item) => (
        <View key={item.id} style={styles.gridCell}>
          {renderCard(item)}
        </View>
      ))}
      {fillers.map((key) => (
        <View key={key} style={styles.gridCell} />
      ))}
    </>
  );
}

function renderSectionHeader({ section }: { section: NewsListSectionData }) {
  return (
    <ThemedText
      accessibilityRole="header"
      aria-level={2}
      style={[styles.heading, !section.first && styles.headingSpaced]}
    >
      {section.title}
    </ThemedText>
  );
}

type ListFooterProps = { loading: boolean; color: string; retryLabel: string; onRetry?: () => void };

// The footer keeps a fixed height while more pages exist, so that a page starting or failing
// does not change the content length: the list would otherwise call onEndReached again by itself.
function ListFooter({ loading, color, retryLabel, onRetry }: ListFooterProps) {
  return (
    <View style={styles.footer}>
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        onRetry !== undefined && (
          <TextButton title={retryLabel} accessibilityLabel={retryLabel} onPress={onRetry} />
        )
      )}
    </View>
  );
}

export function NewsList({
  groups,
  columns,
  horizontalMargin,
  refreshing,
  onRefresh,
  loadingMore,
  onEndReached,
  retryLabel,
  onRetry,
  emptyComponent,
}: NewsListProps) {
  const insets = useSafeAreaInsets();
  const tint = useThemeColor({}, 'tint');
  const card = useThemeColor({}, 'card');
  const isGrid = columns > 1;
  const sections = useMemo(() => toSections(groups, columns), [groups, columns]);
  // The space between the rows of a group belongs to the rows, not to a separator component:
  // on web a separator wraps the row in a view only once it exists, remounting the last row
  // of a group when a later page extends it.
  const renderRow = useCallback(
    ({ item: row, index }: SectionListRenderItemInfo<NewsListRow, NewsListSection>) => (
      <View
        style={[
          isGrid && styles.gridRow,
          index > 0 && (isGrid ? styles.gridRowSpaced : styles.rowSpaced),
        ]}
      >
        {isGrid ? <GridCells row={row} columns={columns} /> : renderCard(row.items[0])}
      </View>
    ),
    [columns, isGrid]
  );

  return (
    <SectionList<NewsListRow, NewsListSection>
      key={`columns-${columns}`}
      sections={sections}
      keyExtractor={keyExtractor}
      renderItem={renderRow}
      renderSectionHeader={renderSectionHeader}
      stickySectionHeadersEnabled={false}
      // The same default as the FlatList, which clips the rows outside the screen on Android.
      removeClippedSubviews={Platform.OS === 'android'}
      ListEmptyComponent={emptyComponent}
      ListFooterComponent={
        loadingMore || onEndReached !== undefined || onRetry !== undefined ? (
          <ListFooter loading={loadingMore} color={tint} retryLabel={retryLabel} onRetry={onRetry} />
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
  heading: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    paddingBottom: 8,
  },
  headingSpaced: {
    paddingTop: 24,
  },
  rowSpaced: {
    marginTop: Layout.cardGap.mobile,
  },
  gridRow: {
    flexDirection: 'row',
    gap: Layout.cardGap.desktop,
  },
  gridRowSpaced: {
    marginTop: Layout.cardGap.desktop,
  },
  gridCell: {
    flex: 1,
  },
  footer: {
    height: 44, // 12 points above and below the 20-point indicator, and the height of the button
    alignItems: 'center',
    justifyContent: 'center',
  },
});
