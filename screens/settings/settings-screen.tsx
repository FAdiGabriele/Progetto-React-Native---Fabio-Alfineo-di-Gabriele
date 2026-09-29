import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ListRow } from '@/components/ui/list-row';
import { useI18n } from '@/i18n/i18n-provider';
import { useSettingsViewModel } from '@/screens/settings/use-settings-view-model';
import { useThemePreference } from '@/theme/theme-preference-provider';
import { getNewsLayout } from '@/utils/layout';

export function SettingsScreen() {
  const { appVersion } = useSettingsViewModel();
  const { language, t, toggleLanguage } = useI18n();
  const { theme, toggleTheme } = useThemePreference();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { horizontalMargin } = getNewsLayout(width);

  const screenOptions = useMemo(
    () => ({ title: t('settings.title'), headerBackButtonDisplayMode: 'minimal' as const }),
    [t]
  );

  const themeLabel = t('settings.theme');
  const themeValue = t(theme === 'dark' ? 'settings.themeDark' : 'settings.themeLight');
  const languageLabel = t('settings.language');
  const languageValue = t(language === 'it' ? 'language.italian' : 'language.english');

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={screenOptions} />
      <Head>
        <title>{t('app.name')}</title>
      </Head>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            paddingLeft: horizontalMargin + insets.left,
            paddingRight: horizontalMargin + insets.right,
            paddingBottom: 16 + insets.bottom,
          },
        ]}
      >
        <View>
          <ListRow
            label={themeLabel}
            value={themeValue}
            accessibilityLabel={t('settings.rowA11y', { name: themeLabel, value: themeValue })}
            onPress={toggleTheme}
          />
          <ListRow
            label={languageLabel}
            value={languageValue}
            accessibilityLabel={t('settings.rowA11y', { name: languageLabel, value: languageValue })}
            onPress={toggleLanguage}
          />
        </View>
        <View style={styles.footer}>
          {appVersion !== null && (
            <ThemedText type="secondary" style={styles.footerText}>
              {t('settings.version', { version: appVersion })}
            </ThemedText>
          )}
          <ThemedText type="secondary" style={styles.footerText}>
            {t('settings.footer')}
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
    gap: 24,
    paddingTop: 8,
  },
  footer: {
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    textAlign: 'center',
  },
});
