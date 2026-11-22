import React from 'react';
import { BackHandler, FlatList, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { IconButton, Menu, Snackbar, Text } from 'react-native-paper';
import { ShareOutputSheet } from '../components/ShareOutputSheet';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FolderFallbackSheet } from '../components/FolderFallbackSheet';
import { openFolderBestEffort, openGalleryBestEffort, shouldShowOpenGallery } from '../native/androidIntents';
import { deleteOutputFiles } from '../native/outputFiles';
import { useHistoryStore } from '../store/historyStore';
import { historyPresentation } from '../store/historyLogic';
import { usePipelineStore } from '../store/pipelineStore';
import type { ExportHistoryItem } from '../types/media';
import { useAppTheme } from '../theme/useAppTheme';
import { WizardScreen } from './WizardScreen';
import { useTranslation } from 'react-i18next';
import { ExpandableTechnicalDetails, FilePathText, IconCircle, PremiumCard, SecondaryButton, StatusBadge, textStyles } from '../components/AppUi';
import { spacing } from '../theme/designTokens';
import { formatAppDate } from '../lib/localeDateFormat';

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
            onShareError={setSnackbar}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <IconCircle icon="history" size={72} />
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
  onFallbackNotice,
  onShareError
}: {
  item: ExportHistoryItem;
  onDeleteRecord: () => void;
  onDeleteWithFiles: () => void;
  onFallbackNotice: () => void;
  onShareError: (message: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const theme = useAppTheme();
  const [shareOpen, setShareOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const loadDetails = useHistoryStore((state) => state.loadHistoryDetails);
  React.useEffect(() => { void loadDetails(item.id); }, [item.id, loadDetails]);

  async function openFolder() {
    const outcome = await openFolderBestEffort(item.outputFolderPath, null, item.outputDirectory ?? item.outputFolderPath);
    if (outcome === 'manual-fallback') {
      onFallbackNotice();
    }
  }

  const presentation = historyPresentation(item);
  const completed = presentation.status === 'completed';

  return (
    <PremiumCard style={styles.card}>
      <View style={styles.header}>
        <IconCircle icon={completed ? 'check' : 'alert-outline'} tone={completed ? 'tonal' : 'error'} />
        <View style={styles.headerText}>
          <Text variant="titleMedium" numberOfLines={2} style={[styles.cardTitle, textStyles.start]}>
            {t('history.saveFrom', { date: formatAppDate(item.exportTimestampIso, i18n.resolvedLanguage ?? 'en') })}
          </Text>
          <StatusBadge label={t(presentation.statusKey)} selected={completed} danger={!completed} />
        </View>
        <View style={styles.headerActions}>
          <Menu
            visible={menuOpen}
            onDismiss={() => setMenuOpen(false)}
            anchor={<IconButton icon="dots-vertical" size={20} style={styles.iconButton} accessibilityLabel={t('history.actions')} onPress={() => setMenuOpen(true)} />}
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
        {t(presentation.descriptionKey, presentation.values)}
      </Text>
      {item.detailsMissing ? <Text variant="bodySmall" style={textStyles.start}>{t('session.detailsMissing')}</Text> : null}
      <Text variant="bodySmall" style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
        {t('history.mediaCounts', {
          photos: item.counts.photos,
          videos: item.counts.videos,
          other: item.counts.voice + item.counts.stickers + item.counts.documents
        })}
      </Text>
      <View style={styles.folderRow}>
        <MaterialCommunityIcons name="folder-outline" size={16} color={theme.colors.onSurfaceVariant} importantForAccessibility="no" />
        <Text variant="bodySmall" numberOfLines={1} style={[styles.flex, textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
          {getFriendlyFolderName(item.outputFolderPath)}
        </Text>
      </View>
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
      <ShareOutputSheet visible={shareOpen} results={item.savedFiles ?? []} preferVisualTypes
        subtitle={t('history.shareFilesBody')} onDismiss={() => setShareOpen(false)} onError={onShareError} />
    </PremiumCard>
  );
}

function getFriendlyFolderName(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  return normalized.split('/').filter(Boolean).pop() ?? path;
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.smallGap,
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
    gap: spacing.gap
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: spacing.tinyGap + 2
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
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
    flexGrow: 1,
    flexBasis: 128
  },
  iconButton: {
    width: 36,
    height: 36,
    margin: 0
  },
  cardTitle: {
    fontWeight: '500'
  },
  flex: {
    flex: 1
  }
});
