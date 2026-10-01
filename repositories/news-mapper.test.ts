import { appendGroups, mapArticles, mapGroups } from '@/repositories/news-mapper';
import type { Article, NewsGroup } from '@/repositories/news-model';
import everythingAnsa from '@/services/fixtures/everything-ansa.json';
import everythingItaly from '@/services/fixtures/everything-italy.json';
import everythingUs from '@/services/fixtures/everything-us.json';
import topHeadlinesItaly from '@/services/fixtures/top-headlines-italy.json';
import topHeadlinesUs from '@/services/fixtures/top-headlines-us.json';
import type { NewsApiArticleDto } from '@/services/news-api-dto';

const italySection: NewsApiArticleDto[] = [...topHeadlinesItaly.articles, ...everythingAnsa.articles];
const usaSection: NewsApiArticleDto[] = topHeadlinesUs.articles;

// ANSA publishes these pieces on the URLs of two editions, with the same title.
const REPEATED_ANSA_TITLES = ['Antonio Marras', 'Brano del 2012', "Divina d'Acciaio"];

function ansaEditions(titleStart: string): NewsApiArticleDto[] {
  return everythingAnsa.articles.filter((dto) => dto.title.startsWith(titleStart));
}

const secondEditionUrls = new Set(REPEATED_ANSA_TITLES.map((titleStart) => ansaEditions(titleStart)[1].url));
const italyWithoutDuplicates = italySection.filter((dto) => !secondEditionUrls.has(dto.url));

const ARTICLE_URL = 'https://www.ansa.it/sito/notizie/politica/2026/09/24/article_1.html';
const REGIONAL_URL = 'https://www.ansa.it/lombardia/notizie/2026/09/24/article_1.html';
const OTHER_URL = 'https://www.repubblica.it/politica/2026/09/24/news/article-2/';
const THIRD_URL = 'https://www.ansa.it/sito/notizie/cronaca/2026/09/24/article_3.html';

function makeDto(overrides: Partial<NewsApiArticleDto> = {}): NewsApiArticleDto {
  return {
    source: { id: 'ansa', name: 'ANSA.it' },
    author: 'Author Name',
    title: 'Article title',
    description: 'Article description',
    url: ARTICLE_URL,
    urlToImage: 'https://www.ansa.it/image.jpg',
    publishedAt: '2026-09-24T12:30:00Z',
    content: 'Article content',
    ...overrides,
  };
}

// Shapes outside the DTO type, to check that the mapper tolerates what the API might send.
function asDto(value: unknown): NewsApiArticleDto {
  return value as NewsApiArticleDto;
}

describe('mapArticles with the section fixtures', () => {
  it('maps the 30 articles of the Italy section to 27, in request order, without the second ANSA editions', () => {
    const articles = mapArticles(italySection);

    expect(italySection).toHaveLength(30);
    expect(articles).toHaveLength(27);
    expect(articles.map((article) => article.id)).toEqual(italyWithoutDuplicates.map((dto) => dto.url));
    expect(articles.map((article) => article.title)).toEqual(italyWithoutDuplicates.map((dto) => dto.title));
    expect(articles.slice(0, 20).every((article) => article.sourceName !== 'ANSA.it')).toBe(true);
    expect(articles.slice(20).every((article) => article.sourceName === 'ANSA.it')).toBe(true);
  });

  it('keeps only the first edition, in fixture order, of each ANSA piece published twice', () => {
    const articles = mapArticles(italySection);

    for (const titleStart of REPEATED_ANSA_TITLES) {
      const editions = ansaEditions(titleStart);
      const kept = articles.filter((article) => article.title.startsWith(titleStart));

      expect(editions).toHaveLength(2);
      expect(editions[1].title).toBe(editions[0].title);
      expect(kept.map((article) => article.url)).toEqual([editions[0].url]);
    }
  });

  it('maps the 35 articles of the USA section in request order', () => {
    const articles = mapArticles(usaSection);

    expect(articles).toHaveLength(35);
    expect(articles.map((article) => article.id)).toEqual(usaSection.map((dto) => dto.url));
    expect(articles.map((article) => article.url)).toEqual(usaSection.map((dto) => dto.url));
  });

  it('treats the "null" image text sent for Il Sole 24 Ore as a missing image', () => {
    const articles = mapArticles(italySection);
    const withoutImage = articles.filter((article) => article.imageUrl === undefined);

    expect(withoutImage).toHaveLength(8);
    expect(withoutImage.every((article) => article.sourceName === 'Il Sole 24 Ore')).toBe(true);
    articles.forEach((article, index) => {
      const dto = italyWithoutDuplicates[index];
      expect(article.imageUrl).toBe(dto.urlToImage === 'null' ? undefined : dto.urlToImage);
    });
  });

  it('keeps source names, images and dates and turns null authors, descriptions and images into undefined', () => {
    for (const section of [italyWithoutDuplicates, usaSection]) {
      const articles = mapArticles(section);
      articles.forEach((article, index) => {
        const dto = section[index];
        expect(article.sourceName).toBe(dto.source.name);
        expect(article.publishedAt).toBeInstanceOf(Date);
        expect(article.publishedAt?.getTime()).toBe(Date.parse(dto.publishedAt));
        expect(article.author).toBe(dto.author ?? undefined);
        expect(article.description).toBe(dto.description ?? undefined);
        expect(article.imageUrl).toBe(dto.urlToImage === 'null' ? undefined : (dto.urlToImage ?? undefined));
      });
    }
    expect(usaSection.filter((dto) => dto.urlToImage === null)).toHaveLength(1);
  });

  it('keeps one of the ANSA editions that share title and source but not the URL', () => {
    const articles = mapArticles(everythingAnsa.articles);

    expect(everythingAnsa.articles).toHaveLength(10);
    expect(articles).toHaveLength(7);
    expect(new Set(articles.map((article) => article.title)).size).toBe(7);
  });

  it('maps the 20 articles of the Italy more-news page to 16, without the second editions of four ANSA pieces', () => {
    const articles = mapArticles(everythingItaly.articles);

    expect(everythingItaly.articles).toHaveLength(20);
    expect(articles).toHaveLength(16);
    expect(new Set(articles.map((article) => article.title)).size).toBe(16);
    expect(everythingItaly.articles.slice(0, 10).map((dto) => dto.url)).toEqual(
      everythingAnsa.articles.map((dto) => dto.url)
    );
  });
});

