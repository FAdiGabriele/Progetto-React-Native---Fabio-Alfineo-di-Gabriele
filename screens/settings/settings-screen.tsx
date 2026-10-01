import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SegmentedControl, type SegmentedControlOption } from '@/components/ui/segmented-control';
import type { Language } from '@/domain/models/language-model';
import type { ThemePreference } from '@/domain/models/theme-model';
import { useI18n, type I18n } from '@/i18n/i18n-provider';
import type { TranslationKey } from '@/i18n/it';
import { useSettingsViewModel } from '@/screens/settings/use-settings-view-model';
import { useThemePreference } from '@/theme/theme-preference-provider';
import { getNewsLayout } from '@/utils/layout';

type SettingChoice<Key extends string> = { key: Key; labelKey: TranslationKey };

const THEME_CHOICES: readonly SettingChoice<ThemePreference>[] = [
  { key: 'system', labelKey: 'settings.themeSystem' },
  { key: 'light', labelKey: 'settings.themeLight' },
  { key: 'dark', labelKey: 'settings.themeDark' },
];

const LANGUAGE_CHOICES: readonly SettingChoice<Language>[] = [
  { key: 'it', labelKey: 'language.italian' },
  { key: 'en', labelKey: 'language.english' },
];

// The screen reader reads every option with the name of its setting, as in "Theme: Dark".
function toOptions<Key extends string>(
  choices: readonly SettingChoice<Key>[],
  name: string,
  t: I18n['t']
): SegmentedControlOption<Key>[] {
  return choices.map(({ key, labelKey }) => {
    const label = t(labelKey);
    return { key, label, accessibilityLabel: t('settings.optionA11y', { name, value: label }) };
  });
}

export function SettingsScreen() {
  const { appVersion } = useSettingsViewModel();
  const { language, t, setLanguage } = useI18n();
  const { preference, setPreference } = useThemePreference();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { horizontalMargin } = getNewsLayout(width);

  const screenOptions = useMemo(
    () => ({ title: t('settings.title'), headerBackButtonDisplayMode: 'minimal' as const }),
    [t]
  );

  const themeName = t('settings.theme');
  const languageName = t('settings.language');
  const themeOptions = useMemo(() => toOptions(THEME_CHOICES, themeName, t), [themeName, t]);
  const languageOptions = useMemo(() => toOptions(LANGUAGE_CHOICES, languageName, t), [languageName, t]);

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
        <View style={styles.settings}>
          <View style={styles.setting}>
            <ThemedText style={styles.settingName}>{themeName}</ThemedText>
            <SegmentedControl
              options={themeOptions}
              selectedKey={preference}
              onSelect={setPreference}
              accessibilityLabel={themeName}
            />
          </View>
          <View style={styles.setting}>
            <ThemedText style={styles.settingName}>{languageName}</ThemedText>
            <SegmentedControl
              options={languageOptions}
              selectedKey={language}
              onSelect={setLanguage}
              accessibilityLabel={languageName}
            />
          </View>
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
    paddingTop: 16,
  },
  settings: {
    width: '100%',
    maxWidth: 480,
    gap: 24,
  },
  setting: {
    gap: 8,
  },
  settingName: {
    fontSize: 17,
    lineHeight: 22,
  },
  footer: {
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    textAlign: 'center',
  },
});
