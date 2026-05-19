import React from 'react';
import { BackHandler, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { VideoView, useVideoPlayer } from 'expo-video';
import { BottomSheet } from '../components/BottomSheet';
import { Button, Chip, IconButton, ProgressBar, RadioButton, Searchbar, Surface, Switch, Text } from 'react-native-paper';
import { usePipelineStore } from '../store/pipelineStore';
import { useSettingsStore } from '../store/settingsStore';
import { countSelectedSaveableFiles } from '../store/selectionLogic';
import { filterVisibleFiles, getVisibleSaveableFileIds } from '../store/fileFiltering';
import type { ExtractedMediaFile, MediaType } from '../types/media';
import { visibleMediaTypes } from '../lib/mediaUi';
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
import { MediaFileListItem, MetricTile, PrimaryButton, textStyles } from '../components/AppUi';
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

  return (
    <WizardScreen
      stage="selectFiles"
      title={t('fileSelection.title')}
      subtitle={t('fileSelection.subtitle', {
        matched: importSummary?.matchedMedia ?? mediaFiles.length,
        selectedSenders: selectedSenders.length,
        totalSenders: senders.length
      })}
      onBack={() => setStage('welcome')}
      footer={
        filterSheetOpen || sortSheetOpen || previewFile ? undefined :
        <FooterActions>
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
        <View style={styles.metricRow}>
          <CompactMetric label={t('fileSelection.photos')} value={importSummary?.photos ?? 0} />
          <CompactMetric label={t('fileSelection.videos')} value={importSummary?.videos ?? 0} />
          <CompactMetric
            label={t('fileSelection.other')}
            value={(importSummary?.voice ?? 0) + (importSummary?.stickers ?? 0) + (importSummary?.documents ?? 0) + (importSummary?.unknown ?? 0)}
          />
        </View>

        <View style={styles.toolbarRow}>
          <Text variant="bodySmall" numberOfLines={2} style={[styles.flex, textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
            {t('fileSelection.totalShown', { count: visibleFiles.length })}
          </Text>
          <IconButton mode="contained-tonal" icon={searchOpen ? 'close' : 'magnify'} size={20} style={styles.iconButton} accessibilityLabel={t('fileSelection.searchPlaceholder')} onPress={() => setSearchOpen((value) => !value)} />
          <IconButton mode="contained-tonal" icon="sort" size={20} style={styles.iconButton} accessibilityLabel={t('fileSelection.sortTitle')} onPress={() => setSortSheetOpen(true)} />
          <IconButton mode="contained-tonal" icon="filter-variant" size={20} style={styles.iconButton} accessibilityLabel={t('fileSelection.filterTitle')} onPress={() => setFilterSheetOpen(true)} />
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
          <Button compact mode="text" onPress={selectVisibleFiles}>
            {t('fileSelection.selectAll')}
          </Button>
          <Button compact mode="text" onPress={clearVisibleSelections}>
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
        onClearCategories={() => setCategoryFilters([])}
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
  onClearCategories,
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
  onClearCategories: () => void;
  onSaveableOnly: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  return (
    <BottomSheet visible={visible} title={t('fileSelection.filterTitle')} subtitle={t('fileSelection.filterSubtitle')} onDismiss={onDismiss}>
      <Text variant="labelLarge">{t('fileSelection.senders')}</Text>
      <View style={styles.chipWrap}>
        {senders.map((sender) => (
          <Chip
            key={sender}
            compact
            selected={selectedSenders.includes(sender)}
            showSelectedCheck
            onPress={() => onToggleSender(sender)}
          >
            {sender}
          </Chip>
        ))}
      </View>
      <View style={styles.sheetSectionHeader}>
        <Text variant="labelLarge">{t('fileSelection.categories')}</Text>
        <Button compact mode="text" onPress={onClearCategories}>
          {t('fileSelection.all')}
        </Button>
      </View>
      <View style={styles.chipWrap}>
        {visibleMediaTypes.map((mediaType) => (
          <Chip
            key={mediaType}
            compact
            selected={categoryFilters.includes(mediaType)}
            showSelectedCheck
            onPress={() => onToggleCategory(mediaType)}
          >
            {t(`media.plural.${mediaType}`)}
          </Chip>
        ))}
      </View>
      <View style={styles.switchRow}>
        <View style={styles.flex}>
          <Text variant="titleSmall">{t('fileSelection.saveableOnly')}</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {t('fileSelection.saveableOnlyBody')}
          </Text>
        </View>
        <Switch value={saveableOnly} onValueChange={onSaveableOnly} />
      </View>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        {t('fileSelection.totalShown', { count: totalShown })}
      </Text>
    </BottomSheet>
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
    <BottomSheet visible={visible} title={t('fileSelection.sortTitle')} subtitle={t('fileSelection.sortSubtitle')} onDismiss={onDismiss}>
      <RadioButton.Group value={sortMode} onValueChange={(value) => onSortMode(value as SortMode)}>
        <View style={styles.selectableList}>
          {options.map((option) => (
            <Pressable key={option} onPress={() => onSortMode(option)} style={styles.selectableRow}>
              <Text variant="bodyMedium" numberOfLines={1} style={[styles.flex, textStyles.start]}>
                {t(`fileSelection.sortModes.${option}`)}
              </Text>
              <RadioButton value={option} />
            </Pressable>
          ))}
        </View>
      </RadioButton.Group>
    </BottomSheet>
  );
}

function CompactMetric({ label, value }: { label: string; value: number }) {
  return <MetricTile label={label} value={value} />;
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

  if (!file) return null;

  return (
    <BottomSheet visible title={file.filename} subtitle={file.matchedRecord?.sender ?? t('fileSelection.unknownSender')} onDismiss={onDismiss}>
      <Surface elevation={0} style={[styles.previewPanel, { backgroundColor: theme.colors.surfaceContainerHigh ?? theme.colors.surfaceVariant }]}>
        {file.mediaType === 'photo' || file.mediaType === 'sticker' ? (
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
    </BottomSheet>
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

function formatSeconds(value: number): string {
  const totalSeconds = Math.max(0, Math.floor(value || 0));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

const styles = StyleSheet.create({
  toolbarBlock: {
    gap: 8,
    paddingBottom: 6
  },
  metricRow: {
    flexDirection: 'row',
    gap: 8
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  iconButton: {
    width: 40,
    height: 40,
    margin: 0
  },
  search: {
    height: 44,
    borderRadius: 14
  },
  searchInput: {
    minHeight: 44
  },
  quickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  listContent: {
    paddingBottom: spacing.section,
    gap: 6
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
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4
  },
  sheetSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  selectableList: {
    gap: spacing.tinyGap
  },
  selectableRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smallGap,
    paddingVertical: 2
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