describe('mapArticles filters', () => {
  it('drops articles titled "[Removed]"', () => {
    expect(mapArticles([makeDto({ title: '[Removed]' })])).toEqual([]);
    expect(mapArticles([makeDto({ title: '  [Removed]  ' })])).toEqual([]);
  });

  it('drops articles with an empty, blank, missing or null title', () => {
    expect(mapArticles([makeDto({ title: '' })])).toEqual([]);
    expect(mapArticles([makeDto({ title: '   ' })])).toEqual([]);
    expect(mapArticles([asDto({ ...makeDto(), title: undefined })])).toEqual([]);
    expect(mapArticles([asDto({ ...makeDto(), title: null })])).toEqual([]);
    expect(mapArticles([asDto({ ...makeDto(), title: 42 })])).toEqual([]);
  });

  it('drops articles whose URL is not http or https', () => {
    expect(mapArticles([makeDto({ url: 'ftp://www.ansa.it/file' })])).toEqual([]);
    expect(mapArticles([makeDto({ url: 'javascript:alert(1)' })])).toEqual([]);
    expect(mapArticles([makeDto({ url: 'www.ansa.it/sito' })])).toEqual([]);
    expect(mapArticles([makeDto({ url: '/sito/notizie' })])).toEqual([]);
    expect(mapArticles([makeDto({ url: 'https://' })])).toEqual([]);
    expect(mapArticles([makeDto({ url: '' })])).toEqual([]);
    expect(mapArticles([asDto({ ...makeDto(), url: undefined })])).toEqual([]);
    expect(mapArticles([asDto({ ...makeDto(), url: null })])).toEqual([]);
  });

  it('keeps articles with an http URL as well as an https one', () => {
    const articles = mapArticles([
      makeDto({ title: 'A', url: 'http://example.com/a' }),
      makeDto({ title: 'B', url: 'https://example.com/b' }),
    ]);
    expect(articles.map((article) => article.url)).toEqual(['http://example.com/a', 'https://example.com/b']);
  });
});

describe('mapArticles normalization', () => {
  it('converts a full DTO into an article', () => {
    expect(mapArticles([makeDto()])).toEqual([
      {
        id: ARTICLE_URL,
        title: 'Article title',
        description: 'Article description',
        url: ARTICLE_URL,
        imageUrl: 'https://www.ansa.it/image.jpg',
        sourceName: 'ANSA.it',
        author: 'Author Name',
        publishedAt: new Date('2026-09-24T12:30:00Z'),
      },
    ]);
  });

  it('treats the text "null", empty and blank strings as missing optional fields', () => {
    for (const value of ['null', '', '   ', ' null ']) {
      const [article] = mapArticles([makeDto({ description: value, author: value, urlToImage: value })]);
      expect(article.description).toBe(undefined);
      expect(article.author).toBe(undefined);
      expect(article.imageUrl).toBe(undefined);
    }
  });

  it('treats null and missing optional fields as missing', () => {
    const [fromNull] = mapArticles([makeDto({ description: null, author: null, urlToImage: null })]);
    expect(fromNull.description).toBe(undefined);
    expect(fromNull.author).toBe(undefined);
    expect(fromNull.imageUrl).toBe(undefined);

    const [fromMissing] = mapArticles([asDto({ title: 'Only title and URL', url: ARTICLE_URL })]);
    expect(fromMissing).toEqual({
      id: ARTICLE_URL,
      title: 'Only title and URL',
      url: ARTICLE_URL,
      sourceName: 'ansa.it',
    });
  });

  it('trims title, optional texts and URL', () => {
    const [article] = mapArticles([
      makeDto({
        title: '  Spaced title  ',
        description: '  Spaced description  ',
        author: '  Spaced author  ',
        urlToImage: '  https://www.ansa.it/image.jpg  ',
        url: `  ${ARTICLE_URL}  `,
      }),
    ]);

    expect(article.title).toBe('Spaced title');
    expect(article.description).toBe('Spaced description');
    expect(article.author).toBe('Spaced author');
    expect(article.imageUrl).toBe('https://www.ansa.it/image.jpg');
    expect(article.url).toBe(ARTICLE_URL);
    expect(article.id).toBe(ARTICLE_URL);
  });

  it('does not treat "null" as a special value inside a longer text', () => {
    const [article] = mapArticles([makeDto({ description: 'null pointer', author: 'Nullo Rossi' })]);
    expect(article.description).toBe('null pointer');
    expect(article.author).toBe('Nullo Rossi');
  });
});

