import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';

import { newsUseCases } from '@/di/container';
import {
  NEWS_SECTION_KEYS,
  type Article,
  type NewsError,
  type NewsGroup,
  type NewsGroupKey,
  type NewsPageCursor,
  type NewsSectionKey,
  type SavedNews,
} from '@/domain/models/news-model';
import type { LoadMoreNews } from '@/domain/use-cases/load-more-news';
import type { LoadSectionNews } from '@/domain/use-cases/load-section-news';
import type { OpenArticle } from '@/domain/use-cases/open-article';
import { useI18n, type I18n } from '@/presentation/i18n/i18n-provider';
import { formatDateTime, formatTime, isToday } from '@/presentation/utils/date';

export type NewsStatus = 'idle' | 'loading' | 'refreshing' | 'loadingMore' | 'success' | 'error';

export type NewsUseCases = {
  loadSectionNews: LoadSectionNews;
  loadMoreNews: LoadMoreNews;
  openArticle: OpenArticle;
};

export type NewsSectionOption = { key: NewsSectionKey; label: string };

export type NewsCardItem = {
  id: string;
  title: string;
  sourceName: string;
  description?: string;
  dateLabel?: string;
  author?: string;
  imageUrl?: string;
  accessibilityLabel: string;
  onPress: () => void;
};

export type NewsCardGroup = { key: NewsGroupKey; title: string; items: NewsCardItem[] };

/**
 * A non-blocking notice over the list; `partial` marks the error of the failed request of a
 * first page whose other requests succeeded.
 */
export type NewsNotice =
  | { kind: 'loadFailed'; error: NewsError; partial: boolean }
  | { kind: 'openArticleFailed' };

export type NewsViewModel = {
  status: NewsStatus;
  selectedSection: NewsSectionKey;
  sectionOptions: readonly NewsSectionOption[];
  /**
   * One group per request of the first page that returned articles, in section order, then the
   * group of the more news.
   */
  groups: NewsCardGroup[];
  /**
   * Translated message of the error of the last failed load, or of the failed request of a
   * partial first page; null during a load and after one that succeeded completely. The screen
   * shows it only in the error state without articles; otherwise `notice` reports the same error.
   */
  errorMessage: string | null;
  /**
   * Translated label of when the list on screen was received: the last successful first page
   * of the section, or the save instant of a saved list. Absent while loading without data and
   * in error without data.
   */
  updatedAtLabel?: string;
  /**
   * Translated message of the non-blocking notice over the list, or null: a refresh or a page
   * that failed with the list on screen, a failed load shown with the saved list, a partial
   * first page or an article that could not be opened. A successful load, another section, the
   * loading state or `dismissNotice` hide it.
   */
  notice: string | null;
  hasMore: boolean;
  /** The last page of more news failed and no load is in progress; `loadMore` retries it. */
  loadMoreFailed: boolean;
  selectSection: (section: NewsSectionKey) => void;
  refresh: () => void;
  /**
   * Appends the next page of more news, or retries the one that failed; ignored without more
   * pages or while another load is in progress.
   */
  loadMore: () => void;
  dismissNotice: () => void;
};

export type NewsState = {
  groups: NewsGroup[];
  status: NewsStatus;
  error: NewsError | null;
  selectedSection: NewsSectionKey;
  updatedAt?: Date;
  cursor?: NewsPageCursor;
  notice: NewsNotice | null;
  /** The last page of more news failed and the list on screen is still waiting for it. */
  loadMoreFailed: boolean;
};

export type NewsAction =
  | { type: 'sectionSelected'; section: NewsSectionKey }
  | { type: 'loadStarted' }
  | {
      type: 'loadSucceeded';
      groups: NewsGroup[];
      cursor?: NewsPageCursor;
      partialError?: NewsError;
      receivedAt: Date;
    }
  | { type: 'loadFailed'; error: NewsError; saved: SavedNews | null }
  | { type: 'loadMoreStarted' }
  /** `groups` is the whole list, with the more news already appended. */
  | { type: 'loadMoreSucceeded'; groups: NewsGroup[]; cursor?: NewsPageCursor }
  /** `cursor` is the one of the page that failed, kept to ask for it again. */
  | { type: 'loadMoreFailed'; error: NewsError; cursor: NewsPageCursor }
  | { type: 'noticeDismissed' }
  | { type: 'openArticleFailed' };

