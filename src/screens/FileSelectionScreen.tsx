import React from 'react';
import { BackHandler, FlatList, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { VideoView, useVideoPlayer } from 'expo-video';
import { PremiumBottomSheet } from '../components/BottomSheet';
import { Button, Chip, ProgressBar, Searchbar, Surface, Switch, Text } from 'react-native-paper';
import { usePipelineStore } from '../store/pipelineStore';
import { useSettingsStore } from '../store/settingsStore';
import { getSelectedSaveCandidates } from '../store/selectionLogic';
import { filterVisibleFiles, getVisibleSaveableFileIds } from '../store/fileFiltering';
import type { ChatPreview, ChatPreviewMessage, ExtractedMediaFile, MediaType } from '../types/media';
import { visibleMediaTypes } from '../lib/mediaUi';
import { CHAT_TRANSCRIPT_SENDER, getMediaDateIso, getMediaSaveTime, getMediaSender, isApproximateDate, UNKNOWN_SENDER } from '../lib/mediaMetadata';
import { loadTranscriptPreview } from '../services/importService';
import { formatShortChatTimestamp } from '../lib/previewDateFormat';
import { useAppTheme } from '../theme/useAppTheme';
import { FooterActions, WizardScreen } from './WizardScreen';
import { runMp4RewriteDiagnosticsNative } from '../native/nativeMediaSaver';
import { useTranslation } from 'react-i18next';
import {
  defaultFileSelectionUiState,
  getFilteredSelectionCount,
  getVideoPreviewMode,
  getVoicePreviewProgress,
  shouldShowDeveloperDiagnostics,
  toggleCategoryFilter,
  type SortMode
} from './fileSelectionUi';
import {
  FilterChipGroup,
  FilteredSelectionCountBadge,
  getCachedVideoThumbnail,
  IconOnlyActionButton,
  MediaFileListItem,
  OptionCard,
  PrimaryButton,
  rememberVideoThumbnail,
  SecondaryButton,
  SectionHeader,
  textStyles
} from '../components/AppUi';
import { spacing } from '../theme/designTokens';

export function FileSelectionScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const [query, setQuery] = React.useState('');
  const [searchOpen, setSearchOpen] = React.useState(defaultFileSelectionUiState.searchOpen);
  const [filterSheetOpen, setFilterSheetOpen] = React.useState(defaultFileSelectionUiState.filterSheetOpen);
  const [sortSheetOpen, setSortSheetOpen] = React.useState(defaultFileSelectionUiState.sortSheetOpen);
  const [saveableOnly, setSaveableOnly] = React.useState(defaultFileSelectionUiState.saveableOnly);
  const [sortMode, setSortMode] = React.useState<SortMode>(defaultFileSelectionUiState.sortMode);
  const [categoryFilters, setCategoryFilters] = React.useState<MediaType[]>(defaultFileSelectionUiState.categoryFilters);
  const [previewFile, setPreviewFile] = React.useState<ExtractedMediaFile | undefined>();
  const [mp4Diagnostic, setMp4Diagnostic] = React.useState<string | undefined>();
  const developerMode = useSettingsStore((state) => state.settings.developerMode);
  const mediaFiles = usePipelineStore((state) => state.mediaFiles);
  const importSummary = usePipelineStore((state) => state.importSummary);
  const selectedSenders = usePipelineStore((state) => state.selectedSenders);
  const selectedMediaTypes = usePipelineStore((state) => state.selectedMediaTypes);
  const selectedFileIds = usePipelineStore((state) => state.selectedFileIds);
  const toggleSender = usePipelineStore((state) => state.toggleSender);
  const toggleMediaType = usePipelineStore((state) => state.toggleMediaType);
  const toggleFile = usePipelineStore((state) => state.toggleFile);
  const selectFiles = usePipelineStore((state) => state.selectFiles);
  const clearFiles = usePipelineStore((state) => state.clearFiles);
  const setStage = usePipelineStore((state) => state.setStage);

  React.useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setStage('welcome');
      return true;
    });
    return () => subscription.remove();
  }, [setStage]);

  const senders = React.useMemo(
    () => Array.from(new Set(mediaFiles.map(getMediaSender))),
    [mediaFiles]
  );

  const visibleFiles = React.useMemo(() => {
    const filtered = filterVisibleFiles({
      files: mediaFiles,
      selectedSenders,
      selectedMediaTypes,
      query,
      categoryFilters,
      saveableOnly
    });
    return [...filtered].sort(createSortComparator(sortMode));
  }, [categoryFilters, mediaFiles, query, saveableOnly, selectedMediaTypes, selectedSenders, sortMode]);

  const visibleSaveableFileIds = React.useMemo(() => getVisibleSaveableFileIds(visibleFiles), [visibleFiles]);
  const visibleSelectionCount = React.useMemo(
    () => getFilteredSelectionCount(visibleSaveableFileIds, selectedFileIds),
    [selectedFileIds, visibleSaveableFileIds]
  );
  const selectedFiles = React.useMemo(
    () => getSelectedSaveCandidates(mediaFiles, selectedSenders, selectedMediaTypes, selectedFileIds).map(({ file }) => file),
    [mediaFiles, selectedSenders, selectedMediaTypes, selectedFileIds]
  );
  const selectedCount = selectedFiles.length;
  const selectedPhotos = selectedFiles.filter((file) => file.mediaType === 'photo').length;
  const selectedVideos = selectedFiles.filter((file) => file.mediaType === 'video').length;
  const selectedIdSet = new Set(selectedFileIds);
  const selectedSenderSet = new Set(selectedSenders);
  const hasSelectedUndatedFiles = mediaFiles.some((file) =>
    selectedIdSet.has(file.id) && selectedSenderSet.has(getMediaSender(file)) && getMediaSaveTime(file) === undefined
  );
  const otherFoundCount =
    mediaFiles.length - (importSummary?.photos ?? 0) - (importSummary?.videos ?? 0);
  const filtersActive = selectedSenders.length < senders.length || categoryFilters.length > 0 || !saveableOnly;
  const selectedMp4 = mediaFiles.find(
    (file) => selectedFileIds.includes(file.id) && file.mediaType === 'video' && file.filename.toLowerCase().endsWith('.mp4')
  );

  async function runMp4Diagnostics() {
    if (!selectedMp4) return;
    const timestamp = getMediaSaveTime(selectedMp4);
    if (timestamp === undefined) return;
    setMp4Diagnostic(t('fileSelection.runningDiagnostics'));
    try {
      const result = await runMp4RewriteDiagnosticsNative(
        selectedMp4.uri,
        timestamp
      );
      setMp4Diagnostic(JSON.stringify(result, null, 2));
    } catch (error) {
      setMp4Diagnostic(error instanceof Error ? error.message : t('fileSelection.diagnosticsFailed'));
    }
  }

  function ensureMediaTypesEnabled(files: ExtractedMediaFile[]) {
    const typesToEnable = new Set(
      files.map((file) => file.mediaType).filter((mediaType) => !selectedMediaTypes[mediaType])
    );
    typesToEnable.forEach((mediaType) => toggleMediaType(mediaType));
  }

  function toggleVisibleFile(file: ExtractedMediaFile) {
    if (!selectedFileIds.includes(file.id)) ensureMediaTypesEnabled([file]);
    toggleFile(file.id);
  }

  function selectVisibleFiles() {
    ensureMediaTypesEnabled(visibleFiles);
    selectFiles(visibleSaveableFileIds);
  }

  function clearVisibleSelections() {
    clearFiles(visibleSaveableFileIds);
  }

  function resetFilters() {
    senders.forEach((sender) => {
      if (!selectedSenders.includes(sender)) toggleSender(sender);
    });
    setCategoryFilters([]);
    setSaveableOnly(true);
  }

  return (
    <WizardScreen
      stage="selectFiles"
      title={t('fileSelection.title')}
      onBack={() => setStage('welcome')}
      footer={
        filterSheetOpen || sortSheetOpen || previewFile ? undefined :
        <FooterActions>
          {hasSelectedUndatedFiles ? (
            <Text variant="bodySmall" style={textStyles.start}>{t('fileSelection.undatedSkipped')}</Text>
          ) : null}
          {selectedCount === 0 ? (
            <Text variant="bodySmall" numberOfLines={2} style={[textStyles.start, { color: theme.colors.error }]}>
              {t('fileSelection.disabledNoSelection')}
            </Text>
          ) : null}
          <Text variant="labelLarge" numberOfLines={2} style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
            {t('fileSelection.footerSelected', {
              selected: selectedCount,
              photos: selectedPhotos,
              videos: selectedVideos,
              other: selectedCount - selectedPhotos - selectedVideos
            })}
          </Text>
          <PrimaryButton disabled={selectedCount === 0} onPress={() => setStage('outputOptions')}>
            {t('fileSelection.continue')}
          </PrimaryButton>
        </FooterActions>
      }
    >
      <View style={styles.toolbarBlock}>
        {searchOpen ? (
          <View style={styles.searchToolbar}>
            <Searchbar
              placeholder={t('fileSelection.searchPlaceholder')}
              value={query}
              onChangeText={setQuery}
              style={styles.search}
              inputStyle={styles.searchInput}
              autoFocus
            />
            <IconOnlyActionButton
              icon="close"
              accessibilityLabel={t('fileSelection.closeSearch')}
              onPress={() => {
                setQuery('');
                setSearchOpen(false);
              }}
            />
          </View>
        ) : null}

        {!searchOpen ? (
          <View style={styles.toolbarRow}>
            <IconOnlyActionButton
              icon="filter-variant"
              selected={filtersActive}
              accessibilityLabel={filtersActive ? t('fileSelection.filtersActive') : t('fileSelection.filter')}
              onPress={() => setFilterSheetOpen(true)}
            />
            <IconOnlyActionButton
              icon="sort"
              accessibilityLabel={t('fileSelection.sort')}
              onPress={() => setSortSheetOpen(true)}
            />
            <IconOnlyActionButton
              icon="magnify"
              selected={query.trim().length > 0}
              accessibilityLabel={t('fileSelection.search')}
              onPress={() => setSearchOpen(true)}
            />
            <IconOnlyActionButton
              icon="select-all"
              accessibilityLabel={t('fileSelection.selectAll')}
              disabled={visibleSelectionCount.total === 0}
              onPress={selectVisibleFiles}
            />
            <IconOnlyActionButton
              icon="selection-remove"
              accessibilityLabel={t('fileSelection.clear')}
              disabled={visibleSelectionCount.selected === 0}
              onPress={clearVisibleSelections}
            />
            <FilteredSelectionCountBadge
              selected={visibleSelectionCount.selected}
              total={visibleSelectionCount.total}
              accessibilityLabel={t('fileSelection.filteredCountA11y', visibleSelectionCount)}
              style={styles.countBadge}
            />
          </View>
        ) : null}
      </View>

      <FlatList
        data={visibleFiles}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MediaFileListItem
            file={item}
            selected={selectedFileIds.includes(item.id)}
            onToggle={() => toggleVisibleFile(item)}
            onPreview={() => setPreviewFile(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
        initialNumToRender={12}
        maxToRenderPerBatch={14}
        windowSize={9}
        removeClippedSubviews
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="file-search-outline" size={42} color={theme.colors.outline} />
            <Text variant="titleMedium">{t('fileSelection.emptyStateTitle')}</Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('fileSelection.emptyStateBody')}
            </Text>
          </View>
        }
      />

      {shouldShowDeveloperDiagnostics(developerMode) ? (
        <Surface elevation={0} style={[styles.diagnosticPanel, { borderColor: theme.colors.outlineVariant }]}>
          <Button mode="outlined" compact disabled={!selectedMp4} onPress={() => void runMp4Diagnostics()}>
            {t('fileSelection.runDiagnostics')}
          </Button>
          {mp4Diagnostic ? <Text variant="bodySmall">{mp4Diagnostic}</Text> : null}
        </Surface>
      ) : null}

      <MediaPreviewSheet
        file={previewFile}
        selected={previewFile ? selectedFileIds.includes(previewFile.id) : false}
        onDismiss={() => setPreviewFile(undefined)}
        onToggle={() => {
          if (previewFile) toggleVisibleFile(previewFile);
        }}
      />
      <FilterSheet
        visible={filterSheetOpen}
        senders={senders}
        selectedSenders={selectedSenders}
        categoryFilters={categoryFilters}
        saveableOnly={saveableOnly}
        counts={{
          all: mediaFiles.length,
          photos: importSummary?.photos ?? mediaFiles.filter((file) => file.mediaType === 'photo').length,
          videos: importSummary?.videos ?? mediaFiles.filter((file) => file.mediaType === 'video').length,
          other: otherFoundCount
        }}
        totalShown={visibleFiles.length}
        onDismiss={() => setFilterSheetOpen(false)}
        onToggleSender={toggleSender}
        onSetCategoryFilters={setCategoryFilters}
        onReset={resetFilters}
        onApply={() => setFilterSheetOpen(false)}
        onSaveableOnly={setSaveableOnly}
      />
      <SortSheet visible={sortSheetOpen} sortMode={sortMode} onDismiss={() => setSortSheetOpen(false)} onSortMode={setSortMode} />
    </WizardScreen>
  );
}

