import React from 'react';
import { BackHandler, FlatList, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as FileSystem from 'expo-file-system/legacy';
import { PremiumBottomSheet } from '../components/BottomSheet';
import { Button, Chip, ProgressBar, Searchbar, Surface, Switch, Text } from 'react-native-paper';
import { usePipelineStore } from '../store/pipelineStore';
import { useSettingsStore } from '../store/settingsStore';
import { countSelectedSaveableFiles } from '../store/selectionLogic';
import { filterVisibleFiles, getVisibleSaveableFileIds } from '../store/fileFiltering';
import type { ExtractedMediaFile, MediaType } from '../types/media';
import { visibleMediaTypes } from '../lib/mediaUi';
import { parseWhatsAppChatPreview, type ChatPreviewMessage } from '../lib/chatParser';
import { formatShortChatTimestamp } from '../lib/previewDateFormat';
import { useAppTheme } from '../theme/useAppTheme';
import { FooterActions, WizardScreen } from './WizardScreen';
import { runMp4RewriteDiagnosticsNative } from '../native/nativeMediaSaver';
import { useTranslation } from 'react-i18next';
import {
  defaultFileSelectionUiState,
  getVideoPreviewMode,
  getVoicePreviewProgress,
  shouldShowDeveloperDiagnostics,
  toggleCategoryFilter,
  type SortMode
} from './fileSelectionUi';
import {
  FilterChipGroup,
  MediaFileListItem,
  OptionCard,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  StatusBadge,
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
    () => Array.from(new Set(mediaFiles.map((file) => file.matchedRecord?.sender).filter(Boolean))) as string[],
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
  const selectedCount = countSelectedSaveableFiles(mediaFiles, selectedSenders, selectedMediaTypes, selectedFileIds);
  const foundCount = mediaFiles.length;
  const otherFoundCount =
    (importSummary?.voice ?? 0) + (importSummary?.stickers ?? 0) + (importSummary?.documents ?? 0) + (importSummary?.unknown ?? 0);
  const filtersActive = selectedSenders.length < senders.length || categoryFilters.length > 0 || !saveableOnly;
  const selectedByType = React.useMemo(
    () => ({
      photos: mediaFiles.filter((file) => selectedFileIds.includes(file.id) && file.mediaType === 'photo').length,
      videos: mediaFiles.filter((file) => selectedFileIds.includes(file.id) && file.mediaType === 'video').length,
      other: mediaFiles.filter((file) => selectedFileIds.includes(file.id) && file.mediaType !== 'photo' && file.mediaType !== 'video').length
    }),
    [mediaFiles, selectedFileIds]
  );
  const selectedMp4 = mediaFiles.find(
    (file) => selectedFileIds.includes(file.id) && file.mediaType === 'video' && file.filename.toLowerCase().endsWith('.mp4')
  );

  async function runMp4Diagnostics() {
    if (!selectedMp4?.matchedRecord) return;
    setMp4Diagnostic(t('fileSelection.runningDiagnostics'));
    try {
      const result = await runMp4RewriteDiagnosticsNative(
        selectedMp4.uri,
        new Date(selectedMp4.matchedRecord.messageDateIso).getTime()
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
      subtitle={t('fileSelection.subtitle')}
      onBack={() => setStage('welcome')}
      footer={
        filterSheetOpen || sortSheetOpen || previewFile ? undefined :
        <FooterActions>
          {selectedCount === 0 ? (
            <Text variant="bodySmall" numberOfLines={2} style={[textStyles.start, { color: theme.colors.error }]}>
              {t('fileSelection.disabledNoSelection')}
            </Text>
          ) : null}
          <Text variant="labelLarge" numberOfLines={2} style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
            {t('fileSelection.footerSelected', {
              selected: selectedCount,
              photos: selectedByType.photos,
              videos: selectedByType.videos,
              other: selectedByType.other
            })}
          </Text>
          <PrimaryButton disabled={selectedCount === 0} onPress={() => setStage('outputOptions')}>
            {t('fileSelection.continue')}
          </PrimaryButton>
        </FooterActions>
      }
    >
      <View style={styles.toolbarBlock}>
        <View style={[styles.compactSummaryBar, { borderColor: theme.colors.outlineVariant }]}>
          <Text variant="labelMedium" numberOfLines={1} style={[styles.compactSummaryText, textStyles.start, { color: theme.colors.onSurface }]}>
            {t('fileSelection.compactSummary', { selected: selectedCount, total: foundCount })}
          </Text>
          <View style={styles.compactBadges}>
            <StatusBadge label={t('fileSelection.photoCounter', { count: importSummary?.photos ?? 0 })} />
            <StatusBadge label={t('fileSelection.videoCounter', { count: importSummary?.videos ?? 0 })} />
            <StatusBadge label={t('fileSelection.otherCounter', { count: otherFoundCount })} />
            {filtersActive ? <StatusBadge label={t('fileSelection.filtersActive')} selected /> : null}
          </View>
        </View>

        <View style={styles.toolbarRow}>
          <SecondaryButton icon="filter-variant" selected={filtersActive} style={styles.controlButton} onPress={() => setFilterSheetOpen(true)}>
            {filtersActive ? t('fileSelection.filtersActive') : t('fileSelection.filter')}
          </SecondaryButton>
          <SecondaryButton icon="sort" style={styles.controlButton} onPress={() => setSortSheetOpen(true)}>
            {t('fileSelection.sort')}
          </SecondaryButton>
          <SecondaryButton icon={searchOpen ? 'close' : 'magnify'} selected={searchOpen} style={styles.controlButton} onPress={() => setSearchOpen((value) => !value)}>
            {t('fileSelection.search')}
          </SecondaryButton>
        </View>

        {searchOpen ? (
          <Searchbar
            placeholder={t('fileSelection.searchPlaceholder')}
            value={query}
            onChangeText={setQuery}
            style={styles.search}
            inputStyle={styles.searchInput}
            autoFocus
          />
        ) : null}

        <View style={styles.quickActions}>
          <Text variant="bodySmall" numberOfLines={1} style={[styles.flex, textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
            {t('fileSelection.totalShown', { count: visibleFiles.length })}
          </Text>
          <Button mode="text" compact onPress={selectVisibleFiles}>
            {t('fileSelection.selectAll')}
          </Button>
          <Button mode="text" compact onPress={clearVisibleSelections}>
            {t('fileSelection.clear')}
          </Button>
        </View>
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
        totalShown={visibleFiles.length}
        onDismiss={() => setFilterSheetOpen(false)}
        onToggleSender={toggleSender}
        onToggleCategory={(mediaType) =>
          setCategoryFilters((current) => toggleCategoryFilter(current, mediaType))
        }
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
  totalShown,
  onDismiss,
  onToggleSender,
  onToggleCategory,
  onReset,
  onApply,
  onSaveableOnly
}: {
  visible: boolean;
  senders: string[];
  selectedSenders: string[];
  categoryFilters: MediaType[];
  saveableOnly: boolean;
  totalShown: number;
  onDismiss: () => void;
  onToggleSender: (sender: string) => void;
  onToggleCategory: (mediaType: MediaType) => void;
  onReset: () => void;
  onApply: () => void;
  onSaveableOnly: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  return (
    <PremiumBottomSheet
      visible={visible}
      title={t('fileSelection.filterTitle')}
      subtitle={t('fileSelection.filterSubtitle')}
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
      <SectionHeader icon="account-outline" label={t('fileSelection.bySender')} />
      <FilterChipGroup
        values={senders}
        selectedValues={selectedSenders}
        getLabel={(sender) => (sender === 'Chat transcript' ? t('fileSelection.chatTranscript') : sender)}
        onToggle={onToggleSender}
      />
      <SectionHeader icon="file-multiple-outline" label={t('fileSelection.byFileType')} />
      <FilterChipGroup
        values={visibleMediaTypes}
        selectedValues={categoryFilters}
        getLabel={(mediaType) => t(`media.plural.${mediaType}`)}
        onToggle={onToggleCategory}
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
  const { t } = useTranslation();
  const theme = useAppTheme();
  const { height } = useWindowDimensions();
  const previewScrollMaxHeight = Math.max(220, Math.min(420, Math.round(height * 0.42)));

  if (!file) return null;

  return (
    <PremiumBottomSheet
      visible
      title={file.filename}
      subtitle={file.sourceKind === 'chat-transcript' ? t('fileSelection.chatTranscript') : file.matchedRecord?.sender ?? t('fileSelection.unknownSender')}
      onDismiss={onDismiss}
    >
      <Surface elevation={0} style={[styles.previewPanel, { backgroundColor: theme.colors.surfaceContainerHigh ?? theme.colors.surfaceVariant }]}>
        {isTextTranscript(file) ? (
          <TextTranscriptPreview uri={file.uri} maxScrollHeight={previewScrollMaxHeight} />
        ) : file.mediaType === 'photo' || file.mediaType === 'sticker' ? (
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
        {file.matchedRecord?.messageDateIso ? new Date(file.matchedRecord.messageDateIso).toLocaleString() : t('fileSelection.noDate')}
      </Text>
      <Button mode={selected ? 'contained' : 'outlined'} onPress={onToggle}>
        {selected ? t('fileSelection.selected') : t('fileSelection.selectFile')}
      </Button>
    </PremiumBottomSheet>
  );
}

function TextTranscriptPreview({ uri, maxScrollHeight }: { uri: string; maxScrollHeight: number }) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const [state, setState] = React.useState<
    | { status: 'loading' }
    | { status: 'ready'; messages: ChatPreviewMessage[]; totalMessages: number; rawFallback?: string; truncated: boolean }
    | { status: 'error'; error: string }
  >({ status: 'loading' });

  React.useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    FileSystem.readAsStringAsync(uri)
      .then((text) => {
        if (cancelled) return;
        const parsed = parseWhatsAppChatPreview(text, 160);
        setState({
          status: 'ready',
          messages: parsed.messages,
          totalMessages: parsed.totalMessages,
          rawFallback: parsed.messages.length === 0 ? text.slice(0, 12000) : undefined,
          truncated: parsed.truncated
        });
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
  }, [t, uri]);

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
  const [thumbnail, setThumbnail] = React.useState<unknown>();
  const [error, setError] = React.useState<string | undefined>();
  
  const player = useVideoPlayer({ uri }, (videoPlayer) => {
    videoPlayer.muted = false;
  });

  React.useEffect(() => {
    isMounted.current = true;
    
    player
      .generateThumbnailsAsync([0], { maxWidth: 1280, maxHeight: 720 })
      .then((thumbs) => {
        if (isMounted.current) setThumbnail(thumbs[0]);
      })
      .catch((thumbnailError) => {
        if (isMounted.current) setError(thumbnailError instanceof Error ? thumbnailError.message : t('fileSelection.videoPreviewFailed'));
      });

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
  }, [player, t]);

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
      {thumbnail && !error ? <ExpoImage source={thumbnail} contentFit="cover" style={styles.videoPoster} /> : null}
      <VideoView
        player={player}
        style={styles.previewMedia}
        contentFit="contain"
        nativeControls
        surfaceType="textureView"
        useExoShutter={false}
      />
    </View>
  );
}

function createSortComparator(sortMode: SortMode) {
  return (a: ExtractedMediaFile, b: ExtractedMediaFile) => {
    const aDate = new Date(a.matchedRecord?.messageDateIso ?? 0).getTime();
    const bDate = new Date(b.matchedRecord?.messageDateIso ?? 0).getTime();
    if (sortMode === 'name') return a.filename.localeCompare(b.filename);
    if (sortMode === 'sender') return (a.matchedRecord?.sender ?? '').localeCompare(b.matchedRecord?.sender ?? '');
    if (sortMode === 'type') return a.mediaType.localeCompare(b.mediaType) || a.filename.localeCompare(b.filename);
    if (sortMode === 'date-asc') return aDate - bDate;
    return bDate - aDate;
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
  compactSummaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smallGap,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing.tinyGap
  },
  compactSummaryText: {
    flex: 1,
    fontWeight: '800'
  },
  compactBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: spacing.tinyGap,
    flexShrink: 1
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smallGap
  },
  controlButton: {
    flex: 1
  },
  search: {
    minHeight: 48,
    borderRadius: 24
  },
  searchInput: {
    minHeight: 48
  },
  quickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.tinyGap
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
