import { NEWS_MAX_RESULTS } from '@/constants/config';
import { NEWS_SECTIONS, type NewsGroupKey, type NewsSectionKey } from '@/constants/news-sections';
import { mapGroups } from '@/repositories/news-mapper';
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

type SectionPage = NewsPage<NewsGroupKey>;

const FIRST_PAGE = 1;

function getSection(sectionKey: NewsSectionKey): NewsSection {
  const section = NEWS_SECTIONS.find((candidate) => candidate.key === sectionKey);
  if (section === undefined) {
    throw new Error(`Unknown news section: ${sectionKey}`);
  }
  return section;
}

// The NewsAPI codes that say more than the HTTP status they come with.
function toCodeErrorKind(code: string | undefined): NewsErrorKind | undefined {
  switch (code) {
    case 'rateLimited':
      return 'rateLimit';
    case 'apiKeyExhausted':
      return 'quotaExhausted';
    case 'maximumResultsReached':
      return 'resultsLimit';
    default:
      return undefined;
  }
}

function toStatusErrorKind(status: number | undefined): NewsErrorKind {
  switch (status) {
    case 400:
      return 'badRequest';
    case 401:
      return 'auth';
    case 429:
      return 'rateLimit';
    default:
      return status !== undefined && status >= 500 && status <= 599 ? 'server' : 'unknown';
  }
}

function toHttpErrorKind(error: NewsApiServiceError): NewsErrorKind {
  return toCodeErrorKind(error.code) ?? toStatusErrorKind(error.status);
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
      return toHttpErrorKind(error);
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

// The groups of the first page of a section: one per request, with its article DTOs.
function toFirstPageGroups(section: NewsSection, requestArticles: readonly NewsApiArticleDto[][]) {
  return mapGroups(
    section.requests.map(({ group }, index) => ({ key: group, articles: requestArticles[index] }))
  );
}

async function saveEntry(sectionKey: string, requests: NewsApiArticleDto[][]): Promise<void> {
  try {
    await writeEntry(sectionKey, { savedAt: new Date().toISOString(), requests });
  } catch {
    // A page that cannot be saved is still a valid page.
  }
}

async function getFirstPage(section: NewsSection, signal?: AbortSignal): Promise<SectionPage> {
  const results = await Promise.allSettled(
    section.requests.map(({ request }) => getArticles(request, signal))
  );

  const failures = results.filter((result) => result.status === 'rejected');
  let partialError: NewsError | undefined;
  if (failures.length > 0) {
    const failure = toThrowable(failures[0].reason, signal);
    // Every request failed, or the caller cancelled: there is no page to return.
    if (failures.length === results.length || !(failure instanceof NewsError)) {
      throw failure;
    }
    partialError = failure;
  }

  // The article DTOs of every request, in section order; none for a failed request.
  const requestArticles = results.map((result) =>
    result.status === 'fulfilled' ? result.value.articles : []
  );
  const groups = toFirstPageGroups(section, requestArticles);
  // A partial page does not replace the complete list saved by an earlier load.
  if (groups.length > 0 && partialError === undefined) {
    await saveEntry(section.key, requestArticles);
  }

  const page: SectionPage =
    section.moreRequest === undefined ? { groups } : { groups, next: { page: FIRST_PAGE } };
  return partialError === undefined ? page : { ...page, partialError };
}

async function getMorePage(
  section: NewsSection,
  cursor: NewsPageCursor,
  signal?: AbortSignal
): Promise<SectionPage> {
  const more = section.moreRequest;
  if (more === undefined) {
    return { groups: [] };
  }

  let page: NewsApiPageDto;
  try {
    page = await getArticles(withPage(more.request, cursor.page), signal);
  } catch (error) {
    throw toThrowable(error, signal);
  }

  const groups = mapGroups([{ key: more.group, articles: page.articles }]);
  return hasMorePages(cursor.page, more.request.pageSize, page.totalResults)
    ? { groups, next: { page: cursor.page + 1 } }
    : { groups };
}

/**
 * Fetches one page of a news section. Without a cursor it fetches the first page: the
 * requests of the section run in parallel with the same `signal` and the articles of the
 * successful ones form the groups of the page, one per request in section order, without
 * the empty ones; it rejects with a NewsError only when every request fails, translating the
 * error of the first one, while a page with some failed requests carries the translated
 * error of the first one in `partialError`. A first page with every request successful and
 * at least one article is saved as the last list of the section before being returned,
 * ignoring a failed save; a partial page leaves the saved list untouched. The cursor of the
 * result points to page 1 of the more-news request of the section, when it has one. With a
 * cursor it fetches that page of the more-news request alone, as the group of that request,
 * and returns the cursor of the following page, or none when the request is exhausted; a
 * failed request rejects with its NewsError, so a later call can retry the same page. A
 * cancellation requested through `signal` is rethrown unchanged.
 */
export async function getSectionArticles(
  sectionKey: NewsSectionKey,
  signal?: AbortSignal,
  cursor?: NewsPageCursor
): Promise<SectionPage> {
  const section = getSection(sectionKey);
  return cursor === undefined ? getFirstPage(section, signal) : getMorePage(section, cursor, signal);
}

/**
 * Last saved list of a news section, with one group per request of its first page, or null
 * when there is none, its instant cannot be parsed, it was saved with a different list of
 * requests or no article survives the mapping.
 */
export async function getSavedSectionArticles(
  sectionKey: NewsSectionKey
): Promise<SavedNews<NewsGroupKey> | null> {
  const section = getSection(sectionKey);
  const entry = await readEntry(sectionKey);
  if (entry === null) {
    return null;
  }
  const savedAt = parseIsoDate(entry.savedAt);
  if (savedAt === undefined || entry.requests.length !== section.requests.length) {
    return null;
  }
  const groups = toFirstPageGroups(section, entry.requests);
  return groups.length > 0 ? { groups, savedAt } : null;
}
