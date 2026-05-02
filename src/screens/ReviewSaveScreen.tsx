import React from 'react';
import { BackHandler, ScrollView, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { usePipelineStore } from '../store/pipelineStore';
import { buildSelectedPreview } from '../store/selectedPreview';
import { screenStyles } from './screenStyles';

export function ReviewSaveScreen() {
  const mediaFiles = usePipelineStore((state) => state.mediaFiles);
  const selectedSenders = usePipelineStore((state) => state.selectedSenders);
  const selectedMediaTypes = usePipelineStore((state) => state.selectedMediaTypes);
  const selectedFileIds = usePipelineStore((state) => state.selectedFileIds);
  const setStage = usePipelineStore((state) => state.setStage);
  const preview = buildSelectedPreview(mediaFiles, selectedSenders, selectedMediaTypes, selectedFileIds);
  const selectedVideos = preview.selectedFiles.filter((file) => file.mediaType === 'video');

  React.useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setStage('selectFiles');
      return true;
    });
    return () => subscription.remove();
  }, [setStage]);

  return (
    <ScrollView contentContainerStyle={screenStyles.topContainer}>
      <Button mode="text" onPress={() => setStage('selectFiles')}>Back</Button>
      <Text variant="headlineSmall">Review before save</Text>
      <Text>Destination: Gallery / WhatsApp TimeFixer</Text>
      <Text>Photos: {preview.selectedPhotos} · Videos: {preview.selectedVideos}</Text>
      {selectedVideos.length > 0 ? (
        <Text>
          Videos will be saved only as date-fixed when MP4 container metadata and Android MediaStore verification both pass.
        </Text>
      ) : null}
      <Text variant="titleMedium">Selected items</Text>
      {preview.selectedFiles.map((file) => (
        <View key={file.id} style={screenStyles.previewItem}>
          <Text>{file.filename}</Text>
          <Text variant="bodySmall">{file.mediaType} · {file.sender}</Text>
        </View>
      ))}
      <Button mode="contained" onPress={() => setStage('saving')}>
        Save selected media
      </Button>
    </ScrollView>
  );
}
