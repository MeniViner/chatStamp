import React from 'react';
import { BackHandler, FlatList, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { IconButton, Menu, Snackbar, Text } from 'react-native-paper';
import { PremiumBottomSheet } from '../components/BottomSheet';
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
import { ExpandableTechnicalDetails, FilePathText, PremiumCard, PrimaryButton, SecondaryButton, StatusBadge, textStyles } from '../components/AppUi';
import { spacing } from '../theme/designTokens';

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
  const [menuOpen, setMenuOpen] = React.useState(false);

  async function openFolder() {
    const outcome = await openFolderBestEffort(item.outputFolderPath);
    if (outcome === 'manual-fallback') {
      onFallbackNotice();
    }
  }

  const completed = item.counts.failed === 0;

  return (
    <PremiumCard style={styles.card}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text variant="titleMedium" numberOfLines={2} style={[styles.cardTitle, textStyles.start]}>
            {t('history.saveFrom', { date: new Date(item.exportTimestampIso).toLocaleString() })}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <StatusBadge label={completed ? t('history.completed') : t('history.needsCheck')} selected={completed} danger={!completed} />
          <Menu
            visible={menuOpen}
            onDismiss={() => setMenuOpen(false)}
            anchor={<IconButton icon="dots-vertical" size={20} style={styles.iconButton} onPress={() => setMenuOpen(true)} />}
          >
            <Menu.Item
              leadingIcon="delete-outline"
              title={t('history.delete')}
              onPress={() => {
                setMenuOpen(false);
                onDeleteRecord();
              }}
            />
            <Menu.Item
              leadingIcon="delete-forever-outline"
              title={t('history.deleteFiles')}
              disabled={!item.savedFiles?.length}
              onPress={() => {
                setMenuOpen(false);
                onDeleteWithFiles();
              }}
            />
          </Menu>
        </View>
      </View>
      <Text variant="labelLarge" style={textStyles.start}>
        {t('history.summaryCounts', { saved: item.counts.totalSaved, failed: item.counts.failed })}
      </Text>
      <Text variant="bodySmall" style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
        {t('history.mediaCounts', {
          photos: item.counts.photos,
          videos: item.counts.videos,
          other: item.counts.voice + item.counts.stickers + item.counts.documents
        })}
      </Text>
      <Text variant="bodySmall" numberOfLines={1} style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
        {getFriendlyFolderName(item.outputFolderPath)}
      </Text>
      <ExpandableTechnicalDetails collapsedTitle={t('history.details')} expandedTitle={t('common.hideTechnicalDetails')}>
        <Text variant="bodySmall" style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
          {item.chatName}
        </Text>
        <FilePathText value={item.outputFolderPath} maxLines={3} />
      </ExpandableTechnicalDetails>
      <View style={styles.actions}>
        <SecondaryButton
          icon="folder-open-outline"
          style={styles.actionButton}
          onPress={() => void openFolder()}
        >
          {t('history.openFolder')}
        </SecondaryButton>
        <SecondaryButton
          icon="share-variant-outline"
          style={styles.actionButton}
          disabled={!item.savedFiles?.length}
          onPress={() => setShareOpen(true)}
        >
          {t('history.shareFiles')}
        </SecondaryButton>
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
    </PremiumCard>
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
  const counts = React.useMemo(() => {
    const next = new Map<MediaType, number>();
    (item.savedFiles ?? []).forEach((result) => {
      if (result.ok && result.mediaType) next.set(result.mediaType, (next.get(result.mediaType) ?? 0) + 1);
    });
    return next;
  }, [item.savedFiles]);
  const [selected, setSelected] = React.useState<MediaType[]>([]);

  React.useEffect(() => {
    const defaults = available.filter((type) => type === 'photo' || type === 'video');
    setSelected(defaults.length > 0 ? defaults : available);
  }, [available]);

  function toggle(type: MediaType) {
    setSelected((current) => (current.includes(type) ? current.filter((itemType) => itemType !== type) : [...current, type]));
  }

  return (
    <PremiumBottomSheet
      visible={visible}
      title={t('results.shareSheetTitle')}
      subtitle={t('history.shareFilesBody')}
      onDismiss={onDismiss}
      footer={
        <PrimaryButton disabled={selected.length === 0} onPress={() => onShare(selected)}>
          {t('results.shareAction')}
        </PrimaryButton>
      }
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

function getFriendlyFolderName(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  return normalized.split('/').filter(Boolean).pop() ?? path;
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.card,
    paddingBottom: 144
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center'
  },
  empty: {
    alignItems: 'center',
    gap: spacing.gap,
    padding: 20
  },
  card: {
    gap: spacing.smallGap
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tinyGap
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.smallGap
  },
  actionButton: {
    alignSelf: 'flex-start',
    minWidth: 116
  },
  iconButton: {
    width: 36,
    height: 36,
    margin: 0
  },
  shareChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  cardTitle: {
    fontWeight: '700'
  },
  flex: {
    flex: 1
  }
});
