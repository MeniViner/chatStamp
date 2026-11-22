import React from 'react';
import { AppState, BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../store/settingsStore';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useAppTheme } from '../../theme/useAppTheme';
import { AppLogo, AppScreenScaffold, forwardArrow, ListGroup, ListItem, PrimaryButton, textStyles, type IconName } from '../../components/AppUi';
import {
  checkNotificationPermission, notificationPermissionApplies, openNotificationSettings, requestNotificationPermission,
  type NotificationPermissionState
} from '../../native/notificationPermission';
import { appTypography, spacing } from '../../theme/designTokens';

type Page = 'intro' | 'permissions' | 'export';
const features = [
  { id: 'dates', icon: 'calendar-clock-outline' },
  { id: 'local', icon: 'shield-lock-outline' },
  { id: 'choose', icon: 'checkbox-multiple-marked-outline' }
] as const satisfies readonly { id: string; icon: IconName }[];
const exportSteps = [
  { id: 'openChat', icon: 'message-text-outline' },
  { id: 'menu', icon: 'dots-vertical' },
  { id: 'exportChat', icon: 'export' },
  { id: 'includeMedia', icon: 'image-multiple-outline' },
  { id: 'shareToApp', icon: 'share-variant-outline' }
] as const satisfies readonly { id: string; icon: IconName }[];

export function OnboardingFlow({ onFinish }: { onFinish?: () => void }) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const completed = useSettingsStore((state) => state.settings.onboardingCompleted);
  const updateSettings = useSettingsStore((state) => state.updateSettings);
  const clearReplay = useOnboardingStore((state) => state.clearReplayRequest);
  // The notifications page only exists where Android asks for that permission (Android 13 and later).
  const pages = React.useMemo<readonly Page[]>(() => notificationPermissionApplies() ? ['intro', 'permissions', 'export'] : ['intro', 'export'], []);
  const [page, setPage] = React.useState(0);
  const current = pages[page] ?? 'intro';
  const last = page === pages.length - 1;
  const [busy, setBusy] = React.useState(false), [error, setError] = React.useState(false);
  const [permission, setPermission] = React.useState<NotificationPermissionState | 'unknown'>('unknown');
  const submitting = React.useRef(false);
  const refreshPermission = React.useCallback(() => {
    void checkNotificationPermission().then((granted) => {
      setPermission((previous) => granted ? 'granted' : previous === 'blocked' ? 'blocked' : 'denied');
    }, () => setPermission('denied'));
  }, []);
  React.useEffect(() => {
    if (current !== 'permissions') return undefined;
    refreshPermission();
    // Returning from Android settings is the only way to learn about a change made there.
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') refreshPermission(); });
    return () => subscription.remove();
  }, [current, refreshPermission]);
  const back = React.useCallback(() => {
    if (page > 0) { setPage(page - 1); return true; }
    if (completed) { clearReplay(); return true; }
    return false;
  }, [clearReplay, completed, page]);
  React.useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', back);
    return () => listener.remove();
  }, [back]);
  async function grant() {
    if (permission === 'blocked') { await openNotificationSettings().catch(() => undefined); return; }
    setPermission(await requestNotificationPermission().catch((): NotificationPermissionState => 'denied'));
  }
  async function next() {
    if (!last) { setPage(page + 1); return; }
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError(false);
    try {
      if (!completed) await updateSettings({ onboardingCompleted: true });
      clearReplay(); onFinish?.();
    } catch { setError(true); }
    finally { submitting.current = false; setBusy(false); }
  }
  const granted = permission === 'granted';
  const muted = { color: theme.colors.onSurfaceVariant };

  return <AppScreenScaffold title={t('onboarding.appName')} titleMode="none"
    onBack={page > 0 || completed ? back : undefined}
    footer={<View style={styles.footer}>
      <PageDots current={page} total={pages.length} />
      <PrimaryButton disabled={busy} icon={last ? undefined : forwardArrow()} iconAfterLabel
        onPress={() => { void next(); }}>
        {t(last ? 'onboarding.start' : 'common.next')}
      </PrimaryButton>
    </View>}>
    <ScrollView key={page} style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.welcome}>
        <Text variant="headlineSmall" style={[styles.welcomeTo, textStyles.start]}>{t('onboarding.welcomeTo')}</Text>
        <View style={styles.brandRow}>
          <AppLogo size={44} />
          <Text variant="displaySmall" accessibilityRole="header" style={[styles.brand, textStyles.start]}>{t('onboarding.appName')}</Text>
        </View>
      </View>
      <Text variant="titleLarge" style={[styles.tagline, textStyles.start]}>
        {t(`onboarding.${current}.title`)}
      </Text>
      {current === 'intro' ? <>
        <Text variant="bodyLarge" style={[textStyles.start, muted]}>{t('onboarding.intro.body')}</Text>
        <ListGroup>
          {features.map((feature) => <ListItem key={feature.id} icon={feature.icon} iconTone="primary"
            title={t(`onboarding.features.${feature.id}.title`)} description={t(`onboarding.features.${feature.id}.body`)} />)}
        </ListGroup>
      </> : null}
      {current === 'permissions' ? <>
        <Text variant="bodyLarge" style={[textStyles.start, muted]}>{t('onboarding.permissions.body')}</Text>
        <ListGroup>
          <ListItem icon="bell-outline" iconTone="primary" title={t('onboarding.permissions.notifications.title')}
            description={t('onboarding.permissions.notifications.body')}
            trailing={granted ? <View accessibilityLabel={t('onboarding.permissions.granted')} accessible
              style={[styles.grantedMark, { backgroundColor: theme.colors.primary }]}>
              <MaterialCommunityIcons name="check" size={18} color={theme.colors.onPrimary} />
            </View> : <Button mode="contained-tonal" compact disabled={permission === 'unknown'} onPress={() => { void grant(); }}
              contentStyle={styles.grantButton} labelStyle={styles.grantLabel}>
              {t(permission === 'blocked' ? 'onboarding.permissions.openSettings' : 'onboarding.permissions.grant')}
            </Button>} />
        </ListGroup>
        <Text variant="bodySmall" style={[textStyles.start, muted]}>{t('onboarding.permissions.note')}</Text>
      </> : null}
      {current === 'export' ? <>
        <Text variant="bodyLarge" style={[textStyles.start, muted]}>{t('onboarding.export.body')}</Text>
        <ListGroup>
          {exportSteps.map((step, index) => <ListItem key={step.id} leading={<StepNumber value={index + 1} />}
            title={t(`whatsAppGuide.steps.${step.id}.title`)}
            trailing={<MaterialCommunityIcons name={step.icon} size={22} color={theme.colors.onSurfaceVariant} importantForAccessibility="no" />} />)}
        </ListGroup>
        <Text variant="bodySmall" style={[textStyles.start, muted]}>{t('onboarding.export.note')}</Text>
      </> : null}
      {error ? <Text accessibilityRole="alert" style={{ color: theme.colors.error }}>{t('onboarding.saveFailed')}</Text> : null}
    </ScrollView>
  </AppScreenScaffold>;
}

