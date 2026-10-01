import { mapArticles } from '@/data/repositories/news-mapper';
import { newsRepository } from '@/data/repositories/news-repository';
import { NEWS_SECTION_REQUESTS } from '@/data/repositories/news-section-requests';
import everythingAnsa from '@/data/services/fixtures/everything-ansa.json';
import everythingItaly from '@/data/services/fixtures/everything-italy.json';
import everythingUs from '@/data/services/fixtures/everything-us.json';
import topHeadlinesItaly from '@/data/services/fixtures/top-headlines-italy.json';
import topHeadlinesUs from '@/data/services/fixtures/top-headlines-us.json';
import type {
  NewsApiArticleDto,
  NewsApiPageDto,
  NewsApiRequestDto,
  NewsCacheEntryDto,
} from '@/data/services/news-api-dto';
import { getArticles, NewsApiServiceError } from '@/data/services/news-api-service';
import { readEntry, writeEntry } from '@/data/services/news-cache-service';
import {
  NewsError,
  type NewsErrorKind,
  type NewsGroup,
  type NewsPageCursor,
  type NewsSectionKey,
} from '@/domain/models/news-model';

jest.mock('@/data/services/news-api-service', () => ({
  ...jest.requireActual('@/data/services/news-api-service'),
  getArticles: jest.fn(),
}));

jest.mock('@/data/services/news-cache-service', () => ({
  readEntry: jest.fn(),
  writeEntry: jest.fn(),
}));

type RequestName = 'frontPages' | 'latestAnsa' | 'topHeadlines' | 'italyMore' | 'usaMore';

// What getArticles does for a request: resolve with a page, reject with an error, or follow a promise.
type Reply = NewsApiPageDto | Error | Promise<NewsApiPageDto>;

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void };

const getArticlesMock = jest.mocked(getArticles);
const readEntryMock = jest.mocked(readEntry);
const writeEntryMock = jest.mocked(writeEntry);

const ITALY_HEADLINE_DTOS: NewsApiArticleDto[] = topHeadlinesItaly.articles;
const ANSA_DTOS: NewsApiArticleDto[] = everythingAnsa.articles;
const USA_HEADLINE_DTOS: NewsApiArticleDto[] = topHeadlinesUs.articles;
const ITALY_MORE_DTOS: NewsApiArticleDto[] = everythingItaly.articles;
const USA_MORE_DTOS: NewsApiArticleDto[] = everythingUs.articles;

const ITALY_SECTION = NEWS_SECTION_REQUESTS.italy;
const USA_SECTION = NEWS_SECTION_REQUESTS.usa;

function moreRequestOf(sectionKey: NewsSectionKey): NewsApiRequestDto {
  const more = NEWS_SECTION_REQUESTS[sectionKey].moreRequest;
  if (more === undefined) {
    throw new Error(`The ${sectionKey} section has no more-news request`);
  }
  return more.request;
}

const REQUESTS: Record<RequestName, NewsApiRequestDto> = {
  frontPages: ITALY_SECTION.requests[0].request,
  latestAnsa: ITALY_SECTION.requests[1].request,
  topHeadlines: USA_SECTION.requests[0].request,
  italyMore: moreRequestOf('italy'),
  usaMore: moreRequestOf('usa'),
};

type ServiceFailure = { label: string; error: NewsApiServiceError; kind: NewsErrorKind };

// An HTTP failure with its status and, when given, its NewsAPI code, labelled by both.
function httpFailure(status: number, code: string | undefined, kind: NewsErrorKind): ServiceFailure {
  const label = code === undefined ? `HTTP ${status} without a code` : `HTTP ${status} with code ${code}`;
  return { label, error: new NewsApiServiceError('http', { status, code }), kind };
}

const SERVICE_FAILURES: ServiceFailure[] = [
  httpFailure(400, 'parametersMissing', 'badRequest'),
  httpFailure(401, 'apiKeyInvalid', 'auth'),
  httpFailure(429, 'rateLimited', 'rateLimit'),
  httpFailure(429, 'apiKeyExhausted', 'quotaExhausted'),
  httpFailure(429, undefined, 'rateLimit'),
  httpFailure(429, 'tooManyRequests', 'rateLimit'),
  httpFailure(426, 'maximumResultsReached', 'resultsLimit'),
  httpFailure(426, undefined, 'unknown'),
  httpFailure(500, 'unexpectedError', 'server'),
  httpFailure(500, undefined, 'server'),
  httpFailure(502, undefined, 'server'),
  httpFailure(503, undefined, 'server'),
  httpFailure(504, undefined, 'server'),
  httpFailure(599, undefined, 'server'),
  httpFailure(499, undefined, 'unknown'),
  httpFailure(600, undefined, 'unknown'),
  httpFailure(401, 'apiKeyExhausted', 'quotaExhausted'),
  httpFailure(403, 'rateLimited', 'rateLimit'),
  httpFailure(400, 'maximumResultsReached', 'resultsLimit'),
  httpFailure(401, 'somethingElse', 'auth'),
  // Names of Object.prototype members, which a lookup in a plain object would find.
  httpFailure(403, 'constructor', 'unknown'),
  httpFailure(404, 'toString', 'unknown'),
  httpFailure(418, '__proto__', 'unknown'),
  { label: 'an HTTP error without status or code', error: new NewsApiServiceError('http'), kind: 'unknown' },
  {
    label: 'an invalid response',
    error: new NewsApiServiceError('invalidResponse', { status: 200 }),
    kind: 'unknown',
  },
  {
    label: 'a network failure',
    error: new NewsApiServiceError('network', { cause: new TypeError('Network request failed') }),
    kind: 'network',
  },
  { label: 'a timeout', error: new NewsApiServiceError('timeout'), kind: 'timeout' },
  { label: 'a missing key', error: new NewsApiServiceError('missingKey'), kind: 'auth' },
];

