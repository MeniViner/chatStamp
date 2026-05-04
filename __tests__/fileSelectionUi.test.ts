import { describe, expect, it } from 'vitest';
import {
  defaultFileSelectionUiState,
  getVideoPreviewMode,
  getVoicePreviewProgress,
  shouldShowDeveloperDiagnostics,
  toggleCategoryFilter
} from '../src/screens/fileSelectionUi';

describe('fileSelectionUi', () => {
  it('keeps search collapsed by default and filter sheets closed initially', () => {
    expect(defaultFileSelectionUiState.searchOpen).toBe(false);
    expect(defaultFileSelectionUiState.filterSheetOpen).toBe(false);
    expect(defaultFileSelectionUiState.sortSheetOpen).toBe(false);
    expect(defaultFileSelectionUiState.sortMode).toBe('date-desc');
  });

  it('toggles category chips for the filter bottom sheet', () => {
    expect(toggleCategoryFilter([], 'photo')).toEqual(['photo']);
    expect(toggleCategoryFilter(['photo', 'video'], 'photo')).toEqual(['video']);
  });

  it('exposes voice preview progress safely', () => {
    expect(getVoicePreviewProgress(15, 60)).toBe(0.25);
    expect(getVoicePreviewProgress(15, 0)).toBe(0);
  });

  it('falls back gracefully when video preview reports an error', () => {
    expect(getVideoPreviewMode()).toBe('player');
    expect(getVideoPreviewMode('unsupported codec')).toBe('fallback');
  });

  it('hides developer diagnostics unless developer mode is enabled', () => {
    expect(shouldShowDeveloperDiagnostics(false)).toBe(false);
    expect(shouldShowDeveloperDiagnostics(true)).toBe(true);
  });
});