function FilterSheet({
  visible,
  senders,
  selectedSenders,
  categoryFilters,
  saveableOnly,
  counts,
  totalShown,
  onDismiss,
  onToggleSender,
  onSetCategoryFilters,
  onReset,
  onApply,
  onSaveableOnly
}: {
  visible: boolean;
  senders: string[];
  selectedSenders: string[];
  categoryFilters: MediaType[];
  saveableOnly: boolean;
  counts: { all: number; photos: number; videos: number; other: number };
  totalShown: number;
  onDismiss: () => void;
  onToggleSender: (sender: string) => void;
  onSetCategoryFilters: React.Dispatch<React.SetStateAction<MediaType[]>>;
  onReset: () => void;
  onApply: () => void;
  onSaveableOnly: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const otherTypes: MediaType[] = visibleMediaTypes.filter((mediaType) => mediaType !== 'photo' && mediaType !== 'video');
  const otherSelected = otherTypes.some((mediaType) => categoryFilters.includes(mediaType));

  function toggleSingleType(mediaType: MediaType) {
    onSetCategoryFilters((current) => toggleCategoryFilter(current, mediaType));
  }

  function toggleOtherTypes() {
    onSetCategoryFilters((current) => {
      const currentSet = new Set(current);
      const allOtherSelected = otherTypes.every((mediaType) => currentSet.has(mediaType));
      if (allOtherSelected) return current.filter((mediaType) => !otherTypes.includes(mediaType));
      return Array.from(new Set([...current, ...otherTypes]));
    });
  }

  return (
    <PremiumBottomSheet
      visible={visible}
      title={t('fileSelection.filterTitle')}
      onDismiss={onDismiss}
      footer={
        <View style={styles.sheetFooter}>
          <Text variant="bodySmall" style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
            {t('fileSelection.willShow', { count: totalShown })}
          </Text>
          <View style={styles.sheetFooterActions}>
            <PrimaryButton style={styles.sheetPrimaryAction} onPress={onApply}>{t('fileSelection.applyFilter')}</PrimaryButton>
            <SecondaryButton style={styles.sheetSecondaryAction} onPress={onReset}>{t('fileSelection.resetFilter')}</SecondaryButton>
          </View>
        </View>
      }
    >
      <SectionHeader icon="file-multiple-outline" label={t('fileSelection.byFileType')} />
      <View style={styles.filterTypeGrid}>
        <FilterTypeOption
          icon="file-multiple-outline"
          label={t('fileSelection.all')}
          count={counts.all}
          selected={categoryFilters.length === 0}
          onPress={() => onSetCategoryFilters([])}
        />
        <FilterTypeOption
          icon="image-outline"
          label={t('fileSelection.photos')}
          count={counts.photos}
          selected={categoryFilters.includes('photo')}
          onPress={() => toggleSingleType('photo')}
        />
        <FilterTypeOption
          icon="video-outline"
          label={t('fileSelection.videos')}
          count={counts.videos}
          selected={categoryFilters.includes('video')}
          onPress={() => toggleSingleType('video')}
        />
        <FilterTypeOption
          icon="file-outline"
          label={t('fileSelection.other')}
          count={counts.other}
          selected={otherSelected}
          onPress={toggleOtherTypes}
        />
      </View>
      <SectionHeader icon="account-outline" label={t('fileSelection.bySender')} />
      <FilterChipGroup
        values={senders}
        selectedValues={selectedSenders}
        getLabel={(sender) => {
          if (sender === UNKNOWN_SENDER) return t('fileSelection.unknownSender');
          return sender === CHAT_TRANSCRIPT_SENDER ? t('fileSelection.chatTranscript') : sender;
        }}
        onToggle={onToggleSender}
      />
      <View style={styles.switchRow}>
        <View style={styles.flex}>
          <Text variant="titleSmall">{t('fileSelection.saveableOnly')}</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {t('fileSelection.saveableOnlyBody')}
          </Text>
        </View>
        <Switch value={saveableOnly} onValueChange={onSaveableOnly} />
      </View>
    </PremiumBottomSheet>
  );
}

function FilterTypeOption({
  icon,
  label,
  count,
  selected,
  onPress
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  count: number;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }}>
      <Surface
        elevation={0}
        style={[
          styles.filterTypeOption,
          {
            backgroundColor: selected ? theme.colors.primaryContainer : theme.colors.surfaceContainerHigh ?? theme.colors.surfaceVariant,
            borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant
          }
        ]}
      >
        <View style={[styles.filterTypeIcon, { backgroundColor: selected ? theme.colors.surface : theme.colors.secondaryContainer }]}>
          <MaterialCommunityIcons name={icon} size={20} color={theme.colors.primary} />
        </View>
        <View style={styles.flex}>
          <Text variant="labelLarge" numberOfLines={1} style={[textStyles.start, styles.filterTypeLabel]}>
            {label}
          </Text>
          <Text variant="labelSmall" numberOfLines={1} style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
            {count}
          </Text>
        </View>
        {selected ? <MaterialCommunityIcons name="check-circle" size={20} color={theme.colors.primary} /> : null}
      </Surface>
    </Pressable>
  );
}

