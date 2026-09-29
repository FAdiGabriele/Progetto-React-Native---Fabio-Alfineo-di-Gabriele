import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

export type ListRowProps = {
  label: string;
  value: string;
  accessibilityLabel: string;
  onPress: () => void;
};

export function ListRow({ label, value, accessibilityLabel, onPress }: ListRowProps) {
  const border = useThemeColor({}, 'border');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { borderBottomColor: border }, pressed && styles.pressed]}
    >
      <ThemedText numberOfLines={1} style={[styles.text, styles.label]}>
        {label}
      </ThemedText>
      <ThemedText type="secondary" numberOfLines={1} style={[styles.text, styles.value]}>
        {value}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: 48,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  text: {
    fontSize: 17,
    lineHeight: 22,
  },
  label: {
    flex: 1,
  },
  value: {
    flexShrink: 1,
    textAlign: 'right',
  },
});
