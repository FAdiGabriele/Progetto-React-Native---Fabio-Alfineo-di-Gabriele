import type { NewsApiArticleDto } from '@/services/news-api-dto';
import type { Article } from '@/repositories/news-model';
import { getUrlDomain, isHttpUrl } from '@/utils/url';
import { parseIsoDate } from '@/utils/date';

const REMOVED_TITLE = '[Removed]';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toTrimmedOrUndefined(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

// NewsAPI sometimes sends the text "null" instead of a null value.
function toOptionalText(value: unknown): string | undefined {
  const trimmed = toTrimmedOrUndefined(value);
  return trimmed === 'null' ? undefined : trimmed;
}

function mapArticle(dto: unknown): Article | undefined {
  if (!isRecord(dto)) {
    return undefined;
  }

  const title = toTrimmedOrUndefined(dto.title);
  if (title === undefined || title === REMOVED_TITLE) {
    return undefined;
  }

  const rawUrl = dto.url;
  if (typeof rawUrl !== 'string' || !isHttpUrl(rawUrl)) {
    return undefined;
  }
  const url = rawUrl.trim();

  const source = isRecord(dto.source) ? dto.source : undefined;
  const sourceName = toTrimmedOrUndefined(source?.name) ?? getUrlDomain(url) ?? url;

  const publishedAt = typeof dto.publishedAt === 'string' ? parseIsoDate(dto.publishedAt) : undefined;

  return {
    id: url,
    title,
    description: toOptionalText(dto.description),
    url,
    imageUrl: toOptionalText(dto.urlToImage),
    sourceName,
    author: toOptionalText(dto.author),
    publishedAt,
  };
}

function normalizeForComparison(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

// Two articles are duplicates when they share a key: the same URL, or the same title from the same source.
function getDuplicateKeys(article: Article): string[] {
  return [
    JSON.stringify(['url', article.id]),
    JSON.stringify(['title', normalizeForComparison(article.sourceName), normalizeForComparison(article.title)]),
  ];
}

// Keeps the candidates that are not duplicates of an existing article or of any earlier candidate.
function withoutDuplicates(existing: readonly Article[], candidates: readonly Article[]): Article[] {
  const seenKeys = new Set(existing.flatMap(getDuplicateKeys));
  return candidates.filter((article) => {
    const keys = getDuplicateKeys(article);
    const isDuplicate = keys.some((key) => seenKeys.has(key));
    keys.forEach((key) => seenKeys.add(key));
    return !isDuplicate;
  });
}

/**
 * Converts the article DTOs of a news section, already concatenated in request order,
 * into domain articles: invalid or removed articles are dropped, optional fields are
 * normalized and duplicates, by URL or by title and source, keep their first occurrence.
 */
export function mapArticles(dtos: readonly NewsApiArticleDto[]): Article[] {
  const articles = dtos.map(mapArticle).filter((article) => article !== undefined);
  return withoutDuplicates([], articles);
}

/**
 * Appends to the list the articles of a later page that are not duplicates of an article
 * already in the list or of an earlier one of the page; without additions it returns the
 * same list.
 */
export function appendArticles(current: Article[], incoming: readonly Article[]): Article[] {
  const added = withoutDuplicates(current, incoming);
  return added.length === 0 ? current : [...current, ...added];
}
