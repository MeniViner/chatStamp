import React from 'react';
import { BackHandler, ScrollView, View } from 'react-native';
import { Button, Checkbox, Chip, Text } from 'react-native-paper';
import { usePipelineStore } from '../store/pipelineStore';
import type { MediaType } from '../types/media';
import { screenStyles } from './screenStyles';

const mediaTypes: MediaType[] = ['photo', 'video', 'voice', 'sticker', 'document', 'audio', 'gif'];

export function SummaryScreen() {
  const mediaFiles = usePipelineStore((state) => state.mediaFiles);
  const importSummary = usePipelineStore((state) => state.importSummary);
  const selectedSenders = usePipelineStore((state) => state.selectedSenders);
  const selectedMediaTypes = usePipelineStore((state) => state.selectedMediaTypes);
  const toggleSender = usePipelineStore((state) => state.toggleSender);
  const toggleMediaType = usePipelineStore((state) => state.toggleMediaType);
  const setStage = usePipelineStore((state) => state.setStage);

  React.useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setStage('welcome');
      return true;
    });
    return () => subscription.remove();
  }, [setStage]);

  const senders = Array.from(new Set(mediaFiles.map((file) => file.matchedRecord?.sender).filter(Boolean))) as string[];
  const senderCounts = new Map<string, number>();
  for (const file of mediaFiles) {
    const sender = file.matchedRecord?.sender;
    if (sender) senderCounts.set(sender, (senderCounts.get(sender) ?? 0) + 1);
  }

  return (
    <ScrollView contentContainerStyle={screenStyles.topContainer}>
      <Button mode="text" onPress={() => setStage('welcome')}>Back</Button>
      <Text variant="headlineSmall">Summary & filters</Text>
      <Text>Photos {importSummary?.photos ?? 0} · Videos {importSummary?.videos ?? 0} · Voice {importSummary?.voice ?? 0}</Text>
      <Text>Stickers {importSummary?.stickers ?? 0} · Documents {importSummary?.documents ?? 0} · Unknown {importSummary?.unknown ?? 0}</Text>
      <Text>Matched {importSummary?.matchedMedia ?? 0} of {mediaFiles.length} extracted files.</Text>

      <Text variant="titleMedium">Categories</Text>
      <View style={screenStyles.rowWrap}>
        {mediaTypes.map((mediaType) => (
          <Chip
            key={mediaType}
            mode="outlined"
            selected={selectedMediaTypes[mediaType]}
            showSelectedCheck
            onPress={() => toggleMediaType(mediaType)}
            style={selectedMediaTypes[mediaType] ? screenStyles.selectedChip : screenStyles.unselectedChip}
          >
            {mediaType}
          </Chip>
        ))}
      </View>

      <Text variant="titleMedium">Senders</Text>
      {senders.map((sender) => (
        <Checkbox.Item
          key={sender}
          label={`${sender} (${senderCounts.get(sender) ?? 0})`}
          status={selectedSenders.includes(sender) ? 'checked' : 'unchecked'}
          onPress={() => toggleSender(sender)}
        />
      ))}

      <Button mode="contained" onPress={() => setStage('selectFiles')}>
        Continue to file selection
      </Button>
    </ScrollView>
  );
}