const SAVED_AT = '2026-09-27T08:00:00.000Z';
const UNKNOWN_SECTION = 'france' as unknown as NewsSectionKey;

beforeEach(() => {
  jest.resetAllMocks();
  getArticlesMock.mockRejectedValue(new Error('Unexpected call to getArticles'));
  readEntryMock.mockResolvedValue(null);
  writeEntryMock.mockResolvedValue(undefined);
});

// The name of a request of the sections, whatever its page.
function nameOf(request: NewsApiRequestDto): RequestName {
  const { page, ...withoutPage } = request;
  const key = JSON.stringify(withoutPage);
  const names = Object.keys(REQUESTS) as RequestName[];
  const name = names.find((candidate) => JSON.stringify(REQUESTS[candidate]) === key);
  if (name === undefined) {
    throw new Error(`Unexpected request ${JSON.stringify(request)}`);
  }
  return name;
}

// Makes getArticles answer every request with the reply given for its name, whatever its page.
function answer(replies: Partial<Record<RequestName, Reply>>): void {
  getArticlesMock.mockImplementation(async (request) => {
    const reply = replies[nameOf(request)];
    if (reply === undefined) {
      throw new Error(`No reply for the request ${JSON.stringify(request)}`);
    }
    if (reply instanceof Error) {
      throw reply;
    }
    return reply;
  });
}

// A page with copies of the DTOs, so that the fixtures stay as they are.
function pageOf(dtos: readonly NewsApiArticleDto[], totalResults = dtos.length): NewsApiPageDto {
  return { totalResults, articles: dtos.map((dto) => ({ ...dto })) };
}

function withRemovedTitles(dtos: readonly NewsApiArticleDto[]): NewsApiArticleDto[] {
  return dtos.map((dto) => ({ ...dto, title: '[Removed]' }));
}

function createAbortError(): Error {
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}

function defer<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the promise to reject');
}

async function newsErrorOf(promise: Promise<unknown>): Promise<NewsError> {
  const error = await rejectionOf(promise);
  expect(error).toBeInstanceOf(NewsError);
  return error as NewsError;
}

// [key, number of articles] of every group.
function shapeOf(groups: readonly NewsGroup[]): [string, number][] {
  return groups.map((group): [string, number] => [group.key, group.articles.length]);
}

function idsOf(groups: readonly NewsGroup[]): string[] {
  return groups.flatMap((group) => group.articles.map((article) => article.id));
}

// The section key and the entry of the only writeEntry call.
function savedEntry(): { sectionKey: string; entry: NewsCacheEntryDto } {
  expect(writeEntryMock).toHaveBeenCalledTimes(1);
  const [sectionKey, entry] = writeEntryMock.mock.calls[0];
  return { sectionKey, entry };
}

// The pages of the more news that a section asks, from page 1 until the cursor ends.
async function visitMorePages(sectionKey: NewsSectionKey): Promise<number[]> {
  const visited: number[] = [];
  let cursor: NewsPageCursor | undefined = { page: 1 };
  while (cursor !== undefined && visited.length < 10) {
    visited.push(cursor.page);
    const page = await newsRepository.getSectionArticles(sectionKey, undefined, cursor);
    expect(page).not.toHaveProperty('partialError');
    cursor = page.next;
  }
  return visited;
}

