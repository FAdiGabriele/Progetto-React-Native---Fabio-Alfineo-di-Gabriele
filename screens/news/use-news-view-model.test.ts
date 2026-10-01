import { act, renderHook, waitFor } from '@testing-library/react-native';
import { openBrowserAsync, WebBrowserResultType, type WebBrowserResult } from 'expo-web-browser';
import { Linking } from 'react-native';

import type { NewsGroupKey } from '@/constants/news-sections';
import { NewsError, type Article, type NewsPage, type SavedNews } from '@/repositories/news-model';
import {
  INITIAL_NEWS_STATE,
  reduceNewsState,
  useNewsViewModel,
  type NewsAction,
  type NewsSectionGroup,
  type NewsState,
} from '@/screens/news/use-news-view-model';

jest.mock('@/repositories/news-repository', () => ({
  getSectionArticles: jest.fn(),
  getSavedSectionArticles: jest.fn(),
}));

jest.mock('expo-web-browser', () => ({ ...jest.requireActual('expo-web-browser'), openBrowserAsync: jest.fn() }));

// The Italian dictionary, without the provider: the tests read the texts the screen would show.
jest.mock('@/i18n/i18n-provider', () => {
  const { it: dictionary } = jest.requireActual<typeof import('@/i18n/it')>('@/i18n/it');
  const translate = (key: keyof typeof dictionary, params?: Record<string, string | number>) =>
    dictionary[key].replace(/\{(\w+)\}/g, (placeholder: string, name: string) =>
      params?.[name] === undefined ? placeholder : String(params[name])
    );
  return {
    useI18n: () => ({ language: 'it', locale: 'it-IT', t: translate, toggleLanguage: jest.fn() }),
  };
});

type Repository = typeof import('@/repositories/news-repository');
const repository = jest.requireMock<Repository>('@/repositories/news-repository');
const getSectionArticles = repository.getSectionArticles as jest.MockedFunction<Repository['getSectionArticles']>;
const getSavedSectionArticles = repository.getSavedSectionArticles as jest.MockedFunction<
  Repository['getSavedSectionArticles']
>;
const openBrowser = openBrowserAsync as jest.MockedFunction<typeof openBrowserAsync>;
const openUrl = Linking.openURL as jest.MockedFunction<typeof Linking.openURL>;

function makeArticle(slug: string, sourceName = 'ANSA.it'): Article {
  const url = `https://example.com/${slug}`;
  return { id: url, title: `Title ${slug}`, url, sourceName, publishedAt: new Date('2026-09-24T12:30:00Z') };
}

const first = makeArticle('first');
const second = makeArticle('second');
const third = makeArticle('third');
const fourth = makeArticle('fourth');

const FRONT_PAGES: NewsSectionGroup = { key: 'frontPages', articles: [first, second] };
const LATEST_ANSA: NewsSectionGroup = { key: 'latestAnsa', articles: [third] };
const MORE_NEWS: NewsSectionGroup = { key: 'moreNews', articles: [fourth] };

const RECEIVED_AT = new Date('2026-09-30T10:00:00Z');
const SAVED_AT = new Date('2026-09-29T08:00:00Z');

function reduceAll(actions: NewsAction[], from: NewsState = INITIAL_NEWS_STATE): NewsState {
  return actions.reduce(reduceNewsState, from);
}

const loadedState = (): NewsState =>
  reduceAll([
    { type: 'loadStarted' },
    {
      type: 'loadSucceeded',
      groups: [FRONT_PAGES, LATEST_ANSA],
      cursor: { page: 1 },
      receivedAt: RECEIVED_AT,
    },
  ]);

const partialState = (partialError: NewsError): NewsState =>
  reduceAll([
    { type: 'loadStarted' },
    { type: 'loadSucceeded', groups: [FRONT_PAGES], cursor: { page: 1 }, partialError, receivedAt: RECEIVED_AT },
  ]);

