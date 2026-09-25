/**
 * Central configuration for the NewsAPI integration.
 *
 * This is the only file to edit to change the base URL, the number of
 * articles fetched by each top-headlines request, or the request timeout.
 * The service reads the base URL, the timeout and the API key; the news
 * sections list reads the page size. The sections and the parameters of
 * their requests, such as the country, are defined in
 * `constants/news-sections.ts`.
 *
 * The API key comes from the `.env` file (`EXPO_PUBLIC_NEWS_API_KEY`
 * variable, template in `.env.example`); restart the dev server after
 * every change to `.env`. `EXPO_PUBLIC_*` values are inlined into the app
 * bundle at build time, which is acceptable for a demo project on
 * NewsAPI's free plan.
 */

/** Base URL of the NewsAPI service, read by the service. */
export const NEWS_API_BASE_URL = 'https://newsapi.org/v2';

/** Articles per top-headlines request, read by the news sections list; NewsAPI's max is 100. */
export const NEWS_PAGE_SIZE = 50;

/** Request timeout in milliseconds, read by the service. */
export const REQUEST_TIMEOUT_MS = 10000;

/** NewsAPI key, read once here by the service. */
export const NEWS_API_KEY: string = process.env.EXPO_PUBLIC_NEWS_API_KEY ?? '';

/** Whether the API key is configured; without it the service sends no requests. */
export const IS_NEWS_API_KEY_CONFIGURED = NEWS_API_KEY.length > 0;
