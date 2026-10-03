import { NewsError, type NewsPage, type NewsSectionKey, type SavedNews } from '@/domain/models/news-model';
import type { NewsRepository } from '@/domain/repositories/news-repository';

export type LoadSectionNewsRequest = {
  section: NewsSectionKey;
  /** Whether the caller already shows articles of the section. */
  hasArticles: boolean;
  signal?: AbortSignal;
};

/**
 * Outcome of the load of the first page of a section: the page, or the error with the saved
 * list that takes the place of the articles, null when there is none or it is not needed.
 */
export type LoadSectionNewsResult =
  | { ok: true; page: NewsPage }
  | { ok: false; error: NewsError; saved: SavedNews | null };

export type LoadSectionNews = (request: LoadSectionNewsRequest) => Promise<LoadSectionNewsResult>;

/**
 * Builds the use case that loads the first page of a news section. When the page cannot be
 * loaded and the caller shows no articles, the saved list of the section, when there is one,
 * comes with the error; with articles on screen it is not read, and a saved list that cannot
 * be read counts as none. A cancellation requested through `signal` is rethrown unchanged.
 */
export function createLoadSectionNews(repository: NewsRepository): LoadSectionNews {
  return async ({ section, hasArticles, signal }) => {
    try {
      return { ok: true, page: await repository.getSectionArticles(section, signal) };
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
      const saved = hasArticles
        ? null
        : await repository.getSavedSectionArticles(section).catch(() => null);
      return { ok: false, error: NewsError.from(error), saved };
    }
  };
}
