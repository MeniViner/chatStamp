import type { AppSettings, OutputOrganizationMode, OutputOrganizationSettings } from '../types/media';
import { DEFAULT_GALLERY_ROOT, defaultOutputOrganization } from '../lib/outputOrganization';

export const defaultSettings: AppSettings = {
  baseFolder: DEFAULT_GALLERY_ROOT,
  useDefaultFolder: true,
  saveDestinationMode: 'default-accurate-folder',
  customFolder: null,
  customFolderTimestampSupport: null,
  outputOrganization: defaultOutputOrganization,
  onboardingCompleted: false,
  languagePreference: 'system',
  appearance: 'system',
  useDynamicColors: true,
  alwaysUseMessageDate: false,
  developerMode: false,
  showTechnicalLogs: false,
  keepCacheAfterFailedRun: false,
  lastOutputFolder: null
};

export function mergeSettings(value: Partial<AppSettings> | null | undefined): AppSettings {
  const outputOrganization = normalizeOutputOrganization(value?.outputOrganization as Record<string, unknown> | undefined);
  return {
    ...defaultSettings,
    ...value,
    alwaysUseMessageDate: value?.alwaysUseMessageDate === true,
    outputOrganization,
    saveDestinationMode: value?.saveDestinationMode ?? (value?.useDefaultFolder === false ? 'custom-folder' : defaultSettings.saveDestinationMode)
  };
}

function normalizeOutputOrganization(value: Record<string, unknown> | undefined): OutputOrganizationSettings {
  const mode = inferOutputOrganizationMode(value);
  const duplicateHandling = value?.duplicateHandling;

  return {
    ...defaultOutputOrganization,
    mode,
    createExportTimestampFolder: typeof value?.createExportTimestampFolder === 'boolean'
      ? value.createExportTimestampFolder
      : defaultOutputOrganization.createExportTimestampFolder,
    duplicateHandling:
      duplicateHandling === 'keep-both' || duplicateHandling === 'skip-existing' || duplicateHandling === 'replace-existing'
        ? duplicateHandling
        : defaultOutputOrganization.duplicateHandling
  };
}

function inferOutputOrganizationMode(value: Record<string, unknown> | undefined): OutputOrganizationMode {
  const explicitMode = value?.mode;
  if (
    explicitMode === 'all-in-one' ||
    explicitMode === 'by-type' ||
    explicitMode === 'by-sender' ||
    explicitMode === 'by-sender-and-type'
  ) {
    return explicitMode;
  }

  const includeSender = value?.includeSenderNameInFolders === true;
  const groupByTypeMode = value?.groupByTypeMode;
  const mediaFolderMode = value?.mediaFolderMode;
  const separateByType = groupByTypeMode === 'photos-videos-together' || groupByTypeMode === 'everything-separate-by-type' || mediaFolderMode === 'separate-by-type';
  const everythingTogether = groupByTypeMode === 'everything-together';

  if (includeSender && separateByType) return 'by-sender-and-type';
  if (includeSender) return 'by-sender';
  if (separateByType && !everythingTogether) return 'by-type';
  return defaultOutputOrganization.mode;
}
