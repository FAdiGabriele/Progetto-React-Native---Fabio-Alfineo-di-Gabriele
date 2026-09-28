import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TextButton } from '@/components/ui/text-button';
import { useThemeColor } from '@/hooks/use-theme-color';

export type EmptyStateProps = { message: string; retryLabel: string; onRetry: () => void };

export function EmptyState({ message, retryLabel, onRetry }: EmptyStateProps) {
  const icon = useThemeColor({}, 'icon');

  return (
    <View style={styles.container}>
      <Ionicons name="file-tray-outline" size={48} color={icon} />
      <ThemedText style={styles.message}>{message}</ThemedText>
      <TextButton title={retryLabel} accessibilityLabel={retryLabel} onPress={onRetry} />
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
