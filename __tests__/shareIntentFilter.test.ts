import { describe, expect, it } from 'vitest';
import { isShareImportUri, shouldIgnoreShareIntentUri } from '../src/native/shareIntentFilter';

describe('shareIntentFilter', () => {
  it('ignores Expo development client URLs', () => {
    expect(shouldIgnoreShareIntentUri('chatstamp://expo-development-client/?url=http://localhost:8081')).toBe(true);
    expect(shouldIgnoreShareIntentUri('exp://192.168.1.20:8081')).toBe(true);
    expect(shouldIgnoreShareIntentUri('http://localhost:8081/index.bundle?platform=android')).toBe(true);
    expect(shouldIgnoreShareIntentUri('http://192.168.1.20:8081/index.bundle?platform=android')).toBe(true);
    expect(isShareImportUri('chatstamp://expo-development-client/?url=http://localhost:8081')).toBe(false);
  });

  it('accepts content and file URIs for import', () => {
    expect(isShareImportUri('content://com.whatsapp.provider.media/export_chat_folder/export.zip')).toBe(true);
    expect(isShareImportUri('file:///cache/export.zip')).toBe(true);
  });

  it('rejects non-file navigation URLs', () => {
    expect(isShareImportUri('https://example.com/export.zip')).toBe(false);
  });

  it('rejects non-ZIP content and file URIs', () => {
    expect(isShareImportUri('content://com.android.providers.media/photo.jpg')).toBe(false);
    expect(isShareImportUri('file:///cache/notes.txt')).toBe(false);
  });
});
