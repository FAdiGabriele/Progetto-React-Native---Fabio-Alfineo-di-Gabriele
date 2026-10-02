import { Platform, Pressable, ScrollView, StyleSheet } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/presentation/components/themed-text';
import { useThemeColor } from '@/presentation/hooks/use-theme-color';

export type CategoryChipOption<Key extends string = string> = { key: Key; label: string };

export type CategoryChipsProps<Key extends string = string> = {
  options: readonly CategoryChipOption<Key>[];
  selectedKey: Key;
  onSelect: (key: Key) => void;
  horizontalMargin: number;
};

export function CategoryChips<Key extends string>({
  options,
  selectedKey,
  onSelect,
  horizontalMargin,
}: CategoryChipsProps<Key>) {
  const insets = useSafeAreaInsets();
  const tint = useThemeColor({}, 'tint');
  const onTint = useThemeColor({}, 'onTint');
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const text = useThemeColor({}, 'text');
  // On web the selected state belongs to tabs, not to buttons; Android and iOS announce a
  // selected button, while a tab has no trait on iOS.
  const isWeb = Platform.OS === 'web';

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole={isWeb ? 'tablist' : undefined}
      style={styles.scrollView}
      contentContainerStyle={[
        styles.content,
        { paddingLeft: horizontalMargin + insets.left, paddingRight: horizontalMargin + insets.right },
      ]}
    >
      {options.map((option) => (
        <Chip
          key={option.key}
          role={isWeb ? 'tab' : 'button'}
          label={option.label}
          selected={option.key === selectedKey}
          onPress={() => {
            if (option.key !== selectedKey) {
              onSelect(option.key);
            }
          }}
          tint={tint}
          onTint={onTint}
          card={card}
          border={border}
          text={text}
        />
      ))}
    </ScrollView>
  );
}

type ChipProps = {
  role: 'tab' | 'button';
  label: string;
  selected: boolean;
  onPress: () => void;
  tint: string;
  onTint: string;
  card: string;
  border: string;
  text: string;
};

function Chip({ role, label, selected, onPress, tint, onTint, card, border, text }: ChipProps) {
  return (
    <Pressable
      hitSlop={4}
      accessibilityRole={role}
      accessibilityLabel={label}
      aria-selected={selected}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? tint : card,
          borderColor: selected ? tint : border,
        },
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
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flexGrow: 0,
  },
  content: {
    paddingVertical: 8,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    minHeight: 36,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
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
