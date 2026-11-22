import React from 'react';
import { BackHandler, FlatList, Keyboard, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Button, Chip, IconButton, Searchbar, Text, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { usePipelineStore } from '../store/pipelineStore';
import { useAppTheme } from '../theme/useAppTheme';
import { getMediaDateIso, getMediaSaveTime, getMediaSender, isApproximateDate, UNKNOWN_SENDER, CHAT_TRANSCRIPT_SENDER } from '../lib/mediaMetadata';
import { outputChatName } from '../lib/outputOrganization';
import { isSaveableMediaType } from '../lib/mediaUi';
import { dayKeyAt, selectionState, selectionTotals, selectedIdsInOrder, setIdsSelected } from '../store/fileSelectionState';
import { MediaSelectionList, SelectionFooter, type MediaCellItem } from '../components/MediaSelectionList';
import { MediaViewer, useSharedMediaAudio, useViewerVideoController } from '../components/MediaViewer';
import { useMediaThumbnails } from '../components/useMediaThumbnails';
import { PremiumBottomSheet } from '../components/BottomSheet';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { captureSaveIntent, discardImport, startSaving } from '../services/operationCoordinator';
import { PrimaryButton } from '../components/AppUi';
import { WizardScreen } from './WizardScreen';

type Tab = 'all' | 'photos' | 'videos' | 'voice' | 'documents';
const tabs: readonly Tab[] = ['all', 'photos', 'videos', 'voice', 'documents'];
const inTab = (item: MediaCellItem, tab: Tab) => tab === 'all' || (tab === 'photos' ? ['photo', 'gif', 'sticker'].includes(item.mediaType)
  : tab === 'videos' ? item.mediaType === 'video' : tab === 'voice' ? ['audio', 'voice'].includes(item.mediaType) : item.mediaType === 'document');

export function FileSelectionScreen() {
  const { t, i18n } = useTranslation();
  const theme = useAppTheme(), dimensions = useWindowDimensions();
  const mediaFiles = usePipelineStore((state) => state.mediaFiles), selectedIds = usePipelineStore((state) => state.selectedFileIds);
  const active = usePipelineStore((state) => state.stage === 'selectFiles');
  const openOverlay = usePipelineStore((state) => state.openOverlayStage);
  const zipName = usePipelineStore((state) => state.zipName), importSummary = usePipelineStore((state) => state.importSummary);
  const toggle = usePipelineStore((state) => state.toggleFile), setSelection = usePipelineStore((state) => state.setSelectedFiles);
  const [query, setQuery] = React.useState(''), [tab, setTab] = React.useState<Tab>('all');
  const [search, setSearch] = React.useState(false), [filters, setFilters] = React.useState(false), [discard, setDiscard] = React.useState(false);
  const [summaryOpen, setSummaryOpen] = React.useState(false);
  const [senders, setSenders] = React.useState<ReadonlySet<string> | null>(null);
  const [from, setFrom] = React.useState(''), [to, setTo] = React.useState(''), [newest, setNewest] = React.useState(true);
  const [currentId, setCurrentId] = React.useState<string | null>(null), [listWidth, setListWidth] = React.useState(dimensions.width - 48);
  const saveReserved = React.useRef(false);
  const saveGeneration = React.useRef(0), alive = React.useRef(true);
  const [startingSave, setStartingSave] = React.useState(false);
  const cancelPendingSave = React.useCallback(() => { saveGeneration.current++; saveReserved.current = false; setStartingSave(false); }, []);
  React.useEffect(() => {
    const generation = saveGeneration;
    alive.current = true;
    return () => { alive.current = false; generation.current++; };
  }, []);
  const video = useViewerVideoController(), audio = useSharedMediaAudio();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const allItems = React.useMemo<readonly MediaCellItem[]>(() => mediaFiles.filter((file) => isSaveableMediaType(file.mediaType)).map((file) => {
    const rawSender = getMediaSender(file), millis = getMediaSaveTime(file), date = getMediaDateIso(file);
    return { id: file.id, filename: file.filename, uri: file.uri, mediaType: file.mediaType, sourceKind: file.sourceKind, sizeBytes: file.sizeBytes, dateMillis: millis,
      sender: rawSender === UNKNOWN_SENDER ? t('fileSelection.unknownSender') : rawSender === CHAT_TRANSCRIPT_SENDER ? t('picker.transcript') : rawSender,
      dateLabel: date && Number.isFinite(Date.parse(date)) ? new Intl.DateTimeFormat(i18n.resolvedLanguage ?? 'en', { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(new Date(date)) : t('picker.date.missing'),
      dateBadge: millis === undefined ? 'missing' : isApproximateDate(file) ? 'approximate' : 'known', dayKey: dayKeyAt(millis, timeZone) };
  }), [mediaFiles, i18n.resolvedLanguage, t, timeZone]);
  const senderOptions = React.useMemo(() => [...new Set(allItems.map((item) => item.sender))], [allItems]);
  const validDate = (value: string) => value === '' || (/^\d{4}-\d{2}-\d{2}$/.test(value) && dayKeyAt(Date.parse(`${value}T12:00:00Z`), 'UTC') === value);
  const datesValid = validDate(from) && validDate(to) && (!from || !to || from <= to);
  const baseItems = React.useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return allItems.filter((item) => (!senders || senders.has(item.sender))
      && (!normalized || `${item.filename} ${item.sender}`.toLocaleLowerCase().includes(normalized))
      && (!from || !datesValid || (item.dayKey !== null && item.dayKey >= from))
      && (!to || !datesValid || (item.dayKey !== null && item.dayKey <= to)))
      .sort((a, b) => {
        const aTranscript = a.sourceKind === 'chat-transcript', bTranscript = b.sourceKind === 'chat-transcript';
        if (aTranscript !== bTranscript) return aTranscript ? -1 : 1;
        if (a.dateMillis === undefined) return b.dateMillis === undefined ? 0 : 1;
        if (b.dateMillis === undefined) return -1;
        return (newest ? -1 : 1) * (a.dateMillis - b.dateMillis);
      });
  }, [allItems, datesValid, from, newest, query, senders, to]);
  const visibleItems = React.useMemo(() => baseItems.filter((item) => inTab(item, tab)), [baseItems, tab]);
  const visibleIds = React.useMemo(() => visibleItems.map((item) => item.id), [visibleItems]);
  const { thumbnails, onViewableIds, onThumbnailError } = useMediaThumbnails(visibleItems);
  const totals = selectionTotals(visibleItems, selectedIds), allState = selectionState(selectedIds, visibleIds);
  const current = React.useRef({ visibleItems, audio, selectedIds, visibleIds }); current.current = { visibleItems, audio, selectedIds, visibleIds };
  const pageGeneration = React.useRef(0);
  const page = React.useCallback((id: string) => {
    const p = current.current, item = p.visibleItems.find((entry) => entry.id === id); if (!item) return;
    const request = ++pageGeneration.current;
    p.audio.stop(); video.request(null); setCurrentId(id);
    if (item.mediaType === 'video') void p.audio.release().then(() => {
      if (request === pageGeneration.current) video.request({ fileId: item.id, uri: item.uri });
    }, () => { if (request === pageGeneration.current) video.failClosed(); });
  }, [video]);
  const dismissViewer = React.useCallback(() => { pageGeneration.current++; current.current.audio.stop(); video.request(null); setCurrentId(null); }, [video]);
  React.useEffect(() => {
    if (!active) { cancelPendingSave(); dismissViewer(); void current.current.audio.release().catch(() => undefined); }
  }, [active, cancelPendingSave, dismissViewer]);
  const playAudio = React.useCallback((id: string) => {
    const p = current.current, item = p.visibleItems.find((entry) => entry.id === id); if (item) { video.request(null); p.audio.play(item); }
  }, [video]);
  const toggleAll = React.useCallback(() => {
    const p = current.current; setSelection(setIdsSelected(p.selectedIds, p.visibleIds, selectionState(p.selectedIds, p.visibleIds) !== 'all'));
  }, [setSelection]);
  const save = React.useCallback(() => {
    if (saveReserved.current) return;
    const p = current.current;
    const ids = [...selectedIdsInOrder(p.visibleIds, p.selectedIds)];
    const intent = captureSaveIntent();
    if (!ids.length || !intent) return;
    const request = ++saveGeneration.current;
    saveReserved.current = true; setStartingSave(true);
    usePipelineStore.getState().prepareSave(ids);
    p.audio.stop();
    video.request(null);
    void p.audio.release().then(() => {
      if (alive.current && request === saveGeneration.current) return startSaving(intent);
      return undefined;
    }).catch((error: unknown) => {
      if (alive.current && request === saveGeneration.current) usePipelineStore.getState().setError(error);
    }).finally(() => { if (alive.current && request === saveGeneration.current) cancelPendingSave(); });
  }, [cancelPendingSave, video]);
  React.useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (currentId) dismissViewer(); else if (filters) setFilters(false); else if (search) setSearch(false); else { cancelPendingSave(); setDiscard(true); }
      return true;
    }); return () => sub.remove();
  }, [cancelPendingSave, currentId, dismissViewer, filters, search]);
  React.useEffect(() => { if (currentId && !visibleIds.includes(currentId)) dismissViewer(); }, [currentId, dismissViewer, visibleIds]);
  return <WizardScreen stage="selectFiles" titleMode="compact" title={zipName ? outputChatName(zipName) : t('outputFolders.importedChat')} onBack={() => { cancelPendingSave(); setDiscard(true); }}
    actions={<><IconButton icon="magnify" accessibilityLabel={t('picker.search')} onPress={() => setSearch((value) => !value)} /><IconButton icon="filter-variant" accessibilityLabel={t('picker.filters')} onPress={() => setFilters(true)} /><IconButton icon="cog-outline" accessibilityLabel={t('settings.title')} onPress={() => { cancelPendingSave(); Keyboard.dismiss(); openOverlay('settings'); }} /></>}
    footer={<SelectionFooter {...totals} saving={startingSave} state={allState} onToggleAll={toggleAll} onSave={save} />}>
    {search ? <Searchbar value={query} onChangeText={setQuery} placeholder={t('picker.search')} accessibilityLabel={t('picker.search')} autoFocus
      style={[styles.search, { backgroundColor: theme.colors.surfaceContainerHigh ?? theme.colors.surfaceVariant }]} /> : null}
    <ScrollView horizontal style={styles.tabs} contentContainerStyle={styles.tabContent} showsHorizontalScrollIndicator={false}>
      {tabs.map((kind) => { const count = baseItems.filter((item) => inTab(item, kind)).length;
        const selected = tab === kind;
        return count || kind === 'all' ? <Chip key={kind} selected={selected} mode="flat" accessibilityRole="tab"
          accessibilityState={{ selected }} accessibilityLabel={t('picker.tabCount', { tab: t(`picker.tabs.${kind}`), count })}
          showSelectedCheck={false} style={[styles.tab, { backgroundColor: selected ? theme.colors.secondaryContainer : theme.colors.surfaceContainer ?? theme.colors.surfaceVariant }]}
          selectedColor={selected ? theme.colors.onSecondaryContainer : theme.colors.onSurfaceVariant}
          textStyle={{ color: selected ? theme.colors.onSecondaryContainer : theme.colors.onSurfaceVariant, fontWeight: selected ? '700' : '500' }}
          onPress={() => setTab(kind)}>{t(`picker.tabs.${kind}`)} {count}</Chip> : null;
      })}
    </ScrollView>
    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{t('picker.rangeHint')}</Text>
    {Boolean(importSummary?.skippedZipEntries) ? <Button compact onPress={() => setSummaryOpen(true)}>{t('picker.skippedEntries', { count: importSummary?.skippedZipEntries })}</Button> : null}
    <View style={styles.list} onLayout={({ nativeEvent }) => setListWidth(nativeEvent.layout.width)}>
      <MediaSelectionList items={visibleItems} selectedIds={selectedIds} thumbnails={thumbnails} columns={dimensions.width >= 600 ? 5 : 3} width={listWidth}
        onOpen={page} onToggle={toggle} onSetSelection={setSelection} onViewableIds={onViewableIds} onThumbnailError={onThumbnailError}
        playingAudioId={audio.status.playing ? audio.activeId : undefined} onPlayAudio={playAudio} />
    </View>
    {audio.activeId && !currentId ? <View style={styles.inlineAudio}><Text>{t(audio.error ? 'viewer.audioError' : !audio.status.isLoaded ? 'viewer.loading' : 'viewer.audioProgress', { current: Math.floor(audio.status.currentTime), total: Math.floor(audio.status.duration) })}</Text><Button onPress={audio.stop}>{t('viewer.pause')}</Button></View> : null}
    <PremiumBottomSheet visible={filters} title={t('picker.filters')} onDismiss={() => setFilters(false)} footer={<PrimaryButton onPress={() => setFilters(false)} disabled={!datesValid}>{t('picker.apply')}</PrimaryButton>}>
      <Text variant="titleMedium">{t('picker.senders')}</Text>
      <View style={styles.senderChips}>{senderOptions.map((sender) => <Chip key={sender} selected={!senders || senders.has(sender)} onPress={() => setSenders((old) => {
        const next = new Set(old ?? senderOptions); if (next.has(sender)) next.delete(sender); else next.add(sender); return next;
      })}>{sender}</Chip>)}</View>
      <Text variant="titleMedium">{t('picker.dateRange')}</Text>
      <TextInput label={t('picker.from')} value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD" accessibilityLabel={t('picker.from')} error={!datesValid} />
      <TextInput label={t('picker.to')} value={to} onChangeText={setTo} placeholder="YYYY-MM-DD" accessibilityLabel={t('picker.to')} error={!datesValid} />
      {!datesValid ? <Text accessibilityRole="alert">{t('picker.invalidDate')}</Text> : null}
      <Text variant="titleMedium">{t('picker.sort')}</Text>
      <View style={styles.senderChips}><Chip selected={newest} onPress={() => setNewest(true)}>{t('picker.newest')}</Chip><Chip selected={!newest} onPress={() => setNewest(false)}>{t('picker.oldest')}</Chip></View>
      <Button onPress={() => { setSenders(null); setFrom(''); setTo(''); setNewest(true); setQuery(''); setTab('all'); }}>{t('picker.reset')}</Button>
    </PremiumBottomSheet>
    <PremiumBottomSheet visible={summaryOpen} title={t('picker.importSummary')} onDismiss={() => setSummaryOpen(false)} scrollable={false}>
      <Text>{t('picker.skippedSample', { shown: importSummary?.skippedEntries?.length ?? 0, total: importSummary?.skippedZipEntries ?? 0 })}</Text>
      <FlatList data={importSummary?.skippedEntries ?? []} keyExtractor={(entry, index) => `${index}:${entry.sourcePath}`}
        renderItem={({ item }) => <View style={styles.skipped}><Text>{item.sourcePath}</Text><Text>{t(`picker.skippedReasons.${item.reason}`)}</Text></View>} />
    </PremiumBottomSheet>
    <MediaViewer items={visibleItems} currentId={active ? currentId : null} selectedIds={selectedIds} onPage={page} onDismiss={dismissViewer} onToggle={toggle} video={video} audio={audio} />
    <ConfirmDialog visible={discard} title={t('session.discardTitle')} body={t('session.discardBody')} confirmLabel={t('session.discard')} cancelLabel={t('common.cancel')}
      onDismiss={() => setDiscard(false)} onConfirm={() => { audio.stop(); video.request(null); void discardImport(); }} />
  </WizardScreen>;
}
const styles = StyleSheet.create({
  tabs: { flexGrow: 0, marginVertical: 8 }, tabContent: { gap: 8 }, tab: { borderRadius: 999 }, search: { borderRadius: 999, marginBottom: 4 }, list: { flex: 1 }, senderChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  inlineAudio: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skipped: { minHeight: 64, paddingVertical: 8 },
});
