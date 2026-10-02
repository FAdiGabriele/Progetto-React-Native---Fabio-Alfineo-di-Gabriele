import {
  IS_NEWS_API_KEY_CONFIGURED,
  NETWORK_RETRY_DELAY_MS,
  NEWS_API_BASE_URL,
  NEWS_API_KEY,
  REQUEST_TIMEOUT_MS,
} from '@/data/config';
import type {
  NewsApiPageDto,
  NewsApiRequestDto,
  NewsApiResponseDto,
} from '@/data/services/news-api-dto';

type FixtureService = typeof import('@/data/services/news-fixture-service');

/**
 * The fixture service in fixture mode, `undefined` otherwise. The variable is read here, not in
 * `data/config`, and the service is required behind it instead of imported: a production
 * build inlines the variable and drops the branch never taken, so without fixture mode the
 * fixtures stay out of the bundle.
 */
function requireFixtureService(): FixtureService | undefined {
  if (process.env.EXPO_PUBLIC_NEWS_USE_FIXTURES === 'true') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@/data/services/news-fixture-service');
  }
  return undefined;
}

const fixtureService = requireFixtureService();

export type NewsApiServiceErrorReason =
  | 'missingKey'
  | 'network'
  | 'timeout'
  | 'http'
  | 'invalidResponse';

/** Failure of a NewsAPI request; `message` is meant for logs only. */
export class NewsApiServiceError extends Error {
  reason: NewsApiServiceErrorReason;
  status?: number;
  code?: string;

  constructor(
    reason: NewsApiServiceErrorReason,
    details?: { status?: number; code?: string; message?: string; cause?: unknown }
  ) {
    super(
      details?.message ??
        (reason === 'http' && details?.status !== undefined ? `HTTP ${details.status}` : reason)
    );
    this.name = 'NewsApiServiceError';
    this.reason = reason;
    this.status = details?.status;
    this.code = details?.code;
    if (details?.cause !== undefined) {
      this.cause = details.cause;
    }
  }
}

type RawResponse = { status: number; ok: boolean; body: string };

type OkResponseDto = Extract<NewsApiResponseDto, { status: 'ok' }>;

function encodeList(values: readonly string[]): string {
  return values.map((value) => encodeURIComponent(value)).join(',');
}

function buildUrl(request: NewsApiRequestDto): string {
  let query: string;
  if (request.endpoint === 'everything') {
    query =
      `domains=${encodeList(request.domains)}` +
      `&language=${encodeURIComponent(request.language)}` +
      `&sortBy=${encodeURIComponent(request.sortBy)}`;
  } else if ('country' in request) {
    query = `country=${encodeURIComponent(request.country)}`;
  } else {
    query = `sources=${encodeList(request.sources)}`;
  }
  const page = request.page === undefined ? '' : `&page=${encodeURIComponent(request.page)}`;
  return `${NEWS_API_BASE_URL}/${request.endpoint}?${query}&pageSize=${encodeURIComponent(request.pageSize)}${page}`;
}

async function send(url: string, signal?: AbortSignal): Promise<RawResponse> {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener('abort', onAbort);
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'X-Api-Key': NEWS_API_KEY, Accept: 'application/json' },
      signal: controller.signal,
    });
    const body = await response.text();
    return { status: response.status, ok: response.ok, body };
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    if (timedOut) {
      throw new NewsApiServiceError('timeout');
    }
    throw new NewsApiServiceError('network', { cause: error });
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onAbort);
  }
}

// The error fetch rejects with when its signal is aborted.
function createAbortError(): Error {
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}

// Resolves after the retry pause, or rejects like fetch as soon as the caller aborts `signal`.
function waitBeforeRetry(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onAbort);
      reject(createAbortError());
    };
    const timeoutId = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, NETWORK_RETRY_DELAY_MS);
    signal?.addEventListener('abort', onAbort);
  });
}

async function sendWithRetry(url: string, signal?: AbortSignal): Promise<RawResponse> {
  try {
    return await send(url, signal);
  } catch (error) {
    if (error instanceof NewsApiServiceError && error.reason === 'network' && !signal?.aborted) {
      await waitBeforeRetry(signal);
      return send(url, signal);
    }
    throw error;
  }
}

function getFixtureArticles(
  service: FixtureService,
  request: NewsApiRequestDto,
  signal?: AbortSignal
): NewsApiPageDto {
  if (signal?.aborted) {
    throw createAbortError();
  }
  const page = service.getFixturePage(request);
  if (page === undefined) {
    throw new NewsApiServiceError('invalidResponse', { message: 'No fixture for the request' });
  }
  return page;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOkResponse(value: unknown): value is OkResponseDto {
  return (
    isRecord(value) &&
    value.status === 'ok' &&
    typeof value.totalResults === 'number' &&
    Array.isArray(value.articles)
  );
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

function parseResponse({ status, ok, body }: RawResponse): NewsApiPageDto {
  const parsed = parseJson(body);
  if (isRecord(parsed) && parsed.status === 'error') {
    throw new NewsApiServiceError('http', {
      status,
      code: typeof parsed.code === 'string' ? parsed.code : undefined,
      message: typeof parsed.message === 'string' ? parsed.message : undefined,
    });
  }
  if (!ok) {
    throw new NewsApiServiceError('http', { status });
  }
  if (isOkResponse(parsed)) {
    return { totalResults: parsed.totalResults, articles: parsed.articles };
  }
  throw new NewsApiServiceError('invalidResponse', { status });
}

/**
 * Fetches one page of a NewsAPI request: its articles and the total number of results.
 * A request that fails on the network is sent once more, after a pause. Rejects with a
 * NewsApiServiceError, or with an abort error when the caller aborts `signal`: the one of
 * fetch, unchanged, or one like it during the pause before the retry. In fixture mode the
 * page comes from `data/services/fixtures/`, without any request and without checking the key.
 */
export async function getArticles(
  request: NewsApiRequestDto,
  signal?: AbortSignal
): Promise<NewsApiPageDto> {
  if (fixtureService !== undefined) {
    return getFixtureArticles(fixtureService, request, signal);
  }
  if (!IS_NEWS_API_KEY_CONFIGURED) {
    throw new NewsApiServiceError('missingKey');
  }
  return parseResponse(await sendWithRetry(buildUrl(request), signal));
}
