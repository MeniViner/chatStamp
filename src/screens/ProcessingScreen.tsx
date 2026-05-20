import React, { useEffect, useRef } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, ProgressBar, Snackbar, Text } from 'react-native-paper';
import { usePipelineStore } from '../store/pipelineStore';
import { runSavePipeline } from '../services/pipelineService';
import { buildTermuxParityOutputPath, sanitizePathSegment } from '../lib/termuxParityOutput';
import { createExportHistoryItem, useHistoryStore } from '../store/historyStore';
import { useSettingsStore } from '../store/settingsStore';
import { useAppTheme } from '../theme/useAppTheme';
import { WizardScreen, wizardStyles } from './WizardScreen';
import { useTranslation } from 'react-i18next';
import { PremiumCard, StatusBanner, textStyles } from '../components/AppUi';

const analyzeStepKeys = [
  'processing.analyzeSteps.receivingZip',
  'processing.analyzeSteps.copyingToCache',
  'processing.analyzeSteps.validatingZip',
  'processing.analyzeSteps.findingTranscript',
  'processing.analyzeSteps.parsingMessages',
  'processing.analyzeSteps.matchingMedia',
  'processing.analyzeSteps.classifyingMedia'
];

const saveOperationKeys = ['processing.saveSteps.copying', 'processing.saveSteps.settingDate', 'processing.saveSteps.scanningGallery', 'processing.saveSteps.done'];

export function ProcessingScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const stage = usePipelineStore((state) => state.stage);
  const progress = usePipelineStore((state) => state.progress);
  const mediaFiles = usePipelineStore((state) => state.mediaFiles);
  const selectedSenders = usePipelineStore((state) => state.selectedSenders);
  const selectedMediaTypes = usePipelineStore((state) => state.selectedMediaTypes);
  const selectedFileIds = usePipelineStore((state) => state.selectedFileIds);
  const workingDirectory = usePipelineStore((state) => state.workingDirectory);
  const zipName = usePipelineStore((state) => state.zipName);
  const setProgress = usePipelineStore((state) => state.setProgress);
  const setCompletion = usePipelineStore((state) => state.setCompletion);
  const setError = usePipelineStore((state) => state.setError);
  const settings = useSettingsStore((state) => state.settings);
  const updateSettings = useSettingsStore((state) => state.updateSettings);
  const addHistoryItem = useHistoryStore((state) => state.addHistoryItem);
  const saveStarted = useRef(false);
  const [backNoticeVisible, setBackNoticeVisible] = React.useState(false);

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
          chatName: zipName?.replace(/\.zip$/i, '') ?? t('common.importedChat'),
          settings,
          onProgress: setProgress
        });
        const outputFolderPath =
          completion.results?.find((result) => result.outputPath)?.outputPath?.replace(/[\\/][^\\/]+$/, '') ??
          buildTermuxParityOutputPath(sanitizePathSegment(zipName?.replace(/\.zip$/i, '') ?? t('common.importedChat')), {
            baseFolder: settings.baseFolder,
            organization: settings.outputOrganization
          });
        await updateSettings({ lastOutputFolder: outputFolderPath });
        await addHistoryItem(createExportHistoryItem({
          completion,
          files: mediaFiles,
          selectedFileIds,
          selectedMediaTypes,
          selectedSenders,
          chatName: sanitizePathSegment(zipName?.replace(/\.zip$/i, '') ?? t('common.importedChat')),
          outputFolderPath
        }));
        setCompletion(completion);
      } catch (error) {
        setError(error instanceof Error ? error.message : t('processing.savingFailed'));
      }
    }

    void saveSelectedMedia();
  }, [
    mediaFiles,
    selectedMediaTypes,
    selectedSenders,
    selectedFileIds,
    zipName,
    setCompletion,
    setError,
    setProgress,
    settings,
    stage,
    t,
    updateSettings,
    addHistoryItem,
    workingDirectory
  ]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stage === 'saving' || stage === 'analyzing') {
        setBackNoticeVisible(true);
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [stage]);

  const isSaving = stage === 'saving';
  const processed = progress?.processed ?? 0;
  const total = Math.max(progress?.total ?? (isSaving ? selectedFileIds.length : analyzeStepKeys.length), 1);
  const progressValue = Math.min(1, processed / total);
  const stageLabel = translateProgressLabel(t, progress?.stageLabel) ?? (isSaving ? t('processing.preparingSave') : t('processing.preparingImport'));

  return (
    <WizardScreen
      stage={isSaving ? 'saving' : 'analyzing'}
      title={isSaving ? t('processing.savingTitle') : t('processing.analyzeTitle')}
      subtitle={
        isSaving
          ? t('processing.savingSubtitle')
          : t('processing.analyzeSubtitle')
      }
      backDisabled
      contentStyle={styles.content}
    >
      <PremiumCard style={styles.progressCard} contentStyle={styles.centerPanel}>
        <ActivityIndicator size="large" />
        <Text variant="displaySmall" style={styles.percentText}>{Math.round(progressValue * 100)}%</Text>
        <Text variant="titleMedium" style={textStyles.start}>{stageLabel}</Text>
        <ProgressBar progress={progressValue} color={theme.colors.primary} style={styles.progressBar} />
        <Text variant="bodyMedium" style={[wizardStyles.tabular, { color: theme.colors.onSurfaceVariant }]}>
          {t('processing.progressCount', {
            processed,
            total,
            failed: progress?.failed ?? 0
          })}
        </Text>
      </PremiumCard>

      {isSaving ? (
        <PremiumCard>
          {saveOperationKeys.map((operationKey, index) => {
            const activeIndex = progressValue >= 1 ? saveOperationKeys.length - 1 : Math.min(saveOperationKeys.length - 2, Math.floor(progressValue * 3));
            return <ChecklistRow key={operationKey} label={t(operationKey)} state={index < activeIndex ? 'completed' : index === activeIndex ? 'active' : 'pending'} />;
          })}
        </PremiumCard>
      ) : (
        <PremiumCard>
          {analyzeStepKeys.map((stepKey, index) => {
            const state = index < processed ? 'completed' : index === processed ? 'active' : 'pending';
            return <ChecklistRow key={stepKey} label={t(stepKey)} state={state} />;
          })}
        </PremiumCard>
      )}

      {isSaving ? (
        <StatusBanner tone="info" icon="shield-check-outline" title={t('processing.keepOpenTitle')} body={t('processing.keepOpenBody')} />
      ) : null}

      <Snackbar visible={backNoticeVisible} onDismiss={() => setBackNoticeVisible(false)} duration={2200}>
        {t('processing.waitUntilDone')}
      </Snackbar>
    </WizardScreen>
  );
}

