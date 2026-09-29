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
import type { NewsApiArticleDto, NewsApiPageDto, NewsApiRequestDto } from '@/services/news-api-dto';
import { getArticles, NewsApiServiceError } from '@/services/news-api-service';
import { readEntry, writeEntry } from '@/services/news-cache-service';
import { parseIsoDate } from '@/utils/date';

type NewsSection = (typeof NEWS_SECTIONS)[number];

const FIRST_PAGE = 1;

function getSection(sectionKey: NewsSectionKey): NewsSection {
  const section = NEWS_SECTIONS.find((candidate) => candidate.key === sectionKey);
  if (section === undefined) {
    throw new Error(`Unknown news section: ${sectionKey}`);
  }
  return section;
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

// A cancellation is rethrown unchanged; any other error becomes a NewsError.
function toThrowable(error: unknown, signal?: AbortSignal): unknown {
  return isCancellation(error, signal) ? error : toNewsError(error);
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

async function getFirstPage(section: NewsSection, signal?: AbortSignal): Promise<NewsPage> {
  const results = await Promise.allSettled(
    section.requests.map((request) => getArticles(request, signal))
  );

  const failures = results.filter((result) => result.status === 'rejected');
  if (failures.length > 0 && failures.length === results.length) {
    throw toThrowable(failures[0].reason, signal);
  }

  const dtos = results.flatMap((result) =>
    result.status === 'fulfilled' ? result.value.articles : []
  );
  const articles = mapArticles(dtos);
  if (articles.length > 0) {
    await saveEntry(section.key, dtos);
  }

  return section.moreRequest === undefined ? { articles } : { articles, next: { page: FIRST_PAGE } };
}

async function getMorePage(
  section: NewsSection,
  cursor: NewsPageCursor,
  signal?: AbortSignal
): Promise<NewsPage> {
  const request = section.moreRequest;
  if (request === undefined) {
    return { articles: [] };
  }

  let page: NewsApiPageDto;
  try {
    page = await getArticles(withPage(request, cursor.page), signal);
  } catch (error) {
    throw toThrowable(error, signal);
  }

  const articles = mapArticles(page.articles);
  return hasMorePages(cursor.page, request.pageSize, page.totalResults)
    ? { articles, next: { page: cursor.page + 1 } }
    : { articles };
}

/**
 * Fetches one page of a news section. Without a cursor it fetches the first page: the
 * requests of the section run in parallel with the same `signal` and the articles of the
 * successful ones are merged in section order; it rejects with a NewsError only when every
 * request fails, translating the error of the first one, and a first page with at least one
 * article is saved as the last list of the section before being returned, ignoring a failed
 * save. The cursor of the result points to page 1 of the more-news request of the section,
 * when it has one. With a cursor it fetches that page of the more-news request alone and
 * returns the cursor of the following page, or none when the request is exhausted; a failed
 * request rejects with its NewsError, so a later call can retry the same page. A cancellation
 * requested through `signal` is rethrown unchanged.
 */
export async function getSectionArticles(
  sectionKey: NewsSectionKey,
  signal?: AbortSignal,
  cursor?: NewsPageCursor
): Promise<NewsPage> {
  const section = getSection(sectionKey);
  return cursor === undefined ? getFirstPage(section, signal) : getMorePage(section, cursor, signal);
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