describe('mapArticles publishedAt', () => {
  it('parses a valid ISO 8601 date-time', () => {
    const [article] = mapArticles([makeDto({ publishedAt: '2026-09-24T14:30:00+02:00' })]);
    expect(article.publishedAt?.getTime()).toBe(Date.UTC(2026, 8, 24, 12, 30));
  });

  it('leaves the date undefined when the value cannot be parsed', () => {
    for (const value of ['yesterday', '2026-09-24', '2026-09-24 12:30:00', '2026-13-01T00:00:00Z', '']) {
      const [article] = mapArticles([makeDto({ publishedAt: value })]);
      expect(article.publishedAt).toBe(undefined);
    }
    expect(mapArticles([asDto({ ...makeDto(), publishedAt: null })])[0].publishedAt).toBe(undefined);
    expect(mapArticles([asDto({ ...makeDto(), publishedAt: undefined })])[0].publishedAt).toBe(undefined);
    expect(mapArticles([asDto({ ...makeDto(), publishedAt: 1790253000000 })])[0].publishedAt).toBe(undefined);
  });
});

describe('mapArticles deduplication', () => {
  it('keeps the first of two articles with the same URL in one request', () => {
    const articles = mapArticles([makeDto({ title: 'First' }), makeDto({ title: 'Second' })]);
    expect(articles.map((article) => article.title)).toEqual(['First']);
  });

  it('keeps the first of two articles with the same URL also when published on different days', () => {
    const articles = mapArticles([
      makeDto({ publishedAt: '2026-09-23T12:30:00Z' }),
      makeDto({ publishedAt: '2026-09-24T12:30:00Z' }),
    ]);
    expect(articles.map((article) => article.publishedAt?.getTime())).toEqual([Date.UTC(2026, 8, 23, 12, 30)]);
  });

  it('deduplicates across the requests of a section, keeping the first position', () => {
    const topHeadlines = [makeDto({ title: 'Headline', url: ARTICLE_URL }), makeDto({ title: 'Other', url: OTHER_URL })];
    const everything = [
      makeDto({ title: 'Same story from everything', url: ARTICLE_URL }),
      makeDto({ title: 'New story', url: THIRD_URL }),
    ];

    const articles = mapArticles([...topHeadlines, ...everything]);

    expect(articles.map((article) => article.title)).toEqual(['Headline', 'Other', 'New story']);
  });

  it('drops the fixture articles of the Italy section when another request sends them again', () => {
    const articles = mapArticles([...italySection, ...topHeadlinesItaly.articles, ...everythingAnsa.articles]);

    expect(articles).toHaveLength(27);
    expect(articles.map((article) => article.id)).toEqual(italyWithoutDuplicates.map((dto) => dto.url));
  });

  it('compares URLs after trimming', () => {
    const articles = mapArticles([
      makeDto({ title: 'First', url: ARTICLE_URL }),
      makeDto({ title: 'Second', url: `  ${ARTICLE_URL}  ` }),
    ]);
    expect(articles.map((article) => article.title)).toEqual(['First']);
  });

  it('does not let a dropped article reserve its URL', () => {
    const articles = mapArticles([makeDto({ title: '[Removed]' }), makeDto({ title: 'Kept' })]);
    expect(articles.map((article) => article.title)).toEqual(['Kept']);
  });

  it('does not let a dropped article reserve its title', () => {
    const articles = mapArticles([makeDto({ url: 'not a url' }), makeDto({ url: ARTICLE_URL })]);
    expect(articles.map((article) => article.id)).toEqual([ARTICLE_URL]);
  });
});

