import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TextButton } from '@/components/ui/text-button';
import { useThemeColor } from '@/hooks/use-theme-color';

export type ErrorStateProps = { message: string; retryLabel: string; onRetry: () => void };

export function ErrorState({ message, retryLabel, onRetry }: ErrorStateProps) {
  const icon = useThemeColor({}, 'icon');

  return (
    <View style={styles.container}>
      <View aria-hidden>
        <Ionicons name="alert-circle-outline" size={48} color={icon} />
      </View>
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