const savedState = (error: NewsError): NewsState =>
  reduceAll([
    { type: 'loadStarted' },
    { type: 'loadFailed', error, saved: { groups: [FRONT_PAGES, LATEST_ANSA], savedAt: SAVED_AT } },
  ]);

describe('INITIAL_NEWS_STATE', () => {
  it('starts idle on the first section, without articles, error, notice, instant or cursor', () => {
    expect(INITIAL_NEWS_STATE).toEqual({
      groups: [],
      status: 'idle',
      error: null,
      selectedSection: 'italy',
      notice: null,
    });
  });
});

describe('reduceNewsState on the first page', () => {
  it('enters loading without articles and keeps nothing to show', () => {
    const state = reduceNewsState(INITIAL_NEWS_STATE, { type: 'loadStarted' });

    expect(state).toEqual({ groups: [], status: 'loading', error: null, selectedSection: 'italy', notice: null });
  });

  it('shows the groups of a successful first page with its instant and cursor, without notice', () => {
    const state = loadedState();

    expect(state.status).toBe('success');
    expect(state.groups).toEqual([FRONT_PAGES, LATEST_ANSA]);
    expect(state.error).toBeNull();
    expect(state.notice).toBeNull();
    expect(state.updatedAt).toBe(RECEIVED_AT);
    expect(state.cursor).toEqual({ page: 1 });
  });

  it('keeps the error of a partial first page next to its groups, in success, and reports it as a partial notice', () => {
    const partialError = new NewsError('network');
    const state = partialState(partialError);

    expect(state.status).toBe('success');
    expect(state.groups).toEqual([FRONT_PAGES]);
    expect(state.error).toBe(partialError);
    expect(state.notice).toEqual({ kind: 'loadFailed', error: partialError, partial: true });
    expect(state.updatedAt).toBe(RECEIVED_AT);
  });

  it('reports a partial first page without articles as well', () => {
    const partialError = new NewsError('server');
    const state = reduceAll([
      { type: 'loadStarted' },
      { type: 'loadSucceeded', groups: [], cursor: { page: 1 }, partialError, receivedAt: RECEIVED_AT },
    ]);

    expect(state.groups).toEqual([]);
    expect(state.notice).toEqual({ kind: 'loadFailed', error: partialError, partial: true });
  });

  it('accepts a first page without a cursor and with zero groups', () => {
    const state = reduceAll([{ type: 'loadStarted' }, { type: 'loadSucceeded', groups: [], receivedAt: RECEIVED_AT }]);

    expect(state.status).toBe('success');
    expect(state.groups).toEqual([]);
    expect(state.cursor).toBeUndefined();
    expect(state.updatedAt).toBe(RECEIVED_AT);
  });

  it('enters error without articles and without notice when the first page fails and nothing is saved', () => {
    const error = new NewsError('timeout');
    const state = reduceAll([{ type: 'loadStarted' }, { type: 'loadFailed', error, saved: null }]);

    expect(state).toEqual({ groups: [], status: 'error', error, selectedSection: 'italy', notice: null });
  });

  it('shows the saved list with its instant, in error, without a cursor and with the error as notice', () => {
    const error = new NewsError('network');
    const state = savedState(error);

    expect(state.status).toBe('error');
    expect(state.error).toBe(error);
    expect(state.groups).toEqual([FRONT_PAGES, LATEST_ANSA]);
    expect(state.updatedAt).toBe(SAVED_AT);
    expect(state.cursor).toBeUndefined();
    expect(state.notice).toEqual({ kind: 'loadFailed', error, partial: false });
  });
});

describe('reduceNewsState on a section change', () => {
  it('drops the list, the cursor, the instant and the notice and enters loading on the new section', () => {
    const state = reduceNewsState(partialState(new NewsError('network')), { type: 'sectionSelected', section: 'usa' });

    expect(state).toEqual({ groups: [], status: 'loading', error: null, selectedSection: 'usa', notice: null });
  });

  it('drops a previous error as well', () => {
    const failed = reduceAll([{ type: 'loadStarted' }, { type: 'loadFailed', error: new NewsError('auth'), saved: null }]);
    const state = reduceNewsState(failed, { type: 'sectionSelected', section: 'usa' });

    expect(state.error).toBeNull();
    expect(state.status).toBe('loading');
  });
});

