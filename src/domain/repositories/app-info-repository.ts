export interface AppInfoRepository {
  /** App version without surrounding spaces, or null when it is missing or empty. */
  getAppVersion(): string | null;
}
