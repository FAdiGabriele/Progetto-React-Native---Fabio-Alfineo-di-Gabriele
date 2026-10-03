import type { Article, NewsGroup } from '@/domain/models/news-model';

export function normalizeForComparison(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

// The publication day in the device time zone, like the date shown on the card.
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

/** Keeps the candidates that are not duplicates of an existing article or of any earlier candidate. */
export function withoutDuplicates(existing: readonly Article[], candidates: readonly Article[]): Article[] {
  const seenKeys = new Set(existing.flatMap(getDuplicateKeys));
  return candidates.filter((article) => {
    const keys = getDuplicateKeys(article);
    const isDuplicate = keys.some((key) => seenKeys.has(key));
    keys.forEach((key) => seenKeys.add(key));
    return !isDuplicate;
  });
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
