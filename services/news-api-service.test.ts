import { REQUEST_TIMEOUT_MS } from '@/constants/config';
import everythingAnsa from '@/services/fixtures/everything-ansa.json';
import topHeadlinesItaly from '@/services/fixtures/top-headlines-italy.json';
import topHeadlinesUs from '@/services/fixtures/top-headlines-us.json';
import type { NewsApiRequestDto } from '@/services/news-api-dto';
import { getArticles, NewsApiServiceError } from '@/services/news-api-service';

jest.mock('@/constants/config', () => ({
  ...jest.requireActual('@/constants/config'),
  NEWS_API_KEY: 'test-key',
  IS_NEWS_API_KEY_CONFIGURED: true,
  USE_NEWS_FIXTURES: false,
}));

type FakeResponse = { status: number; ok: boolean; text: () => Promise<string> };

type FetchInit = { method: string; headers: Record<string, string>; signal: AbortSignal };

// What a fetch call does: resolve with a response, reject with an error, or stay pending.
type FetchOutcome = FakeResponse | Error | 'pending';

type NewsApiService = typeof import('@/services/news-api-service');

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

const fetchMock = jest.fn<Promise<FakeResponse>, [string, FetchInit]>();
// The errors the fake fetch rejected with because its signal was aborted, in order.
const abortErrors: Error[] = [];
const originalFetch = globalThis.fetch;

beforeEach(() => {
  fetchMock.mockReset();
  abortErrors.length = 0;
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.restoreAllMocks();
});

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

// A new instance of the service, loaded with other values of the configuration; the modules
// imported above keep the values of the mock at the top.
function loadServiceWith(values: {
  NEWS_API_KEY: string;
  IS_NEWS_API_KEY_CONFIGURED: boolean;
  USE_NEWS_FIXTURES: boolean;
}): NewsApiService {
  jest.resetModules();
  jest.doMock('@/constants/config', () => ({ ...jest.requireActual('@/constants/config'), ...values }));
  return jest.requireActual<NewsApiService>('@/services/news-api-service');
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
  it('retries a network failure once, then rejects with reason network and the second failure as cause', async () => {
    const first = new TypeError('Network request failed');
    const second = new TypeError('Network request failed again');
    mockFetch(first, second);

    const error = await serviceErrorOf(getArticles(USA_TOP_HEADLINES));

    expect(error.reason).toBe('network');
    expect(error.cause).toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([USA_TOP_HEADLINES_URL, USA_TOP_HEADLINES_URL]);
  });

  it('returns the page of the retry when the first attempt fails on the network', async () => {
    mockFetch(new TypeError('Network request failed'), jsonResponse(topHeadlinesUs));

    const page = await getArticles(USA_TOP_HEADLINES);

    expect(page).toStrictEqual({ totalResults: 37, articles: topHeadlinesUs.articles });
    expect(fetchMock).toHaveBeenCalledTimes(2);
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
    await getArticles(USA_TOP_HEADLINES);

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
    const service = loadServiceWith({
      NEWS_API_KEY: '',
      IS_NEWS_API_KEY_CONFIGURED: false,
      USE_NEWS_FIXTURES: false,
    });
    mockFetch(jsonResponse(topHeadlinesUs));

    const error = await rejectionOf(service.getArticles(USA_TOP_HEADLINES));

    expect(error).toBeInstanceOf(service.NewsApiServiceError);
    expect(error).toMatchObject({ reason: 'missingKey', message: 'missingKey' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('getArticles in fixture mode', () => {
  const FIXTURE_MODE = { NEWS_API_KEY: '', IS_NEWS_API_KEY_CONFIGURED: false, USE_NEWS_FIXTURES: true };

  it('answers the section requests with their fixture pages, without a key and without calling fetch', async () => {
    const service = loadServiceWith(FIXTURE_MODE);

    const usa = await service.getArticles(USA_TOP_HEADLINES);
    const ansa = await service.getArticles(ITALY_LATEST_ANSA);

    expect(usa).toEqual({ totalResults: topHeadlinesUs.totalResults, articles: topHeadlinesUs.articles });
    expect(usa.articles).toHaveLength(topHeadlinesUs.articles.length);
    expect(ansa).toEqual({ totalResults: everythingAnsa.totalResults, articles: everythingAnsa.articles });
    expect(ansa.articles).toHaveLength(everythingAnsa.articles.length);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a request without a fixture with reason invalidResponse', async () => {
    const service = loadServiceWith(FIXTURE_MODE);

    const error = await rejectionOf(service.getArticles({ endpoint: 'top-headlines', country: 'fr', pageSize: 50 }));

    expect(error).toBeInstanceOf(service.NewsApiServiceError);
    expect(error).toMatchObject({ reason: 'invalidResponse', message: 'No fixture for the request' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects with an AbortError, without calling fetch, when the signal is already aborted', async () => {
    const service = loadServiceWith(FIXTURE_MODE);
    const controller = new AbortController();
    controller.abort();

    const error = await rejectionOf(service.getArticles(USA_TOP_HEADLINES, controller.signal));

    expect(error).toBeInstanceOf(Error);
    expect(error).toHaveProperty('name', 'AbortError');
    expect(error).not.toBeInstanceOf(service.NewsApiServiceError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
