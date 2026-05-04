import { create } from 'zustand';
import type { AppAppearance, AppSettings } from '../types/media';
import { TERMUX_PARITY_BASE_FOLDER } from '../lib/termuxParityOutput';
import { logger } from '../lib/logger';
import { readJsonFile, writeJsonFile } from './jsonFileStorage';
import { defaultSettings, mergeSettings } from './settingsLogic';

const settingsKey = 'settings.v1.json';

type SettingsState = {
  settings: AppSettings;
  loaded: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  resetSaveLocation: () => Promise<void>;
  setAppearance: (appearance: AppAppearance) => Promise<void>;
};

async function persist(settings: AppSettings) {
  await writeJsonFile(settingsKey, settings);
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  loaded: false,
  loadSettings: async () => {
    try {
      const parsed = await readJsonFile<Partial<AppSettings>>(settingsKey);
      set({ settings: mergeSettings(parsed), loaded: true });
    } catch (error) {
      logger.warn('settingsLoadFailed', error);
      set({ settings: defaultSettings, loaded: true });
    }
  },
  updateSettings: async (patch) => {
    const next = mergeSettings({ ...get().settings, ...patch });
    set({ settings: next });
    await persist(next);
  },
  resetSaveLocation: async () => {
    const next = mergeSettings({
      ...get().settings,
      baseFolder: TERMUX_PARITY_BASE_FOLDER,
      useDefaultFolder: true,
      saveDestinationMode: 'default-accurate-folder',
      customFolder: null,
      customFolderTimestampSupport: null
    });
    set({ settings: next });
    await persist(next);
  },
  setAppearance: async (appearance) => {
    const next = mergeSettings({ ...get().settings, appearance });
    set({ settings: next });
    await persist(next);
  }
}));

export const settingsStorage = { settingsKey, mergeSettings };
export { defaultSettings };
