import { create } from 'zustand';

type LanguageRestartState = {
  required: boolean;
  promptOpen: boolean;
  setRequired: (required: boolean, showPrompt?: boolean) => void;
  requestPrompt: () => void;
  dismiss: () => void;
};

export const useLanguageRestartStore = create<LanguageRestartState>((set) => ({
  required: false,
  promptOpen: false,
  setRequired: (required, showPrompt = false) => set((state) => ({
    required,
    promptOpen: required && (showPrompt || state.promptOpen)
  })),
  requestPrompt: () => set((state) => ({ promptOpen: state.required })),
  dismiss: () => set({ promptOpen: false })
}));
