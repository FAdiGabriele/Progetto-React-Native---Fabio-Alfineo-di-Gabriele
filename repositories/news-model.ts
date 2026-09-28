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

/** One page of a news section, with the cursor of the next page when some request has more. */
export type NewsPage = {
  articles: Article[];
  next?: NewsPageCursor;
};

/** Opaque for view models and screens: only the repository builds and reads it. */
export type NewsPageCursor = {
  pages: (number | undefined)[]; // per request of the section, in order: the next page, or undefined when exhausted
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
