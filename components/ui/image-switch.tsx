import { Pressable, StyleSheet, View, type Insets } from 'react-native';

import { Image, type ImageProps } from 'expo-image';

import { useThemeColor } from '@/hooks/use-theme-color';

export type ImageSwitchOption<Key extends string = string> = {
  key: Key;
  image: ImageProps['source'];
  accessibilityLabel: string;
};

export type ImageSwitchProps<Key extends string = string> = {
  options: readonly ImageSwitchOption<Key>[];
  selectedKey: Key;
  onSelect: (key: Key) => void;
};

// Extends a 40x30 segment to a 44x44 touch area only towards the container edges, so that
// side-by-side segments do not overlap.
function getSegmentHitSlop(index: number, count: number): Insets {
  return { top: 7, bottom: 7, left: index === 0 ? 4 : 0, right: index === count - 1 ? 4 : 0 };
}

export function ImageSwitch<Key extends string>({
  options,
  selectedKey,
  onSelect,
}: ImageSwitchProps<Key>) {
  const tint = useThemeColor({}, 'tint');
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');

  // On Android and iOS a touch area never extends past the parent view, so the container is as
  // large as the segments' touch areas and the visible pill is a background layer. Without a
  // background of its own the container would be flattened away, with its role, on native.
  return (
    <View accessibilityRole="radiogroup" collapsable={false} style={styles.container}>
      <View style={[styles.pill, { backgroundColor: card, borderColor: border }]} />
      {options.map((option, index) => (
        <Segment
          key={option.key}
          image={option.image}
          accessibilityLabel={option.accessibilityLabel}
          hitSlop={getSegmentHitSlop(index, options.length)}
          selected={option.key === selectedKey}
          onPress={() => {
            if (option.key !== selectedKey) {
              onSelect(option.key);
            }
          }}
          tint={tint}
          border={border}
        />
      ))}
    </View>
  );
}

type SegmentProps = {
  image: ImageProps['source'];
  accessibilityLabel: string;
  hitSlop: Insets;
  selected: boolean;
  onPress: () => void;
  tint: string;
  border: string;
};

function Segment({
  image,
  accessibilityLabel,
  hitSlop,
  selected,
  onPress,
  tint,
  border,
}: SegmentProps) {
  return (
    <Pressable
      hitSlop={hitSlop}
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel}
      aria-checked={selected}
      onPress={onPress}
      style={({ pressed }) => [
        styles.segment,
        selected && { backgroundColor: tint },
        pressed && !selected && styles.pressed,
      ]}
    >
      <Image
        source={image}
        style={[styles.image, { borderColor: border }]}
        contentFit="cover"
        accessible={false}
        accessibilityLabel=""
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 4,
  },
  pill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 1,
    right: 1,
    borderWidth: 1,
    borderRadius: 18,
  },
  segment: {
    height: 30,
    paddingHorizontal: 8,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  image: {
    width: 24,
    height: 16,
    borderRadius: 2,
    borderWidth: 1,
  },
});
