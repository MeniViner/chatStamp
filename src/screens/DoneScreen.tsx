import React from 'react';
import { BackHandler, FlatList, StyleSheet, View } from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FolderFallbackSheet } from '../components/FolderFallbackSheet';
import { ShareOutputSheet } from '../components/ShareOutputSheet';
import { ExpandableTechnicalDetails, FilePathText, MediaThumbnail, PrimaryButton, SecondaryButton, textStyles } from '../components/AppUi';
import { usePipelineStore } from '../store/pipelineStore';
import { useSettingsStore } from '../store/settingsStore';
import { chooseZip, discardImport, startSaving } from '../services/operationCoordinator';
import { openFolderBestEffort, openGalleryBestEffort, openSavedFileBestEffort, shouldShowOpenGallery } from '../native/androidIntents';
import { useAppTheme } from '../theme/useAppTheme';
import { FooterActions, WizardScreen } from './WizardScreen';
import type { SaveFileResult } from '../types/media';
import { completionPresentation, getResultRowKey, getResultStatusKey, isMessageDateVerified } from './resultsLogic';
import { errorMessageKey, pipelineErrorCode } from '../lib/pipelineErrors';
import { formatAppDate } from '../lib/localeDateFormat';
import { spacing } from '../theme/designTokens';
import { getSelectedSaveCandidates } from '../store/selectionLogic';

export function DoneScreen() {
  const { t } = useTranslation();
  const completion = usePipelineStore((state) => state.completion);
  const developerMode = useSettingsStore((state) => state.settings.developerMode);
  const customFolder = useSettingsStore((state) => state.settings.customFolder);
  const mediaFiles = usePipelineStore((state) => state.mediaFiles);
  const selectedSenders = usePipelineStore((state) => state.selectedSenders);
  const selectedMediaTypes = usePipelineStore((state) => state.selectedMediaTypes);
  const selectedFileIds = usePipelineStore((state) => state.selectedFileIds);
  const [details, setDetails] = React.useState(false), [restartOpen, setRestartOpen] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false), [folderOpen, setFolderOpen] = React.useState(false);
  const [message, setMessage] = React.useState<string>();
  const results = React.useMemo(() => completion?.results ?? [], [completion?.results]);
  const facts = React.useMemo(() => completionPresentation(completion), [completion]);
  const issues = React.useMemo(() => results.filter((row) => !row.ok || row.galleryMaySortByImportTime || row.dateVerification === 'unverified'), [results]);
  const firstSaved = results.find((row) => row.ok);
  const gallery = shouldShowOpenGallery(results);
  const remainingIds = React.useMemo(() => [...new Set(results.filter((row) => !row.ok && row.entryId).map((row) => row.entryId!))], [results]);
  const canRetry = remainingIds.length > 0 && getSelectedSaveCandidates(mediaFiles, selectedSenders, selectedMediaTypes,
    remainingIds.filter((id) => selectedFileIds.has(id))).length === remainingIds.length;
  const hasRemaining = Boolean((facts.cancelledCount || facts.failedCount) && completion && !completion.cacheCleared);
  const folder = completion?.outputDirectory ?? firstSaved?.outputPath?.replace(/[\\/][^\\/]+$/, '') ?? '';
  const back = React.useCallback(() => {
    if (details) setDetails(false); else setRestartOpen(true);
    return true;
  }, [details]);
  React.useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', back);
    return () => listener.remove();
  }, [back]);
  async function openSaved() {
    const outcome = gallery ? await openGalleryBestEffort(folder, results) : await openSavedFileBestEffort(firstSaved);
    if (outcome === 'manual-fallback') setMessage(t('results.openGalleryFallback'));
  }
  async function openFolder() {
    if (await openFolderBestEffort(folder, completion?.saveMethod === 'saf-custom-folder' ? customFolder : null, completion?.outputDirectory) === 'manual-fallback') setFolderOpen(true);
  }
  async function retry() {
    usePipelineStore.getState().prepareSave(remainingIds);
    await startSaving();
  }
  const header = <View style={styles.header}>
    <Text variant="bodyLarge" style={textStyles.start}>{t(facts.summaryKey, facts.summaryValues)}</Text>
    {folder ? <Text variant="bodySmall" style={textStyles.start}>{t('results.outputFolder')}: {folder.replace(/\\/g, '/').split('/').filter(Boolean).pop()}</Text> : null}
    <View style={styles.actions}>
      <SecondaryButton onPress={() => setDetails((value) => !value)}>{t(details ? 'results.hideDetails' : 'results.details')}</SecondaryButton>
      {firstSaved ? <SecondaryButton icon="share-variant-outline" onPress={() => setShareOpen(true)}>{t('results.shareOutputFiles')}</SecondaryButton> : null}
      {firstSaved && folder ? <SecondaryButton icon="folder-open-outline" onPress={() => { void openFolder(); }}>{t('results.openFolder')}</SecondaryButton> : null}
      {hasRemaining ? <SecondaryButton onPress={() => { if (canRetry) void retry(); else void chooseZip(); }}>
        {t(canRetry ? facts.cancelledCount > 0 ? 'results.retryRemainingFiles' : 'results.retryFailedFiles' : 'results.reimportRemainingFiles')}
      </SecondaryButton> : null}
    </View>
    {hasRemaining && !canRetry ? <Text style={textStyles.start}>{t('results.reimportRequired')}</Text> : null}
    {!details && issues.length ? <Text variant="titleMedium" style={styles.sectionTitle}>{t('results.issues')}</Text> : null}
  </View>;
  return <WizardScreen stage="results" title={t(facts.titleKey)} onBack={back}
    footer={<FooterActions>{firstSaved ? <PrimaryButton icon={gallery ? 'image-multiple-outline' : 'file-outline'} onPress={() => { void openSaved(); }}>
      {t(gallery ? 'results.openGallery' : 'results.openFirstSavedItem')}
    </PrimaryButton> : <PrimaryButton onPress={() => setRestartOpen(true)}>{t('results.startOver')}</PrimaryButton>}</FooterActions>}>
    <ResultDetailsList results={details ? results : issues} developerMode={developerMode} header={header} />
    <ConfirmDialog visible={restartOpen} title={t('results.startOverTitle')} body={t('results.startOverBody')}
      confirmLabel={t('results.startOver')} cancelLabel={t('common.cancel')}
      onDismiss={() => setRestartOpen(false)} onConfirm={() => { void discardImport().catch(() => setMessage(t('results.cleanupFailed'))); }} />
    <FolderFallbackSheet visible={folderOpen} title={t('results.openFolder')} subtitle={t('results.openFolderFallbackTitle')}
      helperText={t('results.openFolderFallback')} outputFolder={folder} canOpenFirstSavedItem={Boolean(firstSaved)}
      onDismiss={() => setFolderOpen(false)} onOpenFirstSavedItem={() => { void openSaved(); }}
      onRetryOpenFolder={async () => { setFolderOpen(false); await openFolder(); }} onCopied={setMessage} />
    <ShareOutputSheet visible={shareOpen} results={results} onDismiss={() => setShareOpen(false)} onError={setMessage} />
    <Snackbar visible={Boolean(message)} onDismiss={() => setMessage(undefined)}>{message}</Snackbar>
  </WizardScreen>;
}

