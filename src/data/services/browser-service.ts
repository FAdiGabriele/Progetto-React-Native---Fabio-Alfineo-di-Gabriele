import { openBrowserAsync } from 'expo-web-browser';
import { Linking, Platform } from 'react-native';

/**
 * Opens a URL for the user: in the in-app browser on Android and iOS, with the system
 * browser as fallback when it is unavailable or fails, and in a new tab on web. Resolves to
 * whether the URL was opened.
 */
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
