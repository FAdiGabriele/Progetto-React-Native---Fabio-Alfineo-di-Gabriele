/** Composition root: the only module outside the data layer that knows it. */
import { appInfoRepository as appInfoRepositoryImpl } from '@/data/repositories/app-info-repository';
import { languageRepository as languageRepositoryImpl } from '@/data/repositories/language-repository';
import { newsRepository } from '@/data/repositories/news-repository';
import { themeRepository as themeRepositoryImpl } from '@/data/repositories/theme-repository';
import { openInBrowser } from '@/data/services/browser-service';
import type { AppInfoRepository } from '@/domain/repositories/app-info-repository';
import type { LanguageRepository } from '@/domain/repositories/language-repository';
import type { ThemeRepository } from '@/domain/repositories/theme-repository';
import { createLoadMoreNews } from '@/domain/use-cases/load-more-news';
import { createLoadSectionNews } from '@/domain/use-cases/load-section-news';
import { createOpenArticle } from '@/domain/use-cases/open-article';

export const newsUseCases = {
  loadSectionNews: createLoadSectionNews(newsRepository),
  loadMoreNews: createLoadMoreNews(newsRepository),
  openArticle: createOpenArticle(openInBrowser),
};

export const languageRepository: LanguageRepository = languageRepositoryImpl;

export const themeRepository: ThemeRepository = themeRepositoryImpl;

export const appInfoRepository: AppInfoRepository = appInfoRepositoryImpl;
