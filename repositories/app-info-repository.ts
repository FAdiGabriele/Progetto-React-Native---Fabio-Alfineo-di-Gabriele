import { readAppVersion } from '@/services/app-info-service';

/** App version without surrounding spaces, or null when it is missing or empty. */
export function getAppVersion(): string | null {
  const version = readAppVersion()?.trim() ?? '';
  return version.length > 0 ? version : null;
}
