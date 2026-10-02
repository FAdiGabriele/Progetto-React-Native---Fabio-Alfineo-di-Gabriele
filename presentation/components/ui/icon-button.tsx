import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { useThemeColor } from '@/presentation/hooks/use-theme-color';

export type IconButtonProps = {
  icon: ComponentProps<typeof Ionicons>['name'];
  accessibilityLabel: string;
  onPress: () => void;
};

export function IconButton({ icon, accessibilityLabel, onPress }: IconButtonProps) {
  const tint = useThemeColor({}, 'tint');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={24} color={tint} aria-hidden />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
