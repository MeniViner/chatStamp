import React from 'react';
import { BackHandler, FlatList, Image, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Checkbox, Searchbar, Text } from 'react-native-paper';
import { usePipelineStore } from '../store/pipelineStore';
import { countSelectedSaveableFiles } from '../store/selectionLogic';
import type { ExtractedMediaFile } from '../types/media';
import { screenStyles } from './screenStyles';
import { runMp4RewriteDiagnosticsNative } from '../native/nativeMediaSaver';

export function FileSelectionScreen() {
  const [query, setQuery] = React.useState('');
  const [mp4Diagnostic, setMp4Diagnostic] = React.useState<string | undefined>();
  const mediaFiles = usePipelineStore((state) => state.mediaFiles);
  const selectedSenders = usePipelineStore((state) => state.selectedSenders);
  const selectedMediaTypes = usePipelineStore((state) => state.selectedMediaTypes);
  const selectedFileIds = usePipelineStore((state) => state.selectedFileIds);
  const toggleFile = usePipelineStore((state) => state.toggleFile);
  const selectFiles = usePipelineStore((state) => state.selectFiles);
  const clearFiles = usePipelineStore((state) => state.clearFiles);
  const setStage = usePipelineStore((state) => state.setStage);

  React.useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setStage('summary');
      return true;
    });
    return () => subscription.remove();
  }, [setStage]);

  const visibleFiles = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return mediaFiles.filter((file) => {
      const sender = file.matchedRecord?.sender;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        file.filename.toLowerCase().includes(normalizedQuery) ||
        sender?.toLowerCase().includes(normalizedQuery);
      return Boolean(sender && selectedSenders.includes(sender) && selectedMediaTypes[file.mediaType] && matchesQuery);
    });
  }, [mediaFiles, query, selectedMediaTypes, selectedSenders]);
  const visibleSaveableFileIds = visibleFiles.filter(isSaveable).map((file) => file.id);
  const selectedSaveCount = countSelectedSaveableFiles(mediaFiles, selectedSenders, selectedMediaTypes, selectedFileIds);
  const selectedMp4 = mediaFiles.find((file) => selectedFileIds.includes(file.id) && file.mediaType === 'video' && file.filename.toLowerCase().endsWith('.mp4'));

  async function runMp4Diagnostics() {
    if (!selectedMp4?.matchedRecord) return;
    setMp4Diagnostic('Running MP4 diagnostics...');
    try {
      const result = await runMp4RewriteDiagnosticsNative(selectedMp4.uri, new Date(selectedMp4.matchedRecord.messageDateIso).getTime());
      setMp4Diagnostic(JSON.stringify(result, null, 2));
    } catch (error) {
      setMp4Diagnostic(error instanceof Error ? error.message : 'MP4 diagnostics failed');
    }
  }

  return (
    <View style={screenStyles.topContainer}>
      <Button mode="text" onPress={() => setStage('summary')}>Back</Button>
      <Text variant="headlineSmall">Select files</Text>
      <Searchbar placeholder="Search filename or sender" value={query} onChangeText={setQuery} />
      <View style={screenStyles.rowWrap}>
        <Button mode="outlined" onPress={() => selectFiles(visibleSaveableFileIds)}>Select visible</Button>
        <Button mode="outlined" onPress={() => clearFiles(visibleSaveableFileIds)}>Clear visible</Button>
      </View>
      <FlatList
        data={visibleFiles}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FileRow
            file={item}
            selected={selectedFileIds.includes(item.id)}
            disabled={!isSaveable(item)}
            onPress={() => toggleFile(item.id)}
          />
        )}
      />
      <View style={screenStyles.previewItem}>
        <Text>{selectedSaveCount} saveable files selected</Text>
        {__DEV__ ? (
          <>
            <Button mode="outlined" disabled={!selectedMp4} onPress={runMp4Diagnostics}>
              Run MP4 diagnostics
            </Button>
            {mp4Diagnostic ? <Text variant="bodySmall">{mp4Diagnostic}</Text> : null}
          </>
        ) : null}
        <Button mode="contained" disabled={selectedSaveCount === 0} onPress={() => setStage('reviewSave')}>
          Review before save
        </Button>
      </View>
    </View>
  );
}

function FileRow({ file, selected, disabled, onPress }: {
  file: ExtractedMediaFile;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <View style={screenStyles.previewItem}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Preview file={file} />
        <View style={{ flex: 1 }}>
          <Checkbox.Item label={file.filename} status={selected ? 'checked' : 'unchecked'} disabled={disabled} onPress={onPress} />
          <Text variant="bodySmall">{file.matchedRecord?.sender ?? 'Unknown'} · {formatDate(file.matchedRecord?.messageDateIso)}</Text>
          <Text variant="bodySmall">
            {file.mediaType}{disabled ? ' · view only / future support' : ''}
          </Text>
        </View>
      </View>
    </View>
  );
}

function Preview({ file }: { file: ExtractedMediaFile }) {
  if (file.mediaType === 'photo' || file.mediaType === 'sticker') {
    return <Image source={{ uri: file.uri }} style={{ width: 56, height: 56, borderRadius: 6, backgroundColor: '#e2e8f0' }} />;
  }
  const icon = file.mediaType === 'video' ? 'play-box' : file.mediaType === 'voice' ? 'microphone' : 'file-document-outline';
  return <MaterialCommunityIcons name={icon} size={44} color="#0f766e" />;
}

function isSaveable(file: ExtractedMediaFile): boolean {
  return file.mediaType === 'photo' || file.mediaType === 'video';
}

function formatDate(value?: string): string {
  if (!value) return 'No WhatsApp date';
  return new Date(value).toLocaleString();
}
