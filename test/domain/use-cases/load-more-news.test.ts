import { NewsError, type Article, type NewsGroup, type NewsPage } from '@/domain/models/news-model';
import type { NewsRepository } from '@/domain/repositories/news-repository';
import { createLoadMoreNews } from '@/domain/use-cases/load-more-news';

function makeArticle(slug: string): Article {
  const url = `https://example.com/${slug}`;
  return { id: url, title: `Title ${slug}`, url, sourceName: 'ANSA.it' };
}

function createAbortError(): Error {
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}

function makeRepository(): jest.Mocked<NewsRepository> {
  return {
    getSectionArticles: jest.fn().mockRejectedValue(new Error('Unexpected call to getSectionArticles')),
    getSavedSectionArticles: jest.fn().mockRejectedValue(new Error('Unexpected call to getSavedSectionArticles')),
  };
}

const first = makeArticle('first');
const second = makeArticle('second');
const third = makeArticle('third');
const fourth = makeArticle('fourth');
const fifth = makeArticle('fifth');

const FRONT_PAGES: NewsGroup = { key: 'frontPages', articles: [first, second] };
const MORE_NEWS: NewsGroup = { key: 'moreNews', articles: [third] };

// Articles of the list again: one by URL, one by title, source and day.
const DUPLICATES: NewsGroup = {
  key: 'moreNews',
  articles: [{ ...first, title: 'Updated title' }, { ...makeArticle('regional/second'), title: 'Title second' }],
};

function morePage(articles: Article[], next?: number): NewsPage {
  const groups: NewsGroup[] = articles.length === 0 ? [] : [{ key: 'moreNews', articles }];
  return next === undefined ? { groups } : { groups, next: { page: next } };
}

function pagesAsked(repository: jest.Mocked<NewsRepository>): (number | undefined)[] {
  return repository.getSectionArticles.mock.calls.map(([, , cursor]) => cursor?.page);
}

