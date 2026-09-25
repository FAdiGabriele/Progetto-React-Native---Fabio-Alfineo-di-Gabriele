import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

export type TextButtonProps = {
  title: string;
  accessibilityLabel: string;
  onPress: () => void;
};

export function TextButton({ title, accessibilityLabel, onPress }: TextButtonProps) {
  const tint = useThemeColor({}, 'tint');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <ThemedText style={[styles.title, { color: tint }]}>{title}</ThemedText>
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
