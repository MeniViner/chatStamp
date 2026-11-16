import React from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Snackbar, Surface, Text } from 'react-native-paper';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FolderFallbackSheet } from '../components/FolderFallbackSheet';
import { PremiumBottomSheet } from '../components/BottomSheet';
import { usePipelineStore } from '../store/pipelineStore';
import { useSettingsStore } from '../store/settingsStore';
import { clearWorkingDirectory } from '../services/importService';
import { openFolderBestEffort, openGalleryBestEffort, openSavedFileBestEffort, shouldShowOpenGallery } from '../native/androidIntents';
import { useAppTheme } from '../theme/useAppTheme';
import { FooterActions, WizardScreen } from './WizardScreen';
import type { MediaType, SaveFileResult } from '../types/media';
import { shareOutputFiles } from '../native/outputFiles';
import { useTranslation } from 'react-i18next';
import {
  collapseAllResultRows,
  expandAllResultRows,
  getResultRowKey,
  getResultStatusKey,
  getResultsHeadlineKey,
  setResultRowExpanded,
  shouldShowTechnicalResults
} from './resultsLogic';
import {
  ExpandableTechnicalDetails,
  FilePathText,
  IconOnlyActionButton,
  MediaThumbnail,
  PremiumCard,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  SummaryMetricCard,
  textStyles
} from '../components/AppUi';
import { spacing } from '../theme/designTokens';

