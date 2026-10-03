export type NewsApiArticleDto = {
  source: { id: string | null; name: string };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string; // ISO 8601, UTC
  content: string | null; // truncated to 200 characters by the API
};

export type NewsApiPageDto = { totalResults: number; articles: NewsApiArticleDto[] };

export type NewsApiResponseDto =
  | ({ status: 'ok' } & NewsApiPageDto)
  | { status: 'error'; code: string; message: string };

export type NewsApiRequestDto = (
  | { endpoint: 'top-headlines'; country: string; pageSize: number }
  | { endpoint: 'top-headlines'; sources: string[]; pageSize: number }
  | {
      endpoint: 'everything';
      domains: string[];
      language: string;
      sortBy: 'publishedAt';
      pageSize: number;
    }
) & { page?: number }; // absent for the first page

/**
 * Last saved list of a news section: the article DTOs of each request of its first page, in
 * section order.
 */
export type NewsCacheEntryDto = {
  savedAt: string; // ISO 8601
  requests: NewsApiArticleDto[][];
};
