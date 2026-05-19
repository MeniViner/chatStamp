import React from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Card, Checkbox, Chip, Text } from 'react-native-paper';
import { usePipelineStore } from '../store/pipelineStore';
import { screenStyles } from './screenStyles';
import type { MediaType } from '../types/media';
import { logger } from '../lib/logger';
import { countSelectedSaveableFiles } from '../store/selectionLogic';
import { buildSelectedPreview } from '../store/selectedPreview';
import { useTranslation } from 'react-i18next';
import { MediaFileListItem, textStyles } from '../components/AppUi';

const mediaTypes: MediaType[] = ['photo', 'video', 'voice', 'audio', 'sticker', 'gif'];

export function ReviewScreen() {
  const { t } = useTranslation();
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

  const senders = Array.from(new Set(mediaFiles.map((file) => file.matchedRecord?.sender).filter(Boolean))) as string[];
  const senderCounts = new Map<string, number>();
  for (const file of mediaFiles) {
    const sender = file.matchedRecord?.sender;
    if (!sender) continue;
    senderCounts.set(sender, (senderCounts.get(sender) ?? 0) + 1);
  }
  const visibleFiles = mediaFiles.filter((file) => {
    const sender = file.matchedRecord?.sender;
    return Boolean(sender && selectedSenders.includes(sender) && selectedMediaTypes[file.mediaType]);
  });
  const visibleSaveableFileIds = visibleFiles
    .filter((file) => file.mediaType === 'photo' || file.mediaType === 'video')
    .map((file) => file.id);
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
    <ScrollView contentContainerStyle={screenStyles.container}>
      <Card>
        <Card.Content style={screenStyles.cardContent}>
          <Text variant="headlineSmall" style={textStyles.start}>{t('review.title')}</Text>
          <Text style={textStyles.start}>{t('review.mediaFilesDetected', { count: mediaFiles.length })}</Text>
          {importSummary ? (
            <>
              <Text style={textStyles.start}>{t('review.matched', { count: importSummary.matchedMedia })}</Text>
              <Text style={textStyles.start}>{t('review.unmatched', { count: importSummary.unmatchedMedia })}</Text>
              <Text style={textStyles.start}>{t('review.senders', { count: importSummary.senders })}</Text>
              <Text style={textStyles.start}>{t('review.zipEntriesSkipped', { count: importSummary.skippedZipEntries })}</Text>
            </>
          ) : null}

          <Text variant="titleMedium" style={textStyles.start}>{t('review.mediaTypes')}</Text>
          <View style={screenStyles.rowWrap}>
            {mediaTypes.map((mediaType) => (
              <Chip
                key={mediaType}
                mode="outlined"
                showSelectedCheck
                selected={selectedMediaTypes[mediaType]}
                icon={selectedMediaTypes[mediaType] ? 'check' : undefined}
                selectedColor="#0f766e"
                style={selectedMediaTypes[mediaType] ? screenStyles.selectedChip : screenStyles.unselectedChip}
                onPress={() => toggleMediaType(mediaType)}
              >
                {t(`media.plural.${mediaType}`)}
              </Chip>
            ))}
          </View>

          <Text variant="titleMedium" style={textStyles.start}>{t('summary.senders')}</Text>
          {senders.map((sender) => (
            <Checkbox.Item
              key={sender}
              label={`${sender} (${senderCounts.get(sender) ?? 0})`}
              status={selectedSenders.includes(sender) ? 'checked' : 'unchecked'}
              mode="android"
              labelStyle={textStyles.start}
              style={selectedSenders.includes(sender) ? screenStyles.selectedListItem : screenStyles.unselectedListItem}
              onPress={() => toggleSender(sender)}
            />
          ))}

          <Button mode="contained" onPress={() => void handleSavePress()} disabled={selectedSaveCount === 0}>
            {t('review.saveSelected', { count: selectedSaveCount })}
          </Button>
          {hasSelectedVideos ? (
            <Text>{t('review.videoWarning')}</Text>
          ) : null}
          <Text variant="titleMedium" style={textStyles.start}>{t('review.selectedFiles')}</Text>
          <Text style={textStyles.start}>{t('review.matchedFiles', { count: selectedPreview.matchedFiles })}</Text>
          <Text style={textStyles.start}>{t('review.selectedFilesCount', { count: selectedPreview.selectedFiles.length })}</Text>
          <Text style={textStyles.start}>{t('review.photosVideosCount', { photos: selectedPreview.selectedPhotos, videos: selectedPreview.selectedVideos })}</Text>
          {selectedPreview.selectedOther > 0 ? (
            <Text style={textStyles.start}>{t('review.otherFilesCount', { count: selectedPreview.selectedOther })}</Text>
          ) : null}
          {selectedPreview.selectedFiles.length === 0 ? <Text style={textStyles.start}>{t('review.noSaveableSelected')}</Text> : null}
          <View style={screenStyles.previewList}>
            <View style={screenStyles.rowWrap}>
              <Button mode="outlined" onPress={() => selectFiles(visibleSaveableFileIds)}>
                {t('fileSelection.selectAll')}
              </Button>
              <Button mode="outlined" onPress={() => clearFiles(visibleSaveableFileIds)}>
                {t('review.clearVisible')}
              </Button>
            </View>
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
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