function translateProgressLabel(t: (key: string) => string, label?: string): string | undefined {
  const map: Record<string, string> = {
    'ZIP received from Android share sheet': 'processing.progressLabels.zipReceived',
    'Preparing cache': 'processing.progressLabels.preparingCache',
    'Copying ZIP': 'processing.progressLabels.copyingZip',
    'Validating ZIP and reading entries': 'processing.progressLabels.validatingZip',
    'Finding transcript and parsing messages': 'processing.progressLabels.findingTranscript',
    'Matching and classifying media': 'processing.progressLabels.matchingMedia',
    'Import ready': 'processing.progressLabels.importReady',
    'Copying files, setting filesystem timestamps, then scanning': 'processing.progressLabels.savingFiles',
    Done: 'processing.progressLabels.done'
  };
  if (!label) return undefined;
  const key = map[label];
  return key ? t(key) : label;
}

function ChecklistRow({ label, state }: { label: string; state: 'pending' | 'active' | 'completed' | 'failed' }) {
  const theme = useAppTheme();
  const icon = state === 'completed' ? 'check-circle' : state === 'failed' ? 'alert-circle' : state === 'active' ? 'progress-clock' : 'circle-outline';
  const color =
    state === 'completed'
      ? theme.colors.primary
      : state === 'failed'
        ? theme.colors.error
        : state === 'active'
          ? theme.colors.secondary
          : theme.colors.outline;

  return (
    <View
      style={[
        styles.checkRow,
        {
          backgroundColor: state === 'active' ? theme.colors.primaryContainer : 'transparent'
        }
      ]}
    >
      <MaterialCommunityIcons name={icon} size={24} color={color} />
      <Text variant="bodyLarge" style={[styles.flex, textStyles.start, { color: state === 'pending' ? theme.colors.onSurfaceVariant : theme.colors.onSurface }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 20
  },
  progressCard: {
    paddingVertical: 22
  },
  centerPanel: {
    alignItems: 'center',
    gap: 12
  },
  percentText: {
    fontWeight: '800',
    letterSpacing: 0
  },
  progressBar: {
    width: '100%',
    height: 8,
    borderRadius: 999
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  flex: {
    flex: 1
  }
});