describe('mapArticles deduplication by title, source and day', () => {
  it('keeps the first of two articles with the same title and source on different URLs', () => {
    const articles = mapArticles([makeDto({ url: REGIONAL_URL }), makeDto({ url: ARTICLE_URL })]);
    expect(articles.map((article) => article.id)).toEqual([REGIONAL_URL]);
  });

  it('compares titles and sources ignoring case, surrounding spaces and repeated spaces', () => {
    const sole = { id: 'il-sole-24-ore', name: 'Il Sole 24 Ore' };
    const articles = mapArticles([
      makeDto({ title: 'Borse europee in rialzo', source: sole, url: 'https://example.com/a' }),
      makeDto({
        title: '  BORSE   europee\tin  Rialzo ',
        source: { id: null, name: ' il  sole 24 ORE ' },
        url: 'https://example.com/b',
      }),
      makeDto({ title: 'Borse europee in rialzo.', source: sole, url: 'https://example.com/c' }),
      makeDto({ title: 'Borse europee inrialzo', source: sole, url: 'https://example.com/d' }),
    ]);

    expect(articles.map((article) => article.url)).toEqual([
      'https://example.com/a',
      'https://example.com/c',
      'https://example.com/d',
    ]);
  });

  it('keeps articles with the same title from different sources', () => {
    const articles = mapArticles([
      makeDto({ url: ARTICLE_URL }),
      makeDto({ url: OTHER_URL, source: { id: 'la-repubblica', name: 'la Repubblica' } }),
    ]);
    expect(articles.map((article) => article.id)).toEqual([ARTICLE_URL, OTHER_URL]);
  });

  it('compares the source name that falls back to the URL domain', () => {
    const noName = { id: null, name: '' };

    const sameDomain = mapArticles([
      makeDto({ source: noName, url: ARTICLE_URL }),
      asDto({ ...makeDto({ url: REGIONAL_URL }), source: null }),
    ]);
    expect(sameDomain.map((article) => article.id)).toEqual([ARTICLE_URL]);

    // The name "ANSA.it" and the domain "ansa.it" differ only in case.
    const nameAndDomain = mapArticles([makeDto({ url: ARTICLE_URL }), makeDto({ source: noName, url: REGIONAL_URL })]);
    expect(nameAndDomain.map((article) => article.id)).toEqual([ARTICLE_URL]);

    const otherDomain = mapArticles([makeDto({ source: noName, url: ARTICLE_URL }), makeDto({ source: noName, url: OTHER_URL })]);
    expect(otherDomain.map((article) => article.sourceName)).toEqual(['ansa.it', 'repubblica.it']);
  });

  it('deduplicates across the requests of a section, keeping the first position', () => {
    const topHeadlines = [makeDto({ title: 'Headline', url: ARTICLE_URL }), makeDto({ title: 'Other', url: OTHER_URL })];
    const everything = [makeDto({ title: 'headline', url: REGIONAL_URL }), makeDto({ title: 'New story', url: THIRD_URL })];

    const articles = mapArticles([...topHeadlines, ...everything]);

    expect(articles.map((article) => article.id)).toEqual([ARTICLE_URL, OTHER_URL, THIRD_URL]);
  });

  it('drops an article that duplicates an earlier duplicate', () => {
    const articles = mapArticles([
      makeDto({ title: 'First title', url: ARTICLE_URL }),
      makeDto({ title: 'Updated title', url: ARTICLE_URL }),
      makeDto({ title: 'Updated title', url: REGIONAL_URL }),
    ]);
    expect(articles.map((article) => article.title)).toEqual(['First title']);
  });

  it('keeps both articles with the same title and source on different URLs published on different days', () => {
    const title = 'Borsa: Milano chiude in rialzo';
    const articles = mapArticles([
      makeDto({ title, url: ARTICLE_URL, publishedAt: '2026-09-23T15:40:00Z' }),
      makeDto({ title, url: REGIONAL_URL, publishedAt: '2026-09-24T15:40:00Z' }),
    ]);
    expect(articles.map((article) => article.id)).toEqual([ARTICLE_URL, REGIONAL_URL]);
  });

  it('compares the publication days in the device time zone', () => {
    // The tests run in the Europe/Rome time zone, two hours ahead of UTC in September.
    const acrossLocalMidnight = mapArticles([
      makeDto({ url: ARTICLE_URL, publishedAt: '2026-09-23T21:59:00Z' }),
      makeDto({ url: REGIONAL_URL, publishedAt: '2026-09-23T22:01:00Z' }),
    ]);
    expect(acrossLocalMidnight.map((article) => article.id)).toEqual([ARTICLE_URL, REGIONAL_URL]);

    const acrossUtcMidnight = mapArticles([
      makeDto({ url: ARTICLE_URL, publishedAt: '2026-09-23T23:59:00Z' }),
      makeDto({ url: REGIONAL_URL, publishedAt: '2026-09-24T00:01:00Z' }),
    ]);
    expect(acrossUtcMidnight.map((article) => article.id)).toEqual([ARTICLE_URL]);
  });

  it('keeps the first of two articles with the same title and source and no readable date', () => {
    const articles = mapArticles([
      makeDto({ url: ARTICLE_URL, publishedAt: 'yesterday' }),
      asDto({ ...makeDto({ url: REGIONAL_URL }), publishedAt: null }),
    ]);
    expect(articles.map((article) => article.id)).toEqual([ARTICLE_URL]);
  });

  it('keeps both articles with the same title and source when only one has a readable date', () => {
    const articles = mapArticles([makeDto({ url: ARTICLE_URL }), makeDto({ url: REGIONAL_URL, publishedAt: 'yesterday' })]);
    expect(articles.map((article) => article.id)).toEqual([ARTICLE_URL, REGIONAL_URL]);
  });
});

