import everythingAnsa from '@/services/fixtures/everything-ansa.json';
import topHeadlinesItaly from '@/services/fixtures/top-headlines-italy.json';
import topHeadlinesUs from '@/services/fixtures/top-headlines-us.json';
import type { NewsApiRequestDto } from '@/services/news-api-dto';
import { getFixturePage } from '@/services/news-fixture-service';

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

  it('ignores pageSize', () => {
    expect(getFixturePage({ ...USA_TOP_HEADLINES, pageSize: 100 })?.articles).toHaveLength(35);
    expect(getFixturePage({ ...ITALY_EVERYTHING, pageSize: 1 })?.articles).toHaveLength(10);
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
