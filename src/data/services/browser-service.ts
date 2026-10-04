import { openBrowserAsync } from 'expo-web-browser';
import { Linking, Platform } from 'react-native';

export async function openInBrowser(url: string): Promise<boolean> {
  // On web the in-app browser is a popup window, so the URL opens in a new tab with Linking.
  if (Platform.OS !== 'web') {
    try {
      await openBrowserAsync(url);
      return true;
    } catch {
      // The in-app browser is unavailable or failed: the system browser is the fallback.
    }
  }
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
