import { openBrowserAsync } from 'expo-web-browser';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { Linking, Platform } from 'react-native';

import { NEWS_SECTIONS, type NewsSectionKey } from '@/constants/news-sections';
import { NewsError, type Article } from '@/repositories/news-model';
import { getSectionArticles } from '@/repositories/news-repository';

export type NewsStatus = 'idle' | 'loading' | 'refreshing' | 'success' | 'error';

export type NewsViewModel = {
  articles: Article[];
  status: NewsStatus;
  error: NewsError | null;
  selectedSection: NewsSectionKey;
  selectSection: (section: NewsSectionKey) => void;
  refresh: () => void;
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
};

type Action =
  | { type: 'sectionSelected'; section: NewsSectionKey }
  | { type: 'loadStarted' }
  | { type: 'loadSucceeded'; articles: Article[] }
  | { type: 'loadFailed'; error: NewsError };

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
    case 'loadStarted':
      // With articles on screen the load is a refresh and keeps them; otherwise the loading state shows.
      return { ...state, status: state.articles.length > 0 ? 'refreshing' : 'loading', error: null };
    case 'loadSucceeded':
      return { ...state, articles: action.articles, status: 'success', error: null };
    case 'loadFailed':
      return { ...state, status: 'error', error: action.error };
  }
}

function toNewsError(error: unknown): NewsError {
  return error instanceof NewsError ? error : new NewsError('unknown');
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
 * State and actions of the news screen: the selected section, its articles, the
 * outcome of the last load and the opening of an article in the browser. Every load
 * cancels the previous one, whose outcome is discarded, so only the most recent
 * request ever updates the state.
 */
export function useNewsViewModel(): NewsViewModel {
  const [state, dispatch] = useReducer(reduce, INITIAL_STATE);
  const controllerRef = useRef<AbortController | null>(null);
  const openingRef = useRef(false);

  const load = useCallback((section: NewsSectionKey) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const isCurrent = () => controllerRef.current === controller && !controller.signal.aborted;

    dispatch({ type: 'loadStarted' });
    getSectionArticles(section, controller.signal).then(
      (page) => {
        if (isCurrent()) {
          dispatch({ type: 'loadSucceeded', articles: page.articles });
        }
      },
      (error: unknown) => {
        if (isCurrent()) {
          dispatch({ type: 'loadFailed', error: toNewsError(error) });
        }
      }
    );
  }, []);

  useEffect(() => {
    load(INITIAL_SECTION);
    return () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, [load]);

  const { status, selectedSection } = state;

  const refresh = useCallback(() => {
    if (status === 'refreshing') {
      return;
    }
    load(selectedSection);
  }, [load, selectedSection, status]);

  const selectSection = useCallback(
    (section: NewsSectionKey) => {
      if (section === selectedSection) {
        return;
      }
      dispatch({ type: 'sectionSelected', section });
      load(section);
    },
    [load, selectedSection]
  );

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
    articles: state.articles,
    status,
    error: state.error,
    selectedSection,
    selectSection,
    refresh,
    openArticle,
  };
}
