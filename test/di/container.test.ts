import { appInfoRepository, languageRepository, newsUseCases, themeRepository } from '@/di/container';
import { appInfoRepository as dataAppInfoRepository } from '@/data/repositories/app-info-repository';
import { languageRepository as dataLanguageRepository } from '@/data/repositories/language-repository';
import { newsRepository } from '@/data/repositories/news-repository';
import { themeRepository as dataThemeRepository } from '@/data/repositories/theme-repository';
import { openInBrowser } from '@/data/services/browser-service';
import { NewsError, type Article, type NewsGroup, type SavedNews } from '@/domain/models/news-model';

jest.mock('@/data/repositories/news-repository', () => ({
  newsRepository: { getSectionArticles: jest.fn(), getSavedSectionArticles: jest.fn() },
}));
jest.mock('@/data/repositories/language-repository', () => ({
  languageRepository: { getSavedLanguage: jest.fn(), saveLanguage: jest.fn() },
}));
jest.mock('@/data/repositories/theme-repository', () => ({
  themeRepository: { getSavedTheme: jest.fn(), saveTheme: jest.fn() },
}));
jest.mock('@/data/repositories/app-info-repository', () => ({ appInfoRepository: { getAppVersion: jest.fn() } }));
jest.mock('@/data/services/browser-service', () => ({ openInBrowser: jest.fn() }));

const getSectionArticlesMock = jest.mocked(newsRepository.getSectionArticles);
const getSavedSectionArticlesMock = jest.mocked(newsRepository.getSavedSectionArticles);
const openInBrowserMock = jest.mocked(openInBrowser);

function makeArticle(slug: string): Article {
  const url = `https://example.com/${slug}`;
  return { id: url, title: `Title ${slug}`, url, sourceName: 'ANSA.it' };
}

const TOP_HEADLINES: NewsGroup = { key: 'topHeadlines', articles: [makeArticle('first')] };

beforeEach(() => {
  jest.resetAllMocks();
});

describe('newsUseCases', () => {
  it('loads the first page of a section with the news repository and its saved list when the page fails', async () => {
    const error = new NewsError('network');
    const saved: SavedNews = { groups: [TOP_HEADLINES], savedAt: new Date('2026-09-29T08:00:00Z') };
    getSectionArticlesMock.mockRejectedValueOnce(error);
    getSavedSectionArticlesMock.mockResolvedValueOnce(saved);
    const controller = new AbortController();

    const result = await newsUseCases.loadSectionNews({ section: 'usa', hasArticles: false, signal: controller.signal });

    expect(result).toEqual({ ok: false, error, saved });
    expect(getSectionArticlesMock.mock.calls).toEqual([['usa', controller.signal]]);
    expect(getSavedSectionArticlesMock.mock.calls).toEqual([['usa']]);
  });

  it('loads more news with the news repository, asking the page of the cursor', async () => {
    const more = makeArticle('more');
    getSectionArticlesMock.mockResolvedValueOnce({ groups: [{ key: 'moreNews', articles: [more] }], next: { page: 3 } });
    const controller = new AbortController();

    const result = await newsUseCases.loadMoreNews({
      section: 'usa',
      groups: [TOP_HEADLINES],
      cursor: { page: 2 },
      signal: controller.signal,
    });

    expect(result).toEqual({
      ok: true,
      groups: [TOP_HEADLINES, { key: 'moreNews', articles: [more] }],
      cursor: { page: 3 },
    });
    expect(getSectionArticlesMock.mock.calls).toEqual([['usa', controller.signal, { page: 2 }]]);
    expect(getSavedSectionArticlesMock).not.toHaveBeenCalled();
  });

  it('opens an article with the browser service', async () => {
    const article = makeArticle('opened');
    openInBrowserMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(newsUseCases.openArticle(article)).resolves.toBe('opened');
    await expect(newsUseCases.openArticle(article)).resolves.toBe('failed');

    expect(openInBrowserMock.mock.calls).toEqual([[article.url], [article.url]]);
    expect(getSectionArticlesMock).not.toHaveBeenCalled();
  });
});

describe('the repositories of the container', () => {
  it('are the ones of the data layer', () => {
    expect(languageRepository).toBe(dataLanguageRepository);
    expect(themeRepository).toBe(dataThemeRepository);
    expect(appInfoRepository).toBe(dataAppInfoRepository);
  });
});
