import { useState } from 'react';

import { getAppVersion } from '@/repositories/app-info-repository';

export type SettingsViewModel = {
  /** Version of the app, or null when it cannot be read. */
  appVersion: string | null;
};

export function useSettingsViewModel(): SettingsViewModel {
  const [appVersion] = useState(getAppVersion);

  return { appVersion };
}
