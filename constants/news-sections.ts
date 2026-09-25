import { NEWS_PAGE_SIZE } from '@/constants/config';

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
  requests: NewsSectionRequest[];
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
  },
  {
    key: 'usa',
    labelKey: 'categories.usa',
    requests: [{ endpoint: 'top-headlines', country: 'us', pageSize: NEWS_PAGE_SIZE }],
  },
];

/** Key of a news section, taken from the list above. */
export type NewsSectionKey = (typeof NEWS_SECTIONS)[number]['key'];
