import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { usePipelineStore } from '../store/pipelineStore';
import type { MediaType } from '../types/media';
import { logger } from '../lib/logger';
import { countSelectedSaveableFiles } from '../store/selectionLogic';
import { buildSelectedPreview } from '../store/selectedPreview';
import { isSaveableMediaType } from '../lib/mediaUi';
import { useAppTheme } from '../theme/useAppTheme';
import { spacing } from '../theme/designTokens';
import { FooterActions, WizardScreen, wizardStyles } from './WizardScreen';
import {
  FilterChipGroup,
  MediaFileListItem,
  MetricTile,
  OptionChoiceCard,
  PremiumCard,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  StatusBanner,
  textStyles
} from '../components/AppUi';

const mediaTypes: MediaType[] = ['photo', 'video', 'voice', 'audio', 'sticker', 'gif', 'document', 'unknown'];

export function ReviewScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const mediaFiles = usePipelineStore((state) => state.mediaFiles);
  const importSummary = usePipelineStore((state) => state.importSummary);
  const selectedSenders = usePipelineStore((state) => state.selectedSenders);
  const selectedMediaTypes = usePipelineStore((state) => state.selectedMediaTypes);
  const selectedFileIds = usePipelineStore((state) => state.selectedFileIds);
  const toggleSender = usePipelineStore((state) => state.toggleSender);
  const toggleMediaType = usePipelineStore((state) => state.toggleMediaType);
  const toggleFile = usePipelineStore((state) => state.toggleFile);
  const selectFiles = usePipelineStore((state) => state.selectFiles);
  const clearFiles = usePipelineStore((state) => state.clearFiles);
  const setStage = usePipelineStore((state) => state.setStage);
  const setError = usePipelineStore((state) => state.setError);

  const senders = React.useMemo(
    () => Array.from(new Set(mediaFiles.map((file) => file.matchedRecord?.sender).filter(Boolean))) as string[],
    [mediaFiles]
  );
  const senderCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const file of mediaFiles) {
      const sender = file.matchedRecord?.sender;
      if (!sender) continue;
      counts.set(sender, (counts.get(sender) ?? 0) + 1);
    }
    return counts;
  }, [mediaFiles]);
  const selectedMediaTypeValues = React.useMemo(
    () => mediaTypes.filter((mediaType) => selectedMediaTypes[mediaType]),
    [selectedMediaTypes]
  );
  const visibleFiles = React.useMemo(
    () =>
      mediaFiles.filter((file) => {
        const sender = file.matchedRecord?.sender;
        return Boolean(sender && selectedSenders.includes(sender) && selectedMediaTypes[file.mediaType]);
      }),
    [mediaFiles, selectedMediaTypes, selectedSenders]
  );
  const visibleSaveableFileIds = React.useMemo(
    () => visibleFiles.filter((file) => isSaveableMediaType(file.mediaType)).map((file) => file.id),
    [visibleFiles]
  );
  const selectedSaveCount = countSelectedSaveableFiles(mediaFiles, selectedSenders, selectedMediaTypes, selectedFileIds);
  const selectedPreview = buildSelectedPreview(mediaFiles, selectedSenders, selectedMediaTypes, selectedFileIds);
  const hasSelectedVideos = selectedPreview.selectedFiles.some((file) => file.mediaType === 'video');

  React.useEffect(() => {
    logger.debug('Selected files preview count', {
      matchedFiles: selectedPreview.matchedFiles,
      selectedFiles: selectedPreview.selectedFiles.length,
      selectedPhotos: selectedPreview.selectedPhotos,
      selectedVideos: selectedPreview.selectedVideos,
      selectedOther: selectedPreview.selectedOther
    });
  }, [
    selectedPreview.matchedFiles,
    selectedPreview.selectedFiles.length,
    selectedPreview.selectedPhotos,
    selectedPreview.selectedVideos,
    selectedPreview.selectedOther
  ]);

  async function handleSavePress() {
    try {
      logger.debug('Save button pressed', { selectedSaveCount });
      if (selectedSaveCount === 0) return;

      setStage('saving');
    } catch (error) {
      logger.error('Permission request before save failed', error);
      setError(error instanceof Error ? error.message : t('review.couldNotRequestPermission'));
    }
  }

  return (
    <WizardScreen
      stage="selectFiles"
      title={t('review.title')}
      subtitle={t('review.subtitle')}
      onBack={() => setStage('selectFiles')}
      footer={
        <FooterActions>
          {selectedSaveCount === 0 ? (
            <Text variant="labelLarge" style={[textStyles.start, { color: theme.colors.error }]}>
              {t('review.footerReason')}
            </Text>
          ) : (
            <Text variant="labelLarge" style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
              {t('review.selectedFilesCount', { count: selectedSaveCount })}
            </Text>
          )}
          <PrimaryButton disabled={selectedSaveCount === 0} onPress={() => void handleSavePress()}>
            {t('review.saveSelected', { count: selectedSaveCount })}
          </PrimaryButton>
        </FooterActions>
      }
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PremiumCard>
          <View style={styles.metricRow}>
            <MetricTile label={t('review.selectedFiles')} value={selectedPreview.selectedFiles.length} />
            <MetricTile label={t('review.matchedShort')} value={selectedPreview.matchedFiles} />
          </View>
          <View style={styles.metricRow}>
            <MetricTile label={t('review.photos')} value={selectedPreview.selectedPhotos} />
            <MetricTile label={t('review.videos')} value={selectedPreview.selectedVideos} />
            <MetricTile label={t('review.other')} value={selectedPreview.selectedOther} />
          </View>
        </PremiumCard>

        <StatusBanner
          tone={selectedSaveCount > 0 ? 'success' : 'warning'}
          icon={selectedSaveCount > 0 ? 'check-circle-outline' : 'alert-outline'}
          title={
            selectedSaveCount > 0
              ? t('review.selectionReadyTitle', { count: selectedSaveCount })
              : t('review.selectionEmptyTitle')
          }
          body={selectedSaveCount > 0 ? t('review.selectionReadyBody') : t('review.selectionEmptyBody')}
        />
        {hasSelectedVideos ? <StatusBanner tone="warning" icon="video-outline" title={t('review.videoWarning')} /> : null}

        {importSummary ? (
          <PremiumCard>
            <SectionHeader icon="clipboard-check-outline" label={t('review.importSummary')} />
            <View style={styles.metricRow}>
              <MetricTile label={t('review.matchedShort')} value={importSummary.matchedMedia} />
              <MetricTile label={t('review.unmatchedShort')} value={importSummary.unmatchedMedia} />
              <MetricTile label={t('summary.senders')} value={importSummary.senders} />
            </View>
            <OptionChoiceCard
              title={t('review.technicalSummaryTitle')}
              description={t('review.technicalSummaryBody')}
              technicalDetail={t('review.zipEntriesSkipped', { count: importSummary.skippedZipEntries })}
              selected={false}
              showRadio={false}
            />
          </PremiumCard>
        ) : null}

        <PremiumCard>
          <SectionHeader icon="shape-outline" label={t('review.mediaTypes')} />
          <Text variant="bodyMedium" style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
            {t('review.mediaTypesBody')}
          </Text>
          <FilterChipGroup
            values={mediaTypes}
            selectedValues={selectedMediaTypeValues}
            getLabel={(mediaType) => t(`media.plural.${mediaType}`)}
            onToggle={toggleMediaType}
          />
        </PremiumCard>

        <PremiumCard>
          <SectionHeader icon="account-group-outline" label={t('summary.senders')} />
          <Text variant="bodyMedium" style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
            {t('review.sendersBody')}
          </Text>
          <FilterChipGroup
            values={senders}
            selectedValues={selectedSenders}
            getLabel={(sender) => `${sender} (${senderCounts.get(sender) ?? 0})`}
            onToggle={toggleSender}
          />
        </PremiumCard>

        <PremiumCard>
          <View style={styles.sectionTitleRow}>
            <SectionHeader icon="image-multiple-outline" label={t('review.selectedFiles')} style={styles.flexHeader} />
            <Text variant="bodySmall" style={[wizardStyles.tabular, { color: theme.colors.onSurfaceVariant }]}>
              {t('review.filesShown', { count: visibleFiles.length })}
            </Text>
          </View>
          <View style={styles.actionRow}>
            <SecondaryButton style={styles.actionButton} onPress={() => selectFiles(visibleSaveableFileIds)}>
              {t('fileSelection.selectAll')}
            </SecondaryButton>
            <SecondaryButton style={styles.actionButton} onPress={() => clearFiles(visibleSaveableFileIds)}>
              {t('review.clearVisible')}
            </SecondaryButton>
          </View>
          {visibleFiles.length === 0 ? (
            <StatusBanner tone="info" icon="file-search-outline" title={t('fileSelection.emptyStateTitle')} body={t('fileSelection.emptyStateBody')} />
          ) : (
            <View style={styles.fileList}>
              {visibleFiles.map((file) => (
                <MediaFileListItem
                  key={file.id}
                  file={file}
                  selected={selectedFileIds.includes(file.id)}
                  onToggle={() => toggleFile(file.id)}
                  onPreview={() => toggleFile(file.id)}
                />
              ))}
            </View>
          )}
        </PremiumCard>
      </ScrollView>
    </WizardScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.card,
    paddingBottom: 140
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.smallGap
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smallGap
  },
  flexHeader: {
    flex: 1
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.smallGap
  },
  actionButton: {
    flexGrow: 1
  },
  fileList: {
    gap: spacing.smallGap
  }
});
