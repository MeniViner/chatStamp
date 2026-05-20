import React from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { List, Text } from 'react-native-paper';
import { usePipelineStore } from '../store/pipelineStore';
import { buildSelectedPreview } from '../store/selectedPreview';
import { buildTermuxParityOutputPath, sanitizePathSegment } from '../lib/termuxParityOutput';
import { useSettingsStore } from '../store/settingsStore';
import { useAppTheme } from '../theme/useAppTheme';
import { FooterActions, WizardScreen, wizardStyles } from './WizardScreen';
import { useTranslation } from 'react-i18next';
import { FilePathText, MetricTile, PremiumCard, PrimaryButton, SecondaryButton, SectionHeader, StatusBanner, textStyles } from '../components/AppUi';
import { spacing } from '../theme/designTokens';

export function ReviewSaveScreen() {
  const { t } = useTranslation();
  const mediaFiles = usePipelineStore((state) => state.mediaFiles);
  const selectedSenders = usePipelineStore((state) => state.selectedSenders);
  const selectedMediaTypes = usePipelineStore((state) => state.selectedMediaTypes);
  const selectedFileIds = usePipelineStore((state) => state.selectedFileIds);
  const zipName = usePipelineStore((state) => state.zipName);
  const setStage = usePipelineStore((state) => state.setStage);
  const settings = useSettingsStore((state) => state.settings);
  const preview = buildSelectedPreview(mediaFiles, selectedSenders, selectedMediaTypes, selectedFileIds);
  const outputPath = buildTermuxParityOutputPath(sanitizePathSegment(zipName?.replace(/\.zip$/i, '') ?? 'Imported Chat'), {
    baseFolder: settings.baseFolder,
    organization: settings.outputOrganization
  });
  const photos = preview.selectedFiles.filter((file) => file.mediaType === 'photo');
  const videos = preview.selectedFiles.filter((file) => file.mediaType === 'video');
  const other = preview.selectedFiles.filter((file) => file.mediaType !== 'photo' && file.mediaType !== 'video');

  React.useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setStage('outputOptions');
      return true;
    });
    return () => subscription.remove();
  }, [setStage]);

  return (
    <WizardScreen
      stage="reviewSave"
      title={t('reviewSave.title')}
      subtitle={t('reviewSave.subtitle')}
      onBack={() => setStage('outputOptions')}
      footer={
        <FooterActions>
          <PrimaryButton icon="content-save-check-outline" onPress={() => setStage('saving')}>
            {t('reviewSave.saveToGallery')}
          </PrimaryButton>
          <SecondaryButton onPress={() => setStage('outputOptions')}>
            {t('reviewSave.back')}
          </SecondaryButton>
        </FooterActions>
      }
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={wizardStyles.rowWrap}>
          <MetricTile label={t('reviewSave.photos')} value={preview.selectedPhotos} />
          <MetricTile label={t('reviewSave.videos')} value={preview.selectedVideos} />
          <MetricTile label={t('reviewSave.other')} value={other.length} />
        </View>

        <StatusBanner tone="success" icon="calendar-check-outline" title={t('reviewSave.originalDates')} body={t('reviewSave.appWillUse')} />

        <PremiumCard>
          <SectionHeader icon="clipboard-check-outline" label={t('reviewSave.saveDetails')} />
          <Detail label={t('reviewSave.outputFolder')} value={outputPath} />
          <Detail label={t('reviewSave.saveMethod')} value={t('reviewSave.accurateMode')} />
        </PremiumCard>

        <GroupedPreview title={t('reviewSave.photos')} files={photos} />
        <GroupedPreview title={t('reviewSave.videos')} files={videos} />
        <GroupedPreview title={t('reviewSave.otherFiles')} files={other} />
      </ScrollView>
    </WizardScreen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  return (
    <View style={styles.detail}>
      <Text variant="labelLarge" style={textStyles.start}>{label}</Text>
      {value.includes('/') || value.includes('\\') ? (
        <List.Accordion title={t('outputOptions.showFullPath')} titleStyle={styles.accordionTitle}>
          <FilePathText value={value} maxLines={3} />
        </List.Accordion>
      ) : (
        <Text variant="bodyMedium" numberOfLines={3} style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
          {value}
        </Text>
      )}
    </View>
  );
}

function GroupedPreview({ title, files }: { title: string; files: ReturnType<typeof buildSelectedPreview>['selectedFiles'] }) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  if (files.length === 0) return null;
  return (
    <PremiumCard>
      <Text variant="titleMedium" style={[wizardStyles.tabular, styles.groupTitle, textStyles.start]}>
        {title} ({files.length})
      </Text>
      {files.slice(0, 8).map((file) => (
        <View key={file.id} style={styles.fileLine}>
        <Text variant="bodyMedium" numberOfLines={2} style={[styles.flex, textStyles.start]}>
          {file.filename}
        </Text>
          <Text variant="bodySmall" numberOfLines={1} style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
            {new Date(file.originalDateIso).toLocaleDateString()}
          </Text>
        </View>
      ))}
      {files.length > 8 ? (
        <Text variant="bodySmall" style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
          {t('reviewSave.andXMore', { count: files.length - 8 })}
        </Text>
      ) : null}
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.card,
    paddingBottom: spacing.section
  },
  flex: {
    flex: 1
  },
  detail: {
    gap: spacing.tinyGap
  },
  groupTitle: {
    fontWeight: '700'
  },
  fileLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.gap
  },
  accordionTitle: {
    fontSize: 13,
    fontWeight: '700'
  }
});
