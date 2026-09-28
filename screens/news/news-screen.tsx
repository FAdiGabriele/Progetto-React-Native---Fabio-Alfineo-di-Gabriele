import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Alert, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryChips, type CategoryChipOption } from '@/components/news/category-chips';
import { NewsList, type NewsListItem } from '@/components/news/news-list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { MessageBanner } from '@/components/ui/message-banner';
import { TextButton } from '@/components/ui/text-button';
import { NEWS_SECTIONS, type NewsSectionKey } from '@/constants/news-sections';
import { useI18n, type I18n } from '@/i18n/i18n-provider';
import type { TranslationKey } from '@/i18n/it';
import type { Article, NewsError } from '@/repositories/news-model';
import { useNewsViewModel } from '@/screens/news/use-news-view-model';
import { formatDateTime, formatTime, isToday } from '@/utils/date';
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

// Only the time when the list was received today, the date and time otherwise.
function toUpdatedAtLabel(
  updatedAt: Date | undefined,
  t: I18n['t'],
  locale: I18n['locale']
): string | undefined {
  if (updatedAt === undefined) {
    return undefined;
  }
  if (isToday(updatedAt)) {
    const time = formatTime(updatedAt, locale);
    return time === undefined ? undefined : t('news.updatedAtTime', { time });
  }
  const dateTime = formatDateTime(updatedAt, locale);
  return dateTime === undefined ? undefined : t('news.updatedAtDate', { dateTime });
}

export function NewsScreen() {
  const {
    articles,
    status,
    error,
    selectedSection,
    updatedAt,
    hasMore,
    selectSection,
    refresh,
    loadMore,
    openArticle,
  } = useNewsViewModel();
  const { t, locale, toggleLanguage } = useI18n();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { columns, horizontalMargin } = getNewsLayout(width);
  // On web there is no pull-to-refresh gesture and Alert.alert does nothing: a button and a banner take their place.
  const isWeb = Platform.OS === 'web';

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

  // Non-blocking notices: a banner on web, an alert elsewhere.
  const [noticeKey, setNoticeKey] = useState<TranslationKey | null>(null);
  const showNotice = useCallback(
    (key: TranslationKey) => {
      if (isWeb) {
        setNoticeKey(key);
      } else {
        Alert.alert(t(key), undefined, [{ text: t('states.close') }]);
      }
    },
    [isWeb, t]
  );
  const hideNotice = useCallback(() => setNoticeKey(null), []);
  useEffect(() => {
    if (status === 'success') {
      setNoticeKey(null);
    }
  }, [status]);
  useEffect(() => {
    setNoticeKey(null);
  }, [selectedSection]);

  const handleArticlePress = useCallback(
    (article: Article) => {
      openArticle(article).then((opened) => {
        if (!opened) {
          showNotice('errors.openArticle');
        }
      });
    },
    [openArticle, showNotice]
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
  const updatedAtLabel = toUpdatedAtLabel(updatedAt, t, locale);

  // With articles on screen a failed load is reported once, when its error appears.
  const reportedErrorRef = useRef<NewsError | null>(null);
  useEffect(() => {
    if (error === null || error === reportedErrorRef.current) {
      return;
    }
    reportedErrorRef.current = error;
    if (hasArticles) {
      showNotice(`errors.${error.kind}`);
    }
  }, [error, hasArticles, showNotice]);

  const isLoading = status === 'idle' || status === 'loading';
  const showsList = !isLoading && !(status === 'error' && !hasArticles);
  const showsRefreshButton = isWeb && showsList;

  let content: ReactElement;
  if (isLoading) {
    content = <LoadingState message={t('states.loading')} />;
  } else if (!showsList) {
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
        loadingMore={status === 'loadingMore'}
        onEndReached={hasMore ? loadMore : undefined}
        emptyComponent={
          <EmptyState message={t('states.empty')} retryLabel={t('states.retry')} onRetry={refresh} />
        }
      />
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={screenOptions} />
      {(updatedAtLabel !== undefined || showsRefreshButton) && (
        <View
          style={[
            styles.statusRow,
            {
              paddingLeft: horizontalMargin + insets.left,
              paddingRight: horizontalMargin + insets.right,
            },
          ]}
        >
          <View style={styles.updatedAt}>
            {updatedAtLabel !== undefined && (
              <ThemedText type="secondary">{updatedAtLabel}</ThemedText>
            )}
          </View>
          {showsRefreshButton && (
            <TextButton
              title={t('news.refresh')}
              accessibilityLabel={t('news.refresh')}
              onPress={refresh}
              loading={status === 'refreshing'}
            />
          )}
        </View>
      )}
      <CategoryChips
        options={sectionOptions}
        selectedKey={selectedSection}
        onSelect={selectSection}
        horizontalMargin={horizontalMargin}
      />
      {isWeb && noticeKey !== null && (
        <MessageBanner
          message={t(noticeKey)}
          closeLabel={t('states.close')}
          onClose={hideNotice}
          horizontalMargin={horizontalMargin}
        />
      )}
      {content}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
  },
  updatedAt: {
    flex: 1,
  },
});
