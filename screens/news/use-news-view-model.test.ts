import { act, renderHook, waitFor } from '@testing-library/react-native';

import {
  NewsError,
  type Article,
  type NewsErrorKind,
  type NewsGroup,
  type NewsPage,
  type NewsPageCursor,
  type SavedNews,
} from '@/domain/models/news-model';
import {
  INITIAL_NEWS_STATE,
  reduceNewsState,
  useNewsViewModel,
  type NewsAction,
  type NewsState,
  type NewsUseCases,
} from '@/screens/news/use-news-view-model';

// Keeps the data layer out of the tests; the hook receives fake use cases instead.
jest.mock('@/container', () => ({
  newsUseCases: { loadSectionNews: jest.fn(), loadMoreNews: jest.fn(), openArticle: jest.fn() },
}));

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

type LoadSectionNewsRequest = Parameters<NewsUseCases['loadSectionNews']>[0];
type LoadSectionNewsResult = Awaited<ReturnType<NewsUseCases['loadSectionNews']>>;
type LoadMoreNewsRequest = Parameters<NewsUseCases['loadMoreNews']>[0];
type LoadMoreNewsResult = Awaited<ReturnType<NewsUseCases['loadMoreNews']>>;
type OpenArticleOutcome = Awaited<ReturnType<NewsUseCases['openArticle']>>;

function makeArticle(slug: string, sourceName = 'ANSA.it'): Article {
  const url = `https://example.com/${slug}`;
  return { id: url, title: `Title ${slug}`, url, sourceName, publishedAt: new Date('2026-09-24T12:30:00Z') };
}

const first = makeArticle('first');
const second = makeArticle('second');
const third = makeArticle('third');
const fourth = makeArticle('fourth');

const FRONT_PAGES: NewsGroup = { key: 'frontPages', articles: [first, second] };
const LATEST_ANSA: NewsGroup = { key: 'latestAnsa', articles: [third] };
const MORE_NEWS: NewsGroup = { key: 'moreNews', articles: [fourth] };

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

const failedPageState = (): NewsState =>
  reduceAll(
    [{ type: 'loadMoreStarted' }, { type: 'loadMoreFailed', error: new NewsError('network'), cursor: { page: 1 } }],
    loadedState()
  );

describe('INITIAL_NEWS_STATE', () => {
  it('starts idle on the first section, without articles, error, notice, instant, cursor or failed page', () => {
    expect(INITIAL_NEWS_STATE).toEqual({
      groups: [],
      status: 'idle',
      error: null,
      selectedSection: 'italy',
      notice: null,
      loadMoreFailed: false,
    });
  });
});

