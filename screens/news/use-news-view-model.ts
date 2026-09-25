import { useCallback, useEffect, useReducer, useRef } from 'react';

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

/**
 * State and actions of the news screen: the selected section, its articles and the
 * outcome of the last load. Every load cancels the previous one, whose outcome is
 * discarded, so only the most recent request ever updates the state.
 */
export function useNewsViewModel(): NewsViewModel {
  const [state, dispatch] = useReducer(reduce, INITIAL_STATE);
  const controllerRef = useRef<AbortController | null>(null);

  const load = useCallback((section: NewsSectionKey) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const isCurrent = () => controllerRef.current === controller && !controller.signal.aborted;

    dispatch({ type: 'loadStarted' });
    getSectionArticles(section, controller.signal).then(
      (articles) => {
        if (isCurrent()) {
          dispatch({ type: 'loadSucceeded', articles });
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

  return {
    articles: state.articles,
    status,
    error: state.error,
    selectedSection,
    selectSection,
    refresh,
  };
}
