import everythingAnsa from '@/services/fixtures/everything-ansa.json';
import topHeadlinesItaly from '@/services/fixtures/top-headlines-italy.json';
import topHeadlinesUs from '@/services/fixtures/top-headlines-us.json';
import type { NewsApiPageDto, NewsApiRequestDto } from '@/services/news-api-dto';

/** A request of the news sections, without the paging parameters: those do not select the fixture. */
type FixtureRequest =
  | { endpoint: 'top-headlines'; country: string }
  | { endpoint: 'top-headlines'; sources: readonly string[] }
  | { endpoint: 'everything'; domains: readonly string[]; language: string; sortBy: 'publishedAt' };

type Fixture = { request: FixtureRequest; page: NewsApiPageDto };

/** The requests of the news sections, each with the fixture file that holds its real response. */
const FIXTURES: readonly Fixture[] = [
  {
    request: { endpoint: 'top-headlines', country: 'us' },
    page: topHeadlinesUs,
  },
  {
    request: { endpoint: 'top-headlines', sources: ['la-repubblica', 'il-sole-24-ore'] },
    page: topHeadlinesItaly,
  },
  {
    request: { endpoint: 'everything', domains: ['ansa.it'], language: 'it', sortBy: 'publishedAt' },
    page: everythingAnsa,
  },
];

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function matches(fixture: FixtureRequest, request: NewsApiRequestDto): boolean {
  if (fixture.endpoint === 'everything') {
    return (
      request.endpoint === 'everything' &&
      sameList(fixture.domains, request.domains) &&
      fixture.language === request.language &&
      fixture.sortBy === request.sortBy
    );
  }
  if (request.endpoint !== 'top-headlines') {
    return false;
  }
  if ('country' in fixture) {
    return 'country' in request && fixture.country === request.country;
  }
  return 'sources' in request && sameList(fixture.sources, request.sources);
}

/**
 * Returns the page of the fixture that answers `request`, or `undefined` when no
 * fixture matches its endpoint and parameters; `pageSize` is ignored. Pages after the
 * first have no articles and the same `totalResults`, because the fixtures hold one
 * page each.
 */
export function getFixturePage(request: NewsApiRequestDto): NewsApiPageDto | undefined {
  const fixture = FIXTURES.find((candidate) => matches(candidate.request, request));
  if (fixture === undefined) {
    return undefined;
  }
  const isFirstPage = request.page === undefined || request.page <= 1;
  return {
    totalResults: fixture.page.totalResults,
    articles: isFirstPage ? [...fixture.page.articles] : [],
  };
}