const INITIAL_SECTION: NewsSectionKey = NEWS_SECTION_KEYS[0];

export const INITIAL_NEWS_STATE: NewsState = {
  groups: [],
  status: 'idle',
  error: null,
  selectedSection: INITIAL_SECTION,
  notice: null,
  loadMoreFailed: false,
};

function loadFailedNotice(error: NewsError): NewsNotice {
  return { kind: 'loadFailed', error, partial: false };
}

export function reduceNewsState(state: NewsState, action: NewsAction): NewsState {
  switch (action.type) {
    case 'sectionSelected':
      return {
        groups: [],
        status: 'loading',
        error: null,
        selectedSection: action.section,
        notice: null,
        loadMoreFailed: false,
      };
    case 'loadStarted':
      // With articles on screen the load is a refresh and keeps them, with their cursor, their
      // notice and their failed page, so that a failed refresh leaves the list able to load
      // its next page; otherwise the loading state takes the place of the list and of any
      // notice over it.
      if (state.groups.length > 0) {
        return { ...state, status: 'refreshing', error: null };
      }
      return {
        ...state,
        status: 'loading',
        error: null,
        updatedAt: undefined,
        notice: null,
        loadMoreFailed: false,
      };
    case 'loadSucceeded':
      return {
        ...state,
        groups: action.groups,
        status: 'success',
        error: action.partialError ?? null,
        updatedAt: action.receivedAt,
        cursor: action.cursor,
        notice:
          action.partialError === undefined
            ? null
            : { kind: 'loadFailed', error: action.partialError, partial: true },
        loadMoreFailed: false,
      };
    case 'loadFailed':
      if (action.saved !== null) {
        return {
          ...state,
          groups: action.saved.groups,
          status: 'error',
          error: action.error,
          updatedAt: action.saved.savedAt,
          cursor: undefined,
          notice: loadFailedNotice(action.error),
          loadMoreFailed: false,
        };
      }
      return {
        ...state,
        status: 'error',
        error: action.error,
        notice: state.groups.length > 0 ? loadFailedNotice(action.error) : null,
      };
    case 'loadMoreStarted':
      return { ...state, status: 'loadingMore', error: null, loadMoreFailed: false };
    case 'loadMoreSucceeded':
      return {
        ...state,
        groups: action.groups,
        status: 'success',
        error: null,
        cursor: action.cursor,
        notice: null,
      };
    case 'loadMoreFailed':
      return {
        ...state,
        status: 'error',
        error: action.error,
        cursor: action.cursor,
        notice: loadFailedNotice(action.error),
        loadMoreFailed: true,
      };
    case 'noticeDismissed':
      return state.notice === null ? state : { ...state, notice: null };
    case 'openArticleFailed':
      return { ...state, notice: { kind: 'openArticleFailed' } };
  }
}

function toCardTexts(
  article: Article,
  t: I18n['t'],
  locale: I18n['locale']
): Omit<NewsCardItem, 'onPress'> {
  return {
    id: article.id,
    title: article.title,
    sourceName: article.sourceName,
    description: article.description,
    dateLabel: formatDateTime(article.publishedAt, locale),
    author: article.author,
    imageUrl: article.imageUrl,
    accessibilityLabel: t('card.a11y', { title: article.title, source: article.sourceName }),
  };
}

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

function toNoticeMessage(notice: NewsNotice, t: I18n['t']): string {
  if (notice.kind === 'openArticleFailed') {
    return t('errors.openArticle');
  }
  const message = t(`errors.${notice.error.kind}`);
  return notice.partial ? t('errors.partial', { message }) : message;
}

/**
 * State and actions of the news screen, ready to render. Every load, of a first page or of more
 * news, cancels the previous one and discards its outcome, so only the latest load updates the
 * state.
 */
