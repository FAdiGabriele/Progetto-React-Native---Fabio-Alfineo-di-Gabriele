import { NETWORK_RETRY_DELAY_MS, REQUEST_TIMEOUT_MS } from '@/data/config';
import everythingAnsa from '@/data/services/fixtures/everything-ansa.json';
import topHeadlinesItaly from '@/data/services/fixtures/top-headlines-italy.json';
import topHeadlinesUs from '@/data/services/fixtures/top-headlines-us.json';
import type { NewsApiRequestDto } from '@/data/services/news-api-dto';
import { getArticles, NewsApiServiceError } from '@/data/services/news-api-service';

jest.mock('@/data/config', () => ({
  ...jest.requireActual('@/data/config'),
  NEWS_API_KEY: 'test-key',
  IS_NEWS_API_KEY_CONFIGURED: true,
}));

type FakeResponse = { status: number; ok: boolean; text: () => Promise<string> };

type FetchInit = { method: string; headers: Record<string, string>; signal: AbortSignal };

type FetchOutcome = FakeResponse | Error | 'pending';

type NewsApiService = typeof import('@/data/services/news-api-service');

type FixtureService = typeof import('@/data/services/news-fixture-service');

type ServiceConfig = { NEWS_API_KEY: string; IS_NEWS_API_KEY_CONFIGURED: boolean };

const ITALY_FRONT_PAGES: NewsApiRequestDto = {
  endpoint: 'top-headlines',
  sources: ['la-repubblica', 'il-sole-24-ore'],
  pageSize: 50,
};

const ITALY_LATEST_ANSA: NewsApiRequestDto = {
  endpoint: 'everything',
  domains: ['ansa.it'],
  language: 'it',
  sortBy: 'publishedAt',
  pageSize: 10,
};

const USA_TOP_HEADLINES: NewsApiRequestDto = { endpoint: 'top-headlines', country: 'us', pageSize: 50 };

const ITALY_MORE_NEWS: NewsApiRequestDto = {
  endpoint: 'everything',
  domains: ['ansa.it', 'repubblica.it', 'ilsole24ore.com'],
  language: 'it',
  sortBy: 'publishedAt',
  pageSize: 20,
};

const USA_MORE_NEWS: NewsApiRequestDto = {
  endpoint: 'everything',
  domains: [
    'apnews.com',
    'reuters.com',
    'cnn.com',
    'foxnews.com',
    'nbcnews.com',
    'abcnews.go.com',
    'cbsnews.com',
    'msnbc.com',
    'npr.org',
    'cnbc.com',
    'washingtonpost.com',
    'wsj.com',
    'usatoday.com',
    'bloomberg.com',
    'politico.com',
    'thehill.com',
    'time.com',
    'newsweek.com',
    'axios.com',
    'businessinsider.com',
    'techcrunch.com',
    'theverge.com',
  ],
  language: 'en',
  sortBy: 'publishedAt',
  pageSize: 20,
};

const ITALY_FRONT_PAGES_URL =
  'https://newsapi.org/v2/top-headlines?sources=la-repubblica,il-sole-24-ore&pageSize=50';
const ITALY_LATEST_ANSA_URL =
  'https://newsapi.org/v2/everything?domains=ansa.it&language=it&sortBy=publishedAt&pageSize=10';
const USA_TOP_HEADLINES_URL = 'https://newsapi.org/v2/top-headlines?country=us&pageSize=50';
const ITALY_MORE_NEWS_URL =
  'https://newsapi.org/v2/everything?domains=ansa.it,repubblica.it,ilsole24ore.com' +
  '&language=it&sortBy=publishedAt&pageSize=20';
const USA_MORE_NEWS_URL =
  'https://newsapi.org/v2/everything?domains=apnews.com,reuters.com,cnn.com,foxnews.com,nbcnews.com,' +
  'abcnews.go.com,cbsnews.com,msnbc.com,npr.org,cnbc.com,washingtonpost.com,wsj.com,usatoday.com,' +
  'bloomberg.com,politico.com,thehill.com,time.com,newsweek.com,axios.com,businessinsider.com,' +
  'techcrunch.com,theverge.com&language=en&sortBy=publishedAt&pageSize=20';

const EMPTY_PAGE_BODY = { status: 'ok', totalResults: 0, articles: [] };

