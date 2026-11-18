import { create } from 'zustand';
import type { ExportHistoryItem } from '../types/media';
import { logger } from '../lib/logger';
import { atomicStore } from './jsonFileStorage';
import { createExportHistoryItem, normalizeHistoryItem } from './historyLogic';
import { HistoryRepository } from '../services/historyService';

const repository = new HistoryRepository(atomicStore);

type HistoryState = {
  items: ExportHistoryItem[];
  loaded: boolean;
  loadHistory: () => Promise<void>;
  loadHistoryDetails: (id: string) => Promise<void>;
  addHistoryItem: (item: ExportHistoryItem) => Promise<void>;
  deleteHistoryItem: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
};

export const useHistoryStore = create<HistoryState>((set, get) => ({
  items: [],
  loaded: false,
  loadHistory: async () => {
    try {
      set({ items: await repository.load(), loaded: true });
    } catch (error) {
      logger.warn('historyLoadFailed', error);
      set({ items: [], loaded: true });
    }
  },
  loadHistoryDetails: async (id) => {
    const item = get().items.find((entry) => entry.id === id);
    if (!item || item.savedFiles || item.detailsMissing) return;
    const results = await repository.readDetails(id);
    set((state) => ({ items: state.items.map((entry) => entry.id === id
      ? normalizeHistoryItem({ ...entry, savedFiles: results ?? undefined, detailsMissing: results === null }) : entry) }));
  },
  addHistoryItem: async (item) => {
    await repository.save(item);
    set({ items: await repository.load() });
  },
  deleteHistoryItem: async (id) => {
    await repository.remove(id);
    set({ items: get().items.filter((item) => item.id !== id) });
  },
  clearHistory: async () => {
    await repository.clear();
    set({ items: [] });
  }
}));

export { createExportHistoryItem };
