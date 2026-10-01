import { router, Stack } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useMemo, type ReactElement } from 'react';
import { Alert, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryChips } from '@/components/news/category-chips';
import { NewsList } from '@/components/news/news-list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { IconButton } from '@/components/ui/icon-button';
import { LoadingState } from '@/components/ui/loading-state';
import { MessageBanner } from '@/components/ui/message-banner';
import { TextButton } from '@/components/ui/text-button';
import { useI18n } from '@/i18n/i18n-provider';
import { useNewsViewModel } from '@/screens/news/use-news-view-model';
import { getNewsLayout } from '@/utils/layout';

export function NewsScreen() {
  const {
    status,
    selectedSection,
    sectionOptions,
    groups,
    errorMessage,
    updatedAtLabel,
    notice,
    hasMore,
    selectSection,
    refresh,
    loadMore,
    dismissNotice,
  } = useNewsViewModel();
  const { t } = useI18n();
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

  // On Android and iOS the notice is a system alert: shown once, then consumed.
  useEffect(() => {
    if (isWeb || notice === null) {
      return;
    }
    Alert.alert(notice, undefined, [{ text: t('states.close') }]);
    dismissNotice();
  }, [dismissNotice, isWeb, notice, t]);

  const isLoading = status === 'idle' || status === 'loading';
  const showsList = !isLoading && !(status === 'error' && groups.length === 0);
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
        groups={groups}
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
          message={notice}
          closeLabel={t('states.close')}
          onClose={dismissNotice}
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
