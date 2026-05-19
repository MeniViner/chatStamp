import React, { useCallback, useEffect } from 'react';
import { AppState, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Appbar, Button, Surface, Text } from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import { usePipelineStore } from '../store/pipelineStore';
import { importWhatsAppZip } from '../services/importService';
import { logger } from '../lib/logger';
import { hasAllFilesAccess } from '../native/allFilesAccess';
import { useAppTheme } from '../theme/useAppTheme';
import { FooterActions, WizardScreen, wizardStyles } from './WizardScreen';
import { useTranslation } from 'react-i18next';
import { textStyles } from '../components/AppUi';

export function ImportScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const setZip = usePipelineStore((state) => state.setZip);
  const setStage = usePipelineStore((state) => state.setStage);
  const openOverlayStage = usePipelineStore((state) => state.openOverlayStage);
  const setProgress = usePipelineStore((state) => state.setProgress);
  const setImportResult = usePipelineStore((state) => state.setImportResult);
  const setError = usePipelineStore((state) => state.setError);
  const [allFilesAccessGranted, setAllFilesAccessGranted] = React.useState<boolean | undefined>();

  const importZip = useCallback(async (uri: string, name: string) => {
    setZip({ uri, name });
    setStage('analyzing');

    const importResult = await importWhatsAppZip({
      zipUri: uri,
      zipName: name,
      onProgress: setProgress
    });

    setImportResult({
      workingDirectory: importResult.workingDirectory,
      mediaFiles: importResult.mediaFiles,
      importSummary: importResult.importSummary
    });
  }, [setImportResult, setProgress, setStage, setZip]);

  const refreshPermissionStatus = useCallback(async (reason: string) => {
    try {
      const granted = await hasAllFilesAccess();
      logger.debug(reason, { allFilesAccessGranted: granted });
      setAllFilesAccessGranted(granted);
    } catch (error) {
      logger.warn('Could not read All Files Access status', error);
    }
  }, []);

  useEffect(() => {
    void refreshPermissionStatus('Startup permission status');

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void refreshPermissionStatus('App resumed and permission rechecked');
      }
    });

    return () => subscription.remove();
  }, [refreshPermissionStatus]);

  async function pickZip() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'],
        copyToCacheDirectory: true,
        multiple: false
      });
      logger.debug('Document picker result', result);

      if (result.canceled) return;

      const asset = result.assets[0];
      await importZip(asset.uri, asset.name);
    } catch (error) {
      setError(error instanceof Error ? error.message : t('import.importFailed'));
    }
  }

  return (
    <WizardScreen
      stage="welcome"
      title={t('import.title')}
      subtitle={t('import.subtitle')}
      actions={
        <>
          <Appbar.Action icon="history" onPress={() => openOverlayStage('history')} />
          <Appbar.Action icon="cog-outline" onPress={() => openOverlayStage('settings')} />
        </>
      }
      footer={
        <FooterActions>
          <Button mode="contained" icon="folder-zip-outline" onPress={pickZip}>
            {t('import.chooseZip')}
          </Button>
        </FooterActions>
      }
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Surface
          elevation={0}
          style={[
            styles.hero,
            {
              backgroundColor: theme.colors.primaryContainer,
              borderColor: theme.colors.outlineVariant
            }
          ]}
        >
          <View style={[styles.iconBubble, { backgroundColor: theme.colors.surface }]}>
            <MaterialCommunityIcons name="calendar-clock" size={34} color={theme.colors.primary} />
          </View>
          <Text variant="headlineMedium" style={[styles.heroTitle, textStyles.start, { color: theme.colors.onPrimaryContainer }]}>
            {t('import.heroTitle')}
          </Text>
          <Text variant="bodyMedium" style={[textStyles.start, { color: theme.colors.onPrimaryContainer }]}>
            {t('import.heroBody')}
          </Text>
        </Surface>

        <View style={wizardStyles.section}>
          <InfoRow icon="cellphone-lock" title={t('import.infoLocalTitle')} body={t('import.infoLocalBody')} />
          <InfoRow icon="share-variant" title={t('import.infoShareTitle')} body={t('import.infoShareBody')} />
          <InfoRow
            icon={allFilesAccessGranted ? 'check-circle-outline' : 'shield-outline'}
            title={allFilesAccessGranted ? t('import.infoPermReadyTitle') : t('import.infoPermLaterTitle')}
            body={
              allFilesAccessGranted
                ? t('import.infoPermReadyBody')
                : t('import.infoPermLaterBody')
            }
          />
        </View>

        <Surface
          elevation={0}
          style={[
            styles.instructionCard,
            {
              backgroundColor: theme.colors.surfaceContainerHigh ?? theme.colors.surfaceVariant,
              borderColor: theme.colors.outlineVariant
            }
          ]}
        >
          <Text variant="titleMedium" style={textStyles.start}>{t('import.instructionTitle')}</Text>
          <Text variant="bodyMedium" style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
            {t('import.instructionBody')}
          </Text>
        </Surface>
      </ScrollView>
    </WizardScreen>
  );
}

function InfoRow({ icon, title, body }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; title: string; body: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.infoRow}>
      <MaterialCommunityIcons name={icon} size={24} color={theme.colors.secondary} />
      <View style={styles.infoText}>
        <Text variant="titleSmall" style={textStyles.start}>{title}</Text>
        <Text variant="bodyMedium" style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
          {body}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 18,
    paddingBottom: 24
  },
  hero: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 14
  },
  iconBubble: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center'
  },
  heroTitle: {
    fontWeight: '800',
    letterSpacing: 0
  },
  infoRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start'
  },
  infoText: {
    flex: 1,
    gap: 2
  },
  instructionCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 16,
    gap: 6
  }
});
