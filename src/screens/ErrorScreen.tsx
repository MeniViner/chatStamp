import React from 'react';
import { AppState, ScrollView, StyleSheet } from 'react-native';
import { List, Surface, Text } from 'react-native-paper';
import { usePipelineStore } from '../store/pipelineStore';
import { clearWorkingDirectory } from '../services/importService';
import { hasAllFilesAccess, openAllFilesAccessSettings } from '../native/allFilesAccess';
import { logger } from '../lib/logger';
import { useAppTheme } from '../theme/useAppTheme';
import { FooterActions, WizardScreen } from './WizardScreen';
import { useTranslation } from 'react-i18next';
import { PremiumCard, PrimaryButton, SecondaryButton, StatusBanner, textStyles } from '../components/AppUi';
import { radius, spacing } from '../theme/designTokens';

export function ErrorScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const error = usePipelineStore((state) => state.error);
  const workingDirectory = usePipelineStore((state) => state.workingDirectory);
  const mediaFiles = usePipelineStore((state) => state.mediaFiles);
  const setError = usePipelineStore((state) => state.setError);
  const clearError = usePipelineStore((state) => state.clearError);
  const setStage = usePipelineStore((state) => state.setStage);
  const reset = usePipelineStore((state) => state.reset);
  const allFilesAccessErrorMessage = 'All Files Access is required for accurate file dates mode.';
  const isPermissionError = Boolean(error?.includes('All Files Access') || error?.includes('permission is missing'));
  const friendly = getFriendlyError(t, error, isPermissionError);

  const recheckPermissionAfterResume = React.useCallback(async () => {
    try {
      const granted = await hasAllFilesAccess();
      logger.debug('App resumed and All Files Access rechecked', { granted });
      if (!granted) {
        setError(allFilesAccessErrorMessage);
      }
    } catch (permissionError) {
      logger.warn('Permission recheck after settings failed', permissionError);
    }
  }, [allFilesAccessErrorMessage, setError]);

  React.useEffect(() => {
    if (!isPermissionError) return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      void recheckPermissionAfterResume();
    });

    return () => subscription.remove();
  }, [isPermissionError, recheckPermissionAfterResume]);

  async function resetAndCleanUp() {
    await clearWorkingDirectory(workingDirectory);
    reset();
  }

  async function grantPermission() {
    try {
      const granted = await hasAllFilesAccess();
      if (!granted) {
        logger.debug('All Files Access settings opened', { reason: 'permission error screen' });
        await openAllFilesAccessSettings();
        return;
      }

      clearError();
      setStage(mediaFiles.length > 0 ? 'outputOptions' : 'welcome');
    } catch (permissionError) {
      logger.error('Grant permission retry failed', permissionError);
      setError(permissionError instanceof Error ? permissionError.message : allFilesAccessErrorMessage);
    }
  }

  return (
    <WizardScreen
      stage="error"
      title={friendly.title}
      subtitle={friendly.reason}
      footer={
        <FooterActions>
          {isPermissionError ? (
            <PrimaryButton icon="shield-key-outline" onPress={() => void grantPermission()}>
              {t('error.grantAllFilesAccess')}
            </PrimaryButton>
          ) : null}
          <PrimaryButton onPress={() => void resetAndCleanUp()}>
            {t('error.tryAnotherZip')}
          </PrimaryButton>
          <SecondaryButton onPress={() => void resetAndCleanUp()}>
            {t('results.startOver')}
          </SecondaryButton>
        </FooterActions>
      }
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <StatusBanner tone="error" icon="alert-circle-outline" title={friendly.title} body={friendly.action} />
        <PremiumCard>
          <Text variant="bodyMedium" style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
            {friendly.reason}
          </Text>
          <List.Accordion title={t('error.showDetails')} titleStyle={styles.accordionTitle} left={(props) => <List.Icon {...props} icon="text-box-search-outline" />}>
            <Surface elevation={0} style={[styles.details, { borderColor: theme.colors.outlineVariant }]}>
              <Text variant="bodySmall" style={textStyles.start}>{error ?? t('error.unknownError')}</Text>
            </Surface>
          </List.Accordion>
        </PremiumCard>
      </ScrollView>
    </WizardScreen>
  );
}

function getFriendlyError(t: (key: string) => string, error: string | undefined, isPermissionError: boolean): { title: string; reason: string; action: string } {
  const value = error ?? '';
  if (isPermissionError) {
    return {
      title: t('error.permissionTitle'),
      reason: t('error.permissionReason'),
      action: t('error.permissionAction')
    };
  }
  if (value.includes('No WhatsApp chat transcript TXT file')) {
    return {
      title: t('error.noTranscriptTitle'),
      reason: t('error.noTranscriptReason'),
      action: t('error.noTranscriptAction')
    };
  }
  if (value.includes('contains no media')) {
    return {
      title: t('error.noMediaTitle'),
      reason: t('error.noMediaReason'),
      action: t('error.noMediaAction')
    };
  }
  if (value.toLowerCase().includes('zip')) {
    return {
      title: t('error.unsupportedZipTitle'),
      reason: t('error.unsupportedZipReason'),
      action: t('error.unsupportedZipAction')
    };
  }
  if (value.toLowerCase().includes('cache') || value.toLowerCase().includes('permission')) {
    return {
      title: t('error.storageTitle'),
      reason: t('error.storageReason'),
      action: t('error.storageAction')
    };
  }
  return {
    title: t('error.parsingTitle'),
    reason: t('error.parsingReason'),
    action: t('error.parsingAction')
  };
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.section,
    paddingBottom: spacing.section
  },
  flex: {
    flex: 1
  },
  details: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12
  },
  accordionTitle: {
    fontSize: 14,
    fontWeight: '700'
  }
});