describe('mapArticles source name', () => {
  it('uses the trimmed source name when present', () => {
    const [article] = mapArticles([makeDto({ source: { id: null, name: '  La Repubblica  ' } })]);
    expect(article.sourceName).toBe('La Repubblica');
  });

  it('falls back to the URL domain without "www." when the name is empty or blank', () => {
    expect(mapArticles([makeDto({ source: { id: null, name: '' } })])[0].sourceName).toBe('ansa.it');
    expect(mapArticles([makeDto({ source: { id: null, name: '   ' } })])[0].sourceName).toBe('ansa.it');
    expect(mapArticles([makeDto({ source: { id: null, name: '' }, url: OTHER_URL })])[0].sourceName).toBe(
      'repubblica.it'
    );
  });

  it('falls back to the URL domain when the source or its name is null or missing', () => {
    expect(mapArticles([asDto({ ...makeDto(), source: null })])[0].sourceName).toBe('ansa.it');
    expect(mapArticles([asDto({ ...makeDto(), source: undefined })])[0].sourceName).toBe('ansa.it');
    expect(mapArticles([asDto({ ...makeDto(), source: { id: null, name: null } })])[0].sourceName).toBe('ansa.it');
    expect(mapArticles([asDto({ ...makeDto(), source: 'ANSA' })])[0].sourceName).toBe('ansa.it');
  });
});

describe('mapArticles tolerance and order', () => {
  it('returns an empty list for no articles', () => {
    expect(mapArticles([])).toEqual([]);
  });

  it('skips entries that are not objects', () => {
    const articles = mapArticles([asDto(null), asDto(undefined), asDto('article'), asDto(7), makeDto()]);
    expect(articles).toHaveLength(1);
    expect(articles[0].id).toBe(ARTICLE_URL);
  });

  it('keeps the valid articles in their original order', () => {
    const urls = ['a', 'b', 'c', 'd'].map((slug) => `https://example.com/${slug}`);
    const articles = mapArticles([
      makeDto({ title: 'A', url: urls[0] }),
      makeDto({ title: '[Removed]', url: 'https://example.com/removed' }),
      makeDto({ title: 'B', url: urls[1] }),
      makeDto({ title: 'Invalid URL', url: 'not a url' }),
      makeDto({ title: 'C', url: urls[2] }),
      makeDto({ title: 'Duplicate of A', url: urls[0] }),
      makeDto({ title: 'D', url: urls[3] }),
    ]);

    expect(articles.map((article) => article.title)).toEqual(['A', 'B', 'C', 'D']);
    expect(articles.map((article) => article.id)).toEqual(urls);
  });
});

