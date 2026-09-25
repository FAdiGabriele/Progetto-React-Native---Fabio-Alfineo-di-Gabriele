import { NEWS_SECTIONS, type NewsSectionKey } from '@/constants/news-sections';
import { mapArticles } from '@/repositories/news-mapper';
import { NewsError, type Article, type NewsErrorKind } from '@/repositories/news-model';
import type { NewsApiRequestDto } from '@/services/news-api-dto';
import { getArticles, NewsApiServiceError } from '@/services/news-api-service';

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

/**
 * Fetches the articles of a news section: its requests run in parallel with the same
 * `signal` and the articles of the successful ones are merged in section order.
 * Rejects with a NewsError only when every request fails, translating the error of the
 * first request; a cancellation requested through `signal` is rethrown unchanged.
 */
export async function getSectionArticles(
  sectionKey: NewsSectionKey,
  signal?: AbortSignal
): Promise<Article[]> {
  const requests = getSectionRequests(sectionKey);
  const results = await Promise.allSettled(requests.map((request) => getArticles(request, signal)));

  const failures = results.filter((result) => result.status === 'rejected');
  if (failures.length > 0 && failures.length === results.length) {
    const firstError: unknown = failures[0].reason;
    if (isCancellation(firstError, signal)) {
      throw firstError;
    }
    throw toNewsError(firstError);
  }

  const dtos = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
  return mapArticles(dtos);
}
