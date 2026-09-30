import { NEWS_MORE_PAGE_SIZE, NEWS_PAGE_SIZE } from '@/constants/config';

/**
 * Key of a group of the news list, the block of cards that shows the articles of one request
 * under its own heading: the text `groups.<key>` of the dictionaries.
 */
export type NewsGroupKey = 'frontPages' | 'latestAnsa' | 'topHeadlines' | 'moreNews';

// Same shape as the request type of the NewsAPI service, declared here because
// constants import no layer; the repository passes these requests to the service,
// where the type check happens.
type NewsApiRequest =
  | { endpoint: 'top-headlines'; country: string; pageSize: number }
  | { endpoint: 'top-headlines'; sources: string[]; pageSize: number }
  | {
      endpoint: 'everything';
      domains: string[];
      language: string;
      sortBy: 'publishedAt';
      pageSize: number;
    };

/** A request of a section and the group of the list that shows its articles. */
type NewsSectionRequest = { group: NewsGroupKey; request: NewsApiRequest };

type NewsSection<Key extends string> = {
  key: Key;
  labelKey: `categories.${Key}`;
  /** Requests of the first page, in the order of their groups in the list; they have no later pages. */
  requests: NewsSectionRequest[];
  /** Request of the more news at the end of the list, one page at a time; without it the section loads no more news. */
  moreRequest?: NewsSectionRequest;
};

/** Ordered list of the news sections; the first one is selected at startup. */
export const NEWS_SECTIONS: readonly [NewsSection<'italy'>, NewsSection<'usa'>] = [
  {
    key: 'italy',
    labelKey: 'categories.italy',
    requests: [
      {
        group: 'frontPages',
        request: {
          endpoint: 'top-headlines',
          sources: ['la-repubblica', 'il-sole-24-ore'],
          pageSize: NEWS_PAGE_SIZE,
        },
      },
      {
        group: 'latestAnsa',
        request: {
          endpoint: 'everything',
          domains: ['ansa.it'],
          language: 'it',
          sortBy: 'publishedAt',
          pageSize: 10,
        },
      },
    ],
    moreRequest: {
      group: 'moreNews',
      request: {
        endpoint: 'everything',
        domains: ['ansa.it', 'repubblica.it', 'ilsole24ore.com'],
        language: 'it',
        sortBy: 'publishedAt',
        pageSize: NEWS_MORE_PAGE_SIZE,
      },
    },
  },
  {
    key: 'usa',
    labelKey: 'categories.usa',
    requests: [
      {
        group: 'topHeadlines',
        request: { endpoint: 'top-headlines', country: 'us', pageSize: NEWS_PAGE_SIZE },
      },
    ],
    moreRequest: {
      group: 'moreNews',
      request: {
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
        pageSize: NEWS_MORE_PAGE_SIZE,
      },
    },
  },
];

/** Key of a news section, taken from the list above. */
export type NewsSectionKey = (typeof NEWS_SECTIONS)[number]['key'];
