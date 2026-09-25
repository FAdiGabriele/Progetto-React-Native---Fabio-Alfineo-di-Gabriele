import type { ReactElement } from 'react';
import { FlatList, type ListRenderItemInfo, RefreshControl, StyleSheet, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NewsCard, type NewsCardProps } from '@/components/news/news-card';
import { useThemeColor } from '@/hooks/use-theme-color';

export type NewsListItem = NewsCardProps & { id: string };

export type NewsListProps = {
  items: NewsListItem[];
  refreshing: boolean;
  onRefresh: () => void;
  emptyComponent: ReactElement;
};

function renderItem({ item }: ListRenderItemInfo<NewsListItem>) {
  const { id, ...card } = item;
  return <NewsCard {...card} />;
}

function ItemSeparator() {
  return <View style={styles.separator} />;
}

export function NewsList({ items, refreshing, onRefresh, emptyComponent }: NewsListProps) {
  const insets = useSafeAreaInsets();
  const tint = useThemeColor({}, 'tint');

  return (
    <FlatList<NewsListItem>
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ItemSeparatorComponent={ItemSeparator}
      ListEmptyComponent={emptyComponent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tint} colors={[tint]} />
      }
      style={styles.list}
      contentContainerStyle={[
        styles.content,
        {
          paddingLeft: 16 + insets.left,
          paddingRight: 16 + insets.right,
          paddingBottom: 12 + insets.bottom,
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
  separator: {
    height: 12,
  },
});