describe('reduceNewsState on a refresh', () => {
  it('keeps the list, the instant, the cursor and the notice while refreshing', () => {
    const partialError = new NewsError('network');
    const state = reduceNewsState(partialState(partialError), { type: 'loadStarted' });

    expect(state.status).toBe('refreshing');
    expect(state.groups).toEqual([FRONT_PAGES]);
    expect(state.updatedAt).toBe(RECEIVED_AT);
    expect(state.cursor).toEqual({ page: 1 });
    expect(state.error).toBeNull();
    expect(state.notice).toEqual({ kind: 'loadFailed', error: partialError, partial: true });
  });

  it('replaces the list, the instant and the cursor and hides the notice when the refresh succeeds', () => {
    const later = new Date('2026-09-30T11:00:00Z');
    const state = reduceAll(
      [
        { type: 'loadStarted' },
        { type: 'loadSucceeded', groups: [LATEST_ANSA], cursor: { page: 1 }, receivedAt: later },
      ],
      partialState(new NewsError('network'))
    );

    expect(state.status).toBe('success');
    expect(state.groups).toEqual([LATEST_ANSA]);
    expect(state.updatedAt).toBe(later);
    expect(state.error).toBeNull();
    expect(state.notice).toBeNull();
  });

  it('keeps the list, the instant and the cursor when the refresh fails and reports the error as notice', () => {
    const error = new NewsError('network');
    const state = reduceAll([{ type: 'loadStarted' }, { type: 'loadFailed', error, saved: null }], loadedState());

    expect(state.status).toBe('error');
    expect(state.error).toBe(error);
    expect(state.groups).toEqual([FRONT_PAGES, LATEST_ANSA]);
    expect(state.updatedAt).toBe(RECEIVED_AT);
    expect(state.cursor).toEqual({ page: 1 });
    expect(state.notice).toEqual({ kind: 'loadFailed', error, partial: false });
  });

  it('replaces the partial notice with the error of a refresh that fails', () => {
    const refreshError = new NewsError('rateLimit');
    const state = reduceAll(
      [{ type: 'loadStarted' }, { type: 'loadFailed', error: refreshError, saved: null }],
      partialState(new NewsError('network'))
    );

    expect(state.notice).toEqual({ kind: 'loadFailed', error: refreshError, partial: false });
  });

  it('drops the notice when a load starts without articles on screen', () => {
    const emptyPartial = reduceAll([
      { type: 'loadStarted' },
      {
        type: 'loadSucceeded',
        groups: [],
        cursor: { page: 1 },
        partialError: new NewsError('server'),
        receivedAt: RECEIVED_AT,
      },
    ]);
    const state = reduceNewsState(emptyPartial, { type: 'loadStarted' });

    expect(state.status).toBe('loading');
    expect(state.notice).toBeNull();
    expect(state.updatedAt).toBeUndefined();
  });

  it('refreshes the saved list too, replacing it when the load succeeds', () => {
    const refreshing = reduceNewsState(savedState(new NewsError('network')), { type: 'loadStarted' });
    const state = reduceNewsState(refreshing, {
      type: 'loadSucceeded',
      groups: [FRONT_PAGES, LATEST_ANSA],
      cursor: { page: 1 },
      receivedAt: RECEIVED_AT,
    });

    expect(refreshing.status).toBe('refreshing');
    expect(refreshing.updatedAt).toBe(SAVED_AT);
    expect(refreshing.notice).not.toBeNull();
    expect(state.groups).toEqual([FRONT_PAGES, LATEST_ANSA]);
    expect(state.updatedAt).toBe(RECEIVED_AT);
    expect(state.cursor).toEqual({ page: 1 });
    expect(state.notice).toBeNull();
  });
});