describe('newsRepository.getSectionArticles, first page of Italy', () => {
  it('sends the two requests of the section at once, with the caller signal and without a page', async () => {
    const frontPages = defer<NewsApiPageDto>();
    const latestAnsa = defer<NewsApiPageDto>();
    answer({ frontPages: frontPages.promise, latestAnsa: latestAnsa.promise });
    const controller = new AbortController();

    const result = newsRepository.getSectionArticles('italy', controller.signal);
    await flushPromises();

    expect(getArticlesMock.mock.calls).toEqual([
      [ITALY_SECTION.requests[0].request, controller.signal],
      [ITALY_SECTION.requests[1].request, controller.signal],
    ]);
    for (const [request, signal] of getArticlesMock.mock.calls) {
      expect(request).not.toHaveProperty('page');
      expect(signal).toBe(controller.signal);
    }

    frontPages.resolve(pageOf(ITALY_HEADLINE_DTOS));
    latestAnsa.resolve(pageOf(ANSA_DTOS));
    await expect(result).resolves.toMatchObject({ next: { page: 1 } });
  });

  it('returns the front pages and the latest ANSA articles as two groups of 27 articles, with the cursor of page 1', async () => {
    answer({ frontPages: pageOf(ITALY_HEADLINE_DTOS), latestAnsa: pageOf(ANSA_DTOS) });

    const page = await newsRepository.getSectionArticles('italy');

    expect(Object.keys(page).sort()).toEqual(['groups', 'next']);
    expect(ANSA_DTOS).toHaveLength(10);
    expect(shapeOf(page.groups)).toEqual([
      ['frontPages', 20],
      ['latestAnsa', 7],
    ]);
    expect(page.groups[0].articles).toEqual(mapArticles(ITALY_HEADLINE_DTOS));
    expect(page.groups[1].articles).toEqual(mapArticles(ANSA_DTOS));
    expect(new Set(idsOf(page.groups)).size).toBe(27);
    expect(page.next).toEqual({ page: 1 });
  });

  it('saves the article DTOs of both requests as received, with the current instant', async () => {
    const frontPages = pageOf(ITALY_HEADLINE_DTOS);
    const latestAnsa = pageOf(ANSA_DTOS);
    answer({ frontPages, latestAnsa });

    const before = Date.now();
    await newsRepository.getSectionArticles('italy');
    const after = Date.now();

    const { sectionKey, entry } = savedEntry();
    expect(sectionKey).toBe('italy');
    expect(Object.keys(entry).sort()).toEqual(['requests', 'savedAt']);
    expect(entry.requests).toHaveLength(2);
    expect(entry.requests[0]).toBe(frontPages.articles);
    expect(entry.requests[1]).toBe(latestAnsa.articles);
    expect(entry.requests[0]).toEqual(ITALY_HEADLINE_DTOS);
    expect(entry.requests[1]).toEqual(ANSA_DTOS);
    expect(entry.savedAt).toBe(new Date(entry.savedAt).toISOString());
    expect(Date.parse(entry.savedAt)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(entry.savedAt)).toBeLessThanOrEqual(after);
  });

  it('returns the page only once its entry is saved', async () => {
    answer({ frontPages: pageOf(ITALY_HEADLINE_DTOS), latestAnsa: pageOf(ANSA_DTOS) });
    const write = defer<void>();
    writeEntryMock.mockReturnValue(write.promise);
    let returned = false;

    const result = newsRepository.getSectionArticles('italy').then((page) => {
      returned = true;
      return page;
    });
    await flushPromises();

    expect(writeEntryMock).toHaveBeenCalledTimes(1);
    expect(returned).toBe(false);

    write.resolve();
    const page = await result;

    expect(returned).toBe(true);
    expect(idsOf(page.groups)).toHaveLength(27);
  });

  it('returns the page as usual when its entry cannot be saved', async () => {
    answer({ frontPages: pageOf(ITALY_HEADLINE_DTOS), latestAnsa: pageOf(ANSA_DTOS) });
    writeEntryMock.mockRejectedValue(new Error('storage write failed'));

    const page = await newsRepository.getSectionArticles('italy');

    expect(writeEntryMock).toHaveBeenCalledTimes(1);
    expect(Object.keys(page).sort()).toEqual(['groups', 'next']);
    expect(shapeOf(page.groups)).toEqual([
      ['frontPages', 20],
      ['latestAnsa', 7],
    ]);
    expect(page.next).toEqual({ page: 1 });
  });
});

describe('newsRepository.getSectionArticles, first page of USA', () => {
  it('sends the only request of the section and returns its 35 articles as the topHeadlines group', async () => {
    answer({ topHeadlines: pageOf(USA_HEADLINE_DTOS, 37) });

    const page = await newsRepository.getSectionArticles('usa');

    expect(getArticlesMock).toHaveBeenCalledTimes(1);
    expect(getArticlesMock.mock.calls[0][0]).toEqual(USA_SECTION.requests[0].request);
    expect(getArticlesMock.mock.calls[0][0]).not.toHaveProperty('page');
    expect(Object.keys(page).sort()).toEqual(['groups', 'next']);
    expect(shapeOf(page.groups)).toEqual([['topHeadlines', 35]]);
    expect(page.groups[0].articles).toEqual(mapArticles(USA_HEADLINE_DTOS));
    expect(page.next).toEqual({ page: 1 });
  });

  it('removes the source suffix from 26 of the 35 titles', async () => {
    answer({ topHeadlines: pageOf(USA_HEADLINE_DTOS, 37) });

    const page = await newsRepository.getSectionArticles('usa');

    const articles = page.groups[0].articles;
    const shortened = articles.filter((article, index) => article.title !== USA_HEADLINE_DTOS[index].title);
    expect(shortened).toHaveLength(26);
    for (const article of articles) {
      expect(article.title.toLowerCase().endsWith(` - ${article.sourceName.toLowerCase()}`)).toBe(false);
    }
  });

  it('saves the 35 article DTOs as received, with their titles unchanged', async () => {
    const topHeadlines = pageOf(USA_HEADLINE_DTOS, 37);
    answer({ topHeadlines });

    await newsRepository.getSectionArticles('usa');

    const { sectionKey, entry } = savedEntry();
    expect(sectionKey).toBe('usa');
    expect(entry.requests).toHaveLength(1);
    expect(entry.requests[0]).toBe(topHeadlines.articles);
    expect(entry.requests[0].map((dto) => dto.title)).toEqual(USA_HEADLINE_DTOS.map((dto) => dto.title));
  });
});

