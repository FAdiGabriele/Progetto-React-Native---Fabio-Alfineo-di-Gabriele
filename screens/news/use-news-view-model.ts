import { openBrowserAsync } from 'expo-web-browser';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { Linking, Platform } from 'react-native';

import { NEWS_SECTIONS, type NewsSectionKey } from '@/constants/news-sections';
import { appendArticles } from '@/repositories/news-mapper';
import {
  NewsError,
  type Article,
  type NewsPageCursor,
  type SavedNews,
} from '@/repositories/news-model';
import { getSavedSectionArticles, getSectionArticles } from '@/repositories/news-repository';

export type NewsStatus = 'idle' | 'loading' | 'refreshing' | 'loadingMore' | 'success' | 'error';

export type NewsViewModel = {
  articles: Article[];
  status: NewsStatus;
  error: NewsError | null;
  selectedSection: NewsSectionKey;
  /**
   * When the list on screen was received: the last successful first page of the section,
   * or the save instant of a saved list. Absent while loading without data and in error
   * without data.
   */
  updatedAt?: Date;
  /** Whether some request of the section still has pages to load. */
  hasMore: boolean;
  selectSection: (section: NewsSectionKey) => void;
  refresh: () => void;
  /**
   * Appends the next page of the section to the list; ignored without more pages or
   * while another load is in progress.
   */
  loadMore: () => void;
  /**
   * Opens the article in the in-app browser, or in a new tab on web, with the system
   * browser as fallback; resolves to false when neither could open it. A call while
   * another opening is in progress is ignored and resolves to true.
   */
  openArticle: (article: Article) => Promise<boolean>;
};

type State = {
  articles: Article[];
  status: NewsStatus;
  error: NewsError | null;
  selectedSection: NewsSectionKey;
  updatedAt?: Date;
  cursor?: NewsPageCursor;
};

type Action =
  | { type: 'sectionSelected'; section: NewsSectionKey }
  | { type: 'loadStarted' }
  | { type: 'loadSucceeded'; articles: Article[]; cursor?: NewsPageCursor; receivedAt: Date }
  | { type: 'loadFailed'; error: NewsError; saved: SavedNews | null }
  | { type: 'loadMoreStarted' }
  | { type: 'loadMoreSucceeded'; articles: Article[]; cursor?: NewsPageCursor }
  | { type: 'loadMoreFailed'; error: NewsError };

const INITIAL_SECTION: NewsSectionKey = NEWS_SECTIONS[0].key;

const INITIAL_STATE: State = {
  articles: [],
  status: 'idle',
  error: null,
  selectedSection: INITIAL_SECTION,
};

function reduce(state: State, action: Action): State {
  switch (action.type) {
    case 'sectionSelected':
      return { articles: [], status: 'loading', error: null, selectedSection: action.section };
    case 'loadStarted': {
      // With articles on screen the load is a refresh and keeps them; otherwise the loading state shows.
      const hasArticles = state.articles.length > 0;
      return {
        ...state,
        status: hasArticles ? 'refreshing' : 'loading',
        error: null,
        updatedAt: hasArticles ? state.updatedAt : undefined,
        cursor: undefined,
      };
    }
    case 'loadSucceeded':
      return {
        ...state,
        articles: action.articles,
        status: 'success',
        error: null,
        updatedAt: action.receivedAt,
        cursor: action.cursor,
      };
    case 'loadFailed':
      if (action.saved === null) {
        return { ...state, status: 'error', error: action.error };
      }
      return {
        ...state,
        articles: action.saved.articles,
        status: 'error',
        error: action.error,
        updatedAt: action.saved.savedAt,
        cursor: undefined,
      };
    case 'loadMoreStarted':
      return { ...state, status: 'loadingMore', error: null };
    case 'loadMoreSucceeded':
      return {
        ...state,
        articles: appendArticles(state.articles, action.articles),
        status: 'success',
        error: null,
        cursor: action.cursor,
      };
    case 'loadMoreFailed':
      return { ...state, status: 'error', error: action.error };
  }
}

function toNewsError(error: unknown): NewsError {
  return error instanceof NewsError ? error : new NewsError('unknown');
}

function readSavedList(section: NewsSectionKey): Promise<SavedNews | null> {
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

/**
 * State and actions of the news screen: the selected section, its articles and later
 * pages, the outcome of the last load, when the list was received and the opening of an
 * article in the browser. Every load cancels the previous one, whose outcome is
 * discarded, so only the most recent request ever updates the state.
 */
export function useNewsViewModel(): NewsViewModel {
  const [state, dispatch] = useReducer(reduce, INITIAL_STATE);
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
              articles: page.articles,
              cursor: page.next,
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

  const { articles, status, selectedSection, cursor } = state;
  const hasArticles = articles.length > 0;

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
    getSectionArticles(selectedSection, controller.signal, cursor).then(
      (page) => {
        if (isCurrent(controller)) {
          dispatch({ type: 'loadMoreSucceeded', articles: page.articles, cursor: page.next });
        }
      },
      (error: unknown) => {
        if (isCurrent(controller)) {
          dispatch({ type: 'loadMoreFailed', error: toNewsError(error) });
        }
      }
    );
  }, [cursor, hasArticles, isCurrent, selectedSection, startRequest, status]);

  const openArticle = useCallback(async (article: Article): Promise<boolean> => {
    if (openingRef.current) {
      return true;
    }
    openingRef.current = true;
    try {
      return await openUrl(article.url);
    } finally {
      openingRef.current = false;
    }
  }, []);

  return {
    articles,
    status,
    error: state.error,
    selectedSection,
    updatedAt: state.updatedAt,
    hasMore: cursor !== undefined,
    selectSection,
    refresh,
    loadMore,
    openArticle,
  };
}