describe('reduceNewsState on more news', () => {
  it('keeps the list, the instant and the notice while a page loads', () => {
    const state = reduceNewsState(partialState(new NewsError('network')), { type: 'loadMoreStarted' });

    expect(state.status).toBe('loadingMore');
    expect(state.groups).toEqual([FRONT_PAGES]);
    expect(state.updatedAt).toBe(RECEIVED_AT);
    expect(state.cursor).toEqual({ page: 1 });
    expect(state.notice).not.toBeNull();
  });

  it('appends the group of a page after the list, moves the cursor to the next page and hides the notice', () => {
    const state = reduceAll(
      [{ type: 'loadMoreStarted' }, { type: 'loadMoreSucceeded', groups: [MORE_NEWS], cursor: { page: 2 } }],
      partialState(new NewsError('network'))
    );

    expect(state.status).toBe('success');
    expect(state.groups).toEqual([FRONT_PAGES, MORE_NEWS]);
    expect(state.cursor).toEqual({ page: 2 });
    expect(state.updatedAt).toBe(RECEIVED_AT);
    expect(state.error).toBeNull();
    expect(state.notice).toBeNull();
  });

  it('extends the last group with the next page of the same key and drops the cursor of an exhausted request', () => {
    const fifth = makeArticle('fifth');
    const withMore = reduceAll(
      [{ type: 'loadMoreStarted' }, { type: 'loadMoreSucceeded', groups: [MORE_NEWS], cursor: { page: 2 } }],
      loadedState()
    );
    const state = reduceAll(
      [{ type: 'loadMoreStarted' }, { type: 'loadMoreSucceeded', groups: [{ key: 'moreNews', articles: [fifth] }] }],
      withMore
    );

    expect(state.groups).toEqual([FRONT_PAGES, LATEST_ANSA, { key: 'moreNews', articles: [fourth, fifth] }]);
    expect(state.cursor).toBeUndefined();
  });

  it('drops the articles of a page that are already in the list and keeps the same list when nothing is added', () => {
    const loaded = loadedState();
    const duplicates: NewsSectionGroup = {
      key: 'moreNews',
      articles: [makeArticle('first'), { ...makeArticle('regional/third'), title: 'Title third' }],
    };
    const state = reduceAll(
      [{ type: 'loadMoreStarted' }, { type: 'loadMoreSucceeded', groups: [duplicates], cursor: { page: 2 } }],
      loaded
    );

    expect(state.groups).toBe(loaded.groups);
    expect(state.cursor).toEqual({ page: 2 });
  });

  it('keeps the list and the cursor when a page fails and reports the error as notice', () => {
    const error = new NewsError('rateLimit');
    const state = reduceAll([{ type: 'loadMoreStarted' }, { type: 'loadMoreFailed', error }], loadedState());

    expect(state.status).toBe('error');
    expect(state.error).toBe(error);
    expect(state.groups).toEqual([FRONT_PAGES, LATEST_ANSA]);
    expect(state.cursor).toEqual({ page: 1 });
    expect(state.notice).toEqual({ kind: 'loadFailed', error, partial: false });
  });

  it('clears a previous error when a page starts and after a page succeeds', () => {
    const failed = reduceAll([{ type: 'loadMoreStarted' }, { type: 'loadMoreFailed', error: new NewsError('network') }], loadedState());
    const started = reduceNewsState(failed, { type: 'loadMoreStarted' });
    const succeeded = reduceNewsState(started, { type: 'loadMoreSucceeded', groups: [MORE_NEWS], cursor: { page: 2 } });

    expect(started.error).toBeNull();
    expect(started.notice).not.toBeNull();
    expect(succeeded.error).toBeNull();
    expect(succeeded.notice).toBeNull();
    expect(succeeded.status).toBe('success');
  });

  it('loads the next page of the list left on screen by a failed refresh', () => {
    const afterFailedRefresh = reduceAll(
      [{ type: 'loadStarted' }, { type: 'loadFailed', error: new NewsError('network'), saved: null }],
      loadedState()
    );
    const state = reduceAll(
      [{ type: 'loadMoreStarted' }, { type: 'loadMoreSucceeded', groups: [MORE_NEWS], cursor: { page: 2 } }],
      afterFailedRefresh
    );

    expect(afterFailedRefresh.cursor).toEqual({ page: 1 });
    expect(state.groups).toEqual([FRONT_PAGES, LATEST_ANSA, MORE_NEWS]);
    expect(state.cursor).toEqual({ page: 2 });
  });

  it('never gives the saved list a cursor', () => {
    expect(savedState(new NewsError('network')).cursor).toBeUndefined();
  });
});