function StepNumber({ value }: { value: number }) {
  const theme = useAppTheme();
  return <View importantForAccessibility="no-hide-descendants" style={[styles.stepNumber, { backgroundColor: theme.colors.secondaryContainer }]}>
    <Text variant="titleMedium" style={[styles.stepNumberText, { color: theme.colors.onSecondaryContainer }]}>{value}</Text>
  </View>;
}

function PageDots({ current, total }: { current: number; total: number }) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  return <View style={styles.dots} accessible accessibilityLabel={t('common.stepOf', { current: current + 1, total })}>
    {Array.from({ length: total }, (_, index) => <View key={index} style={[styles.dot, {
      width: index === current ? 22 : 8,
      backgroundColor: index === current ? theme.colors.primary : theme.colors.outlineVariant
    }]} />)}
  </View>;
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: spacing.card + 4, paddingTop: spacing.tinyGap, paddingBottom: spacing.section },
  welcome: { gap: spacing.smallGap, paddingHorizontal: spacing.tinyGap },
  welcomeTo: { fontWeight: '400' },
  tagline: { fontWeight: '600', marginBottom: -spacing.smallGap, paddingHorizontal: spacing.tinyGap },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.gap },
  brand: { ...appTypography.largeTitle, fontWeight: '700', flexShrink: 1 },
  footer: { gap: spacing.smallGap },
  grantedMark: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  grantButton: { minHeight: 48, paddingHorizontal: 6 },
  grantLabel: { fontWeight: '600' },
  stepNumber: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontWeight: '700', fontVariant: ['tabular-nums'] },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: spacing.tinyGap },
  dot: { height: 8, borderRadius: 4 }
});
