import { create } from 'zustand';
import type { AppAppearance, AppSettings } from '../types/media';
import { DEFAULT_GALLERY_ROOT } from '../lib/outputOrganization';
import { logger } from '../lib/logger';
import { atomicStore, writeJsonFile } from './jsonFileStorage';
import { defaultSettings, mergeSettings } from './settingsLogic';

export type AppSettingsPatch = Omit<Partial<AppSettings>, 'outputOrganization'> & {
  outputOrganization?: Partial<AppSettings['outputOrganization']>;
};

const settingsKey = 'settings.v1.json';

type SettingsState = {
  settings: AppSettings;
  loaded: boolean;
  loadError: unknown | null;
  loadSettings: () => Promise<void>;
  updateSettings: (patch: AppSettingsPatch) => Promise<void>;
  resetSaveLocation: () => Promise<void>;
  setAppearance: (appearance: AppAppearance) => Promise<void>;
};

let settingsQueue: Promise<void> = Promise.resolve();

function serializeSettings(action: () => Promise<void>): Promise<void> {
  const result = settingsQueue.then(action, action);
  settingsQueue = result;
  void result.catch(() => undefined);
  return result;
}

export function awaitSettingsPersistence(): Promise<void> { return settingsQueue; }

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  loaded: false,
  loadError: null,
  loadSettings: () => serializeSettings(async () => {
    try {
      const text = await atomicStore.read(settingsKey);
      const parsed: unknown = text === null ? null : JSON.parse(text);
      if (text !== null && (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))) {
        throw new Error('Stored settings are not an object.');
      }
      set({ settings: mergeSettings(parsed as Partial<AppSettings> | null), loaded: true, loadError: null });
    } catch (error) {
      logger.warn('settingsLoadFailed', error);
      set({ loaded: false, loadError: error });
      throw error;
    }
  }),
  updateSettings: (patch) => serializeSettings(async () => {
    if (!get().loaded) throw get().loadError ?? new Error('Settings must be loaded before they can be changed.');
    const current = get().settings;
    const next = mergeSettings({ ...current, ...patch,
      outputOrganization: patch.outputOrganization ? { ...current.outputOrganization, ...patch.outputOrganization } : current.outputOrganization });
    await writeJsonFile(settingsKey, next);
    set({ settings: next });
  }),
  resetSaveLocation: () => get().updateSettings({
      baseFolder: DEFAULT_GALLERY_ROOT,
      useDefaultFolder: true,
      saveDestinationMode: 'default-accurate-folder',
      customFolder: null,
      customFolderTimestampSupport: null
  }),
  setAppearance: (appearance) => get().updateSettings({ appearance })
}));

export const settingsStorage = { settingsKey, mergeSettings };
export { defaultSettings };
