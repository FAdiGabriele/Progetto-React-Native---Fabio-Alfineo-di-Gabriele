import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { NewsImage } from '@/components/news/news-image';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

export type NewsCardProps = {
  title: string;
  sourceName: string;
  description?: string;
  dateLabel?: string;
  author?: string;
  imageUrl?: string;
  accessibilityLabel: string;
  onPress: () => void;
};

export const NewsCard = memo(function NewsCard({
  title,
  sourceName,
  description,
  dateLabel,
  author,
  imageUrl,
  accessibilityLabel,
  onPress,
}: NewsCardProps) {
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const tint = useThemeColor({}, 'tint');
  const textSecondary = useThemeColor({}, 'textSecondary');

  const meta = [dateLabel, author].filter((part) => part !== undefined).join(' · ');

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.root,
        { backgroundColor: card, borderColor: border },
        pressed && styles.pressed,
      ]}
    >
      <NewsImage imageUrl={imageUrl} />
      <View style={styles.body}>
        <ThemedText numberOfLines={1} style={[styles.source, { color: tint }]}>
          {sourceName}
        </ThemedText>
        <ThemedText numberOfLines={3} style={styles.title}>
          {title}
        </ThemedText>
        {description !== undefined && (
          <ThemedText numberOfLines={2} style={[styles.description, { color: textSecondary }]}>
            {description}
          </ThemedText>
        )}
        {meta !== '' && (
          <ThemedText numberOfLines={1} style={[styles.meta, { color: textSecondary }]}>
            {meta}
          </ThemedText>
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  root: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.7,
  },
  body: {
    padding: 12,
    gap: 4,
  },
  source: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
  },
  description: {
    fontSize: 15,
    lineHeight: 20,
  },
  meta: {
    fontSize: 13,
    lineHeight: 18,
  },
});