const WITH_KEY: ServiceConfig = { NEWS_API_KEY: 'test-key', IS_NEWS_API_KEY_CONFIGURED: true };
const WITHOUT_KEY: ServiceConfig = { NEWS_API_KEY: '', IS_NEWS_API_KEY_CONFIGURED: false };

const fetchMock = jest.fn<Promise<FakeResponse>, [string, FetchInit]>();
// The errors the fake fetch rejected with because its signal was aborted, in order.
const abortErrors: Error[] = [];
const originalFetch = globalThis.fetch;
const originalUseFixtures = process.env.EXPO_PUBLIC_NEWS_USE_FIXTURES;

beforeEach(() => {
  fetchMock.mockReset();
  abortErrors.length = 0;
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  setUseFixtures(originalUseFixtures);
  jest.restoreAllMocks();
});

function setUseFixtures(value: string | undefined): void {
  if (value === undefined) {
    delete process.env.EXPO_PUBLIC_NEWS_USE_FIXTURES;
  } else {
    process.env.EXPO_PUBLIC_NEWS_USE_FIXTURES = value;
  }
}

function textResponse(body: string, status = 200): FakeResponse {
  return { status, ok: status >= 200 && status < 300, text: async () => body };
}

function jsonResponse(body: unknown, status = 200): FakeResponse {
  return textResponse(JSON.stringify(body), status);
}

function errorResponse(status: number, code: string, message: string): FakeResponse {
  return jsonResponse({ status: 'error', code, message }, status);
}

// Settles the n-th fetch call with the n-th outcome, repeating the last one. Like fetch, a call
// rejects with an AbortError when its signal is already aborted or aborts while it is pending.
function mockFetch(...outcomes: FetchOutcome[]): void {
  let calls = 0;
  fetchMock.mockImplementation((url, init) => {
    const outcome = outcomes[Math.min(calls, outcomes.length - 1)];
    calls += 1;
    return new Promise((resolve, reject) => {
      const rejectAsAborted = () => {
        const error = new Error('The operation was aborted.');
        error.name = 'AbortError';
        abortErrors.push(error);
        reject(error);
      };
      if (init.signal.aborted) {
        rejectAsAborted();
      } else if (outcome === 'pending') {
        init.signal.addEventListener('abort', rejectAsAborted);
      } else if (outcome instanceof Error) {
        reject(outcome);
      } else {
        resolve(outcome);
      }
    });
  });
}

function fetchCall(index: number): { url: string; init: FetchInit } {
  const [url, init] = fetchMock.mock.calls[index];
  return { url, init };
}

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the promise to reject');
}

async function serviceErrorOf(promise: Promise<unknown>): Promise<NewsApiServiceError> {
  const error = await rejectionOf(promise);
  expect(error).toBeInstanceOf(NewsApiServiceError);
  return error as NewsApiServiceError;
}

// The modules imported above keep the values of the mock at the top. `loadFixtureService` is
// called each time the fixture service is loaded, and returns the real one.
function loadServiceWith(
  values: ServiceConfig,
  useFixtures?: string
): { service: NewsApiService; loadFixtureService: jest.Mock<FixtureService, []> } {
  jest.resetModules();
  jest.doMock('@/data/config', () => ({ ...jest.requireActual('@/data/config'), ...values }));
  const loadFixtureService = jest.fn(() =>
    jest.requireActual<FixtureService>('@/data/services/news-fixture-service')
  );
  jest.doMock('@/data/services/news-fixture-service', loadFixtureService);
  setUseFixtures(useFixtures);
  const service = jest.requireActual<NewsApiService>('@/data/services/news-api-service');
  return { service, loadFixtureService };
}

