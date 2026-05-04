import React from 'react';
import { BackHandler, FlatList, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Chip, Snackbar, Surface, Text } from 'react-native-paper';
import { BottomSheet } from '../components/BottomSheet';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FolderFallbackSheet } from '../components/FolderFallbackSheet';
import { openFolderBestEffort, openGalleryBestEffort, shouldShowOpenGallery } from '../native/androidIntents';
import { deleteOutputFiles, shareOutputFiles } from '../native/outputFiles';
import { useHistoryStore } from '../store/historyStore';
import { usePipelineStore } from '../store/pipelineStore';
import type { ExportHistoryItem, MediaType } from '../types/media';
import { useAppTheme } from '../theme/useAppTheme';
import { WizardScreen } from './WizardScreen';
import { useTranslation } from 'react-i18next';

export function HistoryScreen() {
  const { t } = useTranslation();
  const items = useHistoryStore((state) => state.items);
  const deleteHistoryItem = useHistoryStore((state) => state.deleteHistoryItem);
  const closeOverlayStage = usePipelineStore((state) => state.closeOverlayStage);
  const theme = useAppTheme();
  const [deleteRecordId, setDeleteRecordId] = React.useState<string | undefined>();
  const [deleteWithFilesId, setDeleteWithFilesId] = React.useState<string | undefined>();
  const [folderFallbackItemId, setFolderFallbackItemId] = React.useState<string | undefined>();
  const [snackbar, setSnackbar] = React.useState<string | undefined>();

  React.useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeOverlayStage('welcome');
      return true;
    });
    return () => subscription.remove();
  }, [closeOverlayStage]);

  async function confirmDeleteRecord() {
    if (!deleteRecordId) return;
    await deleteHistoryItem(deleteRecordId);
    setDeleteRecordId(undefined);
    setSnackbar(t('history.recordDeleted'));
  }

  async function confirmDeleteWithFiles(item?: ExportHistoryItem) {
    if (!item) return;
    await deleteOutputFiles(item.savedFiles ?? []);
    await deleteHistoryItem(item.id);
    setDeleteWithFilesId(undefined);
    setSnackbar(t('history.filesDeleted'));
  }

  const deleteWithFilesItem = items.find((item) => item.id === deleteWithFilesId);
  const folderFallbackItem = items.find((item) => item.id === folderFallbackItemId);

  return (
    <WizardScreen stage="history" title={t('history.title')} subtitle={t('history.subtitle')} onBack={() => closeOverlayStage('welcome')}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={items.length === 0 ? styles.emptyContent : styles.content}
        renderItem={({ item }) => (
          <HistoryCard
            item={item}
            onDeleteRecord={() => setDeleteRecordId(item.id)}
            onDeleteWithFiles={() => setDeleteWithFilesId(item.id)}
            onFallbackNotice={() => setFolderFallbackItemId(item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="history" size={48} color={theme.colors.outline} />
            <Text variant="titleMedium">{t('history.emptyTitle')}</Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('history.emptyBody')}
            </Text>
          </View>
        }
      />
      <ConfirmDialog
        visible={Boolean(deleteRecordId)}
        title={t('history.deleteRecordTitle')}
        body={t('history.deleteRecordBody')}
        confirmLabel={t('history.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={() => void confirmDeleteRecord()}
        onDismiss={() => setDeleteRecordId(undefined)}
      />
      <ConfirmDialog
        visible={Boolean(deleteWithFilesItem)}
        title={t('history.deleteFilesTitle')}
        body={t('history.deleteFilesBody')}
        confirmLabel={t('history.deleteFiles')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={() => void confirmDeleteWithFiles(deleteWithFilesItem)}
        onDismiss={() => setDeleteWithFilesId(undefined)}
      />
      {folderFallbackItem ? (
        <FolderFallbackSheet
          visible
          title={t('history.openFolder')}
          subtitle={t('results.openFolderFallbackTitle')}
          helperText={t('history.openFolderFallback')}
          outputFolder={folderFallbackItem.outputFolderPath}
          canOpenFirstSavedItem={shouldShowOpenGallery(folderFallbackItem.savedFiles)}
          onDismiss={() => setFolderFallbackItemId(undefined)}
          onRetryOpenFolder={async () => {
            const outcome = await openFolderBestEffort(folderFallbackItem.outputFolderPath);
            if (outcome === 'manual-fallback') {
              setSnackbar(t('history.openFolderFallback'));
            } else {
              setFolderFallbackItemId(undefined);
            }
          }}
          onOpenFirstSavedItem={async () => {
            const outcome = await openGalleryBestEffort(folderFallbackItem.outputFolderPath, folderFallbackItem.savedFiles);
            if (outcome === 'manual-fallback') {
              setSnackbar(t('results.openGalleryFallback'));
            }
          }}
          onCopied={(message) => setSnackbar(message)}
        />
      ) : null}
      <Snackbar visible={Boolean(snackbar)} onDismiss={() => setSnackbar(undefined)} duration={3200}>
        {snackbar}
      </Snackbar>
    </WizardScreen>
  );
}

function HistoryCard({
  item,
  onDeleteRecord,
  onDeleteWithFiles,
  onFallbackNotice
}: {
  item: ExportHistoryItem;
  onDeleteRecord: () => void;
  onDeleteWithFiles: () => void;
  onFallbackNotice: () => void;
}) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const [shareOpen, setShareOpen] = React.useState(false);

  async function openFolder() {
    const outcome = await openFolderBestEffort(item.outputFolderPath);
    if (outcome === 'manual-fallback') {
      onFallbackNotice();
    }
  }

  return (
    <Surface elevation={0} style={[styles.card, { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surface }]}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text variant="titleMedium" numberOfLines={1}>
            {item.chatName}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {new Date(item.exportTimestampIso).toLocaleString()}
          </Text>
        </View>
        <Chip compact>{item.allFilesHadTimestampsFixed ? t('history.dateReady') : t('history.needsCheck')}</Chip>
      </View>
      <Text variant="bodySmall" numberOfLines={2} style={{ color: theme.colors.onSurfaceVariant }}>
        {item.outputFolderPath}
      </Text>
      <Text variant="labelMedium">
        {t('history.counts', {
          saved: item.counts.totalSaved,
          photos: item.counts.photos,
          videos: item.counts.videos,
          other: item.counts.voice + item.counts.stickers + item.counts.documents,
          failed: item.counts.failed
        })}
      </Text>
      <View style={styles.actions}>
        <Button compact mode="contained-tonal" icon="folder-open-outline" onPress={() => void openFolder()}>
          {t('history.openFolder')}
        </Button>
        <Button compact mode="text" disabled={!item.savedFiles?.length} onPress={() => setShareOpen(true)}>
          {t('history.shareFiles')}
        </Button>
        <Button compact mode="text" textColor={theme.colors.error} onPress={onDeleteRecord}>
          {t('history.delete')}
        </Button>
        <Button compact mode="text" textColor={theme.colors.error} disabled={!item.savedFiles?.length} onPress={onDeleteWithFiles}>
          {t('history.deleteFiles')}
        </Button>
      </View>
      <HistoryShareSheet
        visible={shareOpen}
        item={item}
        onDismiss={() => setShareOpen(false)}
        onShare={(categories) => {
          setShareOpen(false);
          void shareOutputFiles(item.savedFiles ?? [], categories);
        }}
      />
    </Surface>
  );
}

function HistoryShareSheet({
  visible,
  item,
  onDismiss,
  onShare
}: {
  visible: boolean;
  item: ExportHistoryItem;
  onDismiss: () => void;
  onShare: (categories: MediaType[]) => void;
}) {
  const { t } = useTranslation();
  const available = React.useMemo(
    () => Array.from(new Set((item.savedFiles ?? []).filter((result) => result.ok && result.mediaType).map((result) => result.mediaType as MediaType))),
    [item.savedFiles]
  );
  const [selected, setSelected] = React.useState<MediaType[]>([]);

  React.useEffect(() => {
    const defaults = available.filter((type) => type === 'photo' || type === 'video');
    setSelected(defaults.length > 0 ? defaults : available);
  }, [available]);

  function toggle(type: MediaType) {
    setSelected((current) => (current.includes(type) ? current.filter((itemType) => itemType !== type) : [...current, type]));
  }

  return (
    <BottomSheet visible={visible} title={t('history.shareFiles')} subtitle={t('history.shareFilesBody')} onDismiss={onDismiss}>
      {available.map((type) => (
        <Button key={type} mode={selected.includes(type) ? 'contained-tonal' : 'outlined'} onPress={() => toggle(type)}>
          {t(`media.plural.${type}`)}
        </Button>
      ))}
      <Button mode="contained" disabled={selected.length === 0} onPress={() => onShare(selected)}>
        {t('history.shareFiles')}
      </Button>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 12,
    paddingBottom: 24
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center'
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    padding: 24
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    padding: 16,
    gap: 10
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  flex: {
    flex: 1
  }
});