describe('reduceNewsState on the notice', () => {
  it('hides the notice when dismissed and returns the same state when there is none', () => {
    const partial = partialState(new NewsError('network'));
    const dismissed = reduceNewsState(partial, { type: 'noticeDismissed' });

    expect(dismissed.notice).toBeNull();
    expect(dismissed.status).toBe('success');
    expect(dismissed.error).toBe(partial.error);
    expect(dismissed.groups).toBe(partial.groups);
    expect(reduceNewsState(dismissed, { type: 'noticeDismissed' })).toBe(dismissed);
  });

  it('reports an article that could not be opened without touching the rest of the state', () => {
    const loaded = loadedState();
    const state = reduceNewsState(loaded, { type: 'openArticleFailed' });

    expect(state).toEqual({ ...loaded, notice: { kind: 'openArticleFailed' } });
  });

  it('keeps the opening notice during a refresh and hides it when the refresh succeeds', () => {
    const noticed = reduceNewsState(loadedState(), { type: 'openArticleFailed' });
    const refreshing = reduceNewsState(noticed, { type: 'loadStarted' });
    const state = reduceNewsState(refreshing, {
      type: 'loadSucceeded',
      groups: [FRONT_PAGES],
      cursor: { page: 1 },
      receivedAt: RECEIVED_AT,
    });

    expect(refreshing.notice).toEqual({ kind: 'openArticleFailed' });
    expect(state.notice).toBeNull();
  });

  it('replaces the opening notice with the error of a page that fails', () => {
    const error = new NewsError('network');
    const noticed = reduceNewsState(loadedState(), { type: 'openArticleFailed' });
    const state = reduceAll([{ type: 'loadMoreStarted' }, { type: 'loadMoreFailed', error }], noticed);

    expect(state.notice).toEqual({ kind: 'loadFailed', error, partial: false });
  });
});

type SectionPage = NewsPage<NewsGroupKey>;

const DISMISSED: WebBrowserResult = { type: WebBrowserResultType.DISMISS };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const FIRST_PAGE: SectionPage = { groups: [FRONT_PAGES, LATEST_ANSA], next: { page: 1 } };
const NETWORK_MESSAGE = 'Connessione assente. Controlla la rete e riprova.';

