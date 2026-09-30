import { router, Stack } from 'expo-router';
import Head from 'expo-router/head';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Alert, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryChips, type CategoryChipOption } from '@/components/news/category-chips';
import { NewsList, type NewsListGroup, type NewsListItem } from '@/components/news/news-list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { IconButton } from '@/components/ui/icon-button';
import { LoadingState } from '@/components/ui/loading-state';
import { MessageBanner } from '@/components/ui/message-banner';
import { TextButton } from '@/components/ui/text-button';
import { NEWS_SECTIONS, type NewsSectionKey } from '@/constants/news-sections';
import { useI18n, type I18n } from '@/i18n/i18n-provider';
import type { TranslationKey } from '@/i18n/it';
import type { Article, NewsError, NewsErrorKind } from '@/repositories/news-model';
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

// A non-blocking notice: the key of its text and, for a partial first page, the kind of the
// error reported inside it, both translated when the notice is shown.
type Notice = { key: TranslationKey; errorKind?: NewsErrorKind };

function toErrorNotice(error: NewsError, partial: boolean): Notice {
  return partial
    ? { key: 'errors.partial', errorKind: error.kind }
    : { key: `errors.${error.kind}` };
}

function toNoticeMessage(notice: Notice, t: I18n['t']): string {
  return notice.errorKind === undefined
    ? t(notice.key)
    : t(notice.key, { message: t(`errors.${notice.errorKind}`) });
}

export function NewsScreen() {
  const {
    groups,
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
  const { t, locale } = useI18n();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { columns, horizontalMargin } = getNewsLayout(width);
  // On web there is no pull-to-refresh gesture and Alert.alert does nothing: a button and a banner take their place.
  const isWeb = Platform.OS === 'web';

  const screenOptions = useMemo(
    () => ({
      title: t('app.name'),
      headerRight: () => (
        <IconButton
          icon="settings-outline"
          accessibilityLabel={t('settings.title')}
          onPress={() => router.push('/settings')}
        />
      ),
    }),
    [t]
  );

  const sectionOptions = useMemo<CategoryChipOption<NewsSectionKey>[]>(
    () => NEWS_SECTIONS.map((section) => ({ key: section.key, label: t(section.labelKey) })),
    [t]
  );

  // Non-blocking notices: a banner on web, an alert elsewhere.
  const [notice, setNotice] = useState<Notice | null>(null);
  const alertNotice = useCallback(
    (shown: Notice) =>
      Alert.alert(toNoticeMessage(shown, t), undefined, [{ text: t('states.close') }]),
    [t]
  );
  const showNotice = useCallback(
    (shown: Notice) => {
      if (isWeb) {
        setNotice(shown);
      } else {
        alertNotice(shown);
      }
    },
    [alertNotice, isWeb]
  );
  const hideNotice = useCallback(() => setNotice(null), []);

  const handleArticlePress = useCallback(
    (article: Article) => {
      openArticle(article).then((opened) => {
        if (!opened) {
          showNotice({ key: 'errors.openArticle' });
        }
      });
    },
    [openArticle, showNotice]
  );

  const listGroups = useMemo<NewsListGroup[]>(
    () =>
      groups.map((group) => ({
        key: group.key,
        title: t(`groups.${group.key}`),
        items: group.articles.map((article) =>
          toListItem(article, t, locale, () => handleArticlePress(article))
        ),
      })),
    [groups, handleArticlePress, locale, t]
  );

  const hasArticles = groups.length > 0;
  const errorMessage = error === null ? null : t(`errors.${error.kind}`);
  const updatedAtLabel = toUpdatedAtLabel(updatedAt, t, locale);
  const isLoading = status === 'idle' || status === 'loading';
  const showsList = !isLoading && !(status === 'error' && !hasArticles);

  // An error is reported with a notice when the list stays on screen: after a failed load with
  // articles, or with the partial first page it comes with; without articles the error state
  // shows it. A failed load is reported once, when its error appears; a successful load, another
  // section or leaving the list hides the banner. The banner is updated while rendering, the
  // alert after the commit.
  const isPartial = status === 'success' && error !== null;
  const noticeError = showsList ? error : null;
  const [lastLoad, setLastLoad] = useState({ status, selectedSection, error });
  const isNewError = error !== null && error !== lastLoad.error;
  if (status !== lastLoad.status || selectedSection !== lastLoad.selectedSection || isNewError) {
    setLastLoad({ status, selectedSection, error: error ?? lastLoad.error });
    if (isWeb && noticeError !== null && isNewError) {
      setNotice(toErrorNotice(noticeError, isPartial));
    } else if (
      selectedSection !== lastLoad.selectedSection ||
      (status !== lastLoad.status && (status === 'success' || !showsList))
    ) {
      setNotice(null);
    }
  }
  const alertedErrorRef = useRef<NewsError | null>(null);
  useEffect(() => {
    if (isWeb || error === null || error === alertedErrorRef.current) {
      return;
    }
    alertedErrorRef.current = error;
    if (noticeError !== null) {
      alertNotice(toErrorNotice(noticeError, isPartial));
    }
  }, [alertNotice, error, isPartial, isWeb, noticeError]);

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
        groups={listGroups}
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
      <Head>
        <title>{t('app.name')}</title>
      </Head>
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
      {isWeb && notice !== null && (
        <MessageBanner
          message={toNoticeMessage(notice, t)}
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