export function DoneScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const completion = usePipelineStore((state) => state.completion);
  const workingDirectory = usePipelineStore((state) => state.workingDirectory);
  const reset = usePipelineStore((state) => state.reset);
  const clearFiles = usePipelineStore((state) => state.clearFiles);
  const setStage = usePipelineStore((state) => state.setStage);
  const developerMode = useSettingsStore((state) => state.settings.developerMode);
  const saveDestinationMode = useSettingsStore((state) => state.settings.saveDestinationMode);
  const customFolder = useSettingsStore((state) => state.settings.customFolder);
  const [snackbar, setSnackbar] = React.useState<string | undefined>();
  const [shareSheetOpen, setShareSheetOpen] = React.useState(false);
  const [restartDialogOpen, setRestartDialogOpen] = React.useState(false);
  const [folderFallbackOpen, setFolderFallbackOpen] = React.useState(false);
  const [expandedResultKeys, setExpandedResultKeys] = React.useState<string[]>([]);
  const results = React.useMemo(() => completion?.results ?? [], [completion?.results]);
  const firstSaved = results.find((result) => result.ok);
  const hasGalleryItem = shouldShowOpenGallery(results);
  const resultKeys = React.useMemo(() => results.map((result, index) => getResultRowKey(result, index)), [results]);

  const outputFolder =
    completion?.outputDirectory ??
    results.find((result) => result.outputPath)?.outputPath?.replace(/[\\/][^\\/]+$/, '') ??
    '';
  const outputFolderDisplayName =
    saveDestinationMode === 'custom-folder'
      ? customFolder?.displayName ?? customFolder?.readablePathLabel ?? t('outputOptions.selectedFolder')
      : getFriendlyFolderName(outputFolder);

  React.useEffect(() => {
    setExpandedResultKeys([]);
  }, [completion]);

  async function startOver() {
    if (!completion?.cacheCleared) {
      await clearWorkingDirectory(workingDirectory);
    }
    reset();
  }

  async function openFolder() {
    const folderTarget = saveDestinationMode === 'custom-folder' ? customFolder : null;
    const outcome = await openFolderBestEffort(outputFolder, folderTarget, completion?.outputDirectory);
    if (outcome === 'manual-fallback') {
      setFolderFallbackOpen(true);
    }
  }

  async function openFirstSavedItem() {
    const outcome = await openGalleryBestEffort(outputFolder, results);
    if (outcome === 'manual-fallback') {
      setSnackbar(t('results.openGalleryFallback'));
    }
  }

  async function openNonMedia() {
    if (await openSavedFileBestEffort(firstSaved) === 'manual-fallback') await openFolder();
  }

  function retryFailedFiles() {
    clearFiles(results.flatMap((result) => result.ok && result.entryId ? [result.entryId] : []));
    setStage('saving');
  }

  async function shareSelectedCategories(categories: MediaType[]) {
    const result = await shareOutputFiles(completion?.results ?? [], categories);
    setShareSheetOpen(false);
    if (!result.opened) setSnackbar(result.reason ?? t('results.shareFailed'));
  }

  function expandAllResultDetails() {
    setExpandedResultKeys(expandAllResultRows(resultKeys));
  }

  function collapseAllResultDetails() {
    setExpandedResultKeys(collapseAllResultRows());
  }

  function setResultExpanded(key: string, expanded: boolean) {
    setExpandedResultKeys((current) => setResultRowExpanded(current, key, expanded));
  }

  React.useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setRestartDialogOpen(true);
      return true;
    });
    return () => subscription.remove();
  }, []);

  return (
    <WizardScreen
      stage="results"
      title={t('results.title')}
      subtitle={t(getResultsHeadlineKey(completion))}
      onBack={() => setRestartDialogOpen(true)}
      footer={
        <FooterActions>
          {hasGalleryItem ? (
            <PrimaryButton icon="image-multiple-outline" onPress={() => void openFirstSavedItem()}>
              {t('results.openGallery')}
            </PrimaryButton>
          ) : firstSaved ? (
            <PrimaryButton icon="file-outline" onPress={() => void openNonMedia()}>
              {t('results.openFirstSavedItem')}
            </PrimaryButton>
          ) : (
            <PrimaryButton icon="restart" onPress={() => setRestartDialogOpen(true)}>
              {t('results.startOver')}
            </PrimaryButton>
          )}
        </FooterActions>
      }
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PremiumCard style={styles.successCard}>
          <View style={[styles.successIcon, { backgroundColor: completion?.failed ? theme.colors.errorContainer : theme.colors.primaryContainer }]}>
            <MaterialCommunityIcons
              name={completion?.failed ? 'alert-circle-outline' : 'check-circle-outline'}
              size={48}
              color={completion?.failed ? theme.colors.error : theme.colors.primary}
            />
          </View>
          <Text variant="headlineSmall" style={[styles.successTitle, textStyles.start]}>
            {completion?.failed ? t('results.savedWithIssues') : t('results.successTitle')}
          </Text>
          <Text variant="bodyMedium" style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
            {t(getResultsHeadlineKey(completion))}
          </Text>
          <View style={styles.metricsRow}>
            <SummaryMetricCard label={t('results.filesSaved')} value={completion?.saved ?? 0} />
            <SummaryMetricCard label={t('results.datesFixed')} value={completion?.dateCorrected ?? 0} />
            <SummaryMetricCard label={t('results.failed')} value={completion?.failed ?? 0} />
          </View>
          <SummaryRow icon="folder-outline" label={t('results.outputFolder')} value={outputFolderDisplayName} />
          <ExpandableTechnicalDetails collapsedTitle={t('outputOptions.showFullPath')} expandedTitle={t('common.hideTechnicalDetails')}>
            <FilePathText value={outputFolder} maxLines={3} />
          </ExpandableTechnicalDetails>
        </PremiumCard>

        <View style={styles.actionGrid}>
          <SecondaryButton icon="share-variant-outline" disabled={!results.some((result) => result.ok)} style={styles.actionButton} onPress={() => setShareSheetOpen(true)}>
            {t('results.shareOutputFiles')}
          </SecondaryButton>
          {firstSaved && outputFolder ? (
            <SecondaryButton icon="folder-open-outline" style={styles.actionButton} onPress={() => void openFolder()}>
              {t('results.openFolder')}
            </SecondaryButton>
          ) : null}
          {completion?.failed && !completion.cacheCleared ? (
            <SecondaryButton icon="refresh" style={styles.actionButton} onPress={retryFailedFiles}>
              {t('results.retryFailedFiles')}
            </SecondaryButton>
          ) : null}
        </View>

        <Section title={t('results.savedFiles')} icon="file-check-outline">
          <View style={styles.savedFilesToolbar}>
            <Text variant="bodySmall" style={[styles.flex, textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
              {t('results.savedFilesCount', { count: results.length })}
            </Text>
            <IconOnlyActionButton
              icon="chevron-down"
              accessibilityLabel={t('results.expandAllDetails')}
              disabled={results.length === 0}
              onPress={expandAllResultDetails}
            />
            <IconOnlyActionButton
              icon="chevron-up"
              accessibilityLabel={t('results.collapseAllDetails')}
              disabled={expandedResultKeys.length === 0}
              onPress={collapseAllResultDetails}
            />
          </View>
          {results.map((result, index) => {
            const key = getResultRowKey(result, index);
            return (
              <ResultCard
                key={key}
                result={result}
                developerMode={developerMode}
                detailsExpanded={expandedResultKeys.includes(key)}
                onDetailsExpandedChange={(expanded) => setResultExpanded(key, expanded)}
              />
            );
          })}
        </Section>

        {shouldShowTechnicalResults(developerMode) ? (
          <ExpandableTechnicalDetails collapsedTitle={t('common.showTechnicalDetails')} expandedTitle={t('common.hideTechnicalDetails')}>
            <View style={styles.technicalDetails}>
              <Text variant="bodySmall">{t('results.technical.copied', { count: completion?.copied ?? completion?.saved ?? 0 })}</Text>
              <Text variant="bodySmall">{t('results.technical.filesystemTimestampFixed', { count: completion?.filesystemTimestampFixed ?? completion?.dateCorrected ?? 0 })}</Text>
              <Text variant="bodySmall">{t('results.technical.scanned', { count: completion?.scanned ?? 0 })}</Text>
              <Text variant="bodySmall">{t('results.technical.importTimeRisk', { count: completion?.mayShowImportTime ?? 0 })}</Text>
              <Text variant="bodySmall">{t('results.technical.cacheCleared', { value: completion?.cacheCleared ? t('common.yes') : t('results.notYetVerified') })}</Text>
            </View>
          </ExpandableTechnicalDetails>
        ) : null}
      </ScrollView>

      <ConfirmDialog
        visible={restartDialogOpen}
        title={t('results.startOverTitle')}
        body={t('results.startOverBody')}
        confirmLabel={t('results.startOver')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={() => void startOver()}
        onDismiss={() => setRestartDialogOpen(false)}
      />
      <FolderFallbackSheet
        visible={folderFallbackOpen}
        title={t('results.openFolder')}
        subtitle={t('results.openFolderFallbackTitle')}
        helperText={t('results.openFolderFallback')}
        outputFolder={outputFolder}
        canOpenFirstSavedItem={Boolean(firstSaved)}
        onDismiss={() => setFolderFallbackOpen(false)}
        onOpenFirstSavedItem={() => {
          if (hasGalleryItem) void openFirstSavedItem();
          else void openSavedFileBestEffort(firstSaved);
        }}
        onRetryOpenFolder={async () => {
          const folderTarget = saveDestinationMode === 'custom-folder' ? customFolder : null;
          const outcome = await openFolderBestEffort(outputFolder, folderTarget, completion?.outputDirectory);
          if (outcome === 'manual-fallback') {
            setSnackbar(t('results.openFolderFallback'));
          } else {
            setFolderFallbackOpen(false);
          }
        }}
        onCopied={(message) => setSnackbar(message)}
      />
      <ShareOutputSheet
        visible={shareSheetOpen}
        results={results}
        onDismiss={() => setShareSheetOpen(false)}
        onShare={(categories) => void shareSelectedCategories(categories)}
      />
      <Snackbar visible={Boolean(snackbar)} onDismiss={() => setSnackbar(undefined)} duration={3200}>
        {snackbar}
      </Snackbar>
    </WizardScreen>
  );
}

function Section({
  title,
  icon,
  children
}: {
  title: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <SectionHeader icon={icon} label={title} />
      <PremiumCard>{children}</PremiumCard>
    </View>
  );
}

function SummaryRow({ icon, label, value }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label: string; value: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.summaryRow}>
      <MaterialCommunityIcons name={icon} size={20} color={theme.colors.secondary} />
      <View style={styles.flex}>
        <Text variant="labelLarge" style={textStyles.start}>{label}</Text>
        <Text variant="bodySmall" numberOfLines={2} style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function ShareOutputSheet({
  visible,
  results,
  onDismiss,
  onShare
}: {
  visible: boolean;
  results: SaveFileResult[];
  onDismiss: () => void;
  onShare: (categories: MediaType[]) => void;
}) {
  const { t } = useTranslation();
  const available = React.useMemo(() => {
    const types = Array.from(new Set(results.filter((result) => result.ok && result.mediaType).map((result) => result.mediaType as MediaType)));
    return types;
  }, [results]);
  const counts = React.useMemo(() => {
    const next = new Map<MediaType, number>();
    results.forEach((result) => {
      if (result.ok && result.mediaType) next.set(result.mediaType, (next.get(result.mediaType) ?? 0) + 1);
    });
    return next;
  }, [results]);
  const [selected, setSelected] = React.useState<MediaType[]>([]);

  React.useEffect(() => {
    const defaults = available.filter((type) => type === 'photo' || type === 'video');
    setSelected(defaults.length > 0 ? defaults : available);
  }, [available]);

  function toggle(type: MediaType) {
    setSelected((current) => (current.includes(type) ? current.filter((item) => item !== type) : [...current, type]));
  }

  return (
    <PremiumBottomSheet
      visible={visible}
      title={t('results.shareSheetTitle')}
      subtitle={t('results.shareOutputFilesBody')}
      onDismiss={onDismiss}
      footer={<PrimaryButton disabled={selected.length === 0} onPress={() => onShare(selected)}>{t('results.shareAction')}</PrimaryButton>}
    >
      <SecondaryButton selected={selected.length === available.length && available.length > 0} onPress={() => setSelected(available)}>
        {t('results.shareAll', { count: available.reduce((sum, type) => sum + (counts.get(type) ?? 0), 0) })}
      </SecondaryButton>
      {available.map((type) => (
        <SecondaryButton key={type} selected={selected.includes(type)} onPress={() => toggle(type)}>
          {t('results.shareCategory', { label: t(`media.plural.${type}`), count: counts.get(type) ?? 0 })}
        </SecondaryButton>
      ))}
    </PremiumBottomSheet>
  );
}

function ResultCard({
  result,
  developerMode,
  detailsExpanded,
  onDetailsExpandedChange
}: {
  result: SaveFileResult;
  developerMode: boolean;
  detailsExpanded: boolean;
  onDetailsExpandedChange: (expanded: boolean) => void;
}) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const ok = result.ok && !result.galleryMaySortByImportTime;
  const previewUri = getResultPreviewUri(result);
  return (
    <Surface elevation={0} style={[styles.resultCard, { borderColor: ok ? theme.colors.outlineVariant : theme.colors.error }]}>
      <View style={styles.resultHeader}>
        <MediaThumbnail mediaType={result.mediaType ?? 'unknown'} uri={previewUri} size={62} />
        <MaterialCommunityIcons
          name={ok ? 'check-circle-outline' : result.ok ? 'clock-alert-outline' : 'alert-circle-outline'}
          size={22}
          color={ok ? theme.colors.primary : theme.colors.error}
        />
        <View style={styles.flex}>
          <Text variant="titleSmall" numberOfLines={1} style={textStyles.start}>
            {result.displayName ?? result.filename}
          </Text>
          <Text variant="bodySmall" numberOfLines={1} style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
            {t(`media.singular.${result.mediaType ?? 'unknown'}`)} • {formatDate(result.targetTimestampMillis ?? result.whatsAppDateIso ?? result.originalTimestampMillis, t)}
          </Text>
        </View>
      </View>
      <Text variant="labelLarge" style={[textStyles.start, { color: ok ? theme.colors.primary : theme.colors.error }]}>
        {result.failureReason
          ? t(getResultStatusKey(result), { reason: result.failureReason })
          : t(getResultStatusKey(result))}
      </Text>
      {result.replacementWarning ? <Text variant="bodySmall" style={textStyles.start}>{t('results.previousFileKept')}</Text> : null}
      <ExpandableTechnicalDetails
        collapsedTitle={t('outputOptions.showFullPath')}
        expandedTitle={t('common.hideTechnicalDetails')}
        expanded={detailsExpanded}
        onExpandedChange={onDetailsExpandedChange}
      >
        <FilePathText value={result.outputPath ?? t('common.none')} maxLines={3} />
      </ExpandableTechnicalDetails>
      {shouldShowTechnicalResults(developerMode) ? (
        <ExpandableTechnicalDetails
          collapsedTitle={t('common.technicalDetails')}
          expandedTitle={t('common.hideTechnicalDetails')}
          expanded={detailsExpanded}
          onExpandedChange={onDetailsExpandedChange}
        >
          <View style={styles.resultTechnical}>
            <Text variant="bodySmall">{t('results.technical.actualLastModified', { value: formatDate(result.observedModifiedMillis ?? result.actualLastModifiedMillis, t) })}</Text>
            <Text variant="bodySmall">{t('results.technical.dateTaken', { value: formatDate(result.mediaStoreDateTaken, t) })}</Text>
            <Text variant="bodySmall">{t('results.technical.scannedUri', { value: result.scannedUri ?? result.insertedUri ?? t('common.none') })}</Text>
            {result.failureReason ? <Text variant="bodySmall">{t('results.technical.failure', { value: result.failureReason })}</Text> : null}
          </View>
        </ExpandableTechnicalDetails>
      ) : null}
    </Surface>
  );
}

function getResultPreviewUri(result: SaveFileResult): string | undefined {
  const candidate = result.insertedUri ?? result.scannedUri ?? result.outputPath;
  if (!candidate) return undefined;
  if (candidate.startsWith('content://') || candidate.startsWith('file://')) return candidate;
  if (candidate.startsWith('/')) return `file://${candidate}`;
  return candidate;
}

function formatDate(value: string | number | null | undefined, t: (key: string) => string): string {
  if (!value) return t('fileSelection.noDate');
  const date = typeof value === 'number' ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return t('fileSelection.noDate');
  return date.toLocaleString();
}

function getFriendlyFolderName(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  return normalized.split('/').filter(Boolean).pop() ?? path;
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.section,
    paddingBottom: 144
  },
  successCard: {
    alignItems: 'stretch'
  },
  successIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start'
  },
  successTitle: {
    fontWeight: '800'
  },
  section: {
    gap: spacing.smallGap
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.smallGap
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.smallGap
  },
  actionButton: {
    minWidth: 150,
    flexGrow: 1
  },
  savedFilesToolbar: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tinyGap
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.smallGap
  },
  flex: {
    flex: 1,
    minWidth: 0
  },
  resultCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 8
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  resultTechnical: {
    gap: 4,
    paddingBottom: 8
  },
  technicalDetails: {
    gap: 4
  }
});
