import React from 'react';
import { BackHandler, StyleSheet } from 'react-native';
import { ActivityIndicator, ProgressBar, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { usePipelineStore } from '../store/pipelineStore';
import { useAppTheme } from '../theme/useAppTheme';
import { FooterActions, WizardScreen } from './WizardScreen';
import { PremiumCard, SecondaryButton, textStyles } from '../components/AppUi';
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
      <ActivityIndicator size="large" />
      <Text variant="titleMedium" style={textStyles.start}>{t(`operation.${progress?.phase ?? 'preparing'}`)}</Text>
      <ProgressBar progress={fraction ?? undefined} indeterminate={fraction === null}
        color={theme.colors.primary} style={styles.bar} />
      <Text variant="bodyLarge" style={textStyles.start}>{progress?.totalFiles === null || progress?.totalFiles === undefined
        ? t('operation.filesUnknown', { done: progress?.filesDone ?? 0 })
        : t('operation.filesKnown', { done: progress.filesDone, total: progress.totalFiles })}</Text>
      <Text variant="bodyMedium" style={textStyles.start}>{t('operation.bytes', { bytes: ((progress?.bytesDone ?? 0) / 1048576).toFixed(1) })}</Text>
      {progress?.currentFileName ? <Text variant="bodySmall" style={textStyles.start}>{progress.currentFileName}</Text> : null}
    </PremiumCard>
  </WizardScreen>;
}

const styles = StyleSheet.create({ content: { gap: spacing.section, paddingVertical: spacing.section }, bar: { height: 5 } });