function SortSheet({
  visible,
  sortMode,
  onDismiss,
  onSortMode
}: {
  visible: boolean;
  sortMode: SortMode;
  onDismiss: () => void;
  onSortMode: (value: SortMode) => void;
}) {
  const { t } = useTranslation();
  const options: SortMode[] = ['date-desc', 'date-asc', 'name', 'sender', 'type'];
  return (
    <PremiumBottomSheet
      visible={visible}
      title={t('fileSelection.sortTitle')}
      subtitle={t('fileSelection.sortSubtitle')}
      onDismiss={onDismiss}
      footer={<PrimaryButton onPress={onDismiss}>{t('common.ok')}</PrimaryButton>}
    >
      <View style={styles.selectableList}>
        {options.map((option) => (
          <OptionCard
            key={option}
            title={t(`fileSelection.sortModes.${option}`)}
            selected={sortMode === option}
            onPress={() => onSortMode(option)}
          />
        ))}
      </View>
    </PremiumBottomSheet>
  );
}

function MediaPreviewSheet({
  file,
  selected,
  onDismiss,
  onToggle
}: {
  file?: ExtractedMediaFile;
  selected: boolean;
  onDismiss: () => void;
  onToggle: () => void;
}) {
  const { t, i18n } = useTranslation();
  const theme = useAppTheme();
  const { height } = useWindowDimensions();
  const previewScrollMaxHeight = Math.max(220, Math.min(420, Math.round(height * 0.42)));

  if (!file) return null;
  const dateIso = getMediaDateIso(file);
  const date = dateIso && new Date(dateIso).toLocaleString(i18n.language, { timeZone: file.timeZone });
  const dateLabel = date && isApproximateDate(file) ? t('fileSelection.approximateDate', { date }) : date;

  return (
    <PremiumBottomSheet
      visible
      title={file.filename}
      subtitle={file.sourceKind === 'chat-transcript' ? t('fileSelection.chatTranscript') : file.matchedRecord?.sender ?? t('fileSelection.unknownSender')}
      onDismiss={onDismiss}
      scrollable={false}
    >
      <Surface elevation={0} style={[styles.previewPanel, { backgroundColor: theme.colors.surfaceContainerHigh ?? theme.colors.surfaceVariant }]}>
        {isTextTranscript(file) ? (
          <TextTranscriptPreview file={file} maxScrollHeight={previewScrollMaxHeight} />
        ) : file.mediaType === 'photo' || file.mediaType === 'sticker' || file.mediaType === 'gif' ? (
          <ExpoImage source={file.thumbnailUri ?? file.uri} contentFit="contain" style={styles.previewMedia} />
        ) : file.mediaType === 'video' ? (
          <VideoPreview uri={file.uri} />
        ) : file.mediaType === 'voice' || file.mediaType === 'audio' ? (
          <VoicePreview uri={file.uri} />
        ) : (
          <View style={styles.fallbackPreview}>
            <MaterialCommunityIcons name={getPreviewIcon(file.mediaType)} size={72} color={theme.colors.primary} />
          </View>
        )}
      </Surface>
      <Chip compact>{t(`media.singular.${file.mediaType}`)}</Chip>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        {dateLabel ?? t('fileSelection.noDate')}
      </Text>
      <Button mode={selected ? 'contained' : 'outlined'} onPress={onToggle}>
        {selected ? t('fileSelection.selected') : t('fileSelection.selectFile')}
      </Button>
    </PremiumBottomSheet>
  );
}

