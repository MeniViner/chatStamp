import React from 'react';
import { BackHandler, FlatList, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Snackbar, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FolderFallbackSheet } from '../components/FolderFallbackSheet';
import { ShareOutputSheet } from '../components/ShareOutputSheet';
import { ExpandableTechnicalDetails, FilePathText, InfoBanner, ListGroup, ListItem, MediaThumbnail, NavigationItem, PrimaryButton, SectionHeader, StatusBadge, surfaceRoles, textStyles } from '../components/AppUi';
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
import { radius, spacing } from '../theme/designTokens';
import { getSelectedSaveCandidates } from '../store/selectionLogic';

export function DoneScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
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
  // The check mark means every file saved with a verified date; any date issue keeps the neutral style.
  const success = facts.failedCount === 0 && facts.cancelledCount === 0 && Boolean(firstSaved) && issues.length === 0;
  const header = <View style={styles.header}>
    <InfoBanner icon={success ? 'check-circle-outline' : 'alert-circle-outline'} tone={success ? 'primary' : 'neutral'}
      body={t(facts.summaryKey, facts.summaryValues)}>
      {folder ? <Text variant="bodySmall" style={[textStyles.start, { color: success ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant }]}>
        {t('results.outputFolder')}: {folder.replace(/\\/g, '/').split('/').filter(Boolean).pop()}</Text> : null}
    </InfoBanner>
    <ListGroup>
      {firstSaved ? <NavigationItem icon="share-variant-outline" title={t('results.shareOutputFiles')} onPress={() => setShareOpen(true)} /> : null}
      {firstSaved && folder ? <NavigationItem icon="folder-open-outline" title={t('results.openFolder')} onPress={() => { void openFolder(); }} /> : null}
      {hasRemaining ? <NavigationItem icon="refresh" onPress={() => { if (canRetry) void retry(); else void chooseZip(); }}
        title={t(canRetry ? facts.cancelledCount > 0 ? 'results.retryRemainingFiles' : 'results.retryFailedFiles' : 'results.reimportRemainingFiles')}
        description={!canRetry ? t('results.reimportRequired') : undefined} /> : null}
      <ListItem icon="format-list-bulleted" title={t(details ? 'results.hideDetails' : 'results.details')} onPress={() => setDetails((value) => !value)}
        trailing={<MaterialCommunityIcons name={details ? 'chevron-up' : 'chevron-down'} size={24} color={theme.colors.onSurfaceVariant} />} />
    </ListGroup>
    {!details && issues.length ? <SectionHeader icon="alert-outline" label={t('results.issues')} /> : null}
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
    contentContainerStyle={styles.list} ItemSeparatorComponent={RowGap}
    renderItem={({ item, index }) => <ResultRow result={item} developerMode={developerMode} first={index === 0} last={index === results.length - 1} />} />;
}

function RowGap() {
  return <View style={styles.rowGap} />;
}

export const ResultRow = React.memo(function ResultRow({ result, developerMode = false, first = true, last = true }: {
  result: SaveFileResult; developerMode?: boolean; first?: boolean; last?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const theme = useAppTheme();
  const uri = result.insertedUri ?? result.scannedUri;
  const verified = isMessageDateVerified(result);
  const approximate = result.dateAmbiguous || result.timestampSource === 'filename' || result.timestampSource === 'zip-entry';
  const date = formatAppDate(result.targetTimestampMillis ?? result.whatsAppDateIso ?? result.originalTimestampMillis, i18n.resolvedLanguage ?? 'en');
  const outer = radius.card, inner = radius.segment;
  return <View style={[styles.row, {
    backgroundColor: surfaceRoles(theme).group,
    borderTopLeftRadius: first ? outer : inner, borderTopRightRadius: first ? outer : inner,
    borderBottomLeftRadius: last ? outer : inner, borderBottomRightRadius: last ? outer : inner
  }]}>
    <View style={styles.rowHeader}>
      <MediaThumbnail mediaType={result.mediaType} uri={uri} size={48} />
      <View style={styles.flex}>
        <Text variant="titleSmall" numberOfLines={2} style={textStyles.start}>{result.displayName ?? result.filename}</Text>
        <Text variant="bodySmall" style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
          {date ? approximate ? t('fileSelection.approximateDate', { date }) : date : t('fileSelection.noDate')}
        </Text>
      </View>
    </View>
    <View style={styles.badges}>
      <StatusBadge label={t(getResultStatusKey(result))} selected={result.ok} danger={!result.ok && result.outcome !== 'cancelled'} />
      <StatusBadge label={t(verified ? 'results.dateVerified' : 'results.dateNotVerified')} selected={verified} />
    </View>
    {!result.ok && result.outcome !== 'cancelled' ? <Text style={[textStyles.start, { color: theme.colors.error }]}>{t(errorMessageKey(pipelineErrorCode({ code: result.failureCode })))}</Text> : null}
    <Text variant="bodySmall" style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>{t(result.outcome === 'skipped' ? 'results.fileAlreadySaved' : result.ok ? 'results.fileSaved' : result.outcome === 'cancelled' ? 'results.fileCancelled' : 'results.fileNotSaved')}</Text>
    {result.replacementWarning ? <Text style={textStyles.start}>{t('results.previousFileKept')}</Text> : null}
    <ExpandableTechnicalDetails collapsedTitle={t('common.showTechnicalDetails')} expandedTitle={t('common.hideTechnicalDetails')}>
      <FilePathText value={result.outputPath ?? result.insertedUri ?? t('common.none')} maxLines={4} />
      {developerMode && result.failureReason ? <Text>{result.failureReason}</Text> : null}
    </ExpandableTechnicalDetails>
  </View>;
});

const styles = StyleSheet.create({ header: { gap: spacing.card, paddingBottom: spacing.gap },
  list: { paddingBottom: spacing.section }, rowGap: { height: spacing.segmentGap },
  row: { paddingHorizontal: spacing.compactInner, paddingTop: spacing.compactInner, paddingBottom: spacing.tinyGap, gap: spacing.smallGap },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 }, badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  flex: { flex: 1, minWidth: 0, gap: 2 } });
