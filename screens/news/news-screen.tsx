import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, type ReactElement } from 'react';
import { Alert, StyleSheet, useWindowDimensions } from 'react-native';

import { CategoryChips, type CategoryChipOption } from '@/components/news/category-chips';
import { NewsList, type NewsListItem } from '@/components/news/news-list';
import { ThemedView } from '@/components/themed-view';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { TextButton } from '@/components/ui/text-button';
import { NEWS_SECTIONS, type NewsSectionKey } from '@/constants/news-sections';
import { useI18n, type I18n } from '@/i18n/i18n-provider';
import type { Article, NewsError } from '@/repositories/news-model';
import { useNewsViewModel } from '@/screens/news/use-news-view-model';
import { formatDateTime } from '@/utils/date';
import { getNewsLayout } from '@/utils/layout';

function toListItem(
  article: Article,
  t: I18n['t'],
  locale: I18n['locale'],
  onPress: () => void
): NewsListItem {
  return {
    id: article.id,
    title: article.title,
    sourceName: article.sourceName,
    description: article.description,
    dateLabel: formatDateTime(article.publishedAt, locale),
    author: article.author,
    imageUrl: article.imageUrl,
    accessibilityLabel: t('card.a11y', { title: article.title, source: article.sourceName }),
    onPress,
  };
}

export function NewsScreen() {
  const { articles, status, error, selectedSection, selectSection, refresh, openArticle } =
    useNewsViewModel();
  const { t, locale, toggleLanguage } = useI18n();
  const { width } = useWindowDimensions();
  const { columns, horizontalMargin } = getNewsLayout(width);

  const screenOptions = useMemo(
    () => ({
      title: t('news.title'),
      headerRight: () => (
        <TextButton
          title={t('language.switch')}
          accessibilityLabel={t('language.switchA11y')}
          onPress={toggleLanguage}
        />
      ),
    }),
    [t, toggleLanguage]
  );

  const sectionOptions = useMemo<CategoryChipOption<NewsSectionKey>[]>(
    () => NEWS_SECTIONS.map((section) => ({ key: section.key, label: t(section.labelKey) })),
    [t]
  );

  const handleArticlePress = useCallback(
    (article: Article) => {
      openArticle(article).then((opened) => {
        if (!opened) {
          Alert.alert(t('errors.openArticle'), undefined, [{ text: t('states.close') }]);
        }
      });
    },
    [openArticle, t]
  );

  const items = useMemo(
    () =>
      articles.map((article) =>
        toListItem(article, t, locale, () => handleArticlePress(article))
      ),
    [articles, handleArticlePress, locale, t]
  );

  const hasArticles = articles.length > 0;
  const errorMessage = error === null ? null : t(`errors.${error.kind}`);

  // With articles on screen a failed load is reported once, when its error appears.
  const reportedErrorRef = useRef<NewsError | null>(null);
  useEffect(() => {
    if (error === null || error === reportedErrorRef.current) {
      return;
    }
    reportedErrorRef.current = error;
    if (hasArticles && errorMessage !== null) {
      Alert.alert(errorMessage, undefined, [{ text: t('states.close') }]);
    }
  }, [error, errorMessage, hasArticles, t]);

  let content: ReactElement;
  if (status === 'idle' || status === 'loading') {
    content = <LoadingState message={t('states.loading')} />;
  } else if (status === 'error' && !hasArticles) {
    content = (
      <ErrorState
        message={errorMessage ?? t('errors.unknown')}
        retryLabel={t('states.retry')}
        onRetry={refresh}
      />
    );
  } else {
    content = (
      <NewsList
        items={items}
        columns={columns}
        horizontalMargin={horizontalMargin}
        refreshing={status === 'refreshing'}
        onRefresh={refresh}
        emptyComponent={
          <EmptyState message={t('states.empty')} retryLabel={t('states.retry')} onRetry={refresh} />
        }
      />
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={screenOptions} />
      <CategoryChips
        options={sectionOptions}
        selectedKey={selectedSection}
        onSelect={selectSection}
        horizontalMargin={horizontalMargin}
      />
      {content}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