function TextTranscriptPreview({ file, maxScrollHeight }: { file: ExtractedMediaFile; maxScrollHeight: number }) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const [state, setState] = React.useState<
    | { status: 'loading' }
    | ({ status: 'ready' } & ChatPreview)
    | { status: 'error'; error: string }
  >(file.transcriptPreview ? { status: 'ready', ...file.transcriptPreview } : { status: 'loading' });

  React.useEffect(() => {
    let cancelled = false;
    if (file.transcriptPreview) {
      setState({ status: 'ready', ...file.transcriptPreview });
      return;
    }
    setState({ status: 'loading' });
    loadTranscriptPreview(file.uri)
      .then((preview) => {
        if (cancelled) return;
        setState({ status: 'ready', ...preview });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          status: 'error',
          error: error instanceof Error ? error.message : t('fileSelection.transcriptPreviewFailed')
        });
      });

    return () => {
      cancelled = true;
    };
  }, [t, file.transcriptPreview, file.uri]);

  if (state.status === 'loading') {
    return (
      <View style={styles.transcriptLoading}>
        <MaterialCommunityIcons name="file-document-outline" size={40} color={theme.colors.primary} />
        <Text variant="bodyMedium">{t('fileSelection.loadingTranscript')}</Text>
        <ProgressBar indeterminate style={styles.transcriptProgress} />
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={styles.fallbackPreview}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.colors.error} />
        <Text variant="bodyMedium" style={[textStyles.start, { color: theme.colors.error }]}>
          {state.error}
        </Text>
      </View>
    );
  }

  if (state.rawFallback !== undefined) {
    return (
      <View style={styles.transcriptPreview}>
        <View style={styles.transcriptHeader}>
          <MaterialCommunityIcons name="text-box-outline" size={24} color={theme.colors.primary} />
          <View style={styles.flex}>
            <Text variant="titleSmall" style={textStyles.start}>{t('fileSelection.rawTranscriptTitle')}</Text>
            <Text variant="bodySmall" style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
              {t('fileSelection.rawTranscriptBody')}
            </Text>
          </View>
        </View>
        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator
          style={[styles.transcriptScroll, { maxHeight: maxScrollHeight }]}
          contentContainerStyle={[styles.rawTranscriptCard, { backgroundColor: theme.colors.surface }]}
        >
          <Text variant="bodySmall" style={[styles.rawTranscriptText, { color: theme.colors.onSurface }]}>
            {state.rawFallback}
          </Text>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.transcriptPreview}>
      <View style={styles.transcriptHeader}>
        <MaterialCommunityIcons name="message-text-outline" size={24} color={theme.colors.primary} />
        <View style={styles.flex}>
          <Text variant="titleSmall" style={textStyles.start}>{t('fileSelection.transcriptPreviewTitle')}</Text>
          <Text variant="bodySmall" style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
            {state.truncated
              ? t('fileSelection.transcriptPreviewLimited', { shown: state.messages.length, total: state.totalMessages })
              : t('fileSelection.transcriptPreviewCount', { count: state.totalMessages })}
          </Text>
        </View>
      </View>
      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator
        style={[styles.transcriptScroll, { maxHeight: maxScrollHeight }]}
        contentContainerStyle={styles.transcriptThread}
      >
        {state.messages.map((message, index) => (
          <TranscriptBubble key={message.id} message={message} tone={index % 3} />
        ))}
      </ScrollView>
    </View>
  );
}

