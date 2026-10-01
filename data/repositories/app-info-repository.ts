import { readAppVersion } from '@/data/services/app-info-service';
import type { AppInfoRepository } from '@/domain/repositories/app-info-repository';

function getAppVersion(): string | null {
  const version = readAppVersion()?.trim() ?? '';
  return version.length > 0 ? version : null;
}

/** The information about the app from its manifest. */
export const appInfoRepository: AppInfoRepository = { getAppVersion };
