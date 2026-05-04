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
          <Text variant="headlineSmall">{t('review.title')}</Text>
          <Text>{t('review.mediaFilesDetected', { count: mediaFiles.length })}</Text>
          {importSummary ? (
            <>
              <Text>{t('review.matched', { count: importSummary.matchedMedia })}</Text>
              <Text>{t('review.unmatched', { count: importSummary.unmatchedMedia })}</Text>
              <Text>{t('review.senders', { count: importSummary.senders })}</Text>
              <Text>{t('review.zipEntriesSkipped', { count: importSummary.skippedZipEntries })}</Text>
            </>
          ) : null}

          <Text variant="titleMedium">{t('review.mediaTypes')}</Text>
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

          <Text variant="titleMedium">{t('summary.senders')}</Text>
          {senders.map((sender) => (
            <Checkbox.Item
              key={sender}
              label={`${sender} (${senderCounts.get(sender) ?? 0})`}
              status={selectedSenders.includes(sender) ? 'checked' : 'unchecked'}
              mode="android"
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
          <Text variant="titleMedium">{t('review.selectedFiles')}</Text>
          <Text>{t('review.matchedFiles', { count: selectedPreview.matchedFiles })}</Text>
          <Text>{t('review.selectedFilesCount', { count: selectedPreview.selectedFiles.length })}</Text>
          <Text>{t('review.photosVideosCount', { photos: selectedPreview.selectedPhotos, videos: selectedPreview.selectedVideos })}</Text>
          {selectedPreview.selectedOther > 0 ? (
            <Text>{t('review.otherFilesCount', { count: selectedPreview.selectedOther })}</Text>
          ) : null}
          {selectedPreview.selectedFiles.length === 0 ? <Text>{t('review.noSaveableSelected')}</Text> : null}
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
              <View key={file.id} style={screenStyles.previewItem}>
                <Checkbox.Item
                  label={file.filename}
                  status={selectedFileIds.includes(file.id) ? 'checked' : 'unchecked'}
                  disabled={file.mediaType !== 'photo' && file.mediaType !== 'video'}
                  onPress={() => toggleFile(file.id)}
                />
                <Text variant="bodySmall">{file.matchedRecord?.sender ?? t('fileSelection.unknownSender')} · {t(`media.singular.${file.mediaType}`)}</Text>
                <Text variant="bodySmall">{formatPreviewDate(file.matchedRecord?.messageDateIso ?? '')}</Text>
                <Text variant="bodySmall">{getCapabilityLabel(t, file.mediaType, file.filename)}</Text>
              </View>
            ))}
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

function formatPreviewDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

function getCapabilityLabel(t: (key: string) => string, mediaType: MediaType, filename: string): string {
  if (mediaType === 'photo' && /\.(jpe?g)$/i.test(filename)) return t('review.capabilities.photoSupported');
  if (mediaType === 'photo') return t('review.capabilities.photoLimited');
  if (mediaType === 'video') return t('review.capabilities.videoSupportedAfterVerification');
  if (mediaType === 'sticker') return t('review.capabilities.stickerNotDefault');
  if (mediaType === 'voice') return t('review.capabilities.voiceNotDefault');
  return t('review.capabilities.notDefault');
}