describe('newsRepository.getSectionArticles, groups of a complete first page', () => {
  it('leaves out the group of a request without articles and saves the page with an empty array for it', async () => {
    answer({ frontPages: pageOf(ITALY_HEADLINE_DTOS), latestAnsa: pageOf([], 0) });

    const page = await newsRepository.getSectionArticles('italy');

    expect(page).not.toHaveProperty('partialError');
    expect(shapeOf(page.groups)).toEqual([['frontPages', 20]]);
    expect(page.next).toEqual({ page: 1 });
    expect(savedEntry().entry.requests).toEqual([ITALY_HEADLINE_DTOS, []]);
  });

  it('leaves out the front pages when that request has no articles, keeping the latest ANSA group', async () => {
    answer({ frontPages: pageOf([], 0), latestAnsa: pageOf(ANSA_DTOS) });

    const page = await newsRepository.getSectionArticles('italy');

    expect(shapeOf(page.groups)).toEqual([['latestAnsa', 7]]);
    expect(savedEntry().entry.requests).toEqual([[], ANSA_DTOS]);
  });

  it('leaves out the group of a request whose articles are all removed, and saves them as received', async () => {
    const frontPages = pageOf(withRemovedTitles(ITALY_HEADLINE_DTOS));
    answer({ frontPages, latestAnsa: pageOf(ANSA_DTOS) });

    const page = await newsRepository.getSectionArticles('italy');

    expect(page).not.toHaveProperty('partialError');
    expect(shapeOf(page.groups)).toEqual([['latestAnsa', 7]]);
    expect(savedEntry().entry.requests[0]).toBe(frontPages.articles);
  });

  it('shows an article returned by both requests once, in the group of the first request', async () => {
    const repeated = ITALY_HEADLINE_DTOS[3];
    answer({ frontPages: pageOf(ITALY_HEADLINE_DTOS), latestAnsa: pageOf([repeated, ...ANSA_DTOS]) });

    const page = await newsRepository.getSectionArticles('italy');

    expect(shapeOf(page.groups)).toEqual([
      ['frontPages', 20],
      ['latestAnsa', 7],
    ]);
    expect(idsOf(page.groups.slice(0, 1))).toContain(repeated.url);
    expect(idsOf(page.groups.slice(1))).not.toContain(repeated.url);
    expect(savedEntry().entry.requests[1]).toHaveLength(11);
  });

  it('leaves out the group of a request whose articles all repeat the first group', async () => {
    answer({ frontPages: pageOf(ITALY_HEADLINE_DTOS), latestAnsa: pageOf(ITALY_HEADLINE_DTOS.slice(0, 5)) });

    const page = await newsRepository.getSectionArticles('italy');

    expect(page).not.toHaveProperty('partialError');
    expect(shapeOf(page.groups)).toEqual([['frontPages', 20]]);
    expect(savedEntry().entry.requests[1]).toHaveLength(5);
  });

  it('returns no groups and saves nothing when both requests answer without articles', async () => {
    answer({ frontPages: pageOf([], 0), latestAnsa: pageOf([], 0) });

    const page = await newsRepository.getSectionArticles('italy');

    expect(page).toStrictEqual({ groups: [], next: { page: 1 } });
    expect(writeEntryMock).not.toHaveBeenCalled();
  });
});