describe('createLoadMoreNews', () => {
  let repository: jest.Mocked<NewsRepository>;
  let list: NewsGroup[];

  beforeEach(() => {
    repository = makeRepository();
    list = [FRONT_PAGES];
  });

  it('asks the page of the cursor with the section and the signal and appends its articles to the list', async () => {
    repository.getSectionArticles.mockResolvedValueOnce(morePage([third, fourth], 3));
    const controller = new AbortController();
    const cursor = { page: 2 };

    const result = await createLoadMoreNews(repository)({
      section: 'usa',
      groups: list,
      cursor,
      signal: controller.signal,
    });

    expect(result).toEqual({
      ok: true,
      groups: [FRONT_PAGES, { key: 'moreNews', articles: [third, fourth] }],
      cursor: { page: 3 },
    });
    expect(repository.getSectionArticles.mock.calls).toEqual([['usa', controller.signal, { page: 2 }]]);
    expect(repository.getSectionArticles.mock.calls[0][1]).toBe(controller.signal);
    expect(list).toEqual([FRONT_PAGES]);
    expect(repository.getSavedSectionArticles).not.toHaveBeenCalled();
  });

  it('extends the last group of the list when the page has its key', async () => {
    repository.getSectionArticles.mockResolvedValueOnce(morePage([fourth], 4));

    const result = await createLoadMoreNews(repository)({
      section: 'italy',
      groups: [FRONT_PAGES, MORE_NEWS],
      cursor: { page: 3 },
    });

    expect(result).toEqual({
      ok: true,
      groups: [FRONT_PAGES, { key: 'moreNews', articles: [third, fourth] }],
      cursor: { page: 4 },
    });
  });

  it('returns no cursor after the last page', async () => {
    repository.getSectionArticles.mockResolvedValueOnce(morePage([third]));

    const result = await createLoadMoreNews(repository)({ section: 'italy', groups: list, cursor: { page: 5 } });

    expect(result.ok).toBe(true);
    expect(result.cursor).toBeUndefined();
    expect(result.ok && result.groups).toEqual([FRONT_PAGES, MORE_NEWS]);
  });

  it('appends only the articles that are not duplicates of the list', async () => {
    repository.getSectionArticles.mockResolvedValueOnce({ groups: [{ ...DUPLICATES, articles: [...DUPLICATES.articles, third] }] });

    const result = await createLoadMoreNews(repository)({ section: 'italy', groups: list, cursor: { page: 1 } });

    expect(result.ok && result.groups).toEqual([FRONT_PAGES, MORE_NEWS]);
    expect(repository.getSectionArticles).toHaveBeenCalledTimes(1);
  });

  it('asks the following page at once, with the same signal, when a page adds only duplicates', async () => {
    repository.getSectionArticles
      .mockResolvedValueOnce({ groups: [DUPLICATES], next: { page: 2 } })
      .mockResolvedValueOnce(morePage([third], 3));
    const controller = new AbortController();

    const result = await createLoadMoreNews(repository)({
      section: 'italy',
      groups: list,
      cursor: { page: 1 },
      signal: controller.signal,
    });

    expect(result).toEqual({ ok: true, groups: [FRONT_PAGES, MORE_NEWS], cursor: { page: 3 } });
    expect(repository.getSectionArticles.mock.calls).toEqual([
      ['italy', controller.signal, { page: 1 }],
      ['italy', controller.signal, { page: 2 }],
    ]);
  });

  it('asks the following page at once when a page has no groups', async () => {
    repository.getSectionArticles.mockResolvedValueOnce(morePage([], 2)).mockResolvedValueOnce(morePage([third]));

    const result = await createLoadMoreNews(repository)({ section: 'usa', groups: list, cursor: { page: 1 } });

    expect(result).toEqual({ ok: true, groups: [FRONT_PAGES, MORE_NEWS], cursor: undefined });
    expect(pagesAsked(repository)).toEqual([1, 2]);
  });

  it('follows the pages that add nothing until one adds articles', async () => {
    repository.getSectionArticles
      .mockResolvedValueOnce(morePage([], 3))
      .mockResolvedValueOnce({ groups: [DUPLICATES], next: { page: 4 } })
      .mockResolvedValueOnce(morePage([first], 5))
      .mockResolvedValueOnce(morePage([fourth, fifth], 6));

    const result = await createLoadMoreNews(repository)({ section: 'italy', groups: list, cursor: { page: 2 } });

    expect(result).toEqual({
      ok: true,
      groups: [FRONT_PAGES, { key: 'moreNews', articles: [fourth, fifth] }],
      cursor: { page: 6 },
    });
    expect(pagesAsked(repository)).toEqual([2, 3, 4, 5]);
  });

  it('returns the same list, without a cursor, when the pages up to the last one add nothing', async () => {
    repository.getSectionArticles
      .mockResolvedValueOnce(morePage([], 2))
      .mockResolvedValueOnce({ groups: [DUPLICATES], next: { page: 3 } })
      .mockResolvedValueOnce({ groups: [DUPLICATES] });

    const result = await createLoadMoreNews(repository)({ section: 'italy', groups: list, cursor: { page: 1 } });

    expect(result.ok).toBe(true);
    expect(result.ok && result.groups).toBe(list);
    expect(result.cursor).toBeUndefined();
    expect(pagesAsked(repository)).toEqual([1, 2, 3]);
  });

  it('returns the same list without a cursor when the only page left has no groups', async () => {
    repository.getSectionArticles.mockResolvedValueOnce({ groups: [] });

    const result = await createLoadMoreNews(repository)({ section: 'usa', groups: list, cursor: { page: 5 } });

    expect(result).toEqual({ ok: true, groups: list, cursor: undefined });
    expect(result.ok && result.groups).toBe(list);
    expect(repository.getSectionArticles).toHaveBeenCalledTimes(1);
  });

  it('returns the NewsError with the cursor it started from when the first page fails', async () => {
    const error = new NewsError('rateLimit');
    repository.getSectionArticles.mockRejectedValueOnce(error);
    const cursor = { page: 3 };

    const result = await createLoadMoreNews(repository)({ section: 'italy', groups: list, cursor });

    expect(result).toEqual({ ok: false, error, cursor: { page: 3 } });
    expect(!result.ok && result.error).toBe(error);
  });

  it('returns the NewsError with the cursor of the page that failed in the middle of the chain', async () => {
    const error = new NewsError('network');
    repository.getSectionArticles
      .mockResolvedValueOnce({ groups: [DUPLICATES], next: { page: 2 } })
      .mockResolvedValueOnce(morePage([], 3))
      .mockRejectedValueOnce(error);

    const result = await createLoadMoreNews(repository)({ section: 'italy', groups: list, cursor: { page: 1 } });

    expect(result).toEqual({ ok: false, error, cursor: { page: 3 } });
    expect(pagesAsked(repository)).toEqual([1, 2, 3]);
  });

  it('reports an error that is not a NewsError as an unknown NewsError', async () => {
    repository.getSectionArticles.mockRejectedValueOnce(new TypeError('boom'));

    const result = await createLoadMoreNews(repository)({ section: 'usa', groups: list, cursor: { page: 2 } });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBeInstanceOf(NewsError);
    expect(!result.ok && result.error.kind).toBe('unknown');
    expect(result.cursor).toEqual({ page: 2 });
  });

  it('rethrows unchanged the error of a cancelled request', async () => {
    const controller = new AbortController();
    const abortError = createAbortError();
    repository.getSectionArticles.mockImplementationOnce(async () => {
      controller.abort();
      throw abortError;
    });

    await expect(
      createLoadMoreNews(repository)({ section: 'italy', groups: list, cursor: { page: 1 }, signal: controller.signal })
    ).rejects.toBe(abortError);
  });

  it('rethrows unchanged the error of a request cancelled in the middle of the chain, asking nothing more', async () => {
    const controller = new AbortController();
    const error = new NewsError('network');
    repository.getSectionArticles
      .mockResolvedValueOnce(morePage([], 2))
      .mockImplementationOnce(async () => {
        controller.abort();
        throw error;
      });

    await expect(
      createLoadMoreNews(repository)({ section: 'italy', groups: list, cursor: { page: 1 }, signal: controller.signal })
    ).rejects.toBe(error);
    expect(pagesAsked(repository)).toEqual([1, 2]);
  });
});