describe('mapArticles source suffix', () => {
  const cnn = { id: 'cnn', name: 'CNN' };

  it('removes from the title a final " - " followed by the source name, ignoring case and spaces', () => {
    const articles = mapArticles([
      makeDto({ title: 'Markets rally - CNN', source: cnn, url: 'https://www.cnn.com/a' }),
      makeDto({ title: 'Markets fall -  cnn ', source: cnn, url: 'https://www.cnn.com/b' }),
      makeDto({ title: 'Two dashes - here - CNN', source: cnn, url: 'https://www.cnn.com/c' }),
    ]);
    expect(articles.map((article) => article.title)).toEqual(['Markets rally', 'Markets fall', 'Two dashes - here']);
  });

  it('removes a final " - " followed by the domain of the URL, without "www."', () => {
    const [article] = mapArticles([
      makeDto({
        title: 'Election results - usatoday.com',
        source: { id: null, name: 'USA Today' },
        url: 'https://www.usatoday.com/story/1',
      }),
    ]);
    expect(article.title).toBe('Election results');
  });

  it('removes a final " | " followed by the source name', () => {
    const [article] = mapArticles([
      makeDto({
        title: 'Startup raises $25M | TechCrunch',
        source: { id: 'techcrunch', name: 'TechCrunch' },
        url: 'https://techcrunch.com/a',
      }),
    ]);
    expect(article.title).toBe('Startup raises $25M');
  });

  it('keeps a suffix that is neither the source name nor the domain', () => {
    const articles = mapArticles([
      makeDto({
        title: 'Trade talks resume - AP News',
        source: { id: null, name: 'Associated Press' },
        url: 'https://apnews.com/article/1',
      }),
      makeDto({ title: 'Report - BBC', source: { id: 'bbc-news', name: 'BBC News' }, url: 'https://www.bbc.com/news/1' }),
      makeDto({
        title: 'Ucraina - Russia, le news',
        source: { id: 'la-repubblica', name: 'La Repubblica' },
        url: 'https://www.repubblica.it/a',
      }),
      makeDto({ title: 'CNN - the movie', source: cnn, url: 'https://www.cnn.com/d' }),
      makeDto({ title: 'CNN', source: cnn, url: 'https://www.cnn.com/e' }),
    ]);
    expect(articles.map((article) => article.title)).toEqual([
      'Trade talks resume - AP News',
      'Report - BBC',
      'Ucraina - Russia, le news',
      'CNN - the movie',
      'CNN',
    ]);
  });

  it('keeps the title when nothing precedes the suffix', () => {
    const [article] = mapArticles([makeDto({ title: ' - CNN', source: cnn, url: 'https://www.cnn.com/f' })]);
    expect(article.title).toBe('- CNN');
  });

  it('matches a source name that contains the separator', () => {
    const [article] = mapArticles([
      makeDto({ title: 'Story - Foo - Bar', source: { id: null, name: 'Foo - Bar' }, url: 'https://foobar.example.com/a' }),
    ]);
    expect(article.title).toBe('Story');
  });

  it('compares the suffix with the source name that falls back to the domain', () => {
    const [article] = mapArticles([
      makeDto({ title: 'Story - ansa.it', source: { id: null, name: '' }, url: ARTICLE_URL }),
    ]);
    expect(article.sourceName).toBe('ansa.it');
    expect(article.title).toBe('Story');
  });

  it('deduplicates by the title without the suffix', () => {
    const articles = mapArticles([
      makeDto({ title: 'Same story - CNN', source: cnn, url: 'https://www.cnn.com/g' }),
      makeDto({ title: 'Same story', source: cnn, url: 'https://www.cnn.com/h' }),
    ]);
    expect(articles.map((article) => article.id)).toEqual(['https://www.cnn.com/g']);
  });

  it('removes the suffix from 26 of the 35 USA headlines of the fixture and keeps the other 9', () => {
    const articles = mapArticles(usaSection);
    const kept = articles.filter((article, index) => article.title === usaSection[index].title);

    expect(usaSection.every((dto) => dto.title.includes(' - '))).toBe(true);
    expect(articles).toHaveLength(35);
    expect(kept).toHaveLength(9);
    expect(kept.map((article) => article.title.slice(article.title.lastIndexOf(' - ') + 3))).toEqual([
      'Yahoo Finance',
      'WSJ',
      'AP News',
      'BBC',
      'Gizmodo',
      'AP News',
      'The Hollywood Reporter',
      'AP News',
      'The Conversation',
    ]);
    articles.forEach((article, index) => {
      const dto = usaSection[index];
      const removed = dto.title.slice(article.title.length);
      expect(dto.title.startsWith(article.title)).toBe(true);
      expect(removed === '' || removed.startsWith(' - ')).toBe(true);
      expect(article.title.toLowerCase().endsWith(` - ${dto.source.name.toLowerCase()}`)).toBe(false);
    });
  });

  it('removes " | TechCrunch" from the two TechCrunch titles of the USA more-news fixture', () => {
    const articles = mapArticles(everythingUs.articles);
    const suffix = ' | TechCrunch';

    expect(everythingUs.articles.filter((dto) => dto.title.endsWith(suffix))).toHaveLength(2);
    articles.forEach((article, index) => {
      const dto = everythingUs.articles[index];
      expect(article.title).toBe(dto.title.endsWith(suffix) ? dto.title.slice(0, -suffix.length) : dto.title);
    });
  });
});