describe('newsRepository.getSectionArticles, partial first page', () => {
  it.each(SERVICE_FAILURES)(
    'returns the front pages with partialError $kind when the ANSA request fails with $label, saving nothing',
    async ({ error, kind }) => {
      answer({ frontPages: pageOf(ITALY_HEADLINE_DTOS), latestAnsa: error });

      const page = await newsRepository.getSectionArticles('italy');

      expect(Object.keys(page).sort()).toEqual(['groups', 'next', 'partialError']);
      expect(shapeOf(page.groups)).toEqual([['frontPages', 20]]);
      expect(page.groups[0].articles).toEqual(mapArticles(ITALY_HEADLINE_DTOS));
      expect(page.partialError).toBeInstanceOf(NewsError);
      expect(page.partialError?.kind).toBe(kind);
      expect(page.partialError?.cause).toBe(error);
      expect(page.next).toEqual({ page: 1 });
      expect(writeEntryMock).not.toHaveBeenCalled();
    }
  );

  it('returns the latest ANSA articles with the error of the front pages when that request fails', async () => {
    const error = new NewsApiServiceError('http', { status: 500, code: 'unexpectedError' });
    answer({ frontPages: error, latestAnsa: pageOf(ANSA_DTOS) });

    const page = await newsRepository.getSectionArticles('italy');

    expect(shapeOf(page.groups)).toEqual([['latestAnsa', 7]]);
    expect(page.groups[0].articles).toEqual(mapArticles(ANSA_DTOS));
    expect(page.partialError?.kind).toBe('server');
    expect(page.partialError?.cause).toBe(error);
    expect(page.next).toEqual({ page: 1 });
    expect(writeEntryMock).not.toHaveBeenCalled();
  });

  it('returns a partial page without groups when the request that succeeded has no articles', async () => {
    answer({ frontPages: new NewsApiServiceError('http', { status: 500 }), latestAnsa: pageOf([], 0) });

    const page = await newsRepository.getSectionArticles('italy');

    expect(page.groups).toEqual([]);
    expect(page.partialError).toBeInstanceOf(NewsError);
    expect(page.partialError?.kind).toBe('server');
    expect(page.next).toEqual({ page: 1 });
    expect(writeEntryMock).not.toHaveBeenCalled();
  });

  it('reports an unexpected error of a request as partialError unknown', async () => {
    const failure = new Error('Unexpected failure');
    answer({ frontPages: pageOf(ITALY_HEADLINE_DTOS), latestAnsa: failure });

    const page = await newsRepository.getSectionArticles('italy');

    expect(page.partialError?.kind).toBe('unknown');
    expect(page.partialError?.cause).toBe(failure);
    expect(writeEntryMock).not.toHaveBeenCalled();
  });
});

describe('newsRepository.getSectionArticles, failed first page', () => {
  it('rejects with the NewsError of the first request in section order, even when that request fails last', async () => {
    const frontPages = defer<NewsApiPageDto>();
    const latestAnsa = defer<NewsApiPageDto>();
    answer({ frontPages: frontPages.promise, latestAnsa: latestAnsa.promise });
    const headlinesError = new NewsApiServiceError('http', { status: 429, code: 'rateLimited' });
    const ansaError = new NewsApiServiceError('http', { status: 500, code: 'unexpectedError' });

    const outcome = newsErrorOf(newsRepository.getSectionArticles('italy'));
    latestAnsa.reject(ansaError);
    await flushPromises();
    frontPages.reject(headlinesError);
    const error = await outcome;

    expect(error.kind).toBe('rateLimit');
    expect(error.cause).toBe(headlinesError);
    expect(writeEntryMock).not.toHaveBeenCalled();
  });

  it('rejects with the NewsError of the only request of USA instead of returning a partial page', async () => {
    const failure = new NewsApiServiceError('http', { status: 401, code: 'apiKeyInvalid' });
    answer({ topHeadlines: failure });

    const error = await newsErrorOf(newsRepository.getSectionArticles('usa'));

    expect(error.kind).toBe('auth');
    expect(error.cause).toBe(failure);
    expect(writeEntryMock).not.toHaveBeenCalled();
  });

  it('leaves the saved entry of a complete page untouched by a later partial or failed first page', async () => {
    answer({ frontPages: pageOf(ITALY_HEADLINE_DTOS), latestAnsa: pageOf(ANSA_DTOS) });
    await newsRepository.getSectionArticles('italy');

    const failure = new NewsApiServiceError('network', { cause: new TypeError('Network request failed') });
    answer({ frontPages: pageOf(ITALY_HEADLINE_DTOS), latestAnsa: failure });
    const partial = await newsRepository.getSectionArticles('italy');
    answer({ frontPages: failure, latestAnsa: failure });
    const error = await newsErrorOf(newsRepository.getSectionArticles('italy'));

    expect(partial.partialError?.kind).toBe('network');
    expect(error.kind).toBe('network');
    expect(writeEntryMock).toHaveBeenCalledTimes(1);
  });
});

