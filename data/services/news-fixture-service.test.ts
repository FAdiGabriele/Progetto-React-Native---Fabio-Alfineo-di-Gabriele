import everythingAnsa from '@/data/services/fixtures/everything-ansa.json';
import everythingItaly from '@/data/services/fixtures/everything-italy.json';
import everythingUs from '@/data/services/fixtures/everything-us.json';
import topHeadlinesItaly from '@/data/services/fixtures/top-headlines-italy.json';
import topHeadlinesUs from '@/data/services/fixtures/top-headlines-us.json';
import type { NewsApiRequestDto } from '@/data/services/news-api-dto';
import { getFixturePage } from '@/data/services/news-fixture-service';

const ITALY_TOP_HEADLINES: NewsApiRequestDto = {
  endpoint: 'top-headlines',
  sources: ['la-repubblica', 'il-sole-24-ore'],
  pageSize: 50,
};

const ITALY_EVERYTHING: NewsApiRequestDto = {
  endpoint: 'everything',
  domains: ['ansa.it'],
  language: 'it',
  sortBy: 'publishedAt',
  pageSize: 10,
};

const USA_TOP_HEADLINES: NewsApiRequestDto = {
  endpoint: 'top-headlines',
  country: 'us',
  pageSize: 50,
};

const ITALY_MORE: NewsApiRequestDto = {
  endpoint: 'everything',
  domains: ['ansa.it', 'repubblica.it', 'ilsole24ore.com'],
  language: 'it',
  sortBy: 'publishedAt',
  pageSize: 20,
};

const USA_DOMAINS = [
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
];

const USA_MORE: NewsApiRequestDto = {
  endpoint: 'everything',
  domains: USA_DOMAINS,
  language: 'en',
  sortBy: 'publishedAt',
  pageSize: 20,
};

describe('getFixturePage with the requests of the news sections', () => {
  it('answers the Italy top-headlines request with top-headlines-italy.json', () => {
    const page = getFixturePage(ITALY_TOP_HEADLINES);

    expect(page).toBeDefined();
    expect(page?.totalResults).toBe(topHeadlinesItaly.totalResults);
    expect(page?.articles).toEqual(topHeadlinesItaly.articles);
    expect(page?.articles).toHaveLength(20);
  });

  it('answers the Italy everything request with everything-ansa.json', () => {
    const page = getFixturePage(ITALY_EVERYTHING);

    expect(page).toBeDefined();
    expect(page?.totalResults).toBe(everythingAnsa.totalResults);
    expect(page?.articles).toEqual(everythingAnsa.articles);
    expect(page?.articles).toHaveLength(10);
  });

  it('answers the USA top-headlines request with top-headlines-us.json', () => {
    const page = getFixturePage(USA_TOP_HEADLINES);

    expect(page).toBeDefined();
    expect(page?.totalResults).toBe(topHeadlinesUs.totalResults);
    expect(page?.articles).toEqual(topHeadlinesUs.articles);
    expect(page?.articles).toHaveLength(35);
  });

  it('answers the Italy more-news request with everything-italy.json', () => {
    const page = getFixturePage(ITALY_MORE);

    expect(page).toBeDefined();
    expect(page?.totalResults).toBe(everythingItaly.totalResults);
    expect(page?.articles).toEqual(everythingItaly.articles);
    expect(page?.articles).toHaveLength(20);
  });

  it('answers the USA more-news request with everything-us.json', () => {
    const page = getFixturePage(USA_MORE);

    expect(page).toBeDefined();
    expect(page?.totalResults).toBe(everythingUs.totalResults);
    expect(page?.articles).toEqual(everythingUs.articles);
    expect(page?.articles).toHaveLength(20);
  });

  it('ignores pageSize', () => {
    expect(getFixturePage({ ...USA_TOP_HEADLINES, pageSize: 100 })?.articles).toHaveLength(35);
    expect(getFixturePage({ ...ITALY_EVERYTHING, pageSize: 1 })?.articles).toHaveLength(10);
    expect(getFixturePage({ ...ITALY_MORE, pageSize: 100 })?.articles).toHaveLength(20);
    expect(getFixturePage({ ...USA_MORE, pageSize: 50 })?.articles).toHaveLength(20);
  });

  it('treats page 1 like the first page', () => {
    expect(getFixturePage({ ...USA_TOP_HEADLINES, page: 1 })?.articles).toHaveLength(35);
  });

  it('returns a fresh articles array on every call', () => {
    const first = getFixturePage(USA_TOP_HEADLINES);
    const second = getFixturePage(USA_TOP_HEADLINES);

    expect(first?.articles).not.toBe(second?.articles);
    expect(first?.articles).not.toBe(topHeadlinesUs.articles);
  });
});

