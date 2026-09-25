import type { Dictionary } from '@/i18n/it';

/** English texts of the interface, with the same keys as the Italian dictionary. */
export const en: Dictionary = {
  'news.title': 'News',
  'news.updatedAtTime': 'Updated at {time}',
  'news.updatedAtDate': 'Updated on {dateTime}',
  'language.switch': 'Italiano',
  'language.switchA11y': 'Switch to Italian',
  'categories.italy': 'Italy',
  'categories.usa': 'USA',
  'states.loading': 'Loading news...',
  'states.empty': 'No news available',
  'states.retry': 'Retry',
  'states.close': 'Close',
  'errors.network': 'No connection. Check your network and try again.',
  'errors.timeout': 'The server is not responding. Try again.',
  'errors.auth': 'Missing or invalid API key. Check the .env file.',
  'errors.rateLimit': 'Request limit reached. Try again later.',
  'errors.badRequest': 'Invalid request. Check the app configuration.',
  'errors.server': 'The news service is unavailable. Try again later.',
  'errors.unknown': 'An unexpected error occurred.',
  'errors.openArticle': 'Unable to open the article.',
  'card.a11y': 'Open article: {title}, {source}',
};
