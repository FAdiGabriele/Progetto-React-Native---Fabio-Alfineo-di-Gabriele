/** Domain types of the news: what use cases, view models and screens work with. */

/** Keys of the news sections, in the order of the category bar; the first one is selected at startup. */
export const NEWS_SECTION_KEYS = ['italy', 'usa'] as const;

/** Key of a news section: the category of the news that the user picks. */
export type NewsSectionKey = (typeof NEWS_SECTION_KEYS)[number];

/**
 * Key of a group of the news list, the block of cards that shows the articles of one request
 * of a section under its own heading.
 */
export type NewsGroupKey = 'frontPages' | 'latestAnsa' | 'topHeadlines' | 'moreNews';

export type Article = {
  id: string; // same as url, unique within the list
  title: string;
  description?: string;
  url: string;
  imageUrl?: string;
  sourceName: string;
  author?: string;
  publishedAt?: Date; // absent when the API value cannot be parsed
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

/**
 * One page of a news section: its groups in section order, without empty ones, with the
 * cursor of the next page of its more-news request and, for a first page whose requests did
 * not all succeed, the error of the failed one.
 */
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

/** Last saved list of a news section, one group per request of its first page, and when it was saved. */
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

  /** The error itself when it already is a NewsError, an unknown one otherwise. */
  static from(error: unknown): NewsError {
    return error instanceof NewsError ? error : new NewsError('unknown');
  }
}
