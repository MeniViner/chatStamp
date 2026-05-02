import React from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Divider, Text } from 'react-native-paper';
import { usePipelineStore } from '../store/pipelineStore';
import { clearWorkingDirectory } from '../services/importService';
import { screenStyles } from './screenStyles';
import type { SaveFileResult } from '../types/media';

export function DoneScreen() {
  const completion = usePipelineStore((state) => state.completion);
  const workingDirectory = usePipelineStore((state) => state.workingDirectory);
  const reset = usePipelineStore((state) => state.reset);

  async function startOver() {
    if (!completion?.cacheCleared) {
      await clearWorkingDirectory(workingDirectory);
    }
    reset();
  }

  return (
    <ScrollView contentContainerStyle={screenStyles.topContainer}>
      <Text variant="headlineSmall">Results</Text>
      <Text>Saved: {completion?.saved ?? 0}</Text>
      <Text>Date fixed: {completion?.dateCorrected ?? 0}</Text>
      <Text>May still show import time: {completion?.mayShowImportTime ?? 0}</Text>
      <Text>Failed: {completion?.failed ?? 0}</Text>
      <Text>Cache cleared: {completion?.cacheCleared ? 'yes' : 'not yet verified'}</Text>
      {completion?.results?.map((result) => (
        <View key={`${result.filename}-${result.insertedUri ?? result.failureReason}`} style={screenStyles.previewItem}>
          <Text variant="titleSmall">{result.filename}</Text>
          <Text variant="bodySmall">{statusLabel(result)}</Text>
          <Divider />
          <Text variant="bodySmall">WhatsApp date: {formatMillis(result.originalTimestampMillis)}</Text>
          {result.mediaType === 'video' ? (
            <>
              <Text variant="bodySmall">Retriever before: {result.retrieverDateBefore ?? 'none'}</Text>
              <Text variant="bodySmall">Retriever after rewrite: {result.retrieverDateAfterRewrite ?? 'none'}</Text>
              <Text variant="bodySmall">Retriever after insert: {result.retrieverDateAfterInsert ?? 'none'}</Text>
              <Text variant="bodySmall">MediaStore DATE_TAKEN: {formatMillis(result.mediaStoreDateTaken)}</Text>
              <Text variant="bodySmall">MediaStore DATE_MODIFIED: {formatSeconds(result.mediaStoreDateModified)}</Text>
              <Text variant="bodySmall">Boxes verified: {result.boxesVerified ? 'yes' : 'no'}</Text>
              <Text variant="bodySmall">Inserted source: {result.insertedSourcePath ?? 'none'}</Text>
              <Text variant="bodySmall">Inserted URI: {result.insertedUri ?? 'not saved'}</Text>
              {result.debugRewrittenPath ? <Text variant="bodySmall">Debug rewritten file: {result.debugRewrittenPath}</Text> : null}
            </>
          ) : (
            <>
              <Text variant="bodySmall">MediaStore DATE_TAKEN: {formatMillis(result.mediaStoreDateTaken)}</Text>
              <Text variant="bodySmall">Inserted URI: {result.insertedUri ?? 'not saved'}</Text>
            </>
          )}
        </View>
      ))}
      <Button mode="contained" onPress={startOver}>Start over</Button>
      <Button mode="outlined" onPress={startOver}>Import another ZIP</Button>
    </ScrollView>
  );
}

function statusLabel(result: SaveFileResult): string {
  if (!result.ok) return `Not saved: ${result.failureReason ?? 'unknown reason'}`;
  if (result.dateCorrectionVerified && result.mediaType === 'video') return 'MP4 date corrected and verified';
  if (result.dateCorrectionVerified) return 'Date correction verified';
  if (result.failureReason === 'MP4 boxes were not rewritten' || result.failureReason === 'mp4BoxRewriteFailed' || result.mp4RewriteFailureCode === 'mp4BoxRewriteFailed') return 'MP4 boxes were not rewritten';
  if (result.failureReason === 'MP4 boxes were rewritten, but Android MediaMetadataRetriever did not expose a date' || result.failureReason === 'mp4BoxesUpdatedButRetrieverDateMissing') {
    return 'MP4 boxes were rewritten, but Android MediaMetadataRetriever did not expose a date';
  }
  if (result.failureReason === 'MP4 boxes were rewritten and retriever date was correct, but MediaStore did not index the date') {
    return 'MP4 boxes were rewritten and retriever date was correct, but MediaStore did not index the date';
  }
  if (result.galleryMaySortByImportTime) return 'Video saved, but Gallery may still sort by import time';
  return result.failureReason ?? 'Date correction failed';
}

function formatMillis(value?: number | null): string {
  if (!value) return 'none';
  return new Date(value).toISOString();
}

function formatSeconds(value?: number | null): string {
  if (!value) return 'none';
  return new Date(value * 1000).toISOString();
}
