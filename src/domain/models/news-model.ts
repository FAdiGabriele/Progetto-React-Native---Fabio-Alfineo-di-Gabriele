/** Keys of the news sections, in the order of the category bar; the first one is selected at startup. */
export const NEWS_SECTION_KEYS = ['italy', 'usa'] as const;

export type NewsSectionKey = (typeof NEWS_SECTION_KEYS)[number];

export type NewsGroupKey = 'frontPages' | 'latestAnsa' | 'topHeadlines' | 'moreNews';

export type Article = {
  id: string; // same as url, unique within the list
  title: string;
  description?: string;
  url: string;
  imageUrl?: string;
  sourceName: string;
  author?: string;
  publishedAt?: Date; // absent when the API value is missing or cannot be parsed
};

/**
 * Articles of one request of a news section, shown under the heading of their group. The key
 * identifies the heading; its type stays open for the pure rules on groups, which work with
 * any key.
 */
export type NewsGroup<Key extends string = NewsGroupKey> = {
  key: Key;
  articles: Article[]; // at least one: a request left without articles has no group
};

export type NewsPage = {
  groups: NewsGroup[];
  next?: NewsPageCursor; // absent when the section has no more-news request or has exhausted it
  // First page only: the error of the first failed request, absent when every request succeeded.
  partialError?: NewsError;
};

/** Opaque outside the data layer: only the repository builds and reads it. */
export type NewsPageCursor = {
  page: number; // next page of the more-news request of the section, from 1
};

/** Last saved list of a news section: the groups of its first page, without the more news. */
export type SavedNews = {
  groups: NewsGroup[];
  savedAt: Date;
};

export type NewsErrorKind =
  | 'network'
  | 'timeout'
  | 'auth'
  | 'rateLimit'
  | 'quotaExhausted'
  | 'resultsLimit'
  | 'badRequest'
  | 'server'
  | 'unknown';

export class NewsError extends Error {
  kind: NewsErrorKind;

  constructor(kind: NewsErrorKind) {
    super(kind);
    this.name = 'NewsError';
    this.kind = kind;
  }

  static from(error: unknown): NewsError {
    return error instanceof NewsError ? error : new NewsError('unknown');
  }
}