function TranscriptBubble({ message, tone }: { message: ChatPreviewMessage; tone: number }) {
  const theme = useAppTheme();
  const backgroundColor =
    tone === 0
      ? theme.colors.primaryContainer
      : tone === 1
        ? theme.colors.secondaryContainer
        : theme.colors.surface;
  const foregroundColor =
    tone === 0
      ? theme.colors.onPrimaryContainer
      : tone === 1
        ? theme.colors.onSecondaryContainer
        : theme.colors.onSurface;

  return (
    <Surface elevation={0} style={[styles.transcriptBubble, { backgroundColor, borderColor: theme.colors.outlineVariant }]}>
      <View style={styles.transcriptBubbleMeta}>
        <Text variant="labelLarge" numberOfLines={1} ellipsizeMode="tail" style={[styles.flex, textStyles.start, { color: foregroundColor }]}>
          {message.sender}
        </Text>
        <Text variant="labelSmall" style={{ color: foregroundColor }}>
          {formatShortChatTimestamp(message.messageDateIso)}
        </Text>
      </View>
      <Text variant="bodyMedium" style={[styles.transcriptMessageBody, textStyles.start, { color: foregroundColor }]}>
        {message.body}
      </Text>
    </Surface>
  );
}

function VoicePreview({ uri }: { uri: string }) {
  const { t } = useTranslation();
  const isMounted = React.useRef(true);
  const player = useAudioPlayer({ uri }, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);

  React.useEffect(() => {
    return () => {
      isMounted.current = false;
      try {
        player.pause();
      } catch {
        // Ignore errors during cleanup
      }
    };
  }, [player]);

  const progress = getVoicePreviewProgress(status.currentTime, status.duration);

  return (
    <View style={styles.voicePreview}>
      <Button mode="contained-tonal" icon={status.playing ? 'pause' : 'play'} onPress={() => (status.playing ? player.pause() : player.play())}>
        {status.playing ? t('fileSelection.pause') : t('fileSelection.play')}
      </Button>
      <Text variant="bodySmall">
        {formatSeconds(status.currentTime)} / {formatSeconds(status.duration)}
      </Text>
      <ProgressBar progress={Number.isFinite(progress) ? progress : 0} style={styles.voiceProgress} />
    </View>
  );
}

