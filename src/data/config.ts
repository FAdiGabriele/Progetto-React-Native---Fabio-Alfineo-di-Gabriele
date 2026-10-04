/**
 * Central configuration for the NewsAPI integration. The requests of the
 * sections and their parameters, such as the country or the domains, are
 * defined in `src/data/repositories/news-section-requests.ts`.
 *
 * The API key comes from the `.env` file (`EXPO_PUBLIC_NEWS_API_KEY`
 * variable); restart the dev server after every change to `.env`.
 * `EXPO_PUBLIC_*` values are inlined into the app bundle at build time, which
 * is acceptable for a demo project on NewsAPI's free plan. The fixture mode
 * variable, `EXPO_PUBLIC_NEWS_USE_FIXTURES`, is read by
 * `src/data/services/news-api-service.ts` itself, so that a build without
 * fixture mode leaves the fixtures out of the bundle.
 */

export const NEWS_API_BASE_URL = 'https://newsapi.org/v2';

/** Articles per top-headlines request; NewsAPI's max is 100. */
export const NEWS_PAGE_SIZE = 50;

/** Articles per page of the more-news request of every section; NewsAPI's max is 100. */
export const NEWS_MORE_PAGE_SIZE = 20;

/**
 * Maximum number of results per request across its pages: the free plan serves no more, so
 * no further page is asked beyond this limit.
 */
export const NEWS_MAX_RESULTS = 100;

export const REQUEST_TIMEOUT_MS = 10000;

/**
 * Pause before the only retry of a request that failed on the network: an immediate retry
 * would fail in the same way.
 */
export const NETWORK_RETRY_DELAY_MS = 1000;

export const NEWS_API_KEY: string = process.env.EXPO_PUBLIC_NEWS_API_KEY ?? '';

export const IS_NEWS_API_KEY_CONFIGURED = NEWS_API_KEY.length > 0;
