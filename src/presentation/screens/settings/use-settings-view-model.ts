import { useState } from 'react';

import { appInfoRepository } from '@/di/container';
import type { AppInfoRepository } from '@/domain/repositories/app-info-repository';

export type SettingsViewModel = {
  appVersion: string | null;
};

export function useSettingsViewModel(repository: AppInfoRepository = appInfoRepository): SettingsViewModel {
  const [appVersion] = useState(() => repository.getAppVersion());

  return { appVersion };
}
