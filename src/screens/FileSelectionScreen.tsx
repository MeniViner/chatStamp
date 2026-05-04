import React from 'react';
import { BackHandler, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { VideoView, useVideoPlayer } from 'expo-video';
import { BottomSheet } from '../components/BottomSheet';
import { Button, Checkbox, Chip, IconButton, ProgressBar, Searchbar, Surface, Switch, Text } from 'react-native-paper';
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
        <FooterActions>
          <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
            {t('fileSelection.footerSelected', {
              selected: selectedCount,
              photos: selectedByType.photos,
              videos: selectedByType.videos,
              other: selectedByType.other
            })}
          </Text>
          <Button mode="contained" disabled={selectedCount === 0} onPress={() => setStage('outputOptions')}>
            {t('fileSelection.continue')}
          </Button>
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
          <Text variant="bodySmall" style={{ flex: 1, color: theme.colors.onSurfaceVariant }}>
            {t('fileSelection.totalShown', { count: visibleFiles.length })}
          </Text>
          <IconButton mode="contained-tonal" icon={searchOpen ? 'close' : 'magnify'} size={20} onPress={() => setSearchOpen((value) => !value)} />
          <IconButton mode="contained-tonal" icon="sort" size={20} onPress={() => setSortSheetOpen(true)} />
          <IconButton mode="contained-tonal" icon="filter-variant" size={20} onPress={() => setFilterSheetOpen(true)} />
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
          <FileRow
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
      {options.map((option) => (
        <Button key={option} mode={sortMode === option ? 'contained-tonal' : 'outlined'} onPress={() => onSortMode(option)}>
          {t(`fileSelection.sortModes.${option}`)}
        </Button>
      ))}
    </BottomSheet>
  );
}

function CompactMetric({ label, value }: { label: string; value: number }) {
  const theme = useAppTheme();
  return (
    <View style={[styles.compactMetric, { backgroundColor: theme.colors.surfaceContainerHigh ?? theme.colors.surfaceVariant }]}>
      <Text variant="labelLarge">{value}</Text>
      <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
        {label}
      </Text>
    </View>
  );
}

function FileRow({
  file,
  selected,
  onToggle,
  onPreview
}: {
  file: ExtractedMediaFile;
  selected: boolean;
  onToggle: () => void;
  onPreview: () => void;
}) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  return (
    <Surface
      elevation={0}
      style={[
        styles.fileRow,
        {
          backgroundColor: selected ? theme.colors.primaryContainer : theme.colors.surface,
          borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant
        }
      ]}
    >
      <Pressable onPress={onPreview} style={styles.filePress}>
        <PreviewThumb file={file} />
        <View style={styles.fileBody}>
          <View style={styles.fileTopLine}>
            <Text variant="titleSmall" numberOfLines={2} style={styles.flex}>
              {file.filename}
            </Text>
            <Chip compact>{t(`media.singular.${file.mediaType}`)}</Chip>
          </View>
          <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>
            {file.matchedRecord?.sender ?? t('fileSelection.unknownSender')}
          </Text>
          <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>
            {file.matchedRecord?.messageDateIso ? new Date(file.matchedRecord.messageDateIso).toLocaleString() : t('fileSelection.noDate')}
          </Text>
        </View>
      </Pressable>
      <Checkbox status={selected ? 'checked' : 'unchecked'} onPress={onToggle} />
    </Surface>
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

function PreviewThumb({ file }: { file: ExtractedMediaFile }) {
  const theme = useAppTheme();
  if (file.mediaType === 'photo' || file.mediaType === 'sticker') {
    return <ExpoImage source={file.thumbnailUri ?? file.uri} contentFit="cover" style={styles.previewImage} />;
  }
  if (file.mediaType === 'video') {
    return <VideoThumbnail uri={file.uri} />;
  }
  return (
    <View style={[styles.previewIcon, { backgroundColor: theme.colors.surfaceContainerHigh ?? theme.colors.surfaceVariant }]}>
      <MaterialCommunityIcons name={getPreviewIcon(file.mediaType)} size={22} color={theme.colors.primary} />
    </View>
  );
}

function VideoThumbnail({ uri }: { uri: string }) {
  const theme = useAppTheme();
  const isMounted = React.useRef(true);
  const [thumbnail, setThumbnail] = React.useState<unknown>();
  const player = useVideoPlayer({ uri });

  React.useEffect(() => {
    isMounted.current = true;
    player
      .generateThumbnailsAsync([0], { maxWidth: 160, maxHeight: 160 })
      .then((thumbs) => {
        if (isMounted.current) setThumbnail(thumbs[0]);
      })
      .catch(() => undefined);
    return () => {
      isMounted.current = false;
    };
  }, [player]);

  if (!thumbnail) {
    return (
      <View style={[styles.previewIcon, { backgroundColor: theme.colors.surfaceContainerHigh ?? theme.colors.surfaceVariant }]}>
        <MaterialCommunityIcons name="play-circle-outline" size={24} color={theme.colors.primary} />
      </View>
    );
  }

  return <ExpoImage source={thumbnail} contentFit="cover" style={styles.previewImage} />;
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
    paddingBottom: 8
  },
  metricRow: {
    flexDirection: 'row',
    gap: 8
  },
  compactMetric: {
    flex: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  search: {
    height: 48,
    borderRadius: 18
  },
  searchInput: {
    minHeight: 48
  },
  quickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  listContent: {
    paddingBottom: 12,
    gap: 8
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 10,
    gap: 6
  },
  filePress: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    minWidth: 0
  },
  fileBody: {
    flex: 1,
    gap: 4,
    minWidth: 0
  },
  fileTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  previewImage: {
    width: 56,
    height: 56,
    borderRadius: 16
  },
  previewIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyState: {
    alignItems: 'center',
    padding: 28,
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
    gap: 8
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
    gap: 12
  },
  previewPanel: {
    minHeight: 260,
    borderRadius: 22,
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
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 16
  },
  voicePreview: {
    width: '100%',
    minHeight: 220,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
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
