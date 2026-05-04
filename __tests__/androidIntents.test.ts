import { describe, expect, it } from 'vitest';
import { getFolderFallbackCapabilities, shouldShowOpenFolder, shouldShowOpenGallery } from '../src/native/openTargetLogic';

describe('android open-target fallbacks', () => {
  it('exposes folder opening through safe native intents', () => {
    expect(shouldShowOpenFolder()).toBe(true);
  });

  it('shows gallery only when a scanned media content URI exists', () => {
    expect(shouldShowOpenGallery()).toBe(false);
    expect(shouldShowOpenGallery([{ filename: 'IMG.jpg', ok: true, mediaType: 'photo', scannedUri: 'content://media/1', dateCorrectionVerified: true, galleryMaySortByImportTime: false }])).toBe(true);
    expect(shouldShowOpenGallery([{ filename: 'doc.pdf', ok: true, mediaType: 'document', scannedUri: undefined, dateCorrectionVerified: true, galleryMaySortByImportTime: false }])).toBe(false);
  });

  it('keeps the manual fallback sheet focused on opening targets first', () => {
    expect(getFolderFallbackCapabilities().canRetryOpenFolder).toBe(true);
    expect(getFolderFallbackCapabilities().canCopyPath).toBe(true);
    expect(
      getFolderFallbackCapabilities([
        { filename: 'IMG.jpg', ok: true, mediaType: 'photo', scannedUri: 'content://media/1', dateCorrectionVerified: true, galleryMaySortByImportTime: false }
      ]).canOpenFirstSavedItem
    ).toBe(true);
  });
});
