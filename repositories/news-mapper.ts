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

/**
 * Converts the article DTOs of a news section, already concatenated in request order,
 * into domain articles: invalid or removed articles are dropped, optional fields are
 * normalized and duplicate URLs keep their first occurrence.
 */
export function mapArticles(dtos: readonly NewsApiArticleDto[]): Article[] {
  const seenUrls = new Set<string>();
  const articles: Article[] = [];

  for (const dto of dtos) {
    const article = mapArticle(dto);
    if (article === undefined || seenUrls.has(article.id)) {
      continue;
    }
    seenUrls.add(article.id);
    articles.push(article);
  }

  return articles;
}
