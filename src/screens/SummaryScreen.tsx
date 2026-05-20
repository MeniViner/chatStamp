import React from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { FilterChipGroup, MetricTile, OptionChoiceCard, PremiumCard, PrimaryButton, SectionHeader, textStyles } from '../components/AppUi';
import { isSaveableMediaType, visibleMediaTypes } from '../lib/mediaUi';
import { usePipelineStore } from '../store/pipelineStore';
import { countSelectedSaveableFiles } from '../store/selectionLogic';
import { useAppTheme } from '../theme/useAppTheme';
import { spacing } from '../theme/designTokens';
import { FooterActions, WizardScreen, wizardStyles } from './WizardScreen';

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
          <PrimaryButton disabled={selectedSaveCount === 0} onPress={() => setStage('selectFiles')}>
            {t('summary.continueToFiles')}
          </PrimaryButton>
        </FooterActions>
      }
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={wizardStyles.rowWrap}>
          <MetricTile label={t('summary.matchedMedia')} value={importSummary?.matchedMedia ?? 0} />
          <MetricTile label={t('media.plural.photo')} value={importSummary?.photos ?? 0} />
          <MetricTile label={t('media.plural.video')} value={importSummary?.videos ?? 0} />
          <MetricTile label={t('summary.senders')} value={importSummary?.senders ?? senders.length} />
        </View>

        <PremiumCard>
          <SectionHeader icon="file-multiple-outline" label={t('summary.categories')} />
          <View style={styles.list}>
            {visibleMediaTypes.map((mediaType) => {
              const saveable = isSaveableMediaType(mediaType);
              const count = getCategoryCount(mediaType, importSummary);
              return (
                <OptionChoiceCard
                  key={mediaType}
                  title={t(`media.plural.${mediaType}`)}
                  description={saveable ? t('summary.countFound', { count }) : t('summary.countFoundNotSaved', { count })}
                  selected={selectedMediaTypes[mediaType] && saveable}
                  disabled={!saveable}
                  onPress={() => toggleMediaType(mediaType)}
                  showRadio={false}
                />
              );
            })}
          </View>
        </PremiumCard>

        <PremiumCard>
          <View style={styles.sectionHeader}>
            <SectionHeader icon="account-multiple-outline" label={t('summary.senders')} />
            <View style={styles.headerActions}>
              <Button mode="text" onPress={selectAllSenders}>
                {t('summary.allSenders')}
              </Button>
              <Button mode="text" onPress={clearSenders}>
                {t('fileSelection.clear')}
              </Button>
            </View>
          </View>
          <FilterChipGroup
            values={senders}
            selectedValues={selectedSenders}
            getLabel={(sender) => `${sender} (${senderCounts.get(sender) ?? 0})`}
            onToggle={toggleSender}
          />
        </PremiumCard>
      </ScrollView>
    </WizardScreen>
  );
}

function getCategoryCount(mediaType: (typeof visibleMediaTypes)[number], summary: ReturnType<typeof usePipelineStore.getState>['importSummary']): number {
  if (!summary) return 0;
  if (mediaType === 'photo') return summary.photos;
  if (mediaType === 'video') return summary.videos;
  if (mediaType === 'voice') return summary.voice;
  if (mediaType === 'sticker') return summary.stickers;
  if (mediaType === 'document') return summary.documents;
  return summary.unknown;
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.section,
    paddingBottom: spacing.section
  },
  list: {
    gap: spacing.smallGap
  },
  sectionHeader: {
    gap: spacing.smallGap
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap'
  }
});
