import { NEWS_MORE_PAGE_SIZE, NEWS_PAGE_SIZE } from '@/data/config';
import type { NewsApiRequestDto } from '@/data/services/news-api-dto';
import type { NewsGroupKey, NewsSectionKey } from '@/domain/models/news-model';

export type NewsSectionRequest = { group: NewsGroupKey; request: NewsApiRequestDto };

export type NewsSectionRequests = {
  /** Requests of the first page, in the order of their groups in the list; they have no later pages. */
  requests: NewsSectionRequest[];
  /** Paged request at the end of the list; without it the section loads no more news. */
  moreRequest?: NewsSectionRequest;
};

export const NEWS_SECTION_REQUESTS: Record<NewsSectionKey, NewsSectionRequests> = {
  italy: {
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
  usa: {
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
};