describe('getFixturePage with pages after the first', () => {
  it('returns no articles and the same totalResults for page 2 of the everything request', () => {
    const page = getFixturePage({ ...ITALY_EVERYTHING, page: 2 });

    expect(page).toEqual({ totalResults: everythingAnsa.totalResults, articles: [] });
  });

  it('returns no articles and the same totalResults for the pages after the first of the Italy more-news request', () => {
    const emptyPage = { totalResults: everythingItaly.totalResults, articles: [] };

    expect(getFixturePage({ ...ITALY_MORE, page: 2 })).toEqual(emptyPage);
    expect(getFixturePage({ ...ITALY_MORE, page: 5 })).toEqual(emptyPage);
  });

  it('returns no articles and the same totalResults for the pages after the first of the USA more-news request', () => {
    const emptyPage = { totalResults: everythingUs.totalResults, articles: [] };

    expect(getFixturePage({ ...USA_MORE, page: 2 })).toEqual(emptyPage);
    expect(getFixturePage({ ...USA_MORE, page: 5 })).toEqual(emptyPage);
  });

  it('returns no articles and the same totalResults for page 2 of the top-headlines requests', () => {
    expect(getFixturePage({ ...USA_TOP_HEADLINES, page: 2 })).toEqual({
      totalResults: topHeadlinesUs.totalResults,
      articles: [],
    });
    expect(getFixturePage({ ...ITALY_TOP_HEADLINES, page: 3 })).toEqual({
      totalResults: topHeadlinesItaly.totalResults,
      articles: [],
    });
  });

  it('still returns undefined for pages of requests without a fixture', () => {
    expect(getFixturePage({ ...USA_TOP_HEADLINES, country: 'it', page: 2 })).toBeUndefined();
  });
});

describe('getFixturePage with requests that have no fixture', () => {
  it('returns undefined for another country', () => {
    expect(getFixturePage({ ...USA_TOP_HEADLINES, country: 'it' })).toBeUndefined();
    expect(getFixturePage({ ...USA_TOP_HEADLINES, country: 'US' })).toBeUndefined();
  });

  it('returns undefined for other sources', () => {
    expect(getFixturePage({ ...ITALY_TOP_HEADLINES, sources: ['ansa'] })).toBeUndefined();
    expect(getFixturePage({ ...ITALY_TOP_HEADLINES, sources: ['la-repubblica'] })).toBeUndefined();
    expect(
      getFixturePage({ ...ITALY_TOP_HEADLINES, sources: ['il-sole-24-ore', 'la-repubblica'] })
    ).toBeUndefined();
    expect(
      getFixturePage({
        ...ITALY_TOP_HEADLINES,
        sources: ['la-repubblica', 'il-sole-24-ore', 'ansa'],
      })
    ).toBeUndefined();
  });

  it('returns undefined for other domains, languages or sort orders', () => {
    expect(getFixturePage({ ...ITALY_EVERYTHING, domains: ['repubblica.it'] })).toBeUndefined();
    expect(getFixturePage({ ...ITALY_EVERYTHING, domains: ['ansa.it', 'repubblica.it'] })).toBeUndefined();
    expect(getFixturePage({ ...ITALY_EVERYTHING, language: 'en' })).toBeUndefined();
    expect(
      getFixturePage({ ...ITALY_EVERYTHING, sortBy: 'popularity' as 'publishedAt' })
    ).toBeUndefined();
  });

  it('returns undefined for the Italy more-news request with other domains, another order or another language', () => {
    expect(
      getFixturePage({ ...ITALY_MORE, domains: ['repubblica.it', 'ansa.it', 'ilsole24ore.com'] })
    ).toBeUndefined();
    expect(getFixturePage({ ...ITALY_MORE, domains: ['ansa.it', 'repubblica.it'] })).toBeUndefined();
    expect(
      getFixturePage({ ...ITALY_MORE, domains: ['ansa.it', 'repubblica.it', 'ilsole24ore.com', 'corriere.it'] })
    ).toBeUndefined();
    expect(getFixturePage({ ...ITALY_MORE, language: 'en' })).toBeUndefined();
    expect(getFixturePage({ ...ITALY_MORE, sortBy: 'popularity' as 'publishedAt' })).toBeUndefined();
  });

  it('returns undefined for the USA more-news request with the domains in another order, fewer domains or another language', () => {
    expect(getFixturePage({ ...USA_MORE, domains: [...USA_DOMAINS].reverse() })).toBeUndefined();
    expect(getFixturePage({ ...USA_MORE, domains: USA_DOMAINS.slice(0, 21) })).toBeUndefined();
    expect(getFixturePage({ ...USA_MORE, domains: [...USA_DOMAINS, 'latimes.com'] })).toBeUndefined();
    expect(getFixturePage({ ...USA_MORE, language: 'it' })).toBeUndefined();
    expect(getFixturePage({ ...USA_MORE, sortBy: 'relevancy' as 'publishedAt' })).toBeUndefined();
  });

  it('returns undefined when the endpoint differs', () => {
    expect(
      getFixturePage({ endpoint: 'top-headlines', sources: ['ansa.it'], pageSize: 10 })
    ).toBeUndefined();
    expect(
      getFixturePage({
        endpoint: 'everything',
        domains: ['la-repubblica', 'il-sole-24-ore'],
        language: 'it',
        sortBy: 'publishedAt',
        pageSize: 50,
      })
    ).toBeUndefined();
  });
});
