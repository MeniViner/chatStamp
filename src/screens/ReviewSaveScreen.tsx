import React from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Divider, Surface, Text } from 'react-native-paper';
import { usePipelineStore } from '../store/pipelineStore';
import { buildSelectedPreview } from '../store/selectedPreview';
import { buildTermuxParityOutputPath, sanitizePathSegment } from '../lib/termuxParityOutput';
import { useSettingsStore } from '../store/settingsStore';
import { useAppTheme } from '../theme/useAppTheme';
import { FooterActions, MetricCard, WizardScreen, wizardStyles } from './WizardScreen';
import { useTranslation } from 'react-i18next';

export function ReviewSaveScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
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
          <Button mode="contained" icon="content-save-check-outline" onPress={() => setStage('saving')}>
            {t('reviewSave.saveToGallery')}
          </Button>
          <Button mode="text" onPress={() => setStage('outputOptions')}>
            {t('reviewSave.back')}
          </Button>
        </FooterActions>
      }
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={wizardStyles.rowWrap}>
            <MetricCard label={t('reviewSave.photos')} value={preview.selectedPhotos} />
            <MetricCard label={t('reviewSave.videos')} value={preview.selectedVideos} />
            <MetricCard label={t('reviewSave.other')} value={other.length} />
        </View>

        <Surface elevation={0} style={[styles.confidenceCard, { backgroundColor: theme.colors.secondaryContainer, borderColor: theme.colors.secondary }]}>
          <MaterialCommunityIcons name="calendar-check-outline" size={28} color={theme.colors.secondary} />
          <View style={styles.flex}>
            <Text variant="titleMedium" style={{ color: theme.colors.onSecondaryContainer }}>
              {t('reviewSave.originalDates')}
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSecondaryContainer }}>
              {t('reviewSave.appWillUse')}
            </Text>
          </View>
        </Surface>

        <View style={wizardStyles.section}>
          <Text variant="titleMedium">{t('reviewSave.saveDetails')}</Text>
          <Detail label={t('reviewSave.outputFolder')} value={outputPath} />
          <Detail label={t('reviewSave.saveMethod')} value={t('reviewSave.accurateMode')} />
        </View>

        <GroupedPreview title={t('reviewSave.photos')} files={photos} />
        <GroupedPreview title={t('reviewSave.videos')} files={videos} />
        <GroupedPreview title={t('reviewSave.otherFiles')} files={other} />
      </ScrollView>
    </WizardScreen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.detail}>
      <Text variant="labelLarge">{label}</Text>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        {value}
      </Text>
    </View>
  );
}

function GroupedPreview({ title, files }: { title: string; files: ReturnType<typeof buildSelectedPreview>['selectedFiles'] }) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  if (files.length === 0) return null;
  return (
    <Surface elevation={0} style={[styles.group, { borderColor: theme.colors.outlineVariant }]}>
      <Text variant="titleMedium" style={[wizardStyles.tabular, styles.groupTitle]}>
        {title} ({files.length})
      </Text>
      <Divider />
      {files.slice(0, 8).map((file) => (
        <View key={file.id} style={styles.fileLine}>
          <Text variant="bodyMedium" numberOfLines={1} style={styles.flex}>
            {file.filename}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {new Date(file.originalDateIso).toLocaleDateString()}
          </Text>
        </View>
      ))}
      {files.length > 8 ? (
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {t('reviewSave.andXMore', { count: files.length - 8 })}
        </Text>
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 18,
    paddingBottom: 24
  },
  confidenceCard: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    flexDirection: 'row',
    gap: 12
  },
  flex: {
    flex: 1
  },
  detail: {
    gap: 2
  },
  group: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 10
  },
  groupTitle: {
    fontWeight: '700'
  },
  fileLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  }
});
