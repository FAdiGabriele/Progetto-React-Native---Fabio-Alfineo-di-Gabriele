import type { NewsPage, NewsPageCursor, NewsSectionKey, SavedNews } from '@/domain/models/news-model';

/** Access to the news of the sections: the port that the data layer implements. */
export interface NewsRepository {
  /**
   * One page of a news section. Without a cursor, the first page: the groups of its requests
   * in section order, with `partialError` when only some of them failed, and the cursor of
   * its more news, when the section has them. With a cursor, that page of the more news of
   * the section and the cursor of the following one, absent after the last page. Rejects with
   * a NewsError when the page cannot be loaded, so that a later call can ask for it again; a
   * cancellation requested through `signal` is rethrown unchanged.
   */
  getSectionArticles(
    section: NewsSectionKey,
    signal?: AbortSignal,
    cursor?: NewsPageCursor
  ): Promise<NewsPage>;

  /** Last saved list of a news section, or null when there is none to show. */
  getSavedSectionArticles(section: NewsSectionKey): Promise<SavedNews | null>;
}