function VideoPreview({ uri }: { uri: string }) {
  const { t } = useTranslation();
  const isMounted = React.useRef(true);
  const [thumbnail, setThumbnail] = React.useState<unknown>(() => getCachedVideoThumbnail(uri));
  const [error, setError] = React.useState<string | undefined>();
  
  const player = useVideoPlayer({ uri }, (videoPlayer) => {
    videoPlayer.muted = false;
  });

  React.useEffect(() => {
    isMounted.current = true;
    setError(undefined);
    const cachedThumbnail = getCachedVideoThumbnail(uri);
    if (cachedThumbnail) {
      setThumbnail(cachedThumbnail);
    } else {
      setThumbnail(undefined);
      player
        .generateThumbnailsAsync([0], { maxWidth: 1280, maxHeight: 720 })
        .then((thumbs) => {
          if (thumbs[0]) rememberVideoThumbnail(uri, thumbs[0]);
          if (isMounted.current) setThumbnail(thumbs[0]);
        })
        .catch((thumbnailError) => {
          if (isMounted.current) setError(thumbnailError instanceof Error ? thumbnailError.message : t('fileSelection.videoPreviewFailed'));
        });
    }

    const subscription = player.addListener('statusChange', ({ status, error: playerError }) => {
      if (isMounted.current && status === 'error') {
        setError(playerError?.message ?? t('fileSelection.videoPreviewFailed'));
      }
    });

    return () => {
      isMounted.current = false;
      subscription.remove();
      // No need to call player.pause() here as useVideoPlayer handles disposal
      // and calling it during unmount can cause the shared object rejection error
    };
  }, [player, t, uri]);

  if (getVideoPreviewMode(error) === 'fallback') {
    return (
      <View style={styles.fallbackPreview}>
        {thumbnail ? <ExpoImage source={thumbnail} contentFit="cover" style={styles.previewMedia} /> : null}
        <Text variant="bodySmall" style={{ textAlign: 'center', marginTop: 12 }}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.videoPreview}>
      {thumbnail && !error ? <ExpoImage pointerEvents="none" source={thumbnail} contentFit="cover" style={styles.videoPoster} /> : null}
      <VideoView
        player={player}
        style={styles.previewMedia}
        contentFit="contain"
        nativeControls
        fullscreenOptions={{ enable: false }}
        buttonOptions={{ showSettings: false, showSeekBackward: true, showSeekForward: true, showPlayPause: true }}
        surfaceType="textureView"
        useExoShutter={false}
      />
    </View>
  );
}

