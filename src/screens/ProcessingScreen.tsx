import React from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { ActivityIndicator, ProgressBar, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { usePipelineStore } from '../store/pipelineStore';
import { useAppTheme } from '../theme/useAppTheme';
import { FooterActions, WizardScreen } from './WizardScreen';
import { IconCircle, PremiumCard, SecondaryButton, StatusBadge, textStyles } from '../components/AppUi';
import { progressFraction, isTerminalProgress } from '../lib/operationProgress';
import { cancelCurrentOperation } from '../services/operationCoordinator';
import { spacing } from '../theme/designTokens';

export function ProcessingScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const stage = usePipelineStore((state) => state.stage);
  const progress = usePipelineStore((state) => state.progress);
  const [cancelling, setCancelling] = React.useState(false);
  React.useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);
  const saving = stage === 'saving';
  const fraction = progress ? progressFraction(progress) : null;
  const cancel = async () => {
    setCancelling(true);
    try { await cancelCurrentOperation(); } finally { setCancelling(false); }
  };
  return <WizardScreen stage={saving ? 'saving' : 'analyzing'}
    title={t(saving ? 'processing.savingTitle' : 'processing.analyzeTitle')} backDisabled
    footer={<FooterActions><SecondaryButton disabled={cancelling || (progress ? isTerminalProgress(progress) : false)}
      onPress={() => { void cancel(); }}>{t('operation.cancel')}</SecondaryButton></FooterActions>}>
    <PremiumCard contentStyle={styles.content}>
      <View style={styles.hero}>
        <IconCircle icon={saving ? 'content-save-move-outline' : 'folder-zip-outline'} size={64} />
        <ActivityIndicator size="small" />
      </View>
      <Text variant="titleLarge" accessibilityLiveRegion="polite" style={[styles.phase, textStyles.start]}>{t(`operation.${progress?.phase ?? 'preparing'}`)}</Text>
      <ProgressBar progress={fraction ?? undefined} indeterminate={fraction === null}
        color={theme.colors.primary} style={[styles.bar, { backgroundColor: theme.colors.secondaryContainer }]} />
      <View style={styles.stats}>
        <Text variant="bodyLarge" style={[styles.flex, textStyles.start]}>{progress?.totalFiles === null || progress?.totalFiles === undefined
          ? t('operation.filesUnknown', { done: progress?.filesDone ?? 0 })
          : t('operation.filesKnown', { done: progress.filesDone, total: progress.totalFiles })}</Text>
        <StatusBadge label={t('operation.bytes', { bytes: ((progress?.bytesDone ?? 0) / 1048576).toFixed(1) })} />
      </View>
      {progress?.currentFileName ? <Text variant="bodySmall" numberOfLines={1} ellipsizeMode="middle"
        style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>{progress.currentFileName}</Text> : null}
    </PremiumCard>
  </WizardScreen>;
}

const styles = StyleSheet.create({
  content: { gap: spacing.card, paddingVertical: spacing.smallGap },
  hero: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  phase: { fontWeight: '500' },
  bar: { height: 8, borderRadius: 4 },
  stats: { flexDirection: 'row', alignItems: 'center', gap: spacing.smallGap },
  flex: { flex: 1, minWidth: 0 }
});
