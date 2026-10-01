import { openBrowserAsync } from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { Linking, Platform } from 'react-native';

import { NEWS_SECTIONS, type NewsGroupKey, type NewsSectionKey } from '@/constants/news-sections';
import { useI18n, type I18n } from '@/i18n/i18n-provider';
import { appendGroups } from '@/repositories/news-mapper';
import {
  NewsError,
  type Article,
  type NewsGroup,
  type NewsPageCursor,
  type SavedNews,
} from '@/repositories/news-model';
import { getSavedSectionArticles, getSectionArticles } from '@/repositories/news-repository';
import { formatDateTime, formatTime, isToday } from '@/utils/date';

export type NewsStatus = 'idle' | 'loading' | 'refreshing' | 'loadingMore' | 'success' | 'error';

/** Group of the list of a section: the key of its heading and its articles. */
export type NewsSectionGroup = NewsGroup<NewsGroupKey>;

/** Option of the category bar: the key of a section and its translated label. */
export type NewsSectionOption = { key: NewsSectionKey; label: string };

/** A card of the list, with its texts ready to show and the action of a tap. */
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

/** The cards of one group of the list, under their translated heading. */
export type NewsCardGroup = { key: NewsGroupKey; title: string; items: NewsCardItem[] };

/**
 * A non-blocking notice over the list: the error of a load that failed with the list still on
 * screen, or of the failed request of a partial first page, or an article that could not be opened.
 */
export type NewsNotice =
  | { kind: 'loadFailed'; error: NewsError; partial: boolean }
  | { kind: 'openArticleFailed' };

export type NewsViewModel = {
  status: NewsStatus;
  selectedSection: NewsSectionKey;
  /** Options of the category bar, in section order. */
  sectionOptions: readonly NewsSectionOption[];
  /**
   * Groups of cards of the list, in section order: one per request of the first page that
   * returned articles, then the group of the more news added at the end; empty without articles.
   */
  groups: NewsCardGroup[];
  /**
   * Translated message of the error of the last failed load, or of the failed request of a
   * partial first page; null when the last load succeeded completely. The screen shows it in
   * the error state, without articles; with articles the same error is reported by `notice`.
   */
  errorMessage: string | null;
  /**
   * Translated label of when the list on screen was received: the last successful first page
   * of the section, or the save instant of a saved list. Absent while loading without data and
   * in error without data.
   */
  updatedAtLabel?: string;
  /**
   * Translated message of the non-blocking notice to show over the list, or null: a refresh or
   * a page that failed with the list on screen, the saved list, a partial first page or an
   * article that could not be opened. A successful load, another section, leaving the list or
   * `dismissNotice` hide it.
   */
  notice: string | null;
  /** Whether the section still has more news to load at the end of the list. */
  hasMore: boolean;
  /**
   * Whether the last page of more news failed and no load is in progress: the end of the list
   * offers to retry it with `loadMore`.
   */
  loadMoreFailed: boolean;
  selectSection: (section: NewsSectionKey) => void;
  refresh: () => void;
  /**
   * Appends the next page of the section to the list, or retries the one that failed; a page
   * that adds nothing is followed at once by the next one, until one adds articles, fails or
   * is the last. Ignored without more pages or while another load is in progress.
   */
  loadMore: () => void;
  dismissNotice: () => void;
};

/** State of the news screen, kept by the reducer of the view model. */
export type NewsState = {
  groups: NewsSectionGroup[];
  status: NewsStatus;
  error: NewsError | null;
  selectedSection: NewsSectionKey;
  updatedAt?: Date;
  cursor?: NewsPageCursor;
  notice: NewsNotice | null;
  /** The last page of more news failed and the list on screen is still waiting for it. */
  loadMoreFailed: boolean;
};

/** Events that move the state of the news screen: what the view model dispatches. */
export type NewsAction =
  | { type: 'sectionSelected'; section: NewsSectionKey }
  | { type: 'loadStarted' }
  | {
      type: 'loadSucceeded';
      groups: NewsSectionGroup[];
      cursor?: NewsPageCursor;
      partialError?: NewsError;
      receivedAt: Date;
    }
  | { type: 'loadFailed'; error: NewsError; saved: SavedNews<NewsGroupKey> | null }
  | { type: 'loadMoreStarted' }
  | { type: 'loadMoreSkipped'; cursor: NewsPageCursor }
  | { type: 'loadMoreSucceeded'; groups: NewsSectionGroup[]; cursor?: NewsPageCursor }
  | { type: 'loadMoreFailed'; error: NewsError }
  | { type: 'noticeDismissed' }
  | { type: 'openArticleFailed' };

const INITIAL_SECTION: NewsSectionKey = NEWS_SECTIONS[0].key;

/** State before the first load: the first section selected, nothing loaded yet. */
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