describe('mapGroups', () => {
  const italyGroups = [
    { key: 'frontPages', articles: topHeadlinesItaly.articles },
    { key: 'latestAnsa', articles: everythingAnsa.articles },
  ];

  it('maps the two requests of the Italy section to two groups, with the 27 articles in request order', () => {
    const groups = mapGroups(italyGroups);

    expect(groups.map((group) => group.key)).toEqual(['frontPages', 'latestAnsa']);
    expect(groups.map((group) => group.articles.length)).toEqual([20, 7]);
    expect(groups.flatMap((group) => group.articles)).toEqual(mapArticles(italySection));
  });

  it('maps the request of the USA section to one group of 35 articles', () => {
    const groups = mapGroups([{ key: 'topHeadlines', articles: usaSection }]);

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('topHeadlines');
    expect(groups[0].articles).toEqual(mapArticles(usaSection));
  });

  it('drops across the groups the duplicates of an article of an earlier group', () => {
    const groups = mapGroups([
      { key: 'a', articles: [makeDto({ title: 'Headline', url: ARTICLE_URL }), makeDto({ title: 'Other', url: OTHER_URL })] },
      {
        key: 'b',
        articles: [
          makeDto({ title: 'headline', url: REGIONAL_URL }),
          makeDto({ title: 'Same URL', url: OTHER_URL }),
          makeDto({ title: 'New story', url: THIRD_URL }),
        ],
      },
    ]);

    expect(groups.map((group) => group.articles.map((article) => article.id))).toEqual([
      [ARTICLE_URL, OTHER_URL],
      [THIRD_URL],
    ]);
  });

  it('keeps an article of a later group with the title and source of an earlier one when published on another day', () => {
    const groups = mapGroups([
      { key: 'a', articles: [makeDto({ title: 'Headline', url: ARTICLE_URL, publishedAt: '2026-09-23T12:30:00Z' })] },
      {
        key: 'b',
        articles: [
          makeDto({ title: 'headline', url: REGIONAL_URL, publishedAt: '2026-09-24T12:30:00Z' }),
          makeDto({ title: 'headline', url: THIRD_URL, publishedAt: '2026-09-23T18:00:00Z' }),
        ],
      },
    ]);

    expect(groups.map((group) => group.articles.map((article) => article.id))).toEqual([[ARTICLE_URL], [REGIONAL_URL]]);
  });

  it('drops a group left without articles and returns no group for no articles', () => {
    const groups = mapGroups([
      { key: 'a', articles: [] },
      { key: 'b', articles: [makeDto({ title: '[Removed]' })] },
      { key: 'c', articles: [makeDto()] },
      { key: 'd', articles: [makeDto({ url: REGIONAL_URL })] },
    ]);

    expect(groups.map((group) => group.key)).toEqual(['c']);
    expect(groups[0].articles.map((article) => article.id)).toEqual([ARTICLE_URL]);
    expect(mapGroups([])).toEqual([]);
  });

  it('keeps a later group with the key of an earlier one as a separate group', () => {
    const groups = mapGroups([
      { key: 'a', articles: [makeDto({ title: 'First', url: ARTICLE_URL })] },
      { key: 'b', articles: [makeDto({ title: 'Second', url: OTHER_URL })] },
      { key: 'a', articles: [makeDto({ title: 'Third', url: THIRD_URL })] },
    ]);

    expect(groups.map((group) => [group.key, group.articles.length])).toEqual([['a', 1], ['b', 1], ['a', 1]]);
  });
});

