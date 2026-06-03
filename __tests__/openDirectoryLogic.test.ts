import { describe, expect, it } from 'vitest';
import { buildOpenFolderTarget, joinSafDocumentId, publicAndroidPathToDocumentId } from '../src/native/openDirectoryLogic';

describe('openDirectoryLogic', () => {
  it('builds exact content document targets for SAF output directories', () => {
    expect(
      buildOpenFolderTarget({
        outputDirectory: 'content://com.android.externalstorage.documents/tree/primary%3ADownload/document/primary%3ADownload%2FChat',
        outputPath: '/storage/emulated/0/Pictures/chatStamp/Chat',
        customFolder: {
          treeUri: 'content://com.android.externalstorage.documents/tree/primary%3ADownload',
          displayName: 'Download',
          persistedPermission: true
        }
      })
    ).toEqual({
      treeUri: 'content://com.android.externalstorage.documents/tree/primary%3ADownload',
      documentUri: 'content://com.android.externalstorage.documents/tree/primary%3ADownload/document/primary%3ADownload%2FChat',
      documentId: undefined,
      relativeFolderDocumentId: undefined,
      path: '/storage/emulated/0/Pictures/chatStamp/Chat',
      displayName: 'Download'
    });
  });

  it('keeps public filesystem folders as path targets', () => {
    expect(
      buildOpenFolderTarget({
        outputDirectory: '/storage/emulated/0/Pictures/chatStamp/Family/Export 2026-05-02'
      })
    ).toMatchObject({
      treeUri: null,
      documentUri: null,
      path: '/storage/emulated/0/Pictures/chatStamp/Family/Export 2026-05-02'
    });
  });

  it('joins nested SAF document IDs without duplicate slashes', () => {
    expect(joinSafDocumentId('primary:Download/', '/Chat//Export 2026/')).toBe('primary:Download/Chat/Export 2026');
    expect(joinSafDocumentId('primary:Download', '')).toBe('primary:Download');
  });

  it('converts public Android folders to external-storage document IDs', () => {
    expect(publicAndroidPathToDocumentId('/storage/emulated/0/Pictures/chatStamp/Family')).toBe('primary:Pictures/chatStamp/Family');
    expect(publicAndroidPathToDocumentId('/sdcard/Pictures/chatStamp/Family/')).toBe('primary:Pictures/chatStamp/Family');
    expect(publicAndroidPathToDocumentId('content://documents/tree')).toBeUndefined();
  });
});
