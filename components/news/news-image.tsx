import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import { useThemeColor } from '@/hooks/use-theme-color';

export type NewsImageProps = { imageUrl?: string };

export function NewsImage({ imageUrl }: NewsImageProps) {
  const [failedUrl, setFailedUrl] = useState<string | undefined>();
  const placeholderColor = useThemeColor({}, 'placeholder');
  const iconColor = useThemeColor({}, 'icon');

  const showPlaceholder = imageUrl === undefined || failedUrl === imageUrl;

  if (showPlaceholder) {
    return (
      <View
        style={[styles.size, styles.placeholder, { backgroundColor: placeholderColor }]}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <Ionicons name="newspaper-outline" size={40} color={iconColor} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: imageUrl }}
      style={styles.size}
      contentFit="cover"
      cachePolicy="disk"
      transition={200}
      recyclingKey={imageUrl}
      accessible={false}
      onError={() => setFailedUrl(imageUrl)}
    />
  );
}

const styles = StyleSheet.create({
  size: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
