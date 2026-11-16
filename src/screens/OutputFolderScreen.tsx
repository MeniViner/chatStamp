import React from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { usePipelineStore } from '../store/pipelineStore';
import { buildSelectedPreview } from '../store/selectedPreview';
import { useSettingsStore } from '../store/settingsStore';
import { useAppTheme } from '../theme/useAppTheme';
import {
  PremiumCard,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  SummaryMetricCard,
  textStyles
} from '../components/AppUi';
import { spacing } from '../theme/designTokens';
import { FooterActions, WizardScreen } from './WizardScreen';

export function OutputFolderScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const { mediaFiles, selectedSenders, selectedMediaTypes, selectedFileIds, setStage, openOverlayStage } = usePipelineStore();
  const settings = useSettingsStore((state) => state.settings);
  const preview = buildSelectedPreview(mediaFiles, selectedSenders, selectedMediaTypes, selectedFileIds);
  const selectedCount = preview.selectedFiles.length;
  const usesCustomFolder = settings.saveDestinationMode === 'custom-folder';
  const custom = settings.customFolder;
  const missingFolder = usesCustomFolder && !custom?.treeUri;
  const canSave = selectedCount > 0 && !missingFolder;
  const destinationName = usesCustomFolder
    ? custom?.displayName ?? custom?.readablePathLabel ?? t('outputOptions.noFolderSelected')
    : t('outputOptions.defaultAccurateFolder');

  React.useEffect(() => {
    const backSubscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setStage('selectFiles');
      return true;
    });
    return () => backSubscription.remove();
  }, [setStage]);

  return (
    <WizardScreen
      stage="outputOptions"
      title={t('outputOptions.title')}
      onBack={() => setStage('selectFiles')}
      footer={
        <FooterActions>
          <Text variant="bodySmall" style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
            {missingFolder
              ? t('outputOptions.disabledMissingFolder')
              : t('outputOptions.footerReadyCount', { count: selectedCount })}
          </Text>
          <PrimaryButton icon="content-save-check-outline" disabled={!canSave} onPress={() => setStage('saving')}>
            {t('outputOptions.save')}
          </PrimaryButton>
        </FooterActions>
      }
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PremiumCard>
          <SectionHeader icon="clipboard-check-outline" label={t('outputOptions.summaryTitle')} />
          <View style={styles.metricRow}>
            <SummaryMetricCard label={t('outputOptions.selectedItems')} value={selectedCount} />
            <SummaryMetricCard label={t('outputOptions.photos')} value={preview.selectedPhotos} />
            <SummaryMetricCard label={t('outputOptions.videos')} value={preview.selectedVideos} />
            <SummaryMetricCard label={t('outputOptions.other')} value={preview.selectedOther} />
          </View>
        </PremiumCard>
        <PremiumCard>
          <SectionHeader icon="folder-cog-outline" label={t('outputOptions.destinationTitle')} />
          <Text variant="titleMedium" style={textStyles.start}>{destinationName}</Text>
          <Text variant="bodyMedium" style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
            {t(usesCustomFolder ? 'outputOptions.customFolderBody' : 'outputOptions.defaultAccurateFolderBody')}
          </Text>
          <Text variant="bodySmall" style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
            {t(settings.alwaysUseMessageDate ? 'outputOptions.useMessageDate' : 'outputOptions.preserveCaptureDate')}
          </Text>
          <SecondaryButton icon="cog-outline" onPress={() => openOverlayStage('settings')}>
            {t('settings.title')}
          </SecondaryButton>
        </PremiumCard>
      </ScrollView>
    </WizardScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.section,
    paddingBottom: spacing.section
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.smallGap
  }
});
