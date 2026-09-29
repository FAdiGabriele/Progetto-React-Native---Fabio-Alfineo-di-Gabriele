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

/** One page of a news section, with the cursor of the next page of its more-news request. */
export type NewsPage = {
  articles: Article[];
  next?: NewsPageCursor; // absent when the section has no more-news request or has exhausted it
};

/** Opaque for view models and screens: only the repository builds and reads it. */
export type NewsPageCursor = {
  page: number; // next page of the more-news request of the section, from 1
};

/** Last saved list of a news section and when it was saved. */
export type SavedNews = {
  articles: Article[];
  savedAt: Date;
};

export type NewsErrorKind =
  | 'network'
  | 'timeout'
  | 'auth'
  | 'rateLimit'
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
