import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

export type LoadingStateProps = { message: string };

export function LoadingState({ message }: LoadingStateProps) {
  const tint = useThemeColor({}, 'tint');

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={tint} />
      <ThemedText style={styles.message}>{message}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  message: {
    textAlign: 'center',
  },
});
