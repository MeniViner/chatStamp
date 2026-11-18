import React from 'react';
import { BackHandler, ScrollView, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../store/settingsStore';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useAppTheme } from '../../theme/useAppTheme';
import { AppScreenScaffold, PrimaryButton, textStyles } from '../../components/AppUi';
import { spacing } from '../../theme/designTokens';

export function OnboardingFlow({ onFinish }: { onFinish?: () => void }) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const completed = useSettingsStore((state) => state.settings.onboardingCompleted);
  const updateSettings = useSettingsStore((state) => state.updateSettings);
  const clearReplay = useOnboardingStore((state) => state.clearReplayRequest);
  const [page, setPage] = React.useState(0);
  const [busy, setBusy] = React.useState(false), [error, setError] = React.useState(false);
  const submitting = React.useRef(false);
  const back = React.useCallback(() => {
    if (page > 0) { setPage(0); return true; }
    if (completed) { clearReplay(); return true; }
    return false;
  }, [clearReplay, completed, page]);
  React.useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', back);
    return () => listener.remove();
  }, [back]);
  async function next() {
    if (page === 0) { setPage(1); return; }
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError(false);
    try {
      if (!completed) await updateSettings({ onboardingCompleted: true });
      clearReplay(); onFinish?.();
    } catch { setError(true); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <AppScreenScaffold title={t('onboarding.appName')}
    stepLabel={t('common.stepOf', { current: page + 1, total: 2 })}
    onBack={page > 0 || completed ? back : undefined}
    footer={<PrimaryButton disabled={busy} onPress={() => { void next(); }}>
      {t(page === 0 ? 'common.next' : 'onboarding.start')}
    </PrimaryButton>}>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <MaterialCommunityIcons name={page === 0 ? 'calendar-clock-outline' : 'share-variant-outline'} size={64} color={theme.colors.primary} />
      <Text variant="headlineMedium" style={[styles.title, textStyles.start]}>{t(page === 0 ? 'onboarding.intro.title' : 'onboarding.export.title')}</Text>
      <Text variant="bodyLarge" style={textStyles.start}>{t(page === 0 ? 'onboarding.intro.body' : 'onboarding.export.body')}</Text>
      <Text variant="bodyMedium" style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>{t(page === 0 ? 'onboarding.intro.note' : 'onboarding.export.note')}</Text>
      {error ? <Text accessibilityRole="alert" style={{ color: theme.colors.error }}>{t('onboarding.saveFailed')}</Text> : null}
    </ScrollView>
  </AppScreenScaffold>;
}
const styles = StyleSheet.create({ scroll: { flex: 1 }, content: { gap: spacing.section, paddingVertical: spacing.section }, title: { fontWeight: '800' } });
