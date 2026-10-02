/** Access to the information about the app: the port that the data layer implements. */
export interface AppInfoRepository {
  /** App version without surrounding spaces, or null when it is missing or empty. */
  getAppVersion(): string | null;
}