describe('newsRepository.getSectionArticles, cancellation', () => {
  it('rethrows unchanged the AbortError of a request cancelled after the other one succeeded, saving nothing', async () => {
    const controller = new AbortController();
    const latestAnsa = defer<NewsApiPageDto>();
    answer({ frontPages: pageOf(ITALY_HEADLINE_DTOS), latestAnsa: latestAnsa.promise });

    const outcome = rejectionOf(newsRepository.getSectionArticles('italy', controller.signal));
    await flushPromises();
    const abortError = createAbortError();
    controller.abort();
    latestAnsa.reject(abortError);
    const error = await outcome;

    expect(error).toBe(abortError);
    expect(error).not.toBeInstanceOf(NewsError);
    expect(writeEntryMock).not.toHaveBeenCalled();
  });

  it('rethrows unchanged an error named AbortError even when the other request succeeded', async () => {
    const abortError = createAbortError();
    answer({ frontPages: abortError, latestAnsa: pageOf(ANSA_DTOS) });

    const error = await rejectionOf(newsRepository.getSectionArticles('italy'));

    expect(error).toBe(abortError);
    expect(writeEntryMock).not.toHaveBeenCalled();
  });

  it('rethrows unchanged the error of the first request when the caller signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const first = createAbortError();
    answer({ frontPages: first, latestAnsa: createAbortError() });

    const error = await rejectionOf(newsRepository.getSectionArticles('italy', controller.signal));

    expect(error).toBe(first);
    expect(error).not.toBeInstanceOf(NewsError);
    expect(writeEntryMock).not.toHaveBeenCalled();
  });

  it('rethrows unchanged an error that is not a service error once the caller has aborted, whatever its name', async () => {
    const controller = new AbortController();
    controller.abort();
    const failure = new TypeError('Network request failed');
    answer({ frontPages: failure, latestAnsa: pageOf(ANSA_DTOS) });

    const error = await rejectionOf(newsRepository.getSectionArticles('italy', controller.signal));

    expect(error).toBe(failure);
    expect(writeEntryMock).not.toHaveBeenCalled();
  });

  it('rethrows the AbortError of the first request even when the second one failed', async () => {
    const abortError = createAbortError();
    answer({ frontPages: abortError, latestAnsa: new NewsApiServiceError('http', { status: 500 }) });

    const error = await rejectionOf(newsRepository.getSectionArticles('italy'));

    expect(error).toBe(abortError);
    expect(writeEntryMock).not.toHaveBeenCalled();
  });
});

