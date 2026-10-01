import type { NewsApiArticleDto } from '@/data/services/news-api-dto';
import { normalizeForComparison, withoutDuplicates } from '@/domain/models/news-groups';
import type { Article, NewsGroup } from '@/domain/models/news-model';
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
