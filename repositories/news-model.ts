/** Domain types of the news: what view models and screens work with. */

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
 * identifies the heading and comes from the news sections list, which the model does not know.
 */
export type NewsGroup<Key extends string = string> = {
  key: Key;
  articles: Article[]; // at least one: a request left without articles has no group
};

/**
 * One page of a news section: its groups in section order, without empty ones, with the
 * cursor of the next page of its more-news request and, for a first page whose requests did
 * not all succeed, the error of the failed one.
 */
export type NewsPage<Key extends string = string> = {
  groups: NewsGroup<Key>[];
  next?: NewsPageCursor; // absent when the section has no more-news request or has exhausted it
  // First page only: the error of the first failed request, absent when every request succeeded.
  partialError?: NewsError;
};

/** Opaque for view models and screens: only the repository builds and reads it. */
export type NewsPageCursor = {
  page: number; // next page of the more-news request of the section, from 1
};

/** Last saved list of a news section, one group per request of its first page, and when it was saved. */
export type SavedNews<Key extends string = string> = {
  groups: NewsGroup<Key>[];
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
}
