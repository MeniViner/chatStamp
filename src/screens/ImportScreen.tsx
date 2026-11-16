import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Appbar, Text } from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import { usePipelineStore } from '../store/pipelineStore';
import { importWhatsAppZip } from '../services/importService';
import { logger } from '../lib/logger';
import { useAppTheme } from '../theme/useAppTheme';
import { FooterActions, WizardScreen } from './WizardScreen';
import { useTranslation } from 'react-i18next';
import { PremiumCard, PrimaryButton, SectionHeader, textStyles } from '../components/AppUi';
import { radius, spacing } from '../theme/designTokens';

export function ImportScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const setZip = usePipelineStore((state) => state.setZip);
  const setStage = usePipelineStore((state) => state.setStage);
  const openOverlayStage = usePipelineStore((state) => state.openOverlayStage);
  const setProgress = usePipelineStore((state) => state.setProgress);
  const setImportResult = usePipelineStore((state) => state.setImportResult);
  const setError = usePipelineStore((state) => state.setError);

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
      copiedZipUri: importResult.copiedZipUri,
      mediaFiles: importResult.mediaFiles,
      importSummary: importResult.importSummary
    });
  }, [setImportResult, setProgress, setStage, setZip]);

  async function pickZip() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/zip', 'application/x-zip-compressed'],
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
          <PrimaryButton icon="folder-zip-outline" onPress={pickZip}>
            {t('import.chooseZip')}
          </PrimaryButton>
        </FooterActions>
      }
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PremiumCard style={[styles.hero, { backgroundColor: theme.colors.primaryContainer, borderColor: theme.colors.primary }]}>
          <View style={styles.heroTop}>
            <View style={[styles.iconBubble, { backgroundColor: theme.colors.surface }]}>
              <MaterialCommunityIcons name="calendar-clock" size={38} color={theme.colors.primary} />
            </View>
            <Text variant="headlineMedium" style={[styles.heroTitle, textStyles.start, { color: theme.colors.onPrimaryContainer }]}>
              {t('import.heroTitle')}
            </Text>
          </View>
          <Text variant="bodyLarge" style={[textStyles.start, { color: theme.colors.onPrimaryContainer }]}>
            {t('import.heroBody')}
          </Text>
        </PremiumCard>

        <PremiumCard>
          <SectionHeader icon="folder-zip-outline" label={t('import.instructionTitle')} />
          <Text variant="bodyMedium" style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
            {t('import.instructionBody')}
          </Text>
        </PremiumCard>

        <PremiumCard>
          <SectionHeader icon="shield-check-outline" label={t('import.trustTitle')} />
          <InfoRow icon="cellphone-lock" title={t('import.infoLocalTitle')} body={t('import.infoLocalBody')} />
          <InfoRow icon="share-variant" title={t('import.infoShareTitle')} body={t('import.infoShareBody')} />
        </PremiumCard>
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
    gap: spacing.section,
    paddingBottom: spacing.section
  },
  hero: {
    borderRadius: radius.largeCard,
    borderWidth: StyleSheet.hairlineWidth
  },
  heroTop: {
    gap: spacing.gap
  },
  iconBubble: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center'
  },
  heroTitle: {
    fontWeight: '800',
    letterSpacing: 0
  },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.gap,
    alignItems: 'flex-start'
  },
  infoText: {
    flex: 1,
    gap: 2
  }
});