describe('useNewsViewModel', () => {
  beforeEach(() => {
    getSectionArticles.mockReset();
    getSavedSectionArticles.mockReset();
    getSavedSectionArticles.mockResolvedValue(null);
    openBrowser.mockReset();
    openBrowser.mockResolvedValue(DISMISSED);
    openUrl.mockReset();
    openUrl.mockResolvedValue(true);
  });

  async function renderLoaded(page: SectionPage = FIRST_PAGE) {
    getSectionArticles.mockResolvedValueOnce(page);
    const rendered = await renderHook(() => useNewsViewModel());
    await waitFor(() => expect(rendered.result.current.status).toBe('success'));
    return rendered;
  }

  it('loads the first section at start and exposes the list ready to render', async () => {
    const load = deferred<SectionPage>();
    getSectionArticles.mockReturnValueOnce(load.promise);

    const { result } = await renderHook(() => useNewsViewModel());

    expect(result.current.status).toBe('loading');
    expect(result.current.groups).toEqual([]);
    expect(result.current.updatedAtLabel).toBeUndefined();
    expect(getSectionArticles).toHaveBeenCalledTimes(1);
    expect(getSectionArticles.mock.calls[0][0]).toBe('italy');
    expect(getSectionArticles.mock.calls[0][1]).toBeInstanceOf(AbortSignal);
    expect(getSectionArticles.mock.calls[0][2]).toBeUndefined();

    await act(async () => load.resolve(FIRST_PAGE));

    const { current } = result;
    expect(current.status).toBe('success');
    expect(current.selectedSection).toBe('italy');
    expect(current.sectionOptions).toEqual([
      { key: 'italy', label: 'Italia' },
      { key: 'usa', label: 'USA' },
    ]);
    expect(current.groups.map((group) => [group.key, group.title, group.items.length])).toEqual([
      ['frontPages', 'Prime pagine', 2],
      ['latestAnsa', 'Ultime da ANSA', 1],
    ]);
    expect(current.groups[0].items[0]).toEqual({
      id: first.id,
      title: 'Title first',
      sourceName: 'ANSA.it',
      description: undefined,
      dateLabel: '24 set 2026, 14:30',
      author: undefined,
      imageUrl: undefined,
      accessibilityLabel: 'Apri notizia: Title first, ANSA.it',
      onPress: expect.any(Function),
    });
    expect(current.updatedAtLabel).toMatch(/^Aggiornato alle \d{2}:\d{2}$/);
    expect(current.errorMessage).toBeNull();
    expect(current.notice).toBeNull();
    expect(current.hasMore).toBe(true);
  });

  it('keeps the same card groups between renders that change nothing', async () => {
    const { result, rerender } = await renderLoaded();
    const groups = result.current.groups;

    await rerender(undefined);

    expect(result.current.groups).toBe(groups);
    expect(result.current.sectionOptions).toBe(result.current.sectionOptions);
  });

  it('reports a partial first page with the notice and the error message, and hides the notice when dismissed', async () => {
    const { result } = await renderLoaded({
      groups: [FRONT_PAGES],
      next: { page: 1 },
      partialError: new NewsError('network'),
    });

    expect(result.current.notice).toBe(`Alcune notizie non sono state caricate. ${NETWORK_MESSAGE}`);
    expect(result.current.errorMessage).toBe(NETWORK_MESSAGE);
    expect(result.current.groups).toHaveLength(1);
    expect(result.current.updatedAtLabel).toMatch(/^Aggiornato alle /);

    await act(async () => result.current.dismissNotice());

    expect(result.current.notice).toBeNull();
    expect(result.current.errorMessage).toBe(NETWORK_MESSAGE);
  });

  it('enters the error state with the message when the first page fails and nothing is saved', async () => {
    getSectionArticles.mockRejectedValueOnce(new NewsError('timeout'));

    const { result } = await renderHook(() => useNewsViewModel());
    await waitFor(() => expect(result.current.status).toBe('error'));

    expect(getSavedSectionArticles).toHaveBeenCalledWith('italy');
    expect(result.current.groups).toEqual([]);
    expect(result.current.errorMessage).toBe('Il server non risponde. Riprova.');
    expect(result.current.notice).toBeNull();
    expect(result.current.updatedAtLabel).toBeUndefined();
    expect(result.current.hasMore).toBe(false);
  });

  it('translates an unexpected rejection as an unknown error', async () => {
    getSectionArticles.mockRejectedValueOnce(new Error('boom'));

    const { result } = await renderHook(() => useNewsViewModel());
    await waitFor(() => expect(result.current.status).toBe('error'));

    expect(result.current.errorMessage).toBe('Si è verificato un errore imprevisto.');
  });

  it('shows the saved list with its save instant and the error as notice when the first page fails', async () => {
    const saved: SavedNews<NewsGroupKey> = { groups: [FRONT_PAGES, LATEST_ANSA], savedAt: SAVED_AT };
    getSectionArticles.mockRejectedValueOnce(new NewsError('network'));
    getSavedSectionArticles.mockResolvedValueOnce(saved);

    const { result } = await renderHook(() => useNewsViewModel());
    await waitFor(() => expect(result.current.status).toBe('error'));

    expect(result.current.groups.map((group) => group.title)).toEqual(['Prime pagine', 'Ultime da ANSA']);
    expect(result.current.updatedAtLabel).toBe('Aggiornato il 29 set 2026, 10:00');
    expect(result.current.notice).toBe(NETWORK_MESSAGE);
    expect(result.current.errorMessage).toBe(NETWORK_MESSAGE);
    expect(result.current.hasMore).toBe(false);
  });

  it('refreshes the selected section keeping the list on screen and ignores a second refresh meanwhile', async () => {
    const { result } = await renderLoaded();
    const refresh = deferred<SectionPage>();
    getSectionArticles.mockReturnValueOnce(refresh.promise);

    await act(async () => result.current.refresh());

    expect(result.current.status).toBe('refreshing');
    expect(result.current.groups).toHaveLength(2);
    expect(getSectionArticles).toHaveBeenCalledTimes(2);

    await act(async () => result.current.refresh());

    expect(getSectionArticles).toHaveBeenCalledTimes(2);

    await act(async () => refresh.resolve({ groups: [LATEST_ANSA], next: { page: 1 } }));

    expect(result.current.status).toBe('success');
    expect(result.current.groups.map((group) => group.key)).toEqual(['latestAnsa']);
  });

  it('keeps the list and the cursor after a failed refresh, reports it as notice and still loads the next page', async () => {
    const { result } = await renderLoaded();
    getSectionArticles.mockRejectedValueOnce(new NewsError('network'));

    await act(async () => result.current.refresh());
    await waitFor(() => expect(result.current.status).toBe('error'));

    expect(result.current.groups).toHaveLength(2);
    expect(result.current.notice).toBe(NETWORK_MESSAGE);
    expect(result.current.hasMore).toBe(true);
    expect(getSavedSectionArticles).not.toHaveBeenCalled();

    getSectionArticles.mockResolvedValueOnce({ groups: [MORE_NEWS], next: { page: 2 } });
    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.status).toBe('success'));

    expect(getSectionArticles).toHaveBeenLastCalledWith('italy', expect.any(AbortSignal), { page: 1 });
    expect(result.current.groups.map((group) => [group.key, group.title])).toEqual([
      ['frontPages', 'Prime pagine'],
      ['latestAnsa', 'Ultime da ANSA'],
      ['moreNews', 'Altre notizie'],
    ]);
    expect(result.current.notice).toBeNull();
  });

  it('changes section: drops the list, aborts the previous request and loads the new section', async () => {
    const { result } = await renderLoaded();
    const firstSignal = getSectionArticles.mock.calls[0][1] as AbortSignal;
    const usa = deferred<SectionPage>();
    getSectionArticles.mockReturnValueOnce(usa.promise);

    await act(async () => result.current.selectSection('usa'));

    expect(result.current.status).toBe('loading');
    expect(result.current.selectedSection).toBe('usa');
    expect(result.current.groups).toEqual([]);
    expect(result.current.updatedAtLabel).toBeUndefined();
    expect(firstSignal.aborted).toBe(true);
    expect(getSectionArticles).toHaveBeenLastCalledWith('usa', expect.any(AbortSignal));

    await act(async () => usa.resolve({ groups: [{ key: 'topHeadlines', articles: [first] }], next: { page: 1 } }));

    expect(result.current.groups.map((group) => group.title)).toEqual(['Notizie principali']);
  });

  it('ignores the selection of the section already selected', async () => {
    const { result } = await renderLoaded();

    await act(async () => result.current.selectSection('italy'));

    expect(getSectionArticles).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('success');
  });

  it('discards the outcome of a request overtaken by a section change', async () => {
    const italy = deferred<SectionPage>();
    getSectionArticles.mockReturnValueOnce(italy.promise);
    const { result } = await renderHook(() => useNewsViewModel());
    const usa = deferred<SectionPage>();
    getSectionArticles.mockReturnValueOnce(usa.promise);

    await act(async () => result.current.selectSection('usa'));
    await act(async () => italy.resolve(FIRST_PAGE));

    expect(result.current.status).toBe('loading');
    expect(result.current.groups).toEqual([]);

    await act(async () => usa.resolve({ groups: [{ key: 'topHeadlines', articles: [second] }] }));

    expect(result.current.status).toBe('success');
    expect(result.current.groups[0].items[0].id).toBe(second.id);
    expect(result.current.hasMore).toBe(false);
  });

  it('loads more news at the end of the list and keeps the cursor to retry when a page fails', async () => {
    const { result } = await renderLoaded();
    getSectionArticles.mockRejectedValueOnce(new NewsError('rateLimit'));

    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.status).toBe('error'));

    expect(result.current.notice).toBe('Limite di richieste raggiunto. Riprova più tardi.');
    expect(result.current.groups).toHaveLength(2);
    expect(result.current.hasMore).toBe(true);

    getSectionArticles.mockResolvedValueOnce({ groups: [MORE_NEWS] });
    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.status).toBe('success'));

    expect(getSectionArticles.mock.calls.slice(1).map((call) => call[2])).toEqual([{ page: 1 }, { page: 1 }]);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.groups).toHaveLength(3);

    await act(async () => result.current.loadMore());

    expect(getSectionArticles).toHaveBeenCalledTimes(3);
  });

  it('ignores more news while a load is in progress', async () => {
    const load = deferred<SectionPage>();
    getSectionArticles.mockReturnValueOnce(load.promise);
    const { result } = await renderHook(() => useNewsViewModel());

    await act(async () => result.current.loadMore());

    expect(getSectionArticles).toHaveBeenCalledTimes(1);
  });

  it('opens an article in the in-app browser from the card, once at a time', async () => {
    const opening = deferred<WebBrowserResult>();
    openBrowser.mockReturnValueOnce(opening.promise);
    const { result } = await renderLoaded();
    const [firstItem, secondItem] = result.current.groups[0].items;

    await act(async () => firstItem.onPress());
    await act(async () => secondItem.onPress());

    expect(openBrowser).toHaveBeenCalledTimes(1);
    expect(openBrowser).toHaveBeenCalledWith(first.url);
    expect(openUrl).not.toHaveBeenCalled();

    await act(async () => opening.resolve(DISMISSED));
    await act(async () => secondItem.onPress());

    expect(openBrowser).toHaveBeenCalledTimes(2);
    expect(openBrowser).toHaveBeenLastCalledWith(second.url);
    expect(result.current.notice).toBeNull();
  });

  it('falls back to the system browser when the in-app browser fails and reports when both fail', async () => {
    openBrowser.mockRejectedValue(new Error('unavailable'));
    const { result } = await renderLoaded();
    const item = result.current.groups[0].items[0];

    await act(async () => item.onPress());

    expect(openUrl).toHaveBeenCalledWith(first.url);
    expect(result.current.notice).toBeNull();

    openUrl.mockRejectedValueOnce(new Error('no browser'));
    await act(async () => item.onPress());
    await waitFor(() => expect(result.current.notice).toBe("Impossibile aprire l'articolo."));

    expect(result.current.status).toBe('success');
    expect(result.current.groups).toHaveLength(2);
  });

  it('aborts the request in progress when unmounted', async () => {
    const load = deferred<SectionPage>();
    getSectionArticles.mockReturnValueOnce(load.promise);
    const { unmount } = await renderHook(() => useNewsViewModel());
    const signal = getSectionArticles.mock.calls[0][1] as AbortSignal;

    await unmount();

    expect(signal.aborted).toBe(true);
  });
});
