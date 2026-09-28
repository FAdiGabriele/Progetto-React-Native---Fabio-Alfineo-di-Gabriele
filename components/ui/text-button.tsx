import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

export type TextButtonProps = {
  title: string;
  accessibilityLabel: string;
  onPress: () => void;
  /** Shows a small activity indicator instead of the title and ignores presses. */
  loading?: boolean;
};

export function TextButton({ title, accessibilityLabel, onPress, loading = false }: TextButtonProps) {
  const tint = useThemeColor({}, 'tint');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      aria-busy={loading}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={tint} />
      ) : (
        <ThemedText style={[styles.title, { color: tint }]}>{title}</ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
  },
});
