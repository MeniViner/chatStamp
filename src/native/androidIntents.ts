import { Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { logger } from '../lib/logger';
import type { PickedFolderResult, SaveFileResult } from '../types/media';
import { getChatStampNativeModule } from './chatStampNativeModule';
export { shouldShowOpenFolder, shouldShowOpenGallery } from './openTargetLogic';

export type OpenTargetOutcome = 'opened' | 'manual-fallback';

export async function openGalleryBestEffort(outputPath?: string | null, results?: SaveFileResult[]): Promise<OpenTargetOutcome> {
  if (Platform.OS !== 'android') {
    if (outputPath) await Clipboard.setStringAsync(outputPath);
    return 'manual-fallback';
  }

  const firstMedia = results?.find((result) => result.ok && result.scannedUri && (result.mediaType === 'photo' || result.mediaType === 'video'));
  if (firstMedia?.scannedUri) {
    try {
      const opened = await getChatStampNativeModule().openScannedMediaAsync(firstMedia.scannedUri, mimeTypeForResult(firstMedia));
      if (opened.opened) return 'opened';
      logger.warn('Open scanned media URI had no resolved activity', opened);
    } catch (error) {
      logger.warn('Open scanned media URI failed', { uri: firstMedia.scannedUri, error });
    }
  }

  if (outputPath) await Clipboard.setStringAsync(outputPath);
  return 'manual-fallback';
}

export async function openFolderBestEffort(outputPath?: string | null, customFolder?: PickedFolderResult | null): Promise<OpenTargetOutcome> {
  if (Platform.OS === 'android') {
    try {
      const result = await getChatStampNativeModule().openFolderTargetAsync({
        treeUri: customFolder?.treeUri ?? null,
        path: outputPath ?? null
      });
      logger.info('openFolderTargetResult', result);
      if (result.opened) return 'opened';
    } catch (error) {
      logger.warn('openFolderTargetFailed', { outputPath, treeUri: customFolder?.treeUri, error });
    }
  }
  if (outputPath) await Clipboard.setStringAsync(outputPath);
  return 'manual-fallback';
}

function mimeTypeForResult(result: SaveFileResult): string {
  if (result.mediaType === 'photo') return 'image/*';
  if (result.mediaType === 'video') return 'video/*';
  if (result.mediaType === 'sticker') return 'image/webp';
  return '*/*';
}