describe('newsRepository.getSectionArticles with a cursor', () => {
  it('asks page 1 of the Italy more-news request alone, without a page, and returns one moreNews group', async () => {
    answer({ italyMore: pageOf(ITALY_MORE_DTOS, 25085) });
    const controller = new AbortController();

    const page = await newsRepository.getSectionArticles('italy', controller.signal, { page: 1 });

    expect(getArticlesMock).toHaveBeenCalledTimes(1);
    const [request, signal] = getArticlesMock.mock.calls[0];
    expect(request).toEqual(REQUESTS.italyMore);
    expect(request).not.toHaveProperty('page');
    expect(signal).toBe(controller.signal);
    expect(Object.keys(page).sort()).toEqual(['groups', 'next']);
    expect(shapeOf(page.groups)).toEqual([['moreNews', 16]]);
    expect(page.groups[0].articles).toEqual(mapArticles(ITALY_MORE_DTOS));
    expect(page.next).toEqual({ page: 2 });
    expect(writeEntryMock).not.toHaveBeenCalled();
    expect(readEntryMock).not.toHaveBeenCalled();
  });

  it('asks page 1 of the USA more-news request alone and returns its 20 articles as one moreNews group', async () => {
    answer({ usaMore: pageOf(USA_MORE_DTOS, 5000) });

    const page = await newsRepository.getSectionArticles('usa', undefined, { page: 1 });

    expect(getArticlesMock.mock.calls.map(([request]) => request)).toEqual([REQUESTS.usaMore]);
    expect(shapeOf(page.groups)).toEqual([['moreNews', 20]]);
    expect(page.groups[0].articles).toEqual(mapArticles(USA_MORE_DTOS));
    expect(page.next).toEqual({ page: 2 });
  });

  it.each([
    {
      sectionKey: 'italy' as const,
      replies: { italyMore: pageOf(ITALY_MORE_DTOS, 100000) },
      request: REQUESTS.italyMore,
    },
    {
      sectionKey: 'usa' as const,
      replies: { usaMore: pageOf(USA_MORE_DTOS, 100000) },
      request: REQUESTS.usaMore,
    },
  ])(
    'asks the pages 2 to 5 of the $sectionKey more news by number and stops after page 5, at 100 results',
    async ({ sectionKey, replies, request }) => {
      answer(replies);

      await expect(visitMorePages(sectionKey)).resolves.toEqual([1, 2, 3, 4, 5]);

      expect(getArticlesMock.mock.calls.map(([sent]) => sent)).toEqual([
        request,
        { ...request, page: 2 },
        { ...request, page: 3 },
        { ...request, page: 4 },
        { ...request, page: 5 },
      ]);
      expect(writeEntryMock).not.toHaveBeenCalled();
    }
  );

  it('gives no cursor after page 5 even when many more results remain', async () => {
    answer({ usaMore: pageOf(USA_MORE_DTOS, 100000) });

    const page = await newsRepository.getSectionArticles('usa', undefined, { page: 5 });

    expect(getArticlesMock.mock.calls[0][0]).toEqual({ ...REQUESTS.usaMore, page: 5 });
    expect(shapeOf(page.groups)).toEqual([['moreNews', 20]]);
    expect(page).not.toHaveProperty('next');
  });

  it.each([
    { totalResults: 45, pages: [1, 2, 3] },
    { totalResults: 21, pages: [1, 2] },
    { totalResults: 20, pages: [1] },
  ])('asks the pages $pages of a more-news request with $totalResults results', async ({ totalResults, pages }) => {
    answer({ italyMore: pageOf(ITALY_MORE_DTOS, totalResults) });

    await expect(visitMorePages('italy')).resolves.toEqual(pages);
  });

  it('returns no groups and no cursor when the more-news request has no results', async () => {
    answer({ italyMore: pageOf([], 0) });

    await expect(newsRepository.getSectionArticles('italy', undefined, { page: 1 })).resolves.toStrictEqual({ groups: [] });
  });

  it('returns no groups but the next cursor for a page without articles while results remain', async () => {
    answer({ italyMore: pageOf([], 25085) });

    await expect(newsRepository.getSectionArticles('italy', undefined, { page: 1 })).resolves.toStrictEqual({
      groups: [],
      next: { page: 2 },
    });
  });

  it('returns no groups for a page whose articles are all removed', async () => {
    answer({ usaMore: pageOf(withRemovedTitles(USA_MORE_DTOS), 20) });

    await expect(newsRepository.getSectionArticles('usa', undefined, { page: 1 })).resolves.toStrictEqual({ groups: [] });
  });

  it.each(SERVICE_FAILURES)(
    'rejects with NewsError $kind when the more-news request fails with $label',
    async ({ error, kind }) => {
      answer({ italyMore: error });

      const newsError = await newsErrorOf(newsRepository.getSectionArticles('italy', undefined, { page: 3 }));

      expect(newsError.kind).toBe(kind);
      expect(newsError.cause).toBe(error);
      expect(getArticlesMock.mock.calls.map(([request]) => request)).toEqual([{ ...REQUESTS.italyMore, page: 3 }]);
      expect(writeEntryMock).not.toHaveBeenCalled();
    }
  );

  it('rethrows unchanged the AbortError of a cancelled more-news request', async () => {
    const controller = new AbortController();
    const more = defer<NewsApiPageDto>();
    answer({ italyMore: more.promise });

    const outcome = rejectionOf(newsRepository.getSectionArticles('italy', controller.signal, { page: 2 }));
    await flushPromises();
    const abortError = createAbortError();
    controller.abort();
    more.reject(abortError);
    const error = await outcome;

    expect(error).toBe(abortError);
    expect(error).not.toBeInstanceOf(NewsError);
  });

  it('still reports a service error as a NewsError when the caller aborts before it is handled', async () => {
    const controller = new AbortController();
    const more = defer<NewsApiPageDto>();
    answer({ italyMore: more.promise });
    const failure = new NewsApiServiceError('http', { status: 500, code: 'unexpectedError' });

    const outcome = newsErrorOf(newsRepository.getSectionArticles('italy', controller.signal, { page: 2 }));
    more.reject(failure);
    controller.abort();
    const error = await outcome;

    expect(error.kind).toBe('server');
    expect(error.cause).toBe(failure);
  });
});

