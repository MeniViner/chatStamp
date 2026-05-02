import React from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Card, Checkbox, Chip, Text } from 'react-native-paper';
import { usePipelineStore } from '../store/pipelineStore';
import { screenStyles } from './screenStyles';
import type { MediaType } from '../types/media';
import { logger } from '../lib/logger';
import { countSelectedSaveableFiles } from '../store/selectionLogic';
import { buildSelectedPreview } from '../store/selectedPreview';

const mediaTypes: MediaType[] = ['photo', 'video', 'voice', 'audio', 'sticker', 'gif'];

export function ReviewScreen() {
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
      skippedVoiceOrOther: selectedPreview.skippedVoiceOrOther
    });
  }, [
    selectedPreview.matchedFiles,
    selectedPreview.selectedFiles.length,
    selectedPreview.selectedPhotos,
    selectedPreview.selectedVideos,
    selectedPreview.skippedVoiceOrOther
  ]);

  async function handleSavePress() {
    try {
      logger.debug('Save button pressed', { selectedSaveCount });
      if (selectedSaveCount === 0) return;

      setStage('saving');
    } catch (error) {
      logger.error('Permission request before save failed', error);
      setError(error instanceof Error ? error.message : 'Could not request Gallery permission.');
    }
  }

  return (
    <ScrollView contentContainerStyle={screenStyles.container}>
      <Card>
        <Card.Content style={screenStyles.cardContent}>
          <Text variant="headlineSmall">Review import</Text>
          <Text>{mediaFiles.length} media files detected.</Text>
          {importSummary ? (
            <>
              <Text>Matched: {importSummary.matchedMedia}</Text>
              <Text>Unmatched: {importSummary.unmatchedMedia}</Text>
              <Text>Senders: {importSummary.senders}</Text>
              <Text>ZIP entries skipped: {importSummary.skippedZipEntries}</Text>
            </>
          ) : null}

          <Text variant="titleMedium">Media types</Text>
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
                {getMediaTypeLabel(mediaType)}
              </Chip>
            ))}
          </View>

          <Text variant="titleMedium">Senders</Text>
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
            Save {selectedSaveCount} selected
          </Button>
          {hasSelectedVideos ? (
            <Text>Videos may still appear by import time unless MP4 metadata correction is supported.</Text>
          ) : null}
          <Text variant="titleMedium">Selected files</Text>
          <Text>Matched files: {selectedPreview.matchedFiles}</Text>
          <Text>Selected files: {selectedPreview.selectedFiles.length}</Text>
          <Text>Photos: {selectedPreview.selectedPhotos} · Videos: {selectedPreview.selectedVideos}</Text>
          {selectedPreview.skippedVoiceOrOther > 0 ? (
            <Text>Skipped voice/other: {selectedPreview.skippedVoiceOrOther}</Text>
          ) : null}
          {selectedPreview.selectedFiles.length === 0 ? <Text>No saveable files selected.</Text> : null}
          <View style={screenStyles.previewList}>
            <View style={screenStyles.rowWrap}>
              <Button mode="outlined" onPress={() => selectFiles(visibleSaveableFileIds)}>
                Select all visible
              </Button>
              <Button mode="outlined" onPress={() => clearFiles(visibleSaveableFileIds)}>
                Clear visible
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
                <Text variant="bodySmall">{file.matchedRecord?.sender ?? 'Unknown'} · {file.mediaType}</Text>
                <Text variant="bodySmall">{formatPreviewDate(file.matchedRecord?.messageDateIso ?? '')}</Text>
                <Text variant="bodySmall">{getCapabilityLabel(file.mediaType, file.filename)}</Text>
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

function getMediaTypeLabel(mediaType: MediaType): string {
  if (mediaType === 'photo') return 'photos';
  if (mediaType === 'video') return 'videos';
  if (mediaType === 'voice') return 'voice';
  if (mediaType === 'audio') return 'audio';
  if (mediaType === 'sticker') return 'stickers';
  if (mediaType === 'gif') return 'gifs';
  return mediaType;
}

function getCapabilityLabel(mediaType: MediaType, filename: string): string {
  if (mediaType === 'photo' && /\.(jpe?g)$/i.test(filename)) return 'Photo date fix supported';
  if (mediaType === 'photo') return 'Photo date fix limited';
  if (mediaType === 'video') return 'Video date fix supported only after Android verification passes';
  if (mediaType === 'sticker') return 'Sticker not saved by default';
  if (mediaType === 'voice') return 'Voice not saved by default';
  return 'Not saved by default';
}