describe('appendGroups', () => {
  function makeArticle(title: string, url: string, sourceName = 'ANSA.it'): Article {
    return { id: url, title, url, sourceName };
  }

  function makeDatedArticle(title: string, url: string, publishedAt: string): Article {
    return { ...makeArticle(title, url), publishedAt: new Date(publishedAt) };
  }

  function group(key: string, ...articles: Article[]): NewsGroup {
    return { key, articles };
  }

  const first = makeArticle('First', 'https://example.com/1');
  const second = makeArticle('Second', 'https://example.com/2');
  const third = makeArticle('Third', 'https://example.com/3');
  const fourth = makeArticle('Fourth', 'https://example.com/4');

  it('extends the last group when the new group has its key, in order, without changing the current list', () => {
    const current = [group('top', first), group('more', second)];

    expect(appendGroups(current, [group('more', third, fourth)])).toEqual([
      group('top', first),
      group('more', second, third, fourth),
    ]);
    expect(current).toEqual([group('top', first), group('more', second)]);
  });

  it('adds a new group after the current ones when the key differs from the last one', () => {
    expect(appendGroups([group('top', first)], [group('more', second)])).toEqual([
      group('top', first),
      group('more', second),
    ]);
    expect(appendGroups([group('more', first), group('top', second)], [group('more', third)])).toEqual([
      group('more', first),
      group('top', second),
      group('more', third),
    ]);
  });

  it('appends to an empty list', () => {
    expect(appendGroups([], [group('more', first, second)])).toEqual([group('more', first, second)]);
  });

  it('drops the articles with the URL, or the title and source, of one already in the list', () => {
    const sameUrl = makeArticle('Updated first', 'https://example.com/1');
    const otherEdition = makeArticle('  FIRST ', 'https://example.com/regional/1', 'ansa.it');
    const otherSource = makeArticle('First', 'https://example.com/other/1', 'la Repubblica');

    expect(
      appendGroups([group('top', first), group('more', second)], [group('more', sameUrl, otherEdition, otherSource, third)])
    ).toEqual([group('top', first), group('more', second, otherSource, third)]);
  });

  it('keeps only the first of the duplicates inside the new page, also across its groups', () => {
    const thirdAgain = makeArticle('Third, updated', 'https://example.com/3');
    const thirdOtherEdition = makeArticle('third', 'https://example.com/regional/3');

    expect(
      appendGroups([group('top', first)], [group('more', third, thirdAgain), group('other', thirdOtherEdition, fourth)])
    ).toEqual([group('top', first), group('more', third), group('other', fourth)]);
  });

  it('returns the current list itself when it adds nothing', () => {
    const current = [group('top', first, second)];
    const duplicates = group(
      'more',
      makeArticle('Updated first', 'https://example.com/1'),
      makeArticle('SECOND', 'https://example.com/regional/2')
    );

    expect(appendGroups(current, [])).toBe(current);
    expect(appendGroups(current, [group('more')])).toBe(current);
    expect(appendGroups(current, [duplicates])).toBe(current);
    expect(appendGroups(current, [group('more', third)])).not.toBe(current);
  });

  it('drops an article with the title and source of one in the list only when published on the same day', () => {
    const daily = makeDatedArticle('Daily report', 'https://example.com/daily/23', '2026-09-23T07:00:00Z');
    const sameDay = makeDatedArticle('Daily report', 'https://example.com/regional/daily/23', '2026-09-23T18:00:00Z');
    const nextDay = makeDatedArticle('Daily report', 'https://example.com/daily/24', '2026-09-24T07:00:00Z');
    const current = [group('top', first, daily)];

    expect(appendGroups(current, [group('more', sameDay)])).toBe(current);
    expect(appendGroups(current, [group('more', sameDay, nextDay)])).toEqual([
      group('top', first, daily),
      group('more', nextDay),
    ]);
  });

  it('drops the second ANSA editions of a later page, as mapGroups does within one page', () => {
    const firstPage = mapGroups([
      { key: 'frontPages', articles: topHeadlinesItaly.articles },
      { key: 'latestAnsa', articles: everythingAnsa.articles.slice(0, 6) },
    ]);
    const nextPage = mapGroups([{ key: 'latestAnsa', articles: everythingAnsa.articles.slice(6) }]);
    const wholePage = mapGroups([
      { key: 'frontPages', articles: topHeadlinesItaly.articles },
      { key: 'latestAnsa', articles: everythingAnsa.articles },
    ]);

    expect(firstPage.flatMap((group) => group.articles)).toHaveLength(25);
    expect(nextPage.flatMap((group) => group.articles)).toHaveLength(3);
    expect(appendGroups(firstPage, nextPage)).toEqual(wholePage);
  });

  it('appends 9 of the 20 articles of the Italy more-news page, as a "moreNews" group, to the 27 of the first page', () => {
    const firstPage = mapGroups([
      { key: 'frontPages', articles: topHeadlinesItaly.articles },
      { key: 'latestAnsa', articles: everythingAnsa.articles },
    ]);
    const morePage = mapGroups([{ key: 'moreNews', articles: everythingItaly.articles }]);
    const appended = appendGroups(firstPage, morePage);
    // The first 10 articles of the page are those of everything-ansa.json, already in the list;
    // among the other 10, the Frosinone piece has two editions with the same title.
    const expectedAdded = everythingItaly.articles
      .slice(10)
      .filter((dto, index, page) => page.findIndex((other) => other.title === dto.title) === index)
      .map((dto) => dto.url);

    expect(firstPage.flatMap((group) => group.articles)).toHaveLength(27);
    expect(morePage.flatMap((group) => group.articles)).toHaveLength(16);
    expect(expectedAdded).toHaveLength(9);
    expect(appended).toHaveLength(3);
    expect(appended.slice(0, 2)).toEqual(firstPage);
    expect(appended[2].key).toBe('moreNews');
    expect(appended[2].articles.map((article) => article.id)).toEqual(expectedAdded);
    expect(appended[2].articles.filter((article) => article.title.startsWith('Frosinone'))).toHaveLength(1);
    expect(appended.flatMap((group) => group.articles)).toHaveLength(36);
  });

  it('appends all the 20 articles of the USA more-news page to the 35 of the first page and extends the group with the next page', () => {
    const firstPage = mapGroups([{ key: 'topHeadlines', articles: usaSection }]);
    const morePage = mapGroups([{ key: 'moreNews', articles: everythingUs.articles }]);
    const appended = appendGroups(firstPage, morePage);
    const nextPage = [group('moreNews', makeArticle('Another story', 'https://example.com/another', 'CNN'))];
    const extended = appendGroups(appended, nextPage);

    expect(appended.map((group) => [group.key, group.articles.length])).toEqual([
      ['topHeadlines', 35],
      ['moreNews', 20],
    ]);
    expect(appended[1].articles.map((article) => article.id)).toEqual(everythingUs.articles.map((dto) => dto.url));
    expect(extended.map((group) => [group.key, group.articles.length])).toEqual([
      ['topHeadlines', 35],
      ['moreNews', 21],
    ]);
    expect(extended[0]).toBe(appended[0]);
  });
});