describe('newsRepository.getSavedSectionArticles', () => {
  it('returns null when the section has no saved entry', async () => {
    await expect(newsRepository.getSavedSectionArticles('italy')).resolves.toBeNull();

    expect(readEntryMock).toHaveBeenCalledTimes(1);
    expect(readEntryMock).toHaveBeenCalledWith('italy');
  });

  it('restores the saved Italy entry as its two groups, in section order, with savedAt as a Date', async () => {
    readEntryMock.mockResolvedValue({ savedAt: SAVED_AT, requests: [ITALY_HEADLINE_DTOS, ANSA_DTOS] });

    const saved = await newsRepository.getSavedSectionArticles('italy');

    expect(saved).toEqual({
      groups: [
        { key: 'frontPages', articles: mapArticles(ITALY_HEADLINE_DTOS) },
        { key: 'latestAnsa', articles: mapArticles(ANSA_DTOS) },
      ],
      savedAt: new Date(SAVED_AT),
    });
    expect(saved?.savedAt).toBeInstanceOf(Date);
    expect(readEntryMock).toHaveBeenCalledWith('italy');
    expect(getArticlesMock).not.toHaveBeenCalled();
    expect(writeEntryMock).not.toHaveBeenCalled();
  });

  it('restores the saved USA entry as the topHeadlines group', async () => {
    readEntryMock.mockResolvedValue({ savedAt: SAVED_AT, requests: [USA_HEADLINE_DTOS] });

    await expect(newsRepository.getSavedSectionArticles('usa')).resolves.toEqual({
      groups: [{ key: 'topHeadlines', articles: mapArticles(USA_HEADLINE_DTOS) }],
      savedAt: new Date(SAVED_AT),
    });
    expect(getArticlesMock).not.toHaveBeenCalled();
  });

  it('restores the groups of the complete first page it saved', async () => {
    answer({ frontPages: pageOf(ITALY_HEADLINE_DTOS), latestAnsa: pageOf(ANSA_DTOS) });
    const page = await newsRepository.getSectionArticles('italy');
    const { entry } = savedEntry();
    readEntryMock.mockResolvedValue(entry);

    const saved = await newsRepository.getSavedSectionArticles('italy');

    expect(saved?.groups).toEqual(page.groups);
    expect(saved?.savedAt.toISOString()).toBe(entry.savedAt);
  });

  it('returns null when savedAt is not an ISO date-time', async () => {
    for (const savedAt of ['yesterday', '2026-09-27', '']) {
      readEntryMock.mockResolvedValueOnce({ savedAt, requests: [ITALY_HEADLINE_DTOS, ANSA_DTOS] });

      await expect(newsRepository.getSavedSectionArticles('italy')).resolves.toBeNull();
    }
  });

  it('returns null when the entry has another number of request arrays than the section', async () => {
    const cases: { sectionKey: NewsSectionKey; requests: NewsApiArticleDto[][] }[] = [
      { sectionKey: 'italy', requests: [ITALY_HEADLINE_DTOS] },
      { sectionKey: 'italy', requests: [ITALY_HEADLINE_DTOS, ANSA_DTOS, ANSA_DTOS] },
      { sectionKey: 'usa', requests: [] },
      { sectionKey: 'usa', requests: [USA_HEADLINE_DTOS, ANSA_DTOS] },
    ];
    for (const { sectionKey, requests } of cases) {
      readEntryMock.mockResolvedValueOnce({ savedAt: SAVED_AT, requests });

      await expect(newsRepository.getSavedSectionArticles(sectionKey)).resolves.toBeNull();
    }
  });

  it('returns null when no saved article survives the mapping', async () => {
    readEntryMock.mockResolvedValueOnce({ savedAt: SAVED_AT, requests: [[], []] });
    await expect(newsRepository.getSavedSectionArticles('italy')).resolves.toBeNull();

    readEntryMock.mockResolvedValueOnce({
      savedAt: SAVED_AT,
      requests: [withRemovedTitles(ITALY_HEADLINE_DTOS), withRemovedTitles(ANSA_DTOS)],
    });
    await expect(newsRepository.getSavedSectionArticles('italy')).resolves.toBeNull();
  });

  it('drops the saved items that are not valid articles and leaves out a group left without articles', async () => {
    const requests = [
      [null, 42, 'text', { title: 'No URL' }, { ...ITALY_HEADLINE_DTOS[0], title: '[Removed]' }],
      [null, ANSA_DTOS[0], { title: 'No URL' }, { ...ANSA_DTOS[1], source: null }],
    ] as unknown as NewsApiArticleDto[][];
    readEntryMock.mockResolvedValue({ savedAt: SAVED_AT, requests });

    const saved = await newsRepository.getSavedSectionArticles('italy');

    expect(shapeOf(saved?.groups ?? [])).toEqual([['latestAnsa', 2]]);
    expect(saved?.groups[0].articles[0].id).toBe(ANSA_DTOS[0].url);
    expect(saved?.groups[0].articles[1].sourceName).toBe('ansa.it');
    expect(saved?.savedAt).toEqual(new Date(SAVED_AT));
  });
});

describe('an unknown section', () => {
  it('makes getSectionArticles reject before asking anything', async () => {
    await expect(newsRepository.getSectionArticles(UNKNOWN_SECTION)).rejects.toThrow('Unknown news section: france');
    await expect(newsRepository.getSectionArticles(UNKNOWN_SECTION, undefined, { page: 1 })).rejects.toThrow(
      'Unknown news section: france'
    );

    expect(getArticlesMock).not.toHaveBeenCalled();
  });

  it('makes getSavedSectionArticles reject before reading the storage', async () => {
    await expect(newsRepository.getSavedSectionArticles(UNKNOWN_SECTION)).rejects.toThrow('Unknown news section: france');

    expect(readEntryMock).not.toHaveBeenCalled();
  });

  it('treats the name of an Object.prototype member as an unknown section', async () => {
    for (const name of ['constructor', 'toString', '__proto__']) {
      const sectionKey = name as unknown as NewsSectionKey;

      await expect(newsRepository.getSectionArticles(sectionKey)).rejects.toThrow(`Unknown news section: ${name}`);
      await expect(newsRepository.getSectionArticles(sectionKey, undefined, { page: 1 })).rejects.toThrow(
        `Unknown news section: ${name}`
      );
      await expect(newsRepository.getSavedSectionArticles(sectionKey)).rejects.toThrow(`Unknown news section: ${name}`);
    }

    expect(getArticlesMock).not.toHaveBeenCalled();
    expect(readEntryMock).not.toHaveBeenCalled();
  });
});
