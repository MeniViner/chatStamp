import React, { useEffect, useRef } from 'react';
import { BackHandler, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { usePipelineStore } from '../store/pipelineStore';
import { runSavePipeline } from '../services/pipelineService';
import { screenStyles } from './screenStyles';

export function ProcessingScreen() {
  const stage = usePipelineStore((state) => state.stage);
  const progress = usePipelineStore((state) => state.progress);
  const mediaFiles = usePipelineStore((state) => state.mediaFiles);
  const selectedSenders = usePipelineStore((state) => state.selectedSenders);
  const selectedMediaTypes = usePipelineStore((state) => state.selectedMediaTypes);
  const selectedFileIds = usePipelineStore((state) => state.selectedFileIds);
  const workingDirectory = usePipelineStore((state) => state.workingDirectory);
  const setProgress = usePipelineStore((state) => state.setProgress);
  const setCompletion = usePipelineStore((state) => state.setCompletion);
  const setError = usePipelineStore((state) => state.setError);
  const saveStarted = useRef(false);

  useEffect(() => {
    if (stage !== 'saving' || saveStarted.current) return;

    saveStarted.current = true;

    async function saveSelectedMedia() {
      try {
        const completion = await runSavePipeline({
          files: mediaFiles,
          selectedSenders,
          selectedMediaTypes,
          selectedFileIds,
          workingDirectory,
          onProgress: setProgress
        });
        setCompletion(completion);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Saving media failed.');
      }
    }

    void saveSelectedMedia();
  }, [
    mediaFiles,
    selectedMediaTypes,
    selectedSenders,
    selectedFileIds,
    setCompletion,
    setError,
    setProgress,
    stage,
    workingDirectory
  ]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      return stage === 'saving' || stage === 'analyzing';
    });
    return () => subscription.remove();
  }, [stage]);

  return (
    <View style={screenStyles.container}>
      <ActivityIndicator size="large" />
      <Text variant="headlineSmall">{stage === 'saving' ? 'Saving media' : 'Analyzing ZIP'}</Text>
      <Text>{progress?.stageLabel ?? 'Preparing...'}</Text>
      {progress ? (
        <Text>
          {progress.processed}/{progress.total} processed · {progress.failed} failed
        </Text>
      ) : null}
    </View>
  );
}