describe('reduceNewsState on the first page', () => {
  it('enters loading without articles and keeps nothing to show', () => {
    const state = reduceNewsState(INITIAL_NEWS_STATE, { type: 'loadStarted' });

    expect(state).toEqual({
      groups: [],
      status: 'loading',
      error: null,
      selectedSection: 'italy',
      notice: null,
      loadMoreFailed: false,
    });
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

    expect(state).toEqual({
      groups: [],
      status: 'error',
      error,
      selectedSection: 'italy',
      notice: null,
      loadMoreFailed: false,
    });
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

    expect(state).toEqual({
      groups: [],
      status: 'loading',
      error: null,
      selectedSection: 'usa',
      notice: null,
      loadMoreFailed: false,
    });
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

  it('takes the whole list of a page in place of the current one, moves the cursor and hides the notice', () => {
    const groups = [FRONT_PAGES, MORE_NEWS];
    const state = reduceAll(
      [{ type: 'loadMoreStarted' }, { type: 'loadMoreSucceeded', groups, cursor: { page: 2 } }],
      partialState(new NewsError('network'))
    );

    expect(state.status).toBe('success');
    expect(state.groups).toBe(groups);
    expect(state.cursor).toEqual({ page: 2 });
    expect(state.updatedAt).toBe(RECEIVED_AT);
    expect(state.error).toBeNull();
    expect(state.notice).toBeNull();
  });

  it('drops the cursor after the last page', () => {
    const fifth = makeArticle('fifth');
    const withMore = reduceAll(
      [
        { type: 'loadMoreStarted' },
        { type: 'loadMoreSucceeded', groups: [FRONT_PAGES, LATEST_ANSA, MORE_NEWS], cursor: { page: 2 } },
      ],
      loadedState()
    );
    const lastGroups = [FRONT_PAGES, LATEST_ANSA, { key: 'moreNews' as const, articles: [fourth, fifth] }];
    const state = reduceAll([{ type: 'loadMoreStarted' }, { type: 'loadMoreSucceeded', groups: lastGroups }], withMore);

    expect(withMore.cursor).toEqual({ page: 2 });
    expect(state.groups).toBe(lastGroups);
    expect(state.cursor).toBeUndefined();
    expect(state.status).toBe('success');
  });

  it('keeps the same list when the page added nothing and moves the cursor', () => {
    const loaded = loadedState();
    const state = reduceAll(
      [{ type: 'loadMoreStarted' }, { type: 'loadMoreSucceeded', groups: loaded.groups, cursor: { page: 2 } }],
      loaded
    );

    expect(state.groups).toBe(loaded.groups);
    expect(state.cursor).toEqual({ page: 2 });
    expect(state.status).toBe('success');
  });

  it('keeps the list when a page fails, with the cursor of that page, and reports the error as notice', () => {
    const error = new NewsError('rateLimit');
    const loaded = loadedState();
    const state = reduceAll([{ type: 'loadMoreStarted' }, { type: 'loadMoreFailed', error, cursor: { page: 1 } }], loaded);

    expect(state.status).toBe('error');
    expect(state.error).toBe(error);
    expect(state.groups).toBe(loaded.groups);
    expect(state.cursor).toEqual({ page: 1 });
    expect(state.notice).toEqual({ kind: 'loadFailed', error, partial: false });
  });

  it('takes the cursor of the page that failed, to retry that page, even when it is not the current one', () => {
    const error = new NewsError('timeout');
    const state = reduceAll(
      [{ type: 'loadMoreStarted' }, { type: 'loadMoreFailed', error, cursor: { page: 3 } }],
      loadedState()
    );

    expect(state.status).toBe('error');
    expect(state.error).toBe(error);
    expect(state.groups).toEqual([FRONT_PAGES, LATEST_ANSA]);
    expect(state.cursor).toEqual({ page: 3 });
    expect(state.loadMoreFailed).toBe(true);
  });

  it('clears a previous error when a page starts and after a page succeeds', () => {
    const started = reduceNewsState(failedPageState(), { type: 'loadMoreStarted' });
    const succeeded = reduceNewsState(started, {
      type: 'loadMoreSucceeded',
      groups: [FRONT_PAGES, LATEST_ANSA, MORE_NEWS],
      cursor: { page: 2 },
    });

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
      [
        { type: 'loadMoreStarted' },
        { type: 'loadMoreSucceeded', groups: [FRONT_PAGES, LATEST_ANSA, MORE_NEWS], cursor: { page: 2 } },
      ],
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

describe('reduceNewsState on a failed page of more news', () => {
  it('marks the failed page until the next page starts', () => {
    const failed = failedPageState();
    const started = reduceNewsState(failed, { type: 'loadMoreStarted' });

    expect(failed.loadMoreFailed).toBe(true);
    expect(started.status).toBe('loadingMore');
    expect(started.loadMoreFailed).toBe(false);
  });

  it('keeps the mark when the notice is dismissed or an article cannot be opened', () => {
    const dismissed = reduceNewsState(failedPageState(), { type: 'noticeDismissed' });
    const openFailed = reduceNewsState(dismissed, { type: 'openArticleFailed' });

    expect(dismissed.notice).toBeNull();
    expect(dismissed.loadMoreFailed).toBe(true);
    expect(openFailed.loadMoreFailed).toBe(true);
  });

  it('keeps the mark while a refresh loads and when it fails, and clears it when a refresh succeeds', () => {
    const refreshing = reduceNewsState(failedPageState(), { type: 'loadStarted' });
    const refreshFailed = reduceNewsState(refreshing, { type: 'loadFailed', error: new NewsError('timeout'), saved: null });
    const refreshed = reduceAll(
      [
        { type: 'loadStarted' },
        { type: 'loadSucceeded', groups: [FRONT_PAGES], cursor: { page: 1 }, receivedAt: RECEIVED_AT },
      ],
      refreshFailed
    );

    expect(refreshing.status).toBe('refreshing');
    expect(refreshing.loadMoreFailed).toBe(true);
    expect(refreshFailed.status).toBe('error');
    expect(refreshFailed.cursor).toEqual({ page: 1 });
    expect(refreshFailed.loadMoreFailed).toBe(true);
    expect(refreshed.status).toBe('success');
    expect(refreshed.loadMoreFailed).toBe(false);
  });

  it('clears the mark on a section change', () => {
    const state = reduceNewsState(failedPageState(), { type: 'sectionSelected', section: 'usa' });

    expect(state.loadMoreFailed).toBe(false);
  });

  it('clears the mark when a load starts without articles on screen', () => {
    const emptyPageFailed = reduceAll([
      { type: 'loadStarted' },
      {
        type: 'loadSucceeded',
        groups: [],
        cursor: { page: 1 },
        partialError: new NewsError('server'),
        receivedAt: RECEIVED_AT,
      },
      { type: 'loadMoreStarted' },
      { type: 'loadMoreFailed', error: new NewsError('network'), cursor: { page: 1 } },
    ]);
    const state = reduceNewsState(emptyPageFailed, { type: 'loadStarted' });

    expect(emptyPageFailed.loadMoreFailed).toBe(true);
    expect(state.status).toBe('loading');
    expect(state.loadMoreFailed).toBe(false);
  });

  it('clears the mark when the saved list takes the place of the list', () => {
    const refreshing = reduceNewsState(failedPageState(), { type: 'loadStarted' });
    const state = reduceNewsState(refreshing, {
      type: 'loadFailed',
      error: new NewsError('network'),
      saved: { groups: [FRONT_PAGES], savedAt: SAVED_AT },
    });

    expect(state.groups).toEqual([FRONT_PAGES]);
    expect(state.cursor).toBeUndefined();
    expect(state.loadMoreFailed).toBe(false);
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
    const state = reduceAll([{ type: 'loadMoreStarted' }, { type: 'loadMoreFailed', error, cursor: { page: 1 } }], noticed);

    expect(state.notice).toEqual({ kind: 'loadFailed', error, partial: false });
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createAbortError(): Error {
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}

const loadSectionNews = jest.fn<Promise<LoadSectionNewsResult>, [LoadSectionNewsRequest]>();
const loadMoreNews = jest.fn<Promise<LoadMoreNewsResult>, [LoadMoreNewsRequest]>();
const openArticle = jest.fn<Promise<OpenArticleOutcome>, [Article]>();
const USE_CASES: NewsUseCases = { loadSectionNews, loadMoreNews, openArticle };
const containerUseCases = jest.requireMock<{ newsUseCases: jest.Mocked<NewsUseCases> }>('@/container').newsUseCases;

const FIRST_PAGE: NewsPage = { groups: [FRONT_PAGES, LATEST_ANSA], next: { page: 1 } };
const NETWORK_MESSAGE = 'Connessione assente. Controlla la rete e riprova.';

const LIMIT_ERRORS: { kind: NewsErrorKind; message: string }[] = [
  { kind: 'quotaExhausted', message: 'Limite giornaliero di richieste raggiunto. Riprova domani.' },
  { kind: 'resultsLimit', message: 'Raggiunto il limite di notizie disponibili per questa categoria.' },
];

const loaded = (page: NewsPage): LoadSectionNewsResult => ({ ok: true, page });

const failed = (kind: NewsErrorKind, saved: SavedNews | null = null): LoadSectionNewsResult => ({
  ok: false,
  error: new NewsError(kind),
  saved,
});

const appended = (groups: NewsGroup[], cursor?: NewsPageCursor): LoadMoreNewsResult => ({ ok: true, groups, cursor });

const pageFailed = (kind: NewsErrorKind, cursor: NewsPageCursor): LoadMoreNewsResult => ({
  ok: false,
  error: new NewsError(kind),
  cursor,
});

const sectionRequest = (index: number): LoadSectionNewsRequest => loadSectionNews.mock.calls[index][0];
const moreRequest = (index: number): LoadMoreNewsRequest => loadMoreNews.mock.calls[index][0];
const pending = <T>() => new Promise<T>(() => {});

describe('useNewsViewModel', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    for (const useCases of [USE_CASES, containerUseCases]) {
      jest.mocked(useCases.loadSectionNews).mockImplementation(pending);
      jest.mocked(useCases.loadMoreNews).mockImplementation(pending);
      jest.mocked(useCases.openArticle).mockResolvedValue('opened');
    }
  });

  async function renderLoaded(page: NewsPage = FIRST_PAGE) {
    loadSectionNews.mockResolvedValueOnce(loaded(page));
    const rendered = await renderHook(() => useNewsViewModel(USE_CASES));
    await waitFor(() => expect(rendered.result.current.status).toBe('success'));
    return rendered;
  }

  it('loads the first section at start, without articles on screen, and exposes the list ready to render', async () => {
    const load = deferred<LoadSectionNewsResult>();
    loadSectionNews.mockReturnValueOnce(load.promise);

    const { result } = await renderHook(() => useNewsViewModel(USE_CASES));

    expect(result.current.status).toBe('loading');
    expect(result.current.groups).toEqual([]);
    expect(result.current.updatedAtLabel).toBeUndefined();
    expect(loadSectionNews).toHaveBeenCalledTimes(1);
    expect(sectionRequest(0)).toEqual({ section: 'italy', hasArticles: false, signal: expect.any(AbortSignal) });
    expect(sectionRequest(0).signal?.aborted).toBe(false);

    await act(async () => load.resolve(loaded(FIRST_PAGE)));

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
    expect(loadMoreNews).not.toHaveBeenCalled();
  });

  it('keeps the same card groups between renders that change nothing', async () => {
    const { result, rerender } = await renderLoaded();
    const groups = result.current.groups;
    const sectionOptions = result.current.sectionOptions;

    await rerender(undefined);

    expect(result.current.groups).toBe(groups);
    expect(result.current.sectionOptions).toBe(sectionOptions);
    expect(loadSectionNews).toHaveBeenCalledTimes(1);
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

  it('enters the error state with the message when the first page fails without a saved list', async () => {
    loadSectionNews.mockResolvedValueOnce(failed('timeout'));

    const { result } = await renderHook(() => useNewsViewModel(USE_CASES));
    await waitFor(() => expect(result.current.status).toBe('error'));

    expect(result.current.groups).toEqual([]);
    expect(result.current.errorMessage).toBe('Il server non risponde. Riprova.');
    expect(result.current.notice).toBeNull();
    expect(result.current.updatedAtLabel).toBeUndefined();
    expect(result.current.hasMore).toBe(false);
  });

  it.each(LIMIT_ERRORS)(
    'shows the $kind message in the error state when the first page fails without a saved list',
    async ({ kind, message }) => {
      loadSectionNews.mockResolvedValueOnce(failed(kind));

      const { result } = await renderHook(() => useNewsViewModel(USE_CASES));
      await waitFor(() => expect(result.current.status).toBe('error'));

      expect(result.current.errorMessage).toBe(message);
      expect(result.current.notice).toBeNull();
    }
  );

  it.each(LIMIT_ERRORS)(
    'reports a $kind error inside the partial notice of a first page and alone for a failed page of more news',
    async ({ kind, message }) => {
      const { result } = await renderLoaded({ groups: [FRONT_PAGES], next: { page: 1 }, partialError: new NewsError(kind) });

      expect(result.current.notice).toBe(`Alcune notizie non sono state caricate. ${message}`);
      expect(result.current.errorMessage).toBe(message);

      loadMoreNews.mockResolvedValueOnce(pageFailed(kind, { page: 1 }));
      await act(async () => result.current.loadMore());
      await waitFor(() => expect(result.current.status).toBe('error'));

      expect(result.current.notice).toBe(message);
      expect(result.current.errorMessage).toBe(message);
      expect(result.current.groups).toHaveLength(1);
    }
  );

  it('shows the message of an unknown error', async () => {
    loadSectionNews.mockResolvedValueOnce(failed('unknown'));

    const { result } = await renderHook(() => useNewsViewModel(USE_CASES));
    await waitFor(() => expect(result.current.status).toBe('error'));

    expect(result.current.errorMessage).toBe('Si è verificato un errore imprevisto.');
  });

  it('shows the saved list that comes with the error, with its save instant and the error as notice', async () => {
    loadSectionNews.mockResolvedValueOnce(failed('network', { groups: [FRONT_PAGES, LATEST_ANSA], savedAt: SAVED_AT }));

    const { result } = await renderHook(() => useNewsViewModel(USE_CASES));
    await waitFor(() => expect(result.current.status).toBe('error'));

    expect(result.current.groups.map((group) => group.title)).toEqual(['Prime pagine', 'Ultime da ANSA']);
    expect(result.current.updatedAtLabel).toBe('Aggiornato il 29 set 2026, 10:00');
    expect(result.current.notice).toBe(NETWORK_MESSAGE);
    expect(result.current.errorMessage).toBe(NETWORK_MESSAGE);
    expect(result.current.hasMore).toBe(false);
  });

  it('refreshes the selected section with the articles on screen, keeping them, and ignores a second refresh meanwhile', async () => {
    const { result } = await renderLoaded();
    const refresh = deferred<LoadSectionNewsResult>();
    loadSectionNews.mockReturnValueOnce(refresh.promise);

    await act(async () => result.current.refresh());

    expect(result.current.status).toBe('refreshing');
    expect(result.current.groups).toHaveLength(2);
    expect(loadSectionNews).toHaveBeenCalledTimes(2);
    expect(sectionRequest(1)).toEqual({ section: 'italy', hasArticles: true, signal: expect.any(AbortSignal) });

    await act(async () => result.current.refresh());

    expect(loadSectionNews).toHaveBeenCalledTimes(2);

    await act(async () => refresh.resolve(loaded({ groups: [LATEST_ANSA], next: { page: 1 } })));

    expect(result.current.status).toBe('success');
    expect(result.current.groups.map((group) => group.key)).toEqual(['latestAnsa']);
  });

  it('keeps the list and the cursor after a failed refresh, reports it as notice and still loads the next page', async () => {
    const { result } = await renderLoaded();
    loadSectionNews.mockResolvedValueOnce(failed('network'));

    await act(async () => result.current.refresh());
    await waitFor(() => expect(result.current.status).toBe('error'));

    expect(result.current.groups).toHaveLength(2);
    expect(result.current.notice).toBe(NETWORK_MESSAGE);
    expect(result.current.hasMore).toBe(true);

    loadMoreNews.mockResolvedValueOnce(appended([FRONT_PAGES, LATEST_ANSA, MORE_NEWS], { page: 2 }));
    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.status).toBe('success'));

    expect(loadMoreNews).toHaveBeenCalledTimes(1);
    expect(moreRequest(0)).toEqual({
      section: 'italy',
      groups: [FRONT_PAGES, LATEST_ANSA],
      cursor: { page: 1 },
      signal: expect.any(AbortSignal),
    });
    expect(moreRequest(0).groups).toBe(FIRST_PAGE.groups);
    expect(result.current.groups.map((group) => [group.key, group.title])).toEqual([
      ['frontPages', 'Prime pagine'],
      ['latestAnsa', 'Ultime da ANSA'],
      ['moreNews', 'Altre notizie'],
    ]);
    expect(result.current.notice).toBeNull();
    expect(result.current.hasMore).toBe(true);
  });

  it('changes section: drops the list, aborts the previous request and loads the new section without articles', async () => {
    const { result } = await renderLoaded();
    const firstSignal = sectionRequest(0).signal;
    const usa = deferred<LoadSectionNewsResult>();
    loadSectionNews.mockReturnValueOnce(usa.promise);

    await act(async () => result.current.selectSection('usa'));

    expect(result.current.status).toBe('loading');
    expect(result.current.selectedSection).toBe('usa');
    expect(result.current.groups).toEqual([]);
    expect(result.current.updatedAtLabel).toBeUndefined();
    expect(firstSignal?.aborted).toBe(true);
    expect(sectionRequest(1)).toEqual({ section: 'usa', hasArticles: false, signal: expect.any(AbortSignal) });
    expect(sectionRequest(1).signal?.aborted).toBe(false);

    await act(async () => usa.resolve(loaded({ groups: [{ key: 'topHeadlines', articles: [first] }], next: { page: 1 } })));

    expect(result.current.groups.map((group) => group.title)).toEqual(['Notizie principali']);
  });

  it('ignores the selection of the section already selected', async () => {
    const { result } = await renderLoaded();

    await act(async () => result.current.selectSection('italy'));

    expect(loadSectionNews).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('success');
  });

  it('discards the outcome of a request overtaken by a section change', async () => {
    const italy = deferred<LoadSectionNewsResult>();
    loadSectionNews.mockReturnValueOnce(italy.promise);
    const { result } = await renderHook(() => useNewsViewModel(USE_CASES));
    const usa = deferred<LoadSectionNewsResult>();
    loadSectionNews.mockReturnValueOnce(usa.promise);

    await act(async () => result.current.selectSection('usa'));
    await act(async () => italy.resolve(loaded(FIRST_PAGE)));

    expect(sectionRequest(0).signal?.aborted).toBe(true);
    expect(result.current.status).toBe('loading');
    expect(result.current.groups).toEqual([]);

    await act(async () => usa.resolve(loaded({ groups: [{ key: 'topHeadlines', articles: [second] }] })));

    expect(result.current.status).toBe('success');
    expect(result.current.groups[0].items[0].id).toBe(second.id);
    expect(result.current.hasMore).toBe(false);
  });

  it('ignores a load whose use case rejects because a section change cancelled it', async () => {
    const italy = deferred<LoadSectionNewsResult>();
    loadSectionNews.mockReturnValueOnce(italy.promise);
    const { result } = await renderHook(() => useNewsViewModel(USE_CASES));
    const usa = deferred<LoadSectionNewsResult>();
    loadSectionNews.mockReturnValueOnce(usa.promise);

    await act(async () => result.current.selectSection('usa'));
    await act(async () => italy.reject(createAbortError()));

    expect(result.current.status).toBe('loading');
    expect(result.current.selectedSection).toBe('usa');
    expect(result.current.errorMessage).toBeNull();

    await act(async () => usa.resolve(loaded({ groups: [{ key: 'topHeadlines', articles: [second] }] })));

    expect(result.current.status).toBe('success');
    expect(result.current.groups.map((group) => group.key)).toEqual(['topHeadlines']);
  });

  it('loads more news at the end of the list and keeps the cursor to retry when a page fails', async () => {
    const { result } = await renderLoaded();
    loadMoreNews.mockResolvedValueOnce(pageFailed('rateLimit', { page: 1 }));

    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.status).toBe('error'));

    expect(result.current.notice).toBe('Troppe richieste in poco tempo. Riprova più tardi.');
    expect(result.current.groups).toHaveLength(2);
    expect(result.current.hasMore).toBe(true);

    loadMoreNews.mockResolvedValueOnce(appended([FRONT_PAGES, LATEST_ANSA, MORE_NEWS]));
    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.status).toBe('success'));

    expect(loadMoreNews.mock.calls.map(([request]) => request.cursor)).toEqual([{ page: 1 }, { page: 1 }]);
    expect(moreRequest(1).signal).not.toBe(moreRequest(0).signal);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.groups).toHaveLength(3);

    await act(async () => result.current.loadMore());

    expect(loadMoreNews).toHaveBeenCalledTimes(2);
  });

  it('asks again the page that failed with the cursor the use case gives back', async () => {
    const { result } = await renderLoaded();
    loadMoreNews.mockResolvedValueOnce(pageFailed('network', { page: 3 }));

    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.status).toBe('error'));

    expect(result.current.notice).toBe(NETWORK_MESSAGE);
    expect(result.current.loadMoreFailed).toBe(true);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.groups).toHaveLength(2);

    loadMoreNews.mockResolvedValueOnce(appended([FRONT_PAGES, LATEST_ANSA, MORE_NEWS]));
    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.status).toBe('success'));

    expect(loadMoreNews.mock.calls.map(([request]) => request.cursor)).toEqual([{ page: 1 }, { page: 3 }]);
    expect(result.current.groups).toHaveLength(3);
    expect(result.current.loadMoreFailed).toBe(false);
  });

  it('ignores more news while the first page or another page is loading', async () => {
    const load = deferred<LoadSectionNewsResult>();
    loadSectionNews.mockReturnValueOnce(load.promise);
    const { result } = await renderHook(() => useNewsViewModel(USE_CASES));

    await act(async () => result.current.loadMore());

    expect(loadMoreNews).not.toHaveBeenCalled();

    await act(async () => load.resolve(loaded(FIRST_PAGE)));
    await act(async () => result.current.loadMore());
    await act(async () => result.current.loadMore());

    expect(result.current.status).toBe('loadingMore');
    expect(loadMoreNews).toHaveBeenCalledTimes(1);
  });

  it('shows the list given back by more news as it is, without more news when no cursor comes with it', async () => {
    const { result } = await renderLoaded();
    const groups = result.current.groups;
    loadMoreNews.mockResolvedValueOnce(appended(FIRST_PAGE.groups));

    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.status).toBe('success'));

    expect(result.current.hasMore).toBe(false);
    expect(result.current.groups).toBe(groups);
    expect(result.current.notice).toBeNull();
    expect(loadMoreNews).toHaveBeenCalledTimes(1);
  });

  it('exposes a failed page of more news until its retry starts and not after the retry succeeds', async () => {
    const { result } = await renderLoaded();

    expect(result.current.loadMoreFailed).toBe(false);

    loadMoreNews.mockResolvedValueOnce(pageFailed('network', { page: 1 }));
    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.status).toBe('error'));

    expect(result.current.loadMoreFailed).toBe(true);

    const retry = deferred<LoadMoreNewsResult>();
    loadMoreNews.mockReturnValueOnce(retry.promise);
    await act(async () => result.current.loadMore());

    expect(result.current.status).toBe('loadingMore');
    expect(result.current.loadMoreFailed).toBe(false);

    await act(async () => retry.resolve(appended([FRONT_PAGES, LATEST_ANSA, MORE_NEWS], { page: 2 })));

    expect(result.current.status).toBe('success');
    expect(result.current.loadMoreFailed).toBe(false);

    loadSectionNews.mockResolvedValueOnce(failed('timeout'));
    await act(async () => result.current.refresh());
    await waitFor(() => expect(result.current.status).toBe('error'));

    expect(result.current.loadMoreFailed).toBe(false);
  });

  it('keeps a failed page of more news through a failed refresh and drops it after a successful one', async () => {
    const { result } = await renderLoaded();
    loadMoreNews.mockResolvedValueOnce(pageFailed('network', { page: 1 }));
    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.loadMoreFailed).toBe(true));

    const failedRefresh = deferred<LoadSectionNewsResult>();
    loadSectionNews.mockReturnValueOnce(failedRefresh.promise);
    await act(async () => result.current.refresh());

    expect(result.current.status).toBe('refreshing');
    expect(result.current.loadMoreFailed).toBe(false);

    await act(async () => failedRefresh.resolve(failed('timeout')));
    await waitFor(() => expect(result.current.status).toBe('error'));

    expect(result.current.loadMoreFailed).toBe(true);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.groups).toHaveLength(2);

    loadSectionNews.mockResolvedValueOnce(loaded(FIRST_PAGE));
    await act(async () => result.current.refresh());
    await waitFor(() => expect(result.current.status).toBe('success'));

    expect(result.current.loadMoreFailed).toBe(false);
  });

  it('discards a page of more news overtaken by a section change', async () => {
    const { result } = await renderLoaded();
    const more = deferred<LoadMoreNewsResult>();
    const usa = deferred<LoadSectionNewsResult>();
    loadMoreNews.mockReturnValueOnce(more.promise);
    loadSectionNews.mockReturnValueOnce(usa.promise);

    await act(async () => result.current.loadMore());
    const moreSignal = moreRequest(0).signal;
    await act(async () => result.current.selectSection('usa'));
    await act(async () => more.resolve(appended([FRONT_PAGES, LATEST_ANSA, MORE_NEWS], { page: 2 })));

    expect(moreSignal?.aborted).toBe(true);
    expect(result.current.status).toBe('loading');
    expect(result.current.selectedSection).toBe('usa');
    expect(result.current.groups).toEqual([]);

    await act(async () => usa.resolve(loaded({ groups: [{ key: 'topHeadlines', articles: [first] }] })));

    expect(result.current.status).toBe('success');
    expect(result.current.groups.map((group) => group.key)).toEqual(['topHeadlines']);
    expect(result.current.hasMore).toBe(false);
  });

  it('discards more news overtaken by a refresh when their use case rejects for the cancellation', async () => {
    const { result } = await renderLoaded();
    const more = deferred<LoadMoreNewsResult>();
    const refresh = deferred<LoadSectionNewsResult>();
    loadMoreNews.mockReturnValueOnce(more.promise);
    loadSectionNews.mockReturnValueOnce(refresh.promise);

    await act(async () => result.current.loadMore());
    const moreSignal = moreRequest(0).signal;
    await act(async () => result.current.refresh());
    await act(async () => more.reject(createAbortError()));

    expect(moreSignal?.aborted).toBe(true);
    expect(sectionRequest(1)).toEqual({ section: 'italy', hasArticles: true, signal: expect.any(AbortSignal) });
    expect(result.current.status).toBe('refreshing');
    expect(result.current.groups).toHaveLength(2);
    expect(result.current.errorMessage).toBeNull();

    await act(async () => refresh.resolve(loaded({ groups: [LATEST_ANSA], next: { page: 1 } })));

    expect(result.current.status).toBe('success');
    expect(result.current.groups.map((group) => group.key)).toEqual(['latestAnsa']);
    expect(result.current.hasMore).toBe(true);
  });

  it('opens the article of a card with the use case, without a notice when it opens or is ignored', async () => {
    const { result } = await renderLoaded();
    const [firstItem, secondItem] = result.current.groups[0].items;
    openArticle.mockResolvedValueOnce('opened').mockResolvedValueOnce('ignored');

    await act(async () => firstItem.onPress());
    await act(async () => secondItem.onPress());

    expect(openArticle.mock.calls).toEqual([[first], [second]]);
    expect(openArticle.mock.calls[0][0]).toBe(first);
    expect(result.current.notice).toBeNull();
    expect(result.current.status).toBe('success');
  });

  it('reports an article that could not be opened, keeping the list', async () => {
    const { result } = await renderLoaded();
    openArticle.mockResolvedValueOnce('failed');

    await act(async () => result.current.groups[1].items[0].onPress());
    await waitFor(() => expect(result.current.notice).toBe("Impossibile aprire l'articolo."));

    expect(openArticle.mock.calls).toEqual([[third]]);
    expect(result.current.status).toBe('success');
    expect(result.current.groups).toHaveLength(2);
    expect(result.current.errorMessage).toBeNull();
  });

  it('aborts the request in progress when unmounted', async () => {
    const { unmount } = await renderHook(() => useNewsViewModel(USE_CASES));
    const signal = sectionRequest(0).signal;

    await unmount();

    expect(signal?.aborted).toBe(true);
  });

  it('uses the news use cases of the container when it receives none', async () => {
    containerUseCases.loadSectionNews.mockResolvedValueOnce(loaded(FIRST_PAGE));
    containerUseCases.loadMoreNews.mockResolvedValueOnce(appended([FRONT_PAGES, LATEST_ANSA, MORE_NEWS]));

    const { result } = await renderHook(() => useNewsViewModel());
    await waitFor(() => expect(result.current.status).toBe('success'));
    await act(async () => result.current.groups[0].items[0].onPress());
    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.groups).toHaveLength(3));

    expect(containerUseCases.loadSectionNews).toHaveBeenCalledTimes(1);
    expect(containerUseCases.openArticle).toHaveBeenCalledWith(first);
    expect(containerUseCases.loadMoreNews).toHaveBeenCalledTimes(1);
    expect(loadSectionNews).not.toHaveBeenCalled();
    expect(loadMoreNews).not.toHaveBeenCalled();
    expect(openArticle).not.toHaveBeenCalled();
  });
});
