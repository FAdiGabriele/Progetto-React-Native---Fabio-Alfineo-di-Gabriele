import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/presentation/components/themed-text';
import { useThemeColor } from '@/presentation/hooks/use-theme-color';

export type SegmentedControlOption<Key extends string = string> = {
  key: Key;
  label: string;
  accessibilityLabel: string;
};

export type SegmentedControlProps<Key extends string = string> = {
  options: readonly SegmentedControlOption<Key>[];
  selectedKey: Key;
  onSelect: (key: Key) => void;
  accessibilityLabel: string;
};

export function SegmentedControl<Key extends string>({
  options,
  selectedKey,
  onSelect,
  accessibilityLabel,
}: SegmentedControlProps<Key>) {
  const tint = useThemeColor({}, 'tint');
  const onTint = useThemeColor({}, 'onTint');
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const text = useThemeColor({}, 'text');

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.group, { backgroundColor: card, borderColor: border }]}
    >
      {options.map((option) => {
        const selected = option.key === selectedKey;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="radio"
            accessibilityLabel={option.accessibilityLabel}
            aria-checked={selected}
            onPress={() => {
              if (!selected) {
                onSelect(option.key);
              }
            }}
            style={({ pressed }) => [
              styles.segment,
              selected && { backgroundColor: tint },
              pressed && styles.pressed,
            ]}
          >
            <ThemedText
              numberOfLines={1}
              style={[
                styles.label,
                { color: selected ? onTint : text, fontWeight: selected ? '600' : 'normal' },
              ]}
            >
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    fontSize: 15,
    lineHeight: 20,
  },
});
