import { appendGroups } from '@/domain/models/news-groups';
import {
  NewsError,
  type NewsGroup,
  type NewsPage,
  type NewsPageCursor,
  type NewsSectionKey,
} from '@/domain/models/news-model';
import type { NewsRepository } from '@/domain/repositories/news-repository';

export type LoadMoreNewsRequest = {
  section: NewsSectionKey;
  /** Groups of the list the caller shows: the more news are appended to them. */
  groups: NewsGroup[];
  cursor: NewsPageCursor;
  signal?: AbortSignal;
};

/**
 * Outcome of the load of more news: the list with the new articles appended and the cursor of
 * the following page, absent after the last one, or the error with the cursor of the page
 * that failed, to ask for it again.
 */
export type LoadMoreNewsResult =
  | { ok: true; groups: NewsGroup[]; cursor?: NewsPageCursor }
  | { ok: false; error: NewsError; cursor: NewsPageCursor };

export type LoadMoreNews = (request: LoadMoreNewsRequest) => Promise<LoadMoreNewsResult>;

/**
 * Builds the use case that loads the next page of the more news of a section and appends its
 * articles to the list, without duplicates. A page that adds nothing is followed at once by
 * the next one, until a page adds articles, fails or is the last; when the last page adds
 * nothing either, the list comes back as it was, the same array. A cancellation requested
 * through `signal` is rethrown unchanged.
 */
export function createLoadMoreNews(repository: NewsRepository): LoadMoreNews {
  return async ({ section, groups, cursor, signal }) => {
    let pageCursor = cursor;
    for (;;) {
      let page: NewsPage;
      try {
        page = await repository.getSectionArticles(section, signal, pageCursor);
      } catch (error) {
        if (signal?.aborted) {
          throw error;
        }
        return { ok: false, error: NewsError.from(error), cursor: pageCursor };
      }
      const appended = appendGroups(groups, page.groups);
      if (appended !== groups || page.next === undefined) {
        return { ok: true, groups: appended, cursor: page.next };
      }
      pageCursor = page.next;
    }
  };
}
