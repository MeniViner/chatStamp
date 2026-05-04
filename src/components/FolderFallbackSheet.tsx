import React from 'react';
import * as Clipboard from 'expo-clipboard';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from './BottomSheet';

type FolderFallbackSheetProps = {
  visible: boolean;
  title: string;
  subtitle: string;
  helperText: string;
  outputFolder: string;
  canOpenFirstSavedItem?: boolean;
  onDismiss: () => void;
  onRetryOpenFolder: () => void;
  onOpenFirstSavedItem?: () => void;
  onCopied?: (message: string) => void;
};

export function FolderFallbackSheet({
  visible,
  title,
  subtitle,
  helperText,
  outputFolder,
  canOpenFirstSavedItem = false,
  onDismiss,
  onRetryOpenFolder,
  onOpenFirstSavedItem,
  onCopied
}: FolderFallbackSheetProps) {
  const { t } = useTranslation();

  async function copyPath() {
    await Clipboard.setStringAsync(outputFolder);
    onCopied?.(t('results.folderPathCopied'));
  }

  return (
    <BottomSheet visible={visible} title={title} subtitle={subtitle} onDismiss={onDismiss}>
      <Button mode="contained" icon="folder-open-outline" onPress={onRetryOpenFolder}>
        {t('results.openFolder')}
      </Button>
      {canOpenFirstSavedItem && onOpenFirstSavedItem ? (
        <Button mode="contained-tonal" icon="image-outline" onPress={onOpenFirstSavedItem}>
          {t('results.openFirstSavedItem')}
        </Button>
      ) : null}
      <Button mode="text" icon="content-copy" onPress={() => void copyPath()}>
        {t('results.copyFolderPath')}
      </Button>
      <Text variant="labelLarge">{t('results.outputFolder')}</Text>
      <Text variant="bodySmall">{outputFolder}</Text>
      <Text variant="bodySmall">{helperText}</Text>
    </BottomSheet>
  );
}
