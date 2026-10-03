import type { Article } from '@/domain/models/news-model';

/** Opens a URL for the user and resolves to whether it was opened. */
export type UrlOpener = (url: string) => Promise<boolean>;

export type OpenArticleOutcome = 'opened' | 'failed' | 'ignored';

export type OpenArticle = (article: Article) => Promise<OpenArticleOutcome>;

/**
 * Builds the use case that opens an article on the site of its newspaper. A request made
 * while another article is still opening is ignored; an opener that fails, by answering false
 * or by rejecting, gives `failed`.
 */
export function createOpenArticle(openUrl: UrlOpener): OpenArticle {
  let opening = false;
  return async (article) => {
    if (opening) {
      return 'ignored';
    }
    opening = true;
    try {
      return (await openUrl(article.url)) ? 'opened' : 'failed';
    } catch {
      return 'failed';
    } finally {
      opening = false;
    }
  };
}
