import React from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Chip, Surface, Text } from 'react-native-paper';
import { usePipelineStore } from '../store/pipelineStore';
import { countSelectedSaveableFiles } from '../store/selectionLogic';
import type { MediaType } from '../types/media';
import { isSaveableMediaType, visibleMediaTypes } from '../lib/mediaUi';
import { useAppTheme } from '../theme/useAppTheme';
import { FooterActions, MetricCard, WizardScreen, wizardStyles } from './WizardScreen';
import { useTranslation } from 'react-i18next';
import { textStyles } from '../components/AppUi';

export function SummaryScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const mediaFiles = usePipelineStore((state) => state.mediaFiles);
  const importSummary = usePipelineStore((state) => state.importSummary);
  const selectedSenders = usePipelineStore((state) => state.selectedSenders);
  const selectedMediaTypes = usePipelineStore((state) => state.selectedMediaTypes);
  const selectedFileIds = usePipelineStore((state) => state.selectedFileIds);
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

  const selectedSaveCount = countSelectedSaveableFiles(mediaFiles, selectedSenders, selectedMediaTypes, selectedFileIds);

  function selectAllSenders() {
    for (const sender of senders) {
      if (!selectedSenders.includes(sender)) toggleSender(sender);
    }
  }

  function clearSenders() {
    for (const sender of senders) {
      if (selectedSenders.includes(sender)) toggleSender(sender);
    }
  }

  return (
    <WizardScreen
      stage="selectFiles"
      title={t('summary.title')}
      subtitle={t('summary.subtitle')}
      onBack={() => setStage('welcome')}
      footer={
        <FooterActions>
          <Text variant="labelLarge" style={[wizardStyles.tabular, textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
            {t('summary.selectedSaveable', { count: selectedSaveCount })}
          </Text>
          <Button mode="contained" disabled={selectedSaveCount === 0} onPress={() => setStage('selectFiles')}>
            {t('summary.continueToFiles')}
          </Button>
        </FooterActions>
      }
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={wizardStyles.rowWrap}>
          <MetricCard label={t('summary.matchedMedia')} value={importSummary?.matchedMedia ?? 0} />
          <MetricCard label={t('media.plural.photo')} value={importSummary?.photos ?? 0} />
          <MetricCard label={t('media.plural.video')} value={importSummary?.videos ?? 0} />
          <MetricCard label={t('summary.senders')} value={importSummary?.senders ?? senders.length} />
        </View>

        <View style={wizardStyles.section}>
          <Text variant="titleMedium" style={textStyles.start}>{t('summary.categories')}</Text>
          <View style={styles.categoryList}>
            {visibleMediaTypes.map((mediaType) => (
              <CategoryRow
                key={mediaType}
                mediaType={mediaType}
                count={getCategoryCount(mediaType, importSummary)}
                selected={selectedMediaTypes[mediaType]}
                onPress={() => toggleMediaType(mediaType)}
              />
            ))}
          </View>
        </View>

        <View style={wizardStyles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="titleMedium" style={textStyles.start}>{t('summary.senders')}</Text>
            <View style={styles.headerActions}>
              <Button compact mode="text" onPress={selectAllSenders}>
                {t('summary.allSenders')}
              </Button>
              <Button compact mode="text" onPress={clearSenders}>
                {t('fileSelection.clear')}
              </Button>
            </View>
          </View>
          <View style={wizardStyles.rowWrap}>
            {senders.map((sender) => {
              const selected = selectedSenders.includes(sender);
              return (
                <Chip
                  key={sender}
                  mode={selected ? 'flat' : 'outlined'}
                  selected={selected}
                  showSelectedCheck
                  onPress={() => toggleSender(sender)}
                  style={{
                    backgroundColor: selected ? theme.colors.secondaryContainer : theme.colors.surface,
                    borderColor: theme.colors.outline
                  }}
                  textStyle={{ color: selected ? theme.colors.onSecondaryContainer : theme.colors.onSurface }}
                >
                  {sender} ({senderCounts.get(sender) ?? 0})
                </Chip>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </WizardScreen>
  );
}

function CategoryRow({
  mediaType,
  count,
  selected,
  onPress
}: {
  mediaType: MediaType;
  count: number;
  selected: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const saveable = isSaveableMediaType(mediaType);
  const backgroundColor = selected && saveable ? theme.colors.primaryContainer : theme.colors.surface;
  const foregroundColor = selected && saveable ? theme.colors.onPrimaryContainer : theme.colors.onSurface;

  return (
    <Surface elevation={0} style={[styles.categoryRow, { backgroundColor, borderColor: theme.colors.outlineVariant, opacity: saveable ? 1 : 0.76 }]}>
      <View style={styles.categoryMain}>
        <MaterialCommunityIcons name={getCategoryIcon(mediaType)} size={24} color={saveable ? theme.colors.primary : theme.colors.onSurfaceVariant} />
        <View style={styles.categoryText}>
          <Text variant="titleSmall" style={[textStyles.start, { color: foregroundColor }]}>
            {t(`media.plural.${mediaType}`)}
          </Text>
          <Text variant="bodySmall" style={[wizardStyles.tabular, textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
            {saveable ? t('summary.countFound', { count }) : t('summary.countFoundNotSaved', { count })}
          </Text>
        </View>
      </View>
      <Chip
        compact
        disabled={!saveable}
        selected={selected && saveable}
        onPress={onPress}
        style={{ backgroundColor: saveable ? theme.colors.surface : theme.colors.surfaceVariant }}
      >
        {saveable ? (selected ? t('summary.included') : t('summary.include')) : t('summary.later')}
      </Chip>
    </Surface>
  );
}

function getCategoryCount(mediaType: MediaType, summary: ReturnType<typeof usePipelineStore.getState>['importSummary']): number {
  if (!summary) return 0;
  if (mediaType === 'photo') return summary.photos;
  if (mediaType === 'video') return summary.videos;
  if (mediaType === 'voice') return summary.voice;
  if (mediaType === 'sticker') return summary.stickers;
  if (mediaType === 'document') return summary.documents;
  return summary.unknown;
}

function getCategoryIcon(mediaType: MediaType): React.ComponentProps<typeof MaterialCommunityIcons>['name'] {
  if (mediaType === 'photo') return 'image-outline';
  if (mediaType === 'video') return 'video-outline';
  if (mediaType === 'voice' || mediaType === 'audio') return 'microphone-outline';
  if (mediaType === 'sticker') return 'sticker-outline';
  if (mediaType === 'document') return 'file-document-outline';
  return 'file-question-outline';
}

const styles = StyleSheet.create({
  content: {
    gap: 18,
    paddingBottom: 24
  },
  categoryList: {
    borderRadius: 8,
    overflow: 'hidden'
  },
  categoryRow: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  categoryMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1
  },
  categoryText: {
    flex: 1
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center'
  }
});
