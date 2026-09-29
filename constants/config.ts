/**
 * Central configuration for the NewsAPI integration.
 *
 * This is the only file to edit to change the base URL, the number of
 * articles fetched by each top-headlines request, the number of articles per
 * page of the more-news request of each section, the maximum number of
 * results asked to a request across its pages, or the request timeout.
 * The service reads the base URL, the timeout, the API key and the fixture
 * mode flag; the news sections list reads the two page sizes; the repository
 * reads the maximum number of results. The sections and the parameters of
 * their requests, such as the country or the domains, are defined in
 * `constants/news-sections.ts`.
 *
 * The API key comes from the `.env` file (`EXPO_PUBLIC_NEWS_API_KEY`
 * variable, template in `.env.example`); restart the dev server after
 * every change to `.env`. `EXPO_PUBLIC_*` values are inlined into the app
 * bundle at build time, which is acceptable for a demo project on
 * NewsAPI's free plan. The same file may set `EXPO_PUBLIC_NEWS_USE_FIXTURES`
 * to `true` to serve the fixtures of `services/fixtures/` instead of
 * calling NewsAPI, with no requests sent and no key needed.
 */

/** Base URL of the NewsAPI service, read by the service. */
export const NEWS_API_BASE_URL = 'https://newsapi.org/v2';

/** Articles per top-headlines request, read by the news sections list; NewsAPI's max is 100. */
export const NEWS_PAGE_SIZE = 50;

/**
 * Articles per page of the more-news request of every section, read by the news sections
 * list; NewsAPI's max is 100. With NEWS_MAX_RESULTS at 100, at most 5 pages are asked.
 */
export const NEWS_MORE_PAGE_SIZE = 20;

/**
 * Maximum number of results per request across its pages, read by the repository:
 * the free plan serves no more, so no further page is asked beyond this limit.
 */
export const NEWS_MAX_RESULTS = 100;

/** Request timeout in milliseconds, read by the service. */
export const REQUEST_TIMEOUT_MS = 10000;

/** NewsAPI key, read once here by the service. */
export const NEWS_API_KEY: string = process.env.EXPO_PUBLIC_NEWS_API_KEY ?? '';

/** Whether the API key is configured; without it the service sends no requests. */
export const IS_NEWS_API_KEY_CONFIGURED = NEWS_API_KEY.length > 0;

/**
 * Fixture mode, read by the service: when true the news service answers with the
 * fixtures of `services/fixtures/` instead of calling NewsAPI, so no request is
 * sent and the API key is not needed. False unless the variable is exactly `true`.
 */
export const USE_NEWS_FIXTURES = process.env.EXPO_PUBLIC_NEWS_USE_FIXTURES === 'true';
