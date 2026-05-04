import type { ExtractedMediaFile, MediaType, MediaTypeSelection } from '../types/media';
import { isSaveableMediaType } from '../lib/mediaUi';

export type FileFilterInput = {
  files: ExtractedMediaFile[];
  selectedSenders: string[];
  selectedMediaTypes: MediaTypeSelection;
  query?: string;
  category?: MediaType | 'all';
  categoryFilters?: MediaType[];
  saveableOnly?: boolean;
};

export function filterVisibleFiles({
  files,
  selectedSenders,
  selectedMediaTypes: _selectedMediaTypes,
  query = '',
  category = 'all',
  categoryFilters = [],
  saveableOnly = false
}: FileFilterInput): ExtractedMediaFile[] {
  void _selectedMediaTypes;
  const senderSet = new Set(selectedSenders);
  const normalizedQuery = query.trim().toLowerCase();
  const categorySet = new Set(categoryFilters);

  return files.filter((file) => {
    const sender = file.matchedRecord?.sender;
    const matchesCategory =
      (category === 'all' || file.mediaType === category) &&
      (categorySet.size === 0 || categorySet.has(file.mediaType));
    const matchesQuery =
      normalizedQuery.length === 0 ||
      file.filename.toLowerCase().includes(normalizedQuery) ||
      sender?.toLowerCase().includes(normalizedQuery);
    const matchesSaveable = !saveableOnly || isSaveableMediaType(file.mediaType);

    return Boolean(
      sender &&
        senderSet.has(sender) &&
        matchesCategory &&
        matchesQuery &&
        matchesSaveable
    );
  });
}

export function getVisibleSaveableFileIds(files: ExtractedMediaFile[]): string[] {
  return files.filter((file) => isSaveableMediaType(file.mediaType)).map((file) => file.id);
}
