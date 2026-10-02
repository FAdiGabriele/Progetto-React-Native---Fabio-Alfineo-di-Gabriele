import { useState } from 'react';

import { appInfoRepository } from '@/di/container';
import type { AppInfoRepository } from '@/domain/repositories/app-info-repository';

export type SettingsViewModel = {
  /** Version of the app, or null when it cannot be read. */
  appVersion: string | null;
};

export function useSettingsViewModel(repository: AppInfoRepository = appInfoRepository): SettingsViewModel {
  const [appVersion] = useState(() => repository.getAppVersion());

  return { appVersion };
}
