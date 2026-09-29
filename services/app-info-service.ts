import Constants from 'expo-constants';

/** Raw `version` of the app config, or undefined when the config or the field is missing. */
export function readAppVersion(): string | undefined {
  return Constants.expoConfig?.version;
}
