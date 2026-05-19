import React from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Divider, List, Snackbar, Surface, Text } from 'react-native-paper';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FolderFallbackSheet } from '../components/FolderFallbackSheet';
import { BottomSheet } from '../components/BottomSheet';
import { usePipelineStore } from '../store/pipelineStore';
import { useSettingsStore } from '../store/settingsStore';
import { clearWorkingDirectory } from '../services/importService';
import { buildTermuxParityOutputPath, sanitizePathSegment } from '../lib/termuxParityOutput';
import { openFolderBestEffort, openGalleryBestEffort, shouldShowOpenGallery } from '../native/androidIntents';
import { useAppTheme } from '../theme/useAppTheme';
import { FooterActions, MetricCard, WizardScreen } from './WizardScreen';
import type { MediaType, SaveFileResult } from '../types/media';
import { shareOutputFiles } from '../native/outputFiles';
import { useTranslation } from 'react-i18next';
import { getResultStatusKey, getResultsHeadlineKey, shouldShowTechnicalResults } from './resultsLogic';
import { textStyles } from '../components/AppUi';

export function DoneScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const completion = usePipelineStore((state) => state.completion);
  const workingDirectory = usePipelineStore((state) => state.workingDirectory);
  const zipName = usePipelineStore((state) => state.zipName);
  const reset = usePipelineStore((state) => state.reset);
  const openOverlayStage = usePipelineStore((state) => state.openOverlayStage);
  const developerMode = useSettingsStore((state) => state.settings.developerMode);
  const saveDestinationMode = useSettingsStore((state) => state.settings.saveDestinationMode);
  const customFolder = useSettingsStore((state) => state.settings.customFolder);
  const [snackbar, setSnackbar] = React.useState<string | undefined>();
  const [shareSheetOpen, setShareSheetOpen] = React.useState(false);
  const [restartDialogOpen, setRestartDialogOpen] = React.useState(false);
  const [folderFallbackOpen, setFolderFallbackOpen] = React.useState(false);

  const outputFolder =
    completion?.results?.find((result) => result.outputPath)?.outputPath?.replace(/[\\/][^\\/]+$/, '') ??
    buildTermuxParityOutputPath(sanitizePathSegment(zipName?.replace(/\.zip$/i, '') ?? t('common.importedChat')));

  async function startOver() {
    if (!completion?.cacheCleared) {
      await clearWorkingDirectory(workingDirectory);
    }
    reset();
  }

  async function openFolder() {
    const folderTarget = saveDestinationMode === 'custom-folder' ? customFolder : null;
    const outcome = await openFolderBestEffort(outputFolder, folderTarget);
    if (outcome === 'manual-fallback') {
      setFolderFallbackOpen(true);
    }
  }

  async function openFirstSavedItem() {
    const outcome = await openGalleryBestEffort(outputFolder, completion?.results);
    if (outcome === 'manual-fallback') {
      setSnackbar(t('results.openGalleryFallback'));
    }
  }

  async function shareSelectedCategories(categories: MediaType[]) {
    const result = await shareOutputFiles(completion?.results ?? [], categories);
    setShareSheetOpen(false);
    if (!result.opened) setSnackbar(result.reason ?? t('results.shareFailed'));
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
          <Button mode="contained" icon="folder-open-outline" onPress={() => void openFolder()}>
            {t('results.openFolder')}
          </Button>
          {shouldShowOpenGallery(completion?.results) ? (
            <Button mode="contained-tonal" icon="image-multiple-outline" onPress={() => void openFirstSavedItem()}>
              {t('results.openFirstSavedItem')}
            </Button>
          ) : null}
          <Button mode="outlined" icon="share-variant-outline" disabled={!completion?.results?.some((result) => result.ok)} onPress={() => setShareSheetOpen(true)}>
            {t('results.shareOutputFiles')}
          </Button>
          <View style={styles.footerRow}>
            <Button mode="outlined" style={styles.footerButton} onPress={() => setRestartDialogOpen(true)}>
              {t('results.importAnotherZip')}
            </Button>
            <Button mode="text" style={styles.footerButton} onPress={() => openOverlayStage('history')}>
              {t('settings.history')}
            </Button>
          </View>
        </FooterActions>
      }
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Surface
          elevation={0}
          style={[
            styles.successBanner,
            {
              backgroundColor: completion?.failed ? theme.colors.errorContainer : theme.colors.primaryContainer,
              borderColor: completion?.failed ? theme.colors.error : theme.colors.primary
            }
          ]}
        >
          <MaterialCommunityIcons
            name={completion?.failed ? 'alert-circle-outline' : 'check-circle-outline'}
            size={34}
            color={completion?.failed ? theme.colors.error : theme.colors.primary}
          />
          <View style={styles.flex}>
            <Text variant="headlineSmall" style={textStyles.start}>{completion?.failed ? t('results.savedWithIssues') : t('results.successTitle')}</Text>
            <Text variant="bodySmall" numberOfLines={2} style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
              {outputFolder}
            </Text>
          </View>
        </Surface>

        <View style={styles.metricsRow}>
          <MetricCard label={t('results.filesSaved')} value={completion?.saved ?? 0} />
          <MetricCard label={t('results.datesFixed')} value={completion?.dateCorrected ?? 0} />
          <MetricCard label={t('results.failed')} value={completion?.failed ?? 0} />
        </View>

        <Section title={t('results.summaryTitle')}>
          <SummaryRow icon="calendar-clock-outline" label={t('results.folderReady')} value={completion?.mayShowImportTime ? t('results.someNeedReview') : t('results.allReady')} />
          <SummaryRow icon="folder-outline" label={t('results.outputFolder')} value={outputFolder} />
          <SummaryRow icon="image-check-outline" label={t('results.galleryItems')} value={String(completion?.scanned ?? 0)} />
        </Section>

        <Section title={t('results.savedFiles')}>
          {completion?.results?.map((result) => (
            <ResultCard key={`${result.filename}-${result.outputPath ?? result.failureReason}`} result={result} developerMode={developerMode} />
          ))}
        </Section>

        {shouldShowTechnicalResults(developerMode) ? (
          <List.Accordion title={t('common.showTechnicalDetails')} left={(props) => <List.Icon {...props} icon="information-outline" />}>
            <View style={[styles.technicalDetails, { borderColor: theme.colors.outlineVariant }]}>
              <Text variant="bodySmall">{t('results.technical.copied', { count: completion?.copied ?? completion?.saved ?? 0 })}</Text>
              <Text variant="bodySmall">{t('results.technical.filesystemTimestampFixed', { count: completion?.filesystemTimestampFixed ?? completion?.dateCorrected ?? 0 })}</Text>
              <Text variant="bodySmall">{t('results.technical.scanned', { count: completion?.scanned ?? 0 })}</Text>
              <Text variant="bodySmall">{t('results.technical.importTimeRisk', { count: completion?.mayShowImportTime ?? 0 })}</Text>
              <Text variant="bodySmall">{t('results.technical.cacheCleared', { value: completion?.cacheCleared ? t('common.yes') : t('results.notYetVerified') })}</Text>
            </View>
          </List.Accordion>
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
        canOpenFirstSavedItem={shouldShowOpenGallery(completion?.results)}
        onDismiss={() => setFolderFallbackOpen(false)}
        onOpenFirstSavedItem={() => void openFirstSavedItem()}
        onRetryOpenFolder={async () => {
          const folderTarget = saveDestinationMode === 'custom-folder' ? customFolder : null;
          const outcome = await openFolderBestEffort(outputFolder, folderTarget);
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
        results={completion?.results ?? []}
        onDismiss={() => setShareSheetOpen(false)}
        onShare={(categories) => void shareSelectedCategories(categories)}
      />
      <Snackbar visible={Boolean(snackbar)} onDismiss={() => setSnackbar(undefined)} duration={3200}>
        {snackbar}
      </Snackbar>
    </WizardScreen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useAppTheme();
  return (
    <Surface elevation={0} style={[styles.section, { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surface }]}>
      <Text variant="titleMedium" style={textStyles.start}>{title}</Text>
      {children}
    </Surface>
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
  const [selected, setSelected] = React.useState<MediaType[]>([]);

  React.useEffect(() => {
    const defaults = available.filter((type) => type === 'photo' || type === 'video');
    setSelected(defaults.length > 0 ? defaults : available);
  }, [available]);

  function toggle(type: MediaType) {
    setSelected((current) => (current.includes(type) ? current.filter((item) => item !== type) : [...current, type]));
  }

  return (
    <BottomSheet visible={visible} title={t('results.shareOutputFiles')} subtitle={t('results.shareOutputFilesBody')} onDismiss={onDismiss}>
      {available.map((type) => (
        <Button key={type} mode={selected.includes(type) ? 'contained-tonal' : 'outlined'} onPress={() => toggle(type)}>
          {t(`media.plural.${type}`)}
        </Button>
      ))}
      <Button mode="contained" disabled={selected.length === 0} onPress={() => onShare(selected)}>
        {t('results.shareOutputFiles')}
      </Button>
    </BottomSheet>
  );
}

function ResultCard({ result, developerMode }: { result: SaveFileResult; developerMode: boolean }) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const ok = result.ok && !result.galleryMaySortByImportTime;
  return (
    <Surface elevation={0} style={[styles.resultCard, { borderColor: ok ? theme.colors.outlineVariant : theme.colors.error }]}>
      <View style={styles.resultHeader}>
        <MaterialCommunityIcons
          name={ok ? 'check-circle-outline' : result.ok ? 'clock-alert-outline' : 'alert-circle-outline'}
          size={22}
          color={ok ? theme.colors.primary : theme.colors.error}
        />
        <View style={styles.flex}>
          <Text variant="titleSmall" numberOfLines={1} style={textStyles.start}>
            {result.filename}
          </Text>
          <Text variant="bodySmall" numberOfLines={1} style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
            {t(`media.singular.${result.mediaType ?? 'unknown'}`)} • {formatDate(result.whatsAppDateIso ?? result.originalTimestampMillis, t)}
          </Text>
        </View>
      </View>
      <Divider />
      <Text variant="labelLarge" style={[textStyles.start, { color: ok ? theme.colors.primary : theme.colors.error }]}>
        {result.failureReason
          ? t(getResultStatusKey(result), { reason: result.failureReason })
          : t(getResultStatusKey(result))}
      </Text>
      <Text variant="bodySmall" numberOfLines={2} style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
        {result.outputPath ?? t('common.none')}
      </Text>
      {shouldShowTechnicalResults(developerMode) ? (
        <List.Accordion title={t('common.technicalDetails')} titleStyle={styles.smallAccordionTitle}>
          <View style={styles.resultTechnical}>
            <Text variant="bodySmall">{t('results.technical.setLastModified', { value: result.setLastModifiedReturned ? t('common.true') : t('common.false') })}</Text>
            <Text variant="bodySmall">{t('results.technical.actualLastModified', { value: formatDate(result.actualLastModifiedMillis, t) })}</Text>
            <Text variant="bodySmall">{t('results.technical.filesystemTimestamp', { value: result.filesystemTimestampFixed ? t('results.fixed') : t('results.notFixed') })}</Text>
            <Text variant="bodySmall">{t('results.technical.mediaScan', { value: result.mediaScannerCompleted ? t('results.completed') : t('results.notCompleted') })}</Text>
            <Text variant="bodySmall">{t('results.technical.scannedUri', { value: result.scannedUri ?? result.insertedUri ?? t('common.none') })}</Text>
            {result.failureReason ? <Text variant="bodySmall">{t('results.technical.failure', { value: result.failureReason })}</Text> : null}
          </View>
        </List.Accordion>
      ) : null}
    </Surface>
  );
}

function formatDate(value: string | number | null | undefined, t: (key: string) => string): string {
  if (!value) return t('fileSelection.noDate');
  const date = typeof value === 'number' ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return t('fileSelection.noDate');
  return date.toLocaleString();
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    paddingBottom: 24
  },
  successBanner: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    flexDirection: 'row',
    gap: 14
  },
  section: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10
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
    alignItems: 'flex-start',
    gap: 10
  },
  resultTechnical: {
    gap: 4,
    paddingBottom: 8
  },
  technicalDetails: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    gap: 4
  },
  smallAccordionTitle: {
    fontSize: 13
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10
  },
  footerButton: {
    flex: 1
  }
});
