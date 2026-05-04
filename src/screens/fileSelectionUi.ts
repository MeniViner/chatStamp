import type { MediaType } from '../types/media';

export type SortMode = 'date-desc' | 'date-asc' | 'name' | 'sender' | 'type';

export const defaultFileSelectionUiState = {
  searchOpen: false,
  filterSheetOpen: false,
  sortSheetOpen: false,
  saveableOnly: true,
  sortMode: 'date-desc' as SortMode,
  categoryFilters: [] as MediaType[]
};

export function toggleCategoryFilter(categoryFilters: MediaType[], mediaType: MediaType): MediaType[] {
  return categoryFilters.includes(mediaType)
    ? categoryFilters.filter((item) => item !== mediaType)
    : [...categoryFilters, mediaType];
}

export function getVoicePreviewProgress(currentTime: number, duration: number): number {
  if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(1, Math.max(0, currentTime / duration));
}

export function getVideoPreviewMode(error?: string | null): 'player' | 'fallback' {
  return error ? 'fallback' : 'player';
}

export function shouldShowDeveloperDiagnostics(developerMode: boolean): boolean {
  return developerMode;
}