function createSortComparator(sortMode: SortMode) {
  return (a: ExtractedMediaFile, b: ExtractedMediaFile) => {
    if (sortMode === 'name') return a.filename.localeCompare(b.filename);
    if (sortMode === 'sender') return getMediaSender(a).localeCompare(getMediaSender(b));
    if (sortMode === 'type') return a.mediaType.localeCompare(b.mediaType) || a.filename.localeCompare(b.filename);
    const aDate = getMediaDateIso(a);
    const bDate = getMediaDateIso(b);
    if (!aDate || !bDate) return Number(!aDate) - Number(!bDate);
    const byDate = sortMode === 'date-asc' ? aDate.localeCompare(bDate) : bDate.localeCompare(aDate);
    return byDate || (a.matchedRecord?.messageIndex ?? Infinity) - (b.matchedRecord?.messageIndex ?? Infinity) || 0;
  };
}

function getPreviewIcon(mediaType: MediaType): React.ComponentProps<typeof MaterialCommunityIcons>['name'] {
  if (mediaType === 'video') return 'video-outline';
  if (mediaType === 'voice' || mediaType === 'audio') return 'microphone-outline';
  if (mediaType === 'sticker') return 'sticker-outline';
  if (mediaType === 'document') return 'file-document-outline';
  return 'file-question-outline';
}

