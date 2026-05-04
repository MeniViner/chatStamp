import { create } from 'zustand';
import type { ExportHistoryItem } from '../types/media';
import { logger } from '../lib/logger';
import { deleteJsonFile, readJsonFile, writeJsonFile } from './jsonFileStorage';
import { createExportHistoryItem } from './historyLogic';

const historyKey = 'export-history.v1.json';
const historyLimit = 50;

type HistoryState = {
  items: ExportHistoryItem[];
  loaded: boolean;
  loadHistory: () => Promise<void>;
  addHistoryItem: (item: ExportHistoryItem) => Promise<void>;
  deleteHistoryItem: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
};

async function persist(items: ExportHistoryItem[]) {
  await writeJsonFile(historyKey, items.slice(0, historyLimit));
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  items: [],
  loaded: false,
  loadHistory: async () => {
    try {
      set({ items: (await readJsonFile<ExportHistoryItem[]>(historyKey)) ?? [], loaded: true });
    } catch (error) {
      logger.warn('historyLoadFailed', error);
      set({ items: [], loaded: true });
    }
  },
  addHistoryItem: async (item) => {
    const next = [item, ...get().items.filter((existing) => existing.id !== item.id)].slice(0, historyLimit);
    set({ items: next });
    await persist(next);
  },
  deleteHistoryItem: async (id) => {
    const next = get().items.filter((item) => item.id !== id);
    set({ items: next });
    await persist(next);
  },
  clearHistory: async () => {
    set({ items: [] });
    await deleteJsonFile(historyKey);
  }
}));

export const historyStorage = { historyKey, historyLimit };
export { createExportHistoryItem };
