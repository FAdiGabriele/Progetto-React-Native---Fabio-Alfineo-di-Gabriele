import Constants from 'expo-constants';

export function readAppVersion(): string | undefined {
  return Constants.expoConfig?.version;
}
