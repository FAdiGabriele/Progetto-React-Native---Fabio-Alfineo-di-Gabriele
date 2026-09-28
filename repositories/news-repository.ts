import { NEWS_MAX_RESULTS } from '@/constants/config';
import { NEWS_SECTIONS, type NewsSectionKey } from '@/constants/news-sections';
import { mapArticles } from '@/repositories/news-mapper';
import {
  NewsError,
  type NewsErrorKind,
  type NewsPage,
  type NewsPageCursor,
  type SavedNews,
} from '@/repositories/news-model';
import type { NewsApiArticleDto, NewsApiRequestDto } from '@/services/news-api-dto';
import { getArticles, NewsApiServiceError } from '@/services/news-api-service';
import { readEntry, writeEntry } from '@/services/news-cache-service';
import { parseIsoDate } from '@/utils/date';

const FIRST_PAGE = 1;

function getSectionRequests(sectionKey: NewsSectionKey): readonly NewsApiRequestDto[] {
  const section = NEWS_SECTIONS.find((candidate) => candidate.key === sectionKey);
  if (section === undefined) {
    throw new Error(`Unknown news section: ${sectionKey}`);
  }
  return section.requests;
}

function toHttpErrorKind(status: number | undefined): NewsErrorKind {
  switch (status) {
    case 400:
      return 'badRequest';
    case 401:
      return 'auth';
    case 429:
      return 'rateLimit';
    case 500:
      return 'server';
    default:
      return 'unknown';
  }
}

function toNewsErrorKind(error: NewsApiServiceError): NewsErrorKind {
  switch (error.reason) {
    case 'missingKey':
      return 'auth';
    case 'network':
      return 'network';
    case 'timeout':
      return 'timeout';
    case 'http':
      return toHttpErrorKind(error.status);
    case 'invalidResponse':
      return 'unknown';
  }
}

function toNewsError(error: unknown): NewsError {
  const kind = error instanceof NewsApiServiceError ? toNewsErrorKind(error) : 'unknown';
  const newsError = new NewsError(kind);
  newsError.cause = error;
  return newsError;
}

// Only errors that are not transport errors can be cancellations.
function isCancellation(error: unknown, signal?: AbortSignal): boolean {
  if (error instanceof NewsApiServiceError) {
    return false;
  }
  return signal?.aborted === true || (error instanceof Error && error.name === 'AbortError');
}

// The first page sends no page parameter.
function withPage(request: NewsApiRequestDto, page: number): NewsApiRequestDto {
  return page === FIRST_PAGE ? request : { ...request, page };
}

function hasMorePages(page: number, pageSize: number, totalResults: number): boolean {
  const received = page * pageSize;
  return received < totalResults && received < NEWS_MAX_RESULTS;
}

async function saveEntry(sectionKey: string, articles: NewsApiArticleDto[]): Promise<void> {
  try {
    await writeEntry(sectionKey, { savedAt: new Date().toISOString(), articles });
  } catch {
    // A page that cannot be saved is still a valid page.
  }
}

/**
 * Fetches one page of a news section: without a cursor the first page of every request
 * of the section, with a cursor the page it indicates for each request that still has
 * results. The requests run in parallel with the same `signal` and the articles of the
 * successful ones are merged in section order; a failed request keeps its page in the
 * cursor, so a later call retries it. Rejects with a NewsError only when every request
 * asked fails, translating the error of the first one; a cancellation requested through
 * `signal` is rethrown unchanged. A first page with at least one article is saved as the
 * last list of the section before being returned, ignoring a failed save.
 */
export async function getSectionArticles(
  sectionKey: NewsSectionKey,
  signal?: AbortSignal,
  cursor?: NewsPageCursor
): Promise<NewsPage> {
  const requests = getSectionRequests(sectionKey);
  const pages = requests.map((_, index) => (cursor === undefined ? FIRST_PAGE : cursor.pages[index]));
  const asked = pages.flatMap((page, index) => (page === undefined ? [] : [{ index, page }]));

  const results = await Promise.allSettled(
    asked.map(({ index, page }) => getArticles(withPage(requests[index], page), signal))
  );

  const failures = results.filter((result) => result.status === 'rejected');
  if (failures.length > 0 && failures.length === results.length) {
    const firstError: unknown = failures[0].reason;
    if (isCancellation(firstError, signal)) {
      throw firstError;
    }
    throw toNewsError(firstError);
  }

  const nextPages = [...pages];
  asked.forEach(({ index, page }, position) => {
    const result = results[position];
    if (result.status === 'fulfilled') {
      const { pageSize } = requests[index];
      nextPages[index] = hasMorePages(page, pageSize, result.value.totalResults) ? page + 1 : undefined;
    }
  });

  const dtos = results.flatMap((result) =>
    result.status === 'fulfilled' ? result.value.articles : []
  );
  const articles = mapArticles(dtos);
  if (cursor === undefined && articles.length > 0) {
    await saveEntry(sectionKey, dtos);
  }

  const hasNext = nextPages.some((page) => page !== undefined);
  return hasNext ? { articles, next: { pages: nextPages } } : { articles };
}

/**
 * Last saved list of a news section, or null when there is none, its instant cannot be
 * parsed or no article survives the mapping.
 */
export async function getSavedSectionArticles(sectionKey: NewsSectionKey): Promise<SavedNews | null> {
  const entry = await readEntry(sectionKey);
  if (entry === null) {
    return null;
  }
  const savedAt = parseIsoDate(entry.savedAt);
  if (savedAt === undefined) {
    return null;
  }
  const articles = mapArticles(entry.articles);
  return articles.length > 0 ? { articles, savedAt } : null;
}