export function useNewsViewModel(useCases: NewsUseCases = newsUseCases): NewsViewModel {
  const { loadSectionNews, loadMoreNews, openArticle: openArticleInBrowser } = useCases;
  const { t, locale } = useI18n();
  const [state, dispatch] = useReducer(reduceNewsState, INITIAL_NEWS_STATE);
  const controllerRef = useRef<AbortController | null>(null);

  const startRequest = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    return controller;
  }, []);

  const isCurrent = useCallback(
    (controller: AbortController) => controllerRef.current === controller && !controller.signal.aborted,
    []
  );

  const load = useCallback(
    (section: NewsSectionKey, hasArticles: boolean) => {
      const controller = startRequest();
      dispatch({ type: 'loadStarted' });
      loadSectionNews({ section, hasArticles, signal: controller.signal }).then(
        (result) => {
          if (!isCurrent(controller)) {
            return;
          }
          if (result.ok) {
            dispatch({
              type: 'loadSucceeded',
              groups: result.page.groups,
              cursor: result.page.next,
              partialError: result.page.partialError,
              receivedAt: new Date(),
            });
          } else {
            dispatch({ type: 'loadFailed', error: result.error, saved: result.saved });
          }
        },
        () => {
          // Only a cancelled load rejects: a newer load took its place, or the screen unmounted.
        }
      );
    },
    [isCurrent, loadSectionNews, startRequest]
  );

  useEffect(() => {
    load(INITIAL_SECTION, false);
    return () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, [load]);

  const { groups, status, selectedSection, cursor } = state;
  const hasArticles = groups.length > 0;

  const refresh = useCallback(() => {
    if (status === 'refreshing') {
      return;
    }
    load(selectedSection, hasArticles);
  }, [hasArticles, load, selectedSection, status]);

  const selectSection = useCallback(
    (section: NewsSectionKey) => {
      if (section === selectedSection) {
        return;
      }
      dispatch({ type: 'sectionSelected', section });
      load(section, false);
    },
    [load, selectedSection]
  );

  const loadMore = useCallback(() => {
    const canLoadMore = status === 'success' || (status === 'error' && hasArticles);
    if (cursor === undefined || !canLoadMore) {
      return;
    }
    const controller = startRequest();
    dispatch({ type: 'loadMoreStarted' });
    // While this request is the current one, the list on screen is still the one of the call.
    loadMoreNews({ section: selectedSection, groups, cursor, signal: controller.signal }).then(
      (result) => {
        if (!isCurrent(controller)) {
          return;
        }
        if (result.ok) {
          dispatch({ type: 'loadMoreSucceeded', groups: result.groups, cursor: result.cursor });
        } else {
          dispatch({ type: 'loadMoreFailed', error: result.error, cursor: result.cursor });
        }
      },
      () => {
        // Only a cancelled load rejects: a newer load took its place, or the screen unmounted.
      }
    );
  }, [cursor, groups, hasArticles, isCurrent, loadMoreNews, selectedSection, startRequest, status]);

  const openArticle = useCallback(
    (article: Article) => {
      openArticleInBrowser(article).then((outcome) => {
        if (outcome === 'failed') {
          dispatch({ type: 'openArticleFailed' });
        }
      });
    },
    [openArticleInBrowser]
  );

  const dismissNotice = useCallback(() => dispatch({ type: 'noticeDismissed' }), []);

  const sectionOptions = useMemo<NewsSectionOption[]>(
    () => NEWS_SECTION_KEYS.map((key) => ({ key, label: t(`categories.${key}`) })),
    [t]
  );

  const cardGroups = useMemo<NewsCardGroup[]>(
    () =>
      groups.map((group) => ({
        key: group.key,
        title: t(`groups.${group.key}`),
        items: group.articles.map((article) => ({
          ...toCardTexts(article, t, locale),
          onPress: () => openArticle(article),
        })),
      })),
    [groups, locale, openArticle, t]
  );

  return {
    status,
    selectedSection,
    sectionOptions,
    groups: cardGroups,
    errorMessage: state.error === null ? null : t(`errors.${state.error.kind}`),
    updatedAtLabel: toUpdatedAtLabel(state.updatedAt, t, locale),
    notice: state.notice === null ? null : toNoticeMessage(state.notice, t),
    hasMore: cursor !== undefined,
    loadMoreFailed: status === 'error' && state.loadMoreFailed,
    selectSection,
    refresh,
    loadMore,
    dismissNotice,
  };
}
