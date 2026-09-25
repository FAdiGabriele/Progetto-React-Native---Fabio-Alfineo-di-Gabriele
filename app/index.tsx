import { StyleSheet } from 'react-native';

import { ThemedView } from '@/components/themed-view';

/**
 * Route "/": placeholder until the "Notizie" screen exists.
 * It will only render `screens/news/news-screen.tsx`, with no logic of its own.
 */
export default function IndexRoute() {
  return <ThemedView style={styles.container} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
