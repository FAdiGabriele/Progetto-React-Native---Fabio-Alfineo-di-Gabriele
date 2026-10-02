import { NewsError, type Article, type NewsPage, type SavedNews } from '@/domain/models/news-model';
import type { NewsRepository } from '@/domain/repositories/news-repository';
import { createLoadSectionNews } from '@/domain/use-cases/load-section-news';

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
    getSavedSectionArticles: jest.fn().mockResolvedValue(null),
  };
}

const PAGE: NewsPage = {
  groups: [{ key: 'frontPages', articles: [makeArticle('first'), makeArticle('second')] }],
  next: { page: 1 },
};

const SAVED: SavedNews = {
  groups: [{ key: 'latestAnsa', articles: [makeArticle('saved')] }],
  savedAt: new Date('2026-09-29T08:00:00Z'),
};

describe('createLoadSectionNews', () => {
  let repository: jest.Mocked<NewsRepository>;

  beforeEach(() => {
    repository = makeRepository();
  });

  it('asks the first page of the section with the signal of the request and returns it as it is', async () => {
    repository.getSectionArticles.mockResolvedValue(PAGE);
    const controller = new AbortController();

    const result = await createLoadSectionNews(repository)({
      section: 'usa',
      hasArticles: false,
      signal: controller.signal,
    });

    expect(result).toEqual({ ok: true, page: PAGE });
    expect(result.ok && result.page).toBe(PAGE);
    expect(repository.getSectionArticles.mock.calls).toEqual([['usa', controller.signal]]);
    expect(repository.getSectionArticles.mock.calls[0][1]).toBe(controller.signal);
    expect(repository.getSavedSectionArticles).not.toHaveBeenCalled();
  });

  it('returns a partial first page as it is, with its error, without reading the saved list', async () => {
    const partial: NewsPage = { ...PAGE, partialError: new NewsError('network') };
    repository.getSectionArticles.mockResolvedValue(partial);

    const result = await createLoadSectionNews(repository)({ section: 'italy', hasArticles: false });

    expect(result.ok && result.page).toBe(partial);
    expect(repository.getSavedSectionArticles).not.toHaveBeenCalled();
  });

  it('asks the first page without a signal when the request has none', async () => {
    repository.getSectionArticles.mockResolvedValue(PAGE);

    await createLoadSectionNews(repository)({ section: 'italy', hasArticles: true });

    expect(repository.getSectionArticles.mock.calls).toEqual([['italy', undefined]]);
  });

  it('returns the NewsError with the saved list of the section when the page fails without articles on screen', async () => {
    const error = new NewsError('timeout');
    repository.getSectionArticles.mockRejectedValue(error);
    repository.getSavedSectionArticles.mockResolvedValue(SAVED);

    const result = await createLoadSectionNews(repository)({ section: 'usa', hasArticles: false });

    expect(result).toEqual({ ok: false, error, saved: SAVED });
    expect(!result.ok && result.error).toBe(error);
    expect(!result.ok && result.saved).toBe(SAVED);
    expect(repository.getSavedSectionArticles.mock.calls).toEqual([['usa']]);
  });

  it('returns the NewsError with no saved list when the section has none', async () => {
    const error = new NewsError('network');
    repository.getSectionArticles.mockRejectedValue(error);

    const result = await createLoadSectionNews(repository)({ section: 'italy', hasArticles: false });

    expect(result).toEqual({ ok: false, error, saved: null });
    expect(repository.getSavedSectionArticles).toHaveBeenCalledTimes(1);
  });

  it('counts a saved list that cannot be read as none', async () => {
    const error = new NewsError('server');
    repository.getSectionArticles.mockRejectedValue(error);
    repository.getSavedSectionArticles.mockRejectedValue(new Error('storage read failed'));

    const result = await createLoadSectionNews(repository)({ section: 'italy', hasArticles: false });

    expect(result).toEqual({ ok: false, error, saved: null });
    expect(!result.ok && result.error).toBe(error);
  });

  it('returns the NewsError without reading the saved list when articles are on screen', async () => {
    const error = new NewsError('rateLimit');
    repository.getSectionArticles.mockRejectedValue(error);
    repository.getSavedSectionArticles.mockResolvedValue(SAVED);

    const result = await createLoadSectionNews(repository)({ section: 'italy', hasArticles: true });

    expect(result).toEqual({ ok: false, error, saved: null });
    expect(repository.getSavedSectionArticles).not.toHaveBeenCalled();
  });

  it('reports an error that is not a NewsError as an unknown NewsError, with the saved list', async () => {
    repository.getSectionArticles.mockRejectedValue(new TypeError('boom'));
    repository.getSavedSectionArticles.mockResolvedValue(SAVED);

    const result = await createLoadSectionNews(repository)({ section: 'italy', hasArticles: false });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBeInstanceOf(NewsError);
    expect(!result.ok && result.error.kind).toBe('unknown');
    expect(!result.ok && result.saved).toBe(SAVED);
  });

  it.each([false, true])(
    'rethrows unchanged the error of a cancelled request without reading the saved list, with articles on screen: %s',
    async (hasArticles) => {
      const controller = new AbortController();
      const abortError = createAbortError();
      repository.getSectionArticles.mockImplementation(async () => {
        controller.abort();
        throw abortError;
      });
      repository.getSavedSectionArticles.mockResolvedValue(SAVED);

      await expect(
        createLoadSectionNews(repository)({ section: 'italy', hasArticles, signal: controller.signal })
      ).rejects.toBe(abortError);
      expect(repository.getSavedSectionArticles).not.toHaveBeenCalled();
    }
  );

  it('rethrows unchanged even a NewsError once the request is cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const error = new NewsError('network');
    repository.getSectionArticles.mockRejectedValue(error);

    await expect(
      createLoadSectionNews(repository)({ section: 'usa', hasArticles: false, signal: controller.signal })
    ).rejects.toBe(error);
    expect(repository.getSavedSectionArticles).not.toHaveBeenCalled();
  });

  it('reports an AbortError as an unknown error when the request was not cancelled', async () => {
    const controller = new AbortController();
    repository.getSectionArticles.mockRejectedValue(createAbortError());

    const result = await createLoadSectionNews(repository)({
      section: 'italy',
      hasArticles: true,
      signal: controller.signal,
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.kind).toBe('unknown');
  });
});
