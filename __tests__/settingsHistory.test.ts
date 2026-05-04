import { describe, expect, it } from 'vitest';
import { defaultSettings, mergeSettings } from '../src/store/settingsLogic';
import { createExportHistoryItem } from '../src/store/historyLogic';
import type { CompletionSummary, ExtractedMediaFile, MediaTypeSelection } from '../src/types/media';

const selectedTypes: MediaTypeSelection = {
  photo: true,
  video: true,
  voice: true,
  audio: false,
  sticker: true,
  gif: false,
  document: true,
  unknown: false
};

function file(id: string, mediaType: ExtractedMediaFile['mediaType']): ExtractedMediaFile {
  return {
    id,
    filename: `${id}.jpg`,
    normalizedFilename: id,
    uri: `file:///${id}`,
    mediaType,
    matchedRecord: { id: `r-${id}`, filename: id, normalizedFilename: id, sender: 'Dana', messageDateIso: '2026-05-02T10:00:00.000Z', rawLine: '' }
  };
}

describe('settings and history helpers', () => {
  it('merges persisted settings with current defaults', () => {
    const merged = mergeSettings({ appearance: 'dark', outputOrganization: { mode: 'by-type' } as never });
    expect(merged.appearance).toBe('dark');
    expect(merged.developerMode).toBe(false);
    expect(merged.onboardingCompleted).toBe(false);
    expect(merged.baseFolder).toBe(defaultSettings.baseFolder);
    expect(merged.outputOrganization.mode).toBe('by-type');
    expect(merged.outputOrganization.createExportTimestampFolder).toBe(true);
  });

  it('persists developer mode as an explicit opt-in', () => {
    expect(mergeSettings({ developerMode: true }).developerMode).toBe(true);
    expect(defaultSettings.developerMode).toBe(false);
  });

  it('maps legacy organization flags to the new explicit modes', () => {
    expect(
      mergeSettings({ outputOrganization: { includeSenderNameInFolders: true, groupByTypeMode: 'everything-separate-by-type' } as never }).outputOrganization.mode
    ).toBe('by-sender-and-type');
    expect(
      mergeSettings({ outputOrganization: { includeSenderNameInFolders: false, groupByTypeMode: 'everything-together' } as never }).outputOrganization.mode
    ).toBe('all-in-one');
  });

  it('preserves custom folder and language preferences when settings are reloaded', () => {
    const merged = mergeSettings({
      saveDestinationMode: 'custom-folder',
      onboardingCompleted: true,
      customFolder: {
        treeUri: 'content://tree/primary:Documents',
        displayName: 'Documents',
        persistedPermission: true,
        readablePathLabel: 'Internal storage/Documents'
      },
      languagePreference: 'he'
    });

    expect(merged.saveDestinationMode).toBe('custom-folder');
    expect(merged.onboardingCompleted).toBe(true);
    expect(merged.customFolder?.treeUri).toContain('content://tree/');
    expect(merged.languagePreference).toBe('he');
  });

  it('creates history records without message contents', () => {
    const completion: CompletionSummary = {
      saved: 3,
      skipped: 0,
      failed: 1,
      filesystemTimestampFixed: 3,
      dateCorrected: 3,
      dateCorrectionFailed: 0,
      mayShowImportTime: 0,
      cacheCleared: true
    };
    const item = createExportHistoryItem({
      completion,
      files: [file('p', 'photo'), file('v', 'video'), file('voice', 'voice'), file('doc', 'document')],
      selectedFileIds: ['p', 'v', 'voice', 'doc'],
      selectedMediaTypes: selectedTypes,
      selectedSenders: ['Dana'],
      chatName: 'Chat',
      outputFolderPath: '/storage/emulated/0/Pictures/WhatsApp Media TimeFixer/Chat',
      now: new Date('2026-05-02T12:00:00.000Z')
    });

    expect(item.counts.totalSaved).toBe(3);
    expect(item.counts.photos).toBe(1);
    expect(item.counts.voice).toBe(1);
    expect(JSON.stringify(item)).not.toContain('rawLine');
  });
});