export function ResultDetailsList({ results, developerMode = false, header }: {
  results: readonly SaveFileResult[]; developerMode?: boolean; header?: React.ReactElement;
}) {
  return <FlatList data={results} keyExtractor={getResultRowKey} ListHeaderComponent={header}
    initialNumToRender={8} maxToRenderPerBatch={8} windowSize={5} removeClippedSubviews={false}
    contentContainerStyle={styles.list} renderItem={({ item }) => <ResultRow result={item} developerMode={developerMode} />} />;
}

export const ResultRow = React.memo(function ResultRow({ result, developerMode = false }: { result: SaveFileResult; developerMode?: boolean }) {
  const { t, i18n } = useTranslation();
  const theme = useAppTheme();
  const uri = result.insertedUri ?? result.scannedUri;
  const verified = isMessageDateVerified(result);
  const approximate = result.dateAmbiguous || result.timestampSource === 'filename' || result.timestampSource === 'zip-entry';
  const date = formatAppDate(result.targetTimestampMillis ?? result.whatsAppDateIso ?? result.originalTimestampMillis, i18n.resolvedLanguage ?? 'en');
  return <View style={[styles.row, { borderBottomColor: theme.colors.outlineVariant }]}>
    <View style={styles.rowHeader}>
      <MediaThumbnail mediaType={result.mediaType} uri={uri} size={48} />
      <Text variant="titleSmall" style={[styles.flex, textStyles.start]}>{result.displayName ?? result.filename}</Text>
    </View>
    <Text style={[textStyles.start, { color: result.ok ? theme.colors.onSurface : theme.colors.error }]}>{t(getResultStatusKey(result))}</Text>
    {!result.ok && result.outcome !== 'cancelled' ? <Text style={textStyles.start}>{t(errorMessageKey(pipelineErrorCode({ code: result.failureCode })))}</Text> : null}
    <Text variant="bodySmall" style={textStyles.start}>{t(result.outcome === 'skipped' ? 'results.fileAlreadySaved' : result.ok ? 'results.fileSaved' : result.outcome === 'cancelled' ? 'results.fileCancelled' : 'results.fileNotSaved')} · {t(verified ? 'results.dateVerified' : 'results.dateNotVerified')}</Text>
    <Text variant="bodySmall" style={textStyles.start}>{date ? approximate ? t('fileSelection.approximateDate', { date }) : date : t('fileSelection.noDate')}</Text>
    {result.replacementWarning ? <Text>{t('results.previousFileKept')}</Text> : null}
    <ExpandableTechnicalDetails collapsedTitle={t('common.showTechnicalDetails')} expandedTitle={t('common.hideTechnicalDetails')}>
      <FilePathText value={result.outputPath ?? result.insertedUri ?? t('common.none')} maxLines={4} />
      {developerMode && result.failureReason ? <Text>{result.failureReason}</Text> : null}
    </ExpandableTechnicalDetails>
  </View>;
});

const styles = StyleSheet.create({ header: { gap: 16, paddingVertical: 16 }, actions: { gap: 8 }, sectionTitle: { fontWeight: '600' },
  list: { paddingBottom: spacing.section }, row: { paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 }, flex: { flex: 1, minWidth: 0 } });
