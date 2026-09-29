import { NEWS_MORE_PAGE_SIZE, NEWS_PAGE_SIZE } from '@/constants/config';

// Same shape as the request type of the NewsAPI service, declared here because
// constants import no layer; the repository passes these requests to the service,
// where the type check happens.
type NewsSectionRequest =
  | { endpoint: 'top-headlines'; country: string; pageSize: number }
  | { endpoint: 'top-headlines'; sources: string[]; pageSize: number }
  | {
      endpoint: 'everything';
      domains: string[];
      language: string;
      sortBy: 'publishedAt';
      pageSize: number;
    };

type NewsSection<Key extends string> = {
  key: Key;
  labelKey: `categories.${Key}`;
  /** Requests of the first page, in the order their articles are merged; they have no later pages. */
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
        endpoint: 'top-headlines',
        sources: ['la-repubblica', 'il-sole-24-ore'],
        pageSize: NEWS_PAGE_SIZE,
      },
      {
        endpoint: 'everything',
        domains: ['ansa.it'],
        language: 'it',
        sortBy: 'publishedAt',
        pageSize: 10,
      },
    ],
    moreRequest: {
      endpoint: 'everything',
      domains: ['ansa.it', 'repubblica.it', 'ilsole24ore.com'],
      language: 'it',
      sortBy: 'publishedAt',
      pageSize: NEWS_MORE_PAGE_SIZE,
    },
  },
  {
    key: 'usa',
    labelKey: 'categories.usa',
    requests: [{ endpoint: 'top-headlines', country: 'us', pageSize: NEWS_PAGE_SIZE }],
    moreRequest: {
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
];

/** Key of a news section, taken from the list above. */
export type NewsSectionKey = (typeof NEWS_SECTIONS)[number]['key'];