describe('getArticles request', () => {
  it.each([
    { name: 'Italy front pages', request: ITALY_FRONT_PAGES, url: ITALY_FRONT_PAGES_URL },
    { name: 'latest ANSA', request: ITALY_LATEST_ANSA, url: ITALY_LATEST_ANSA_URL },
    { name: 'USA top headlines', request: USA_TOP_HEADLINES, url: USA_TOP_HEADLINES_URL },
    { name: 'Italy more news', request: ITALY_MORE_NEWS, url: ITALY_MORE_NEWS_URL },
    { name: 'USA more news', request: USA_MORE_NEWS, url: USA_MORE_NEWS_URL },
  ])('builds the URL of the $name request, lists joined by literal commas, without a page', async ({ request, url }) => {
    mockFetch(jsonResponse(EMPTY_PAGE_BODY));

    await getArticles(request);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchCall(0).url).toBe(url);
  });

  it('sends a GET with the key in the X-Api-Key header, never in the URL', async () => {
    mockFetch(jsonResponse(EMPTY_PAGE_BODY));

    await getArticles(USA_TOP_HEADLINES);

    const { url, init } = fetchCall(0);
    expect(init.method).toBe('GET');
    expect(init.headers).toEqual({ 'X-Api-Key': 'test-key', Accept: 'application/json' });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(url).not.toContain('test-key');
    expect(url.toLowerCase()).not.toContain('apikey');
  });

  it('appends the page after pageSize when the request has one', async () => {
    mockFetch(jsonResponse(EMPTY_PAGE_BODY));

    await getArticles({ ...ITALY_LATEST_ANSA, page: 2 });
    await getArticles({ ...USA_TOP_HEADLINES, page: 3 });
    await getArticles({ ...USA_MORE_NEWS, page: 5 });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `${ITALY_LATEST_ANSA_URL}&page=2`,
      `${USA_TOP_HEADLINES_URL}&page=3`,
      `${USA_MORE_NEWS_URL}&page=5`,
    ]);
  });

  it('appends page=1 when the page is 1, and no page when it is undefined', async () => {
    mockFetch(jsonResponse(EMPTY_PAGE_BODY));

    await getArticles({ ...ITALY_MORE_NEWS, page: 1 });
    await getArticles({ ...ITALY_MORE_NEWS, page: undefined });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([`${ITALY_MORE_NEWS_URL}&page=1`, ITALY_MORE_NEWS_URL]);
  });

  it('encodes every value with encodeURIComponent, keeping the commas between list items literal', async () => {
    mockFetch(jsonResponse(EMPTY_PAGE_BODY));

    await getArticles({ endpoint: 'top-headlines', country: 'u s&page=9', pageSize: 5 });
    await getArticles({ endpoint: 'top-headlines', sources: ['one source', 'two&three'], pageSize: 5 });
    await getArticles({
      endpoint: 'everything',
      domains: ['ansa.it', 'example.com/a?b'],
      language: 'it en',
      sortBy: 'publishedAt',
      pageSize: 5,
      page: 2,
    });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://newsapi.org/v2/top-headlines?country=u%20s%26page%3D9&pageSize=5',
      'https://newsapi.org/v2/top-headlines?sources=one%20source,two%26three&pageSize=5',
      'https://newsapi.org/v2/everything?domains=ansa.it,example.com%2Fa%3Fb' +
        '&language=it%20en&sortBy=publishedAt&pageSize=5&page=2',
    ]);
  });
});