function isTextTranscript(file: ExtractedMediaFile): boolean {
  return file.sourceKind === 'chat-transcript' || file.filename.toLowerCase().endsWith('.txt');
}

function formatSeconds(value: number): string {
  const totalSeconds = Math.max(0, Math.floor(value || 0));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

const styles = StyleSheet.create({
  toolbarBlock: {
    gap: spacing.smallGap,
    paddingBottom: spacing.tinyGap
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tinyGap
  },
  searchToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smallGap
  },
  search: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24
  },
  searchInput: {
    minHeight: 48
  },
  countBadge: {
    marginStart: 'auto'
  },
  listContent: {
    paddingBottom: 144,
    gap: spacing.smallGap
  },
  emptyState: {
    alignItems: 'center',
    padding: 20,
    gap: 8
  },
  diagnosticPanel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    gap: 8
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.gap
  },
  selectableList: {
    gap: spacing.smallGap
  },
  filterTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.smallGap
  },
  filterTypeOption: {
    width: '48%',
    minHeight: 58,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smallGap
  },
  filterTypeIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center'
  },
  filterTypeLabel: {
    fontWeight: '800'
  },
  sheetFooter: {
    gap: spacing.smallGap
  },
  sheetFooterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smallGap
  },
  sheetPrimaryAction: {
    flex: 1.4
  },
  sheetSecondaryAction: {
    flex: 1
  },
  previewPanel: {
    minHeight: 220,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center'
  },
  previewMedia: {
    width: '100%',
    height: 280
  },
  fallbackPreview: {
    width: '100%',
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16
  },
  transcriptLoading: {
    width: '100%',
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.smallGap,
    padding: spacing.gap
  },
  transcriptProgress: {
    width: '86%',
    height: 6,
    borderRadius: 999
  },
  transcriptPreview: {
    width: '100%',
    alignSelf: 'stretch',
    padding: spacing.gap,
    gap: spacing.gap
  },
  transcriptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smallGap
  },
  transcriptThread: {
    gap: spacing.smallGap,
    paddingBottom: spacing.tinyGap
  },
  transcriptScroll: {
    alignSelf: 'stretch',
    width: '100%'
  },
  transcriptBubble: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: spacing.gap,
    gap: spacing.tinyGap
  },
  transcriptBubbleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smallGap
  },
  transcriptMessageBody: {
    lineHeight: 21
  },
  rawTranscriptCard: {
    borderRadius: 14,
    padding: spacing.gap
  },
  rawTranscriptText: {
    fontFamily: 'monospace',
    lineHeight: 20,
    writingDirection: 'auto',
    textAlign: 'auto'
  },
  voicePreview: {
    width: '100%',
    minHeight: 180,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    padding: 16
  },
  voiceProgress: {
    width: '100%',
    height: 8,
    borderRadius: 999
  },
  videoPreview: {
    width: '100%',
    minHeight: 280
  },
  videoPoster: {
    ...StyleSheet.absoluteFillObject
  },
  flex: {
    flex: 1
  }
});
