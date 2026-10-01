import type { NewsApiArticleDto } from '@/services/news-api-dto';
import type { Article, NewsGroup } from '@/repositories/news-model';
import { getUrlDomain, isHttpUrl } from '@/utils/url';
import { parseIsoDate } from '@/utils/date';

const REMOVED_TITLE = '[Removed]';

// NewsAPI appends " - <source>" to the titles of the top headlines of a country, and some
// outlets end their page titles with " | <name>": the card shows the source on its own.
const SOURCE_SUFFIX_SEPARATORS = [' - ', ' | '];

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

function normalizeForComparison(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

// The title without a final separator followed by one of the names, compared like the
// duplicate keys; a title made only of the suffix is left as it is.
function withoutSourceSuffix(title: string, names: readonly string[]): string {
  const normalizedNames = names.map(normalizeForComparison);
  for (const separator of SOURCE_SUFFIX_SEPARATORS) {
    let index = title.lastIndexOf(separator);
    while (index > 0) {
      const rest = title.slice(0, index).trim();
      const suffix = normalizeForComparison(title.slice(index + separator.length));
      if (rest !== '' && normalizedNames.includes(suffix)) {
        return rest;
      }
      index = title.lastIndexOf(separator, index - 1);
    }
  }
  return title;
}

function mapArticle(dto: unknown): Article | undefined {
  if (!isRecord(dto)) {
    return undefined;
  }

  const rawTitle = toTrimmedOrUndefined(dto.title);
  if (rawTitle === undefined || rawTitle === REMOVED_TITLE) {
    return undefined;
  }

  const rawUrl = dto.url;
  if (typeof rawUrl !== 'string' || !isHttpUrl(rawUrl)) {
    return undefined;
  }
  const url = rawUrl.trim();

  const domain = getUrlDomain(url);
  const source = isRecord(dto.source) ? dto.source : undefined;
  const sourceName = toTrimmedOrUndefined(source?.name) ?? domain ?? url;
  const title = withoutSourceSuffix(rawTitle, domain === undefined ? [sourceName] : [sourceName, domain]);

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

// The calendar day of the publication date in the device time zone, the one of the date shown
// on the card; empty without a date.
function getPublicationDay(article: Article): string {
  const date = article.publishedAt;
  return date === undefined ? '' : `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

// Two articles are duplicates when they share a key: the same URL, or the same title from the
// same source on the same day, so that a title recurring on another day is a different article.
function getDuplicateKeys(article: Article): string[] {
  return [
    JSON.stringify(['url', article.id]),
    JSON.stringify([
      'title',
      normalizeForComparison(article.sourceName),
      normalizeForComparison(article.title),
      getPublicationDay(article),
    ]),
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

function toArticles(dtos: readonly NewsApiArticleDto[]): Article[] {
  return dtos.map(mapArticle).filter((article) => article !== undefined);
}

/** The article DTOs of one request and the key of the group that shows them. */
export type NewsGroupDtos<Key extends string> = {
  key: Key;
  articles: readonly NewsApiArticleDto[];
};

/**
 * Converts the article DTOs of one request into domain articles: invalid or removed articles
 * are dropped, optional fields are normalized, the source suffix of the title is removed and
 * duplicates, by URL or by title, source and publication day, keep their first occurrence.
 */
export function mapArticles(dtos: readonly NewsApiArticleDto[]): Article[] {
  return withoutDuplicates([], toArticles(dtos));
}

/**
 * Converts the article DTOs of the requests of a page, one group per request in section
 * order, into groups of domain articles with the rules of `mapArticles`; duplicates keep
 * their first occurrence across the groups and a group left without articles is dropped.
 */
export function mapGroups<Key extends string>(groups: readonly NewsGroupDtos<Key>[]): NewsGroup<Key>[] {
  const mapped: NewsGroup<Key>[] = [];
  let existing: Article[] = [];
  for (const group of groups) {
    const articles = withoutDuplicates(existing, toArticles(group.articles));
    if (articles.length > 0) {
      existing = [...existing, ...articles];
      mapped.push({ key: group.key, articles });
    }
  }
  return mapped;
}

/**
 * Appends to the groups of the list those of a later page, dropping the articles that are
 * duplicates of one already in the list or of an earlier one of the page: a group with the
 * key of the last group of the list extends it, any other is added after it. Without
 * additions it returns the same list.
 */
export function appendGroups<Key extends string>(
  current: NewsGroup<Key>[],
  incoming: readonly NewsGroup<Key>[]
): NewsGroup<Key>[] {
  let result = current;
  let existing = current.flatMap((group) => group.articles);
  for (const group of incoming) {
    const added = withoutDuplicates(existing, group.articles);
    if (added.length === 0) {
      continue;
    }
    existing = [...existing, ...added];
    const last = result[result.length - 1];
    result =
      last !== undefined && last.key === group.key
        ? [...result.slice(0, -1), { key: last.key, articles: [...last.articles, ...added] }]
        : [...result, { key: group.key, articles: added }];
  }
  return result;
}