describe('getArticles response', () => {
  it('returns totalResults and the articles of each fixture, without the other fields of the body', async () => {
    const cases = [
      { request: ITALY_FRONT_PAGES, body: topHeadlinesItaly },
      { request: ITALY_LATEST_ANSA, body: everythingAnsa },
      { request: USA_TOP_HEADLINES, body: topHeadlinesUs },
    ];
    for (const { request, body } of cases) {
      mockFetch(jsonResponse(body));

      const page = await getArticles(request);

      expect(page).toStrictEqual({ totalResults: body.totalResults, articles: body.articles });
    }
  });

  it('returns the 37 results and 35 articles of the USA top headlines fixture', async () => {
    mockFetch(jsonResponse(topHeadlinesUs));

    const page = await getArticles(USA_TOP_HEADLINES);

    expect(page.totalResults).toBe(37);
    expect(page.articles).toHaveLength(35);
  });

  it('returns an empty page, and drops the fields that are not part of a page', async () => {
    mockFetch(jsonResponse({ status: 'ok', totalResults: 0, articles: [], extra: true }));

    await expect(getArticles(USA_TOP_HEADLINES)).resolves.toStrictEqual({ totalResults: 0, articles: [] });
  });

  it.each([
    { name: 'a body without totalResults', body: JSON.stringify({ status: 'ok', articles: [] }) },
    { name: 'totalResults as a string', body: JSON.stringify({ status: 'ok', totalResults: '10', articles: [] }) },
    { name: 'articles that are not an array', body: JSON.stringify({ status: 'ok', totalResults: 10, articles: {} }) },
    { name: 'a body without status', body: JSON.stringify({ totalResults: 10, articles: [] }) },
    { name: 'invalid JSON', body: '{"status":"ok","totalResults":' },
    { name: 'an HTML page', body: '<!DOCTYPE html><html><body>Service temporarily unavailable</body></html>' },
    { name: 'an empty body', body: '' },
  ])('rejects $name sent with HTTP 200 with reason invalidResponse, without retrying', async ({ body }) => {
    mockFetch(textResponse(body, 200));

    const error = await serviceErrorOf(getArticles(USA_TOP_HEADLINES));

    expect(error.reason).toBe('invalidResponse');
    expect(error.status).toBe(200);
    expect(error.code).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects an error body with reason http and its status, code and message, even with HTTP 200', async () => {
    mockFetch(errorResponse(200, 'apiKeyMissing', 'Your API key is missing.'));

    const error = await serviceErrorOf(getArticles(USA_TOP_HEADLINES));

    expect(error.reason).toBe('http');
    expect(error.status).toBe(200);
    expect(error.code).toBe('apiKeyMissing');
    expect(error.message).toBe('Your API key is missing.');
  });

  it.each([
    { status: 401, code: 'apiKeyInvalid' },
    { status: 426, code: 'maximumResultsReached' },
    { status: 429, code: 'rateLimited' },
    { status: 500, code: 'unexpectedError' },
  ])('rejects HTTP $status with the error body $code with reason http, without retrying', async ({ status, code }) => {
    mockFetch(errorResponse(status, code, `Mock ${code}`));

    const error = await serviceErrorOf(getArticles(ITALY_MORE_NEWS));

    expect(error.reason).toBe('http');
    expect(error.status).toBe(status);
    expect(error.code).toBe(code);
    expect(error.message).toBe(`Mock ${code}`);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects HTTP 503 with an unparseable body with reason http, status 503, no code and the message "HTTP 503"', async () => {
    mockFetch(textResponse('<html><body>Service Unavailable</body></html>', 503));

    const error = await serviceErrorOf(getArticles(USA_TOP_HEADLINES));

    expect(error.reason).toBe('http');
    expect(error.status).toBe(503);
    expect(error.code).toBeUndefined();
    expect(error.message).toBe('HTTP 503');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('NewsApiServiceError', () => {
  it('is an Error named NewsApiServiceError with its reason, status, code and message', () => {
    const error = new NewsApiServiceError('http', { status: 429, code: 'rateLimited', message: 'Too many requests' });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('NewsApiServiceError');
    expect(error.reason).toBe('http');
    expect(error.status).toBe(429);
    expect(error.code).toBe('rateLimited');
    expect(error.message).toBe('Too many requests');
  });

  it('uses "HTTP <status>" as message for an HTTP error without one, and the reason otherwise', () => {
    expect(new NewsApiServiceError('http', { status: 503 }).message).toBe('HTTP 503');
    expect(new NewsApiServiceError('http').message).toBe('http');
    expect(new NewsApiServiceError('timeout').message).toBe('timeout');
    expect(new NewsApiServiceError('invalidResponse', { status: 200 }).message).toBe('invalidResponse');
  });

  it('sets the cause only when one is given', () => {
    const failure = new TypeError('Network request failed');

    expect(new NewsApiServiceError('network', { cause: failure }).cause).toBe(failure);
    expect('cause' in new NewsApiServiceError('network')).toBe(false);
  });
});

describe('getArticles retry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sends the retry of a network failure only after NETWORK_RETRY_DELAY_MS, to the same URL', async () => {
    mockFetch(new TypeError('Network request failed'), jsonResponse(EMPTY_PAGE_BODY));
    const result = getArticles(USA_TOP_HEADLINES);

    await jest.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(NETWORK_RETRY_DELAY_MS - 1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([USA_TOP_HEADLINES_URL, USA_TOP_HEADLINES_URL]);
    await expect(result).resolves.toStrictEqual({ totalResults: 0, articles: [] });
  });

  it('returns the page of the retry when the first attempt fails on the network', async () => {
    mockFetch(new TypeError('Network request failed'), jsonResponse(topHeadlinesUs));
    const result = getArticles(USA_TOP_HEADLINES);

    await jest.advanceTimersByTimeAsync(NETWORK_RETRY_DELAY_MS);

    await expect(result).resolves.toStrictEqual({ totalResults: 37, articles: topHeadlinesUs.articles });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('retries a network failure once, then rejects with reason network and the second failure as cause', async () => {
    const first = new TypeError('Network request failed');
    const second = new TypeError('Network request failed again');
    mockFetch(first, second);
    const outcome = serviceErrorOf(getArticles(USA_TOP_HEADLINES));

    await jest.advanceTimersByTimeAsync(NETWORK_RETRY_DELAY_MS);
    const error = await outcome;

    expect(error.reason).toBe('network');
    expect(error.cause).toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([USA_TOP_HEADLINES_URL, USA_TOP_HEADLINES_URL]);
    expect(jest.getTimerCount()).toBe(0);

    await jest.advanceTimersByTimeAsync(NETWORK_RETRY_DELAY_MS * 2);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects with reason timeout when the retry times out', async () => {
    mockFetch(new TypeError('Network request failed'), 'pending');
    const outcome = serviceErrorOf(getArticles(USA_TOP_HEADLINES));

    await jest.advanceTimersByTimeAsync(NETWORK_RETRY_DELAY_MS + REQUEST_TIMEOUT_MS);
    const error = await outcome;

    expect(error.reason).toBe('timeout');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchCall(1).init.signal.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('rejects with reason http when the retry gets an HTTP error, without a third attempt', async () => {
    mockFetch(
      new TypeError('Network request failed'),
      errorResponse(429, 'rateLimited', 'Too many requests'),
      jsonResponse(EMPTY_PAGE_BODY)
    );
    const outcome = serviceErrorOf(getArticles(USA_TOP_HEADLINES));

    await jest.advanceTimersByTimeAsync(NETWORK_RETRY_DELAY_MS * 3);
    const error = await outcome;

    expect(error).toMatchObject({ reason: 'http', status: 429, code: 'rateLimited' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each([
    { name: 'a timeout', outcome: 'pending' as const, reason: 'timeout' },
    { name: 'an HTTP error', outcome: errorResponse(500, 'unexpectedError', 'Mock unexpectedError'), reason: 'http' },
    { name: 'an invalid response', outcome: textResponse('', 200), reason: 'invalidResponse' },
  ])('rejects at once after $name, without a pause and without a retry', async ({ outcome, reason }) => {
    mockFetch(outcome, jsonResponse(EMPTY_PAGE_BODY));
    const result = serviceErrorOf(getArticles(USA_TOP_HEADLINES));

    await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);

    expect(jest.getTimerCount()).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(NETWORK_RETRY_DELAY_MS);
    const error = await result;

    expect(error.reason).toBe(reason);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('stops listening to the caller signal and leaves no timer once the pause is over', async () => {
    mockFetch(new TypeError('Network request failed'), jsonResponse(EMPTY_PAGE_BODY));
    const controller = new AbortController();
    const addListener = jest.spyOn(controller.signal, 'addEventListener');
    const removeListener = jest.spyOn(controller.signal, 'removeEventListener');
    const result = getArticles(USA_TOP_HEADLINES, controller.signal);

    await jest.advanceTimersByTimeAsync(NETWORK_RETRY_DELAY_MS);
    await expect(result).resolves.toStrictEqual({ totalResults: 0, articles: [] });

    expect(addListener).toHaveBeenCalledTimes(3);
    for (const [type, listener] of addListener.mock.calls) {
      expect(type).toBe('abort');
      expect(removeListener).toHaveBeenCalledWith('abort', listener);
    }
    expect(jest.getTimerCount()).toBe(0);

    controller.abort();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchCall(1).init.signal.aborted).toBe(false);
    expect(abortErrors).toHaveLength(0);
  });

  it('ends the pause at once when the caller aborts, rejecting with an AbortError and sending no retry', async () => {
    const failure = new TypeError('Network request failed');
    mockFetch(failure, jsonResponse(topHeadlinesUs));
    const controller = new AbortController();
    const addListener = jest.spyOn(controller.signal, 'addEventListener');
    const removeListener = jest.spyOn(controller.signal, 'removeEventListener');
    const outcome = rejectionOf(getArticles(USA_TOP_HEADLINES, controller.signal));

    await jest.advanceTimersByTimeAsync(NETWORK_RETRY_DELAY_MS - 1);
    controller.abort();

    expect(jest.getTimerCount()).toBe(0);

    await jest.advanceTimersByTimeAsync(NETWORK_RETRY_DELAY_MS);
    const error = await outcome;

    expect(error).toBeInstanceOf(Error);
    expect(error).toHaveProperty('name', 'AbortError');
    expect(error).not.toBeInstanceOf(NewsApiServiceError);
    expect(error).not.toBe(failure);
    expect(abortErrors).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(addListener).toHaveBeenCalledTimes(2);
    for (const [, listener] of addListener.mock.calls) {
      expect(removeListener).toHaveBeenCalledWith('abort', listener);
    }
  });
});

describe('getArticles timeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('aborts a request still pending after REQUEST_TIMEOUT_MS and rejects with reason timeout, without retrying', async () => {
    mockFetch('pending');
    const outcome = rejectionOf(getArticles(USA_TOP_HEADLINES));

    await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
    expect(fetchCall(0).init.signal.aborted).toBe(false);

    await jest.advanceTimersByTimeAsync(1);
    const error = await outcome;

    expect(error).toBeInstanceOf(NewsApiServiceError);
    expect(error).toMatchObject({ reason: 'timeout', message: 'timeout' });
    expect(fetchCall(0).init.signal.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports a timeout also when the caller passed a signal it did not abort', async () => {
    mockFetch('pending');
    const controller = new AbortController();
    const outcome = rejectionOf(getArticles(ITALY_MORE_NEWS, controller.signal));

    await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);

    expect(await outcome).toMatchObject({ name: 'NewsApiServiceError', reason: 'timeout' });
    expect(controller.signal.aborted).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('clears the timeout once a response arrives, also after a retry', async () => {
    mockFetch(jsonResponse(EMPTY_PAGE_BODY));
    await getArticles(USA_TOP_HEADLINES);

    expect(jest.getTimerCount()).toBe(0);

    mockFetch(new TypeError('Network request failed'), jsonResponse(EMPTY_PAGE_BODY));
    const retried = getArticles(USA_TOP_HEADLINES);
    await jest.advanceTimersByTimeAsync(NETWORK_RETRY_DELAY_MS);
    await retried;

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('getArticles cancellation', () => {
  it('rejects with the AbortError of fetch, without retrying, when the caller aborts a pending request', async () => {
    mockFetch('pending');
    const controller = new AbortController();
    const outcome = rejectionOf(getArticles(USA_TOP_HEADLINES, controller.signal));

    controller.abort();
    const error = await outcome;

    expect(abortErrors).toHaveLength(1);
    expect(error).toBe(abortErrors[0]);
    expect(error).toHaveProperty('name', 'AbortError');
    expect(error).not.toBeInstanceOf(NewsApiServiceError);
    expect(fetchCall(0).init.signal.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects with the AbortError of fetch, without retrying, when the caller signal is already aborted', async () => {
    mockFetch(jsonResponse(topHeadlinesUs));
    const controller = new AbortController();
    controller.abort();

    const error = await rejectionOf(getArticles(USA_TOP_HEADLINES, controller.signal));

    expect(abortErrors).toHaveLength(1);
    expect(error).toBe(abortErrors[0]);
    expect(error).not.toBeInstanceOf(NewsApiServiceError);
    expect(fetchCall(0).init.signal.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rethrows a fetch failure unchanged, without retrying, when the caller aborts before it is handled', async () => {
    const failure = new TypeError('Network request failed');
    mockFetch(failure);
    const controller = new AbortController();
    const outcome = rejectionOf(getArticles(USA_TOP_HEADLINES, controller.signal));

    controller.abort();

    expect(await outcome).toBe(failure);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('stops listening to the caller signal once the request is over', async () => {
    mockFetch(jsonResponse(topHeadlinesUs));
    const controller = new AbortController();
    const addListener = jest.spyOn(controller.signal, 'addEventListener');
    const removeListener = jest.spyOn(controller.signal, 'removeEventListener');

    await getArticles(USA_TOP_HEADLINES, controller.signal);
    controller.abort();

    expect(addListener).toHaveBeenCalledTimes(1);
    expect(removeListener).toHaveBeenCalledWith('abort', addListener.mock.calls[0][1]);
    expect(fetchCall(0).init.signal.aborted).toBe(false);
    expect(abortErrors).toHaveLength(0);
  });
});

describe('getArticles without an API key', () => {
  it('rejects with reason missingKey without calling fetch', async () => {
    const { service } = loadServiceWith(WITHOUT_KEY);
    mockFetch(jsonResponse(topHeadlinesUs));

    const error = await rejectionOf(service.getArticles(USA_TOP_HEADLINES));

    expect(error).toBeInstanceOf(service.NewsApiServiceError);
    expect(error).toMatchObject({ reason: 'missingKey', message: 'missingKey' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('getArticles in fixture mode', () => {
  it('answers the section requests with their fixture pages, without a key and without calling fetch', async () => {
    const { service } = loadServiceWith(WITHOUT_KEY, 'true');

    const usa = await service.getArticles(USA_TOP_HEADLINES);
    const ansa = await service.getArticles(ITALY_LATEST_ANSA);

    expect(usa).toEqual({ totalResults: topHeadlinesUs.totalResults, articles: topHeadlinesUs.articles });
    expect(usa.articles).toHaveLength(topHeadlinesUs.articles.length);
    expect(ansa).toEqual({ totalResults: everythingAnsa.totalResults, articles: everythingAnsa.articles });
    expect(ansa.articles).toHaveLength(everythingAnsa.articles.length);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a request without a fixture with reason invalidResponse', async () => {
    const { service } = loadServiceWith(WITHOUT_KEY, 'true');

    const error = await rejectionOf(service.getArticles({ endpoint: 'top-headlines', country: 'fr', pageSize: 50 }));

    expect(error).toBeInstanceOf(service.NewsApiServiceError);
    expect(error).toMatchObject({ reason: 'invalidResponse', message: 'No fixture for the request' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects with an AbortError, without calling fetch, when the signal is already aborted', async () => {
    const { service } = loadServiceWith(WITHOUT_KEY, 'true');
    const controller = new AbortController();
    controller.abort();

    const error = await rejectionOf(service.getArticles(USA_TOP_HEADLINES, controller.signal));

    expect(error).toBeInstanceOf(Error);
    expect(error).toHaveProperty('name', 'AbortError');
    expect(error).not.toBeInstanceOf(service.NewsApiServiceError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('getArticles and the fixture mode variable', () => {
  const NOT_FIXTURE_MODE = [
    { name: 'unset', value: undefined },
    { name: 'empty', value: '' },
    { name: '"false"', value: 'false' },
    { name: '"TRUE"', value: 'TRUE' },
    { name: '"1"', value: '1' },
  ];

  it('loads the fixture service once, with the service, and answers from it without calling fetch when it is "true"', async () => {
    const { service, loadFixtureService } = loadServiceWith(WITHOUT_KEY, 'true');

    expect(loadFixtureService).toHaveBeenCalledTimes(1);

    const usa = await service.getArticles(USA_TOP_HEADLINES);
    const italy = await service.getArticles(ITALY_FRONT_PAGES);

    expect(usa).toEqual({ totalResults: topHeadlinesUs.totalResults, articles: topHeadlinesUs.articles });
    expect(italy).toEqual({ totalResults: topHeadlinesItaly.totalResults, articles: topHeadlinesItaly.articles });
    expect(loadFixtureService).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(NOT_FIXTURE_MODE)('never loads the fixture service and sends the request with fetch when it is $name', async ({ value }) => {
    const { service, loadFixtureService } = loadServiceWith(WITH_KEY, value);
    mockFetch(jsonResponse(EMPTY_PAGE_BODY));

    await expect(service.getArticles(USA_TOP_HEADLINES)).resolves.toStrictEqual({ totalResults: 0, articles: [] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchCall(0).url).toBe(USA_TOP_HEADLINES_URL);
    expect(loadFixtureService).not.toHaveBeenCalled();
  });

  it.each(NOT_FIXTURE_MODE)('never loads the fixture service and rejects with reason missingKey without a key when it is $name', async ({ value }) => {
    const { service, loadFixtureService } = loadServiceWith(WITHOUT_KEY, value);
    mockFetch(jsonResponse(topHeadlinesUs));

    const error = await rejectionOf(service.getArticles(USA_TOP_HEADLINES));

    expect(error).toBeInstanceOf(service.NewsApiServiceError);
    expect(error).toMatchObject({ reason: 'missingKey' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(loadFixtureService).not.toHaveBeenCalled();
  });

  it('keeps the variable of a test out of the next one', () => {
    expect(process.env.EXPO_PUBLIC_NEWS_USE_FIXTURES).toBe(originalUseFixtures);
  });
});
