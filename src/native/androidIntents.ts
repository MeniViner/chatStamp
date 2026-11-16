import { Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { logger } from '../lib/logger';
import type { PickedFolderResult, SaveFileResult } from '../types/media';
import { getChatStampNativeModule } from './chatStampNativeModule';
import { buildOpenFolderTarget } from './openDirectoryLogic';
import { findGalleryItem } from './openTargetLogic';
import { getMimeTypeForMedia } from '../lib/mediaClassifier';
export { shouldShowOpenFolder, shouldShowOpenGallery } from './openTargetLogic';

export type OpenTargetOutcome = 'opened' | 'manual-fallback';

export async function openGalleryBestEffort(outputPath?: string | null, results?: SaveFileResult[]): Promise<OpenTargetOutcome> {
  return openSavedFileBestEffort(findGalleryItem(results), outputPath);
}

export async function openSavedFileBestEffort(result?: SaveFileResult, outputPath?: string | null): Promise<OpenTargetOutcome> {
  if (Platform.OS !== 'android') {
    if (outputPath) await Clipboard.setStringAsync(outputPath);
    return 'manual-fallback';
  }

  const uri = result?.insertedUri ?? result?.scannedUri;
  if (result?.ok && uri) {
    try {
      const opened = await getChatStampNativeModule().openScannedMediaAsync(uri, result.mimeType ?? getMimeTypeForMedia(result.filename, result.mediaType));
      if (opened.opened) return 'opened';
      logger.warn('Open scanned media URI had no resolved activity', opened);
    } catch (error) {
      logger.warn('Open saved media URI failed', { uri, error });
    }
  }

  if (outputPath && !outputPath.startsWith('content://')) await Clipboard.setStringAsync(outputPath);
  return 'manual-fallback';
}

export async function openFolderBestEffort(
  outputPath?: string | null,
  customFolder?: PickedFolderResult | null,
  outputDirectory?: string | null
): Promise<OpenTargetOutcome> {
  if (Platform.OS === 'android') {
    try {
      const result = await getChatStampNativeModule().openFolderTargetAsync(
        buildOpenFolderTarget({ outputDirectory, outputPath, customFolder })
      );
      logger.info('openFolderTargetResult', result);
      if (result.opened) return 'opened';
    } catch (error) {
      logger.warn('openFolderTargetFailed', { outputPath, treeUri: customFolder?.treeUri, error });
    }
  }
  if (outputPath) await Clipboard.setStringAsync(outputPath);
  return 'manual-fallback';
}
