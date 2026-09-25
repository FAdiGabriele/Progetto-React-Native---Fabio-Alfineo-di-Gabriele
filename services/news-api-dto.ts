/** Data as NewsAPI sends and receives it: these types never leave the service and repository layers. */

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

export type NewsApiResponseDto =
  | { status: 'ok'; totalResults: number; articles: NewsApiArticleDto[] }
  | { status: 'error'; code: string; message: string };

export type NewsApiRequestDto =
  | { endpoint: 'top-headlines'; country: string; pageSize: number }
  | { endpoint: 'top-headlines'; sources: string[]; pageSize: number }
  | {
      endpoint: 'everything';
      domains: string[];
      language: string;
      sortBy: 'publishedAt';
      pageSize: number;
    };
