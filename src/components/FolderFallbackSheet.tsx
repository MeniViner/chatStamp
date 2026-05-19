import React from 'react';
import * as Clipboard from 'expo-clipboard';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from './BottomSheet';
import { FilePathText, PrimaryButton, SecondaryButton, textStyles } from './AppUi';

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
      <PrimaryButton icon="folder-open-outline" onPress={onRetryOpenFolder}>
        {t('results.openFolder')}
      </PrimaryButton>
      {canOpenFirstSavedItem && onOpenFirstSavedItem ? (
        <SecondaryButton icon="image-outline" onPress={onOpenFirstSavedItem}>
          {t('results.openFirstSavedItem')}
        </SecondaryButton>
      ) : null}
      <SecondaryButton icon="content-copy" onPress={() => void copyPath()}>
        {t('results.copyFolderPath')}
      </SecondaryButton>
      <Text variant="labelLarge">{t('results.outputFolder')}</Text>
      <FilePathText value={outputFolder} maxLines={3} />
      <Text variant="bodySmall" style={textStyles.start}>{helperText}</Text>
    </BottomSheet>
  );
}