/** Pure transition of the state of the news screen for one event. */
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
      // With articles on screen the failed refresh is reported over them; without articles
      // the error state reports it.
      return {
        ...state,
        status: 'error',
        error: action.error,
        notice: state.groups.length > 0 ? loadFailedNotice(action.error) : null,
      };
    case 'loadMoreStarted':
      return { ...state, status: 'loadingMore', error: null, loadMoreFailed: false };
    case 'loadMoreSkipped':
      // The page added nothing: the list keeps loading, now waiting for the following page.
      return { ...state, cursor: action.cursor };
    case 'loadMoreSucceeded':
      return {
        ...state,
        groups: appendGroups(state.groups, action.groups),
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
        notice: loadFailedNotice(action.error),
        loadMoreFailed: true,
      };
    case 'noticeDismissed':
      return state.notice === null ? state : { ...state, notice: null };
    case 'openArticleFailed':
      return { ...state, notice: { kind: 'openArticleFailed' } };
  }
}

function toNewsError(error: unknown): NewsError {
  return error instanceof NewsError ? error : new NewsError('unknown');
}

function readSavedList(section: NewsSectionKey): Promise<SavedNews<NewsGroupKey> | null> {
  return getSavedSectionArticles(section).catch(() => null);
}

async function openUrl(url: string): Promise<boolean> {
  // On web the in-app browser is a popup window, so the URL opens in a new tab with Linking.
  if (Platform.OS !== 'web') {
    try {
      await openBrowserAsync(url);
      return true;
    } catch {
      // The in-app browser is unavailable or failed: the system browser is the fallback.
    }
  }
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
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

function toNoticeMessage(notice: NewsNotice, t: I18n['t']): string {
  if (notice.kind === 'openArticleFailed') {
    return t('errors.openArticle');
  }
  const message = t(`errors.${notice.error.kind}`);
  return notice.partial ? t('errors.partial', { message }) : message;
}

/**
 * State and actions of the news screen, ready to render: the selected section and the options
 * of the category bar, the groups of cards of its articles and later pages, the message of the
 * last error, when the list was received, the non-blocking notice and the loading of more news,
 * with the retry of a page that failed; a tap on a card opens the article in the browser. Every
 * load cancels the previous one, whose outcome is discarded, so only the most recent request
 * ever updates the state.
 */
export function useNewsViewModel(): NewsViewModel {
  const { t, locale } = useI18n();
  const [state, dispatch] = useReducer(reduceNewsState, INITIAL_NEWS_STATE);
  const controllerRef = useRef<AbortController | null>(null);
  const openingRef = useRef(false);

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
      getSectionArticles(section, controller.signal).then(
        (page) => {
          if (isCurrent(controller)) {
            dispatch({
              type: 'loadSucceeded',
              groups: page.groups,
              cursor: page.next,
              partialError: page.partialError,
              receivedAt: new Date(),
            });
          }
        },
        async (error: unknown) => {
          if (!isCurrent(controller)) {
            return;
          }
          // Without articles on screen the saved list of the section, when there is one, takes their place.
          const saved = hasArticles ? null : await readSavedList(section);
          if (isCurrent(controller)) {
            dispatch({ type: 'loadFailed', error: toNewsError(error), saved });
          }
        }
      );
    },
    [isCurrent, startRequest]
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
    const requestPage = (pageCursor: NewsPageCursor) => {
      getSectionArticles(selectedSection, controller.signal, pageCursor).then(
        (page) => {
          if (!isCurrent(controller)) {
            return;
          }
          // A page that adds nothing leaves the list as it is, so the list would not ask for
          // the next one by itself: the following page is requested at once. While this
          // request is the current one, the list is still the one of the call.
          if (page.next !== undefined && appendGroups(groups, page.groups) === groups) {
            dispatch({ type: 'loadMoreSkipped', cursor: page.next });
            requestPage(page.next);
            return;
          }
          dispatch({ type: 'loadMoreSucceeded', groups: page.groups, cursor: page.next });
        },
        (error: unknown) => {
          if (isCurrent(controller)) {
            dispatch({ type: 'loadMoreFailed', error: toNewsError(error) });
          }
        }
      );
    };
    requestPage(cursor);
  }, [cursor, groups, hasArticles, isCurrent, selectedSection, startRequest, status]);

  // Opens the article in the in-app browser, or in a new tab on web, with the system browser
  // as fallback; a tap while another article is opening is ignored.
  const openArticle = useCallback((article: Article) => {
    if (openingRef.current) {
      return;
    }
    openingRef.current = true;
    openUrl(article.url)
      .then((opened) => {
        if (!opened) {
          dispatch({ type: 'openArticleFailed' });
        }
      })
      .finally(() => {
        openingRef.current = false;
      });
  }, []);

  const dismissNotice = useCallback(() => dispatch({ type: 'noticeDismissed' }), []);

  const sectionOptions = useMemo<NewsSectionOption[]>(
    () => NEWS_SECTIONS.map((section) => ({ key: section.key, label: t(section.labelKey) })),
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
