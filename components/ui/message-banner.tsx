import { StyleSheet, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { TextButton } from '@/components/ui/text-button';
import { useThemeColor } from '@/hooks/use-theme-color';

export type MessageBannerProps = {
  message: string;
  closeLabel: string;
  onClose: () => void;
  horizontalMargin: number;
};

export function MessageBanner({ message, closeLabel, onClose, horizontalMargin }: MessageBannerProps) {
  const insets = useSafeAreaInsets();
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.banner,
        {
          backgroundColor: card,
          borderColor: border,
          marginLeft: horizontalMargin + insets.left,
          marginRight: horizontalMargin + insets.right,
        },
      ]}
    >
      <ThemedText style={styles.message}>{message}</ThemedText>
      <TextButton title={closeLabel} accessibilityLabel={closeLabel} onPress={onClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  message: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
  },
});
